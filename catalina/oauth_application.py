"""Keep the GIS OAuth2 application in sync with settings.OAUTH_CLIENT_ID.

Registers a public django-oauth-toolkit Application used for password-grant
token requests from third-party GIS applications.

Notes:
Connected to post_migrate in CatalinaConfig.ready(), so it runs on every
``migrate`` (including when there are no migrations to apply). Changing
OAUTH_CLIENT_ID and re-running ``migrate`` updates the existing row in place.
The application is identified by name, so renaming it in the admin will make the
next sync try to create a second one.
If OAUTH_CLIENT_ID is empty the sync is skipped with a warning; an existing
application is left untouched.
The grant and client type string literals match the constants on
oauth2_provider.models.AbstractApplication.
"""

import logging

from django.conf import settings

logger = logging.getLogger(__name__)

APPLICATION_NAME = "GIS OAuth Application"


def sync_gis_oauth_application(using="default", **kwargs):
    from oauth2_provider.models import get_application_model

    client_id = settings.OAUTH_CLIENT_ID
    if not client_id:
        logger.warning(
            "OAUTH_CLIENT_ID is not set; skipping %s sync", APPLICATION_NAME
        )
        return

    Application = get_application_model()
    Application.objects.using(using).update_or_create(
        name=APPLICATION_NAME,
        defaults={
            "client_id": client_id,
            "client_type": "public",
            "authorization_grant_type": "password",
            "hash_client_secret": False,
        },
    )
