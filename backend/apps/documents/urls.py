from django.urls import path

from apps.documents.views import (
    DocumentDetailView,
    DocumentDownloadView,
    DocumentGrantDestroyView,
    DocumentGrantListCreateView,
    DocumentListCreateView,
)

urlpatterns = [
    path("", DocumentListCreateView.as_view(), name="document-list-create"),
    path("<uuid:pk>/", DocumentDetailView.as_view(), name="document-detail"),
    path("<uuid:pk>/download/", DocumentDownloadView.as_view(), name="document-download"),
    path("<uuid:pk>/grants/", DocumentGrantListCreateView.as_view(), name="document-grants"),
    path(
        "<uuid:pk>/grants/<uuid:user_id>/",
        DocumentGrantDestroyView.as_view(),
        name="document-grant-destroy",
    ),
]
