# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile — multi-stage build
# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: deps — install Python dependencies in an isolated layer
# Stage 2: production — minimal runtime image (~180MB vs ~800MB full)
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.12-slim AS deps

WORKDIR /build

# Install build tools for asyncpg and cryptography (compiled C extensions)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev libssl-dev cargo \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Production stage ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS production

# Non-root user (security best practice for government systems)
RUN addgroup --system edu && adduser --system --group edu

WORKDIR /app

# Copy only installed packages from deps stage
COPY --from=deps /install /usr/local

# Copy application code
COPY . .

# Fix ownership
RUN chown -R edu:edu /app

USER edu

# Gunicorn is the production entrypoint; uvicorn --reload for development
CMD ["gunicorn", "app.main:app", \
     "--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "30", \
     "--keepalive", "5", \
     "--log-level", "info", \
     "--access-logfile", "-"]

EXPOSE 8000
