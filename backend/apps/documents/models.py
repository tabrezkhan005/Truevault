import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


class DocumentQuerySet(models.QuerySet):
    def visible_to(self, user):
        """
        Documents this user is allowed to know exist.

        WHY: every list/search/detail path must start here so a guessed UUID
        for someone else's file never appears. Soft-deleted rows are gone.
        Anonymous and inactive users see nothing (deny by default).
        """
        if user is None or not getattr(user, "is_authenticated", False):
            return self.none()
        if not getattr(user, "is_active", False):
            return self.none()
        return (
            self.filter(deleted_at__isnull=True)
            .filter(Q(owner_id=user.id) | Q(grants__user_id=user.id))
            .distinct()
        )


class DocumentManager(models.Manager):
    def get_queryset(self):
        return DocumentQuerySet(self.model, using=self._db)

    def visible_to(self, user):
        return self.get_queryset().visible_to(user)


class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="owned_documents",
    )
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=64, db_index=True, blank=True, default="")
    content_type_detected = models.CharField(max_length=128)
    size_bytes = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = DocumentManager()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class DocumentContent(models.Model):
    """File bytes in a separate table so list queries never load them."""

    document = models.OneToOneField(
        Document,
        on_delete=models.CASCADE,
        related_name="content",
        primary_key=True,
    )
    data = models.BinaryField()


class Grant(models.Model):
    class Level(models.TextChoices):
        READ = "read", "read"
        EDIT = "edit", "edit"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="grants",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="document_grants",
    )
    level = models.CharField(max_length=10, choices=Level.choices)
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="grants_made",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["document", "user"],
                name="uniq_grant_document_user",
            ),
        ]
