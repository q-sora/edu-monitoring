# CLAUDE.md

> Этот файл читается автоматически при запуске Claude Code в директории проекта.
> Содержит постоянный контекст. Если есть инструкция к конкретной сессии — её даст пользователь отдельным сообщением.

## Проект

**EDU Monitoring System** — production система мониторинга образования для **АО «Финансовый центр»** (Казахстан). Self-hosted on-premise на 192.168.13.245.

> ⚠ **ЗАПРЕТ**: Слово «МОН РК» и любые упоминания Министерства образования и науки РК
> в интерфейсе, промптах, комментариях и документации — **СТРОГО ЗАПРЕЩЕНЫ**.
> Система принадлежит и эксплуатируется **АО «Финансовый центр»**.
> Используй: «система АО „Финансовый центр"», «система мониторинга», «платформа ФЦ».

---

## Стек

- **Backend**: FastAPI + SQLAlchemy 2.0 async + PostgreSQL 16 + Celery + Redis
- **Frontend**: React 18 + TypeScript + Vite + Tailwind + recharts
- **Deploy**: Docker Compose v2 (`docker compose`, БЕЗ дефиса — v1 сломан на этой машине)

---

## Структура репозитория

```
edu-monitoring/
├── edu_backend/                         # FastAPI
│   ├── docker-compose.yml               # ← ВСЕ docker команды запускать отсюда
│   ├── .env                             # переменные окружения (gitignored)
│   ├── scripts/
│   │   ├── create_superadmin.py         # Bootstrap суперадмина (--auto читает из .env)
│   │   ├── seed_data.py                 # Справочники + 3 sample ВиПО орг.
│   │   ├── seed_all_subsystems.py       # Сид организаций по всем 5 подсистемам + данные 2020-2025
│   │   ├── seed_edu_assessments.py      # Сид org_indicator_assessments (017)
│   │   ├── seed_trajectory.py           # Сид траекторий студентов
│   │   ├── seed_coefficients.py         # Сид коэффициентов по уровням
│   │   ├── seed_colleges_from_assessment.py
│   │   ├── seed_astana_tippo_2025.py
│   │   ├── seed_comprehensive.py
│   │   ├── gen_bulk_data.py             # Генератор bulk-данных
│   │   └── migrate_college_data.py
│   └── app/
│       ├── main.py                      # app factory, middleware, router mount
│       ├── core/
│       │   ├── config.py                # Settings (pydantic-settings)
│       │   ├── database.py              # async engine, session factories
│       │   ├── redis_client.py          # get/set cache helpers
│       │   └── security.py             # JWT, password hashing
│       ├── models/                      # SQLAlchemy ORM models
│       │   ├── mixins.py               # FullAuditMixin (НЕ ТРОГАТЬ)
│       │   ├── organization.py         # Organization, OrgType, Region
│       │   ├── user.py                 # User, RefreshToken
│       │   ├── contingent.py           # ContingentSnapshot
│       │   ├── finance.py              # FinanceRecord
│       │   ├── science.py              # ScienceActivity
│       │   ├── graduates.py            # GraduatesRecord
│       │   ├── education.py            # EducationalProcess
│       │   └── trajectory.py           # StudentRegistry, StudentSalary и др.
│       ├── schemas/                     # Pydantic V2 schemas
│       │   ├── organization.py         # OrganizationResponse, OrganizationListResponse
│       │   ├── contingent.py           # ContingentSnapshotCreate
│       │   ├── finance.py              # ← эталон схемы
│       │   ├── education.py
│       │   ├── graduates.py
│       │   ├── science.py
│       │   └── trajectory.py
│       ├── api/
│       │   ├── dependencies.py         # Auth, RBAC, session deps
│       │   └── v1/
│       │       ├── auth.py             # Login, refresh, logout
│       │       ├── admin.py            # Regions, organisations list, overview-stats
│       │       ├── college_assessment.py # Рейтинг колледжей ТиПО
│       │       └── trajectory.py       # Аналитика траекторий студентов
│       ├── crud/
│       │   ├── base.py                 # BaseCRUD (upsert, get, list)
│       │   ├── registry.py             # contingent/finance/graduates/education CRUDs
│       │   ├── college_assessment_import.py  # Парсинг Excel оценки колледжей
│       │   ├── data_catalog_import.py
│       │   └── universal_import.py
│       ├── services/
│       ├── migrations/
│       │   └── versions/
│       │       ├── 0000_create_base_tables.py  # ← корневая миграция (base tables + seeds)
│       │       ├── 0001_initial_schema.py       # triggers, RLS, GIN indexes
│       │       ├── 0002_users_table.py          # users, refresh_tokens
│       │       ├── 009_data_catalog.sql
│       │       ├── 010_education_data.sql
│       │       ├── 011_catalog_dimension_tables.sql
│       │       ├── 012_catalog_fields_alter.sql
│       │       ├── 013_college_assessment.sql
│       │       ├── 015_college_assessment_block_scores.sql
│       │       ├── 016_student_trajectory.sql
│       │       └── 017_edu_level_assessments.sql  # org_indicator_assessments
│       └── workers/
│           ├── celery_app.py           # Celery config + beat schedule
│           └── tasks.py               # sync_from_external (НОБД / ЕПВО)
└── edu_frontend/                       # ← КОРЕНЬ ФРОНТА
    ├── tailwind.config.js
    └── src/
        ├── App.tsx                     # Routes
        ├── main.tsx
        ├── index.css                   # Кастомные utility-классы
        ├── api/{client.ts,auth.ts}
        ├── auth/{AuthContext,LoginPage,ProtectedRoute,tokenStore,types}
        ├── layout/AppShell.tsx
        ├── hooks/useApi.ts
        ├── lib/animations.ts
        ├── components/
        │   ├── brand/Logo.tsx
        │   ├── ui/{FormFields,index}.tsx
        │   └── ErrorBoundary.tsx
        ├── pages/NotFoundPage.tsx
        └── features/
            ├── overview/OverviewPage.tsx
            ├── profile/ProfilePage.tsx
            ├── edu-level/              # PreschoolPage, SchoolPage, TippoPage, DopoPage, VipoPage, levelConfig.ts
            ├── tippo/
            │   ├── CollegesPage.tsx          # Рейтинг колледжей (→ /tippo/colleges)
            │   ├── CollegeAssessmentPage.tsx
            │   └── AstanaRatingTab.tsx
            ├── contingent/
            ├── finance/
            ├── education/
            ├── graduates/
            ├── science/
            ├── gdp/GdpMacroPage.tsx
            ├── chain/ChainBreaksPage.tsx
            ├── roi/RoiGraduatePage.tsx
            ├── trajectory/TrajectoryPage.tsx
            ├── compare/CompareEduLevelsPage.tsx
            └── itdata/ItDataPage.tsx
```

