"""
core/gemini_models.py
─────────────────────────────────────────────────────────────────────────────
Реестр моделей Gemini API с task-based routing.

Актуальные модели (проверены через /v1beta/models 2025-05-05):

  gemini-2.5-flash       — 1M ctx, 65K out, thinking=YES, cache, batch.
                           Лучший баланс скорость/качество. Рекомендован
                           для структурированных JSON-задач и интерактивных запросов.

  gemini-2.5-pro         — 1M ctx, 65K out, thinking=YES, cache, batch.
                           Наилучшее рассуждение. Для комплексного анализа
                           и стратегических рекомендаций.

  gemini-2.5-flash-lite  — 1M ctx, 65K out, thinking=YES, cache, batch.
                           Ультрабыстрый. Для классификации и коротких ответов.

  gemini-2.0-flash       — 1M ctx, 8K out. Без thinking. Для простых задач
                           с малым выводом.

  deep-research-pro-preview-12-2025 — 131K ctx, 65K out, thinking=YES.
                           Grounded research. Только для долгих фоновых задач.
"""
from __future__ import annotations

from enum import Enum

GEMINI_BASE_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)


class GeminiModel(str, Enum):
    """Рекомендованные модели для задач проекта."""

    # ── Основные ──────────────────────────────────────────────────────────────
    FLASH      = "gemini-2.5-flash"        # быстро + умно + JSON
    PRO        = "gemini-2.5-pro"          # максимальное качество анализа
    FLASH_LITE = "gemini-2.5-flash-lite"   # мгновенный ответ, малый контекст

    # ── Специальные ───────────────────────────────────────────────────────────
    FLASH_2    = "gemini-2.0-flash"        # legacy, 8K output
    DEEP       = "deep-research-pro-preview-12-2025"  # web-grounded


# ── Task → Model mapping ──────────────────────────────────────────────────────

class GeminiTask(str, Enum):
    """Семантические задачи — используй их, а не имена моделей напрямую."""

    # Презентация
    SLIDE_SYNTHESIS     = "slide_synthesis"    # генерация JSON слайдов
    SLIDE_DEEP_ANALYSIS = "slide_deep_analysis" # стратегические рекомендации

    # AI Insights
    INSIGHT_QUICK       = "insight_quick"      # быстрый ответ на вопрос
    INSIGHT_FULL        = "insight_full"       # комплексный аудит / много данных
    INSIGHT_CLASSIFY    = "insight_classify"   # классификация аномалий (1-2 предложения)

    # Будущие задачи
    DEEP_RESEARCH       = "deep_research"      # веб-исследование по сектору


_TASK_MODEL_MAP: dict[GeminiTask, GeminiModel] = {
    GeminiTask.SLIDE_SYNTHESIS:     GeminiModel.FLASH,      # JSON mode, быстро
    GeminiTask.SLIDE_DEEP_ANALYSIS: GeminiModel.PRO,        # глубина для рекомендаций
    GeminiTask.INSIGHT_QUICK:       GeminiModel.FLASH,      # интерактивный запрос
    GeminiTask.INSIGHT_FULL:        GeminiModel.PRO,        # полный скан всех данных
    GeminiTask.INSIGHT_CLASSIFY:    GeminiModel.FLASH_LITE, # классификация
    GeminiTask.DEEP_RESEARCH:       GeminiModel.DEEP,
}

_TASK_TEMPERATURE: dict[GeminiTask, float] = {
    GeminiTask.SLIDE_SYNTHESIS:     0.3,   # структурированный JSON вывод
    GeminiTask.SLIDE_DEEP_ANALYSIS: 0.5,   # немного творчества в рекомендациях
    GeminiTask.INSIGHT_QUICK:       0.0,   # детерминированный фактологический анализ
    GeminiTask.INSIGHT_FULL:        0.0,   # детерминированный фактологический анализ
    GeminiTask.INSIGHT_CLASSIFY:    0.0,   # классификация — строго детерминировано
    GeminiTask.DEEP_RESEARCH:       0.7,
}

_TASK_MAX_TOKENS: dict[GeminiTask, int] = {
    GeminiTask.SLIDE_SYNTHESIS:     16384,  # increased: thinking eats into budget
    GeminiTask.SLIDE_DEEP_ANALYSIS: 8192,
    GeminiTask.INSIGHT_QUICK:       16384,
    GeminiTask.INSIGHT_FULL:        16384,
    GeminiTask.INSIGHT_CLASSIFY:    512,
    GeminiTask.DEEP_RESEARCH:       16384,
}

# Tasks that should disable thinking to avoid truncation on structured JSON output.
# Flash supports thinkingBudget=0; Pro ignores it (thinking always on).
_TASK_DISABLE_THINKING: set[GeminiTask] = {
    GeminiTask.SLIDE_SYNTHESIS,   # structured JSON — thinking wastes output budget
    GeminiTask.INSIGHT_QUICK,     # interactive — fast deterministic JSON
    GeminiTask.INSIGHT_CLASSIFY,  # very short deterministic output
}


