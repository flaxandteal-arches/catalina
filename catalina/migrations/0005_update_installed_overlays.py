"""Corrections to the overlays 0001 installed: ops_districts layer index, per-view fetch for nzaa and cons_land."""

import logging
import uuid

from django.db import migrations

from catalina.overlays.loaders import run_loaders

logger = logging.getLogger(__name__)

NZAA_SITES_LAYER_ID = uuid.UUID("a7d0e8b1-3000-4001-8000-000000000001")
CONS_LAND_LAYER_ID = uuid.UUID("a7d0e8b1-3000-4001-8000-000000000002")


def _set_layer_index(apps, slug, layer_index):
    MapSource = apps.get_model("models", "MapSource")

    source_row = MapSource.objects.filter(name=slug).first()
    if source_row is None:
        # Not registered in this environment; 0001's loader writes the URL when
        # the env allows it, and this runs after it on every replay.
        return

    source = dict(source_row.source)
    source["data"] = (
        f"/overlays/{slug}/{layer_index}/query?where=1%3D1&outFields=*&f=geojson"
    )
    source_row.source = source
    source_row.save()


def _set_bbox_fetch(apps, slug, layer_id, fetch_config):
    """Empty the source and let the project map configurator fill it per view.

    For layers past their service's maxRecordCount; see
    catalina/media/js/utils/map-configurator.js. The config goes on the first
    layer definition, or is removed from it when fetch_config is None.
    """
    MapLayer = apps.get_model("models", "MapLayer")
    MapSource = apps.get_model("models", "MapSource")

    source_row = MapSource.objects.filter(name=slug).first()
    layer_row = MapLayer.objects.filter(maplayerid=layer_id).first()
    if source_row is None or layer_row is None:
        # Not registered in this environment; see _set_layer_index.
        return

    if fetch_config is not None:
        source_row.source = {
            **source_row.source,
            "data": {"type": "FeatureCollection", "features": []},
        }
        source_row.save()

    layers = [dict(layer) for layer in layer_row.layerdefinitions]
    metadata = dict(layers[0].get("metadata") or {})
    metadata.pop("arches:bbox-fetch", None)
    if fetch_config is not None:
        metadata["arches:bbox-fetch"] = fetch_config
    layers[0]["metadata"] = metadata
    MapLayer.objects.filter(maplayerid=layer_id).update(layerdefinitions=layers)


def update_installed_overlays(apps, schema_editor=None):

    _set_layer_index(apps, "ops_districts", 1)
    # nzaa should point at the sites service, layer 7.
    _set_bbox_fetch(
        apps,
        "nzaa",
        NZAA_SITES_LAYER_ID,
        # Same sizing as nzaa_buff in 0004: ~13k sites in a zoom-9 Auckland view.
        {
            "url": "/overlays/nzaa/7/query",
            "minzoom": 9,
            "maxpages": 8,
            "outFields": "objectid,name,nzaa_id,sitefeatures,period",
        },
    )
    # ~11k features against a maxRecordCount of 1000. Simplified to zoom 6 the
    # whole layer is ~10 MB, so 12 pages lets a national view load untruncated.
    _set_bbox_fetch(
        apps,
        "cons_land",
        CONS_LAND_LAYER_ID,
        {
            "url": "/overlays/cons_land/0/query",
            "minzoom": 6,
            "maxpages": 12,
            # objectid (promoteId) and the popup fields from 0001.
            "outFields": "objectid,type,napalis_id,name,recorded_area",
        },
    )


def load_all_overlays(apps, schema_editor):
    # run_loaders ends with update_installed_overlays, so the corrections land
    # after 0001 and 0004 have written the layers they correct.
    run_loaders(apps)


def restore_installed_overlays(apps, schema_editor):

    _set_layer_index(apps, "ops_districts", 0)
    _set_layer_index(apps, "nzaa", 0)
    _set_bbox_fetch(apps, "nzaa", NZAA_SITES_LAYER_ID, None)
    _set_layer_index(apps, "cons_land", 0)
    _set_bbox_fetch(apps, "cons_land", CONS_LAND_LAYER_ID, None)


class Migration(migrations.Migration):
    dependencies = [
        ("catalina", "0004_load_nzaa_buff_overlay"),
    ]

    operations = [
        migrations.RunPython(load_all_overlays, restore_installed_overlays),
    ]
