-- Custom spatial views: friendly, renamed wrappers over the per-geometry-type
-- views that Arches auto-generates for each entry in public.spatial_views.
--
-- For every active, non-mixed spatial view, the Arches trigger creates
-- public.<slug>_point, public.<slug>_linestring and public.<slug>_polygon, each
-- already exposing gid, tileid, nodeid, resourceinstanceid, geom and the
-- attribute columns. These wrappers just SELECT from those and rename columns
-- with AS statements.
--
-- Runs in the load_package post_sql step. It MUST run after add_spatial_views.sql
-- (which registers the spatial views and triggers creation of the <slug>_<geom>
-- views this file reads from). Alphabetical ordering guarantees that:
-- "add_spatial_views.sql" < "custom_spatial_views.sql".
--
-- DROP + CREATE OR REPLACE keeps this idempotent, so the file can be edited and
-- re-run directly against the DB.
--
-- NOTE ON COLUMN NAMES: the source columns (left of AS) are the slugified node
-- names Arches exposes in each <slug>_<geom> view. Those derive from the node
-- name alias, not the attributenodes description, so they must be reconciled against
-- the deployed models.
-- The aliases to the right of AS are the intended output names.
--
-- Some columns are not read from the <slug>_<geom> view at all but resolved from
-- the tile by a helper (see below), which identifies its node by uuid rather than
-- by name. Those calls carry a trailing "-- node alias: <alias>" so the column
-- still reads against the deployed models like the others.


-- ============================================================================
-- `reference` datatype support
-- ============================================================================
--
-- Arches cannot render `reference` nodes (the arches_controlled_lists datatype)
-- into a spatial view column. The attribute columns of the <slug>_<geom> views
-- are built by __arches_get_node_display_value, whose `case` over datatypes has
-- no `reference` branch, so those nodes fall through to its catch-all and emit
-- the raw serialized tiledata:
--
--   [{"uri": "urn:uuid:a2164b0e-...", "labels": [{"value": "AKL",
--     "language_id": "en", "valuetype_id": "prefLabel", ...}], "list_id": "..."}]
--
-- rather than "AKL". Patching __arches_get_node_display_value would fix it at
-- source, but it is an Arches core function recreated by core migrations, so the
-- branch would silently vanish on upgrade and the columns would quietly revert to
-- raw JSON. Instead we bypass the display-value machinery for these nodes and
-- read the tile directly here — additive, and nothing core is redefined.
--
-- Nodes resolved this way must be left OUT of the attributenodes list in
-- add_spatial_views.sql; they are not read from the <slug>_<geom> view at all.
--
-- Returns the prefLabel of the first reference on the first tile that yields one:
-- these node groups are cardinality-n (a heritage place can carry several admin
-- areas), but the consuming GIS layers want a single value. Compare the Arches
-- behaviour, which concatenates every tile's value with ', '.
--
-- Tiles are selected by the label they produce rather than by the shape of their
-- tiledata, so one carrying no usable label falls through to the next. A node left
-- blank in an otherwise-populated tile is stored as JSON null, so the value at
-- in_nodeid is often a scalar rather than an array; jsonb_path_query_first tolerates
-- that in lax mode, whereas jsonb_array_length raises on it, and a preceding
-- jsonb_typeof test is no guard since WHERE conditions have no guaranteed
-- evaluation order.
-- SECURITY DEFINER because the consuming GIS role holds SELECT on the wrapper views
-- and nothing else. A view's own FROM is checked against the view owner, but a
-- function body is checked against the caller, so as SECURITY INVOKER this is denied
-- on tiles. search_path is pinned, as it must be whenever a function runs as its
-- owner. Applies equally to the string helpers below.
CREATE OR REPLACE FUNCTION public.__catalina_reference_label(
    in_resourceinstanceid text,
    in_nodeid uuid,
    language_id text DEFAULT 'en')
    RETURNS text
    LANGUAGE 'sql'
    STABLE PARALLEL SAFE
    SECURITY DEFINER
    SET search_path = pg_catalog, public
