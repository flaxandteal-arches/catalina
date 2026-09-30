"""Corrections to the overlays 0001 installed: ops_districts layer, buffer label."""

import logging
import uuid

from django.db import migrations

from catalina.overlays.loaders import run_loaders

logger = logging.getLogger(__name__)

NZAA_BUFFER_LAYER_ID = uuid.UUID("a7d0e8b1-3000-4001-8000-000000000001")
NZAA_SITES_LAYER_ID = uuid.UUID("a7d0e8b1-3000-4001-8000-000000000007")

BUFFER_LABEL_BEFORE = "NZAA Archaeological Sites"
BUFFER_LABEL_AFTER = "NZAA Site Buffers (200m)"
SITES_LABEL_AFTER = "NZAA Archaeological Sites"


def _set_ops_districts_layer_index(apps, layer_index):
    MapSource = apps.get_model("models", "MapSource")

    source_row = MapSource.objects.filter(name="ops_districts").first()
    if source_row is None:
        # Not registered in this environment; 0001's loader writes the URL when
        # the env allows it, and this runs after it on every replay.
        return

    source = dict(source_row.source)
    source["data"] = (
        f"/overlays/ops_districts/{layer_index}/query"
        "?where=1%3D1&outFields=*&f=geojson"
    )
    source_row.source = source
    source_row.save()


def update_installed_overlays(apps, schema_editor=None):
    MapLayer = apps.get_model("models", "MapLayer")

    _set_ops_districts_layer_index(apps, 1)
    MapLayer.objects.filter(maplayerid=NZAA_BUFFER_LAYER_ID).update(
        name=BUFFER_LABEL_AFTER
    )
    MapLayer.objects.filter(maplayerid=NZAA_SITES_LAYER_ID).update(
        name=SITES_LABEL_AFTER
    )


def load_all_overlays(apps, schema_editor):
    # run_loaders ends with update_installed_overlays, so the corrections land
    # after 0001 and 0004 have written the layers they correct.
    run_loaders(apps)


def restore_installed_overlays(apps, schema_editor):
    MapLayer = apps.get_model("models", "MapLayer")

    _set_ops_districts_layer_index(apps, 0)
    MapLayer.objects.filter(maplayerid=NZAA_BUFFER_LAYER_ID).update(
        name=BUFFER_LABEL_BEFORE
    )


class Migration(migrations.Migration):
    dependencies = [
        ("catalina", "0004_load_nzaa_sites_overlay"),
    ]

    operations = [
        migrations.RunPython(load_all_overlays, restore_installed_overlays),
    ]
