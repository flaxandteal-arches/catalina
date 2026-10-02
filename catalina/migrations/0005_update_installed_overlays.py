"""Corrections to the overlays 0001 installed: ops_districts layer index, per-view fetch for nzaa and cons_land, DOC symbology for cons_land, popups."""

import logging
import uuid

from django.db import migrations

from catalina.overlays.loaders import run_loaders

logger = logging.getLogger(__name__)

NZAA_SITES_LAYER_ID = uuid.UUID("a7d0e8b1-3000-4001-8000-000000000001")
CONS_LAND_LAYER_ID = uuid.UUID("a7d0e8b1-3000-4001-8000-000000000002")
OPS_REGIONS_LAYER_ID = uuid.UUID("a7d0e8b1-3000-4001-8000-000000000003")

# 0001 used the DOC_WebsiteRegions field; the default ops_regions service,
# DOC_OperationsRegions_HFLr, names its fields regionname and regioncode.
OPS_REGIONS_POPUP_BEFORE = {"title": "region", "fields": [["Region", "region"]]}
OPS_REGIONS_POPUP_AFTER = {
    "title": "regionname",
    "fields": [["Region", "regionname"], ["Code", "regioncode"]],
}

# name is often null, so the popup title uses the always-populated nzaa_id.
NZAA_POPUP_BEFORE = {
    "title": "name",
    "fields": [
        ["Site", "name"],
        ["NZAA ID", "nzaa_id"],
        ["Features", "sitefeatures"],
        ["Period", "period"],
    ],
}
NZAA_POPUP_AFTER = {
    "title": "nzaa_id",
    "fields": [
        ["Name", "name"],
        ["NZAA ID", "nzaa_id"],
        ["Features", "sitefeatures"],
        ["Period", "period"],
    ],
}

HOVERED = ["boolean", ["feature-state", "hover"], False]

# DOC's own symbology for this layer, from the "Public Conservation Land" layer
# item (568e551c7ce94807821b097201015fbe) on the portal: a unique-value
# renderer on `section`, grouped into the classes its legend shows.
CONS_LAND_CLASSES = [
    (
        "National Park",
        "#ffff00",
        ["S4_NATIONAL_PARK", "S9_2_LAND_HELD_FOR_NATIONAL_PARK_PURPOSES"],
    ),
    ("Conservation Park", "#38a800", ["S19_CONSERVATION_PARK"]),
    (
        "Specially Protected Area",
        "#b2b2b2",
        [
            "S21_ECOLOGICAL_AREA",
            "S23A_AMENITY_AREA",
            "S22_SANCTUARY_AREA",
            "S14A_WILDLIFE_MANAGEMENT_RESERVE",
            "20_WILDERNESS_AREA",
        ],
    ),
    ("Conservation Area", "#eba554", ["S7_CONSERVATION_PURPOSES"]),
    (
        "Reserve",
        "#73b2ff",
        [
            "17_RECREATION_RESERVE",
            "S18_HISTORIC_RESERVE",
            "S19_1_B_SCENIC_RESERVE",
            "S21_SCIENTIFIC_RESERVE",
            "S20_NATURE_RESERVE",
            "S19_1_A_SCENIC_RESERVE",
            "S22_GOVERNMENT_PURPOSE_RESERVE",
            "S23_LOCAL_PURPOSE_RESERVE",
        ],
    ),
    ("Stewardship Area", "#55ff00", ["S25_STEWARDSHIP_AREA"]),
    (
        "Marginal Strip",
        "#895a44",
        ["S24_3_FIXED_MARGINAL_STRIP", "S24_1_2_MOVEABLE_MARGINAL_STRIP"],
    ),
    ("Wildlife Management Area", "#ff0000", ["S23B_WILDLIFE_MANAGEMENT_AREA"]),
    ("Waitangi Endowment Forest", "#aa66cd", ["S2_WAITANGI_ENDOWMENT_FOREST"]),
]
# Sections DOC adds later, which its renderer doesn't classify either.
CONS_LAND_UNCLASSIFIED = ("Other", "#ffffff")
CONS_LAND_OUTLINE = "#6e6e6e"


def _cons_land_fill_color():
    expression = ["match", ["get", "section"]]
    for _label, colour, sections in CONS_LAND_CLASSES:
        expression += [sections, colour]
    return expression + [CONS_LAND_UNCLASSIFIED[1]]


def _cons_land_legend():
    swatch = (
        '<div style="display: flex; align-items: center; gap: 6px; margin: 2px 0;">'
        '<span style="display: inline-block; width: 14px; height: 10px; '
        f'background: {{colour}}; border: 1px solid {CONS_LAND_OUTLINE};"></span>'
        "{label}</div>"
    )
    entries = [(label, colour) for label, colour, _sections in CONS_LAND_CLASSES]
    entries.append(CONS_LAND_UNCLASSIFIED)
    return "".join(
        swatch.format(label=label, colour=colour) for label, colour in entries
    )


