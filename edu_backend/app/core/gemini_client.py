"""
core/gemini_client.py
─────────────────────────────────────────────────────────────────────────────
Shared async HTTP client for all Gemini API calls in the system.

Usage:
    from app.core.gemini_client import gemini_post, GeminiAPIError

    try:
        text = await gemini_post(url, api_key, payload, timeout=60.0)
    except GeminiAPIError as exc:
        # exc.status_code: HTTP status (0 = network/parse error)
        ...

All three services (ai_insights, ai_synthesizer, anomaly_scanner) route
through this function. Error handling and exception translation remain in
each service because they have different needs:
  - ai_insights → FastAPI HTTPException (user-facing HTTP API)
  - ai_synthesizer → RuntimeError (Celery task)
  - anomaly_scanner → silent fallback dict
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class GeminiAPIError(RuntimeError):
    """Raised when the Gemini HTTP call fails or returns unexpected data."""

    def __init__(self, message: str, *, status_code: int = 0):
        super().__init__(message)
        self.status_code = status_code


async def gemini_post(
    url: str,
    api_key: str,
    payload: dict[str, Any],
    *,
    timeout: float = 120.0,
) -> str:
    """
    POST payload to a Gemini generateContent endpoint.

    Returns the raw text from candidates[0].content.parts[0].text.
    Raises GeminiAPIError on HTTP errors, safety blocks, or malformed responses.
    """
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            url,
            params={"key": api_key},
            json=payload,
            headers={"Content-Type": "application/json"},
        )

    if resp.status_code != 200:
        logger.error("Gemini %d at %s: %s", resp.status_code, url, resp.text[:300])
        raise GeminiAPIError(
            f"Gemini API returned {resp.status_code}: {resp.text[:200]}",
            status_code=resp.status_code,
        )

    body = resp.json()
    candidates = body.get("candidates", [])
    if not candidates:
        prompt_feedback = body.get("promptFeedback", {})
        block_reason = prompt_feedback.get("blockReason", "")
        logger.warning("Gemini: no candidates. promptFeedback=%s", prompt_feedback)
        raise GeminiAPIError(
            f"No candidates returned (blockReason={block_reason or 'none'})",
            status_code=resp.status_code,
        )

    candidate = candidates[0]
    content = candidate.get("content", {})
    parts = content.get("parts", [])
    if not parts:
        finish_reason = candidate.get("finishReason", "")
        logger.warning("Gemini: candidate has no parts. finishReason=%s", finish_reason)
        raise GeminiAPIError(
            f"Gemini candidate has no parts (finishReason={finish_reason})",
            status_code=resp.status_code,
        )

    return parts[0]["text"]
