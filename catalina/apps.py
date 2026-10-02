from django.apps import AppConfig, apps
from django.db.models.signals import post_migrate


def _apply_overlays(sender, **kwargs):
    from catalina.overlays.apply import apply_overlays

    apply_overlays()


class CatalinaConfig(AppConfig):
    name = "catalina"
    is_arches_application = True

    def ready(self):
        # Every migrate, including each deploy's, writes the overlay registry.
        # post_migrate is only sent for apps with a models module, which this
        # app lacks, so listen for Arches' core models app, the one that owns
        # MapLayer/MapSource. All migrations have run by the time it's sent.
        post_migrate.connect(
            _apply_overlays,
            sender=apps.get_app_config("models"),
            dispatch_uid="catalina.apply_overlays",
        )
