import uuid

from django.db import models
from django.utils import timezone


class AuditQuerySet(models.QuerySet):
    """Append-only: bulk mutation must never rewrite history."""

    def update(self, **kwargs):
        raise ValueError("AuditEvent rows cannot be updated")

    def delete(self):
        raise ValueError("AuditEvent rows cannot be deleted")


class AuditManager(models.Manager):
    def get_queryset(self):
        return AuditQuerySet(self.model, using=self._db)


class AuditEvent(models.Model):
    """Tamper-evident, append-only security log (hash-chained)."""

    class Action(models.TextChoices):
        LOGIN = "login", "login"
        LOGIN_FAILED = "login_failed", "login_failed"
        LOGOUT = "logout", "logout"
        UPLOAD = "upload", "upload"
        DOWNLOAD = "download", "download"
        EDIT = "edit", "edit"
        DELETE = "delete", "delete"
        GRANT_ADD = "grant_add", "grant_add"
        GRANT_CHANGE = "grant_change", "grant_change"
        GRANT_REVOKE = "grant_revoke", "grant_revoke"
        ROLE_CHANGE = "role_change", "role_change"
        USER_DEACTIVATE = "user_deactivate", "user_deactivate"
        LIST = "list", "list"
        SEARCH = "search", "search"
        AI_SUGGEST = "ai_suggest", "ai_suggest"
        AI_DECISION = "ai_decision", "ai_decision"

    class Outcome(models.TextChoices):
        ALLOWED = "allowed", "allowed"
        DENIED = "denied", "denied"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seq = models.BigIntegerField(unique=True)
    # default= not auto_now_add: hash is computed before INSERT; auto_now_add
    # would rewrite ts in pre_save and invalidate the hash.
    ts = models.DateTimeField(default=timezone.now)

    # Snapshots, not FKs: deleting a user must never alter or cascade history.
    actor_id = models.UUIDField(null=True, blank=True)
    actor_email = models.CharField(max_length=254, blank=True, default="")
    actor_role = models.CharField(max_length=10, blank=True, default="")

    action = models.CharField(max_length=32, choices=Action.choices)
    outcome = models.CharField(max_length=10, choices=Outcome.choices)
    reason = models.CharField(max_length=64, blank=True, default="")

    # No FK: deleting a document must never alter history.
    document_id = models.UUIDField(null=True, blank=True)
    target_user_id = models.UUIDField(null=True, blank=True)

    remote_addr = models.CharField(max_length=200, blank=True, default="")
    # Unverified: clients/proxies can spoof X-Forwarded-For; stored for forensics only.
    forwarded_for = models.CharField(max_length=200, blank=True, default="")
    user_agent = models.CharField(max_length=200, blank=True, default="")

    detail = models.JSONField(default=dict, blank=True)

    prev_hash = models.CharField(max_length=64)
    hash = models.CharField(max_length=64)

    objects = AuditManager()

    class Meta:
        ordering = ["seq"]

    def save(self, *args, **kwargs):
        # WHY: history is evidence; rewriting a row would break the chain's meaning.
        if not self._state.adding:
            raise ValueError("AuditEvent rows cannot be updated")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("AuditEvent rows cannot be deleted")
