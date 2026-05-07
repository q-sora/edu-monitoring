# CLAUDE.md

> Этот файл читается автоматически когда ты (Claude Code) запускаешься в директории
> `/opt/edu-monitoring/`. Он содержит постоянный контекст проекта.
>
> Если есть более полная инструкция к конкретной сессии — её даст пользователь
> отдельным сообщением.

## Проект

**EDU Monitoring System** — production система мониторинга образования и финансирования
госпрограмм для **АО «Финансовый центр»** (Казахстан). Self-hosted on-premise на
192.168.13.245.

> ⚠ **ЗАПРЕТ**: Слово «МОН РК» и любые упоминания Министерства образования и науки РК
> в интерфейсе, промптах, комментариях и документации — **СТРОГО ЗАПРЕЩЕНЫ**.
> Система принадлежит и эксплуатируется **АО «Финансовый центр»**.
> Используй: «система АО „Финансовый центр"», «система мониторинга», «платформа ФЦ».

---

## Стек

- **Backend**: FastAPI + SQLAlchemy 2.0 async + PostgreSQL 16 + Celery + Redis
- **Frontend**: React 18 + TypeScript + Vite + Tailwind + react-hook-form + zod + recharts
- **AI**: Google Gemini API (gemini-2.5-flash, gemini-2.5-pro, gemini-2.5-flash-lite)
- **Deploy**: Docker Compose v2 (`docker compose`, БЕЗ дефиса — v1 сломан на этой машине)

---

## Структура репозитория

```
/opt/edu-monitoring/
├── edu_backend/                         # FastAPI
│   ├── docker-compose.yml               # ← ВСЕ docker команды запускать отсюда
│   ├── .env                             # переменные окружения (gitignored)
│   └── app/
│       ├── main.py                      # app factory, middleware, router mount
│       ├── core/
│       │   ├── config.py                # Settings (pydantic-settings)
│       │   ├── database.py              # async engine, session factories
│       │   ├── gemini_models.py         # ← task-based Gemini routing (единственное место)
│       │   ├── redis_client.py          # get/set cache helpers
│       │   └── security.py             # JWT, password hashing
│       ├── models/                      # SQLAlchemy ORM models
│       │   ├── mixins.py               # FullAuditMixin (НЕ ТРОГАТЬ)
│       │   ├── organization.py         # Organization, OrgType, Region, ApiToken, DataSource
│       │   ├── user.py                 # User, RefreshToken
│       │   ├── contingent.py           # ContingentSnapshot
│       │   ├── finance.py              # FinanceRecord
│       │   ├── science.py              # ScienceActivity
│       │   ├── graduates.py            # GraduatesRecord
│       │   └── education.py            # EducationalProcess
│       ├── schemas/                     # Pydantic V2 schemas
│       │   ├── finance.py              # ← эталон схемы
│       │   ├── presentation.py         # AI Presentations schemas
│       │   └── ...
│       ├── api/
│       │   ├── dependencies.py         # Auth, RBAC, session deps
│       │   └── v1/
│       │       ├── admin.py            # Большинство endpoints
│       │       ├── auth.py             # Login, refresh, logout
│       │       ├── routers.py          # Domain CRUD (contingent, finance, etc.)
│       │       ├── router_factory.py   # Generic CRUD router factory
│       │       ├── science.py          # Science-specific endpoints
│       │       ├── coefficients.py     # Coefficients endpoints
│       │       └── integrations.py     # External data sync
│       ├── services/
│       │   ├── ai_insights.py          # Gemini AI analytics (InsightRequest/Response)
│       │   ├── ai_synthesizer.py       # PresentationGenerator (двухфазная генерация)
│       │   ├── analytics_engine.py     # DataAnalyzer (MAD, rankings, anomalies)
│       │   └── submission.py           # Workflow helpers
│       └── workers/
│           ├── celery_app.py           # Celery config + beat schedule
│           └── tasks.py               # Все Celery tasks
└── edu-portal/edu_frontend/            # ← КОРЕНЬ ФРОНТА именно здесь
    ├── tailwind.config.js
    └── src/
        ├── App.tsx                     # Routes
        ├── portal.tsx                  # 90% компонентов страниц (всё в одном файле)
        ├── index.css                   # Кастомные utility-классы
        ├── api/{client.ts,auth.ts}
        ├── auth/{AuthContext,LoginPage,ProtectedRoute,tokenStore,types}
        ├── components/{brand,layout}/
        └── features/
            ├── contingent/ContingentForm.tsx   # ← эталон формы
            ├── finance/FinanceForm.tsx
            ├── science/ScienceForm.tsx
            ├── graduates/GraduatesForm.tsx
            ├── education/EducationForm.tsx
            ├── transparency/RegionalAnalytics.tsx
            └── coefficients/CoefficientsPage.tsx
```