AS $BODY$
    SELECT v.label
    FROM tiles t
    CROSS JOIN LATERAL (
        SELECT coalesce(
                   -- prefLabel in the requested language, then any prefLabel, then any label
                   jsonb_path_query_first(
                       t.tiledata -> in_nodeid::text,
                       '$[0].labels[*] ? (@.valuetype_id == "prefLabel" && @.language_id == $lang).value',
                       jsonb_build_object('lang', language_id)),
                   jsonb_path_query_first(
                       t.tiledata -> in_nodeid::text,
                       '$[0].labels[*] ? (@.valuetype_id == "prefLabel").value'),
                   jsonb_path_query_first(
                       t.tiledata -> in_nodeid::text,
                       '$[0].labels[0].value')
               ) #>> '{}' AS label
    ) v
    WHERE t.nodegroupid = (SELECT n.nodegroupid FROM nodes n WHERE n.nodeid = in_nodeid)
      AND t.resourceinstanceid = in_resourceinstanceid::uuid
      AND v.label IS NOT NULL
      AND v.label <> ''
    ORDER BY t.sortorder NULLS LAST, t.tileid
    LIMIT 1;
$BODY$;

-- A newly created function is EXECUTE-able by PUBLIC by default, whereas CREATE OR
-- REPLACE over an existing one keeps the ACL it already has. Left implicit, the first
-- run of this file would hand every role that can connect a SECURITY DEFINER reader of
-- tiles, callable for any nodeid and resourceinstanceid — which is precisely what the
-- wrapper views below are grant-controlled to prevent. Setting the ACL explicitly is
-- idempotent and covers both cases. Applies equally to the string helpers below.
REVOKE EXECUTE ON FUNCTION public.__catalina_reference_label(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.__catalina_reference_label(text, uuid, text) TO arches_spatial_views;


-- ============================================================================
-- Picking one value out of a string node
-- ============================================================================
--
-- Arches renders `string` nodes correctly, but a spatial view column aggregates
-- every tile in the node group into one comma-joined cell, and offers no way to
-- pick a value out of free text. These read the tile directly and, given
-- match_pattern, return only the part of the value that matches it (substring
-- semantics: the first parenthesised group if the pattern has one, else the whole
-- match). Both return NULL when nothing matches.
--
-- __catalina_string_value takes the first match across all of a resource's tiles in
-- the node group. __catalina_child_string_value is scoped to the child tiles of one
-- parent tile instead, for values that belong to a single feature (see below).
CREATE OR REPLACE FUNCTION public.__catalina_string_value(
    in_resourceinstanceid text,
    in_nodeid uuid,
    match_pattern text DEFAULT NULL,
    language_id text DEFAULT 'en')
    RETURNS text
    LANGUAGE 'sql'
    STABLE PARALLEL SAFE
    SECURITY DEFINER
    SET search_path = pg_catalog, public
AS $BODY$
    SELECT v.value
    FROM tiles t
    CROSS JOIN LATERAL (
        SELECT ((t.tiledata -> in_nodeid::text) -> language_id) ->> 'value' AS raw
    ) r
    CROSS JOIN LATERAL (
        SELECT CASE WHEN match_pattern IS NULL THEN r.raw
                    ELSE substring(r.raw FROM match_pattern)
               END AS value
    ) v
    WHERE t.nodegroupid = (SELECT n.nodegroupid FROM nodes n WHERE n.nodeid = in_nodeid)
      AND t.resourceinstanceid = in_resourceinstanceid::uuid
      AND v.value IS NOT NULL
      AND v.value <> ''
    ORDER BY t.sortorder NULLS LAST, t.tileid
    LIMIT 1;
$BODY$;

REVOKE EXECUTE ON FUNCTION public.__catalina_string_value(text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.__catalina_string_value(text, uuid, text, text) TO arches_spatial_views;


-- ============================================================================
-- Per-feature values: global_id
-- ============================================================================
--
-- Each row of a <slug>_<geom> view is one geojson_geometries record, i.e. one
-- single-part geometry. Arches stores a multipart feature as separate single-part
-- features in the same tile when it is imported (check_geojson_value in the
-- geojson-feature-collection datatype), and ST_Dump in refresh_geojson_geometries
-- splits any that remain. Each row's tileid is the Geometry tile it came from.
-- Arches' own attribute columns are joined per resource, so they cannot carry a
-- per-feature value.
--
-- In the Heritage Place model Geometry is cardinality-n, and each Geometry tile has
-- one child Spatial Metadata Descriptions tile (cardinality 1) whose parenttileid is
-- that Geometry tile. global_id is read from Spatial Metadata Notes in that child.
-- One Geometry tile holds one ArcGIS feature, so the tile is what groups the parts
-- of a multipart feature, and global_id follows the tile:
--   * a single geometry          -> one tile, 1 row
--   * a multipart geometry       -> one tile, 1 row per part, all with the same global_id
--   * several ArcGIS features    -> one tile each, each with its own global_id
--
-- The notes hold the ArcGIS GlobalID (a GUID in braces). The pattern is unanchored
-- because the stored value takes two shapes:
--   * imported:    {9F965097-66B7-4287-940C-27025F551725}
--     (the ETL stores the text verbatim)
--   * hand-edited: <p>{9F965097-66B7-4287-940C-27025F551725}</p>
--     (the node uses the rich-text widget, and CKEditor saves HTML)
CREATE OR REPLACE FUNCTION public.__catalina_child_string_value(
    in_parenttileid text,
    in_nodeid uuid,
    match_pattern text DEFAULT NULL,
    language_id text DEFAULT 'en')
    RETURNS text
    LANGUAGE 'sql'
    STABLE PARALLEL SAFE
    SECURITY DEFINER
    SET search_path = pg_catalog, public
AS $BODY$
    SELECT v.value
    FROM tiles t
    CROSS JOIN LATERAL (
        SELECT ((t.tiledata -> in_nodeid::text) -> language_id) ->> 'value' AS raw
    ) r
    CROSS JOIN LATERAL (
        SELECT CASE WHEN match_pattern IS NULL THEN r.raw
                    ELSE substring(r.raw FROM match_pattern)
               END AS value
    ) v
    WHERE t.nodegroupid = (SELECT n.nodegroupid FROM nodes n WHERE n.nodeid = in_nodeid)
      AND t.parenttileid = in_parenttileid::uuid
      AND v.value IS NOT NULL
      AND v.value <> ''
    ORDER BY t.sortorder NULLS LAST, t.tileid
    LIMIT 1;
$BODY$;

REVOKE EXECUTE ON FUNCTION public.__catalina_child_string_value(text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.__catalina_child_string_value(text, uuid, text, text) TO arches_spatial_views;


-- ============================================================================
-- Reading the Arches views without depending on them
-- ============================================================================
--
-- Every ETL import ends with SELECT __arches_refresh_spatial_views(), which
-- drops and recreates the <slug>_<geom> views with a plain DROP VIEW (RESTRICT).
-- A wrapper that selects straight FROM public.monument_point therefore aborts the
-- refresh, and with it the whole import, after the tiles are already committed:
--
--   cannot drop view monument_point because other objects depend on it
--   DETAIL:  view heritage_places_points depends on view monument_point
--
-- A LANGUAGE sql function with a QUOTED STRING body records no pg_depend entry on
-- what it reads, so routing the wrapper through one leaves it holding no dependency
-- on the Arches view and the refresh succeeds. The names resolve again at run time
-- once the refresh recreates them.
--
-- Three constraints are load-bearing:
--   * RETURNS TABLE, never RETURNS SETOF public.monument_point — a composite return
--     type DOES record a dependency and would defeat the whole thing.
--   * SECURITY INVOKER, and no SET clause: inline_set_returning_function refuses
--     prosecdef or proconfig, and an un-inlined function materialises the entire
--     view on every query, destroying bbox reads. Unlike the helpers above this
--     needs no definer rights — the consuming GIS role already holds SELECT on the
--     <slug>_<geom> views, which the Arches trigger grants to arches_spatial_views.
--   * The column list repeats the attributenodes in add_spatial_views.sql. The two
--     move together.

CREATE OR REPLACE FUNCTION public.__catalina_monument_point()
    RETURNS TABLE (gid bigint, tileid text, nodeid text, geom geometry(Geometry, 3857),
                   resourceinstanceid text, monument_name text, source_id_value text)
    LANGUAGE 'sql'
    STABLE
AS 'SELECT gid, tileid, nodeid, geom, resourceinstanceid, monument_name, source_id_value
      FROM public.monument_point';

CREATE OR REPLACE FUNCTION public.__catalina_monument_linestring()
    RETURNS TABLE (gid bigint, tileid text, nodeid text, geom geometry(Geometry, 3857),
                   resourceinstanceid text, monument_name text, source_id_value text)
    LANGUAGE 'sql'
    STABLE
AS 'SELECT gid, tileid, nodeid, geom, resourceinstanceid, monument_name, source_id_value
      FROM public.monument_linestring';

CREATE OR REPLACE FUNCTION public.__catalina_monument_polygon()
    RETURNS TABLE (gid bigint, tileid text, nodeid text, geom geometry(Geometry, 3857),
                   resourceinstanceid text, monument_name text, source_id_value text)
    LANGUAGE 'sql'
    STABLE
AS 'SELECT gid, tileid, nodeid, geom, resourceinstanceid, monument_name, source_id_value
      FROM public.monument_polygon';


-- ============================================================================
-- Heritage places  <-  public.monument_point / _linestring / _polygon
-- ============================================================================
--
-- The graph is Heritage Place (catalina-graphs' mutation of arches_her's Monument);
-- the spatial view keeps arches_her's `monument` slug and spatialviewid.
--
-- A recreated view is a new object and inherits none of its predecessor's grants,
-- so each wrapper is granted here or it would be unreadable after every run.
-- arches_spatial_views is the group role the Arches trigger grants its own
-- <slug>_<geom> views to, so following that convention keeps this environment
-- agnostic: a consuming role needs membership of it, granted once per environment,
-- rather than a grant naming that role reissued from here.

DROP VIEW IF EXISTS public.heritage_places_points;
CREATE OR REPLACE VIEW public.heritage_places_points AS
    SELECT gid,
        tileid,
        nodeid,
        resourceinstanceid,
        monument_name            AS heritage_place_name,
        __catalina_reference_label(resourceinstanceid,
            '87d3c3ea-f44f-11eb-b532-a87eeabdefba')  -- node alias: area_name
                                 AS district,
        __catalina_reference_label(resourceinstanceid,
            '77e90834-efdc-11eb-b2b9-a87eeabdefba')  -- node alias: monument_type
                                 AS heritage_place_type,
        source_id_value          AS eam_tech_object_id,
        __catalina_child_string_value(tileid,
            '87d39b32-f44f-11eb-a11e-a87eeabdefba',
            '\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}')  -- node alias: spatial_metadata_notes
                                 AS global_id,
        geom
    FROM public.__catalina_monument_point();
GRANT SELECT ON public.heritage_places_points TO arches_spatial_views;

DROP VIEW IF EXISTS public.heritage_places_lines;
CREATE OR REPLACE VIEW public.heritage_places_lines AS
    SELECT gid,
        tileid,
        nodeid,
        resourceinstanceid,
        monument_name            AS heritage_place_name,
        __catalina_reference_label(resourceinstanceid,
            '87d3c3ea-f44f-11eb-b532-a87eeabdefba')  -- node alias: area_name
                                 AS district,
        __catalina_reference_label(resourceinstanceid,
            '77e90834-efdc-11eb-b2b9-a87eeabdefba')  -- node alias: monument_type
                                 AS heritage_place_type,
        source_id_value          AS eam_tech_object_id,
        __catalina_child_string_value(tileid,
            '87d39b32-f44f-11eb-a11e-a87eeabdefba',
            '\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}')  -- node alias: spatial_metadata_notes
                                 AS global_id,
        geom
    FROM public.__catalina_monument_linestring();
GRANT SELECT ON public.heritage_places_lines TO arches_spatial_views;

DROP VIEW IF EXISTS public.heritage_places_polygons;
CREATE OR REPLACE VIEW public.heritage_places_polygons AS
    SELECT gid,
        tileid,
        nodeid,
        resourceinstanceid,
        monument_name            AS heritage_place_name,
        __catalina_reference_label(resourceinstanceid,
            '87d3c3ea-f44f-11eb-b532-a87eeabdefba')  -- node alias: area_name
                                 AS district,
        __catalina_reference_label(resourceinstanceid,
            '77e90834-efdc-11eb-b2b9-a87eeabdefba')  -- node alias: monument_type
                                 AS heritage_place_type,
        source_id_value          AS eam_tech_object_id,
        __catalina_child_string_value(tileid,
            '87d39b32-f44f-11eb-a11e-a87eeabdefba',
            '\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}')  -- node alias: spatial_metadata_notes
                                 AS global_id,
        geom
    FROM public.__catalina_monument_polygon();
GRANT SELECT ON public.heritage_places_polygons TO arches_spatial_views;



-- ============================================================================
-- Checking global_id: public.catalina_global_id_issues
-- ============================================================================
--
-- A wrong or missing global_id raises no error; it only shows up as a wrong or NULL
-- value in the layers. This view lists the Heritage Place Geometry tiles where that
-- happens, one row per problem, and is empty when all is well. Query it after each
-- import:
--
--   SELECT * FROM public.catalina_global_id_issues;
--
-- Two problems are reported:
--   * a Geometry tile with features but no GlobalID in its Spatial Metadata Notes:
--     global_id is NULL on all its rows.
--   * the same GlobalID on more than one Geometry tile: one ArcGIS feature is one
--     tile, so this is a copied or mistyped note. Every tile carrying it is listed.
--     Compared case-insensitively, since a hand edit may change the case.
-- Several features in one tile is not a problem: that is how Arches stores the parts
-- of a multipart feature (see "Per-feature values" above).
--
-- It reads tiles directly, not the Arches views, so an import's spatial-view refresh
-- does not touch it. It is for administrators and is deliberately not granted to
-- arches_spatial_views. Querying it needs EXECUTE on __catalina_child_string_value,
-- which the database owner has.
--
-- The feature count is guarded with CASE rather than a WHERE test on jsonb_typeof:
-- jsonb_array_length raises on a non-array, and WHERE conditions have no guaranteed
-- evaluation order.

DROP VIEW IF EXISTS public.catalina_global_id_issues;
CREATE OR REPLACE VIEW public.catalina_global_id_issues AS
    WITH geometry_tiles AS (
        SELECT t.resourceinstanceid,
            t.tileid,
            jsonb_array_length(
                CASE WHEN jsonb_typeof(
                              t.tiledata -> '87d3d7dc-f44f-11eb-bee9-a87eeabdefba' -> 'features')
                          = 'array'
                     THEN t.tiledata -> '87d3d7dc-f44f-11eb-bee9-a87eeabdefba' -> 'features'
                END)  -- node alias: geospatial_coordinates
                AS feature_count,
            __catalina_child_string_value(t.tileid::text,
                '87d39b32-f44f-11eb-a11e-a87eeabdefba',
                '\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}')  -- node alias: spatial_metadata_notes
                AS global_id
        FROM tiles t
        WHERE t.nodegroupid = (SELECT n.nodegroupid FROM nodes n
                               WHERE n.nodeid = '87d3d7dc-f44f-11eb-bee9-a87eeabdefba')
    )
    SELECT resourceinstanceid,
        tileid,
        'no GlobalID in Spatial Metadata Notes' AS issue,
        global_id
    FROM geometry_tiles
    WHERE feature_count > 0
      AND global_id IS NULL
    UNION ALL
    SELECT resourceinstanceid,
        tileid,
        'GlobalID on more than one Geometry tile' AS issue,
        global_id
    FROM (
        SELECT *, count(*) OVER (PARTITION BY upper(global_id)) AS tiles_with_id
        FROM geometry_tiles
        WHERE global_id IS NOT NULL
    ) d
    WHERE tiles_with_id > 1;
