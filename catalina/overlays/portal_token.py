"""ArcGIS Portal token minting and caching for proxied overlays."""

import logging
import time
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

CACHE_KEY_PREFIX = "arcgis_portal_token:"
DEFAULT_EXPIRATION_MINUTES = 60
# Refresh ahead of upstream expiry so a token in flight doesn't 498 mid-request.
SAFETY_MARGIN_SECONDS = 60


class PortalTokenError(RuntimeError):
    pass


def _cache_key() -> str:
    return f"{CACHE_KEY_PREFIX}{settings.ARCGIS_PORTAL_URL}"


def get_token() -> str:
    """Return a valid ArcGIS Portal token, minting one if the cache is cold."""
    cached = cache.get(_cache_key())
    if cached:
        return cached
    return _mint_token()


def invalidate_token() -> None:
    """Drop the cached token. Call after upstream returns 401/498."""
    cache.delete(_cache_key())


def _token_generate_url() -> str:
    explicit = getattr(settings, "ARCGIS_PORTAL_TOKEN_GENERATE_URL", "")
    if explicit:
        return explicit
    # Token mint lives at the portal sharing root, not the services prefix.
    # Strip ARCGIS_PORTAL_URL back to scheme+host so we don't inherit any
    # services path (e.g. /hosting/rest/services/Hosted) baked into it.
    # Default assumes the standard Esri Enterprise Portal web context (/portal);
    # override ARCGIS_PORTAL_TOKEN_GENERATE_URL otherwise.
    parsed = urlparse(settings.ARCGIS_PORTAL_URL)
    host = f"{parsed.scheme}://{parsed.netloc}"
    return f"{host}/portal/sharing/rest/generateToken"


def _mint_token() -> str:
    response = requests.post(
        _token_generate_url(),
        data={
            "username": settings.ARCGIS_PORTAL_USERNAME,
            "password": settings.ARCGIS_PORTAL_PASSWORD,
            # requestip binds the token to this server's egress IP, so a
            # leaked token can't be replayed from another host.
            "client": "requestip",
            "expiration": DEFAULT_EXPIRATION_MINUTES,
            "f": "json",
        },
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()

    # ArcGIS often returns HTTP 200 with an error body rather than a 4xx.
    if "error" in payload or "token" not in payload:
        raise PortalTokenError(f"generateToken failed: {payload}")

    token = payload["token"]
    expires_ms = payload["expires"]
    ttl = max(0, int((expires_ms / 1000) - time.time() - SAFETY_MARGIN_SECONDS))
    cache.set(_cache_key(), token, timeout=ttl)
    logger.info("Minted ArcGIS Portal token, cache TTL %ss", ttl)
    return token
