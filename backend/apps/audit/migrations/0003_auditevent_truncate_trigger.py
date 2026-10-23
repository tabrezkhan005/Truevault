from django.db import migrations


# Reuses audit_reject_mutation() from 0002 (TG_OP becomes TRUNCATE).
# Statement-level: TRUNCATE does not fire row-level UPDATE/DELETE triggers.
FORWARD_SQL = """
DROP TRIGGER IF EXISTS audit_auditevent_no_truncate ON audit_auditevent;
CREATE TRIGGER audit_auditevent_no_truncate
    BEFORE TRUNCATE ON audit_auditevent
    FOR EACH STATEMENT
    EXECUTE PROCEDURE audit_reject_mutation();
"""

REVERSE_SQL = """
DROP TRIGGER IF EXISTS audit_auditevent_no_truncate ON audit_auditevent;
"""


def apply_truncate_trigger(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(FORWARD_SQL, params=None)


def drop_truncate_trigger(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(REVERSE_SQL, params=None)


class Migration(migrations.Migration):
    dependencies = [
        ("audit", "0002_auditevent_immutability_trigger"),
    ]

    operations = [
        migrations.RunPython(apply_truncate_trigger, drop_truncate_trigger),
    ]
