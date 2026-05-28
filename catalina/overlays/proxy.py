"""Login-gated proxy for ArcGIS Portal feature services.

Routes /overlays/<slug>/<path> to <portal>/rest/services/<mapped>/<path>,
appending the portal token as a query param. One token is shared across all
slugs because it's portal-scoped, not service-scoped.
"""

import logging
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import Http404, JsonResponse
from django.utils.decorators import method_decorator
from revproxy.views import ProxyView

from catalina.overlays.portal_token import get_token, invalidate_token

logger = logging.getLogger(__name__)

# Status codes ArcGIS uses to signal a bad/expired token. 498 is the canonical
# one; 401 covers servers that translate it. On either we refresh and retry once.
TOKEN_REJECTED_STATUSES = (401, 498)


@method_decorator(login_required, name="dispatch")
class ArcGISPortalProxyView(ProxyView):
    add_x_forwarded = False
    add_remote_user = False

    @property
    def upstream(self):
        slug = self.kwargs.get("slug")
        service_path = settings.ARCGIS_PORTAL_SERVICES.get(slug)
        if not service_path:
            raise Http404(f"Unknown overlay slug: {slug!r}")
        portal = settings.ARCGIS_PORTAL_URL.rstrip("/")
        return f"{portal}/{service_path.strip('/')}/"

    def get_encoded_query_params(self):
        base = super().get_encoded_query_params()
        suffix = urlencode([("token", self._token)])
        return f"{base}&{suffix}" if base else suffix

    def dispatch(self, request, slug, path):
        if not (
            settings.ARCGIS_PORTAL_URL
            and settings.ARCGIS_PORTAL_USERNAME
            and settings.ARCGIS_PORTAL_PASSWORD
        ):
            logger.warning(
                "ArcGIS proxy request for slug=%s but portal env "
                "(ARCGIS_PORTAL_URL/USERNAME/PASSWORD) is incomplete",
                slug,
            )
            return JsonResponse(
                {"error": "ArcGIS portal not configured"},
                status=503,
            )

        self._token = get_token()
        response = super().dispatch(request, path=path)

        if response.status_code in TOKEN_REJECTED_STATUSES:
            logger.warning(
                "ArcGIS proxy got %s for slug=%s; refreshing token and retrying",
                response.status_code, slug,
            )
            invalidate_token()
            self._token = get_token()
            response = super().dispatch(request, path=path)

        return response
