"""Collapse same-slot duplicate controlled-list items across all lists.

Generalises migration 0004 (which handled only the Gender list) to every
controlled list, but strictly limited to SAME-SLOT duplicates: items sharing the
same list, the same parent, and the same normalised (trimmed, lower-cased)
prefLabel. Those are genuine duplicate entries in one slot — safe to merge.

It deliberately does NOT touch cross-parent duplicates (the same label under
different parents). Those are poly-hierarchy — a flattened DAG from the upstream
arches-controlled-lists collections->CLM migration (#1401) — where the "duplicate"
is a legitimately distinct placement. Collapsing them would destroy hierarchy and
is a separate, semantic decision.

Per same-slot group it keeps one survivor and deletes the others:
  * survivor preference: has children > original (non-uuid5(list_id,label)) id >
    most tile-referenced > lowest sortorder. Preferring the child-bearing member
    means every loser is childless, so deletion never cascades away a subtree.
  * reference-datatype tiles pointing at a loser are repointed onto the survivor
    (the value is a denormalised snapshot with no FK, so it is rewritten in place).
  * the loser's prefLabel values and the loser itself are deleted.

Items with a blank 'en' prefLabel are excluded entirely: several structural nodes
carry an empty prefLabel and would otherwise all group under norm='' and be
collapsed as "duplicates" despite being distinct nodes with different children.

SUBTREE-MERGE groups (more than one member with children) are SKIPPED and listed
via RAISE NOTICE — merging two populated subtrees needs manual review (constraint
collisions on (parent, uri)/(parent, sortorder) and a hierarchy decision). With
blank-label items excluded there are currently none (every such group on this data
was a blank-label artifact), but the guard is kept so real cases are never merged
blindly.

Scope is derived at run time (groups + the reference nodes that use the affected
lists), so it is a no-op on an already-clean/fresh build and self-limits to what
is actually duplicated. It also no-ops on the Gender list if 0004 already ran.
Post-conditions abort the migration if any handled slot stays duplicated or a tile
is left pointing at a deleted item.

Backups: changed rows go to _bak_sameslot_* tables; the reverse restores them.

POST-MIGRATE: reference-datatype tiles are rewritten, so the search index is
stale — run a resource reindex (e.g. `python manage.py es reindex_database`). A
RunPython step logs the reminder.
"""

import logging

from django.db import migrations

logger = logging.getLogger(__name__)