---

## База данных

### Справочники (НЕ трогать без причины)
`regions` (19), `org_types` (7), `ownership_forms` (6), `data_sources` (13)
— сидятся автоматически в миграции `0000_create_base_tables.py`.

### Domain data-таблицы (ORM-модели + FullAuditMixin)

| Таблица | Модель | Ключевые поля |
|---|---|---|
| `contingent_snapshots` | `ContingentSnapshot` | `snapshot_date`, `total_count`, `budget_count` |
| `finance_records` | `FinanceRecord` | `period_year`, `period_month`, `annual_budget` |
| `science_activity` | `ScienceActivity` | `period_year`, `publications_scopus`, `grants_json` (JSONB) |
| `graduates_records` | `GraduatesRecord` | `graduation_year`, `graduates_total`, `employed_6m_pct` |
| `educational_process` | `EducationalProcess` | `snapshot_date`, `teachers_total` |

> ⚠ **ВАЖНО**: БД содержит НАМНОГО больше колонок чем маппит SQLAlchemy-модель.
> Если нужна колонка в raw SQL — проверяй через `\d имя_таблицы` прежде чем решить что её нет.

### Специализированные таблицы

| Таблица | Назначение |
|---|---|
| `college_assessment` | Оценка эффективности колледжей ТиПО (Excel import) |
| `college_assessment_specialty` | Специальности колледжей |
| `student_trajectory` | Траектории студентов (016 migration) |
| `audit_log` | Аудит всех изменений |

