"""Corrections to the overlays 0001 installed: topo URL, ops_districts layer, buffer label."""

import logging
import uuid

from django.conf import settings
from django.db import migrations

from catalina.overlays.loaders import run_loaders

logger = logging.getLogger(__name__)

NZAA_BUFFER_LAYER_ID = uuid.UUID("a7d0e8b1-3000-4001-8000-000000000001")
LINZ_TOPO_LAYER_ID = uuid.UUID("a7d0e8b1-3000-4001-8000-000000000006")

BUFFER_LABEL_BEFORE = "NZAA Archaeological Sites"
BUFFER_LABEL_AFTER = "NZAA Site Buffers (200m)"

# export, not an {z}/{x}/{y} template: the cache is NZTM2000 and only export
# reprojects. png8 is ~60KB a tile against png32's ~185KB, and looks the same.
MAPSERVER_TILE_URL = (
    "https://services1.arcgisonline.co.nz/arcgis/rest/services/LINZ/geotiffs/"
    "MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857"
    "&size=256,256&format=png8&transparent=true&f=image"
)

BASEMAPS_TILE_URL = (
    "https://basemaps.linz.govt.nz/v1/tiles/topo-raster-gridded/WebMercatorQuad/"
    "{{z}}/{{x}}/{{y}}.webp?api={key}"
)


def _upsert_topo(apps, source):
    MapLayer = apps.get_model("models", "MapLayer")
    MapSource = apps.get_model("models", "MapSource")

    MapSource.objects.update_or_create(name="topo", defaults={"source": source})
    MapLayer.objects.update_or_create(
        maplayerid=LINZ_TOPO_LAYER_ID,
        defaults={
            "name": "LINZ Topo",
            "layerdefinitions": [{"id": "topo", "source": "topo", "type": "raster"}],
            "isoverlay": True,
            "sortorder": 60,
            "activated": True,
            "addtomap": False,
            "ispublic": True,
            "icon": "fa fa-mountain",
        },
    )


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

    _upsert_topo(
        apps,
        {"type": "raster", "tiles": [MAPSERVER_TILE_URL], "tileSize": 256},
    )
    _set_ops_districts_layer_index(apps, 1)
    MapLayer.objects.filter(maplayerid=NZAA_BUFFER_LAYER_ID).update(
        name=BUFFER_LABEL_AFTER
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

    if not settings.LINZ_BASEMAPS_API_KEY:
        # Nothing to go back to: 0001 only created this layer when the key was set.
        MapSource = apps.get_model("models", "MapSource")
        MapLayer.objects.filter(maplayerid=LINZ_TOPO_LAYER_ID).delete()
        MapSource.objects.filter(name="topo").delete()
        logger.warning(
            "LINZ_BASEMAPS_API_KEY is not set; removed the topo overlay rather "
            "than restoring a keyless LINZ Basemaps URL."
        )
        return

    _upsert_topo(
        apps,
        {
            "type": "raster",
            "tiles": [BASEMAPS_TILE_URL.format(key=settings.LINZ_BASEMAPS_API_KEY)],
            "tileSize": 256,
        },
    )


class Migration(migrations.Migration):
    dependencies = [
        ("catalina", "0004_load_nzaa_sites_overlay"),
    ]

    operations = [
        migrations.RunPython(load_all_overlays, restore_installed_overlays),
    ]
