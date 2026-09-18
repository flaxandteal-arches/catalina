import $ from "jquery";
import _ from "underscore";
import ko from "knockout";
import arches from "arches";
import resourceUtils from "utils/resource";
import reportUtils from "utils/report";
import PersonTemplate from "templates/views/components/reports/person.htm";
import "views/components/reports/scenes/name";
import "bindings/reports";

export default ko.components.register("person-report", {
    viewModel: function (params) {
        var self = this;
        params.configKeys = ["tabs", "activeTabIndex"];
        this.configForm = params.configForm || false;
        this.configType = params.configType || "header";

        Object.assign(self, reportUtils);

        // Shared extraction for the Identifier/Name/Statement(+Statement Name)/
        // Time(+Time Duration+Time Duration Name+Time Name) subtree that recurs
        // under Profession Activity, Birth and Death using a "<prefix>_..." node
        // naming convention.
        self.getIdentifierNameStatementTimeTree = (tile, prefix) => {
            const asArray = (raw) =>
                raw ? (Array.isArray(raw) ? raw : [raw]) : [];

            const rawIdentifiers = self.getRawNodeValue(
                tile,
                `${prefix}_identifier`
            );
            const identifiers = asArray(rawIdentifiers).map((i) => ({
                content: self.getNodeValue(i, `${prefix}_identifier_content`),
                label: self.getNodeValue(i, `${prefix}_identifier_label`),
                type: self.getNodeValue(i, `${prefix}_identifier_type`),
                source: self.getResourceLink(
                    self.getRawNodeValue(i, `${prefix}_identifier_source`)
                ),
                sourceText: self.getNodeValue(
                    i,
                    `${prefix}_identifier_source`
                ),
            }));

            const rawNames = self.getRawNodeValue(tile, `${prefix}_name`);
            const names = asArray(rawNames).map((n) => ({
                content: self.getNodeValue(n, `${prefix}_name_content`),
                label: self.getNodeValue(n, `${prefix}_name_label`),
                language: self.getNodeValue(n, `${prefix}_name_language`),
                type: self.getNodeValue(n, `${prefix}_name_type`),
                source: self.getResourceLink(
                    self.getRawNodeValue(n, `${prefix}_name_source`)
                ),
                sourceText: self.getNodeValue(n, `${prefix}_name_source`),
            }));

            const rawStatements = self.getRawNodeValue(
                tile,
                `${prefix}_statement`
            );
            const statements = asArray(rawStatements).map((s) => {
                const rawStatementNames = self.getRawNodeValue(
                    s,
                    `${prefix}_statement_name`
                );
                const statementNames = asArray(rawStatementNames).map(
                    (n) => ({
                        content: self.getNodeValue(
                            n,
                            `${prefix}_statement_name_content`
                        ),
                        label: self.getNodeValue(
                            n,
                            `${prefix}_statement_name_label`
                        ),
                        language: self.getNodeValue(
                            n,
                            `${prefix}_statement_name_language`
                        ),
                        type: self.getNodeValue(
                            n,
                            `${prefix}_statement_name_type`
                        ),
                        source: self.getResourceLink(
                            self.getRawNodeValue(
                                n,
                                `${prefix}_statement_name_source`
                            )
                        ),
                        sourceText: self.getNodeValue(
                            n,
                            `${prefix}_statement_name_source`
                        ),
                    })
                );

                return {
                    content: self.getNodeValue(s, `${prefix}_statement_content`),
                    label: self.getNodeValue(s, `${prefix}_statement_label`),
                    language: self.getNodeValue(
                        s,
                        `${prefix}_statement_language`
                    ),
                    type: self.getNodeValue(s, `${prefix}_statement_type`),
                    source: self.getResourceLink(
                        self.getRawNodeValue(s, `${prefix}_statement_source`)
                    ),
                    sourceText: self.getNodeValue(
                        s,
                        `${prefix}_statement_source`
                    ),
                    names: statementNames,
                };
            });

            const rawTimes = self.getRawNodeValue(tile, `${prefix}_time`);
            const times = asArray(rawTimes).map((t) => {
                const rawTimeNames = self.getRawNodeValue(
                    t,
                    `${prefix}_time_name`
                );
                const timeNames = asArray(rawTimeNames).map((n) => ({
                    content: self.getNodeValue(n, `${prefix}_time_name_content`),
                    label: self.getNodeValue(n, `${prefix}_time_name_label`),
                    language: self.getNodeValue(
                        n,
                        `${prefix}_time_name_language`
                    ),
                    type: self.getNodeValue(n, `${prefix}_time_name_type`),
                    source: self.getResourceLink(
                        self.getRawNodeValue(n, `${prefix}_time_name_source`)
                    ),
                    sourceText: self.getNodeValue(
                        n,
                        `${prefix}_time_name_source`
                    ),
                }));

                const rawDurations = self.getRawNodeValue(
                    t,
                    `${prefix}_time_duration`
                );
                const durations = asArray(rawDurations).map((d) => {
                    const rawDurationNames = self.getRawNodeValue(
                        d,
                        `${prefix}_time_duration_name`
                    );
                    const durationNames = asArray(rawDurationNames).map(
                        (n) => ({
                            content: self.getNodeValue(
                                n,
                                `${prefix}_time_duration_name_content`
                            ),
                            label: self.getNodeValue(
                                n,
                                `${prefix}_time_duration_name_label`
                            ),
                            language: self.getNodeValue(
                                n,
                                `${prefix}_time_duration_name_language`
                            ),
                            type: self.getNodeValue(
                                n,
                                `${prefix}_time_duration_name_type`
                            ),
                            source: self.getResourceLink(
                                self.getRawNodeValue(
                                    n,
                                    `${prefix}_time_duration_name_source`
                                )
                            ),
                            sourceText: self.getNodeValue(
                                n,
                                `${prefix}_time_duration_name_source`
                            ),
                        })
                    );

                    return {
                        label: self.getNodeValue(
                            d,
                            `${prefix}_time_duration_label`
                        ),
                        type: self.getNodeValue(
                            d,
                            `${prefix}_time_duration_type`
                        ),
                        unit: self.getNodeValue(
                            d,
                            `${prefix}_time_duration_unit`
                        ),
                        value: self.getNodeValue(
                            d,
                            `${prefix}_time_duration_value`
                        ),
                        lowestPossibleValue: self.getNodeValue(
                            d,
                            `${prefix}_time_duration_lowest possible value`
                        ),
                        highestPossibleValue: self.getNodeValue(
                            d,
                            `${prefix}_time_duration_highest possible value`
                        ),
                        source: self.getResourceLink(
                            self.getRawNodeValue(
                                d,
                                `${prefix}_time_duration_source`
                            )
                        ),
                        sourceText: self.getNodeValue(
                            d,
                            `${prefix}_time_duration_source`
                        ),
                        names: durationNames,
                    };
                });

                return {
                    label: self.getNodeValue(t, `${prefix}_time_label`),
                    type: self.getNodeValue(t, `${prefix}_time_type`),
                    beginOfBegin: self.getNodeValue(
                        t,
                        `${prefix}_time_begin of the begin`
                    ),
                    beginOfEnd: self.getNodeValue(
                        t,
                        `${prefix}_time_begin of the end`
                    ),
                    endOfBegin: self.getNodeValue(
                        t,
                        `${prefix}_time_end of the begin`
                    ),
                    endOfEnd: self.getNodeValue(
                        t,
                        `${prefix}_time_end of the end`
                    ),
                    names: timeNames,
                    durations,
                };
            });

            return { identifiers, names, statements, times };
        };

        self.sections = [
            { id: "name", title: "Names and Classifications" },
            { id: "person-name", title: "Person Name and Identifiers" },
            { id: "description", title: "Descriptions and Citations" },
            { id: "location", title: "Location Data" },
            { id: "images", title: "Images" },
            { id: "people", title: "Associated People and Organizations" },
            { id: "contact", title: "Biography and Contact Details" },
            { id: "resources", title: "Associated Resources" },
            { id: "json", title: "JSON" },
        ];
        self.reportMetadata = ko.observable(params.report?.report_json);
        self.resource = ko.observable(self.reportMetadata()?.resource);
        self.displayname = ko.observable(
            ko.unwrap(self.reportMetadata)?.displayname
        );
        self.activeSection = ko.observable("name");
        self.names = ko.observableArray();

        self.nameTableConfig = {
            ...self.defaultTableConfig,
            columns: Array(9).fill(null),
        };

        self.identifierTableConfig = {
            ...self.defaultTableConfig,
            columns: Array(6).fill(null),
        };

        self.professionActivityTableConfig = {
            ...self.defaultTableConfig,
            columns: Array(13).fill(null),
        };

        self.recordRegistryTableConfig = {
            ...self.defaultTableConfig,
            columns: Array(5).fill(null),
        };

        self.whakapapaStatusTableConfig = {
            ...self.defaultTableConfig,
            columns: Array(6).fill(null),
        };

        self.appellativeStatusTableConfig = {
            ...self.defaultTableConfig,
            columns: Array(7).fill(null),
        };

        self.classificationTableConfig = {
            ...self.defaultTableConfig,
            columns: Array(6).fill(null),
        };

        self.familyStatusTableConfig = {
            ...self.defaultTableConfig,
            columns: Array(5).fill(null),
        };

        self.birthTableConfig = {
            ...self.defaultTableConfig,
            columns: Array(6).fill(null),
        };

        self.deathTableConfig = {
            ...self.defaultTableConfig,
            columns: Array(6).fill(null),
        };

        self.sourceReferenceWorkTableConfig = {
            ...self.defaultTableConfig,
            columns: Array(2).fill(null),
        };

        self.visible = {
            names: ko.observable(true),
            identifiers: ko.observable(true),
            recordRegistry: ko.observable(true),
            professionActivity: ko.observable(true),
            culturalAffiliation: ko.observable(true),
            whakapapaStatus: ko.observable(true),
            appellativeStatus: ko.observable(true),
            classification: ko.observable(true),
            familyStatus: ko.observable(true),
            birth: ko.observable(true),
            death: ko.observable(true),
            sourceReferenceWork: ko.observable(true),
        };

        self.nameDataConfig = {
            name: undefined,
        };

        self.locationDataConfig = {
            nationalGrid: undefined,
            locationDescription: undefined,
            administrativeAreas: undefined,
            geometry: undefined,
        };

        self.descriptionDataConfig = {
            citation: "bibliographic source citation",
            statement: "statement",
        };

        self.resourceDataConfig = {
            files: "digital file(s)",
            activities: "associated activities",
            assets: "Associated Heritage Places, Areas and Artefacts",
            period: undefined,
            actors: undefined,
            archive: undefined,
            resourceinstanceid: ko.unwrap(self.reportMetadata)
                ?.resourceinstanceid,
        };
        self.nameCards = {};
        self.descriptionCards = {};
        self.locationCards = {};
        self.resourcesCards = {};
        self.contactCards = {};
        self.imagesCards = {};
        self.peopleCards = {};
        self.summary = params.summary;
        self.cards = {};

        if (params.report.cards) {
            const cards = params.report.cards;

            self.cards = self.createCardDictionary(cards);

            // "Names" and "Record and Registry Membership" both collide by name with an
            // unrelated nested card elsewhere in the graph, so createCardDictionary's
            // name-keyed lookup can't be trusted for them; patch the dictionary entries
            // to point at the correct top-level card, found by nodegroup id instead.
            const namesCard = cards.find(
                (card) =>
                    card.nodegroupid ===
                    "4110f741-1a44-11e9-885e-000d3ab1e588"
            );
            const recordRegistryCard = cards.find(
                (card) =>
                    card.nodegroupid ===
                    "b1a42558-702e-5c86-afd7-ba0e9c570f8e"
            );
            if (namesCard) {
                self.cards.names = namesCard;
            }
            if (recordRegistryCard) {
                self.cards["record and registry membership"] =
                    recordRegistryCard;
            }

            self.nameCards = {
                name: self.cards?.names,
                externalCrossReferences:
                    self.cards?.["external cross references"],
                systemReferenceNumbers:
                    self.cards?.["system reference numbers"],
            };

            self.descriptionCards = {
                descriptions: self.cards?.["descriptions"],
                citation: self.cards?.["bibliographic source citation"],
                statement: self.cards?.["statement"],
            };

            self.imagesCards = {
                images: self.cards?.["images"],
            };

            self.peopleCards = {
                people: self.cards?.["associated people and organizations"],
            };

            self.locationCards = {
                cards: self.cards,
                location: {
                    card: null,
                    subCards: {
                        addresses: "addresses",
                    },
                },
            };

            self.contactCards = {
                contact: self.cards?.["contact details"],
            };

            self.resourcesCards = {
                activities: self.cards?.["associated activities"],
                files: self.cards?.["associated digital file(s)"],
                assets: self.cards?.["heritage place, area or artefact"],
            };
        }

        const nameNode = self.getRawNodeValue(self.resource(), "name");
        if (Array.isArray(nameNode)) {
            self.names(
                nameNode.map((node) => {
                    const name = self.getNodeValue(node, "full name");
                    const nameUseType = self.getNodeValue(
                        node,
                        "name use type"
                    );
                    const initials = self.getNodeValue(
                        node,
                        "initials",
                        "initial(s)"
                    );
                    const forename = self.getNodeValue(
                        node,
                        "forenames",
                        "forename"
                    );
                    const title = self.getNodeValue(node, "titles", "title");
                    const surname = self.getNodeValue(
                        node,
                        "surnames",
                        "surname"
                    );
                    const epithet = self.getNodeValue(
                        node,
                        "epithets",
                        "epithet"
                    );
                    const tileid = self.getTileId(node);

                    const rawNameParts = self.getRawNodeValue(
                        node,
                        "name_part"
                    );
                    const nameParts = (
                        Array.isArray(rawNameParts)
                            ? rawNameParts
                            : rawNameParts
                              ? [rawNameParts]
                              : []
                    ).map((p) => ({
                        content: self.getNodeValue(p, "name_part_content"),
                        label: self.getNodeValue(p, "name_part_label"),
                        language: self.getNodeValue(p, "name_part_language"),
                        type: self.getNodeValue(p, "name_part_type"),
                        source: self.getResourceLink(
                            self.getRawNodeValue(p, "name_part_source")
                        ),
                        sourceText: self.getNodeValue(p, "name_part_source"),
                    }));

                    return {
                        name,
                        nameUseType,
                        initials,
                        forename,
                        title,
                        epithet,
                        surname,
                        nameParts,
                        tileid,
                    };
                })
            );
        }

        self.lifeData = ko.observable({
            sections: [
                {
                    title: "Person Currency",
                    data: [
                        {
                            key: "Currency",
                            value: self.getNodeValue(
                                self.resource(),
                                "currency"
                            ),
                            type: "kv",
                            card: self.cards?.["person currency"],
                        },
                    ],
                },
            ],
        });

        self.classificationsData = ko.observable({
            sections: [
                {
                    title: "Gender",
                    card: self.cards?.gender,
                    data: [
                        {
                            key: "Gender",
                            value: self.getNodeValue(
                                self.resource(),
                                "gender"
                            ),
                            type: "kv",
                            card: self.cards?.gender,
                        },
                        {
                            key: "Gender Meta Type",
                            value: self.getNodeValue(
                                self.resource(),
                                "gender",
                                "gender_meta type"
                            ),
                            type: "kv",
                            card: self.cards?.gender,
                        },
                    ],
                },
                {
                    title: "Nationality",
                    card: self.cards?.nationality,
                    data: [
                        {
                            key: "Nationality",
                            value: self.getNodeValue(
                                self.resource(),
                                "nationality"
                            ),
                            type: "kv",
                            card: self.cards?.nationality,
                        },
                        {
                            key: "Nationality Meta Type",
                            value: self.getNodeValue(
                                self.resource(),
                                "nationality",
                                "nationality_meta type"
                            ),
                            type: "kv",
                            card: self.cards?.nationality,
                        },
                    ],
                },
                {
                    title: "Ethnicity",
                    card: self.cards?.ethnicity,
                    data: [
                        {
                            key: "Ethnicity",
                            value: self.getNodeValue(
                                self.resource(),
                                "ethnicity"
                            ),
                            type: "kv",
                            card: self.cards?.ethnicity,
                        },
                        {
                            key: "Ethnicity Meta Type",
                            value: self.getNodeValue(
                                self.resource(),
                                "ethnicity",
                                "ethnicity_meta type"
                            ),
                            type: "kv",
                            card: self.cards?.ethnicity,
                        },
                    ],
                },
            ],
        });

        const whakapapaAncestorNode = self.getRawNodeValue(
            self.resource(),
            "whakapapa status",
            "whakapapa status ascribed ancestor"
        );
        const whakapapaAncestorTiles = whakapapaAncestorNode
            ? Array.isArray(whakapapaAncestorNode)
                ? whakapapaAncestorNode
                : [whakapapaAncestorNode]
            : [];
        self.whakapapaStatus = ko.observable({
            displayDate: self.getNodeValue(
                self.resource(),
                "whakapapa status",
                "whakapapa status timespan",
                "timespan (date)",
                "display date"
            ),
            startDate: self.getNodeValue(
                self.resource(),
                "whakapapa status",
                "whakapapa status timespan",
                "timespan (date)",
                "start date"
            ),
            endDate: self.getNodeValue(
                self.resource(),
                "whakapapa status",
                "whakapapa status timespan",
                "timespan (date)",
                "end date"
            ),
            dateQualifier: self.getNodeValue(
                self.resource(),
                "whakapapa status",
                "whakapapa status timespan",
                "timespan (date)",
                "date qualifier"
            ),
            dateQualifierMetatype: self.getNodeValue(
                self.resource(),
                "whakapapa status",
                "whakapapa status timespan",
                "timespan (date)",
                "date qualifier",
                "date qualifier metatype"
            ),
            ancestors: whakapapaAncestorTiles.map((x) => ({
                ancestor: self.getResourceLink(x),
                ancestorText: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            tileid: self.getTileId(
                self.getRawNodeValue(self.resource(), "whakapapa status")
            ),
        });

        const rawAppellativeStatusHoldsFor = self.getRawNodeValue(
            self.resource(),
            "appellative status",
            "appellative status holds for"
        );
        const appellativeStatusHoldsForTiles = rawAppellativeStatusHoldsFor
            ? Array.isArray(rawAppellativeStatusHoldsFor)
                ? rawAppellativeStatusHoldsFor
                : [rawAppellativeStatusHoldsFor]
            : [];

        const rawAppellativeStatusContextTypes = self.getRawNodeValue(
            self.resource(),
            "appellative status",
            "appellative status context type"
        );
        const appellativeStatusContextTypeTiles =
            rawAppellativeStatusContextTypes
                ? Array.isArray(rawAppellativeStatusContextTypes)
                    ? rawAppellativeStatusContextTypes
                    : [rawAppellativeStatusContextTypes]
                : [];

        const rawAppellativeStatusTypes = self.getRawNodeValue(
            self.resource(),
            "appellative status",
            "appellative status type"
        );
        const appellativeStatusTypeTiles = rawAppellativeStatusTypes
            ? Array.isArray(rawAppellativeStatusTypes)
                ? rawAppellativeStatusTypes
                : [rawAppellativeStatusTypes]
            : [];

        const rawAppellations = self.getRawNodeValue(
            self.resource(),
            "appellative status",
            "appellation"
        );
        const appellationTiles = rawAppellations
            ? Array.isArray(rawAppellations)
                ? rawAppellations
                : [rawAppellations]
            : [];
        const appellativeStatusNameTiles = appellationTiles.flatMap((a) => {
            const rawNames = self.getRawNodeValue(a, "names");
            return rawNames
                ? Array.isArray(rawNames)
                    ? rawNames
                    : [rawNames]
                : [];
        });

        const rawAppellativeStatusStatements = self.getRawNodeValue(
            self.resource(),
            "appellative status",
            "appellative status statement"
        );
        const appellativeStatusStatementTiles = rawAppellativeStatusStatements
            ? Array.isArray(rawAppellativeStatusStatements)
                ? rawAppellativeStatusStatements
                : [rawAppellativeStatusStatements]
            : [];

        self.appellativeStatus = ko.observable({
            appellativeRelation: self.getNodeValue(
                self.resource(),
                "appellative status",
                "appellative relation"
            ),
            context: self.getResourceLink(
                self.getRawNodeValue(
                    self.resource(),
                    "appellative status",
                    "appellative status context"
                )
            ),
            contextText: self.getNodeValue(
                self.resource(),
                "appellative status",
                "appellative status context"
            ),
            initiatingAct: self.getResourceLink(
                self.getRawNodeValue(
                    self.resource(),
                    "appellative status",
                    "appellative status initiating act"
                )
            ),
            initiatingActText: self.getNodeValue(
                self.resource(),
                "appellative status",
                "appellative status initiating act"
            ),
            terminatingAct: self.getResourceLink(
                self.getRawNodeValue(
                    self.resource(),
                    "appellative status",
                    "appellative status terminating act"
                )
            ),
            terminatingActText: self.getNodeValue(
                self.resource(),
                "appellative status",
                "appellative status terminating act"
            ),
            displayDate: self.getNodeValue(
                self.resource(),
                "appellative status",
                "appellative status timespan",
                "timespan (date)",
                "display date"
            ),
            startDate: self.getNodeValue(
                self.resource(),
                "appellative status",
                "appellative status timespan",
                "timespan (date)",
                "start date"
            ),
            endDate: self.getNodeValue(
                self.resource(),
                "appellative status",
                "appellative status timespan",
                "timespan (date)",
                "end date"
            ),
            holdsFor: appellativeStatusHoldsForTiles.map((x) => ({
                link: self.getResourceLink(x),
                text: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            contextTypes: appellativeStatusContextTypeTiles.map((x) => ({
                value: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            types: appellativeStatusTypeTiles.map((x) => ({
                value: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            names: appellativeStatusNameTiles.map((x) => ({
                name: self.getNodeValue(x, "name"),
                nameType: self.getNodeValue(x, "name type"),
                nameMetatype: self.getNodeValue(
                    x,
                    "name type",
                    "name metatype"
                ),
                nameUseType: self.getNodeValue(x, "name use type"),
                nameUseMetatype: self.getNodeValue(
                    x,
                    "name use type",
                    "name use metatype"
                ),
                nameCurrency: self.getNodeValue(x, "name currency"),
                nameCurrencyMetatype: self.getNodeValue(
                    x,
                    "name currency",
                    "name currency metatype"
                ),
                tileid: self.getTileId(x),
            })),
            statements: appellativeStatusStatementTiles.map((x) => {
                const rawDescriptions = self.getRawNodeValue(
                    x,
                    "descriptions"
                );
                const descriptionTiles = rawDescriptions
                    ? Array.isArray(rawDescriptions)
                        ? rawDescriptions
                        : [rawDescriptions]
                    : [];
                return {
                    tileid: self.getTileId(x),
                    descriptions: descriptionTiles.map((d) => ({
                        description: self.getNodeValue(d, "description"),
                        descriptionType: self.getNodeValue(
                            d,
                            "description type"
                        ),
                        descriptionLanguage: self.getNodeValue(
                            d,
                            "description language"
                        ),
                    })),
                };
            }),
            tileid: self.getTileId(
                self.getRawNodeValue(self.resource(), "appellative status")
            ),
        });

        const rawClassifications = self.getRawNodeValue(
            self.resource(),
            "classification",
            "classificatory status classification"
        );
        const classificationTiles = rawClassifications
            ? Array.isArray(rawClassifications)
                ? rawClassifications
                : [rawClassifications]
            : [];

        const rawClassificationHoldsFor = self.getRawNodeValue(
            self.resource(),
            "classification",
            "classificatory status holds for"
        );
        const classificationHoldsForTiles = rawClassificationHoldsFor
            ? Array.isArray(rawClassificationHoldsFor)
                ? rawClassificationHoldsFor
                : [rawClassificationHoldsFor]
            : [];

        const rawClassificationEventContext = self.getRawNodeValue(
            self.resource(),
            "classification",
            "classificatory status event context"
        );
        const classificationEventContextTiles = rawClassificationEventContext
            ? Array.isArray(rawClassificationEventContext)
                ? rawClassificationEventContext
                : [rawClassificationEventContext]
            : [];

        const rawClassificationContextTypes = self.getRawNodeValue(
            self.resource(),
            "classification",
            "classificatory status context type"
        );
        const classificationContextTypeTiles = rawClassificationContextTypes
            ? Array.isArray(rawClassificationContextTypes)
                ? rawClassificationContextTypes
                : [rawClassificationContextTypes]
            : [];

        const rawClassificationTypes = self.getRawNodeValue(
            self.resource(),
            "classification",
            "classificatory status type"
        );
        const classificationTypeTiles = rawClassificationTypes
            ? Array.isArray(rawClassificationTypes)
                ? rawClassificationTypes
                : [rawClassificationTypes]
            : [];

        const rawClassificationStatements = self.getRawNodeValue(
            self.resource(),
            "classification",
            "classificatory status statement"
        );
        const classificationStatementTiles = rawClassificationStatements
            ? Array.isArray(rawClassificationStatements)
                ? rawClassificationStatements
                : [rawClassificationStatements]
            : [];

        self.classification = ko.observable({
            ascribedRelation: self.getNodeValue(
                self.resource(),
                "classification",
                "ascribed classificatory status relation"
            ),
            initiatingAct: self.getResourceLink(
                self.getRawNodeValue(
                    self.resource(),
                    "classification",
                    "classificatory status initiating act"
                )
            ),
            initiatingActText: self.getNodeValue(
                self.resource(),
                "classification",
                "classificatory status initiating act"
            ),
            terminatingAct: self.getResourceLink(
                self.getRawNodeValue(
                    self.resource(),
                    "classification",
                    "classificatory status terminating act"
                )
            ),
            terminatingActText: self.getNodeValue(
                self.resource(),
                "classification",
                "classificatory status terminating act"
            ),
            displayDate: self.getNodeValue(
                self.resource(),
                "classification",
                "classificatory status time-span",
                "timespan (date)",
                "display date"
            ),
            startDate: self.getNodeValue(
                self.resource(),
                "classification",
                "classificatory status time-span",
                "timespan (date)",
                "start date"
            ),
            endDate: self.getNodeValue(
                self.resource(),
                "classification",
                "classificatory status time-span",
                "timespan (date)",
                "end date"
            ),
            classifications: classificationTiles.map((x) => ({
                value: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            contextTypes: classificationContextTypeTiles.map((x) => ({
                value: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            types: classificationTypeTiles.map((x) => ({
                value: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            holdsFor: classificationHoldsForTiles.map((x) => ({
                link: self.getResourceLink(x),
                text: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            eventContext: classificationEventContextTiles.map((x) => ({
                link: self.getResourceLink(x),
                text: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            statements: classificationStatementTiles.map((x) => {
                const rawDescriptions = self.getRawNodeValue(
                    x,
                    "descriptions"
                );
                const descriptionTiles = rawDescriptions
                    ? Array.isArray(rawDescriptions)
                        ? rawDescriptions
                        : [rawDescriptions]
                    : [];
                return {
                    tileid: self.getTileId(x),
                    descriptions: descriptionTiles.map((d) => ({
                        description: self.getNodeValue(d, "description"),
                        descriptionType: self.getNodeValue(
                            d,
                            "description type"
                        ),
                        descriptionLanguage: self.getNodeValue(
                            d,
                            "description language"
                        ),
                    })),
                };
            }),
            tileid: self.getTileId(
                self.getRawNodeValue(self.resource(), "classification")
            ),
        });

        const familyStatusTile = self.getRawNodeValue(self.resource(), {
            testPaths: [["family status (2)"], ["family status"]],
        });

        const rawFamilyStatusAscribedRelative = self.getRawNodeValue(
            familyStatusTile,
            "ascribed relative"
        );
        const familyStatusAscribedRelativeTiles =
            rawFamilyStatusAscribedRelative
                ? Array.isArray(rawFamilyStatusAscribedRelative)
                    ? rawFamilyStatusAscribedRelative
                    : [rawFamilyStatusAscribedRelative]
                : [];

        const rawFamilyStatusHoldsFor = self.getRawNodeValue(
            familyStatusTile,
            "family status holds for"
        );
        const familyStatusHoldsForTiles = rawFamilyStatusHoldsFor
            ? Array.isArray(rawFamilyStatusHoldsFor)
                ? rawFamilyStatusHoldsFor
                : [rawFamilyStatusHoldsFor]
            : [];

        const rawFamilyStatusEventContext = self.getRawNodeValue(
            familyStatusTile,
            "family status event context"
        );
        const familyStatusEventContextTiles = rawFamilyStatusEventContext
            ? Array.isArray(rawFamilyStatusEventContext)
                ? rawFamilyStatusEventContext
                : [rawFamilyStatusEventContext]
            : [];

        const rawFamilyStatusTypes = self.getRawNodeValue(
            familyStatusTile,
            "family status type"
        );
        const familyStatusTypeTiles = rawFamilyStatusTypes
            ? Array.isArray(rawFamilyStatusTypes)
                ? rawFamilyStatusTypes
                : [rawFamilyStatusTypes]
            : [];

        const rawFamilyStatusStatements = self.getRawNodeValue(
            familyStatusTile,
            "family status statement"
        );
        const familyStatusStatementTiles = rawFamilyStatusStatements
            ? Array.isArray(rawFamilyStatusStatements)
                ? rawFamilyStatusStatements
                : [rawFamilyStatusStatements]
            : [];

        self.familyStatus = ko.observable({
            timespan: self.getNodeValue(
                familyStatusTile,
                "family status time-span"
            ),
            contextType: self.getNodeValue(
                familyStatusTile,
                "family status context type"
            ),
            initiatingAct: self.getNodeValue(
                familyStatusTile,
                "family status initiating act"
            ),
            terminatingAct: self.getNodeValue(
                familyStatusTile,
                "family status terminating act"
            ),
            ascribedRelatives: familyStatusAscribedRelativeTiles.map((x) => ({
                link: self.getResourceLink(x),
                text: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            holdsFor: familyStatusHoldsForTiles.map((x) => ({
                link: self.getResourceLink(x),
                text: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            eventContexts: familyStatusEventContextTiles.map((x) => ({
                value: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            types: familyStatusTypeTiles.map((x) => ({
                value: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            statements: familyStatusStatementTiles.map((x) => ({
                value: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            tileid: self.getTileId(familyStatusTile),
        });

        const birthTile = self.getRawNodeValue(self.resource(), "birth");
        self.birth = ko.observable({
            date: self.getNodeValue(
                birthTile,
                "birth time span",
                "date of birth"
            ),
            mother: self.getResourceLink(
                self.getRawNodeValue(birthTile, "mother")
            ),
            motherText: self.getNodeValue(birthTile, "mother"),
            father: self.getResourceLink(
                self.getRawNodeValue(birthTile, "father")
            ),
            fatherText: self.getNodeValue(birthTile, "father"),
            place: self.getNodeValue(
                birthTile,
                "place of birth",
                "birthplace",
                "birth place"
            ),
            during: self.getResourceLink(
                self.getRawNodeValue(birthTile, "birth_during")
            ),
            duringText: self.getNodeValue(birthTile, "birth_during"),
            label: self.getNodeValue(birthTile, "birth_label"),
            location: self.getResourceLink(
                self.getRawNodeValue(birthTile, "birth_location")
            ),
            locationText: self.getNodeValue(birthTile, "birth_location"),
            source: self.getResourceLink(
                self.getRawNodeValue(birthTile, "birth_source")
            ),
            sourceText: self.getNodeValue(birthTile, "birth_source"),
            type: self.getNodeValue(birthTile, "birth_type"),
            ...self.getIdentifierNameStatementTimeTree(birthTile, "birth"),
            tileid: self.getTileId(birthTile),
        });

        const deathTile = self.getRawNodeValue(self.resource(), "death");
        self.death = ko.observable({
            date: self.getNodeValue(
                deathTile,
                "death time span",
                "date of death"
            ),
            place: self.getNodeValue(deathTile, "deathplace", "death place"),
            placeType: self.getNodeValue(
                deathTile,
                "deathplace",
                "death place type"
            ),
            placeMetatype: self.getNodeValue(
                deathTile,
                "deathplace",
                "death place type",
                "death place metatype"
            ),
            during: self.getResourceLink(
                self.getRawNodeValue(deathTile, "death_during")
            ),
            duringText: self.getNodeValue(deathTile, "death_during"),
            label: self.getNodeValue(deathTile, "death_label"),
            location: self.getResourceLink(
                self.getRawNodeValue(deathTile, "death_location")
            ),
            locationText: self.getNodeValue(deathTile, "death_location"),
            source: self.getResourceLink(
                self.getRawNodeValue(deathTile, "death_source")
            ),
            sourceText: self.getNodeValue(deathTile, "death_source"),
            type: self.getNodeValue(deathTile, "death_type"),
            ...self.getIdentifierNameStatementTimeTree(deathTile, "death"),
            tileid: self.getTileId(deathTile),
        });

        self.sourceReferenceWorks = ko.observableArray();
        const rawSourceReferenceWork = self.getRawNodeValue(
            self.resource(),
            "source reference work"
        );
        const sourceReferenceWorkTiles = rawSourceReferenceWork
            ? Array.isArray(rawSourceReferenceWork)
                ? rawSourceReferenceWork
                : [rawSourceReferenceWork]
            : [];
        self.sourceReferenceWorks(
            sourceReferenceWorkTiles.map((x) => ({
                link: self.getResourceLink(x),
                text: self.getNodeValue(x),
                tileid: self.getTileId(x),
            }))
        );

        self.culturalAffiliations = ko.observableArray();
        const culturalAffiliationNode = self.getRawNodeValue(
            self.resource(),
            "cultural affiliation"
        );
        const culturalAffiliationTiles = culturalAffiliationNode
            ? Array.isArray(culturalAffiliationNode)
                ? culturalAffiliationNode
                : [culturalAffiliationNode]
            : undefined;
        if (culturalAffiliationTiles) {
            self.culturalAffiliations(
                culturalAffiliationTiles.map((x) => {
                    const rawIwi = self.getRawNodeValue(x, "iwi");
                    const iwi = (
                        Array.isArray(rawIwi)
                            ? rawIwi
                            : rawIwi
                              ? [rawIwi]
                              : []
                    ).map((i) => self.getNodeValue(i));

                    const rawHapu = self.getRawNodeValue(x, {
                        testPaths: [["hapū"], ["hapu"]],
                    });
                    const hapu = (
                        Array.isArray(rawHapu)
                            ? rawHapu
                            : rawHapu
                              ? [rawHapu]
                              : []
                    ).map((h) => self.getNodeValue(h));

                    const tileid = self.getTileId(x);
                    return { iwi, hapu, tileid };
                })
            );
        }

        self.identifiers = ko.observableArray();
        const identifierNode = self.getRawNodeValue(
            self.resource(),
            "identifier"
        );
        const identifierTiles = identifierNode
            ? Array.isArray(identifierNode)
                ? identifierNode
                : [identifierNode]
            : undefined;
        if (identifierTiles) {
            self.identifiers(
                identifierTiles.map((x) => {
                    const content = self.getNodeValue(
                        x,
                        "identifier_content"
                    );
                    const label = self.getNodeValue(x, "identifier_label");
                    const type = self.getNodeValue(x, "identifier_type");
                    const source = self.getResourceLink(
                        self.getRawNodeValue(x, "identifier_source")
                    );
                    const sourceText = self.getNodeValue(
                        x,
                        "identifier_source"
                    );
                    const tileid = self.getTileId(x);

                    const rawAttributeAssignments = self.getRawNodeValue(
                        x,
                        "identifier_attribute assignment"
                    );
                    const attributeAssignments = (
                        Array.isArray(rawAttributeAssignments)
                            ? rawAttributeAssignments
                            : rawAttributeAssignments
                              ? [rawAttributeAssignments]
                              : []
                    ).map((aa) => {
                        const mapNameLike = (raw, prefix) =>
                            (Array.isArray(raw)
                                ? raw
                                : raw
                                  ? [raw]
                                  : []
                            ).map((n) => ({
                                content: self.getNodeValue(
                                    n,
                                    `${prefix}_content`
                                ),
                                label: self.getNodeValue(n, `${prefix}_label`),
                                language: self.getNodeValue(
                                    n,
                                    `${prefix}_language`
                                ),
                                type: self.getNodeValue(n, `${prefix}_type`),
                                source: self.getResourceLink(
                                    self.getRawNodeValue(
                                        n,
                                        `${prefix}_source`
                                    )
                                ),
                                sourceText: self.getNodeValue(
                                    n,
                                    `${prefix}_source`
                                ),
                            }));

                        const rawAaNames = self.getRawNodeValue(
                            aa,
                            "identifier_attribute assignment _name"
                        );
                        const aaNames = mapNameLike(
                            rawAaNames,
                            "identifier_attribute assignment _name"
                        );

                        const rawAaStatements = self.getRawNodeValue(
                            aa,
                            "identifier_attribute assignment _statement"
                        );
                        const aaStatements = (
                            Array.isArray(rawAaStatements)
                                ? rawAaStatements
                                : rawAaStatements
                                  ? [rawAaStatements]
                                  : []
                        ).map((s) => ({
                            content: self.getNodeValue(
                                s,
                                "identifier_attribute assignment _content"
                            ),
                            label: self.getNodeValue(
                                s,
                                "identifier_attribute assignment _statement_label"
                            ),
                            language: self.getNodeValue(
                                s,
                                "identifier_attribute assignment _language"
                            ),
                            type: self.getNodeValue(
                                s,
                                "identifier_attribute assignment _type"
                            ),
                            source: self.getResourceLink(
                                self.getRawNodeValue(
                                    s,
                                    "identifier_attribute assignment _source"
                                )
                            ),
                            sourceText: self.getNodeValue(
                                s,
                                "identifier_attribute assignment _source"
                            ),
                            names: mapNameLike(
                                self.getRawNodeValue(
                                    s,
                                    "identifier_attribute assignment _name"
                                ),
                                "identifier_attribute assignment _name"
                            ),
                        }));

                        const rawTimeSpans = self.getRawNodeValue(
                            aa,
                            "identifier_attribute assignment _timespan"
                        );
                        const timeSpans = (
                            Array.isArray(rawTimeSpans)
                                ? rawTimeSpans
                                : rawTimeSpans
                                  ? [rawTimeSpans]
                                  : []
                        ).map((t) => {
                            const tsNames = mapNameLike(
                                self.getRawNodeValue(
                                    t,
                                    "identifier_attribute assignment _timespan_name"
                                ),
                                "identifier_attribute assignment _timespan_name"
                            );

                            const rawTsStatements = self.getRawNodeValue(
                                t,
                                "identifier_attribute assignment _timespan_statement"
                            );
                            const tsStatements = (
                                Array.isArray(rawTsStatements)
                                    ? rawTsStatements
                                    : rawTsStatements
                                      ? [rawTsStatements]
                                      : []
                            ).map((s) => ({
                                content: self.getNodeValue(
                                    s,
                                    "identifier_attribute assignment _timespan_statement_content"
                                ),
                                label: self.getNodeValue(
                                    s,
                                    "identifier_attribute assignment _timespan_statement_label"
                                ),
                                language: self.getNodeValue(
                                    s,
                                    "identifier_attribute assignment _timespan_statement_language"
                                ),
                                type: self.getNodeValue(
                                    s,
                                    "identifier_attribute assignment _timespan_statement_type"
                                ),
                                source: self.getResourceLink(
                                    self.getRawNodeValue(
                                        s,
                                        "identifier_attribute assignment _timespan_statement_source"
                                    )
                                ),
                                sourceText: self.getNodeValue(
                                    s,
                                    "identifier_attribute assignment _timespan_statement_source"
                                ),
                                names: mapNameLike(
                                    self.getRawNodeValue(
                                        s,
                                        "identifier_attribute assignment _timespan_statement_name"
                                    ),
                                    "identifier_attribute assignment _timespan_statement_name"
                                ),
                            }));

                            const rawDurations = self.getRawNodeValue(
                                t,
                                "identifier_attribute assignment _timespan_duration"
                            );
                            const durations = (
                                Array.isArray(rawDurations)
                                    ? rawDurations
                                    : rawDurations
                                      ? [rawDurations]
                                      : []
                            ).map((d) => ({
                                label: self.getNodeValue(
                                    d,
                                    "identifier_attribute assignment _timespan_duration_label"
                                ),
                                type: self.getNodeValue(
                                    d,
                                    "identifier_attribute assignment _timespan_duration_type"
                                ),
                                unit: self.getNodeValue(
                                    d,
                                    "identifier_attribute assignment _timespan_duration_unit"
                                ),
                                value: self.getNodeValue(
                                    d,
                                    "identifier_attribute assignment _timespan_duration_value"
                                ),
                                lowestPossibleValue: self.getNodeValue(
                                    d,
                                    "identifier_attribute assignment _timespan_duration_lowest possible value"
                                ),
                                highestPossibleValue: self.getNodeValue(
                                    d,
                                    "identifier_attribute assignment _timespan_duration_highest possible value"
                                ),
                                source: self.getResourceLink(
                                    self.getRawNodeValue(
                                        d,
                                        "identifier_attribute assignment _timespan_duration_source"
                                    )
                                ),
                                sourceText: self.getNodeValue(
                                    d,
                                    "identifier_attribute assignment _timespan_duration_source"
                                ),
                                names: mapNameLike(
                                    self.getRawNodeValue(
                                        d,
                                        "identifier_attribute assignment _timespan_duration_name"
                                    ),
                                    "identifier_attribute assignment _timespan_duration_name"
                                ),
                            }));

                            return {
                                label: self.getNodeValue(
                                    t,
                                    "identifier_attribute assignment _timespan_label"
                                ),
                                type: self.getNodeValue(
                                    t,
                                    "identifier_attribute assignment _timespan_type"
                                ),
                                beginOfBegin: self.getNodeValue(
                                    t,
                                    "identifier_attribute assignment _timespan_begin of the begin"
                                ),
                                beginOfEnd: self.getNodeValue(
                                    t,
                                    "identifier_attribute assignment _timespan_begin of the end"
                                ),
                                endOfBegin: self.getNodeValue(
                                    t,
                                    "identifier_attribute assignment _timespan_end of the begin"
                                ),
                                endOfEnd: self.getNodeValue(
                                    t,
                                    "identifier_attribute assignment _timespan_end of the end"
                                ),
                                names: tsNames,
                                statements: tsStatements,
                                durations,
                            };
                        });

                        return {
                            label: self.getNodeValue(
                                aa,
                                "identifier_attribute assignment _label"
                            ),
                            classification: self.getNodeValue(
                                aa,
                                "identifier_attribute assignment _classification"
                            ),
                            assigner: self.getNodeValue(
                                aa,
                                "identifier_attribute assignment _assigner"
                            ),
                            assignerLink: self.getResourceLink(
                                self.getRawNodeValue(
                                    aa,
                                    "identifier_attribute assignment _assigner"
                                )
                            ),
                            names: aaNames,
                            statements: aaStatements,
                            timeSpans,
                        };
                    });

                    return {
                        content,
                        label,
                        type,
                        source,
                        sourceText,
                        attributeAssignments,
                        tileid,
                    };
                })
            );
        }

        self.recordRegistryMemberships = ko.observableArray();
        const recordRegistryNode = self.getRawNodeValue(
            self.resource(),
            "record and registry membership"
        );
        const recordRegistryTiles = recordRegistryNode
            ? Array.isArray(recordRegistryNode)
                ? recordRegistryNode
                : [recordRegistryNode]
            : undefined;
        if (recordRegistryTiles) {
            self.recordRegistryMemberships(
                recordRegistryTiles.map((x) => {
                    const innerNode = self.getRawNodeValue(
                        x,
                        "record and registry membership"
                    );
                    const registryNode = self.getRawNodeValue(
                        innerNode,
                        "record or registry"
                    );
                    const registry = self.getResourceLink(registryNode);
                    const registryText = self.getNodeValue(registryNode);
                    const tileid = self.getTileId(x);

                    const rawXrefs = self.getRawNodeValue(
                        innerNode,
                        "external cross references"
                    );
                    const externalCrossReferences = (
                        Array.isArray(rawXrefs)
                            ? rawXrefs
                            : rawXrefs
                              ? [rawXrefs]
                              : []
                    ).map((e) => ({
                        url: self.getNodeValue(e, "url"),
                        description: self.getNodeValue(
                            e,
                            "external cross reference notes",
                            "external cross reference description"
                        ),
                        descriptionType: self.getNodeValue(
                            e,
                            "external cross reference notes",
                            "external cross reference description type"
                        ),
                        descriptionMetatype: self.getNodeValue(
                            e,
                            "external cross reference notes",
                            "external cross reference description type",
                            "external cross reference description metatype"
                        ),
                        source: self.getNodeValue(
                            e,
                            "external cross reference source"
                        ),
                        number: self.getNodeValue(
                            e,
                            "external cross reference number"
                        ),
                    }));

                    const rawPeriods = self.getRawNodeValue(
                        innerNode,
                        "period of membership"
                    );
                    const periodsOfMembership = (
                        Array.isArray(rawPeriods)
                            ? rawPeriods
                            : rawPeriods
                              ? [rawPeriods]
                              : []
                    ).map((p) => ({
                        startDate: self.getNodeValue(p, "start date"),
                        endDate: self.getNodeValue(p, "end date"),
                        dateQualifier: self.getNodeValue(
                            p,
                            "date qualifier"
                        ),
                        dateQualifierMetatype: self.getNodeValue(
                            p,
                            "date qualifier",
                            "date qualifier metatype"
                        ),
                        displayDate: self.getNodeValue(p, "display date"),
                    }));

                    const rawSignOffs = self.getRawNodeValue(
                        innerNode,
                        "sign off"
                    );
                    const signOffs = (
                        Array.isArray(rawSignOffs)
                            ? rawSignOffs
                            : rawSignOffs
                              ? [rawSignOffs]
                              : []
                    ).map((s) => ({
                        statusType: self.getNodeValue(s, "status type"),
                        statusMetatype: self.getNodeValue(
                            s,
                            "status type",
                            "status metatype"
                        ),
                        approvedByRoleType: self.getNodeValue(
                            s,
                            "approved by",
                            "approved by role type"
                        ),
                        approvedByMetatype: self.getNodeValue(
                            s,
                            "approved by",
                            "approved by role type",
                            "approved by metatype"
                        ),
                        approvedByValue: self.getNodeValue(
                            s,
                            "approved by",
                            "approved by value"
                        ),
                        approvedByValueLink: self.getResourceLink(
                            self.getRawNodeValue(
                                s,
                                "approved by",
                                "approved by value"
                            )
                        ),
                        inputDateValue: self.getNodeValue(
                            s,
                            "input date",
                            "input date value"
                        ),
                        inputDateQualifier: self.getNodeValue(
                            s,
                            "input date",
                            "input date qualifier"
                        ),
                        inputDateQualifierMetatype: self.getNodeValue(
                            s,
                            "input date",
                            "input date qualifier",
                            "input date qualifier metatype"
                        ),
                        referenceNumberType: self.getNodeValue(
                            s,
                            "references",
                            "reference number type"
                        ),
                        referenceNumberMetatype: self.getNodeValue(
                            s,
                            "references",
                            "reference number type",
                            "reference number metatype"
                        ),
                        referenceNumber: self.getNodeValue(
                            s,
                            "references",
                            "reference number"
                        ),
                        inputByValue: self.getNodeValue(
                            s,
                            "input by",
                            "input by value"
                        ),
                        inputByValueLink: self.getResourceLink(
                            self.getRawNodeValue(
                                s,
                                "input by",
                                "input by value"
                            )
                        ),
                        inputByRoleType: self.getNodeValue(
                            s,
                            "input by",
                            "input by role type"
                        ),
                        inputByRoleMetatype: self.getNodeValue(
                            s,
                            "input by",
                            "input by role type",
                            "input by role metatype"
                        ),
                        approvedDateValue: self.getNodeValue(
                            s,
                            "approved date",
                            "approved date value"
                        ),
                        approvedDateQualifier: self.getNodeValue(
                            s,
                            "approved date",
                            "approved date qualifier"
                        ),
                        approvedDateQualifierMetatype: self.getNodeValue(
                            s,
                            "approved date",
                            "approved date qualifier",
                            "approved date qualifier metatype"
                        ),
                    }));

                    return {
                        registry,
                        registryText,
                        externalCrossReferences,
                        periodsOfMembership,
                        signOffs,
                        tileid,
                    };
                })
            );
        }

        self.fieldAssessmentData = ko.observable({
            sections: [
                {
                    title: "Associated Field Assessment",
                    card: self.cards?.["associated field assessment"],
                    data: [
                        {
                            key: "Associated Field Assessment",
                            value: self.getRawNodeValue(
                                self.resource(),
                                "associated field assessment"
                            ),
                            type: "resource",
                            card: self.cards?.["associated field assessment"],
                        },
                    ],
                },
            ],
        });

        self.professionActivities = ko.observableArray();
        const professionActivityNode = self.getRawNodeValue(
            self.resource(),
            "profession activity"
        );
        const professionActivityTiles = professionActivityNode
            ? Array.isArray(professionActivityNode)
                ? professionActivityNode
                : [professionActivityNode]
            : undefined;
        if (professionActivityTiles) {
            self.professionActivities(
                professionActivityTiles.map((x) => {
                    const label = self.getNodeValue(
                        x,
                        "profession activity_label"
                    );
                    const type = self.getNodeValue(
                        x,
                        "profession activity_type"
                    );
                    const technique = self.getNodeValue(
                        x,
                        "profession activity_technique"
                    );
                    const during = self.getNodeValue(
                        x,
                        "profession activity_during"
                    );
                    const duringLink = self.getResourceLink(
                        self.getRawNodeValue(x, "profession activity_during")
                    );
                    const location = self.getNodeValue(
                        x,
                        "profession activity_location"
                    );
                    const locationLink = self.getResourceLink(
                        self.getRawNodeValue(
                            x,
                            "profession activity_location"
                        )
                    );
                    const source = self.getNodeValue(
                        x,
                        "profession activity_source"
                    );
                    const sourceLink = self.getResourceLink(
                        self.getRawNodeValue(x, "profession activity_source")
                    );
                    const usedObject = self.getNodeValue(
                        x,
                        "profession activity_used object"
                    );
                    const usedObjectLink = self.getResourceLink(
                        self.getRawNodeValue(
                            x,
                            "profession activity_used object"
                        )
                    );
                    const influence = self.getNodeValue(
                        x,
                        "profession activity_influence"
                    );
                    const influenceLink = self.getResourceLink(
                        self.getRawNodeValue(
                            x,
                            "profession activity_influence"
                        )
                    );
                    const tileid = self.getTileId(x);

                    const rawIdentifiers = self.getRawNodeValue(
                        x,
                        "profession activity_identifier"
                    );
                    const identifiers = (
                        Array.isArray(rawIdentifiers)
                            ? rawIdentifiers
                            : rawIdentifiers
                              ? [rawIdentifiers]
                              : []
                    ).map((i) => ({
                        content: self.getNodeValue(
                            i,
                            "profession activity_identifier_content"
                        ),
                        label: self.getNodeValue(
                            i,
                            "profession activity_identifier_label"
                        ),
                        type: self.getNodeValue(
                            i,
                            "profession activity_identifier_type"
                        ),
                        source: self.getResourceLink(
                            self.getRawNodeValue(
                                i,
                                "profession activity_identifier_source"
                            )
                        ),
                        sourceText: self.getNodeValue(
                            i,
                            "profession activity_identifier_source"
                        ),
                    }));

                    const rawNames = self.getRawNodeValue(
                        x,
                        "profession activity_name"
                    );
                    const names = (
                        Array.isArray(rawNames)
                            ? rawNames
                            : rawNames
                              ? [rawNames]
                              : []
                    ).map((n) => ({
                        content: self.getNodeValue(
                            n,
                            "profession activity_name_content"
                        ),
                        label: self.getNodeValue(
                            n,
                            "profession activity_name_label"
                        ),
                        language: self.getNodeValue(
                            n,
                            "profession activity_name_language"
                        ),
                        type: self.getNodeValue(
                            n,
                            "profession activity_name_type"
                        ),
                        source: self.getResourceLink(
                            self.getRawNodeValue(
                                n,
                                "profession activity_name_source"
                            )
                        ),
                        sourceText: self.getNodeValue(
                            n,
                            "profession activity_name_source"
                        ),
                    }));

                    const rawStatements = self.getRawNodeValue(
                        x,
                        "profession activity_statement"
                    );
                    const statements = (
                        Array.isArray(rawStatements)
                            ? rawStatements
                            : rawStatements
                              ? [rawStatements]
                              : []
                    ).map((s) => {
                        const rawStatementNames = self.getRawNodeValue(
                            s,
                            "profession activity_statement_name"
                        );
                        const statementNames = (
                            Array.isArray(rawStatementNames)
                                ? rawStatementNames
                                : rawStatementNames
                                  ? [rawStatementNames]
                                  : []
                        ).map((n) => ({
                            content: self.getNodeValue(
                                n,
                                "profession activity_statement_name_content"
                            ),
                            label: self.getNodeValue(
                                n,
                                "profession activity_statement_name_label"
                            ),
                            language: self.getNodeValue(
                                n,
                                "profession activity_statement_name_language"
                            ),
                            type: self.getNodeValue(
                                n,
                                "profession activity_statement_name_type"
                            ),
                            source: self.getResourceLink(
                                self.getRawNodeValue(
                                    n,
                                    "profession activity_statement_name_source"
                                )
                            ),
                            sourceText: self.getNodeValue(
                                n,
                                "profession activity_statement_name_source"
                            ),
                        }));

                        return {
                            content: self.getNodeValue(
                                s,
                                "profession activity_statement_content"
                            ),
                            label: self.getNodeValue(
                                s,
                                "profession activity_statement_label"
                            ),
                            language: self.getNodeValue(
                                s,
                                "profession activity_statement_language"
                            ),
                            type: self.getNodeValue(
                                s,
                                "profession activity_statement_type"
                            ),
                            source: self.getResourceLink(
                                self.getRawNodeValue(
                                    s,
                                    "profession activity_statement_source"
                                )
                            ),
                            sourceText: self.getNodeValue(
                                s,
                                "profession activity_statement_source"
                            ),
                            names: statementNames,
                        };
                    });

                    const rawTimes = self.getRawNodeValue(
                        x,
                        "profession activity_time"
                    );
                    const times = (
                        Array.isArray(rawTimes)
                            ? rawTimes
                            : rawTimes
                              ? [rawTimes]
                              : []
                    ).map((t) => {
                        const rawTimeNames = self.getRawNodeValue(
                            t,
                            "profession activity_time_name"
                        );
                        const timeNames = (
                            Array.isArray(rawTimeNames)
                                ? rawTimeNames
                                : rawTimeNames
                                  ? [rawTimeNames]
                                  : []
                        ).map((n) => ({
                            content: self.getNodeValue(
                                n,
                                "profession activity_time_name_content"
                            ),
                            label: self.getNodeValue(
                                n,
                                "profession activity_time_name_label"
                            ),
                            language: self.getNodeValue(
                                n,
                                "profession activity_time_name_language"
                            ),
                            type: self.getNodeValue(
                                n,
                                "profession activity_time_name_type"
                            ),
                            source: self.getResourceLink(
                                self.getRawNodeValue(
                                    n,
                                    "profession activity_time_name_source"
                                )
                            ),
                            sourceText: self.getNodeValue(
                                n,
                                "profession activity_time_name_source"
                            ),
                        }));

                        const rawDurations = self.getRawNodeValue(
                            t,
                            "profession activity_time_duration"
                        );
                        const durations = (
                            Array.isArray(rawDurations)
                                ? rawDurations
                                : rawDurations
                                  ? [rawDurations]
                                  : []
                        ).map((d) => {
                            const rawDurationNames = self.getRawNodeValue(
                                d,
                                "profession activity_time_duration_name"
                            );
                            const durationNames = (
                                Array.isArray(rawDurationNames)
                                    ? rawDurationNames
                                    : rawDurationNames
                                      ? [rawDurationNames]
                                      : []
                            ).map((n) => ({
                                content: self.getNodeValue(
                                    n,
                                    "profession activity_time_duration_name_content"
                                ),
                                label: self.getNodeValue(
                                    n,
                                    "profession activity_time_duration_name_label"
                                ),
                                language: self.getNodeValue(
                                    n,
                                    "profession activity_time_duration_name_language"
                                ),
                                type: self.getNodeValue(
                                    n,
                                    "profession activity_time_duration_name_type"
                                ),
                                source: self.getResourceLink(
                                    self.getRawNodeValue(
                                        n,
                                        "profession activity_time_duration_name_source"
                                    )
                                ),
                                sourceText: self.getNodeValue(
                                    n,
                                    "profession activity_time_duration_name_source"
                                ),
                            }));

                            return {
                                label: self.getNodeValue(
                                    d,
                                    "profession activity_time_duration_label"
                                ),
                                type: self.getNodeValue(
                                    d,
                                    "profession activity_time_duration_type"
                                ),
                                unit: self.getNodeValue(
                                    d,
                                    "profession activity_time_duration_unit"
                                ),
                                value: self.getNodeValue(
                                    d,
                                    "profession activity_time_duration_value"
                                ),
                                lowestPossibleValue: self.getNodeValue(
                                    d,
                                    "profession activity_time_duration_lowest possible value"
                                ),
                                highestPossibleValue: self.getNodeValue(
                                    d,
                                    "profession activity_time_duration_highest possible value"
                                ),
                                source: self.getResourceLink(
                                    self.getRawNodeValue(
                                        d,
                                        "profession activity_time_duration_source"
                                    )
                                ),
                                sourceText: self.getNodeValue(
                                    d,
                                    "profession activity_time_duration_source"
                                ),
                                names: durationNames,
                            };
                        });

                        return {
                            label: self.getNodeValue(
                                t,
                                "profession activity_time_label"
                            ),
                            type: self.getNodeValue(
                                t,
                                "profession activity_time_type"
                            ),
                            beginOfBegin: self.getNodeValue(
                                t,
                                "profession activity_time_begin of the begin"
                            ),
                            beginOfEnd: self.getNodeValue(
                                t,
                                "profession activity_time_begin of the end"
                            ),
                            endOfBegin: self.getNodeValue(
                                t,
                                "profession activity_time_end of the begin"
                            ),
                            endOfEnd: self.getNodeValue(
                                t,
                                "profession activity_time_end of the end"
                            ),
                            names: timeNames,
                            durations,
                        };
                    });

                    return {
                        label,
                        type,
                        technique,
                        during,
                        duringLink,
                        location,
                        locationLink,
                        source,
                        sourceLink,
                        usedObject,
                        usedObjectLink,
                        influence,
                        influenceLink,
                        identifiers,
                        names,
                        statements,
                        times,
                        tileid,
                    };
                })
            );
        }
    },
    template: PersonTemplate,
});
