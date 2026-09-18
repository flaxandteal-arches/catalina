"""Widen ``files.path`` past Django's 100-character FileField default.

The bulk importer writes file rows in SQL as ``<UPLOADED_FILES_DIR>/<name>``, so a
single long asset name aborts a whole load with "value too long for type character
varying(100)" — after every tile has already been written. Catalina's source assets
routinely carry descriptive names ("109. Internal area of Smelting House ruins
looking at SE internal wall...jpg"), and truncating them to fit would change the
name the file is stored and looked up under.

Column-only: ``arches.app.models.models.File.path`` still declares max_length=100,
so uploads through Django are unaffected and no model state is altered here
(``state_operations=[]``). Only the database ceiling moves, which is what the raw
INSERT hits.

Reverse truncates to 100 rather than failing — un-applying with a longer path
stored would otherwise error, and the rows it shortens were unreachable under the
narrower column anyway.
"""

from django.db import migrations

WIDEN = "ALTER TABLE files ALTER COLUMN path TYPE character varying(255);"

NARROW = """
    UPDATE files SET path = left(path, 100) WHERE length(path) > 100;
    ALTER TABLE files ALTER COLUMN path TYPE character varying(100);
"""


class Migration(migrations.Migration):

    dependencies = [
        ("catalina", "0002_create_blanket_role_groups"),
    ]

    operations = [
        migrations.RunSQL(WIDEN, NARROW, state_operations=[]),
    ]