### Миграции — порядок применения

```
Alembic: 0000 → 0001 → 0002
SQL вручную: 009 → 010 → 011 → 012 → 013 → 015 → 016 → 017
```

014 (`school_rating.sql`) — **не применять**, таблица удалена из кодовой базы.

### `FullAuditMixin` поля
`created_at`, `updated_at`, `created_by`, `updated_by`, `version`, `deleted_at`, `deleted_by`, `submission_status`

---

## API — Endpoints

Все endpoints смонтированы под `/api/v1/`.

### Auth (`/auth`)
- `POST /auth/login` — получить access + refresh токены
- `POST /auth/refresh` — обновить access токен
- `POST /auth/logout` — инвалидировать refresh токен

### Admin (`/admin`)
- `GET /admin/references/regions` — список регионов (публичный)
- `GET /admin/organisations` — список организаций (admin+)
- `GET /admin/overview-stats` — кол-во орг и бюджет по уровням образования (auth)

### College Assessment (`/college-assessment`)
- `POST /college-assessment/import` — загрузить Excel оценки колледжей (admin+)
- `GET /college-assessment/ratings` — рейтинг колледжей с фильтрами
- `GET /college-assessment/stats/overview` — сводка по регионам
- `GET /college-assessment/{id}/specialties` — специальности колледжа
- `GET /college-assessment/top-specialties/employment` — топ специальностей по трудоустройству

### Analytics / Trajectory (`/analytics`)
- `GET /analytics/funnel` — воронка уровней образования
- `GET /analytics/scatter` — scatter: трудоустройство vs. зарплата
- `GET /analytics/patterns` — паттерны перехода между уровнями
- `GET /analytics/table` — табличные данные траекторий

### System
- `GET /health` — liveness probe
- `GET /readiness` — deep probe (DB + Redis)

---

## Celery Tasks

Воркер использует **запечённый Docker-образ** (не live mount).
После изменения Python-кода — **обязательно пересобрать образ**.

```bash
docker compose build celery_worker
docker compose up -d --force-recreate celery_worker
```

### Зарегистрированные tasks

| Task | Описание |
|---|---|
| `sync_from_external` | Синхронизация из НОБД / ЕПВО |

### Beat schedule
- `02:00 AST` — ежедневный НОБД delta sync
- `02:30 AST` — ежедневный ЕПВО delta sync
- `01:00 AST` — еженедельный (понедельник) НОБД full sync

---

## RBAC

| Роль | Доступ |
|---|---|
| `superadmin` | всё |
| `admin` | organisations, college-assessment import, overview |
| `management` | просмотр аналитики |
| `data_entry` | только edu-level страницы |

**Сессии**: `DBSession` = write с RLS, `ReadDBSession` = read-only.

**Superadmin**: `knursagitov@gmail.com` / `Admin2024secure!`

Bootstrap (первый запуск):
```bash
docker compose run --rm api python -m scripts.create_superadmin --auto
```

Если аккаунт заблокирован (failed_login_attempts ≥ 5):
```sql
UPDATE users SET failed_login_attempts=0, locked_until=NULL WHERE email='knursagitov@gmail.com';
```

---

## Frontend — Маршруты

```
/login                       → LoginPage
/overview                    → OverviewPage           (default после логина)
/profile                     → ProfilePage

/edu/preschool               → PreschoolPage          (ДО)
/edu/school                  → SchoolPage             (СО)
/edu/extracurricular         → DopoPage               (ДопО)
/edu/college                 → TippoPage              (ТиПО)
/edu/university              → VipoPage               (ВиПО)

/tippo/colleges              → CollegesPage           (рейтинг колледжей)

/analytics/gdp               → GdpMacroPage
/analytics/chain             → ChainBreaksPage
/analytics/roi               → RoiGraduatePage
/analytics/trajectory        → TrajectoryPage
/analytics/compare           → CompareEduLevelsPage
/analytics/itdata            → ItDataPage

/data/*                      → редиректы на /edu/* (legacy)
```

