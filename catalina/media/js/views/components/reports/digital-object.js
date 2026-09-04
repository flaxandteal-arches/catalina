import $ from "jquery";
import _ from "underscore";
import ko from "knockout";
import arches from "arches";
import resourceUtils from "utils/resource";
import reportUtils from "utils/report";
import DigitalObjectTemplate from "templates/views/components/reports/digital-object.htm";
import "views/components/reports/scenes/name";
import "views/components/reports/scenes/copyright";
import "views/components/reports/scenes/resources";
import "views/components/reports/scenes/protection";
import "views/components/reports/scenes/json";
import "bindings/reports";

export default ko.components.register("digital-object-report", {
    viewModel: function (params) {
        var self = this;
        params.configKeys = ["tabs", "activeTabIndex"];
        this.configForm = params.configForm || false;
        this.configType = params.configType || "header";

        Object.assign(self, reportUtils);
        self.sections = [
            { id: "name", title: "Names and Identifiers" },
            { id: "description", title: "Descriptions" },
            { id: "publication", title: "Publication Details" },
            { id: "file", title: "File Details" },
            { id: "resources", title: "Associated Resources" },
            { id: "json", title: "JSON" },
        ];
        self.reportMetadata = ko.observable(params.report?.report_json);
        self.resource = ko.observable(self.reportMetadata()?.resource);
        self.displayname = ko.observable(
            ko.unwrap(self.reportMetadata)?.displayname
        );
        self.activeSection = ko.observable("name");

        self.nameDataConfig = {};

        self.nameCards = {};
        self.descriptionCards = {};
        self.summary = params.summary;
        self.cards = {};
        self.copyrightCards = {};
        self.resourcesCards = {};
        self.protectionCards = {};

        self.protectionDataConfig = {
            protection: undefined,
            areaAssignment: undefined,
            landUse: undefined,
            custodialStatus: undefined,
            recordRegistryMembership: "record and registry membership",
        };

        self.resourcesDataConfig = {
            assets: "associated resources",
            files: undefined,
            relatedApplicationArea: undefined,
            consultations: undefined,
            activities: undefined,
            actors: undefined,
            archive: undefined,
            resourceinstanceid: ko.unwrap(self.reportMetadata)
                ?.resourceinstanceid,
        };

        self.visible = {
            files: ko.observable(true),
            referenceMatauranga: ko.observable(true),
        };

        self.referenceMatauranga = ko.observableArray();

        const asArray = (rawValue) =>
            rawValue ? (Array.isArray(rawValue) ? rawValue : [rawValue]) : [];

        const referenceMatauranga = self.getRawNodeValue(
            self.resource(),
            "reference mātauranga"
        );
        self.referenceMatauranga(
            asArray(referenceMatauranga).map((node) => {
                const value = self.getNodeValue(node);
                const link = self.getResourceLink(node);
                return { value, link };
            })
        );

        self.createTableConfig = function (col) {
            return {
                ...self.defaultTableConfig,
                columns: Array(col).fill(null),
            };
        };

        if (params.report.cards) {
            const cards = params.report.cards;

            self.cards = self.createCardDictionary(cards);

            self.nameCards = {
                name: self.cards?.["names"],
                externalCrossReferences:
                    self.cards?.["external cross references"],
                systemReferenceNumbers:
                    self.cards?.["system reference numbers"],
            };

            self.descriptionCards = {
                descriptions: self.cards?.["descriptions"],
            };

            self.copyrightCards = {
                copyright: self.cards?.["copyright"],
            };

            self.resourcesCards = {
                assets: self.cards?.["associated resources"],
            };

            self.protectionCards = {
                recordRegistryMembership:
                    self.cards?.["record and registry membership"],
            };
        }

        // "Record and Registry Membership" collides by name with a nested
        // card of the same name inside itself, so pick the correct top-level
        // card by nodegroup id instead (same pattern as consultation.js).
        if (params.report.cards) {
            const recordRegistryCard = params.report.cards.find(
                (card) =>
                    card.nodegroupid ===
                    "6568913f-85cc-5991-99d8-b4ebbe765123"
            );
            if (recordRegistryCard) {
                self.protectionCards.recordRegistryMembership =
                    recordRegistryCard;
            }
        }

        self.files = ko.observableArray();

        const fileDetailsNode = self.getRawNodeValue(
            self.resource(),
            "file content",
            "file",
            "file_details"
        );
        const fileNode = self.getRawNodeValue(
            self.resource(),
            "file content",
            "file"
        );
        if (Array.isArray(fileDetailsNode)) {
            const tileid = self.getTileId(fileNode);
            self.files(
                fileDetailsNode.map((node) => {
                    const name = self.getNodeValue(node, "name");
                    const link = self.getNodeValue(node, "url");
                    return { name, link, tileid };
                })
            );
        }

        self.fileData = ko.observable({
            sections: [
                {
                    title: "Details",
                    data: [
                        {
                            key: "Format",
                            value: self.getNodeValue(
                                self.resource(),
                                "file format type"
                            ),
                            type: "kv",
                            card: self.cards?.["file format"],
                        },
                        {
                            key: "Creator",
                            value: self.getRawNodeValue(
                                self.resource(),
                                "creation",
                                "creator"
                            ),
                            type: "resource",
                            card: self.cards?.creation,
                        },
                        {
                            key: "Created Date",
                            value: self.getNodeValue(
                                self.resource(),
                                "creation",
                                "creation timespan",
                                "start date"
                            ),
                            type: "kv",
                            card: self.cards?.creation,
                        },
                        {
                            key: "End Date",
                            value: self.getNodeValue(
                                self.resource(),
                                "creation",
                                "creation timespan",
                                "end date"
                            ),
                            type: "kv",
                            card: self.cards?.creation,
                        },
                    ],
                },
            ],
        });
    },
    template: DigitalObjectTemplate,
});
