import _ from "underscore";
import ko from "knockout";
import arches from "arches";
import reportUtils from "utils/report";
import PeopleTemplate from "templates/views/components/reports/scenes/people.htm";
import "bindings/datatable";
import "bindings/reports";

export default ko.components.register(
    "views/components/reports/scenes/people",
    {
        viewModel: function (params) {
            const self = this;
            Object.assign(self, reportUtils);

            // Scientific Dates table configuration
            self.peopleTableConfig = {
                ...self.defaultTableConfig,
                paging: true,
                searching: true,
                columns: Array(7).fill(null),
            };

            self.dataConfig = {
                people: "associated actors",
            };

            self.cards = Object.assign({}, params.cards);
            self.resource = params?.data || undefined;
            self.edit = params.editTile || self.editTile;
            self.delete = params.deleteTile || self.deleteTile;
            self.add = params.addTile || self.addNewTile;
            self.people = ko.observableArray();
            self.visible = {
                people: ko.observable(true),
            };
            Object.assign(self.dataConfig, params.dataConfig || {});

            // if params.compiled is set and true, the user has compiled their own data.  Use as is.
            if (params?.compiled) {
                // do nothing
            } else {
                const peopleNode = self.getRawNodeValue(
                    params.data(),
                    self.dataConfig.people
                );
                if (peopleNode?.length) {
                    self.people(
                        peopleNode.map((x) => {
                            // "Associated Actor" was renamed to "Associated
                            // Person or Group" on some resource models
                            // (e.g. Heritage Place), but the fields nested
                            // beneath it kept their original "Associated
                            // Actor ..." names.
                            const associatedActor = self.getRawNodeValue(x, {
                                testPaths: [
                                    ["associated actor"],
                                    ["associated person or group"],
                                ],
                            });
                            const actor = self.getNodeValue(associatedActor, {
                                testPaths: [["actor"], ["person or group"]],
                            });
                            const role = self.getNodeValue(
                                associatedActor,
                                "role type"
                            );
                            const startOfRole = self.getNodeValue(
                                associatedActor,
                                "associated actor timespan",
                                "associated actor start date"
                            );
                            const endOfRole = self.getNodeValue(
                                associatedActor,
                                "associated actor timespan",
                                "associated actor end date"
                            );
                            const displayDate = self.getNodeValue(
                                associatedActor,
                                "associated actor timespan",
                                "associated actor display date"
                            );
                            const dateQualifier = self.getNodeValue(
                                associatedActor,
                                "associated actor timespan",
                                "associated actor date qualifier"
                            );
                            const tileid = self.getTileId(x);
                            return {
                                actor,
                                role,
                                startOfRole,
                                endOfRole,
                                displayDate,
                                dateQualifier,
                                tileid,
                            };
                        })
                    );
                }
            }
        },
        template: PeopleTemplate,
    }
);