---

## База данных

### Основные data-таблицы (все с `FullAuditMixin`)

| Таблица | Модель | Ключевые поля |
|---|---|---|
| `contingent_snapshots` | `ContingentSnapshot` | `snapshot_date`, `total_count`, `budget_count` |
| `finance_records` | `FinanceRecord` | `period_year`, `period_month`, `annual_budget`, `expenses_payroll` |
| `science_activity` | `ScienceActivity` | `period_year`, `publications_scopus`, `grants_json` (JSONB) |
| `graduates_records` | `GraduatesRecord` | `graduation_year`, `graduates_total`, `employed_6m_pct` |
| `educational_process` | `EducationalProcess` | `snapshot_date`, `teachers_total`, `mandatory_programs_count` |

> ⚠ **ВАЖНО**: БД содержит НАМНОГО больше колонок чем маппит SQLAlchemy-модель.
> Если нужна колонка в raw SQL — проверяй через `\d имя_таблицы` прежде чем
> решить что её нет. ORM-модель — неполная.

### `FullAuditMixin` поля (все data-таблицы)
`created_at`, `updated_at`, `created_by`, `updated_by`, `version`, `deleted_at`, `deleted_by`

### Workflow статусов
`draft → submitted → under_review → approved | rejected`

### AI-таблицы
- `evaluation_reports` — AI презентации (`status`: pending/generating/done/failed, `slides_json` JSONB)
- `ai_insight_history` — история AI инсайт запросов (по `requested_by`)

### Справочники
`regions` (20), `org_types` (8), `organizations` (реальные организации KZ)

---

## API — Endpoints

Все endpoints смонтированы под `/api/v1/`.

### Публичные (без auth)
- `GET /admin/references/org-types` — типы организаций
- `GET /admin/references/regions` — регионы
- `GET /admin/references/data-sources` — источники данных

### Domain CRUD (`/data/{domain}`)
Генерируются `router_factory.py`. Для каждого из: `contingent`, `finance`, `graduates`, `education`:
- `GET /data/{domain}/` — список записей
- `POST /data/{domain}/` — создать
- `GET /data/{domain}/{id}` — получить
- `PATCH /data/{domain}/{id}` — обновить
- `POST /data/{domain}/{id}/submit` — отправить на согласование
- `POST /data/{domain}/{id}/approve` — согласовать (admin+)
- `POST /data/{domain}/{id}/reject` — отклонить (admin+)

### AI Insights (`/admin/insights`)
- `POST /admin/insights` — генерация (кэш 5 мин в Redis, сохраняет в `ai_insight_history`)
- `GET /admin/insights/history` — история 30 последних запросов текущего пользователя

### AI Presentations (`/admin/presentations`)
- `POST /admin/presentations` — запустить генерацию (возвращает `report_id`, Celery)
- `GET /admin/presentations/{id}` — статус/результат
- `GET /admin/presentations/` — список всех отчётов

### Transparency
- `GET /admin/transparency` — данные для публичной прозрачности (org + финансы + выпускники)
- `GET /admin/regional-stats` — региональная статистика

### Admin
- `GET /admin/organizations` — список организаций
- `POST /admin/organizations` — создать организацию
- `GET /admin/pending-submissions` — ожидающие согласования
- `GET /admin/audit-log` — аудит лог
- `GET /admin/api-keys` — API ключи (superadmin)
- `GET /admin/system-stats` — статистика системы

---

## Сервисный слой

