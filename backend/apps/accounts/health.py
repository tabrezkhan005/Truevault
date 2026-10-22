from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    """
    Who may call: anyone (uptime monitor).

    No audit write, no DB writes — keep this cheap and side-effect free.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = []

    @extend_schema(
        responses={200: {"type": "object", "properties": {"ok": {"type": "boolean"}}}}
    )
    def get(self, request):
        return Response({"ok": True})