FORWARD = r"""
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS _bak_sameslot_listitem
    (LIKE arches_controlled_lists_listitem);
CREATE TABLE IF NOT EXISTS _bak_sameslot_listitemvalue
    (LIKE arches_controlled_lists_listitemvalue);
CREATE TABLE IF NOT EXISTS _bak_sameslot_tiles
    (tileid uuid, nodeid uuid, before jsonb);

DO $sameslot$
DECLARE
    r        record;
    v_orphan int;
    v_dupes  int;
    v_bad    int;
BEGIN
    -- 0. every list item with its slot key, child flag, and from_labels-mint flag
    CREATE TEMP TABLE _ss_items ON COMMIT DROP AS
    SELECT li.id, li.list_id, li.uri, li.parent_id, li.sortorder,
           lower(btrim(liv.value)) AS norm,
           coalesce(li.parent_id::text, 'root') AS slot_parent,
           EXISTS (SELECT 1 FROM arches_controlled_lists_listitem c
                   WHERE c.parent_id = li.id) AS has_kids,
           (li.id = uuid_generate_v5(li.list_id, btrim(liv.value))) AS is_mint
    FROM arches_controlled_lists_listitem li
    JOIN arches_controlled_lists_listitemvalue liv
          ON liv.list_item_id = li.id AND liv.valuetype_id = 'prefLabel'
    -- Exclude blank prefLabels: several structural nodes have an empty 'en'
    -- prefLabel and would otherwise group together on norm='' and be collapsed
    -- as "duplicates" despite being distinct nodes with different children.
    WHERE btrim(liv.value) <> '';

    -- 1. same-slot groups with a duplicate; mk = members that themselves have children
    CREATE TEMP TABLE _ss_groups ON COMMIT DROP AS
    SELECT list_id, slot_parent, norm,
           count(*) AS n,
           count(*) FILTER (WHERE has_kids) AS mk
    FROM _ss_items
    GROUP BY list_id, slot_parent, norm
    HAVING count(*) > 1;

    -- Report (and skip) subtree-merge groups: >1 child-bearing member.
    FOR r IN
        SELECT l.name, g.norm, g.n, g.mk
        FROM _ss_groups g JOIN arches_controlled_lists_list l ON l.id = g.list_id
        WHERE g.mk > 1
        ORDER BY l.name, g.norm
    LOOP
        RAISE NOTICE 'dedupe_same_slot SKIP subtree-merge group: list=% label=% (% members, % with children) -> manual review',
            r.name, r.norm, r.n, r.mk;
    END LOOP;

    -- 2. candidates = members of handled groups (mk <= 1 => all losers childless)
    CREATE TEMP TABLE _ss_cand ON COMMIT DROP AS
    SELECT i.*
    FROM _ss_items i
    JOIN _ss_groups g
      ON g.list_id = i.list_id AND g.slot_parent = i.slot_parent AND g.norm = i.norm
    WHERE g.mk <= 1;

    IF NOT EXISTS (SELECT 1 FROM _ss_cand) THEN
        RETURN;  -- nothing safe to do
    END IF;

    -- 3. reference nodes that use any affected list (carry nodegroupid so tile
    --    work can be pruned to each node's own nodegroup — indexed — rather than
    --    scanning every tile per node).
    CREATE TEMP TABLE _ss_nodes ON COMMIT DROP AS
    SELECT DISTINCT n.nodeid::text AS nid, n.nodegroupid
    FROM nodes n
    WHERE n.datatype = 'reference'
      AND n.nodegroupid IS NOT NULL
      AND EXISTS (
          SELECT 1 FROM (SELECT DISTINCT list_id FROM _ss_cand) cl
          WHERE n.config::text LIKE '%' || cl.list_id::text || '%');

    -- 4. tile reference counts per candidate uri (uris are globally unique)
    CREATE TEMP TABLE _ss_refsum (uri text, n int) ON COMMIT DROP;
    FOR r IN SELECT nid, nodegroupid FROM _ss_nodes LOOP
        INSERT INTO _ss_refsum (uri, n)
        SELECT e->>'uri', count(*)
        FROM tiles t, LATERAL jsonb_array_elements(t.tiledata->r.nid) e
        WHERE t.nodegroupid = r.nodegroupid
          AND jsonb_typeof(t.tiledata->r.nid) = 'array'
          AND (e->>'uri') IN (SELECT uri FROM _ss_cand)
        GROUP BY 1;
    END LOOP;

    -- 5. rank within slot: has children, then original (non-mint), then most-referenced, then sortorder
    CREATE TEMP TABLE _ss_ranked ON COMMIT DROP AS
    SELECT c.*, COALESCE(rs.n, 0) AS refs,
           row_number() OVER (
               PARTITION BY c.list_id, c.slot_parent, c.norm
               ORDER BY c.has_kids           DESC,
                        (NOT c.is_mint)      DESC,
                        COALESCE(rs.n, 0)    DESC,
                        c.sortorder          ASC
           ) AS rn
    FROM _ss_cand c
    LEFT JOIN (SELECT uri, sum(n)::int AS n FROM _ss_refsum GROUP BY uri) rs
           ON rs.uri = c.uri;

    -- 6. plan: each loser -> its slot's survivor
    CREATE TEMP TABLE _ss_plan ON COMMIT DROP AS
    SELECT l.id AS loser_id, l.uri AS loser_uri, l.refs AS loser_refs,
           l.has_kids AS loser_has_kids,
           s.id AS surv_id, s.uri AS surv_uri
    FROM _ss_ranked l
    JOIN _ss_ranked s
      ON s.list_id = l.list_id AND s.slot_parent = l.slot_parent
     AND s.norm = l.norm AND s.rn = 1
    WHERE l.rn > 1;

    -- Safety: by construction every loser is childless. Abort if not (would cascade).
    SELECT count(*) INTO v_bad FROM _ss_plan WHERE loser_has_kids;
    IF v_bad > 0 THEN
        RAISE EXCEPTION 'dedupe_same_slot: % loser(s) have children; refusing to cascade', v_bad;
    END IF;

    -- 7. backups
    INSERT INTO _bak_sameslot_listitem
    SELECT li.* FROM arches_controlled_lists_listitem li
    JOIN _ss_plan p ON p.loser_id = li.id
    WHERE NOT EXISTS (SELECT 1 FROM _bak_sameslot_listitem b WHERE b.id = li.id);

    INSERT INTO _bak_sameslot_listitemvalue
    SELECT liv.* FROM arches_controlled_lists_listitemvalue liv
    JOIN _ss_plan p ON p.loser_id = liv.list_item_id
    WHERE NOT EXISTS (SELECT 1 FROM _bak_sameslot_listitemvalue b WHERE b.id = liv.id);

    -- 8. repoint referenced losers -> survivor, per node (rewrite the snapshot)
    FOR r IN SELECT nid, nodegroupid FROM _ss_nodes LOOP
        INSERT INTO _bak_sameslot_tiles (tileid, nodeid, before)
        SELECT t.tileid, r.nid::uuid, t.tiledata->r.nid
        FROM tiles t
        WHERE t.nodegroupid = r.nodegroupid
          AND jsonb_typeof(t.tiledata->r.nid) = 'array'
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(t.tiledata->r.nid) e
                      JOIN _ss_plan p ON p.loser_uri = e->>'uri' AND p.loser_refs > 0)
          AND NOT EXISTS (SELECT 1 FROM _bak_sameslot_tiles b
                          WHERE b.tileid = t.tileid AND b.nodeid = r.nid::uuid);

        UPDATE tiles t
        SET tiledata = jsonb_set(t.tiledata, ARRAY[r.nid],
            (SELECT jsonb_agg(
                CASE
                  WHEN p.loser_uri IS NULL THEN e.elem
                  ELSE jsonb_build_object(
                         'uri',     p.surv_uri,
                         'list_id', (SELECT li.list_id::text
                                     FROM arches_controlled_lists_listitem li
                                     WHERE li.uri = p.surv_uri),
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
             LEFT JOIN _ss_plan p ON p.loser_uri = e.elem->>'uri' AND p.loser_refs > 0))
        WHERE t.nodegroupid = r.nodegroupid
          AND jsonb_typeof(t.tiledata->r.nid) = 'array'
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(t.tiledata->r.nid) e
                      JOIN _ss_plan p ON p.loser_uri = e->>'uri' AND p.loser_refs > 0);
    END LOOP;

    -- 9. delete losers (value->item FK is NO ACTION: values first)
    IF to_regclass('arches_controlled_lists_listitemimage') IS NOT NULL THEN
        DELETE FROM arches_controlled_lists_listitemimage
        WHERE list_item_id IN (SELECT loser_id FROM _ss_plan);
    END IF;
    DELETE FROM arches_controlled_lists_listitemvalue
    WHERE list_item_id IN (SELECT loser_id FROM _ss_plan);
    DELETE FROM arches_controlled_lists_listitem
    WHERE id IN (SELECT loser_id FROM _ss_plan);

    -- 10. post-conditions (abort if violated)
    SELECT count(*) INTO v_dupes FROM (
        SELECT 1
        FROM arches_controlled_lists_listitem li
        JOIN arches_controlled_lists_listitemvalue liv
              ON liv.list_item_id = li.id AND liv.valuetype_id = 'prefLabel'
        WHERE li.id IN (SELECT surv_id FROM _ss_plan)
        GROUP BY li.list_id, coalesce(li.parent_id::text, 'root'), lower(btrim(liv.value))
        HAVING count(*) > 1
    ) d;
    IF v_dupes > 0 THEN
        RAISE EXCEPTION 'dedupe_same_slot: % handled slot(s) still duplicated', v_dupes;
    END IF;

    FOR r IN SELECT nid, nodegroupid FROM _ss_nodes LOOP
        SELECT count(*) INTO v_orphan
        FROM tiles t, LATERAL jsonb_array_elements(t.tiledata->r.nid) e
        WHERE t.nodegroupid = r.nodegroupid
          AND jsonb_typeof(t.tiledata->r.nid) = 'array'
          AND (e->>'uri') IN (SELECT loser_uri FROM _ss_plan)
          AND NOT EXISTS (SELECT 1 FROM arches_controlled_lists_listitem li
                          WHERE li.uri = e->>'uri');
        IF v_orphan > 0 THEN
            RAISE EXCEPTION 'dedupe_same_slot: % orphaned tile reference(s) on node %',
                v_orphan, r.nid;
        END IF;
    END LOOP;

    RAISE NOTICE 'dedupe_same_slot: removed % duplicate item(s)',
        (SELECT count(*) FROM _ss_plan);
END
$sameslot$;
"""