`data_entry` редиректится на `/edu/school` при входе.

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
# ORM-запросы — entity-based:
select(Model)

# Column-based — load_only() НЕЛЬЗЯ:
select(Model.col1, Model.col2)   # нет .options(load_only(...))

# Named params + PostgreSQL cast:
CAST(:param AS jsonb)    # ✅
:param::jsonb            # ❌ ломает asyncpg

# RLS:
SELECT set_config('app.org_id', :v, false)   # ✅
SET LOCAL app.org_id = :v                    # ❌ утечка между запросами

# Sessions:
DBSession         # write + RLS
ReadDBSession     # read-only (GET endpoints)
get_db_context()  # async context manager для Celery tasks
```

### Pydantic V2

```python
model_config = ConfigDict(extra="forbid")
Optional[Decimal] = Field(None, ge=0)
# Денежные поля — Decimal, никогда float
# Все API-функции — async def
```

> ⚠ **Ловушка `extra="forbid"`**: фронт присылает лишнее поле → 422.
> Порядок: 1) SQL миграция → 2) Pydantic схема → 3) компонент.

---

## Docker — команды

```bash
# Из edu_backend/
docker compose ps

# Контейнеры: edu_api, edu_postgres, edu_redis, edu_celery_worker, edu_celery_beat, edu_frontend

# API (live mount — без пересборки)
docker compose restart api
docker compose logs --tail=50 api

# Frontend (требует пересборки)
docker compose build --no-cache frontend
docker compose --profile frontend up -d --force-recreate frontend

# Celery worker (требует пересборки — НЕ live mount)
docker compose build celery_worker
docker compose up -d --force-recreate celery_worker

# psql
docker compose exec -T postgres psql -U edu_user -d edu_monitoring

# Применить SQL миграцию
docker compose exec -T postgres psql -U edu_user -d edu_monitoring < migrations/versions/016_student_trajectory.sql

# Схема таблицы
docker compose exec -T postgres psql -U edu_user -d edu_monitoring -c "\d table_name"

# Копирование файлов (НЕ docker compose cp)
docker cp /tmp/file.py edu_api:/tmp/file.py
```

---

## Подводные камни

| Ситуация | Что делать |
|---|---|
| Фронт получает 422 | Проверь `extra="forbid"` в схеме — добавь поле |
| Celery task не видит изменений | Пересобери: `docker compose build celery_worker` |
| `load_only()` + column select | Работает ТОЛЬКО с `select(Model)`, не с `select(Model.col)` |
| `:param::jsonb` в SQLAlchemy | Замени на `CAST(:param AS jsonb)` |
| ORM-атрибут не существует | БД шире модели — проверяй `\d table` |
| `TRUNCATE organizations CASCADE` | Каскад валит `users` (FK org_id) — восстанавливать суперадмина вручную |
| bulk INSERT в asyncpg | Оборачивать в `SAVEPOINT sp / RELEASE sp` на каждую строку |
| `docker compose cp` | Не работает — использовать `docker cp <container>:/path` |
| После деплоя фронта | Открыть в инкогнито (сброс кэша) |
| Аудит-mixin `models/mixins.py` | НЕ ТРОГАТЬ — тщательно отлажен |

---

## Минимум для чтения в начале сессии

```
edu_frontend/tailwind.config.js                    # цвета
edu_frontend/src/index.css                         # utility классы
edu_frontend/src/App.tsx                           # маршруты
edu_frontend/src/features/overview/OverviewPage.tsx  # главная страница
edu_backend/app/main.py                            # структура приложения
edu_backend/app/api/v1/college_assessment.py       # эталон endpoints
edu_backend/app/schemas/finance.py                 # эталон схемы
```

## Стиль работы

1. **Диагностика → изменения**, не наоборот
2. **Edit существующего файла** важнее создания нового
3. **API live mount** — `restart api` достаточно; **Celery** — нужен `build + recreate`
4. **Проверять что собирается** после изменений (`tsc --noEmit` для фронта)
5. **Не выдумывать endpoints** — спрашивать пользователя
6. **Не удалять фичи** ради рефакторинга без явного запроса
7. **Краткие отчёты** — не вываливать логи целиком
