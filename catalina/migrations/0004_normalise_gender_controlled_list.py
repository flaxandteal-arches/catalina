"""Collapse the duplicated Sex/Gender controlled list to one item per term,
normalised to lower case.

The list (scheme ``5a9349ec-...``) was seeded twice into a single scheme during
packaging, so every term appears twice, and ``male``/``female`` carry a third,
capitalised copy ("Male"/"Female") that an ``alizarin`` ``from_labels`` pass
minted (``uuid5(scheme, label)`` is case-sensitive, so "Male" never collided with
"male"). The business data references the capitalised items. Package recreation is
no longer possible, so this fixes the live data.

What it does, per normalised (trimmed, lower-cased) prefLabel:
  * keep ONE survivor — the entry from the ORIGINAL seeding, i.e. the
    random-ID (non-``uuid5``) import rather than the ``from_labels`` copy; then,
    defensively, an already-lower-case label, the most tile-referenced, and the
    lowest sortorder;
  * repoint every reference-datatype tile that points at a losing item onto the
    survivor (the reference value is a denormalised snapshot — uri + list_id +
    labels[] — with no FK back to the item, so it is rewritten in place);
  * delete the losing items and their prefLabel values.

Why "original seeding" and not just "lower case": the list was seeded twice. The
canonical set is the AAT import with random (version-4) UUIDs — this is exactly
the committed package/prebuild list. A later ``alizarin`` ``from_labels`` pass
re-minted the same terms with DETERMINISTIC ``uuid5(scheme, label)`` (version-5)
IDs, plus the stray capitalised "Male"/"Female". Keeping the version-4 originals
means the live list converges to the package's own IDs, so a future package
reload/rebuild stays idempotent instead of re-duplicating those terms. (``uuid5``
always stamps version 5, so the version nibble cleanly distinguishes the
``from_labels`` copies from the originals.)

The full vocabulary is preserved: only duplicates are removed, not the unused but
valid options (agender, two-spirit, gender-fluid, ...).

Scope is derived at run time: the reference nodes are discovered from
``nodes.config`` rather than hard-coded, and if the list is already clean (e.g. a
fresh package build) the whole thing is a no-op. Two post-conditions abort the
migration if it would leave a term still duplicated or a tile pointing at a
deleted item.

Backups: the rows it changes are copied into ``_bak_normalise_gender_*`` tables so
the reverse can restore them; the reverse re-inserts the deleted items/values,
restores the tile snapshots, and drops the backup tables.

POST-MIGRATE: this rewrites reference-datatype tiles, so the search index is stale
afterwards — run a resource reindex (``python manage.py es reindex_database`` or a
targeted reindex of the affected resources). A ``RunPython`` step logs a reminder.
"""

import logging

from django.db import migrations

logger = logging.getLogger(__name__)