REVERSE = r"""
CREATE TABLE IF NOT EXISTS _bak_sameslot_listitem
    (LIKE arches_controlled_lists_listitem);
CREATE TABLE IF NOT EXISTS _bak_sameslot_listitemvalue
    (LIKE arches_controlled_lists_listitemvalue);
CREATE TABLE IF NOT EXISTS _bak_sameslot_tiles
    (tileid uuid, nodeid uuid, before jsonb);

-- restore deleted items (parents) before their values (FK is NO ACTION)
INSERT INTO arches_controlled_lists_listitem
SELECT * FROM _bak_sameslot_listitem
ON CONFLICT (id) DO NOTHING;

INSERT INTO arches_controlled_lists_listitemvalue
SELECT * FROM _bak_sameslot_listitemvalue
ON CONFLICT (id) DO NOTHING;

-- restore repointed tile snapshots
UPDATE tiles t
SET tiledata = jsonb_set(t.tiledata, ARRAY[b.nodeid::text], b.before)
FROM _bak_sameslot_tiles b
WHERE t.tileid = b.tileid;

DROP TABLE IF EXISTS _bak_sameslot_tiles;
DROP TABLE IF EXISTS _bak_sameslot_listitemvalue;
DROP TABLE IF EXISTS _bak_sameslot_listitem;
"""


def _warn_reindex(apps, schema_editor):
    logger.warning(
        "dedupe_same_slot: reference-datatype tiles were repointed; the search "
        "index is now stale. Run a resource reindex "
        "(e.g. `python manage.py es reindex_database`)."
    )


class Migration(migrations.Migration):

    dependencies = [
        ("catalina", "0004_normalise_gender_controlled_list"),
        ("arches_controlled_lists", "0009_reconfigure_migration_for_polyhierarchies"),
    ]

    operations = [
        migrations.RunSQL(FORWARD, REVERSE, state_operations=[]),
        migrations.RunPython(_warn_reindex, migrations.RunPython.noop),
    ]
