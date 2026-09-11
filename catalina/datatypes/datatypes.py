import logging
import uuid

from arches_querysets.datatypes.resource_types import (
    ResourceInstanceListDataType as ArchesQuerysetsResourceInstanceListDataType,
)

logger = logging.getLogger(__name__)


class ResourceInstanceListDataType(ArchesQuerysetsResourceInstanceListDataType):
    """
    Restores per-related-resource detail in report/API JSON for
    resource-instance-list nodes that hold more than one related resource.

    arches_querysets.datatypes.resource_types.ResourceInstanceListDataType
    (the class normally resolved for the "resource-instance-list" datatype in
    this project, since it's found before arches core's own copy) only
    overrides to_python/get_details/collects_multiple_values, so it inherits
    ResourceInstanceDataType.to_json from arches core. That single-instance
    to_json keeps only the first related resource's id on the node while
    still joining every related resource's name into "@display_value", which
    collapses the "Associated Resources" report links (activities, files,
    archive holders, heritage places, actors, periods) onto the first related
    resource whenever a tile has more than one. This restores the
    list-specific to_json arches core ships for
    arches.app.datatypes.datatypes.ResourceInstanceListDataType, which emits
    an "instance_details" entry (with its own resourceId) per related
    resource.
    """

    def to_json(self, tile, node):
        from arches.app.models.resource import Resource

        data = self.get_tile_data(tile)
        if not data:
            return None

        nodevalue = self.get_nodevalues(data[str(node.nodeid)])
        items = []

        other_resource_ids = set()
        for resource_x_resource in nodevalue:
            try:
                other_resource_ids.add(uuid.UUID(resource_x_resource["resourceId"]))
            except (TypeError, ValueError, KeyError):
                pass
        other_resources = Resource.objects.filter(pk__in=other_resource_ids)

        for resource_x_resource in nodevalue:
            tile_resource_id = uuid.UUID(resource_x_resource["resourceId"])
            related_resource = next(
                (
                    resource
                    for resource in other_resources
                    if resource.pk == tile_resource_id
                ),
                None,
            )
            if related_resource is None:
                logger.info(
                    'Resource with id "%s" not in the system.', tile_resource_id
                )
                continue
            resource_x_resource["display_value"] = related_resource.displayname()
            items.append(resource_x_resource)

        return self.compile_json(tile, node, instance_details=items)
