from django.core.management.base import BaseCommand

from apps.audit.verify import verify_audit_chain


class Command(BaseCommand):
    help = "Recompute the audit hash chain and report the first break."

    def handle(self, *args, **options):
        ok, broken_seq = verify_audit_chain()
        if ok:
            self.stdout.write("OK")
            return
        self.stderr.write(f"BROKEN at seq={broken_seq}")
        raise SystemExit(1)
