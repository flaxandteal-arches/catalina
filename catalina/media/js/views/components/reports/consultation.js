import $ from "jquery";
import _ from "underscore";
import ko from "knockout";
import arches from "arches";
import resourceUtils from "utils/resource";
import reportUtils from "utils/report";
import ConsultationTemplate from "templates/views/components/reports/consultation.htm";
import "views/components/reports/scenes/name";
import "views/components/reports/scenes/json";
import "views/components/reports/scenes/location";
import "views/components/reports/scenes/protection";
import "views/components/reports/scenes/default";
import "bindings/reports";

export default ko.components.register("consultation-report", {
    viewModel: function (params) {
        var self = this;
        params.configKeys = ["tabs", "activeTabIndex"];
        this.configForm = params.configForm || false;
        this.configType = params.configType || "header";

        Object.assign(self, reportUtils);
        self.sections = [
            { id: "details", title: "Consultation Details" },
            { id: "location", title: "Location Data" },
            { id: "references", title: "Planning References" },
            { id: "contacts", title: "Contacts" },
            { id: "progression", title: "Consultation Progression" },
            { id: "correspondence", title: "Correspondence" },
            { id: "sitevisits", title: "Site Visits" },
            { id: "resources", title: "Associated Resources" },
            { id: "json", title: "JSON" },
        ];
        self.reportMetadata = ko.observable(params.report?.report_json);
        self.resource = ko.observable(self.reportMetadata()?.resource);
        self.displayname = ko.observable(
            ko.unwrap(self.reportMetadata)?.displayname
        );
        self.activeSection = ko.observable("details");

        self.nameDataConfig = {
            name: "field assessment names",
            nameChildren: "field assessment name",
            xref: undefined,
            type: undefined,
        };

        self.descriptionDataConfig = {
            descriptions: "field assessment descriptions",
        };

        self.photographsDataConfig = {
            images: "photographs",
        };

        self.locationDataConfig = {
            location: ["field assessment area"],
            addresses: undefined,
            locationDescription: undefined,
            administrativeAreas: "localities/administrative areas",
            nationalGrid: undefined,
            namedLocations: undefined,
        };

        self.protectionDataConfig = {
            protection: undefined,
            areaAssignment: undefined,
            landUse: undefined,
            custodialStatus: undefined,
            recordRegistryMembership: "record and registry membership",
        };

        self.resourcesDataConfig = {
            assets: "related heritage places and areas",
            files: "file(s)",
            relatedApplicationArea: "field assessment area",
            consultations: "associated consultations",
            activities: "associated activities",
            actors: undefined,
            archive: undefined,
            resourceinstanceid: ko.unwrap(self.reportMetadata)
                ?.resourceinstanceid,
        };

        self.nameCards = {};
        self.locationCards = {};
        self.protectionCards = {};
        self.resourcesCards = {};
        self.photographsCards = {};

        self.descriptionCards = {};
        self.summary = params.summary;
        self.cards = {};

        self.visible = {
            references: ko.observable(true),
            systemReferences: ko.observable(true),
            referenceMatauranga: ko.observable(true),
            contacts: ko.observable(true),
            correspondence: ko.observable(true),
            communications: ko.observable(true),
            siteVisits: ko.observable(true),
            proposal: ko.observable(true),
            advice: ko.observable(true),
            action: ko.observable(true),
            outcomes: ko.observable(true),
            assessmentOfSignificance: ko.observable(true),
        };

        self.createTableConfig = function (col) {
            return {
                ...self.defaultTableConfig,
                columns: Array(col).fill(null),
            };
        };

        self.proposalTableConfig = {
            ...self.defaultTableConfig,
            columns: [{ width: "50%" }, { width: "40%" }, null],
        };

        self.adviceTableConfig = {
            ...self.defaultTableConfig,
            columns: [
                { width: "40%" },
                { width: "15%" },
                { width: "10%" },
                { width: "10%" },
                { width: "15%" },
                null,
            ],
        };

        self.actionTableConfig = {
            ...self.defaultTableConfig,
            columns: [
                { width: "50%" },
                { width: "20%" },
                { width: "20%" },
                null,
            ],
        };

        self.attendeesTableConfig = {
            ...self.defaultTableConfig,
            columns: [{ width: "45%" }, { width: "45%" }, null],
        };

        self.observationsTableConfig = {
            ...self.defaultTableConfig,
            columns: [{ width: "70%" }, { width: "20%" }, null],
        };

        self.recommendationsTableConfig = {
            ...self.defaultTableConfig,
            columns: [{ width: "70%" }, { width: "20%" }, null],
        };

        self.fieldDescriptorTableConfig = {
            ...self.defaultTableConfig,
            columns: [{ width: "70%" }, { width: "20%" }, null],
        };

        self.contacts = ko.observable();
        self.references = ko.observableArray();
        self.systemReferences = ko.observableArray();
        self.fieldAssessmentDescriptions = ko.observableArray();
        self.referenceMatauranga = ko.observableArray();
        self.correspondence = ko.observableArray();
        self.communications = ko.observableArray();
        self.siteVisits = ko.observableArray();
        self.proposal = ko.observableArray();
        self.advice = ko.observableArray();
        self.action = ko.observableArray();
        self.outcomes = ko.observable();
        self.assessmentOfSignificance = ko.observableArray();

        const asArray = (rawValue) =>
            rawValue ? (Array.isArray(rawValue) ? rawValue : [rawValue]) : [];

        const fieldAssessmentDescriptionsNode = self.getRawNodeValue(
            self.resource(),
            "field assessment descriptions"
        );
        if (Array.isArray(fieldAssessmentDescriptionsNode)) {
            self.fieldAssessmentDescriptions(
                fieldAssessmentDescriptionsNode.map((node) => {
                    const description = self.getNodeValue(
                        node,
                        "field assessment description"
                    );
                    const fieldDescriptorsNode = self.getRawNodeValue(
                        node,
                        "field descriptor"
                    );
                    const fieldDescriptors = ko.observable(
                        Array.isArray(fieldDescriptorsNode)
                            ? fieldDescriptorsNode.map((descriptorNode) => {
                                  const value = self.getNodeValue(
                                      descriptorNode,
                                      "field descriptor value"
                                  );
                                  const type = self.getNodeValue(
                                      descriptorNode,
                                      "field descriptor type"
                                  );
                                  const tileid =
                                      self.getTileId(descriptorNode);
                                  return { value, type, tileid };
                              })
                            : []
                    );
                    const tileid = self.getTileId(node);
                    return { description, fieldDescriptors, tileid };
                })
            );
        }

        const referencesNode = self.getRawNodeValue(
            self.resource(),
            "external cross references"
        );
        if (Array.isArray(referencesNode)) {
            self.references(
                referencesNode.map((node) => {
                    const reference = self.getNodeValue(
                        node,
                        "external cross reference"
                    );
                    const source = self.getNodeValue(
                        node,
                        "external cross reference source"
                    );
                    const note = self.getNodeValue(
                        node,
                        "external cross reference notes",
                        "external cross reference description"
                    );
                    const noteDescType = self.getNodeValue(
                        node,
                        "external cross reference notes",
                        "external cross reference description type"
                    );
                    const urlJson = self.getNodeValue(node, "url");
                    let url = undefined;
                    let urlLabel = undefined;
                    if (urlJson && urlJson !== "--") {
                        const parsedUrl = JSON.parse(urlJson);
                        url = parsedUrl.url;
                        urlLabel = parsedUrl.url_label || parsedUrl.url;
                    }
                    const tileid = self.getTileId(node);
                    return {
                        reference,
                        source,
                        note,
                        noteDescType,
                        url,
                        urlLabel,
                        tileid,
                    };
                })
            );
        }

        const systemReferencesNode = self.getRawNodeValue(
            self.resource(),
            "references"
        );
        if (Array.isArray(systemReferencesNode)) {
            self.systemReferences(
                systemReferencesNode.map((node) => {
                    const reference = self.getNodeValue(
                        node,
                        "agency identifier",
                        "reference"
                    );
                    const referenceType = self.getNodeValue(
                        node,
                        "agency identifier",
                        "reference type"
                    );
                    const agency = self.getNodeValue(node, "agency");
                    const agencyLink = self.getResourceLink(
                        self.getRawNodeValue(node, "agency")
                    );
                    const tileid = self.getTileId(node);
                    return {
                        reference,
                        referenceType,
                        agency,
                        agencyLink,
                        tileid,
                    };
                })
            );
        }

        const correspondenceNode = self.getRawNodeValue(
            self.resource(),
            "correspondence"
        );
        if (Array.isArray(correspondenceNode)) {
            self.correspondence(
                correspondenceNode.map((node) => {
                    const letter = self.getNodeValue(node, "letter");
                    const letterLink = self.getResourceLink(
                        self.getRawNodeValue(node, "letter")
                    );
                    const letterType = self.getNodeValue(node, "letter type");
                    const tileid = self.getTileId(node);
                    return { letter, letterLink, letterType, tileid };
                })
            );
        }

        const proposalNode = self.getRawNodeValue(self.resource(), "proposal");
        if (Array.isArray(proposalNode)) {
            self.proposal(
                proposalNode.map((node) => {
                    const proposal = self.getRawNodeValue(
                        node,
                        "proposal text",
                        "@display_value"
                    );
                    const file = self.getNodeValue(node, "digital file(s)");
                    const fileLink = self.getResourceLink(
                        self.getRawNodeValue(node, "digital file(s)")
                    );
                    const tileid = self.getTileId(node);
                    return { proposal, file, fileLink, tileid };
                })
            );
        }

        const adviceNode = self.getRawNodeValue(self.resource(), "advice");
        if (Array.isArray(adviceNode)) {
            self.advice(
                adviceNode.map((node) => {
                    const advice = self.getRawNodeValue(
                        node,
                        "advice text",
                        "@display_value"
                    );
                    const adviceType = self.getNodeValue(node, "advice type");
                    const adviceStartDate = self.getNodeValue(
                        node,
                        "advice assignment",
                        "advice timespan",
                        "date advice applied",
                        "@display_value"
                    );
                    const adviceEndDate = self.getNodeValue(
                        node,
                        "advice assignment",
                        "advice timespan",
                        "advice applied end date",
                        "@display_value"
                    );
                    const adviceGivenBy = self.getNodeValue(
                        node,
                        "advice assignment",
                        "advice applied by"
                    );
                    const adviceGivenByLink = self.getResourceLink(
                        self.getRawNodeValue(
                            node,
                            "advice assignment",
                            "advice applied by"
                        )
                    );
                    const tileid = self.getTileId(node);
                    return {
                        advice,
                        adviceType,
                        adviceStartDate,
                        adviceEndDate,
                        adviceGivenBy,
                        adviceGivenByLink,
                        tileid,
                    };
                })
            );
        }

        const actionNode = self.getRawNodeValue(self.resource(), "action");
        if (Array.isArray(actionNode)) {
            self.action(
                actionNode.map((node) => {
                    const action = self.getRawNodeValue(
                        node,
                        "action text",
                        "@display_value"
                    );
                    const actionType = self.getNodeValue(node, "action type");
                    const relatedAdvice = self.getNodeValue(
                        node,
                        "related advice"
                    );
                    const tileid = self.getTileId(node);
                    return { action, actionType, relatedAdvice, tileid };
                })
            );
        }

        const outcomesNode = self.getRawNodeValue(self.resource(), "outcomes");
        if (outcomesNode) {
            const monitoringFrequency = self.getNodeValue(
                outcomesNode,
                "monitoring frequency"
            );
            const auditOutcome = self.getNodeValue(
                outcomesNode,
                "audit outcome"
            );
            const tileid = self.getTileId(outcomesNode);
            self.outcomes({ monitoringFrequency, auditOutcome, tileid });
        }

        const assessmentOfSignificanceNode = self.getRawNodeValue(
            self.resource(),
            "assessment of significance"
        );
        if (Array.isArray(assessmentOfSignificanceNode)) {
            self.assessmentOfSignificance(
                assessmentOfSignificanceNode.map((node) => {
                    const notes = self.getNodeValue(node, "notes");
                    const tileid = self.getTileId(node);
                    return { notes, tileid };
                })
            );
        }

        const communicationsNode = self.getRawNodeValue(
            self.resource(),
            "communications"
        );
        if (Array.isArray(communicationsNode)) {
            self.communications(
                communicationsNode.map((node) => {
                    const subject = self.getNodeValue(
                        node,
                        "subjects",
                        "subject"
                    );
                    const type = self.getNodeValue(node, "communication type");
                    const date = self.getNodeValue(node, "dates", "date");
                    const endDate = self.getNodeValue(
                        node,
                        "dates",
                        "end date"
                    );
                    const attendeesNode = self.getRawNodeValue(
                        node,
                        "attendees"
                    );
                    const attendees = asArray(attendeesNode).map(
                        (attendeeNode) => ({
                            value: self.getNodeValue(attendeeNode),
                            link: self.getResourceLink(attendeeNode),
                        })
                    );
                    const relatedCondition = self.getNodeValue(
                        node,
                        "related condition"
                    );
                    const note = self.getNodeValue(
                        node,
                        "communication notes",
                        "communication description"
                    );
                    const noteType = self.getNodeValue(
                        node,
                        "communication notes",
                        "communication description type"
                    );
                    const followOnAction = self.getNodeValue(
                        node,
                        "follow on actions",
                        "follow-on actions"
                    );
                    const digitalFile = self.getNodeValue(
                        node,
                        "digital file(s)"
                    );
                    const digitalFileLink = self.getResourceLink(
                        self.getRawNodeValue(node, "digital file(s)")
                    );
                    const tileid = self.getTileId(node);
                    return {
                        subject,
                        type,
                        date,
                        endDate,
                        attendees,
                        note,
                        noteType,
                        followOnAction,
                        relatedCondition,
                        digitalFile,
                        digitalFileLink,
                        tileid,
                    };
                })
            );
        }

        const siteVisitsNode = self.getRawNodeValue(
            self.resource(),
            "site visits"
        );
        if (Array.isArray(siteVisitsNode)) {
            self.siteVisits(
                siteVisitsNode.map((node) => {
                    const dateOfVisit = self.getNodeValue(
                        node,
                        "timespan of visit",
                        "date of visit"
                    );
                    const location = self.getNodeValue(
                        node,
                        "location",
                        "location descriptions",
                        "location description"
                    );

                    const attendeesNodes = self.getRawNodeValue(
                        node,
                        "attendees"
                    );
                    const observationsNodes = self.getRawNodeValue(
                        node,
                        "observations"
                    );
                    const recommendationsNodes = self.getRawNodeValue(
                        node,
                        "recommendations"
                    );
                    const photographsNodes = self.getRawNodeValue(
                        node,
                        "photographs"
                    );

                    const attendees = ko.observable(
                        Array.isArray(attendeesNodes)
                            ? attendeesNodes.map((attendeeNode) => {
                                  const attendee = self.getNodeValue(
                                      attendeeNode,
                                      "attendee"
                                  );
                                  const attendeeType = self.getNodeValue(
                                      attendeeNode,
                                      "attendee type"
                                  );
                                  const tileid = self.getTileId(attendeeNode);
                                  return { attendee, attendeeType, tileid };
                              })
                            : []
                    );
                    const observations = ko.observable(
                        Array.isArray(observationsNodes)
                            ? observationsNodes.map((observationNode) => {
                                  const observation = self.getNodeValue(
                                      observationNode,
                                      "observation",
                                      "observation notes"
                                  );
                                  const observedBy = self.getNodeValue(
                                      observationNode,
                                      "observed by"
                                  );
                                  const tileid =
                                      self.getTileId(observationNode);
                                  return { observation, observedBy, tileid };
                              })
                            : []
                    );
                    const recommendations = ko.observable(
                        Array.isArray(recommendationsNodes)
                            ? recommendationsNodes.map((recommendationNode) => {
                                  const recommendation = self.getRawNodeValue(
                                      recommendationNode,
                                      "recommendation",
                                      "recommendation value",
                                      "@display_value"
                                  );
                                  const recommendedBy = self.getNodeValue(
                                      recommendationNode,
                                      "recommended by"
                                  );
                                  const tileid =
                                      self.getTileId(recommendationNode);
                                  return {
                                      recommendation,
                                      recommendedBy,
                                      tileid,
                                  };
                              })
                            : []
                    );
                    const photographs = Array.isArray(photographsNodes)
                        ? photographsNodes.map((photographNode) => {
                              const file = self.getNodeValue(
                                  photographNode,
                                  "file_details",
                                  [0],
                                  "name"
                              );
                              const fileUrl = self.getNodeValue(
                                  photographNode,
                                  "file_details",
                                  [0],
                                  "url"
                              );
                              const caption = self.getNodeValue(
                                  photographNode,
                                  "caption notes",
                                  "caption note"
                              );
                              const copyrightHolder = self.getNodeValue(
                                  photographNode,
                                  "copyright",
                                  "copyright holder"
                              );
                              const copyrightNote = self.getNodeValue(
                                  photographNode,
                                  "copyright",
                                  "copyright note",
                                  "copyright note text"
                              );
                              const copyrightType = self.getNodeValue(
                                  photographNode,
                                  "copyright",
                                  "copyright type"
                              );
                              const tileid = self.getTileId(photographNode);
                              return {
                                  file,
                                  fileUrl,
                                  caption,
                                  copyrightHolder,
                                  copyrightType,
                                  copyrightNote,
                                  tileid,
                              };
                          })
                        : [];
                    const tileid = self.getTileId(node);
                    return {
                        dateOfVisit,
                        location,
                        attendees,
                        observations,
                        recommendations,
                        photographs,
                        tileid,
                    };
                })
            );
        }

        const contactNode = self.getRawNodeValue(self.resource(), "contacts");
        if (contactNode) {
            const consultingContact = self.getNodeValue(
                contactNode,
                "consulting contact"
            );
            const planningOfficer = self.getNodeValue(
                contactNode,
                "planning officers",
                "planning officer"
            );
            const planningOfficerLink = self.getResourceLink(
                self.getRawNodeValue(
                    contactNode,
                    "planning officers",
                    "planning officer"
                )
            );
            const planningBody = self.getNodeValue(
                contactNode,
                "planning officers",
                "planning body"
            );
            const planningBodyLink = self.getResourceLink(
                self.getRawNodeValue(
                    contactNode,
                    "planning officers",
                    "planning body"
                )
            );
            const fieldworker = self.getNodeValue(
                contactNode,
                "fieldworkers",
                "fieldworker"
            );
            const fieldworkerLink = self.getResourceLink(
                self.getRawNodeValue(
                    contactNode,
                    "fieldworkers",
                    "fieldworker"
                )
            );
            const agentsNodes = self.getRawNodeValue(
                contactNode,
                "agents",
                "agent"
            );
            const ownersNodes = self.getRawNodeValue(
                contactNode,
                "owners",
                "owner"
            );
            const applicantsNodes = self.getRawNodeValue(
                contactNode,
                "applicants",
                "applicant"
            );
            const agents = asArray(agentsNodes).map((agentNode) => {
                const agent = self.getNodeValue(agentNode);
                const agentLink = self.getResourceLink(agentNode);
                return { agent, agentLink };
            });
            const owners = asArray(ownersNodes).map((ownerNode) => {
                const owner = self.getNodeValue(ownerNode);
                const ownerLink = self.getResourceLink(ownerNode);
                return { owner, ownerLink };
            });
            const applicants = asArray(applicantsNodes).map(
                (applicantNode) => {
                    const applicant = self.getNodeValue(applicantNode);
                    const applicantLink =
                        self.getResourceLink(applicantNode);
                    return { applicant, applicantLink };
                }
            );
            const tileid = self.getTileId(contactNode);

            self.contacts({
                consultingContact,
                planningOfficer,
                planningOfficerLink,
                planningBody,
                planningBodyLink,
                fieldworker,
                fieldworkerLink,
                agents,
                owners,
                applicants,
                tileid,
            });
        }

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

        if (params.report.cards) {
            const cards = params.report.cards;

            self.cards = self.createCardDictionary(cards);

            // "Contacts" was renamed to "Fieldworker" at the card level (the
            // node/nodegroup name is still "Contacts"), so createCardDictionary's
            // name-keyed lookup can't find it under "contacts"; patch the
            // dictionary entry to point at the correct top-level card, found by
            // nodegroup id instead.
            const contactsCard = cards.find(
                (card) =>
                    card.nodegroupid ===
                    "4ea4a189-184f-11eb-b45e-f875a44e0e11"
            );
            if (contactsCard) {
                self.cards["contacts"] = contactsCard;
            }

            // "External Cross References" collides by name with the nested
            // card of the same name inside Record and Registry Membership, so
            // patch the dictionary entry to point at the correct top-level
            // card, found by nodegroup id instead.
            const externalCrossReferencesCard = cards.find(
                (card) =>
                    card.nodegroupid ===
                    "3b500555-eec2-11eb-b785-a87eeabdefba"
            );
            if (externalCrossReferencesCard) {
                self.cards["external cross references"] =
                    externalCrossReferencesCard;
            }

            self.siteVisitSubCards = self.createCardDictionary(
                self.cards["site visits"].cards()
            );
            self.fieldAssessmentDescriptionSubCards = self.cards[
                "field assessment descriptions"
            ]
                ? self.createCardDictionary(
                      self.cards["field assessment descriptions"].cards()
                  )
                : {};

            self.nameCards = {
                name: self.cards?.["field assessment names"],
                externalCrossReferences:
                    self.cards?.["external cross references"],
                systemReferenceNumbers:
                    self.cards?.["system reference numbers"],
            };
            self.descriptionCards = {
                descriptions: self.cards?.["field assessment descriptions"],
            };
            self.locationCards = {
                cards: self.cards,
                location: {
                    card: null,
                    subCards: {
                        locationGeometry: "field assessment area",
                        administrativeAreas: "localities/administrative areas",
                    },
                },
            };
            self.protectionCards = {
                recordRegistryMembership:
                    self.cards?.["record and registry membership"],
            };
            self.resourcesCards = {
                consultations: self.cards?.["associated consultations"],
                activities: self.cards?.["associated activities"],
                assets: self.cards?.["related heritage places and areas"],
                files: self.cards?.["associated digital files"],
                relatedApplicationArea:
                    self.cards?.["field assessment area"],
            };
        }

        // "Record and Registry Membership" collides by name with a nested
        // card of the same name inside itself, so pick the correct top-level
        // card by nodegroup id instead (same pattern as above).
        if (params.report.cards) {
            const recordRegistryCard = params.report.cards.find(
                (card) =>
                    card.nodegroupid ===
                    "dfa9ad8e-cdc4-56f8-8b93-6b58991fc94b"
            );
            if (recordRegistryCard) {
                self.protectionCards.recordRegistryMembership =
                    recordRegistryCard;
            }
        }

        self.consultationLocationDescription = ko.observable({
            sections: [
                {
                    title: "Field Assessment Area Description",
                    card: self.cards?.["field assessment area"],
                    data: [
                        {
                            key: "Field Assessment Area Description",
                            value: self.getNodeValue(
                                self.resource(),
                                "field assessment area",
                                "geometry",
                                "consultation location descriptions",
                                "field assessment area description"
                            ),
                            type: "kv",
                        },
                    ],
                },
            ],
        });

        self.consultationDetails = ko.observable({
            sections: [
                {
                    title: "Consultation Details",
                    card: self.cards?.["consultation type"],
                    data: [
                        {
                            key: "Consultation Type",
                            value: self.getNodeValue(
                                self.resource(),
                                "consultation type"
                            ),
                            type: "kv",
                        },
                        {
                            key: "Development Type",
                            value: self.getNodeValue(
                                self.resource(),
                                "development type"
                            ),
                            type: "kv",
                        },
                        {
                            key: "Application Type",
                            value: self.getNodeValue(
                                self.resource(),
                                "application type"
                            ),
                            type: "kv",
                        },
                        {
                            key: "Contested Heritage Assignment",
                            value: self.getNodeValue(
                                self.resource(),
                                "contested heritage assignment",
                                "contested heritage"
                            ),
                            type: "kv",
                        },
                        {
                            key: "Consultation Status",
                            value:
                                self.getNodeValue(self.resource(), "status") ==
                                "True"
                                    ? "Active"
                                    : "Inactive",
                            type: "kv",
                        },
                    ],
                },
            ],
        });

        self.consultationDates = ko.observable({
            sections: [
                {
                    title: "Field Assessment Dates",
                    card: self.cards?.["field assessment date"],
                    data: [
                        {
                            key: "Field Assessment Date",
                            value: self.getNodeValue(
                                self.resource(),
                                "field assessment dates",
                                "field assessment date"
                            ),
                            type: "kv",
                        },
                        {
                            key: "Target Date",
                            value: self.getNodeValue(
                                self.resource(),
                                "field assessment dates",
                                "target date",
                                "target date start"
                            ),
                            type: "kv",
                        },
                        {
                            key: "Completion Date",
                            value: self.getNodeValue(
                                self.resource(),
                                "field assessment dates",
                                "completion date"
                            ),
                            type: "kv",
                        },
                    ],
                },
            ],
        });

    },
    template: ConsultationTemplate,
});
