from django.apps import AppConfig
from django.db.models.signals import post_migrate


class CatalinaConfig(AppConfig):
    name = "catalina"
    is_arches_application = True

    def ready(self):
        from catalina.oauth_application import sync_gis_oauth_application

        # post_migrate is only sent for apps with a models module, which catalina
        # lacks, so listen for the app whose table we write to instead.
        post_migrate.connect(
            sync_gis_oauth_application,
            sender=self.apps.get_app_config("oauth2_provider"),
            dispatch_uid="catalina.sync_gis_oauth_application",
        )
