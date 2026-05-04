from pathlib import Path
from django.db import migrations
from django.core.management import call_command

def load_her_pkg(apps, schema_editor):
    import arches_her
    pkg_path = Path(arches_her.__file__).parent / "pkg"
    if not pkg_path.exists():
        raise RuntimeError(f"Package path {pkg_path} does not exist.")
    call_command("packages", operation="load_package", source=str(pkg_path), yes=True)
    
class Migration(migrations.Migration):
    atomic = False
    dependencies = [
        ("arches_her", "0001_initial"),
        ("models", "12586_tile_cardinality_check"),
    ]

    operations = [
        migrations.RunPython(load_her_pkg, migrations.RunPython.noop),
    ]