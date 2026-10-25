import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.accounts.email_norm import normalise_email


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        VIEWER = "viewer", "Viewer"
        OWNER = "owner", "Owner"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    # role must never be writable from a request body
    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.VIEWER,
    )

    def save(self, *args, **kwargs):
        # WHY lowercase: unique EmailField is case-sensitive on Postgres;
        # storing only normalised form makes Owner@x and owner@x the same identity.
        self.email = normalise_email(self.email)
        if self.username:
            self.username = normalise_email(self.username)
        super().save(*args, **kwargs)
