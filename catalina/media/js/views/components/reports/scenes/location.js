import _ from "underscore";
import ko from "knockout";
import arches from "arches";
import reportUtils from "utils/report";
import LocationTemplate from "templates/views/components/reports/scenes/location.htm";
import "bindings/datatable";
import "bindings/reports";
import "views/components/reports/scenes/map";

export default ko.components.register(
    "views/components/reports/scenes/location",
    {
        viewModel: function (params) {
            const self = this;
            Object.assign(self, reportUtils);

            self.dataConfig = {
                location: ["location data"],
                addresses: "addresses",
                nationalGrid: "national grid references",
                locationDescription: "location descriptions",
                administrativeAreas: "localities/administrative areas",
                geometry: "geometry",
                namedLocations: "named locations",
            };

            self.cards = Object.assign({}, params.cards);
            self.resource = params?.data || undefined;
            self.cardConfig = Object.assign({}, params.cards);
            self.selectedGeometry = params.selectedGeometry || ko.observable();
            self.edit = params.editTile || self.editTile;
            self.delete = params.deleteTile || self.deleteTile;
            self.add = params.addTile || self.addNewTile;
            self.visible = {
                geometryMetadata: ko.observable(false),
                geometry: ko.observable(true),
                coordinates: ko.observable(true),
                addresses: ko.observable(true),
                descriptions: ko.observable(true),
                administrativeAreas: ko.observable(true),
                nationalGrid: ko.observable(true),
                areaAssignment: ko.observable(true),
                landUse: ko.observable(true),
                namedLocations: ko.observable(true),
            };
            Object.assign(self.dataConfig, params.dataConfig || {});

            self.locationTableConfig = {
                ...self.defaultTableConfig,
                columns: Array(6).fill(null),
            };

            self.addressTableConfig = {
                ...self.defaultTableConfig,
                columns: [
                    { width: "15%" },
                    { width: "20%" },
                    { width: "20%" },
                    { width: "20%" },
                    { width: "15%" },
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                ],
            };

            self.locDescriptionsTableConfig = {
                ...self.defaultTableConfig,
                columns: [{ width: "70%" }, { width: "20%" }, null],
            };

            self.adminAreasTableConfig = {
                ...self.defaultTableConfig,
                columns: [
                    { width: "50%" },
                    { width: "20%" },
                    { width: "20%" },
                    null,
                ],
            };

            self.gridReferencesTableConfig = {
                ...self.defaultTableConfig,
                columns: Array(2).fill(null),
            };

            self.areaAssignmentsTableConfig = {
                ...self.defaultTableConfig,
                columns: Array(8).fill(null),
            };

            self.landUseTableConfig = {
                ...self.defaultTableConfig,
                columns: Array(7).fill(null),
            };

            self.namedLocationsTableConfig = {
                ...self.defaultTableConfig,
                columns: Array(2).fill(null),
            };

            self.coordinateData = ko.observable();
            self.geometryShape = ko.observable();
            self.geometryEntries = ko.observableArray();
            self.addresses = ko.observableArray();
            self.descriptions = ko.observableArray();
            self.administrativeAreas = ko.observableArray();
            self.nationalGridReferences = ko.observableArray();
            self.areaAssignment = ko.observableArray();
            self.landUseClassification = ko.observableArray();
            self.namedLocations = ko.observableArray();
            self.locationRoot = undefined;

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

            const setupCards = (tileid) => {
                if (self.cards.location) {
                    const subCards = self.cardConfig.location.subCards;
                    const rootCard = self.locationRoot;

                    const tileCards =
                        rootCard === null
                            ? self.cards?.cards
                            : self.createCardDictionary(
                                  rootCard
                                      .tiles()
                                      .find(
                                          (rootTile) =>
                                              rootTile.tileid == tileid
                                      )?.cards
                              );

                    if (tileCards) {
                        tileCards.addresses = tileCards?.[subCards.addresses];
                        tileCards.nationalGridReferences =
                            tileCards?.[subCards.nationalGrid];
                        tileCards.administrativeAreas =
                            tileCards?.[subCards.administrativeAreas];
                        tileCards.locationDescriptions =
                            tileCards?.[subCards.locationDescriptions];
                        tileCards.namedLocations =
                            tileCards?.[subCards.namedLocations];
                        if (Array.isArray(subCards.locationGeometry)) {
                            let currentTileCards = tileCards;
                            for (
                                let i = 0;
                                i < subCards.locationGeometry.length;
                                ++i
                            ) {
                                const nestedCard =
                                    currentTileCards?.[
                                        subCards.locationGeometry[i]
                                    ];
                                const nestedTile = nestedCard?.tiles()?.[0];
                                currentTileCards = self.createCardDictionary(
                                    nestedTile?.cards
                                );
                                tileCards.locationGeometry = nestedCard;
                            }
                        } else {
                            tileCards.locationGeometry =
                                tileCards?.[subCards.locationGeometry];
                        }
                        Object.assign(self.cards, tileCards);
                    }
                }
            };

            // if params.compiled is set and true, the user has compiled their own data.  Use as is.
            if (params?.compiled) {
            } else {
                const locationNode = self.getRawNodeValue(
                    params.data(),
                    ...self.dataConfig.location
                );

                self.locationRoot = self.cardConfig?.location?.card;

                setupCards(self.getTileId(locationNode));

                if (!locationNode) {
                    return;
                }

                // the geometry nodegroup has cardinality "n", so this can be
                // either a single tile or an array of tiles.
                const rawGeometryNode = self.getRawNodeValue(
                    locationNode,
                    self.dataConfig.geometry
                );
                const geometryNodes = rawGeometryNode
                    ? Array.isArray(rawGeometryNode)
                        ? rawGeometryNode
                        : [rawGeometryNode]
                    : [];
                if (geometryNodes.length) {
                    const firstGeometryNodeValue = (...args) => {
                        for (const node of geometryNodes) {
                            const value = self.getNodeValue(node, ...args);
                            if (value && value != "--") {
                                return value;
                            }
                        }
                        return "--";
                    };

                    const valueSet = (...values) =>
                        values.some((value) => value && value !== "--");

                    const collectedFeatures = [];
                    geometryNodes.forEach((node) => {
                        const rawCoordinates = self.getRawNodeValue(
                            node,
                            "geospatial coordinates"
                        );
                        const features =
                            rawCoordinates?.geojson?.features ||
                            rawCoordinates?.features;
                        if (features?.length) {
                            collectedFeatures.push(...features);
                        }
                    });
                    if (collectedFeatures.length) {
                        self.coordinateData({
                            type: "FeatureCollection",
                            features: collectedFeatures,
                        });
                    }

                    self.geometryShape(
                        firstGeometryNodeValue("feature shape")
                    );

                    self.geometryEntries(
                        geometryNodes.map((node) => {
                            const metadata = {
                                compilerName: self.getNodeValue(
                                    node,
                                    "spatial record compilation",
                                    "spatial record compiler",
                                    "compiler names",
                                    "compiler name"
                                ),
                                compileDate: self.getNodeValue(
                                    node,
                                    "spatial record compilation",
                                    "spatial record compilation timespan",
                                    "compilation start date"
                                ),
                                updateDate: self.getNodeValue(
                                    node,
                                    "spatial record update",
                                    "spatial record update timespan",
                                    "update start date"
                                ),
                                updaterName: self.getNodeValue(
                                    node,
                                    "spatial record update",
                                    "spatial record updater",
                                    "updater names",
                                    "updater name"
                                ),
                                authorizerName: self.getNodeValue(
                                    node,
                                    "spatial record authorization",
                                    "authorizer",
                                    "authorizer names",
                                    "authorizer name"
                                ),
                                authorizationDate: self.getNodeValue(
                                    node,
                                    "spatial record authorization",
                                    "authorization timespan",
                                    "date of authorization"
                                ),
                                typeOfAuthorization: self.getNodeValue(
                                    node,
                                    "spatial record authorization",
                                    "authorization type"
                                ),
                            };
                            const scale = {
                                accuracy: self.getNodeValue(
                                    node,
                                    "spatial accuracy qualifier"
                                ),
                                basemap: self.getNodeValue(
                                    node,
                                    "current base map",
                                    "current base map names",
                                    "current base map name"
                                ),
                                captureScale: self.getNodeValue(
                                    node,
                                    "capture scale"
                                ),
                                coordinateSystem: self.getNodeValue(
                                    node,
                                    "coordinate system",
                                    "coordinate system value"
                                ),
                            };
                            const notes = self.getNodeValue(
                                node,
                                "spatial metadata descriptions",
                                "spatial metadata notes"
                            );

                            return {
                                tileid: self.getTileId(node),
                                metadata,
                                scale,
                                notes,
                                recordEditExists: valueSet(
                                    ...Object.values(metadata)
                                ),
                                scaleExists: valueSet(
                                    ...Object.values(scale)
                                ),
                                descriptionExists: valueSet(notes),
                            };
                        })
                    );
                }

                const rawAddressesNode = self.getRawNodeValue(
                    locationNode,
                    self.dataConfig.addresses
                );
                if (rawAddressesNode || Array.isArray(locationNode)) {
                    const addressesNode = rawAddressesNode
                        ? Array.isArray(rawAddressesNode)
                            ? rawAddressesNode
                            : [rawAddressesNode]
                        : locationNode.map((locationNode) =>
                              self.getRawNodeValue(
                                  locationNode,
                                  self.dataConfig.addresses
                              )
                          );
                    if (addressesNode?.length) {
                        self.addresses(
                            addressesNode.map((x) => {
                                const buildingName = self.getNodeValue(
                                    x,
                                    "building name",
                                    "building name value"
                                );
                                const buildingNumber = self.getNodeValue(
                                    x,
                                    "building number",
                                    "building number value"
                                );
                                const buildingNumberSubStreet =
                                    self.getNodeValue(
                                        x,
                                        "building number sub-street",
                                        "building number sub-street value"
                                    );
                                const county = self.getNodeValue(
                                    x,
                                    "county",
                                    "county value"
                                );
                                const currency = self.getNodeValue(
                                    x,
                                    "address currency"
                                );
                                const fullAddress = self.getNodeValue(
                                    x,
                                    "full address"
                                );
                                const locality = self.getNodeValue(
                                    x,
                                    "locality",
                                    "locality value"
                                );
                                const postcode = self.getNodeValue(
                                    x,
                                    "postcode",
                                    "postcode value"
                                );
                                const status = self.getNodeValue(
                                    x,
                                    "address status"
                                );
                                const street = self.getNodeValue(
                                    x,
                                    "street",
                                    "street value"
                                );
                                const subStreet = self.getNodeValue(
                                    x,
                                    "sub-street",
                                    "sub-street value"
                                );
                                const tileid = self.getTileId(x);
                                const town = self.getNodeValue(
                                    x,
                                    "town or city",
                                    "town or city value"
                                );
                                return {
                                    buildingName,
                                    buildingNumber,
                                    buildingNumberSubStreet,
                                    county,
                                    currency,
                                    fullAddress,
                                    locality,
                                    postcode,
                                    status,
                                    street,
                                    subStreet,
                                    tileid,
                                    town,
                                };
                            })
                        );
                    }
                }

                let administrativeAreasNode = self.getRawNodeValue(
                    locationNode,
                    self.dataConfig.administrativeAreas
                );
                if (!administrativeAreasNode) {
                    administrativeAreasNode = self.getRawNodeValue(
                        params.data(),
                        self.dataConfig.administrativeAreas
                    );
                }
                if (Array.isArray(administrativeAreasNode)) {
                    self.administrativeAreas(
                        administrativeAreasNode.map((x) => {
                            const currency = self.getNodeValue(
                                x,
                                "area currency type"
                            );
                            const name = self.getNodeValue(
                                x,
                                "area names",
                                "area name"
                            );
                            const tileid = self.getTileId(x);
                            const type = self.getNodeValue(x, "area type");
                            return { currency, name, tileid, type };
                        })
                    );
                }

                const locationDescriptionsNode = self.getRawNodeValue(
                    locationNode,
                    self.dataConfig.locationDescription
                );
                if (locationDescriptionsNode?.length) {
                    self.descriptions(
                        locationDescriptionsNode.map((x) => {
                            const type = self.getNodeValue(
                                x,
                                "location description type"
                            );
                            const description = self.getNodeValue(
                                x,
                                "location description"
                            );
                            const tileid = self.getTileId(x);
                            return { type, description, tileid };
                        })
                    );
                }

                const nationalGridReferencesNode = self.getRawNodeValue(
                    locationNode,
                    self.dataConfig.nationalGrid
                );
                if (
                    (Array.isArray(nationalGridReferencesNode) &&
                        nationalGridReferencesNode?.length) ||
                    nationalGridReferencesNode != undefined
                ) {
                    if (Array.isArray(nationalGridReferencesNode)) {
                        self.nationalGridReferences(
                            nationalGridReferencesNode.map((x) => {
                                const reference = self.getNodeValue(
                                    x,
                                    "national grid reference"
                                );
                                const tileid = self.getTileId(x);
                                return { reference, tileid };
                            })
                        );
                    } else {
                        const reference = self.getNodeValue(
                            nationalGridReferencesNode,
                            "national grid reference"
                        );
                        const tileid = self.getTileId(
                            nationalGridReferencesNode
                        );
                        if (reference && reference !== "--") {
                            self.nationalGridReferences([
                                { reference, tileid },
                            ]);
                        }
                    }
                }

                const namedLocationsNode = self.getRawNodeValue(
                    locationNode,
                    self.dataConfig.namedLocations
                );
                const namedLocationNode = self.getRawNodeValue(
                    namedLocationsNode,
                    "named location"
                );
                const placename = self.getNodeValue(namedLocationNode);
                const tileid = self.getTileId(namedLocationsNode);
                if (placename && placename !== "--") {
                    const resourceUrl = self.getResourceLink(
                        namedLocationNode
                    );
                    self.namedLocations([{ placename, resourceUrl, tileid }]);
                }
            }
        },
        template: LocationTemplate,
    }
);
