# GEMINI.md — EDU Monitoring System

> Этот файл является обязательной инструкцией для Gemini CLI.
> Основан на `CLAUDE.md` и дополнен системными требованиями Gemini CLI.

## ⚠ СТРОЖАЙШИЙ ЗАПРЕТ (Core Mandate)
**Слово «МОН РК» и любые упоминания Министерства образования и науки РК СТРОГО ЗАПРЕЩЕНЫ.**
Используй только: «система АО „Финансовый центр"», «система мониторинга», «платформа ФЦ».
Это касается кода, комментариев, документации и ответов пользователю.

---

## Стек и Окружение
- **Backend**: FastAPI + SQLAlchemy 2.0 async + PostgreSQL 16 + Celery + Redis.
- **Frontend**: React 18 + TypeScript + Vite + Tailwind.
- **AI**: Google Gemini (flash/pro/flash-lite) — **ТОЛЬКО** через `edu_backend/app/core/gemini_models.py`.
- **Docker**: Использовать `docker compose` (v2). Команды запускать из `edu_backend/`.

---

## Приоритетные правила разработки

### 1. Исследование перед действием (Research First)
- Прежде чем править БД, всегда проверяй реальную схему: `docker compose exec -T postgres psql -U edu_user -d edu_monitoring -c "\d table_name"`. ORM-модели могут быть неполными.
- Перед правкой фронтенда изучи `src/portal.tsx` (основной файл страниц) и `src/features/` (формы).

### 2. Хирургические правки (Surgical Edits)
- Предпочитай `replace` для точечных изменений.
- Не создавай новые файлы, если логика умещается в существующих (например, в `portal.tsx`).
- Соблюдай Brandbook: используй токены `fc-navy`, `fc-blue` и т.д. из `tailwind.config.js` и утилиты из `index.css`.

### 3. Backend & API
- Все API-функции — `async def`.
- Pydantic V2: `model_config = ConfigDict(extra="forbid")`.
- Денежные поля — `Decimal`.
- SQLAlchemy: Не используй `:param::type`, только `CAST(:param AS type)`.
- После правок бэкенда: `docker compose restart api`.

### 4. Frontend
- Используй `useFormContext` в подкомпонентах.
- Валидация перед завершением: `npm run type-check` (или `tsc --noEmit`).
- После правок фронта: `docker compose build frontend && docker compose --profile frontend up -d --force-recreate frontend`.

### 5. Celery & Workers
- Воркеры не используют live mount. После любых изменений в `services/` или `workers/`:
  `docker compose build celery_worker && docker compose up -d --force-recreate celery_worker`.

---

## Процесс верификации (Validation)
- **Bug Fixes**: Сначала воспроизведи баг тестом или скриптом.
- **Tests**: Всегда ищи и обновляй связанные тесты в `edu_backend/tests/`.
- **Linter**: Проверяй код перед сдачей.

---

## Полезные команды (Cheat Sheet)
- **Логи**: `docker compose logs --tail=50 api`
- **Рестарт API**: `docker compose restart api`
- **PSQL**: `docker compose exec -T postgres psql -U edu_user -d edu_monitoring`
- **Build Frontend**: `npm run build` в `edu_frontend/`

---

## Файлы-ориентиры (References)
- `edu_frontend/src/features/finance/FinanceForm.tsx` — эталон формы.
- `edu_backend/app/schemas/finance.py` — эталон схемы Pydantic.
- `edu_backend/app/core/gemini_models.py` — конфигурация AI.
- `edu_backend/app/models/mixins.py` — `FullAuditMixin` (НЕ ТРОГАТЬ).
