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


-- ============================================================================
-- Heritage places  <-  public.monument_point / _linestring / _polygon
-- ============================================================================

DROP VIEW IF EXISTS public.heritage_places_points;
CREATE OR REPLACE VIEW public.heritage_places_points AS
    SELECT gid,
        tileid,
        nodeid,
        resourceinstanceid,
        monument_name            AS heritage_place_name,
        area_name                AS district,
        monument_type            AS heritage_place_type,
        source_id_value          AS eam_tech_object_id,
        external_cross_reference AS global_id,
        resourceid               AS resourceid,
        geom
    FROM public.monument_point;

DROP VIEW IF EXISTS public.heritage_places_lines;
CREATE OR REPLACE VIEW public.heritage_places_lines AS
    SELECT gid,
        tileid,
        nodeid,
        resourceinstanceid,
        monument_name            AS heritage_place_name,
        area_name                AS district,
        monument_type            AS heritage_place_type,
        source_id_value          AS eam_tech_object_id,
        external_cross_reference AS global_id,
        resourceid               AS resourceid,
        geom
    FROM public.monument_linestring;

DROP VIEW IF EXISTS public.heritage_places_polygons;
CREATE OR REPLACE VIEW public.heritage_places_polygons AS
    SELECT gid,
        tileid,
        nodeid,
        resourceinstanceid,
        monument_name            AS heritage_place_name,
        area_name                AS district,
        monument_type            AS heritage_place_type,
        source_id_value          AS eam_tech_object_id,
        external_cross_reference AS global_id,
        resourceid               AS resourceid,
        geom
    FROM public.monument_polygon;


-- ============================================================================
-- Areas  <-  public.area_polygon  (polygons only)
-- ============================================================================

DROP VIEW IF EXISTS public.areas_polygons;
CREATE OR REPLACE VIEW public.areas_polygons AS
    SELECT gid,
        tileid,
        nodeid,
        resourceinstanceid,
        area_name  AS area,
        legacy_id  AS amis_floc_id,
        resourceid AS resourceid,
        geom
    FROM public.area_polygon;


-- ============================================================================
-- Assessments  <-  public.consultation_point / _linestring / _polygon
-- ============================================================================

DROP VIEW IF EXISTS public.assessment_points;
CREATE OR REPLACE VIEW public.assessment_points AS
    SELECT gid,
        tileid,
        nodeid,
        resourceinstanceid,
        consultation_name        AS asset_name,
        log_date                 AS date_of_assessment,
        consultation_description AS assessment_of_condition,
        planning_outcome         AS monitoring_frequency,
        external_cross_reference AS global_id,
        resourceid               AS resourceid,
        geom
    FROM public.consultation_point;

DROP VIEW IF EXISTS public.assessment_lines;
CREATE OR REPLACE VIEW public.assessment_lines AS
    SELECT gid,
        tileid,
        nodeid,
        resourceinstanceid,
        consultation_name        AS asset_name,
        log_date                 AS date_of_assessment,
        consultation_description AS assessment_of_condition,
        planning_outcome         AS monitoring_frequency,
        external_cross_reference AS global_id,
        resourceid               AS resourceid,
        geom
    FROM public.consultation_linestring;

DROP VIEW IF EXISTS public.assessment_polygons;
CREATE OR REPLACE VIEW public.assessment_polygons AS
    SELECT gid,
        tileid,
        nodeid,
        resourceinstanceid,
        consultation_name        AS asset_name,
        log_date                 AS date_of_assessment,
        consultation_description AS assessment_of_condition,
        planning_outcome         AS monitoring_frequency,
        external_cross_reference AS global_id,
        resourceid               AS resourceid,
        geom
    FROM public.consultation_polygon;
