"""
URL configuration for config project.
"""
from django.urls import include, path

from apps.accounts.urls import admin_urlpatterns, health_urlpatterns, users_urlpatterns

# JSON bodies only — never HTML debug pages for API 404/500 when DEBUG=False.
handler404 = "config.api_security.json_404"
handler500 = "config.api_security.json_500"

urlpatterns = [
    # Django's built-in /admin/ is intentionally not mounted. Staff admin APIs
    # live under /api/admin/ with IsAdminRole. No ModelAdmin registrations exist.
    # drf-spectacular schema/Swagger URLs are NOT mounted (AutoSchema annotations
    # only). Production renderers are JSON-only.
    path("api/health/", include(health_urlpatterns)),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/users/", include(users_urlpatterns)),
    path("api/admin/", include(admin_urlpatterns)),
    path("api/documents/", include("apps.documents.urls")),
]