FORWARD = r"""
CREATE TABLE IF NOT EXISTS _bak_normalise_gender_listitem
    (LIKE arches_controlled_lists_listitem);
CREATE TABLE IF NOT EXISTS _bak_normalise_gender_listitemvalue
    (LIKE arches_controlled_lists_listitemvalue);
CREATE TABLE IF NOT EXISTS _bak_normalise_gender_tiles
    (tileid uuid, nodeid uuid, before jsonb);

DO $gender$
DECLARE
    v_list   uuid := '5a9349ec-e6fa-4e19-9343-058749886697';
    r        record;
    v_orphan int;
    v_dupes  int;
BEGIN
    -- 0. reference nodes that use this list (datatype=reference, config names it)
    CREATE TEMP TABLE _g_nodes ON COMMIT DROP AS
    SELECT nodeid::text AS nid
    FROM nodes
    WHERE datatype = 'reference'
      AND config::text LIKE '%' || v_list::text || '%';

    -- 1. tile reference counts per item uri, summed across those nodes
    CREATE TEMP TABLE _g_refs (uri text, n int) ON COMMIT DROP;
    FOR r IN SELECT nid FROM _g_nodes LOOP
        INSERT INTO _g_refs (uri, n)
        SELECT e->>'uri', count(*)
        FROM tiles t, LATERAL jsonb_array_elements(t.tiledata->r.nid) e
        WHERE jsonb_typeof(t.tiledata->r.nid) = 'array'
          AND e->>'list_id' = v_list::text
        GROUP BY 1;
    END LOOP;
    CREATE TEMP TABLE _g_refsum ON COMMIT DROP AS
    SELECT uri, sum(n)::int AS n FROM _g_refs GROUP BY uri;

    -- 2. rank items within each normalised label. Prefer the ORIGINAL seeding:
    --    a non-uuid5 id (version nibble <> '5') is the random-id import / package
    --    entry; a version-5 id is the from_labels copy. Then, defensively,
    --    already-lower-case, then most-referenced, then lowest sortorder.
    CREATE TEMP TABLE _g_ranked ON COMMIT DROP AS
    SELECT li.id, li.uri, li.sortorder, liv.value,
           lower(btrim(liv.value)) AS norm,
           COALESCE(rs.n, 0)       AS refs,
           row_number() OVER (
               PARTITION BY lower(btrim(liv.value))
               ORDER BY (substring(li.id::text FROM 15 FOR 1) <> '5') DESC,
                        (liv.value = lower(liv.value))                DESC,
                        COALESCE(rs.n, 0)                             DESC,
                        li.sortorder                                  ASC
           ) AS rn
    FROM arches_controlled_lists_listitem li
    JOIN arches_controlled_lists_listitemvalue liv
          ON liv.list_item_id = li.id AND liv.valuetype_id = 'prefLabel'
    LEFT JOIN _g_refsum rs ON rs.uri = li.uri
    WHERE li.list_id = v_list;

    -- 3. plan: each loser mapped to its term's survivor
    CREATE TEMP TABLE _g_plan ON COMMIT DROP AS
    SELECT l.norm,
           l.id AS loser_id, l.uri AS loser_uri, l.refs AS loser_refs,
           s.id AS surv_id,  s.uri AS surv_uri
    FROM _g_ranked l
    JOIN _g_ranked s ON s.norm = l.norm AND s.rn = 1
    WHERE l.rn > 1;

    -- Already clean (no duplicates): nothing to do.
    IF NOT EXISTS (SELECT 1 FROM _g_plan) THEN
        RETURN;
    END IF;

    -- 4. back up the items/values about to be deleted
    INSERT INTO _bak_normalise_gender_listitem
    SELECT li.* FROM arches_controlled_lists_listitem li
    JOIN _g_plan p ON p.loser_id = li.id
    WHERE NOT EXISTS (SELECT 1 FROM _bak_normalise_gender_listitem b WHERE b.id = li.id);

    INSERT INTO _bak_normalise_gender_listitemvalue
    SELECT liv.* FROM arches_controlled_lists_listitemvalue liv
    JOIN _g_plan p ON p.loser_id = liv.list_item_id
    WHERE NOT EXISTS (SELECT 1 FROM _bak_normalise_gender_listitemvalue b WHERE b.id = liv.id);

    -- 5. repoint referenced losers -> survivor, per node (rewriting the snapshot)
    FOR r IN SELECT nid FROM _g_nodes LOOP
        INSERT INTO _bak_normalise_gender_tiles (tileid, nodeid, before)
        SELECT t.tileid, r.nid::uuid, t.tiledata->r.nid
        FROM tiles t
        WHERE jsonb_typeof(t.tiledata->r.nid) = 'array'
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(t.tiledata->r.nid) e
                      JOIN _g_plan p ON p.loser_uri = e->>'uri' AND p.loser_refs > 0)
          AND NOT EXISTS (SELECT 1 FROM _bak_normalise_gender_tiles b
                          WHERE b.tileid = t.tileid AND b.nodeid = r.nid::uuid);

        UPDATE tiles t
        SET tiledata = jsonb_set(t.tiledata, ARRAY[r.nid],
            (SELECT jsonb_agg(
                CASE
                  WHEN p.loser_uri IS NULL THEN e.elem
                  ELSE jsonb_build_object(
                         'uri',     p.surv_uri,
                         'list_id', v_list::text,
                         'labels',  (SELECT jsonb_agg(jsonb_build_object(
                                        'id',           lv.id,
                                        'value',        lv.value,
                                        'language_id',  lv.languageid,
                                        'list_item_id', lv.list_item_id,
                                        'valuetype_id', lv.valuetype_id))
                                     FROM arches_controlled_lists_listitemvalue lv
                                     WHERE lv.list_item_id = p.surv_id
                                       AND lv.valuetype_id = 'prefLabel'))
                END
                ORDER BY e.ord)
             FROM jsonb_array_elements(t.tiledata->r.nid) WITH ORDINALITY e(elem, ord)
             LEFT JOIN _g_plan p ON p.loser_uri = e.elem->>'uri' AND p.loser_refs > 0))
        WHERE jsonb_typeof(t.tiledata->r.nid) = 'array'
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(t.tiledata->r.nid) e
                      JOIN _g_plan p ON p.loser_uri = e->>'uri' AND p.loser_refs > 0);
    END LOOP;

    -- 6. delete losers (listitemvalue -> listitem FK is NO ACTION: values first)
    IF to_regclass('arches_controlled_lists_listitemimage') IS NOT NULL THEN
        DELETE FROM arches_controlled_lists_listitemimage
        WHERE list_item_id IN (SELECT loser_id FROM _g_plan);
    END IF;
    DELETE FROM arches_controlled_lists_listitemvalue
    WHERE list_item_id IN (SELECT loser_id FROM _g_plan);
    DELETE FROM arches_controlled_lists_listitem
    WHERE id IN (SELECT loser_id FROM _g_plan);

    -- 7. post-conditions (abort the migration if violated)
    SELECT count(*) INTO v_dupes FROM (
        SELECT 1
        FROM arches_controlled_lists_listitem li
        JOIN arches_controlled_lists_listitemvalue liv
              ON liv.list_item_id = li.id AND liv.valuetype_id = 'prefLabel'
        WHERE li.list_id = v_list
        GROUP BY lower(btrim(liv.value))
        HAVING count(*) > 1
    ) d;
    IF v_dupes > 0 THEN
        RAISE EXCEPTION 'normalise_gender: % term(s) still duplicated', v_dupes;
    END IF;

    FOR r IN SELECT nid FROM _g_nodes LOOP
        SELECT count(*) INTO v_orphan
        FROM tiles t, LATERAL jsonb_array_elements(t.tiledata->r.nid) e
        WHERE jsonb_typeof(t.tiledata->r.nid) = 'array'
          AND e->>'list_id' = v_list::text
          AND NOT EXISTS (SELECT 1 FROM arches_controlled_lists_listitem li
                          WHERE li.uri = e->>'uri' AND li.list_id = v_list);
        IF v_orphan > 0 THEN
            RAISE EXCEPTION 'normalise_gender: % orphaned tile reference(s) on node %',
                v_orphan, r.nid;
        END IF;
    END LOOP;
END
$gender$;
"""


