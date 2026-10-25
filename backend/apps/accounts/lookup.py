from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.email_norm import normalise_email
from apps.accounts.models import User
from apps.documents.permissions import IsOwnerOrAdminRole
from apps.documents.throttles import LookupRateThrottle


class UserLookupView(APIView):
    """
    Who may call: active owner or admin.

    Exact email match only — no listing, no partial match (directory leak).
    """

    permission_classes = [IsAuthenticated, IsOwnerOrAdminRole]
    throttle_classes = [LookupRateThrottle]

    @extend_schema(
        responses={
            200: {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "format": "uuid"},
                    "email": {"type": "string"},
                },
            }
        }
    )
    def get(self, request):
        email = normalise_email(request.query_params.get("email") or "")
        if not email:
            return Response({"detail": "email is required"}, status=400)
        if "\x00" in email or len(email) > 254:
            return Response({"detail": "Invalid email"}, status=400)
        user = User.objects.filter(email=email, is_active=True).only(
            "id", "email"
        ).first()
        if user is None:
            # WHY 404 not 200 empty: still no enumeration via distinct error bodies;
            # owners already know the address they typed.
            return Response({"detail": "Not found"}, status=404)
        return Response({"id": str(user.id), "email": user.email})
