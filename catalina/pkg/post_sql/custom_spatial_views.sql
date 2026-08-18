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
-- owner. Applies equally to __catalina_string_value below.
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


-- ============================================================================
-- Picking one value out of a cardinality-n string node
-- ============================================================================
--
-- Arches renders `string` nodes correctly, but a spatial view column aggregates
-- every tile in the node group into one comma-joined cell:
--
--   {9F965097-66B7-4287-940C-27025F551725}, A-HS-40-1000010083, CA/6
--
-- external_cross_reference holds identifiers from several source systems, and
-- global_id wants exactly one of them. Rather than take a positional guess, match
-- on the shape of the identifier: an ArcGIS GlobalID is a GUID in braces, which no
-- other cross-reference scheme in use here looks like.
--
-- Returns NULL when nothing matches.
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
        SELECT ((t.tiledata -> in_nodeid::text) -> language_id) ->> 'value' AS value
    ) v
    WHERE t.nodegroupid = (SELECT n.nodegroupid FROM nodes n WHERE n.nodeid = in_nodeid)
      AND t.resourceinstanceid = in_resourceinstanceid::uuid
      AND v.value IS NOT NULL
      AND v.value <> ''
      AND (match_pattern IS NULL OR v.value ~ match_pattern)
    ORDER BY t.sortorder NULLS LAST, t.tileid
    LIMIT 1;
$BODY$;


-- ============================================================================
-- Heritage places  <-  public.monument_point / _linestring / _polygon
-- ============================================================================
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
        __catalina_string_value(resourceinstanceid,
            'f17f6584-efc7-11eb-81f1-a87eeabdefba', '^\{.+\}$')  -- node alias: external_cross_reference
                                 AS global_id,
        geom
    FROM public.monument_point;
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
        __catalina_string_value(resourceinstanceid,
            'f17f6584-efc7-11eb-81f1-a87eeabdefba', '^\{.+\}$')  -- node alias: external_cross_reference
                                 AS global_id,
        geom
    FROM public.monument_linestring;
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
        __catalina_string_value(resourceinstanceid,
            'f17f6584-efc7-11eb-81f1-a87eeabdefba', '^\{.+\}$')  -- node alias: external_cross_reference
                                 AS global_id,
        geom
    FROM public.monument_polygon;
GRANT SELECT ON public.heritage_places_polygons TO arches_spatial_views;
