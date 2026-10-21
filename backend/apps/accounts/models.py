import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


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
