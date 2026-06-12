# ─────────────────────────────────────────────────────────────────────────────
#  EDU Monitoring — Developer Makefile
#  Usage: make <target>
# ─────────────────────────────────────────────────────────────────────────────

.PHONY: help dev stop logs db-shell redis-shell migrate seed test lint typecheck clean

DOCKER_COMPOSE = docker compose

help:
	@echo ""
	@echo "  EDU Monitoring Backend — available commands"
	@echo ""
	@echo "  make dev         Start full local stack (API + Redis + Postgres)"
	@echo "  make stop        Stop all containers"
	@echo "  make logs        Tail API logs"
	@echo "  make migrate     Apply Alembic migrations"
	@echo "  make seed        Seed reference data"
	@echo "  make test        Run pytest suite"
	@echo "  make lint        Run ruff linter"
	@echo "  make typecheck   Run mypy"
	@echo "  make db-shell    Open psql shell"
	@echo "  make redis-shell Open redis-cli"
	@echo "  make clean       Remove containers and volumes"
	@echo ""


# ── Stack management ──────────────────────────────────────────────────────────

dev:
	$(DOCKER_COMPOSE) up -d postgres redis
	sleep 2
	$(DOCKER_COMPOSE) up api celery_worker celery_beat

stop:
	$(DOCKER_COMPOSE) down

logs:
	$(DOCKER_COMPOSE) logs -f api

restart-api:
	$(DOCKER_COMPOSE) restart api


# ── Database ──────────────────────────────────────────────────────────────────

migrate:
	$(DOCKER_COMPOSE) run --rm api alembic upgrade head

migrate-down:
	$(DOCKER_COMPOSE) run --rm api alembic downgrade -1

migrate-history:
	$(DOCKER_COMPOSE) run --rm api alembic history

seed:
	$(DOCKER_COMPOSE) run --rm api python -m scripts.seed_data

db-shell:
	$(DOCKER_COMPOSE) exec postgres psql -U edu_user -d edu_monitoring

redis-shell:
	$(DOCKER_COMPOSE) exec redis redis-cli -a $${REDIS_PASSWORD:-changeme}


# ── Testing ───────────────────────────────────────────────────────────────────

test:
	$(DOCKER_COMPOSE) run --rm api pytest tests/ -v --tb=short

test-coverage:
	$(DOCKER_COMPOSE) run --rm api pytest tests/ \
		--cov=app --cov-report=term-missing --cov-report=html \
		-v --tb=short

test-watch:
	$(DOCKER_COMPOSE) run --rm api \
		ptw tests/ -- -v --tb=short


# ── Code quality ──────────────────────────────────────────────────────────────

lint:
	ruff check app/ tests/ --fix

typecheck:
	mypy app/ --ignore-missing-imports

fmt:
	ruff format app/ tests/

check: lint typecheck


# ── Celery ────────────────────────────────────────────────────────────────────

flower:
	$(DOCKER_COMPOSE) --profile monitoring up flower

worker-logs:
	$(DOCKER_COMPOSE) logs -f celery_worker

purge-queue:
	$(DOCKER_COMPOSE) exec celery_worker \
		celery -A app.workers.celery_app purge -f


# ── Cleanup ───────────────────────────────────────────────────────────────────

clean:
	$(DOCKER_COMPOSE) down -v --remove-orphans
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -name ".pytest_cache" -exec rm -rf {} +
	find . -name "htmlcov" -exec rm -rf {} +

clean-cache:
	$(DOCKER_COMPOSE) exec redis redis-cli -a $${REDIS_PASSWORD:-changeme} FLUSHDB
