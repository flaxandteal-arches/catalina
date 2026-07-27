-- Runs at the end of `load_package` (arches load_sql post_sql step), after the
-- graphs are loaded, so the geometry/attribute nodes referenced below exist.
--
-- Each view is defined by a row in public.spatial_views; an Arches trigger
-- materializes the actual "<schema>.<slug>" Postgres view on INSERT/UPDATE/DELETE.
-- The targeted DELETE (by spatialviewid, not a blanket wipe) before each INSERT
-- keeps this idempotent across re-runs without touching other spatial views, so
-- the file can simply be edited and re-run against the DB.

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
    '[
        {"nodeid":"676d47ff-9c1c-11ea-b07f-f875a44e0e11","description":"monument_name"},
        {"nodeid":"87d3c3ea-f44f-11eb-b532-a87eeabdefba","description":"area_name"},
        {"nodeid":"77e90834-efdc-11eb-b2b9-a87eeabdefba","description":"monument_type"},
        {"nodeid":"325a430a-efe4-11eb-810b-a87eeabdefba","description":"resourceid"},
        {"nodeid":"c27deb60-a464-50e1-9add-8de94ee95e57","description":"source_id_value"},
        {"nodeid":"f17f6584-efc7-11eb-81f1-a87eeabdefba","description":"external_cross_reference"}
    ]',
    true,
    '87d3d7dc-f44f-11eb-bee9-a87eeabdefba'::UUID,
    'en'
);

-- Areas
DELETE FROM public.spatial_views WHERE spatialviewid = 'bdbd2722-70dd-4c2b-ad56-a0622c6acff7';

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
    'bdbd2722-70dd-4c2b-ad56-a0622c6acff7',
    'public',
    'area',
    'Areas',
    false,
    '[
        {"nodeid":"f45dbbe8-80b7-11ea-b325-f875a44e0e11","description":"area_name_n1"},
        {"nodeid":"8dca12bd-edeb-11eb-a6c6-a87eeabdefba","description":"legacy_id"},
        {"nodeid":"8dca12b7-edeb-11eb-a58d-a87eeabdefba","description":"resourceid"}
    ]',
    true,
    '64be56e3-3ee5-11eb-b1f0-f875a44e0e11'::UUID,
    'en'
);

-- Consultations
DELETE FROM public.spatial_views WHERE spatialviewid = 'a9053144-4127-4519-b0e4-d5572c7c6b24';

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
    'a9053144-4127-4519-b0e4-d5572c7c6b24',
    'public',
    'consultation',
    'Consultations',
    false,
    '[
        {"nodeid":"4ad69684-951f-11ea-b5c3-f875a44e0e11","description":"consultation_name"},
        {"nodeid":"40eff4cd-893a-11ea-b0cc-f875a44e0e11","description":"log_date"},
        {"nodeid":"82f8a166-951a-11ea-bdad-f875a44e0e11","description":"consultation_description"},
        {"nodeid":"8d41e4e3-a250-11e9-89d8-00224800b26d","description":"planning_outcome"},
        {"nodeid":"3b500558-eec2-11eb-98b3-a87eeabdefba","description":"external_cross_reference"},
        {"nodeid":"b37552be-9527-11ea-9213-f875a44e0e11","description":"resourceid"}
    ]',
    true,
    'b949053a-184f-11eb-ac4a-f875a44e0e11'::UUID,
    'en'
);
