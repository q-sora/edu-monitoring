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

# ── Корпоративная палитра АО «Финансовый центр» ────────────────────────────
# Добавляет схему "FinancialCenter" во все дашборды.
# isDefault=True — схема выбирается автоматически для новых чартов.
EXTRA_CATEGORICAL_COLOR_SCHEMES = [
    {
        "id":          "financial_center",
        "description": "АО Финансовый центр — корпоративная палитра",
        "label":       "FinancialCenter",
        "isDefault":   True,
        "colors": [
            "#19286d",  # fc-navy  — основной
            "#0068b4",  # fc-blue  — государственный синий
            "#00a6ca",  # fc-cyan  — цифровой
            "#296695",  # fc-steel — инфраструктурный
            "#801e82",  # fc-purple — стратегический
            "#1e293b",  # slate-800 — нейтральный тёмный
            "#c47200",  # warning  — предупреждение
            "#0e8c5a",  # success  — успех
        ],
    }
]

# Цвета по умолчанию для новых чартов (вместо стандартной Superset-палитры)
PREFERRED_COLORS = [
    "#19286d",
    "#0068b4",
    "#00a6ca",
    "#296695",
    "#801e82",
    "#1e293b",
    "#c47200",
    "#0e8c5a",
]

# Шрифты (загружаются через Google Fonts в браузере)
EXTRA_SEQUENTIAL_COLOR_SCHEMES = []

# Брендовый заголовок страницы
APP_NAME = "EDU Analytics — АО Финансовый центр"
APP_ICON = "/static/assets/images/superset-logo-horiz.png"
FAVICONS = [{"href": "/static/assets/images/favicon.png"}]