REVERSE = r"""
CREATE TABLE IF NOT EXISTS _bak_normalise_gender_listitem
    (LIKE arches_controlled_lists_listitem);
CREATE TABLE IF NOT EXISTS _bak_normalise_gender_listitemvalue
    (LIKE arches_controlled_lists_listitemvalue);
CREATE TABLE IF NOT EXISTS _bak_normalise_gender_tiles
    (tileid uuid, nodeid uuid, before jsonb);

-- restore deleted items (parents) before their values (FK is NO ACTION)
INSERT INTO arches_controlled_lists_listitem
SELECT * FROM _bak_normalise_gender_listitem
ON CONFLICT (id) DO NOTHING;

INSERT INTO arches_controlled_lists_listitemvalue
SELECT * FROM _bak_normalise_gender_listitemvalue
ON CONFLICT (id) DO NOTHING;

-- restore repointed tile snapshots
UPDATE tiles t
SET tiledata = jsonb_set(t.tiledata, ARRAY[b.nodeid::text], b.before)
FROM _bak_normalise_gender_tiles b
WHERE t.tileid = b.tileid;

DROP TABLE IF EXISTS _bak_normalise_gender_tiles;
DROP TABLE IF EXISTS _bak_normalise_gender_listitemvalue;
DROP TABLE IF EXISTS _bak_normalise_gender_listitem;
"""


def _warn_reindex(apps, schema_editor):
    logger.warning(
        "normalise_gender: reference-datatype tiles were repointed; the search "
        "index is now stale. Run a resource reindex "
        "(e.g. `python manage.py es reindex_database`)."
    )


class Migration(migrations.Migration):

    dependencies = [
        ("catalina", "0003_widen_files_path"),
        ("arches_controlled_lists", "0009_reconfigure_migration_for_polyhierarchies"),
    ]

    operations = [
        migrations.RunSQL(FORWARD, REVERSE, state_operations=[]),
        migrations.RunPython(_warn_reindex, migrations.RunPython.noop),
    ]