CONS_LAND_PAINT_BEFORE = {
    "cons_land-fill": {
        "fill-color": "#22c55e",
        "fill-opacity": ["case", HOVERED, 0.5, 0.25],
    },
    "cons_land-outline": {
        "line-color": ["case", HOVERED, "#052e16", "#15803d"],
        "line-width": ["case", HOVERED, 2, 0.5],
    },
}
CONS_LAND_PAINT_AFTER = {
    "cons_land-fill": {
        "fill-color": _cons_land_fill_color(),
        # A little above 0001's 0.25: DOC's pale yellows and blues wash out.
        "fill-opacity": ["case", HOVERED, 0.6, 0.35],
    },
    "cons_land-outline": {
        "line-color": ["case", HOVERED, "#1f2937", CONS_LAND_OUTLINE],
        "line-width": ["case", HOVERED, 2, 1],
    },
}

CONS_LAND_POPUP_BEFORE = {
    "title": "name",
    "fields": [
        ["Type", "type"],
        ["NaPALIS ID", "napalis_id"],
        ["Name", "name"],
        ["Recorded Area (ha)", "recorded_area"],
    ],
}
CONS_LAND_POPUP_AFTER = {
    "title": "name",
    "fields": [
        ["Type", "type"],
        ["Section", "section"],
        ["NaPALIS ID", "napalis_id"],
        ["Name", "name"],
        ["Recorded Area (ha)", "recorded_area"],
    ],
}


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


def _set_popup(apps, layer_id, popup):
    """Replace the arches:popup config on every layer definition that has one."""
    MapLayer = apps.get_model("models", "MapLayer")

    layer_row = MapLayer.objects.filter(maplayerid=layer_id).first()
    if layer_row is None:
        return

    layers = [dict(layer) for layer in layer_row.layerdefinitions]
    for layer in layers:
        if "arches:popup" in (layer.get("metadata") or {}):
            layer["metadata"] = {**layer["metadata"], "arches:popup": popup}
    MapLayer.objects.filter(maplayerid=layer_id).update(layerdefinitions=layers)


def _set_style(apps, layer_id, paints, legend):
    """Replace the paint of the named layer definitions, and the layer's legend.

    paints maps a layer definition id to its new paint. The legend is HTML,
    shown under the overlay's name in the map's legend panel.
    """
    MapLayer = apps.get_model("models", "MapLayer")

    layer_row = MapLayer.objects.filter(maplayerid=layer_id).first()
    if layer_row is None:
        return

    layers = [dict(layer) for layer in layer_row.layerdefinitions]
    for layer in layers:
        if layer.get("id") in paints:
            layer["paint"] = paints[layer["id"]]
    MapLayer.objects.filter(maplayerid=layer_id).update(
        layerdefinitions=layers, legend=legend
    )


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
    _set_popup(apps, NZAA_SITES_LAYER_ID, NZAA_POPUP_AFTER)
    _set_popup(apps, OPS_REGIONS_LAYER_ID, OPS_REGIONS_POPUP_AFTER)
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
            # objectid (promoteId), section (symbology) and the popup fields.
            "outFields": "objectid,type,section,napalis_id,name,recorded_area",
        },
    )
    _set_style(apps, CONS_LAND_LAYER_ID, CONS_LAND_PAINT_AFTER, _cons_land_legend())
    _set_popup(apps, CONS_LAND_LAYER_ID, CONS_LAND_POPUP_AFTER)


def load_all_overlays(apps, schema_editor):
    # run_loaders ends with update_installed_overlays, so the corrections land
    # after 0001 and 0004 have written the layers they correct.
    run_loaders(apps)


def restore_installed_overlays(apps, schema_editor):

    _set_layer_index(apps, "ops_districts", 0)
    _set_layer_index(apps, "nzaa", 0)
    _set_bbox_fetch(apps, "nzaa", NZAA_SITES_LAYER_ID, None)
    _set_popup(apps, NZAA_SITES_LAYER_ID, NZAA_POPUP_BEFORE)
    _set_popup(apps, OPS_REGIONS_LAYER_ID, OPS_REGIONS_POPUP_BEFORE)
    _set_layer_index(apps, "cons_land", 0)
    _set_bbox_fetch(apps, "cons_land", CONS_LAND_LAYER_ID, None)
    # 0001 set no legend.
    _set_style(apps, CONS_LAND_LAYER_ID, CONS_LAND_PAINT_BEFORE, None)
    _set_popup(apps, CONS_LAND_LAYER_ID, CONS_LAND_POPUP_BEFORE)


class Migration(migrations.Migration):
    dependencies = [
        ("catalina", "0004_load_nzaa_buff_overlay"),
    ]

    operations = [
        migrations.RunPython(load_all_overlays, restore_installed_overlays),
    ]