def get_model_for(task: GeminiTask) -> GeminiModel:
    return _TASK_MODEL_MAP[task]


def get_url_for(task: GeminiTask) -> str:
    model = _TASK_MODEL_MAP[task].value
    return GEMINI_BASE_URL.format(model=model)


def get_generation_config(task: GeminiTask, *, json_mode: bool = False) -> dict:
    cfg: dict = {
        "temperature":     _TASK_TEMPERATURE[task],
        "maxOutputTokens": _TASK_MAX_TOKENS[task],
    }
    if json_mode:
        cfg["responseMimeType"] = "application/json"
    if task in _TASK_DISABLE_THINKING:
        cfg["thinkingConfig"] = {"thinkingBudget": 0}
    return cfg


def model_display_name(task: GeminiTask) -> str:
    """Имя модели для записи в БД / логах."""
    return _TASK_MODEL_MAP[task].value


# ─────────────────────────────────────────────────────────────────────────────
# Dynamic model discovery  (cached, 1-hour TTL)
# ─────────────────────────────────────────────────────────────────────────────

import time
import logging as _logging
from dataclasses import dataclass, field as _field

_disc_logger = _logging.getLogger(__name__)

LIST_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models"


@dataclass
class ModelRoles:
    """
    Dynamically discovered model assignments for the Agentic Orchestrator.

      orchestrator — most capable Pro model  → Planning phase
      writer       — fastest Flash model     → Writing phase
      designer     — lightest model          → Classification / fallback

    Falls back to hardcoded defaults if discovery fails.
    """
    orchestrator:  str
    writer:        str
    designer:      str
    all_models:    list[str] = _field(default_factory=list)
    discovered_at: float     = 0.0


_model_roles_cache: Optional[ModelRoles] = None
_CACHE_TTL = 3600.0


async def discover_model_roles(api_key: str) -> ModelRoles:
    """
    Calls GET /v1beta/models, picks roles from live model list.

    Role assignment rules:
      orchestrator — first model whose name contains 'pro' (prefer 2.5-pro)
      writer       — first 'flash' model, excluding 'lite' / 'nano'
      designer     — first 'lite' or 'nano' model
    """
    global _model_roles_cache

    now = time.monotonic()
    if _model_roles_cache and (now - _model_roles_cache.discovered_at) < _CACHE_TTL:
        return _model_roles_cache

    try:
        import httpx
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                LIST_MODELS_URL,
                params={"key": api_key, "pageSize": "50"},
            )
            resp.raise_for_status()

        raw = resp.json().get("models", [])
        # keep only models that can generate content
        model_ids = [
            m["name"].replace("models/", "")
            for m in raw
            if "generateContent" in m.get("supportedGenerationMethods", [])
        ]
        # newest version first  (2.5 > 2.0 > 1.5 lexicographically reversed)
        model_ids.sort(reverse=True)

        orchestrator = _pick_role(model_ids, ["2.5-pro", "1.5-pro", "pro"],
                                  exclude=["tts", "vision", "embedding", "aqa", "image"])
        writer       = _pick_role(model_ids, ["2.5-flash", "1.5-flash", "flash"],
                                  exclude=["lite", "nano", "tts", "vision", "embedding", "image"])
        designer     = _pick_role(model_ids, ["flash-lite", "lite", "nano", "2.0-flash"],
                                  exclude=["tts", "vision", "embedding", "image"])

        roles = ModelRoles(
            orchestrator  = orchestrator or GeminiModel.PRO.value,
            writer        = writer       or GeminiModel.FLASH.value,
            designer      = designer     or GeminiModel.FLASH_LITE.value,
            all_models    = model_ids,
            discovered_at = now,
        )
        _model_roles_cache = roles
        _disc_logger.info(
            "Model discovery complete: orchestrator=%s writer=%s designer=%s (%d total)",
            roles.orchestrator, roles.writer, roles.designer, len(model_ids),
        )
        return roles

    except Exception as exc:
        _disc_logger.warning("Model discovery failed, using hardcoded defaults: %s", exc)
        return ModelRoles(
            orchestrator  = GeminiModel.PRO.value,
            writer        = GeminiModel.FLASH.value,
            designer      = GeminiModel.FLASH_LITE.value,
            discovered_at = now,
        )


def _pick_role(
    models: list[str],
    patterns: list[str],
    exclude: list[str] | None = None,
) -> Optional[str]:
    """Return first model matching any pattern, excluding models with any exclude substring."""
    exclude = exclude or []
    for pattern in patterns:
        for m in models:
            if pattern in m and all(ex not in m for ex in exclude):
                return m
    return None
