# Superset override — allow iframe embedding from EDU portal
# No import from superset.config to avoid circular imports

X_FRAME_OPTIONS = "ALLOWALL"

# Override response headers — this is processed by Superset's after_request hook
HTTP_HEADERS = {"X-Frame-Options": "ALLOWALL"}

FEATURE_FLAGS = {
    "EMBEDDED_SUPERSET": True,
    "ENABLE_TEMPLATE_PROCESSING": True,
}

ENABLE_CORS = True
CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": ["*"],
    "resources": {"r/*": {"origins": "*"}},
}

# Keep CSRF; preserve all default exemptions + add log
WTF_CSRF_ENABLED = True
WTF_CSRF_EXEMPT_LIST = [
    "superset.views.core.log",
    "superset.views.core.explore_json",
    "superset.charts.data.api.data",
]

# Grant Public (guest) role the same permissions as Gamma so embedded
# dashboards are accessible without explicit per-user permission grants.
PUBLIC_ROLE_LIKE = "Gamma"
