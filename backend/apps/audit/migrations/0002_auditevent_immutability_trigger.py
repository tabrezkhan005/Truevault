from django.db import migrations


FORWARD_SQL = """
CREATE OR REPLACE FUNCTION audit_reject_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_auditevent is append-only: % not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_auditevent_immutability ON audit_auditevent;
CREATE TRIGGER audit_auditevent_immutability
    BEFORE UPDATE OR DELETE ON audit_auditevent
    FOR EACH ROW
    EXECUTE PROCEDURE audit_reject_mutation();
"""

REVERSE_SQL = """
DROP TRIGGER IF EXISTS audit_auditevent_immutability ON audit_auditevent;
DROP FUNCTION IF EXISTS audit_reject_mutation();
"""


def apply_trigger(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    # params=None: send SQL unprocessed. The plpgsql RAISE uses '%' as its own
    # format marker for TG_OP; Django/psycopg must not treat it as a bind param.
    schema_editor.execute(FORWARD_SQL, params=None)


def drop_trigger(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(REVERSE_SQL, params=None)


class Migration(migrations.Migration):
    dependencies = [
        ("audit", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(apply_trigger, drop_trigger),
    ]
