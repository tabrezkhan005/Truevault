"""
URL configuration for config project.
"""
from django.contrib import admin
from django.urls import include, path

from apps.accounts.urls import admin_urlpatterns, health_urlpatterns, users_urlpatterns

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", include(health_urlpatterns)),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/users/", include(users_urlpatterns)),
    path("api/admin/", include(admin_urlpatterns)),
    path("api/documents/", include("apps.documents.urls")),
]
