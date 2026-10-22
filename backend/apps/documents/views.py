from urllib.parse import quote

from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditEvent
from apps.audit.service import record, record_denied
from apps.documents.models import Document, DocumentContent
from apps.documents.permissions import IsOwnerRole, get_document_or_404
from apps.documents.serializers import (
    DocumentListSerializer,
    DocumentSerializer,
    DocumentUploadSerializer,
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
        # Content lives in DocumentContent — list never selects it.
        qs = Document.objects.visible_to(request.user)
        paginator = DocumentPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        record(
            request,
            action=AuditEvent.Action.LIST,
            outcome=AuditEvent.Outcome.ALLOWED,
            detail={"result_count": len(page) if page is not None else qs.count()},
        )
        serializer = DocumentListSerializer(page, many=True, context={"request": request})
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
            # WHY: rejected uploads are still security-relevant events.
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

    @extend_schema(responses={200: DocumentSerializer})
    def get(self, request, pk):
        """Who may call: users who can read the document (owner or any grantee)."""
        document = get_document_or_404(request, pk, "read")
        record(
            request,
            action=AuditEvent.Action.LIST,
            outcome=AuditEvent.Outcome.ALLOWED,
            document=document,
            detail={"view": "detail"},
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
            # Re-fetch content inside the same transaction as the audit write.
            content = DocumentContent.objects.select_for_update().get(document_id=document.id)
            data = bytes(content.data)
            record(
                request,
                action=AuditEvent.Action.DOWNLOAD,
                outcome=AuditEvent.Outcome.ALLOWED,
                document=document,
                detail={"size_bytes": document.size_bytes},
            )

        filename = document.name or "download"
        # ASCII fallback + RFC 5987 for the real name.
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
        return response
