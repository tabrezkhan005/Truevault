"""
URL configuration for config project.
"""
from django.urls import include, path

from apps.accounts.urls import admin_urlpatterns, health_urlpatterns, users_urlpatterns

urlpatterns = [
    # Django's built-in /admin/ is intentionally not mounted. Staff admin APIs
    # live under /api/admin/ with IsAdminRole. No ModelAdmin registrations exist.
    path("api/health/", include(health_urlpatterns)),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/users/", include(users_urlpatterns)),
    path("api/admin/", include(admin_urlpatterns)),
    path("api/documents/", include("apps.documents.urls")),
]
