"""Every overlay loader, in migration order, replayed by the newest migration.

Loaders skip layers whose env is absent, and Django never re-runs an applied
migration, so an env completed later needs the replay to pick them up.
Append each new migration's loader, after any loader it corrects.
"""

from importlib import import_module

LOADERS = [
    ("catalina.migrations.0001_load_overlays", "load_overlays"),
    ("catalina.migrations.0004_load_nzaa_sites_overlay", "load_nzaa_sites"),
    (
        "catalina.migrations.0005_update_installed_overlays",
        "update_installed_overlays",
    ),
]


def run_loaders(apps):
    # Imported at call time: the newest migration imports this module, and this
    # module imports that migration back.
    for module_path, function_name in LOADERS:
        loader = getattr(import_module(module_path), function_name)
        loader(apps, schema_editor=None)
