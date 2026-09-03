import _ from "underscore";
import ko from "knockout";
import arches from "arches";
import reportUtils from "utils/report";
import ResourcesTemplate from "templates/views/components/reports/scenes/resources.htm";
import "bindings/datatable";
import "bindings/reports";
import { generateArchesURL } from "@/arches/utils/generate-arches-url.ts";

export default ko.components.register(
    "views/components/reports/scenes/resources",
    {
        viewModel: function (params) {
            const self = this;
            Object.assign(self, reportUtils);

            //Related Resource 2 column table configuration
            self.relatedResourceTwoColumnTableConfig = {
                ...self.defaultTableConfig,
                paging: true,
                searching: true,
                columns: Array(2).fill(null),
            };

            //Related Resource 2 column table configuration
            self.archiveHolderTableConfig = {
                ...self.defaultTableConfig,
                paging: true,
                searching: true,
                columns: Array(5).fill(null),
            };

            //Related Resource 3 column table configuration
            self.relatedResourceThreeColumnTableConfig = {
                ...self.defaultTableConfig,
                paging: true,
                searching: true,
                columns: Array(3).fill(null),
            };

            self.applicationAreaTableConfig = {
                ...self.defaultTableConfig,
                paging: true,
                searching: true,
                columns: Array(2).fill(null),
            };

            self.dataConfig = {
                activities: "associated activities",
                consultations: "associated consultations",
                files: "associated files",
                assets: "associated monuments, areas and artefacts",
                archive: "associated archives",
                actors: "associated actors",
            };

            self.cards = Object.assign({}, params.cards);
            self.resource = params?.data || undefined;
            self.edit = params.editTile || self.editTile;
            self.delete = params.deleteTile || self.deleteTile;
            self.add = params.addTile || self.addNewTile;
            self.activities = ko.observableArray();
            self.consultations = ko.observableArray();
            self.consultations_message = ko.observable(null);
            self.files = ko.observableArray();
            self.archive = ko.observableArray();
            self.actors = ko.observableArray();
            self.assets = ko.observableArray();
            self.translation = ko.observableArray();
            self.applicationArea = ko.observableArray();
            self.period = ko.observableArray();
            self.visible = {
                period: ko.observable(true),
                archive: ko.observable(true),
                activities: ko.observable(true),
                consultations: ko.observable(true),
                files: ko.observable(true),
                actors: ko.observable(true),
                assets: ko.observable(true),
                applicationArea: ko.observable(true),
                translation: ko.observable(true),
            };
            Object.assign(self.dataConfig, params.dataConfig || {});

            // if params.compiled is set and true, the user has compiled their own data.  Use as is.
            if (params?.compiled) {
            } else {
                const rawAssociatedActivitiesNode = self.getRawNodeValue(
                    params.data(),
                    self.dataConfig.activities
                );
                const associatedActivitiesNode = rawAssociatedActivitiesNode
                    ? Array.isArray(rawAssociatedActivitiesNode)
                        ? rawAssociatedActivitiesNode
                        : [rawAssociatedActivitiesNode]
                    : [];
                if (associatedActivitiesNode.length) {
                    self.activities(
                        associatedActivitiesNode.map((x) => {
                            const tileid = self.getTileId(x);
                            const rawInstances = self.getRawNodeValue(
                                x,
                                "instance_details"
                            );
                            const instances = rawInstances
                                ? Array.isArray(rawInstances)
                                    ? rawInstances
                                    : [rawInstances]
                                : [];
                            const activityInstances = instances.length
                                ? instances.map((element) => ({
                                      activity: self.getNodeValue(element),
                                      resourceUrl:
                                          self.getResourceLink(element),
                                  }))
                                : [
                                      {
                                          activity: self.getNodeValue(x),
                                          resourceUrl:
                                              self.getResourceLink(x),
                                      },
                                  ];
                            return { activityInstances, tileid };
                        })
                    );
                }

                const rawAssociatedConsultationsNode = self.getRawNodeValue(
                    params.data(),
                    self.dataConfig.consultations
                );
                const associatedConsultationsNode = rawAssociatedConsultationsNode
                    ? Array.isArray(rawAssociatedConsultationsNode)
                        ? rawAssociatedConsultationsNode
                        : [rawAssociatedConsultationsNode]
                    : [];
                if (associatedConsultationsNode.length) {
                    self.consultations(
                        associatedConsultationsNode.map((x) => {
                            const consultation = self.getNodeValue(x);
                            const resourceUrl = self.getResourceLink(x);
                            const tileid = self.getTileId(x);
                            return { consultation, resourceUrl, tileid };
                        })
                    );
                }

                const userAvailableConsulationCards = () => {
                    return $.ajax({
                        url: generateArchesURL("arches:api_card", { resourceid: self.dataConfig.resourceinstanceid }),
                        context: this,
                    })
                        .done(function (response) {
                            return response;
                        })
                        .fail(function () {
                            return false;
                        });
                };

                if (self.dataConfig.resourceinstanceid) {
                    userAvailableConsulationCards().then(function (
                        cards_response
                    ) {
                        if (cards_response !== false) {
                            var card_names = [];
                            for (const card in cards_response.cards) {
                                card_names.push(
                                    cards_response.cards[card].name
                                );
                            }
                            if (
                                card_names.includes("Associated Consultations")
                            ) {
                                self.consultations_message(
                                    "No consultations for this resource"
                                );
                            } else {
                                self.consultations_message(
                                    "You do not have permission to see this information"
                                );
                            }
                        } else {
                            self.consultations_message(
                                "There was an issue checking for associated consultations."
                            );
                        }
                    });
                } else {
                    self.consultations_message(
                        "There was an issue checking for associated consultations."
                    );
                }

                const associatedArchiveNode = self.getRawNodeValue(
                    params.data(),
                    self.dataConfig.archive
                );
                if (Array.isArray(associatedArchiveNode)) {
                    let key = "Associated Archive Objects";
                    if (!(key in associatedArchiveNode[0])) {
                        key = undefined;
                    }
                    self.archive(
                        associatedArchiveNode.map((x) => {
                            const archiveHolders = [];
                            var reference;
                            var title;
                            var tileid;
                            var rawHolders;
                            const association = self.getNodeValue(
                                x,
                                "association type"
                            );
                            if (key) {
                                reference = self.getNodeValue(
                                    x,
                                    key,
                                    "archive object references",
                                    "archive object reference"
                                );
                                title = self.getNodeValue(
                                    x,
                                    key,
                                    "archive object titles",
                                    "archive object title"
                                );
                                tileid = self.getTileId(x);
                                rawHolders = self.getRawNodeValue(
                                    x,
                                    key,
                                    "archive holder"
                                );
                            } else {
                                reference = self.getNodeValue(
                                    x,
                                    "archive object references",
                                    "archive object reference"
                                );
                                title = self.getNodeValue(
                                    x,
                                    "archive object titles",
                                    "archive object title"
                                );
                                tileid = self.getTileId(x);
                                rawHolders = self.getRawNodeValue(
                                    x,
                                    "archive holder"
                                );
                            }
                            const holders = rawHolders
                                ? Array.isArray(rawHolders)
                                    ? rawHolders
                                    : [rawHolders]
                                : [];
                            holders.forEach((holderNode) => {
                                const rawHolderInstances =
                                    self.getRawNodeValue(
                                        holderNode,
                                        "instance_details"
                                    );
                                const holderInstances = rawHolderInstances
                                    ? Array.isArray(rawHolderInstances)
                                        ? rawHolderInstances
                                        : [rawHolderInstances]
                                    : [];
                                if (holderInstances.length) {
                                    holderInstances.forEach((element) => {
                                        archiveHolders.push({
                                            holder: self.getNodeValue(element),
                                            holderLink:
                                                self.getResourceLink(element),
                                        });
                                    });
                                } else {
                                    archiveHolders.push({
                                        holder: self.getNodeValue(holderNode),
                                        holderLink:
                                            self.getResourceLink(holderNode),
                                    });
                                }
                            });
                            return {
                                archiveHolders,
                                association,
                                reference,
                                title,
                                tileid,
                            };
                        })
                    );
                }

                const rawAssociatedFilesNode = self.getRawNodeValue(
                    params.data(),
                    self.dataConfig.files
                );
                const associatedFilesNode = rawAssociatedFilesNode
                    ? Array.isArray(rawAssociatedFilesNode)
                        ? rawAssociatedFilesNode
                        : [rawAssociatedFilesNode]
                    : [];
                if (associatedFilesNode.length) {
                    self.files(
                        associatedFilesNode.map((x) => {
                            const tileid = self.getTileId(x);
                            const rawInstances = self.getRawNodeValue(
                                x,
                                "instance_details"
                            );
                            const instances = rawInstances
                                ? Array.isArray(rawInstances)
                                    ? rawInstances
                                    : [rawInstances]
                                : [];
                            const fileInstances = instances.length
                                ? instances.map((element) => ({
                                      file: self.getNodeValue(element),
                                      resourceUrl:
                                          self.getResourceLink(element),
                                  }))
                                : [
                                      {
                                          file: self.getNodeValue(x),
                                          resourceUrl:
                                              self.getResourceLink(x),
                                      },
                                  ];
                            return { fileInstances, tileid };
                        })
                    );
                }

                const associatedArtifactsNode = self.getRawNodeValue(
                    params.data(),
                    self.dataConfig.assets
                );
                if (associatedArtifactsNode) {
                    if (Array.isArray(associatedArtifactsNode)) {
                        // Candidate child-node names for the assets tile, tried in order.
                        // Different resource models name this node differently (Person's
                        // Heritage Place, Area or Artefact card doesn't match either of
                        // the two names the upstream component hardcodes).
                        const keyCandidates = [
                            "Monument, Area or Artefact",
                            "Associated Monument, Area or Artefact",
                            "Heritage Place, Area or Artefact",
                            "Associated Heritage Place, Area or Artefact",
                        ];
                        const key = keyCandidates.find(
                            (candidate) => candidate in associatedArtifactsNode[0]
                        );
                        self.assets(
                            associatedArtifactsNode.map((x) => {
                                const rawAsset = key ? x[key] : undefined;
                                const assetTiles = rawAsset
                                    ? Array.isArray(rawAsset)
                                        ? rawAsset
                                        : [rawAsset]
                                    : [];
                                const resource = assetTiles.flatMap(
                                    (element) => {
                                        const rawInstances =
                                            self.getRawNodeValue(
                                                element,
                                                "instance_details"
                                            );
                                        const instances = rawInstances
                                            ? Array.isArray(rawInstances)
                                                ? rawInstances
                                                : [rawInstances]
                                            : [];
                                        return instances.length
                                            ? instances.map((instance) => ({
                                                  resourceName:
                                                      self.getNodeValue(
                                                          instance
                                                      ),
                                                  resourceUrl:
                                                      self.getResourceLink(
                                                          instance
                                                      ),
                                              }))
                                            : [
                                                  {
                                                      resourceName:
                                                          self.getNodeValue(
                                                              element
                                                          ),
                                                      resourceUrl:
                                                          self.getResourceLink(
                                                              element
                                                          ),
                                                  },
                                              ];
                                    }
                                );
                                const association = self.getNodeValue(
                                    x,
                                    "association type"
                                );
                                const tileid = self.getTileId(x);
                                return { resource, association, tileid };
                            })
                        );
                    } else {
                        const instanceDetails = self.getRawNodeValue(
                            associatedArtifactsNode,
                            "instance_details"
                        );
                        if (Array.isArray(instanceDetails)) {
                            const tileid = self.getTileId(
                                associatedArtifactsNode
                            );
                            self.assets(
                                instanceDetails.map((x) => {
                                    const resourceName = self.getNodeValue(x);
                                    const resourceUrl = self.getResourceLink(x);
                                    return {
                                        resource: [
                                            { resourceName, resourceUrl },
                                        ],
                                        association: "--",
                                        tileid,
                                    };
                                })
                            );
                        }
                    }
                }

                const associatedActorsNode = self.getRawNodeValue(
                    params.data(),
                    self.dataConfig.actors
                );
                if (associatedActorsNode) {
                    if (Array.isArray(associatedActorsNode)) {
                        self.actors(
                            associatedActorsNode.map((x) => {
                                const associatedActors = [];
                                const actorInstances = self.getRawNodeValue(x, {
                                    testPaths: [
                                        [
                                            "associated actor",
                                            "actor",
                                            "instance_details",
                                        ],
                                    ],
                                });
                                actorInstances?.forEach((element) => {
                                    associatedActors.push({
                                        actor: self.getNodeValue(element),
                                        actorLink:
                                            self.getResourceLink(element),
                                    });
                                });
                                const tileid = self.getTileId(x);
                                return { associatedActors, tileid };
                            })
                        );
                    }
                }

                const relatedApplicationArea = self.getRawNodeValue(
                    params.data(),
                    self.dataConfig.relatedApplicationArea,
                    "geometry",
                    "related application area",
                    "instance_details"
                );
                if (Array.isArray(relatedApplicationArea)) {
                    const tileid = self.getTileId(
                        self.getRawNodeValue(
                            params.data(),
                            self.dataConfig.relatedApplicationArea,
                            "geometry",
                            "related application area"
                        )
                    );
                    self.applicationArea(
                        relatedApplicationArea.map((x) => {
                            const resource = self.getNodeValue(x);
                            const resourceLink = self.getResourceLink(x);
                            return { resource, resourceLink, tileid };
                        })
                    );
                }

                const translationNode = self.getRawNodeValue(
                    params.data(),
                    self.dataConfig.translation,
                    "instance_details"
                );
                if (Array.isArray(translationNode)) {
                    self.translation(
                        translationNode.map((x) => {
                            const resource = self.getNodeValue(x);
                            const resourceLink = self.getResourceLink(
                                self.getRawNodeValue(x)
                            );
                            const tileid = self.getTileId(x);
                            return { resource, resourceLink, tileid };
                        })
                    );
                }
                if (self.dataConfig.period) {
                    const rawPeriodNode = self.getRawNodeValue(
                        params.data(),
                        self.dataConfig.period
                    );
                    if (rawPeriodNode) {
                        const periodNode = Array.isArray(rawPeriodNode)
                            ? rawPeriodNode
                            : [rawPeriodNode];
                        self.period(
                            periodNode.map((x) => {
                                var resource = [];
                                for (const element of x["instance_details"]) {
                                    if (element) {
                                        resource.push({
                                            resourceName:
                                                self.getNodeValue(element),
                                            resourceUrl:
                                                self.getResourceLink(element),
                                        });
                                    }
                                }
                                const tileid = self.getTileId(x);
                                return { resource, tileid };
                            })
                        );
                    }
                }
            }
        },
        template: ResourcesTemplate,
    }
);
