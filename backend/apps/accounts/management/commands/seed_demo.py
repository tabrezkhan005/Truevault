import hashlib
import os

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import User
from apps.documents.models import Document, DocumentContent, Grant

# Public demo default (also in README). Override with SEED_DEMO_PASSWORD for deploy.
DEMO_PASSWORD = os.environ.get("SEED_DEMO_PASSWORD", "DemoPass123!")

TXT_SAMPLE = b"TrustVault demo document for owner A.\n"
# Minimal PDF header; enough for filetype/pdf detection in casual demo use.
PDF_SAMPLE = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"


class Command(BaseCommand):
    help = "Seed demo users, documents, and grants for local/demo environments."

    def handle(self, *args, **options):
        with transaction.atomic():
            admin, _ = User.objects.update_or_create(
                email="admin@trustvault.demo",
                defaults={
                    "username": "admin@trustvault.demo",
                    "role": User.Role.ADMIN,
                    "is_active": True,
                    "is_staff": True,
                },
            )
            admin.set_password(DEMO_PASSWORD)
            admin.save()

            owner_a, _ = User.objects.update_or_create(
                email="owner_a@trustvault.demo",
                defaults={
                    "username": "owner_a@trustvault.demo",
                    "role": User.Role.OWNER,
                    "is_active": True,
                },
            )
            owner_a.set_password(DEMO_PASSWORD)
            owner_a.save()

            owner_b, _ = User.objects.update_or_create(
                email="owner_b@trustvault.demo",
                defaults={
                    "username": "owner_b@trustvault.demo",
                    "role": User.Role.OWNER,
                    "is_active": True,
                },
            )
            owner_b.set_password(DEMO_PASSWORD)
            owner_b.save()

            viewer_none, _ = User.objects.update_or_create(
                email="viewer_none@trustvault.demo",
                defaults={
                    "username": "viewer_none@trustvault.demo",
                    "role": User.Role.VIEWER,
                    "is_active": True,
                },
            )
            viewer_none.set_password(DEMO_PASSWORD)
            viewer_none.save()

            viewer_read, _ = User.objects.update_or_create(
                email="viewer_read@trustvault.demo",
                defaults={
                    "username": "viewer_read@trustvault.demo",
                    "role": User.Role.VIEWER,
                    "is_active": True,
                },
            )
            viewer_read.set_password(DEMO_PASSWORD)
            viewer_read.save()

            viewer_edit, _ = User.objects.update_or_create(
                email="viewer_edit@trustvault.demo",
                defaults={
                    "username": "viewer_edit@trustvault.demo",
                    "role": User.Role.VIEWER,
                    "is_active": True,
                },
            )
            viewer_edit.set_password(DEMO_PASSWORD)
            viewer_edit.save()

            doc_txt = self._ensure_doc(
                owner_a,
                name="owner-a-notes.txt",
                category="demo",
                data=TXT_SAMPLE,
                content_type="text/plain",
            )
            self._ensure_doc(
                owner_a,
                name="owner-a-brief.pdf",
                category="demo",
                data=PDF_SAMPLE,
                content_type="application/pdf",
            )
            self._ensure_doc(
                owner_b,
                name="owner-b-notes.txt",
                category="demo",
                data=b"Owner B private notes.\n",
                content_type="text/plain",
            )

            Grant.objects.update_or_create(
                document=doc_txt,
                user=viewer_read,
                defaults={"level": Grant.Level.READ, "granted_by": owner_a},
            )
            Grant.objects.update_or_create(
                document=doc_txt,
                user=viewer_edit,
                defaults={"level": Grant.Level.EDIT, "granted_by": owner_a},
            )

        self.stdout.write(self.style.SUCCESS("Demo seed complete."))
        self.stdout.write("Accounts (password for all):")
        self.stdout.write(f"  {DEMO_PASSWORD}")
        for email, role in [
            ("admin@trustvault.demo", "admin"),
            ("owner_a@trustvault.demo", "owner"),
            ("owner_b@trustvault.demo", "owner"),
            ("viewer_none@trustvault.demo", "viewer none"),
            ("viewer_read@trustvault.demo", "viewer read"),
            ("viewer_edit@trustvault.demo", "viewer edit"),
        ]:
            self.stdout.write(f"  - {email} ({role})")

    def _ensure_doc(self, owner, name, category, data, content_type):
        doc = Document.objects.filter(owner=owner, name=name, deleted_at__isnull=True).first()
        digest = hashlib.sha256(data).hexdigest()
        if doc is None:
            doc = Document.objects.create(
                owner=owner,
                name=name,
                category=category,
                content_type_detected=content_type,
                size_bytes=len(data),
                sha256=digest,
            )
            DocumentContent.objects.create(document=doc, data=data)
        else:
            doc.category = category
            doc.content_type_detected = content_type
            doc.size_bytes = len(data)
            doc.sha256 = digest
            doc.save()
            content, _ = DocumentContent.objects.get_or_create(
                document=doc, defaults={"data": data}
            )
            if content.data != data:
                content.data = data
                content.save(update_fields=["data"])
        return doc
