import json
import uuid
from pathlib import Path
from django.db import migrations

SPATIAL_VIEWS_DIR = Path(__file__).parent / "spatial_views"


def create_spatial_views(apps, schema_editor):
    SpatialView = apps.get_model("models", "SpatialView")
    Node = apps.get_model("models", "Node")
    Language = apps.get_model("models", "Language")

    try:
        language = Language.objects.get(isdefault=True)
    except Language.DoesNotExist:
        return

    for path in SPATIAL_VIEWS_DIR.glob("*.json"):
        view = json.loads(path.read_text())
        try:
            node = Node.objects.get(pk=uuid.UUID(view["geometry_node_id"]))
        except Node.DoesNotExist:
            print(f"Geometry node with ID {view['geometry_node_id']} does not exist for spatial view {view['slug']}")
            continue
        SpatialView.objects.update_or_create(
            spatialviewid=uuid.UUID(view["spatialviewid"]),
            defaults=dict(
                slug=view["slug"],
                schema="public",
                description=view["description"],
                geometrynode=node,
                language=language,
                ismixedgeometrytypes=view.get("ismixedgeometrytypes", False),
                isactive=True,
                attributenodes=view["attributenodes"],
            ),
        )


def delete_spatial_views(apps, schema_editor):
    SpatialView = apps.get_model("models", "SpatialView")
    slugs = [
        json.loads(p.read_text())["slug"] for p in SPATIAL_VIEWS_DIR.glob("*.json")
    ]
    SpatialView.objects.filter(slug__in=slugs).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("catalina", "0001_load_her_pkg"),
    ]

    operations = [
        migrations.RunPython(create_spatial_views, delete_spatial_views),
    ]
