import $ from "jquery";
import _ from "underscore";
import ko from "knockout";
import arches from "arches";
import resourceUtils from "utils/resource";
import reportUtils from "utils/report";
import MonumentTemplate from "templates/views/components/reports/monument.htm";
import "views/components/reports/scenes/name";
import "views/components/reports/scenes/json";
import "views/components/reports/scenes/default";
import "bindings/reports";

export default ko.components.register("monument-report", {
    viewModel: function (params) {
        var self = this;
        params.configKeys = ["tabs", "activeTabIndex"];
        this.configForm = params.configForm || false;
        this.configType = params.configType || "header";

        Object.assign(self, reportUtils);
        self.sections = [
            { id: "name", title: "Names and Identifiers" },
            { id: "description", title: "Descriptions and Citations" },
            { id: "classifications", title: "Classifications and Dating" },
            { id: "location", title: "Location Data" },
            { id: "protection", title: "Designation and Protection Status" },
            { id: "assessments", title: "Assessments" },
            { id: "images", title: "Images" },
            { id: "people", title: "Associated People and Organizations" },
            { id: "resources", title: "Associated Resources" },
            { id: "json", title: "JSON" },
        ];

        self.reportMetadata = ko.observable(params.report?.report_json);
        self.resource = ko.observable(self.reportMetadata()?.resource);
        self.displayname = ko.observable(
            ko.unwrap(self.reportMetadata)?.displayname
        );
        self.activeSection = ko.observable("name");

        self.visible = {
            classification: ko.observable(true),
            appellativeStatus: ko.observable(true),
            whakapapaStatus: ko.observable(true),
            sourceReferenceWork: ko.observable(true),
            recordRegistry: ko.observable(true),
            functionStatus: ko.observable(true),
            custodialStatus: ko.observable(true),
        };

        self.classificationTableConfig = {
            ...self.defaultTableConfig,
            columns: Array(6).fill(null),
        };

        self.appellativeStatusTableConfig = {
            ...self.defaultTableConfig,
            columns: Array(7).fill(null),
        };

        self.whakapapaStatusTableConfig = {
            ...self.defaultTableConfig,
            columns: Array(5).fill(null),
        };

        self.sourceReferenceWorkTableConfig = {
            ...self.defaultTableConfig,
            columns: Array(2).fill(null),
        };

        self.recordRegistryTableConfig = {
            ...self.defaultTableConfig,
            columns: Array(5).fill(null),
        };

        self.functionStatusTableConfig = {
            ...self.defaultTableConfig,
            columns: Array(6).fill(null),
        };

        self.custodialStatusTableConfig = {
            ...self.defaultTableConfig,
            columns: Array(6).fill(null),
        };

        self.nameDataConfig = {
            name: "heritage place names",
            nameChildren: "heritage place name",
            parent: "parent heritage place",
        };

        self.classificationDataConfig = {
            production: "construction phases",
            components: "components",
            usePhase: "use phase",
        };

        self.descriptionDataConfig = {
            citation: "bibliographic source citation",
        };

        self.peopleDataConfig = {
            people: "associated persons or groups",
        };

        self.protectionDataConfig = {
            areaAssignment: ["area assignments", "area assignment"],
            areaAssignmentSectionTitle: "Treaty Settlement Recognition Value",
            designationSectionTitle: "Local/Regional Plan Schedule Information",
        };

        self.resourceDataConfig = {
            files: "digital file(s)",
            activities: "associated activities",
            consultations: undefined,
            assets: "Associated Heritage Places, Areas and Artefacts",
            period: undefined,
            actors: undefined,
            archive: "associated archives",
            resourceinstanceid: ko.unwrap(self.reportMetadata)
                ?.resourceinstanceid,
        };

        self.nameCards = {};
        self.descriptionCards = {};
        self.classificationCards = {};
        self.scientificDateCards = {};
        self.assessmentCards = {};
        self.imagesCards = {};
        self.locationCards = {};
        self.protectionCards = {};
        self.peopleCards = {};
        self.resourcesCards = {};
        self.summary = params.summary;
        self.cards = {};

        if (params.report.cards) {
            const cards = params.report.cards;

            self.cards = self.createCardDictionary(cards);

            // "Record and Registry Membership" collides by name with an
            // unrelated nested card elsewhere in the graph, so
            // createCardDictionary's name-keyed lookup can't be trusted for
            // it; patch the dictionary entry to point at the correct
            // top-level card, found by nodegroup id instead.
            const recordRegistryCard = cards.find(
                (card) =>
                    card.nodegroupid ===
                    "66b0ce66-b0ec-5a96-a7d7-74d0084f7ba0"
            );
            if (recordRegistryCard) {
                self.cards["record and registry membership"] =
                    recordRegistryCard;
            }

            // "Function Status" also collides by name with an unrelated
            // nested card (the classification-value sub-nodegroup), so patch
            // the same way.
            const functionStatusCard = cards.find(
                (card) =>
                    card.nodegroupid ===
                    "34a98691-cc0d-58ff-b0b5-6d99079a75d8"
            );
            if (functionStatusCard) {
                self.cards["function status"] = functionStatusCard;
            }

            self.nameCards = {
                name: self.cards?.["heritage place names"],
                externalCrossReferences:
                    self.cards?.["external cross references"],
                systemReferenceNumbers:
                    self.cards?.["system reference numbers"],
                parent: self.cards?.["parent heritage place"],
            };

            self.descriptionCards = {
                descriptions: self.cards?.["descriptions"],
                citation: self.cards?.["bibliographic source citation"],
            };

            self.classificationCards = {
                // Note: these three cards were renamed at some point and no
                // longer match their own root node's name (Construction
                // Phases lives under card "Heritage Place Metatype",
                // Components under "Associated Heritage Place Construction
                // Phase", Use Phase under "Subject or Theme").
                production: self.cards?.["heritage place metatype"],
                components:
                    self.cards?.[
                        "associated heritage place construction phase"
                    ],
                usePhase: self.cards?.["subject or theme"],
            };

            self.assessmentCards = {
                scientificDate: self.cards?.["scientific date assignment"],
            };

            self.imagesCards = {
                images: self.cards?.["images"],
            };

            self.peopleCards = {
                people: self.cards?.["person or group"],
            };

            self.resourcesCards = {
                activities: self.cards?.["associated activities"],
                archive: self.cards?.["associated archives"],
                consultations: self.cards?.["associated consultations"],
                files: self.cards?.["associated digital file(s)"],
                assets: self.cards?.[
                    "associated heritage place, area or artefact"
                ],
            };

            self.locationCards = {
                location: {
                    card: self.cards?.["location data"],
                    subCards: {
                        addresses: "addresses",
                        nationalGrid: "national grid references",
                        administrativeAreas: "localities/administrative areas",
                        locationDescriptions: "location descriptions",
                        // Note: this one was also renamed and no longer
                        // matches its own root node's name (Area Assignment
                        // lives under card "Treaty Settlement Recognition
                        // Value").
                        areaAssignment: "treaty settlement recognition value",
                        landUse: "land use classification assignment",
                        locationGeometry: "geometry",
                        namedLocations: "named locations",
                    },
                },
            };

            self.protectionCards = {
                // Note: this card was also renamed and no longer matches its
                // root node's name (Designation and Protection Assignment
                // lives under card "Local/Regional Plan Schedule
                // Information").
                designations:
                    self.cards?.["local/regional plan schedule information"],
            };

            Object.assign(self.protectionCards, self.locationCards);
        }

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
            ancestors: whakapapaAncestorTiles.map((x) => ({
                ancestor: self.getResourceLink(x),
                ancestorText: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            tileid: self.getTileId(
                self.getRawNodeValue(self.resource(), "whakapapa status")
            ),
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

        const rawFunctionStatuses = self.getRawNodeValue(
            self.resource(),
            "function status",
            "function status"
        );
        const functionStatusTiles = rawFunctionStatuses
            ? Array.isArray(rawFunctionStatuses)
                ? rawFunctionStatuses
                : [rawFunctionStatuses]
            : [];

        const rawFunctionStatusHoldsFor = self.getRawNodeValue(
            self.resource(),
            "function status",
            "function status holds for"
        );
        const functionStatusHoldsForTiles = rawFunctionStatusHoldsFor
            ? Array.isArray(rawFunctionStatusHoldsFor)
                ? rawFunctionStatusHoldsFor
                : [rawFunctionStatusHoldsFor]
            : [];

        const rawFunctionStatusContext = self.getRawNodeValue(
            self.resource(),
            "function status",
            "function status context"
        );
        const functionStatusContextTiles = rawFunctionStatusContext
            ? Array.isArray(rawFunctionStatusContext)
                ? rawFunctionStatusContext
                : [rawFunctionStatusContext]
            : [];

        const rawFunctionStatusTypes = self.getRawNodeValue(
            self.resource(),
            "function status",
            "function status type"
        );
        const functionStatusTypeTiles = rawFunctionStatusTypes
            ? Array.isArray(rawFunctionStatusTypes)
                ? rawFunctionStatusTypes
                : [rawFunctionStatusTypes]
            : [];

        const rawFunctionStatusStatements = self.getRawNodeValue(
            self.resource(),
            "function status",
            "function status statement"
        );
        const functionStatusStatementTiles = rawFunctionStatusStatements
            ? Array.isArray(rawFunctionStatusStatements)
                ? rawFunctionStatusStatements
                : [rawFunctionStatusStatements]
            : [];

        self.functionStatus = ko.observable({
            ascribedRelation: self.getNodeValue(
                self.resource(),
                "function status",
                "ascribed function relation"
            ),
            contextType: self.getNodeValue(
                self.resource(),
                "function status",
                "function status context type"
            ),
            initiatingAct: self.getResourceLink(
                self.getRawNodeValue(
                    self.resource(),
                    "function status",
                    "function status initiating act"
                )
            ),
            initiatingActText: self.getNodeValue(
                self.resource(),
                "function status",
                "function status initiating act"
            ),
            terminatingAct: self.getResourceLink(
                self.getRawNodeValue(
                    self.resource(),
                    "function status",
                    "function status terminating act"
                )
            ),
            terminatingActText: self.getNodeValue(
                self.resource(),
                "function status",
                "function status terminating act"
            ),
            displayDate: self.getNodeValue(
                self.resource(),
                "function status",
                "function status timespan",
                "timespan (date)",
                "display date"
            ),
            startDate: self.getNodeValue(
                self.resource(),
                "function status",
                "function status timespan",
                "timespan (date)",
                "start date"
            ),
            endDate: self.getNodeValue(
                self.resource(),
                "function status",
                "function status timespan",
                "timespan (date)",
                "end date"
            ),
            values: functionStatusTiles.map((x) => ({
                value: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            types: functionStatusTypeTiles.map((x) => ({
                value: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            holdsFor: functionStatusHoldsForTiles.map((x) => ({
                link: self.getResourceLink(x),
                text: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            context: functionStatusContextTiles.map((x) => ({
                link: self.getResourceLink(x),
                text: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            statements: functionStatusStatementTiles.map((x) => {
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
                self.getRawNodeValue(self.resource(), "function status")
            ),
        });

        const rawCustodians = self.getRawNodeValue(
            self.resource(),
            "custodial status",
            "custodian"
        );
        const custodianTiles = rawCustodians
            ? Array.isArray(rawCustodians)
                ? rawCustodians
                : [rawCustodians]
            : [];

        const rawCustodialHoldsFor = self.getRawNodeValue(
            self.resource(),
            "custodial status",
            "custodial status holds for"
        );
        const custodialHoldsForTiles = rawCustodialHoldsFor
            ? Array.isArray(rawCustodialHoldsFor)
                ? rawCustodialHoldsFor
                : [rawCustodialHoldsFor]
            : [];

        const rawCustodialEventContext = self.getRawNodeValue(
            self.resource(),
            "custodial status",
            "custodial event context"
        );
        const custodialEventContextTiles = rawCustodialEventContext
            ? Array.isArray(rawCustodialEventContext)
                ? rawCustodialEventContext
                : [rawCustodialEventContext]
            : [];

        const rawCustodialStatusTypes = self.getRawNodeValue(
            self.resource(),
            "custodial status",
            "custodial status type"
        );
        const custodialStatusTypeTiles = rawCustodialStatusTypes
            ? Array.isArray(rawCustodialStatusTypes)
                ? rawCustodialStatusTypes
                : [rawCustodialStatusTypes]
            : [];

        const rawCustodialStatusStatements = self.getRawNodeValue(
            self.resource(),
            "custodial status",
            "custodial status statement"
        );
        const custodialStatusStatementTiles = rawCustodialStatusStatements
            ? Array.isArray(rawCustodialStatusStatements)
                ? rawCustodialStatusStatements
                : [rawCustodialStatusStatements]
            : [];

        self.custodialStatus = ko.observable({
            ascribedRelation: self.getNodeValue(
                self.resource(),
                "custodial status",
                "custodial relation"
            ),
            contextType: self.getNodeValue(
                self.resource(),
                "custodial status",
                "custodial context type"
            ),
            initiatingAct: self.getResourceLink(
                self.getRawNodeValue(
                    self.resource(),
                    "custodial status",
                    "custodial initiating declarative transfer"
                )
            ),
            initiatingActText: self.getNodeValue(
                self.resource(),
                "custodial status",
                "custodial initiating declarative transfer"
            ),
            terminatingAct: self.getResourceLink(
                self.getRawNodeValue(
                    self.resource(),
                    "custodial status",
                    "custodial terminating declarative transfer"
                )
            ),
            terminatingActText: self.getNodeValue(
                self.resource(),
                "custodial status",
                "custodial terminating declarative transfer"
            ),
            displayDate: self.getNodeValue(
                self.resource(),
                "custodial status",
                "custodial timespan",
                "timespan (date)",
                "display date"
            ),
            startDate: self.getNodeValue(
                self.resource(),
                "custodial status",
                "custodial timespan",
                "timespan (date)",
                "start date"
            ),
            endDate: self.getNodeValue(
                self.resource(),
                "custodial status",
                "custodial timespan",
                "timespan (date)",
                "end date"
            ),
            custodians: custodianTiles.map((x) => ({
                link: self.getResourceLink(x),
                text: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            types: custodialStatusTypeTiles.map((x) => ({
                value: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            holdsFor: custodialHoldsForTiles.map((x) => ({
                link: self.getResourceLink(x),
                text: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            eventContext: custodialEventContextTiles.map((x) => ({
                link: self.getResourceLink(x),
                text: self.getNodeValue(x),
                tileid: self.getTileId(x),
            })),
            statements: custodialStatusStatementTiles.map((x) => {
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
                self.getRawNodeValue(self.resource(), "custodial status")
            ),
        });

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

        self.recordTypeData = ko.observable({
            sections: [
                {
                    title: "Record Type",
                    card: self.cards?.["record type"],
                    data: [
                        {
                            key: "Record Type",
                            value: self.getNodeValue(
                                self.resource(),
                                "record type"
                            ),
                            type: "kv",
                            card: self.cards?.["record type"],
                        },
                    ],
                },
            ],
        });

        self.auditMetadataData = ko.observable({
            sections: [
                {
                    title: "Audit Metadata",
                    card: self.cards?.["audit metadata"],
                    data: [
                        {
                            key: "Creator Name",
                            value: self.getNodeValue(
                                self.resource(),
                                "audit metadata",
                                "audit creation",
                                "creator",
                                "creator names",
                                "creator name"
                            ),
                            type: "kv",
                            card: self.cards?.["audit metadata"],
                        },
                        {
                            key: "Creation Date",
                            value: self.getNodeValue(
                                self.resource(),
                                "audit metadata",
                                "audit creation",
                                "creation timespan",
                                "creation date"
                            ),
                            type: "kv",
                            card: self.cards?.["audit metadata"],
                        },
                        {
                            key: "Creation End Date",
                            value: self.getNodeValue(
                                self.resource(),
                                "audit metadata",
                                "audit creation",
                                "creation timespan",
                                "creation end date"
                            ),
                            type: "kv",
                            card: self.cards?.["audit metadata"],
                        },
                        {
                            key: "Creation Date Qualifier",
                            value: self.getNodeValue(
                                self.resource(),
                                "audit metadata",
                                "audit creation",
                                "creation timespan",
                                "creation date qualifier"
                            ),
                            type: "kv",
                            card: self.cards?.["audit metadata"],
                        },
                        {
                            key: "Updater Name",
                            value: self.getNodeValue(
                                self.resource(),
                                "audit metadata",
                                "audit update",
                                "updater",
                                "updater names",
                                "updater name"
                            ),
                            type: "kv",
                            card: self.cards?.["audit metadata"],
                        },
                        {
                            key: "Date of Last Update",
                            value: self.getNodeValue(
                                self.resource(),
                                "audit metadata",
                                "audit update",
                                "update timespan",
                                "date of last update"
                            ),
                            type: "kv",
                            card: self.cards?.["audit metadata"],
                        },
                        {
                            key: "Update End Date",
                            value: self.getNodeValue(
                                self.resource(),
                                "audit metadata",
                                "audit update",
                                "update timespan",
                                "update end date"
                            ),
                            type: "kv",
                            card: self.cards?.["audit metadata"],
                        },
                        {
                            key: "Update Date Qualifier",
                            value: self.getNodeValue(
                                self.resource(),
                                "audit metadata",
                                "audit update",
                                "update timespan",
                                "update date qualifier"
                            ),
                            type: "kv",
                            card: self.cards?.["audit metadata"],
                        },
                        {
                            key: "Validation",
                            value: self.getNodeValue(
                                self.resource(),
                                "audit metadata",
                                "validation"
                            ),
                            type: "kv",
                            card: self.cards?.["audit metadata"],
                        },
                        {
                            key: "Audit Note",
                            value: self.getNodeValue(
                                self.resource(),
                                "audit metadata",
                                "audit notes",
                                "audit note"
                            ),
                            type: "kv",
                            card: self.cards?.["audit metadata"],
                        },
                        {
                            key: "Audit Notes Type",
                            value: self.getNodeValue(
                                self.resource(),
                                "audit metadata",
                                "audit notes",
                                "audit notes type"
                            ),
                            type: "kv",
                            card: self.cards?.["audit metadata"],
                        },
                    ],
                },
            ],
        });
    },
    template: MonumentTemplate,
});
