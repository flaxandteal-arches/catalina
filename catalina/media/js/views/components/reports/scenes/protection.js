import _ from "underscore";
import ko from "knockout";
import arches from "arches";
import reportUtils from "utils/report";
import ProtectionTemplate from "templates/views/components/reports/scenes/protection.htm";
import "bindings/datatable";
import "bindings/reports";
import "views/components/reports/scenes/map";

export default ko.components.register(
    "views/components/reports/scenes/protection",
    {
        viewModel: function (params) {
            const self = this;
            Object.assign(self, reportUtils);

            self.dataConfig = {
                location: ["location data"],
                protection: "designation and protection assignment",
                landUse: "land use classification assignment",
                areaAssignment: ["area assignments", "area assignment"],
                recordRegistryMembership: "record and registry membership",
                custodialStatus: "custodial status",
            };

            self.cards = params.cards || {};
            self.selectedGeometry = params.selectedGeometry || ko.observable();
            self.edit = params.editTile || self.editTile;
            self.delete = params.deleteTile || self.deleteTile;
            self.add = params.addTile || self.addNewTile;
            self.visible = {
                geospatial: ko.observable(true),
                designations: ko.observable(true),
                map: ko.observable(true),
                areaAssignment: ko.observable(true),
                landUse: ko.observable(true),
                recordRegistryMembership: ko.observable(true),
                custodialStatus: ko.observable(true),
            };

            self.recordRegistryMemberships = ko.observableArray();

            self.custodialStatusExists = ko.observable(false);
            self.csTileid = ko.observable();
            self.csType = ko.observable("--");
            self.csContextType = ko.observable("--");
            self.csRelation = ko.observable("--");
            self.csInitiatingTransfer = ko.observable();
            self.csTerminatingTransfer = ko.observable();
            self.csCustodians = ko.observableArray();
            self.csHoldsFor = ko.observableArray();
            self.csContext = ko.observableArray();
            self.csNotes = ko.observableArray();
            Object.assign(self.dataConfig, params.dataConfig || {});

            self.designationSectionTitle = ko.observable(
                self.dataConfig.designationSectionTitle ||
                    "Designation/Protection Details"
            );
            self.areaAssignmentSectionTitle = ko.observable(
                self.dataConfig.areaAssignmentSectionTitle ||
                    "Area Assignment"
            );

            self.areaAssignmentsTableConfig = {
                ...self.defaultTableConfig,
                columns: Array(9).fill(null),
            };

            self.landUseTableConfig = {
                ...self.defaultTableConfig,
                columns: Array(7).fill(null),
            };

            self.designationTableConfig = {
                ...this.defaultTableConfig,
                columns: Array(14).fill(null),
            };

            self.currentDesignation = ko.observable();
            self.selectedGeometry = ko.observable();
            self.locationRoot = undefined;
            self.coordinateData = ko.observable();

            self.geojson = ko.observable();
            self.areaAssignment = ko.observableArray();
            self.landUseClassification = ko.observableArray();
            self.designations = ko.observableArray();

            const asArray = (rawValue) =>
                rawValue ? (Array.isArray(rawValue) ? rawValue : [rawValue]) : [];

            // utitility function - checks whether at least one observable (or array object)
            // has a set value (used to determine whether a section is visible)
            self.observableValueSet = (...observables) => {
                for (const observable of observables) {
                    if (ko.isObservable(observable)) {
                        const observableValue = ko.unwrap(observable);
                        if (observableValue && observableValue != "--") {
                            return true;
                        }
                    } else if (
                        typeof observable === "object" &&
                        observable !== null
                    ) {
                        for (const key of Object.keys(observable)) {
                            if (ko.isObservable(observable[key])) {
                                const observableValue = ko.unwrap(
                                    observable[key]
                                );
                                if (
                                    observableValue &&
                                    observableValue != "--"
                                ) {
                                    return true;
                                }
                            }
                        }
                    }
                }
                return false;
            };

            self.jumpToDesignationGeometry = (row) => {
                self.selectedGeometry(row.geometry);
            };

            const setupCards = (tileid) => {
                if (self.cards.location) {
                    const subCards = self.cards.location.subCards;
                    const rootCard = self.locationRoot;
                    const tileCards = self.createCardDictionary(
                        rootCard
                            .tiles()
                            .find((rootTile) => rootTile.tileid == tileid)
                            ?.cards
                    );
                    if (tileCards) {
                        tileCards.landUse = tileCards?.[subCards.landUse];
                        tileCards.areaAssignment =
                            tileCards?.[subCards.areaAssignment];
                        Object.assign(self.cards, tileCards);
                    }
                }
            };

            // if params.compiled is set and true, the user has compiled their own data.  Use as is.
            if (params?.compiled) {
            } else {
                const protectionNode = self.getRawNodeValue(
                    params.data(),
                    self.dataConfig.protection
                );
                if (protectionNode?.length) {
                    this.designations(
                        protectionNode.map((x) => {
                            const name = self.getNodeValue(
                                x,
                                "designation names",
                                "designation name"
                            );
                            const scheduleInfo = self.getNodeValue(
                                x,
                                "designation names",
                                "local/regional plan schedule information"
                            );
                            const useType = self.getNodeValue(
                                x,
                                "designation names",
                                "designation name use type"
                            );
                            const protectionType = self.getNodeValue(
                                x,
                                "designation or protection type"
                            );
                            const listNumber = self.getNodeValue(
                                x,
                                "heritage nz list number"
                            );
                            const rawDigitalFiles = self.getRawNodeValue(
                                x,
                                "digital file(s)"
                            );
                            const digitalFiles = (
                                Array.isArray(rawDigitalFiles)
                                    ? rawDigitalFiles
                                    : rawDigitalFiles
                                      ? [rawDigitalFiles]
                                      : []
                            ).map((f) => ({
                                link: self.getResourceLink(f),
                                text: self.getNodeValue(f),
                            }));
                            const startDate = self.getNodeValue(
                                x,
                                "designation and protection timespan",
                                "designation start date"
                            );
                            const endDate = self.getNodeValue(
                                x,
                                "designation and protection timespan",
                                "designation end date"
                            );
                            const grade = self.getNodeValue(x, {
                                testPaths: [
                                    ["grade"],
                                    ["heritage nz listing"],
                                ],
                            });
                            const risk = self.getNodeValue(x, "risk status");
                            const amendmentDate = self.getNodeValue(
                                x,
                                "designation and protection timespan",
                                "designation amendment date"
                            );
                            const displayDate = self.getNodeValue(
                                x,
                                "designation and protection timespan",
                                "display date"
                            );
                            const reference = self.getNodeValue(x, {
                                testPaths: [
                                    ["reference url", "url"],
                                    ["reference url"],
                                ],
                            });
                            const tileid = self.getTileId(x);
                            const geometry = self.getNodeValue(
                                x,
                                "designation mapping",
                                "designation geometry"
                            );
                            return {
                                amendmentDate,
                                digitalFiles,
                                displayDate,
                                endDate,
                                geometry,
                                grade,
                                listNumber,
                                name,
                                protectionType,
                                reference,
                                risk,
                                scheduleInfo,
                                startDate,
                                useType,
                                tileid,
                            };
                        })
                    );

                    self.geojson(
                        self.designations().reduce(
                            (geojson, currentJson) => {
                                const tileId = currentJson.tileid;
                                if (currentJson.geometry.features) {
                                    const jsonWithTileId =
                                        currentJson.geometry.features.map(
                                            (x) => {
                                                x.properties.tileId = tileId;
                                                return x;
                                            }
                                        );
                                    geojson.features = [
                                        ...geojson.features,
                                        ...jsonWithTileId,
                                    ];
                                }
                                return geojson;
                            },
                            { features: [], type: "FeatureCollection" }
                        )
                    );
                }
                const locationNode = self.getRawNodeValue(
                    params.data(),
                    ...self.dataConfig.location
                );

                if (self.cards?.location?.card) {
                    self.locationRoot = self.cards?.location?.card;
                }

                if (locationNode) {
                    setupCards(self.getTileId(locationNode));
                }

                if (self.dataConfig.areaAssignment) {
                    const areaAssignmentsNode = self.getRawNodeValue(
                        locationNode,
                        ...self.dataConfig.areaAssignment
                    );
                    if (Array.isArray(areaAssignmentsNode)) {
                        self.areaAssignment(
                            areaAssignmentsNode.map((x) => {
                                const endDate = self.getNodeValue(
                                    x,
                                    "area status timespan",
                                    "area status end date"
                                );
                                const ownership = self.getNodeValue(
                                    x,
                                    "ownership"
                                );
                                const reference = self.getNodeValue(x, {
                                    testPaths: [
                                        ["area reference", "area reference value"],
                                        [
                                            "treaty settlement recognition",
                                            "treaty settlement recognition value",
                                        ],
                                    ],
                                });
                                const shineForm = self.getNodeValue(
                                    x,
                                    "shine - form"
                                );
                                const shineSignificance = self.getNodeValue(
                                    x,
                                    "shine - significance"
                                );
                                const startDate = self.getNodeValue(
                                    x,
                                    "area status timespan",
                                    "area status start date"
                                );
                                const status = self.getNodeValue(
                                    x,
                                    "area status"
                                );
                                const rawThreatTypes = self.getRawNodeValue(
                                    x,
                                    "threat type"
                                );
                                const threatTypes = (
                                    Array.isArray(rawThreatTypes)
                                        ? rawThreatTypes
                                        : rawThreatTypes
                                          ? [rawThreatTypes]
                                          : []
                                ).map((t) => self.getNodeValue(t));
                                const tileid = self.getTileId(x);
                                return {
                                    endDate,
                                    ownership,
                                    reference,
                                    shineForm,
                                    shineSignificance,
                                    startDate,
                                    status,
                                    threatTypes,
                                    tileid,
                                };
                            })
                        );
                    }
                }

                let landUseClassificationNode = self.getRawNodeValue(
                    locationNode,
                    self.dataConfig.landUse
                );
                if (landUseClassificationNode) {
                    if (!Array.isArray(landUseClassificationNode)) {
                        landUseClassificationNode = [landUseClassificationNode];
                    }
                    self.landUseClassification(
                        landUseClassificationNode.map((x) => {
                            const classification = self.getNodeValue(
                                x,
                                "land use classification"
                            );
                            const endDate = self.getNodeValue(
                                x,
                                "land use assessment timespan",
                                "land use assessment end date"
                            );
                            const geology = self.getNodeValue(x, "geology");
                            const reference = self.getNodeValue(
                                x,
                                "land use notes",
                                "land use notes value"
                            );
                            const startDate = self.getNodeValue(
                                x,
                                "land use assessment timespan",
                                "land use assessment start date"
                            );
                            const subSoil = self.getNodeValue(x, "sub-soil");
                            const tileid = self.getTileId(x);
                            return {
                                classification,
                                endDate,
                                geology,
                                reference,
                                startDate,
                                subSoil,
                                tileid,
                            };
                        })
                    );
                }

                const recordRegistryMembershipNode = asArray(
                    self.getRawNodeValue(
                        params.data(),
                        self.dataConfig.recordRegistryMembership
                    )
                );
                if (recordRegistryMembershipNode.length) {
                    self.recordRegistryMemberships(
                        recordRegistryMembershipNode.map((entry) => {
                            const membership = self.getRawNodeValue(
                                entry,
                                "record and registry membership"
                            );
                            const tileid = self.getTileId(entry);

                            const registryNode = self.getRawNodeValue(
                                membership,
                                "record or registry"
                            );
                            const registry = {
                                text: self.getNodeValue(registryNode),
                                link: self.getResourceLink(registryNode),
                            };

                            const crossReferences = asArray(
                                self.getRawNodeValue(
                                    membership,
                                    "external cross references"
                                )
                            ).map((x) => {
                                const number = self.getNodeValue(
                                    x,
                                    "external cross reference number"
                                );
                                const source = self.getNodeValue(
                                    x,
                                    "external cross reference source"
                                );
                                const description = self.getNodeValue(
                                    x,
                                    "external cross reference notes",
                                    "external cross reference description"
                                );
                                const urlJson = self.getNodeValue(x, "url");
                                const url =
                                    urlJson && urlJson !== "--"
                                        ? JSON.parse(urlJson)
                                        : undefined;
                                return {
                                    number,
                                    source,
                                    description,
                                    url,
                                    tileid: self.getTileId(x),
                                };
                            });

                            const periods = asArray(
                                self.getRawNodeValue(
                                    membership,
                                    "period of membership"
                                )
                            ).map((x) => ({
                                startDate: self.getNodeValue(x, "start date"),
                                endDate: self.getNodeValue(x, "end date"),
                                displayDate: self.getNodeValue(
                                    x,
                                    "display date"
                                ),
                                tileid: self.getTileId(x),
                            }));

                            const signOffs = asArray(
                                self.getRawNodeValue(membership, "sign off")
                            ).map((x) => {
                                const approvedByNode = self.getRawNodeValue(
                                    x,
                                    "approved by",
                                    "approved by value"
                                );
                                const inputByNode = self.getRawNodeValue(
                                    x,
                                    "input by",
                                    "input by value"
                                );
                                const statusType = self.getNodeValue(
                                    x,
                                    "status type"
                                );
                                const approvedBy = {
                                    text: self.getNodeValue(approvedByNode),
                                    link: self.getResourceLink(approvedByNode),
                                };
                                const approvedDate = self.getNodeValue(
                                    x,
                                    "approved date",
                                    "approved date value"
                                );
                                const inputBy = {
                                    text: self.getNodeValue(inputByNode),
                                    link: self.getResourceLink(inputByNode),
                                };
                                const inputDate = self.getNodeValue(
                                    x,
                                    "input date",
                                    "input date value"
                                );
                                const referenceNumber = self.getNodeValue(
                                    x,
                                    "references",
                                    "reference number"
                                );
                                return {
                                    statusType,
                                    approvedBy,
                                    approvedDate,
                                    inputBy,
                                    inputDate,
                                    referenceNumber,
                                    tileid: self.getTileId(x),
                                };
                            });

                            return {
                                registry,
                                crossReferences,
                                periods,
                                signOffs,
                                tileid,
                            };
                        })
                    );
                }

                const custodialStatusNode = self.getRawNodeValue(
                    params.data(),
                    self.dataConfig.custodialStatus
                );
                if (custodialStatusNode) {
                    self.custodialStatusExists(true);
                    self.csTileid(self.getTileId(custodialStatusNode));

                    const typeValues = asArray(
                        self.getRawNodeValue(
                            custodialStatusNode,
                            "custodial status type"
                        )
                    )
                        .map((x) => self.getNodeValue(x))
                        .filter((v) => v && v !== "--");
                    self.csType(typeValues.length ? typeValues.join(", ") : "--");

                    self.csContextType(
                        self.getNodeValue(
                            custodialStatusNode,
                            "custodial context type"
                        )
                    );
                    self.csRelation(
                        self.getNodeValue(
                            custodialStatusNode,
                            "custodial relation"
                        )
                    );

                    const initiatingTransferNode = self.getRawNodeValue(
                        custodialStatusNode,
                        "custodial initiating declarative transfer"
                    );
                    self.csInitiatingTransfer({
                        text: self.getNodeValue(initiatingTransferNode),
                        link: self.getResourceLink(initiatingTransferNode),
                    });

                    const terminatingTransferNode = self.getRawNodeValue(
                        custodialStatusNode,
                        "custodial terminating declarative transfer"
                    );
                    self.csTerminatingTransfer({
                        text: self.getNodeValue(terminatingTransferNode),
                        link: self.getResourceLink(terminatingTransferNode),
                    });

                    self.csCustodians(
                        asArray(
                            self.getRawNodeValue(custodialStatusNode, "custodian")
                        ).map((x) => ({
                            text: self.getNodeValue(x),
                            link: self.getResourceLink(x),
                        }))
                    );

                    self.csHoldsFor(
                        asArray(
                            self.getRawNodeValue(
                                custodialStatusNode,
                                "custodial status holds for"
                            )
                        ).map((x) => ({
                            text: self.getNodeValue(x),
                            link: self.getResourceLink(x),
                        }))
                    );

                    self.csContext(
                        asArray(
                            self.getRawNodeValue(
                                custodialStatusNode,
                                "custodial event context"
                            )
                        ).map((x) => ({
                            text: self.getNodeValue(x),
                            link: self.getResourceLink(x),
                        }))
                    );

                    self.csNotes(
                        asArray(
                            self.getRawNodeValue(
                                custodialStatusNode,
                                "custodial status statement"
                            )
                        )
                            .map((x) => ({
                                description: self.getNodeValue(
                                    x,
                                    "descriptions",
                                    "description"
                                ),
                                type: self.getNodeValue(
                                    x,
                                    "descriptions",
                                    "description type"
                                ),
                                tileid: self.getTileId(x),
                            }))
                            .filter(
                                (note) =>
                                    note.description && note.description !== "--"
                            )
                    );
                }
            }
        },
        template: ProtectionTemplate,
    }
);