### `DataAnalyzer` (`analytics_engine.py`)
Детерминированные вычисления — НЕ LLM:
- `calculate_regional_deltas()` — YoY изменения по регионам
- `detect_anomalies()` — MAD-score + логические проверки (финансы / контингент / трудоустройство)
- `calculate_rankings()` — многомерный рейтинг по 5 измерениям (finance/contingent/science/graduates/education)
- `build_aggregate_stats()` — агрегаты для заголовочного слайда
- `run_full_analysis()` → `AnalyticsSummary` — главная точка входа из Celery

### `PresentationGenerator` (`ai_synthesizer.py`)
Двухфазная LLM-генерация:
- **Фаза 1**: gemini-2.5-flash → слайды 1-4 (title, metrics, anomalies, rating) — JSON mode, thinking OFF
- **Фаза 2**: gemini-2.5-pro → слайд 5 (стратегические рекомендации) — thinking ON

### `get_insights()` (`ai_insights.py`)
- Строит контекст из БД (`_build_context`) → отправляет в Gemini → парсит JSON
- Кэш в Redis: 5 минут
- Роутинг: Flash (≤3 таблиц и <200 строк) → Pro (≥4 таблиц или ≥200 строк)
- JSON mode включён (`responseMimeType: "application/json"`) — без markdown-обёрток

### `gemini_models.py` — единственный источник конфигурации Gemini

```python
GeminiTask → Model:
  SLIDE_SYNTHESIS     → gemini-2.5-flash   (temp=0.3, max=16384, thinking=OFF)
  SLIDE_DEEP_ANALYSIS → gemini-2.5-pro     (temp=0.5, max=8192,  thinking=ON)
  INSIGHT_QUICK       → gemini-2.5-flash   (temp=0.0, max=16384, thinking=OFF, json_mode)
  INSIGHT_FULL        → gemini-2.5-pro     (temp=0.0, max=16384, thinking=ON,  json_mode)
  INSIGHT_CLASSIFY    → gemini-2.5-flash-lite (temp=0.0, max=512, thinking=OFF)
```

> Никогда не хардкодить имя модели или параметры за пределами `gemini_models.py`.

---

## Celery Tasks

Воркер использует **запечённый Docker-образ** (не live mount).
После изменения Python-кода в worker-коде — **обязательно пересобрать образ**.

```bash
# Пересборка воркера (обязательно после любого изменения worker/services кода)
docker compose build celery_worker
docker compose up -d --force-recreate celery_worker
```

### Зарегистрированные tasks
| Task | Описание |
|---|---|
| `build_ai_presentation` | Запускает DataAnalyzer + PresentationGenerator, сохраняет в `evaluation_reports` |
| `ai_anomaly_scan` | Celery-scan аномалий при submit данных |
| `notify_admins_submission` | Email уведомления при подаче |
| `sync_from_external` | Синхронизация из внешних источников |

### Beat schedule
- `02:00 AST` — ежедневный sync
- `02:30 AST` — ежедневный anomaly scan
- `01:00 AST` — еженедельный (понедельник) отчёт

---

## RBAC

| Роль | Права | Редирект |
|---|---|---|
| `superadmin` | `*` (всё) | `/dashboard` |
| `admin` | users, data.view_all, approve/reject, integrations, ai_insights.view | `/dashboard` |
| `management` | reports.view, ai_insights.view, data.view_all | `/transparency` |
| `data_entry` | data.submit, data.view_own, data.edit_draft | `/data/contingent` |

**Сессии**: `DBSession` = write с RLS, `ReadDBSession` = read-only replica.

**Superadmin UUID**: `d7c06c5b-67db-4ea0-b2ce-136da6201546`
Учётные данные хранятся в `.env.test` (gitignored).

---

## Frontend — Маршруты

```
/login                → LoginPage
/dashboard            → DashboardPage
/transparency         → TransparencyPage        (all roles)
/data/contingent      → ContingentPage          (data.submit)
/data/finance         → FinancePage             (data.submit)
/data/science         → SciencePage             (data.submit)
/data/graduates       → GraduatesPage           (data.submit)
/data/education       → EducationPage           (data.submit)
/data/history         → HistoryPage             (data.submit)
/data/coefficients    → CoefficientsPage        (all roles)
/reports              → AIReportsPage           (ai_insights.view)
/presentations        → PresentationsPage       (ai_insights.view)
/coverage             → CoveragePage            (admin+)
/dashboards           → SupersetDashboardsPage  (all auth)
/admin/organisations  → OrganisationsPage       (admin+)
/admin/users          → UsersPage               (admin+)
/admin/approvals      → ApprovalsPage           (admin+)
/admin/integrations   → IntegrationsPage        (admin+)
/admin/audit          → AuditLogPage            (admin+)
/admin/api-keys       → ApiKeysPage             (superadmin)
```

