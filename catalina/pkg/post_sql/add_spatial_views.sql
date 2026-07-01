-- Runs at the end of `load_package` (arches load_sql post_sql step), after the
-- graphs are loaded, so the geometry node below exists. Replaces the former
-- 0002_add_spatial_views data migration. Targeted delete (not a blanket wipe)
-- keeps this idempotent across re-runs without touching other spatial views.
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
    'Heritage sites',
    false,
    '[
        {"nodeid":"77e8f28d-efdc-11eb-afe4-a87eeabdefba","description":"construction_phase_type"},
        {"nodeid":"325a2f33-efe4-11eb-b0bb-a87eeabdefba","description":"primary_reference_number"},
        {"nodeid":"ba345577-b554-11ea-a9ee-f875a44e0e11","description":"description"},
        {"nodeid":"b2133e72-efdc-11eb-a68d-a87eeabdefba","description":"use_phase_period"},
        {"nodeid":"b2133e6b-efdc-11eb-aa04-a87eeabdefba","description":"functional_type"},
        {"nodeid":"77e8f29d-efdc-11eb-b890-a87eeabdefba","description":"cultural_period"},
        {"nodeid":"676d47ff-9c1c-11ea-b07f-f875a44e0e11","description":"monument_name"},
        {"nodeid":"87d3c3ea-f44f-11eb-b532-a87eeabdefba","description":"area_name"},
        {"nodeid":"77e90834-efdc-11eb-b2b9-a87eeabdefba","description":"monument_type"},
        {"nodeid":"325a430a-efe4-11eb-810b-a87eeabdefba","description":"resource_id"},
        {"nodeid":"f17f6584-efc7-11eb-81f1-a87eeabdefba","description":"global_id"}
    ]',
    true,
    '87d3d7dc-f44f-11eb-bee9-a87eeabdefba'::UUID,
    'en'
);
