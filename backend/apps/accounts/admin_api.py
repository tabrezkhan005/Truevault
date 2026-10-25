import uuid

from django.db import transaction
from django.utils.dateparse import parse_date, parse_datetime
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.session_utils import flush_user_sessions
from apps.audit.models import AuditEvent
from apps.audit.service import record, record_denied
from apps.audit.verify import verify_audit_chain
from apps.documents.permissions import IsAdminRole


class AdminPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 50


class AdminUserSerializer(serializers.ModelSerializer):
    # role writable only via this admin endpoint — never from self-service bodies.
    role = serializers.ChoiceField(choices=User.Role.choices, required=False)
    is_active = serializers.BooleanField(required=False)

    class Meta:
        model = User
        fields = ("id", "email", "role", "is_active")
        read_only_fields = ("id", "email")


class AdminAuditSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditEvent
        fields = (
            "id",
            "seq",
            "ts",
            "actor_id",
            "actor_email",
            "actor_role",
            "action",
            "outcome",
            "reason",
            "document_id",
            "target_user_id",
            "remote_addr",
            "detail",
            "prev_hash",
            "hash",
        )
        read_only_fields = fields


class AdminAuditListView(APIView):
    """Who may call: admin. Metadata/audit only — never file bytes."""

    permission_classes = [IsAdminRole]

    @extend_schema(responses={200: AdminAuditSerializer(many=True)})
    def get(self, request):
        qs = AuditEvent.objects.all().order_by("-seq")
        actor = (request.query_params.get("actor") or "").strip()
        action = (request.query_params.get("action") or "").strip()
        outcome = (request.query_params.get("outcome") or "").strip()
        document = (request.query_params.get("document") or "").strip()
        date = (request.query_params.get("date") or "").strip()

        if actor:
            try:
                qs = qs.filter(actor_id=uuid.UUID(actor))
            except ValueError:
                qs = qs.filter(actor_email__iexact=actor)
        if action:
            qs = qs.filter(action=action)
        if outcome:
            qs = qs.filter(outcome=outcome)
        if document:
            try:
                qs = qs.filter(document_id=uuid.UUID(document))
            except ValueError:
                return Response({"detail": "Invalid document id"}, status=400)
        if date:
            d = parse_date(date)
            dt = parse_datetime(date) if d is None else None
            if d is not None:
                qs = qs.filter(ts__date=d)
            elif dt is not None:
                if timezone.is_naive(dt):
                    dt = timezone.make_aware(dt, timezone.utc)
                qs = qs.filter(ts__date=dt.date())
            else:
                return Response({"detail": "Invalid date"}, status=400)

        paginator = AdminPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response(AdminAuditSerializer(page, many=True).data)


class AdminAuditVerifyView(APIView):
    """Who may call: admin. Recomputes the hash chain."""

    permission_classes = [IsAdminRole]

    @extend_schema(responses={200: {"type": "object"}})
    def get(self, request):
        ok, broken_seq = verify_audit_chain()
        head = AuditEvent.objects.order_by("-seq").first()
        head_payload = {
            "head_seq": head.seq if head else 0,
            "head_hash": head.hash if head else "",
        }
        if ok:
            return Response({"ok": True, **head_payload})
        return Response(
            {"ok": False, "broken_seq": broken_seq, **head_payload},
            status=409,
        )


class AdminUserListView(APIView):
    """Who may call: admin. User metadata only."""

    permission_classes = [IsAdminRole]

    @extend_schema(responses={200: AdminUserSerializer(many=True)})
    def get(self, request):
        qs = User.objects.all().order_by("email")
        paginator = AdminPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response(AdminUserSerializer(page, many=True).data)


class AdminUserDetailView(APIView):
    """Who may call: admin. Patch role / is_active; cannot demote/deactivate self."""

    permission_classes = [IsAdminRole]

    @extend_schema(request=AdminUserSerializer, responses={200: AdminUserSerializer})
    def patch(self, request, pk):
        target = User.objects.filter(pk=pk).first()
        if target is None:
            return Response({"detail": "Not found"}, status=404)

        serializer = AdminUserSerializer(target, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        new_role = serializer.validated_data.get("role")
        new_active = serializer.validated_data.get("is_active")

        # WHY: an admin locking themselves out would strand the deployment.
        if target.id == request.user.id:
            if new_role is not None and new_role != target.role:
                record_denied(
                    request,
                    action=AuditEvent.Action.ROLE_CHANGE,
                    reason="validation_failed",
                    target_user=target,
                    detail={"error": "cannot change own role"},
                )
                return Response(
                    {"detail": "Cannot change your own role"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if new_active is False:
                record_denied(
                    request,
                    action=AuditEvent.Action.USER_DEACTIVATE,
                    reason="validation_failed",
                    target_user=target,
                    detail={"error": "cannot deactivate self"},
                )
                return Response(
                    {"detail": "Cannot deactivate yourself"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        with transaction.atomic():
            role_changed = new_role is not None and new_role != target.role
            deactivating = new_active is False and target.is_active
            activating = new_active is True and not target.is_active

            if new_role is not None:
                target.role = new_role
            if new_active is not None:
                target.is_active = new_active
            target.save()

            if role_changed:
                record(
                    request,
                    action=AuditEvent.Action.ROLE_CHANGE,
                    outcome=AuditEvent.Outcome.ALLOWED,
                    target_user=target,
                    detail={"role": target.role},
                )
            if deactivating:
                flush_user_sessions(target)
                record(
                    request,
                    action=AuditEvent.Action.USER_DEACTIVATE,
                    outcome=AuditEvent.Outcome.ALLOWED,
                    target_user=target,
                    detail={"is_active": False},
                )
            elif activating:
                record(
                    request,
                    action=AuditEvent.Action.ROLE_CHANGE,
                    outcome=AuditEvent.Outcome.ALLOWED,
                    target_user=target,
                    detail={"is_active": True},
                )

        return Response(AdminUserSerializer(target).data)