> Большинство компонентов страниц находятся в `portal.tsx` (один большой файл).
> Feature-specific формы — в `src/features/`.

---

## Брендбук АО «Финансовый центр»

### Цвета (только эти токены из `tailwind.config.js`)
```
fc-navy   #19286d — основной
fc-blue   #0068b4 — государственный синий
fc-cyan   #00a6ca — цифровой
fc-steel  #296695 — инфраструктурный
fc-purple #801e82 — стратегический
success / warning / danger / info — семантические
```

❌ `bg-blue-600`, `text-emerald-500` — НИКОГДА  
✅ `bg-fc-navy-700`, `text-success` — всегда

### Шрифты
- `font-sans` → Inter (body)
- `font-display` → Raleway (заголовки, числа, brand)

### Тон и стиль
- Без эмодзи, без лозунгов — язык расчёта и фактов
- UI-метки UPPERCASE → класс `.label-eyebrow`
- Числа → `tabular-nums` класс

### CSS utility-классы (`index.css`)
```
Кнопки:   .btn-primary  .btn-secondary  .btn-ghost  .btn-danger  .btn-success
Формы:    .input
Карточки: .card  .card-hover
Прочее:   .pill  .data-table  .label-eyebrow
Фоны:     .bg-fc-pattern  .bg-fc-pattern-dark  .bg-fc-gradient
```
Используй ИХ — не хардкодь Tailwind-классы напрямую.

### Цвета доменов (активный таб)
```
Контингент → fc-navy-700
Финансы    → fc-navy-700
Наука      → fc-cyan-500
Выпускники → fc-steel-500
Образование → fc-purple-500
AI/Отчёты  → fc-purple-600
```

### Lucide иконки — размеры
```
w-3    mini (в dense списках)
w-3.5  в кнопках
w-4    стандарт
w-5    заголовки секций
```

---

## Конвенции — строго соблюдать

### SQLAlchemy / SQL

```python
# ORM-запросы — entity-based (load_only совместим):
select(Model)

# Column-based — load_only() НЕЛЬЗЯ:
select(Model.col1, Model.col2)   # ← нет .options(load_only(...))

# JSONB-поля:
func.jsonb_array_length(Model.json_col)  # считать элементы массива
# НЕ использовать несуществующий в ORM атрибут — сначала \d table в psql

# Named params + PostgreSQL cast — НЕЛЬЗЯ :param::type
CAST(:param AS jsonb)    # ✅
:param::jsonb            # ❌ ломает asyncpg парсер параметров

# RLS:
SELECT set_config('app.org_id', :v, false)   # ✅
SET LOCAL app.org_id = :v                    # ❌ утечка между запросами

# Sessions:
DBSession      # write + RLS (через dependency)
ReadDBSession  # read-only replica (GET endpoints)
get_db_context()  # async context manager для Celery tasks
```

### Pydantic V2

```python
model_config = ConfigDict(extra="forbid")   # целевое состояние
Optional[Decimal] = Field(None, ge=0)       # без decimal_places
# Денежные поля — Decimal, никогда float
# Все API-функции — async def
```

> ⚠ **Ловушка `extra="forbid"`**: если фронт присылает поле которого нет в схеме → 422.
> Порядок: 1) SQL миграция → 2) Pydantic схема → 3) форма.

### React

```tsx
useFormContext()    // внутри подкомпонентов форм — НЕ пробрасывать methods пропом
useFieldArray()    // JSONB-массивы
useCallback()      // функции в useEffect deps
```

### Gemini API

```python
# Использовать только через gemini_models.py:
url = get_url_for(task)
cfg = get_generation_config(task, json_mode=True)

# JSON mode обязателен для structured output:
# responseMimeType: "application/json"

# Для Flash задач отключить thinking:
# thinkingConfig: {thinkingBudget: 0}
# (иначе thinking tokens съедают output budget → truncated JSON)

# Pro — thinking всегда включён (нельзя отключить)
```

