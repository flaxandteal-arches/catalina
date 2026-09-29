from django.conf import settings
from django.db import migrations

APPLICATION_NAME = "GIS OAuth Application"


class Migration(migrations.Migration):

    dependencies = [
        ("catalina", "0003_widen_files_path"),
        ("oauth2_provider", "0009_add_hash_client_secret"),
    ]

    def forwards(apps, schema_editor):
        if not settings.OAUTH_CLIENT_ID:
            raise RuntimeError("OAUTH_CLIENT_ID must be set before running catalina 0004")

        db_alias = schema_editor.connection.alias

        Application = apps.get_model("oauth2_provider", "Application")

        Application.objects.using(db_alias).get_or_create(
            name=APPLICATION_NAME,
            client_id=settings.OAUTH_CLIENT_ID,
            defaults={
                "client_type": "public",
                "authorization_grant_type": "password",
                "hash_client_secret": False,
            },
        )

    def backwards(apps, schema_editor):
        db_alias = schema_editor.connection.alias

        Application = apps.get_model("oauth2_provider", "Application")

        Application.objects.using(db_alias).filter(
            name=APPLICATION_NAME,
        ).delete()

    operations = [
        migrations.RunPython(forwards, backwards),
    ]