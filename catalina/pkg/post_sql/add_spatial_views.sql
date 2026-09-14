-- Runs at the end of `load_package` (arches load_sql post_sql step), after the
-- graphs are loaded, so the geometry/attribute nodes referenced below exist.
--
-- Each view is defined by a row in public.spatial_views; an Arches trigger
-- materializes the actual "<schema>.<slug>" Postgres view on INSERT/UPDATE/DELETE.
-- The targeted DELETE (by spatialviewid, not a blanket wipe) before each INSERT
-- keeps this idempotent across re-runs without touching other spatial views, so
-- the file can simply be edited and re-run against the DB.
--
-- ...but only on its own. The wrapper views in custom_spatial_views.sql SELECT
-- from the <slug>_<geom> views that the trigger drops, and the trigger's drop is
-- RESTRICT (the SQL default), so on any re-run the DELETEs below fail with
-- "cannot drop view monument_point because other objects depend on it" unless the
-- dependants are gone first. Clearing them here is what makes the add_ -> custom_
-- sequence idempotent as a *pair*; custom_spatial_views.sql recreates the wrappers
-- immediately afterwards.
--
-- Drop views and any dependent views downstream

DROP VIEW IF EXISTS public.monument_point CASCADE;
DROP VIEW IF EXISTS public.monument_linestring CASCADE;
DROP VIEW IF EXISTS public.monument_polygon CASCADE;

-- Heritage places (monument)
DELETE FROM public.spatial_views WHERE spatialviewid = '27318c10-adc4-421c-9e93-9c007ceee035';

INSERT INTO public.spatial_views (
    spatialviewid,
    schema,
    slug,
    description,
    ismixedgeometrytypes,
    attributenodes,
    isactive,
    geometrynodeid,
    languageid
)
VALUES (
    '27318c10-adc4-421c-9e93-9c007ceee035',
    'public',
    'monument',
    'Heritage places',
    false,
    -- Several nodes are deliberately absent.
    -- Two nodes are of `reference` datatype, which Arches
    -- renders as raw serialized tiledata; custom_spatial_views.sql resolves them
    -- via __catalina_reference_label instead:
    --   area_name     87d3c3ea-f44f-11eb-b532-a87eeabdefba  -> district
    --   monument_type 77e90834-efdc-11eb-b2b9-a87eeabdefba  -> heritage_place_type
    -- Another node is cardinality-n, for which Arches joins every tile into a single cell (comma separated) 
    -- custom_spatial_views.sql selects the desired value with the helper __catalina_string_value.
    --   external_cross_reference (f17f6584-efc7-11eb-81f1-a87eeabdefba -> global_id)
    '[
        {"nodeid":"676d47ff-9c1c-11ea-b07f-f875a44e0e11","description":"monument_name"},
        {"nodeid":"c27deb60-a464-50e1-9add-8de94ee95e57","description":"source_id_value"}
    ]',
    true,
    '87d3d7dc-f44f-11eb-bee9-a87eeabdefba'::UUID,
    'en'
);


-- The trigger that materializes the <slug>_<geom> views is DEFERRABLE INITIALLY
-- DEFERRED, so the INSERT above creates nothing until commit — and load_package runs
-- every post_sql file in one transaction, committing only after custom_spatial_views.sql
-- has already tried to SELECT from those views. Firing the pending trigger here creates
-- them before that file is read. ALL, because pgtrigger's constraint name is hashed.
SET CONSTRAINTS ALL IMMEDIATE;
