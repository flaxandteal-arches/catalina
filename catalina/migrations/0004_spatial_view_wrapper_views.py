"""Wrapper views that rename the auto-generated spatial-view columns.

Arches builds one object per geometry type for each spatial view
(``public.<slug>_point`` / ``_linestring`` / ``_polygon``). Their column names
are derived from each node's *alias* via ``__arches_slugify`` and cannot be
customised through the spatial-view definition. These thin wrapper views give
downstream consumers (e.g. GeoServer) the names we actually want, without
touching the Arches-managed objects (which get dropped/recreated whenever the
SpatialView row is regenerated).

EDIT ``WRAPPER_VIEWS`` below. The *left* side of each ``columns`` mapping must
match the real column name in the generated object — i.e. the slugified node
alias, NOT the ``description`` from the spatial_views JSON. Confirm with
``\\d public.<slug>_point`` in dbshell before relying on this.
"""

from django.db import migrations

# Wrapper view name = "<slug>_<geom>" + WRAPPER_SUFFIX, e.g. "monument_point_export".
WRAPPER_SUFFIX = "_export"

PASSTHROUGH_LEADING = ["resourceinstanceid", "gid", "tileid", "nodeid"]
PASSTHROUGH_TRAILING = ["geom"]

# slug -> { geometry_types: [...], columns: { source_column: exported_name } }
WRAPPER_VIEWS = {
    "monument": {
        "geometry_types": ["point", "linestring", "polygon"],
        "columns": {
            "monument_name": "monument_name",
            "monument_type": "monument_type",
            "area_name": "district",
            "external_cross_reference": "global_id",
        },
    },
    "area": {
        "geometry_types": ["polygon"],
        "columns": {
            "area_name_n1": "area_name",
            "legacy_id": "amis_floc_id",
        },
    },
    "activity": {
        "geometry_types": ["polygon"],
        "columns": {
            "activity_name": "name",
            "activity_type": "survey_type",
            "display_date": "survey_year",
            "external_cross_reference": "nepalis_id",
        },
    },
    "consultation": {
        "geometry_types": ["point", "linestring", "polygon"],
        "columns": {
            "consultation_name": "asset_name",
            "log_date": "date_of_assessment",
            "planning_outcome": "rec_monitoring_freq",
            "consultation_description": "overall_cond_assessment",
            "external_cross_reference": "global_id",
        },
    },
}


def _wrapper_names(slug, geom):
    return f"public.{slug}_{geom}", f"public.{slug}_{geom}{WRAPPER_SUFFIX}"


def create_wrappers(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        for slug, cfg in WRAPPER_VIEWS.items():
            for geom in cfg["geometry_types"]:
                source, target = _wrapper_names(slug, geom)

                cursor.execute("select to_regclass(%s)", [source])
                if cursor.fetchone()[0] is None:
                    print(f"Skipping wrapper {target}: source {source} does not exist")
                    continue

                select_cols = (
                    PASSTHROUGH_LEADING
                    + [f'"{src}" as "{dst}"' for src, dst in cfg["columns"].items()]
                    + PASSTHROUGH_TRAILING
                )
                cursor.execute(
                    f"create or replace view {target} as "
                    f"select {', '.join(select_cols)} from {source};"
                )


def drop_wrappers(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        for slug, cfg in WRAPPER_VIEWS.items():
            for geom in cfg["geometry_types"]:
                _, target = _wrapper_names(slug, geom)
                cursor.execute(f"drop view if exists {target};")


class Migration(migrations.Migration):
    dependencies = [
        ("catalina", "0003_load_overlays"),
    ]

    operations = [
        migrations.RunPython(create_wrappers, drop_wrappers),
    ]
