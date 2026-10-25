from django.urls import path

from apps.accounts.admin_api import (
    AdminAuditListView,
    AdminAuditVerifyView,
    AdminUserDetailView,
    AdminUserListView,
)
from apps.accounts.health import HealthView
from apps.accounts.lookup import UserLookupView
from apps.accounts.views import CsrfView, LoginView, LogoutView, MeView, RegisterView

urlpatterns = [
    path("csrf", CsrfView.as_view(), name="auth-csrf"),
    path("login", LoginView.as_view(), name="auth-login"),
    path("register", RegisterView.as_view(), name="auth-register"),
    path("logout", LogoutView.as_view(), name="auth-logout"),
    path("me", MeView.as_view(), name="auth-me"),
]

# Mounted from config.urls at /api/users/ and /api/admin/ and /api/health/
users_urlpatterns = [
    path("lookup/", UserLookupView.as_view(), name="users-lookup"),
]

admin_urlpatterns = [
    path("audit/", AdminAuditListView.as_view(), name="admin-audit-list"),
    path("audit/verify/", AdminAuditVerifyView.as_view(), name="admin-audit-verify"),
    path("users/", AdminUserListView.as_view(), name="admin-user-list"),
    path("users/<uuid:pk>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
]

health_urlpatterns = [
    path("", HealthView.as_view(), name="health"),
]
