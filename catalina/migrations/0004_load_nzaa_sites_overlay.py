"""Add the NZAA archaeological sites overlay (0001 registered only DOC's 200m buffer)."""

import logging
import uuid

from django.conf import settings
from django.db import migrations

logger = logging.getLogger(__name__)

NZAA_SITES_LAYER_ID = uuid.UUID("a7d0e8b1-3000-4001-8000-000000000007")


def load_nzaa_sites(apps, schema_editor=None):
    MapLayer = apps.get_model("models", "MapLayer")
    MapSource = apps.get_model("models", "MapSource")

    portal_configured = bool(
        settings.ARCGIS_PORTAL_URL
        and settings.ARCGIS_PORTAL_USERNAME
        and settings.ARCGIS_PORTAL_PASSWORD
    )
    if not portal_configured or "nzaa_sites" not in settings.PORTAL_OVERLAYS_AVAILABLE:
        logger.warning(
            "Skipping the NZAA sites overlay: portal env incomplete or "
            "'nzaa_sites' absent from PORTAL_OVERLAYS_AVAILABLE."
        )
        return

    MapSource.objects.update_or_create(
        name="nzaa_sites",
        defaults={
            "source": {
                "type": "geojson",
                "promoteId": "objectid",
                "data": "/overlays/nzaa_sites/0/query?where=1%3D1&outFields=*&f=geojson",
            }
        },
    )

    # Circle and fill/line both registered: the service needs a token to
    # inspect, so its geometry is unconfirmed. Mapbox GL draws nothing for the
    # absent one rather than erroring.
    popup = {
        "arches:popup": {
            "title": "name",
            "fields": [
                ["Site", "name"],
                ["NZAA ID", "nzaa_id"],
                ["Features", "sitefeatures"],
                ["Period", "period"],
            ],
        }
    }
    hovered = ["boolean", ["feature-state", "hover"], False]

    MapLayer.objects.update_or_create(
        maplayerid=NZAA_SITES_LAYER_ID,
        defaults={
            "name": "NZAA Archaeological Sites",
            "isoverlay": True,
            "sortorder": 5,
            "activated": True,
            "addtomap": False,
            "ispublic": False,
            "icon": "fa fa-monument",
            "layerdefinitions": [
                {
                    "id": "nzaa_sites-fill",
                    "source": "nzaa_sites",
                    "type": "fill",
                    "metadata": popup,
                    "paint": {
                        "fill-color": "#be123c",
                        "fill-opacity": ["case", hovered, 0.6, 0.4],
                    },
                },
                {
                    "id": "nzaa_sites-outline",
                    "source": "nzaa_sites",
                    "type": "line",
                    "paint": {
                        "line-color": ["case", hovered, "#4c0519", "#9f1239"],
                        "line-width": ["case", hovered, 2, 1],
                    },
                },
                {
                    "id": "nzaa_sites-point",
                    "source": "nzaa_sites",
                    "type": "circle",
                    "metadata": popup,
                    "paint": {
                        "circle-color": "#be123c",
                        "circle-radius": ["case", hovered, 7, 5],
                        "circle-stroke-color": "#4c0519",
                        "circle-stroke-width": 1,
                        "circle-opacity": ["case", hovered, 1, 0.85],
                    },
                },
            ],
        },
    )


def unload_nzaa_sites(apps, schema_editor):
    MapLayer = apps.get_model("models", "MapLayer")
    MapSource = apps.get_model("models", "MapSource")
    MapLayer.objects.filter(maplayerid=NZAA_SITES_LAYER_ID).delete()
    MapSource.objects.filter(name="nzaa_sites").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("catalina", "0003_widen_files_path"),
    ]

    operations = [
        migrations.RunPython(load_nzaa_sites, unload_nzaa_sites),
    ]
