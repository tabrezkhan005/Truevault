from django.db import migrations


def normalise_emails(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    for user in User.objects.all().iterator():
        email = (user.email or "").strip().lower()
        username = (user.username or "").strip().lower()
        updates = []
        if user.email != email:
            user.email = email
            updates.append("email")
        if user.username != username:
            user.username = username
            updates.append("username")
        if updates:
            user.save(update_fields=updates)


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(normalise_emails, migrations.RunPython.noop),
    ]
