# GEMINI.md — EDU Monitoring System

> Обязательная инструкция для Gemini CLI. Основана на `CLAUDE.md`.

## ⚠ СТРОЖАЙШИЙ ЗАПРЕТ

**Слово «МОН РК» и любые упоминания Министерства образования и науки РК СТРОГО ЗАПРЕЩЕНЫ.**
Используй только: «система АО „Финансовый центр"», «система мониторинга», «платформа ФЦ».
Это касается кода, комментариев, документации и ответов пользователю.

---

## Стек и окружение

- **Backend**: FastAPI + SQLAlchemy 2.0 async + PostgreSQL 16 + Celery + Redis
- **Frontend**: React 18 + TypeScript + Vite + Tailwind
- **Docker**: `docker compose` (v2, без дефиса). Команды запускать из `edu_backend/`

---

## Правила разработки

### 1. Исследование перед действием

- Перед правкой БД проверяй реальную схему: `\d table_name` в psql — ORM-модели неполные
- Перед правкой фронтенда смотри `src/App.tsx` (маршруты) и `src/features/` (компоненты)

### 2. Backend

- Все API-функции — `async def`
- Pydantic V2: `model_config = ConfigDict(extra="forbid")`
- Денежные поля — `Decimal`, никогда `float`
- SQLAlchemy text(): `CAST(:param AS jsonb)` — никаких `:param::jsonb`
- Sessions: `DBSession` (write + RLS), `ReadDBSession` (GET endpoints)
- После правок: `docker compose restart api`

### 3. Frontend

- Брендбук: токены `fc-navy`, `fc-blue`, `fc-cyan`, `fc-steel`, `fc-purple` из `tailwind.config.js`
- Утилиты из `index.css`: `.btn-primary`, `.card`, `.pill`, `.label-eyebrow` и т.д. — не хардкодить Tailwind напрямую
- Проверка типов: `tsc --noEmit`
- После правок: `docker compose build frontend && docker compose --profile frontend up -d --force-recreate frontend`

### 4. Celery

- Воркер — запечённый образ, не live mount
- После изменений в `workers/`: `docker compose build celery_worker && docker compose up -d --force-recreate celery_worker`

---

## Полезные команды

```bash
docker compose logs --tail=50 api
docker compose restart api
docker compose exec -T postgres psql -U edu_user -d edu_monitoring
docker compose exec -T postgres psql -U edu_user -d edu_monitoring -c "\d table_name"
```

---

## Файлы-ориентиры

- `edu_frontend/src/App.tsx` — маршруты
- `edu_frontend/src/features/tippo/CollegesPage.tsx` — пример страницы
- `edu_backend/app/api/v1/college_assessment.py` — пример endpoints
- `edu_backend/app/schemas/finance.py` — эталон схемы Pydantic
- `edu_backend/app/models/mixins.py` — `FullAuditMixin` (НЕ ТРОГАТЬ)
