import hashlib
import hmac
from urllib.parse import quote

from django.db import IntegrityError, transaction
from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.audit.models import AuditEvent
from apps.audit.service import record, record_denied
from apps.documents.models import Document, DocumentContent, Grant
from apps.documents.permissions import get_document_or_404, IsOwnerRole
from apps.documents.search import apply_document_filters
from apps.documents.serializers import (
    DocumentContentPutSerializer,
    DocumentListSerializer,
    DocumentMetadataPatchSerializer,
    DocumentSerializer,
    DocumentUploadSerializer,
    GrantSerializer,
    GrantWriteSerializer,
)
from apps.documents.throttles import DownloadRateThrottle
from apps.documents.validators import UploadValidationError, validate_upload


class DocumentPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 50


class DocumentListCreateView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsOwnerRole()]
        return [IsAuthenticated()]

    @extend_schema(responses={200: DocumentListSerializer(many=True)})
    def get(self, request):
        """Who may call: authenticated users; results limited by visible_to()."""
        # WHY: always start from visible_to — search must not leak other people's docs.
        qs = Document.objects.visible_to(request.user).select_related("owner")
        qs, used_filters = apply_document_filters(qs, request.query_params)
        paginator = DocumentPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        action = (
            AuditEvent.Action.SEARCH if used_filters else AuditEvent.Action.LIST
        )
        record(
            request,
            action=action,
            outcome=AuditEvent.Outcome.ALLOWED,
            detail={
                "result_count": len(page) if page is not None else 0,
                "filters": used_filters,
            },
        )
        serializer = DocumentListSerializer(
            page, many=True, context={"request": request}
        )
        return paginator.get_paginated_response(serializer.data)

    @extend_schema(request=DocumentUploadSerializer, responses={201: DocumentSerializer})
    def post(self, request):
        """Who may call: authenticated active users with role=owner."""
        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded = serializer.validated_data["file"]
        try:
            validated = validate_upload(uploaded)
        except UploadValidationError as exc:
            record_denied(
                request,
                action=AuditEvent.Action.UPLOAD,
                reason="validation_failed",
                detail={"error": exc.message, "filename": validated_name_safe(uploaded)},
            )
            return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)

        display_name = (serializer.validated_data.get("name") or "").strip()
        if not display_name:
            display_name = validated.safe_filename
        display_name = display_name[:120]
        category = (serializer.validated_data.get("category") or "").strip()[:64]

        # WHY: owner is always request.user — ignore any owner field in the body.
        with transaction.atomic():
            document = Document.objects.create(
                owner=request.user,
                name=display_name,
                category=category,
                content_type_detected=validated.content_type_detected,
                size_bytes=validated.size_bytes,
                sha256=validated.sha256,
            )
            DocumentContent.objects.create(document=document, data=validated.data)
            record(
                request,
                action=AuditEvent.Action.UPLOAD,
                outcome=AuditEvent.Outcome.ALLOWED,
                document=document,
                detail={
                    "filename": validated.safe_filename,
                    "size_bytes": validated.size_bytes,
                    "sha256": validated.sha256,
                },
            )

        return Response(
            DocumentSerializer(document, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


def validated_name_safe(uploaded_file) -> str:
    from apps.documents.validators import sanitise_filename

    return sanitise_filename(getattr(uploaded_file, "name", "") or "unnamed")


class DocumentDetailView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    @extend_schema(responses={200: DocumentSerializer})
    def get(self, request, pk):
        """Who may call: users who can read the document (owner or any grantee)."""
        document = get_document_or_404(request, pk, "read")
        record(
            request,
            action=AuditEvent.Action.VIEW,
            outcome=AuditEvent.Outcome.ALLOWED,
            document=document,
        )
        return Response(
            DocumentSerializer(document, context={"request": request}).data
        )

    @extend_schema(
        request=DocumentMetadataPatchSerializer, responses={200: DocumentSerializer}
    )
    def patch(self, request, pk):
        """Who may call: owner or edit-level grantee (metadata only)."""
        document = get_document_or_404(request, pk, "edit")
        serializer = DocumentMetadataPatchSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updates = []
        if "name" in serializer.validated_data:
            document.name = serializer.validated_data["name"].strip()[:120]
            updates.append("name")
        if "category" in serializer.validated_data:
            document.category = serializer.validated_data["category"].strip()[:64]
            updates.append("category")
        with transaction.atomic():
            if updates:
                updates.append("updated_at")
                document.save(update_fields=updates)
            record(
                request,
                action=AuditEvent.Action.EDIT,
                outcome=AuditEvent.Outcome.ALLOWED,
                document=document,
                detail={"fields": updates, "kind": "metadata"},
            )
        return Response(
            DocumentSerializer(document, context={"request": request}).data
        )

    @extend_schema(
        request=DocumentContentPutSerializer, responses={200: DocumentSerializer}
    )
    def put(self, request, pk):
        """Who may call: owner or edit-level grantee (replace file bytes)."""
        document = get_document_or_404(request, pk, "edit")
        serializer = DocumentContentPutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uploaded = serializer.validated_data["file"]
        try:
            validated = validate_upload(uploaded)
        except UploadValidationError as exc:
            record_denied(
                request,
                action=AuditEvent.Action.EDIT,
                reason="validation_failed",
                document=document,
                detail={"error": exc.message, "filename": validated_name_safe(uploaded)},
            )
            return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            content, _created = DocumentContent.objects.select_for_update().get_or_create(
                document=document,
                defaults={"data": validated.data},
            )
            if not _created:
                content.data = validated.data
                content.save(update_fields=["data"])
            document.content_type_detected = validated.content_type_detected
            document.size_bytes = validated.size_bytes
            document.sha256 = validated.sha256
            document.save(
                update_fields=[
                    "content_type_detected",
                    "size_bytes",
                    "sha256",
                    "updated_at",
                ]
            )
            record(
                request,
                action=AuditEvent.Action.EDIT,
                outcome=AuditEvent.Outcome.ALLOWED,
                document=document,
                detail={
                    "kind": "content",
                    "filename": validated.safe_filename,
                    "size_bytes": validated.size_bytes,
                    "sha256": validated.sha256,
                },
            )
        return Response(
            DocumentSerializer(document, context={"request": request}).data
        )

    @extend_schema(responses={204: None})
    def delete(self, request, pk):
        """Who may call: document owner only (soft delete)."""
        document = get_document_or_404(request, pk, "delete")
        with transaction.atomic():
            document.deleted_at = timezone.now()
            document.save(update_fields=["deleted_at", "updated_at"])
            record(
                request,
                action=AuditEvent.Action.DELETE,
                outcome=AuditEvent.Outcome.ALLOWED,
                document=document,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class DocumentDownloadView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [DownloadRateThrottle]

    @extend_schema(responses={200: bytes})
    def get(self, request, pk):
        """Who may call: owner or any grantee; bytes only after authorize(download)."""
        document = get_document_or_404(request, pk, "download")

        with transaction.atomic():
            content = DocumentContent.objects.select_for_update().get(
                document_id=document.id
            )
            data = bytes(content.data)
            # WHY compare_digest: refuse silently-tampered rows; never stream
            # bytes that do not match the hash recorded at upload.
            digest = hashlib.sha256(data).hexdigest()
            if not hmac.compare_digest(digest, document.sha256):
                record(
                    request,
                    action=AuditEvent.Action.INTEGRITY_FAILURE,
                    outcome=AuditEvent.Outcome.DENIED,
                    document=document,
                    detail={"reason": "sha256_mismatch"},
                )
                return Response(
                    {"detail": "Download unavailable"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            record(
                request,
                action=AuditEvent.Action.DOWNLOAD,
                outcome=AuditEvent.Outcome.ALLOWED,
                document=document,
                detail={"size_bytes": document.size_bytes},
            )

        filename = document.name or "download"
        ascii_name = filename.encode("ascii", "ignore").decode("ascii") or "download"
        ascii_name = ascii_name.replace('"', "")
        disposition = (
            f'attachment; filename="{ascii_name}"; '
            f"filename*=UTF-8''{quote(filename)}"
        )
        response = HttpResponse(data, content_type="application/octet-stream")
        response["Content-Disposition"] = disposition
        response["X-Content-Type-Options"] = "nosniff"
        response["Cache-Control"] = "private, no-store"
        response["Content-Security-Policy"] = "sandbox"
        return response


class DocumentGrantListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: GrantSerializer(many=True)})
    def get(self, request, pk):
        """Who may call: document owner only (manage_grants)."""
        document = get_document_or_404(request, pk, "manage_grants")
        grants = Grant.objects.filter(document=document).select_related("user", "granted_by")
        return Response(GrantSerializer(grants, many=True).data)

    @extend_schema(request=GrantWriteSerializer, responses={200: GrantSerializer})
    def post(self, request, pk):
        """Who may call: document owner only; upserts grant level."""
        document = get_document_or_404(request, pk, "manage_grants")
        serializer = GrantWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target = User.objects.filter(id=serializer.validated_data["user_id"]).first()
        level = serializer.validated_data["level"]

        if target is None or not target.is_active:
            record_denied(
                request,
                action=AuditEvent.Action.GRANT_ADD,
                reason="validation_failed",
                document=document,
                detail={"error": "user inactive or missing"},
            )
            return Response(
                {"detail": "Cannot grant to inactive or unknown user"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if target.id == document.owner_id:
            # WHY: owner already has full power; a grant row would confuse revoke semantics.
            record_denied(
                request,
                action=AuditEvent.Action.GRANT_ADD,
                reason="validation_failed",
                document=document,
                target_user=target,
                detail={"error": "cannot grant to owner"},
            )
            return Response(
                {"detail": "Cannot grant to the document owner"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            existing = Grant.objects.filter(document=document, user=target).first()
            if existing is None:
                try:
                    grant = Grant.objects.create(
                        document=document,
                        user=target,
                        level=level,
                        granted_by=request.user,
                    )
                    action = AuditEvent.Action.GRANT_ADD
                except IntegrityError:
                    # WHY: concurrent upserts race the unique (document, user).
                    grant = Grant.objects.select_for_update().get(
                        document=document, user=target
                    )
                    grant.level = level
                    grant.granted_by = request.user
                    grant.save(update_fields=["level", "granted_by"])
                    action = AuditEvent.Action.GRANT_CHANGE
            else:
                existing.level = level
                existing.granted_by = request.user
                existing.save(update_fields=["level", "granted_by"])
                grant = existing
                action = AuditEvent.Action.GRANT_CHANGE
            record(
                request,
                action=action,
                outcome=AuditEvent.Outcome.ALLOWED,
                document=document,
                target_user=target,
                detail={"level": level},
            )
        return Response(GrantSerializer(grant).data)


class DocumentGrantDestroyView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={204: None})
    def delete(self, request, pk, user_id):
        """Who may call: document owner only; revoke takes effect immediately."""
        document = get_document_or_404(request, pk, "manage_grants")
        grant = Grant.objects.filter(document=document, user_id=user_id).first()
        if grant is None:
            record_denied(
                request,
                action=AuditEvent.Action.GRANT_REVOKE,
                reason="not_found_or_no_grant",
                document=document,
                detail={"target_user_id": str(user_id)},
            )
            return Response(status=status.HTTP_404_NOT_FOUND)

        target = grant.user
        with transaction.atomic():
            # WHY: delete the row — no cache; next request re-reads Grant from DB.
            grant.delete()
            record(
                request,
                action=AuditEvent.Action.GRANT_REVOKE,
                outcome=AuditEvent.Outcome.ALLOWED,
                document=document,
                target_user=target,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