---

## Docker — команды

```bash
# Статус
docker compose ps

# API (live mount — меняется без пересборки)
docker compose restart api
docker compose logs --tail=50 api

# Frontend (требует пересборки)
docker compose build --no-cache frontend
docker compose --profile frontend up -d --force-recreate frontend

# Celery worker (требует пересборки — НЕ live mount)
docker compose build celery_worker
docker compose up -d --force-recreate celery_worker
docker compose logs --tail=50 celery_worker

# Миграция SQL
docker compose exec -T postgres psql -U edu_user -d edu_monitoring < migration.sql

# Прямой psql
docker compose exec -T postgres psql -U edu_user -d edu_monitoring

# Redis flush (осторожно)
# Через API: force_refresh=true в теле запроса AI insights

# Диагностика схемы таблицы
docker compose exec -T postgres psql -U edu_user -d edu_monitoring -c "\d table_name"
```

> **Profiles**: `--profile frontend` для фронта, `--profile replica` для read-replica,
> `--profile monitoring` для Flower/Superset.

---

## Шаблон формы (эталон — `FinanceForm.tsx`, `ContingentForm.tsx`)

1. Zod-схема в начале файла
2. `useForm` + `FormProvider` + state: `status`, `saving`, `error`, `lastSaved`
3. Header: pill статуса + кнопки «Сохранить» / «На согласование»
4. Tabs с горизонтальным скроллом, активный таб — в цвете домена
5. `<fieldset disabled={isReadOnly}>` для submitted/approved
6. Helper-компоненты: `NumField`, `MoneyField` (₸ + tabular-nums), `PercentField` (%), `DateField`, `SelectField`, `TextField`, `SectionHeader`, `StatusPill`
7. JSONB-репитеры через `useFieldArray`

---

## Подводные камни

| Ситуация | Что делать |
|---|---|
| Фронт получает 422 | Проверь extra="forbid" в схеме — добавь поле в схему до формы |
| Celery task не видит изменений | Пересобери образ: `docker compose build celery_worker` |
| `load_only()` + column select | `load_only()` работает ТОЛЬКО с `select(Model)`, не с `select(Model.col)` |
| `:param::jsonb` в SQLAlchemy text() | Замени на `CAST(:param AS jsonb)` — asyncpg ломается на `::` |
| ORM-атрибут не существует | БД шире модели — проверяй `\d table` прежде чем решить |
| Gemini JSON обрезан | Flash: thinkingBudget=0. Увеличь maxOutputTokens |
| Gemini возвращает markdown-фенсы | Используй `responseMimeType: "application/json"` (json_mode=True) |
| Decimal not JSON serializable | Используй `_SafeEncoder` из `ai_insights.py` или `float(v)` |
| iOS зумит инпуты | font-size: 16px — уже в `@layer base`, не убирать |
| После деплоя фронта | Советуй пользователю открыть в инкогнито |
| Аудит-mixin `models/mixins.py` | НЕ ТРОГАТЬ без крайней нужды — тщательно отлажен |
| Пароли в audit_log | Маскируются как `"***"` — by design |

---

## Минимум для чтения в начале сессии

```
edu-portal/edu_frontend/tailwind.config.js      # цвета
edu-portal/edu_frontend/src/index.css            # utility классы
edu-portal/edu_frontend/src/portal.tsx           # все страницы
edu-portal/edu_frontend/src/features/finance/FinanceForm.tsx  # эталон формы
edu_backend/app/main.py                          # структура приложения
edu_backend/app/schemas/finance.py               # эталон схемы
edu_backend/app/core/gemini_models.py            # AI конфигурация
```

## Стиль работы

1. **Диагностика → изменения**, не наоборот
2. **Edit существующего файла** важнее создания нового
3. **API live mount** — `restart api` достаточно; **Celery** — нужен `build + recreate`
4. **Проверять что собирается** после изменений (`tsc --noEmit` для фронта)
5. **Не выдумывать endpoints** — спрашивать пользователя
6. **Не удалять фичи** ради рефакторинга без явного запроса
7. **Краткие отчёты** — не вываливать логи целиком
