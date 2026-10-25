from django.contrib.auth import login, logout
from django.db import IntegrityError, transaction
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.email_norm import normalise_email
from apps.accounts.models import User
from apps.accounts.serializers import LoginSerializer, MeSerializer, RegisterSerializer
from apps.accounts.throttles import (
    LoginEmailRateThrottle,
    LoginRateThrottle,
    RegisterEmailRateThrottle,
    RegisterRateThrottle,
)
from apps.audit.models import AuditEvent
from apps.audit.service import record


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    """Who may call: anyone (sets CSRF cookie for subsequent session POSTs)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        responses={200: {"type": "object", "properties": {"ok": {"type": "boolean"}}}}
    )
    def get(self, request):
        return Response({"ok": True})


class LoginView(APIView):
    """Who may call: anyone; issues a session on success."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [LoginRateThrottle, LoginEmailRateThrottle]

    @extend_schema(request=LoginSerializer, responses={200: MeSerializer})
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = normalise_email(serializer.validated_data["email"])
        password = serializer.validated_data["password"]

        user = User.objects.filter(email=email).first()
        # WHY same failure path for unknown email / bad password / inactive:
        # never reveal which check failed (no user enumeration).
        valid = user is not None and user.is_active and user.check_password(password)
        if not valid:
            record(
                request,
                action=AuditEvent.Action.LOGIN_FAILED,
                outcome=AuditEvent.Outcome.DENIED,
                reason="invalid_credentials",
                detail={"email": email[:254]},
            )
            return Response(
                {"detail": "Invalid credentials"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        # WHY cycle_key: prevent session fixation if an anonymous session existed.
        request.session.cycle_key()
        record(
            request,
            action=AuditEvent.Action.LOGIN,
            outcome=AuditEvent.Outcome.ALLOWED,
        )
        return Response(MeSerializer(user).data)


class RegisterView(APIView):
    """
    Who may call: anyone (challenge demo signup).

    WHY open with role choice: judges need to create viewer/owner/admin accounts
    without Shell access. Residual risk: anyone can mint an admin — accepted for
    this hiring window; throttle + password rules still apply.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [RegisterRateThrottle, RegisterEmailRateThrottle]

    @extend_schema(request=RegisterSerializer, responses={201: MeSerializer})
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]
        role = serializer.validated_data["role"]

        if User.objects.filter(email=email).exists():
            record(
                request,
                action=AuditEvent.Action.REGISTER,
                outcome=AuditEvent.Outcome.DENIED,
                reason="email_taken",
                detail={"email": email[:254]},
            )
            return Response(
                {"detail": "An account with this email already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                user = User(
                    email=email,
                    username=email,
                    role=role,
                    is_active=True,
                    # Staff flag unused (/admin not mounted); keep False always.
                    is_staff=False,
                )
                user.set_password(password)
                user.save()
                record(
                    request,
                    action=AuditEvent.Action.REGISTER,
                    outcome=AuditEvent.Outcome.ALLOWED,
                    target_user=user,
                    detail={"role": role},
                )
        except IntegrityError:
            return Response(
                {"detail": "An account with this email already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        request.session.cycle_key()
        record(
            request,
            action=AuditEvent.Action.LOGIN,
            outcome=AuditEvent.Outcome.ALLOWED,
        )
        return Response(MeSerializer(user).data, status=status.HTTP_201_CREATED)


class LogoutView(APIView):
    """Who may call: authenticated users."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: {"type": "object"}})
    def post(self, request):
        record(
            request,
            action=AuditEvent.Action.LOGOUT,
            outcome=AuditEvent.Outcome.ALLOWED,
        )
        logout(request)
        return Response({"ok": True})


class MeView(APIView):
    """Who may call: authenticated users; returns id, email, role only."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: MeSerializer})
    def get(self, request):
        return Response(MeSerializer(request.user).data)
