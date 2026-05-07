# Промпт для Claude Code на сервере 192.168.13.245

> **Как использовать:**
> 1. SSH на сервер: `ssh root@192.168.13.245`
> 2. Запусти Claude Code в корне проекта: `cd /opt/edu-monitoring && claude`
> 3. Скопируй ВЕСЬ блок ниже (от `# КОНТЕКСТ ПРОЕКТА` до конца файла) одним сообщением.
> 4. Claude Code сам прочитает указанные файлы и начнёт работу.

---

# КОНТЕКСТ ПРОЕКТА

Ты подключаешься к проекту **EDU Monitoring System** — production-ready системе мониторинга
образования и финансирования госпрограмм для **АО «Финансовый центр»** (Казахстан).

Проект разрабатывался с другой инстанцией Claude (через веб-интерфейс) в течение нескольких
месяцев. Сейчас я (пользователь) только что задеплоил большой пакет изменений на этот сервер
и хочу чтобы ты продолжил работу в том же темпе и стиле.

## Твоя задача в первой сессии

1. **Прочитать и понять** текущее состояние проекта (файлы — ниже)
2. **Проверить что недавно задеплоенное реально работает** (smoke-tests)
3. **Найти и починить** возможные ошибки сборки/рантайма после деплоя
4. **Спросить меня** что делать дальше из спланированного roadmap

## Стек

- **Backend**: FastAPI 0.111+ (Python 3.12), SQLAlchemy 2.0 async, asyncpg, Pydantic V2,
  Celery + Redis, python-jose JWT (HS256), bcrypt
- **Database**: PostgreSQL 16 (полностью локально, никаких managed services)
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS, react-hook-form + zod,
  axios, lucide-react
- **Deployment**: Docker Compose v2 (`docker compose` без дефиса)
- **Server**: ai-srv с IP 192.168.13.245, всё self-hosted on-premise

## Структура проекта на этом сервере

```
/opt/edu-monitoring/
├── edu_backend/                    ← FastAPI
│   ├── app/
│   │   ├── main.py                (CORS allow_origins хардкодит 192.168.13.245:3000)
│   │   ├── core/                  (config.py, database.py, security.py, redis_client.py)
│   │   ├── models/                (mixins.py, user.py, science.py, contingent.py, ...)
│   │   ├── schemas/               (science.py, contingent.py, finance.py, graduates.py, education.py)
│   │   ├── crud/                  (base.py, science.py, registry.py)
│   │   ├── api/
│   │   │   ├── dependencies.py
│   │   │   └── v1/                (auth.py, admin.py, integrations.py, science.py,
│   │   │                           references.py)
│   │   └── workers/               (celery_app.py, tasks.py)
│   ├── docker-compose.yml         (frontend service: build context = ../edu-portal/edu_frontend)
│   ├── Dockerfile
│   └── requirements.txt
│
└── edu-portal/
    └── edu_frontend/              ← КОРЕНЬ ФРОНТА именно здесь, не путать
        ├── src/
        │   ├── api/               (client.ts с API_BASE = "http://192.168.13.245:8000/api/v1")
        │   ├── auth/              (AuthContext.tsx, LoginPage.tsx, ProtectedRoute.tsx, ...)
        │   ├── components/
        │   │   ├── brand/Logo.tsx        ← inline-SVG логотип Финансового центра
        │   │   └── layout/BrandHeader.tsx
        │   ├── features/
        │   │   ├── contingent/ContingentForm.tsx   (12 вкладок)
        │   │   ├── finance/FinanceForm.tsx         (13 вкладок) ← задеплоено только что
        │   │   ├── science/ScienceForm.tsx         (9 вкладок)  ← задеплоено только что
        │   │   ├── graduates/GraduatesForm.tsx     (7 вкладок)  ← задеплоено только что
        │   │   └── education/EducationForm.tsx     (7 вкладок)  ← задеплоено только что
        │   ├── App.tsx
        │   ├── portal.tsx                ← ВСЕ страницы + AppShell + Sidebar в одном файле
        │   ├── index.css                 (Inter+Raleway, fc-* tokens, .input/.btn/.card layers)
        │   └── vite-env.d.ts
        ├── Dockerfile
        ├── nginx.conf
        ├── tailwind.config.js
        └── package.json
```

## Что недавно было задеплоено (конец апреля 2026)

В этой деплой-сессии только что применили 3 крупных пакета.

> **Хронология деплоев** (чтобы ты понимал что старое vs новое):
>
> 1. **До этой сессии** — уже работало:
>    - Базовая FastAPI + auth + RBAC + audit_log
>    - 16 страниц UI: Dashboard, Users, Organisations, Approvals, AuditLog,
>      Integrations, ApiKeys, ContingentPage, FinancePage (упрощённая), SciencePage
>      (упрощённая), GraduatesPage (упрощённая), EducationPage (упрощённая),
>      HistoryPage, AIReportsPage, ProfilePage, NotFoundPage
>    - Миграции `001_seed_reference_data.sql` (12 ВУЗов, 30 специальностей)
>      и `002_extend_contingent_snapshots.sql` (~85 колонок)
>    - `ContingentForm.tsx` с 12 вкладками
>    - References API (`/api/v1/references/*`)
>    - Множество багфиксов (audit-mixin, RLS, refresh-tokens jti, и т.д.)
>
> 2. **Эта деплой-сессия** добавила то что описано ниже (A/B/C).
>    Если в коде встречаются файлы из категории "1" — это **не недоделанные**,
>    они уже работают.

### A. РЕБРЕНДИНГ под брендбук АО «Финансовый центр»

Полный визуальный ребрендинг под официальный брендбук декабря 2025 года.

**Цветовая палитра** (теперь в `tailwind.config.js`):
- `fc-navy` `#19286d` — основной (тёмный синий из брендбука)
- `fc-blue` `#0068b4` — государственный синий (CTA)
- `fc-cyan` `#00a6ca` — бирюзово-цифровой
- `fc-steel` `#296695` — стальной (инфраструктура)
- `fc-purple` `#801e82` — стратегические акценты

Каждый имеет шкалу 50–900. Семантические алиасы: `success`, `warning`, `danger`, `info`.

**Шрифты**: Inter (font-sans) + Raleway (font-display) грузятся из Google Fonts через
`@import` в `src/index.css`.

**Тон коммуникации** (по брендбуку): «язык расчёта, моделей и решений; без декларативных
лозунгов; акцент на управляемость, сопоставимость и результат». Все тексты в UI должны
следовать этому тону. **Никаких эмодзи в продакшен-UI**, никаких маркетинговых лозунгов.

**Новый логотип** — три диагональных штриха как inline-SVG в `src/components/brand/Logo.tsx`.
Не PNG, не отдельный файл. Перекрашивается через `variant="white"` или `currentColor`.

**Утилитарные классы** в `index.css` (используй ИХ вместо хард-кода):
- `.btn-primary / .btn-secondary / .btn-ghost / .btn-danger / .btn-success` (+ `.btn-sm/lg`)
- `.input` (+ `.input-sm/lg/error`)
- `.card`, `.card-hover` с фирменными тенями `shadow-fc-sm/md/lg/xl`
- `.label-eyebrow` — UPPERCASE метки с трекингом 0.18em (font-weight: bold, text-[10px])
- `.pill` — статусные бейджи
- `.data-table` — единый стиль таблиц
- `.bg-fc-pattern` / `.bg-fc-pattern-dark` — декоративный паттерн диагональных штрихов
- `.bg-fc-gradient` — navy градиент 135deg для hero-секций

**Новый раздел `/transparency`** — приоритет ребрендинга. Сейчас содержит hero + placeholder
KPI-карточки. Реальная аналитика — следующая фаза.

### B. Большие tabbed-формы для 4 доменов (Finance/Science/Graduates/Education)

Каждая форма — отдельный файл в `src/features/<domain>/`. Используют `react-hook-form` +
`zodResolver`. Все следуют ОДНОЙ архитектуре:

1. Zod-схема в начале файла
2. Главный компонент с `useForm`, `FormProvider`, локальный state для статуса/saving/error
3. Header с pill-статусом, кнопками «Сохранить черновик» / «На согласование»
4. Tabs с горизонтальным скроллом (на мобильных), активный таб в брендовом цвете домена:
   - Контингент → `fc-navy-700` (по умолчанию)
   - Финансы → `fc-navy-700`
   - Наука → `fc-cyan-500`
   - Выпускники → `fc-steel-500`
   - Образование → `fc-purple-500`
5. `<fieldset disabled={isReadOnly}>` оборачивает все поля (статусы submitted/approved → readonly)
6. Helper-компоненты в файле (в каждой форме своё подмножество): `NumField`,
   `MoneyField` (с ₸), `PercentField` (с %), `DateField`, `SelectField`,
   `SectionHeader`, `StatusPill`. `TextField` есть только в FinanceForm — если
   нужен в другой форме, копируй оттуда.
7. JSONB-репитеры через `useFieldArray` (там где есть вложенные массивы — гранты,
   партнёры, работодатели)

**ОЧЕНЬ ВАЖНО — следуй этому шаблону когда добавляешь поля или новые формы.**
Не изобретай свои паттерны. Если нужно изменить шаблон — меняй везде синхронно.

### C. SQL-миграции

Применены через `docker compose exec -T postgres psql ... < file.sql`:

- `001_seed_reference_data.sql` — справочники (20 регионов KZ, 12 реальных ВУЗов с UUID
  `a1111111-1111-1111-1111-111111111111` до `b3333333-...`, 30 специальностей,
  типы организаций, формы собственности/обучения/языков)
- `002_extend_contingent_snapshots.sql` — ~85 колонок
- `003_extend_finance_records.sql` — ~110 колонок (доходы/расходы/коэффициенты прозрачности)
- `004_extend_science_activity.sql` — ~85 колонок
- `005_extend_graduates_records.sql` — ~80 колонок
- `006_extend_educational_process.sql` — ~75 колонок

Все миграции **идемпотентны** (`ADD COLUMN IF NOT EXISTS`). Повторный запуск безопасен.

## База данных — 7 подсистем

Главные data-таблицы (все имеют `FullAuditMixin`: `created_at`, `updated_at`,
`created_by`, `updated_by`, `version` для optimistic lock, `deleted_at`, `deleted_by`):

- `organizations` (UUID PK)
- `contingent_snapshots`
- `science_activity`
- `finance_records`
- `graduates_records`
- `educational_process`

Auth/системные:

- `users`
- `refresh_tokens` (с jti UNIQUE индексом — O(1) lookup)
- `audit_log`
- `api_tokens`

Справочники: `regions`, `org_types`, `ownership_forms`, `study_forms`, `study_languages`,
`specialties`.

JSONB поля где встречаются: `grants_json`, `by_specialty_json`, `by_country_json`,
`by_region_json`, `employer_partners_json`, `visiting_partners_json`.

Submission workflow на data-таблицах:
`draft → submitted → under_review → approved | rejected`

## RBAC — 4 роли

| Роль | Доступ |
|---|---|
| `superadmin` | всё + API keys + audit |
| `admin` | согласование заявок + пользователи + интеграции |
| `management` | AI отчёты + аудит + Прозрачность (read-only). Редиректится на `/transparency` |
| `data_entry` | только свой `org_id`, ввод данных. Редиректится на `/data/contingent` |

## Тестовый суперадмин (НЕ менять, нужен для проверок)

```
UUID:     d7c06c5b-67db-4ea0-b2ce-136da6201546
Email:    knursagitov@gmail.com
Role:     superadmin
org_id:   null
```

**Пароль я НЕ помещаю в этот текст по соображениям безопасности.** Он лежит на сервере
в `/opt/edu-monitoring/.env.test` (этот файл должен быть в `.gitignore`). При smoke-тестах
загружай его через:

```bash
source /opt/edu-monitoring/.env.test     # переменная TEST_SUPERADMIN_PASSWORD
```

Если файла нет — попроси меня его создать перед запуском smoke-test'ов.

## Критичные API endpoints (все уже существуют, проверены через openapi.json)

```
POST /auth/login                           # JWT access + refresh
POST /auth/refresh                         # обновление access токена
POST /auth/logout                          # инвалидация refresh
GET  /auth/me                              # текущий пользователь
POST /auth/change-password
POST /auth/register                        # superadmin/admin only

GET  /admin/organisations                  # список с пагинацией и поиском
GET  /admin/pending-submissions
GET  /admin/audit-log
GET  /admin/stats
POST /admin/insights                       # AI инсайты (Gemini)
GET  /admin/api-keys                       # superadmin only

GET  /references/regions
GET  /references/org-types
GET  /references/ownership-forms
GET  /references/study-forms
GET  /references/study-languages
GET  /references/specialties               # с фильтрами group, q
GET  /references/specialty-groups

GET  /integrations/sync-logs
POST /integrations/sync/trigger
POST /integrations/webhooks                # для НОБД, ЕПВО

# Для каждого из 5 доменов: contingent, finance, science-activity, graduates, education
GET    /organisations/{org_id}/{domain}                # список записей орг.
POST   /organisations/{org_id}/{domain}                # создать
GET    /organisations/{org_id}/{domain}/{record_id}    # одна запись
PATCH  /organisations/{org_id}/{domain}/{record_id}    # обновить
DELETE /organisations/{org_id}/{domain}/{record_id}
PATCH  /organisations/{org_id}/{domain}/{record_id}/status  # workflow transitions
```

## Конвенции — соблюдай ОБЯЗАТЕЛЬНО

### Tailwind / стили
- ❌ `bg-blue-600`, `text-slate-700` — НЕТ. Это Tailwind defaults, не брендбук.
- ✅ `bg-fc-navy-700`, `text-fc-steel-600` — ДА. Используй фирменные токены.
- ❌ `text-emerald-600`, `text-red-600` — НЕТ.
- ✅ `text-success`, `text-danger`, `text-warning`, `text-info` — ДА. Семантические.
- Заголовки только `font-display` (Raleway). Тело текста по умолчанию `font-sans` (Inter).
- UPPERCASE метки только через `.label-eyebrow` (там трекинг и размер уже выставлены).

### Тон UI-текстов
- ❌ «Отлично!», «Готово!», «Поехали!», эмодзи 🎉
- ✅ «Сохранено», «Запись добавлена», «Изменения применены»
- Сухой профессиональный язык. Без лозунгов и маркетинга.

### React / TypeScript
- Хуки react-hook-form через `useFormContext()` — никогда не пробрасывай `methods` пропом.
- JSONB-массивы через `useFieldArray`.
- Все async-операции — try/catch с понятным error message пользователю.
- Lucide иконки — стандартные размеры `w-3 h-3` (very small), `w-3.5 h-3.5` (small in buttons),
  `w-4 h-4` (normal), `w-5 h-5` (header icons).

### Backend / Pydantic
- Pydantic V2 синтаксис: `model_config = ConfigDict(extra="forbid")`, `Field(..., ge=0)`.
- Все денежные поля — `Decimal` (никогда `float`).
- Все опциональные поля — `Optional[T] = None`. Не пиши `T | None`.
- Все API-эндпоинты — async.
- SQLAlchemy — async session через `Depends(get_db)`. RLS через `set_config('app.org_id', ...)`
  в `dependencies.py` (НЕ через `SET LOCAL` — это утечка между запросами).

### Docker
- ✅ `docker compose` (v2, без дефиса)
- ❌ `docker-compose` (v1, сломан с `KeyError 'ContainerConfig'` на этой машине)
- Frontend пересборка: `docker compose build --no-cache frontend && docker compose --profile frontend up -d --force-recreate frontend`
- API рестарт: `docker compose restart api`

## Что мне нужно от тебя ПРЯМО СЕЙЧАС (по порядку)

### Шаг 0 — Прочти эти файлы для понимания контекста

```
edu-portal/edu_frontend/tailwind.config.js
edu-portal/edu_frontend/src/index.css
edu-portal/edu_frontend/src/components/brand/Logo.tsx
edu-portal/edu_frontend/src/portal.tsx
edu-portal/edu_frontend/src/features/contingent/ContingentForm.tsx
edu-portal/edu_frontend/src/features/finance/FinanceForm.tsx
edu_backend/app/main.py
edu_backend/app/api/v1/references.py
edu_backend/app/schemas/contingent.py
edu_backend/app/schemas/finance.py
```

Этого достаточно чтобы понять стиль и архитектуру. ContingentForm и FinanceForm —
эталоны, на которые равняйся.

### Шаг 1 — Smoke-test после деплоя

Проверь что недавний деплой действительно работает:

```bash
cd /opt/edu-monitoring/edu_backend

# 1. Все контейнеры здоровы?
docker compose ps
# Ожидаю: edu_postgres, edu_redis, edu_api, edu_frontend все Up (healthy)

# 2. API отвечает? (точный путь healthcheck может быть /healthz, /health, /api/v1/health
#    или вообще отсутствовать — проверь openapi.json)
curl -s http://localhost:8000/openapi.json | python3 -c "
import sys, json
d = json.load(sys.stdin)
paths = list(d.get('paths', {}).keys())
health = [p for p in paths if 'health' in p.lower()]
print('Health endpoints:', health if health else 'НЕТ — проверь main.py')
print('Total endpoints:', len(paths))
"

# 3. Логин работает? Пароль из .env.test (передаём через stdin а не через -d, чтобы
#    он НЕ попал в /proc/PID/cmdline и не был виден через ps auxf другим процессам)
if [ -f /opt/edu-monitoring/.env.test ]; then
  source /opt/edu-monitoring/.env.test
  TOKEN=$(python3 -c "
import json, sys, urllib.request, os
req = urllib.request.Request(
    'http://localhost:8000/api/v1/auth/login',
    data=json.dumps({
        'email': 'knursagitov@gmail.com',
        'password': os.environ['TEST_SUPERADMIN_PASSWORD'],
    }).encode(),
    headers={'Content-Type': 'application/json'},
)
try:
    with urllib.request.urlopen(req, timeout=5) as r:
        print(json.load(r).get('access_token', ''))
except Exception as e:
    print('', file=sys.stderr)
    sys.stderr.write(str(e) + chr(10))
" 2>/dev/null)
  [ -n "$TOKEN" ] && echo "Login OK" || echo "Login FAILED — проверь пароль в .env.test"
  unset TEST_SUPERADMIN_PASSWORD
else
  echo "Нет .env.test — попроси меня его создать перед smoke-тестом"
fi

# 4. Справочники грузятся?
[ -n "$TOKEN" ] && curl -s http://localhost:8000/api/v1/references/regions \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -10

# 5. Все 5 data-таблиц расширены?
docker compose exec -T postgres psql -U edu_user -d edu_monitoring -c "
  SELECT table_name, COUNT(*) AS columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('contingent_snapshots','finance_records','science_activity',
                       'graduates_records','educational_process')
  GROUP BY table_name
  ORDER BY table_name;
"
# Ожидаю:
#   contingent_snapshots: ~90+
#   finance_records:      ~110+
#   science_activity:     ~85+
#   graduates_records:    ~80+
#   educational_process:  ~75+
#
# Если какая-то таблица показывает <30 колонок — миграция не применилась.
# Найди соответствующий SQL-файл (см. раздел про /tmp/phase2/) и запусти заново:
#   docker compose exec -T postgres psql -U edu_user -d edu_monitoring < <файл.sql>
# Все миграции идемпотентны (ADD COLUMN IF NOT EXISTS), повторный запуск безопасен.

# 6. Frontend собрался без ошибок?
docker compose logs --tail=50 frontend 2>&1 | grep -iE "error|warn" | head -20

# 7. API не сыпет ошибками?
docker compose logs --tail=100 api 2>&1 | grep -iE "error|traceback" | head -20
```

Если что-то не работает — **ПЕРВЫМ ДЕЛОМ чини это**. Не переходи к следующим шагам пока
не зелёный smoke-test.

### Шаг 2 — Проверь Pydantic-схемы для Science / Graduates / Education

Я применил формы фронтенда для всех 4 доменов, но Pydantic-схему отдал ТОЛЬКО для финансов.
Для Science/Graduates/Education могут быть проблемы:

```bash
# Какие сейчас схемы?
ls -la /opt/edu-monitoring/edu_backend/app/schemas/

# Прочти каждую — есть ли в них новые поля из миграций?
cat /opt/edu-monitoring/edu_backend/app/schemas/science.py
cat /opt/edu-monitoring/edu_backend/app/schemas/graduates.py
cat /opt/edu-monitoring/edu_backend/app/schemas/education.py
```

Если в схеме `extra="forbid"` И там нет полей которые добавлены в миграции 004/005/006 —
форма будет падать с 422 при сохранении. Тогда **обнови схемы** добавив все недостающие
поля по образцу `schemas/finance.py` и `schemas/contingent.py`.

Если в схеме `extra="allow"` — сохранение пройдёт, но без валидации. Тоже надо обновить
для строгости, но менее срочно.

Когда обновляешь — следуй точно тому же стилю что в `finance.py`:
- `Optional[Decimal] = Field(None, ge=0)` для денежных
- `Optional[int] = Field(None, ge=0)` для счётчиков
- `Optional[Decimal] = Field(None, ge=0, le=100)` для процентов
- `Optional[str] = Field(None, max_length=200)` для строк
- JSONB-репитеры — отдельная вложенная Pydantic-модель с `extra="forbid"`

Список полей для каждого домена смотри в соответствующем SQL-файле:

```bash
# Куда я обычно кладу миграции при деплое:
ls /tmp/phase2/00*.sql 2>/dev/null
ls /opt/edu-monitoring/migrations/ 2>/dev/null

# Если не нашёл — узкий find только по типичным местам (НЕ по /):
find /tmp /opt/edu-monitoring /root /home -maxdepth 5 \
     -name "00*_extend_*.sql" 2>/dev/null
```

### Шаг 3 — Спроси меня что делать дальше

После того как smoke-test зелёный и схемы синхронизированы, спроси меня про следующую
итерацию из этого списка:

#### Вариант 1: Аналитика прозрачности (`/transparency`)

Сейчас раздел `/transparency` содержит hero + placeholder KPI. Нужно наполнить
реальной аналитикой:

1. **Сравнительная таблица «Расходы на студента»** по всем 12 ВУЗам
   - запрос: `finance_records.cost_per_student` JOIN `contingent_snapshots.total_students` JOIN `organizations`
   - ранжирование, цветовая индикация (зелёный = эффективно, красный = дорого)

2. **График динамики грантового финансирования** по годам
   - X-axis: годы (2020–2026), Y-axis: суммы
   - линии для разных типов грантов (государственные, международные, коммерческие)

3. **Heatmap «Регион × эффективность образования»**
   - регионы по Y, метрики по X (retention, employed_by_specialty, avg_salary_first_year)

4. **Топ-10 ВУЗов по retention rate**

5. **Pie-chart «Источники финансирования системы»**
   - бюджет / платное обучение / гранты / эндаумент / прочие

**Технически**: добавить новый endpoint `/admin/transparency-stats` в backend. Для графиков —
сначала проверь что реально установлено:

```bash
cd /opt/edu-monitoring/edu-portal/edu_frontend
grep -E '"(recharts|chart\.js|d3|plotly)"' package.json
```

Если ничего нет — поставь `recharts` (он лучше всего сочетается со стилем проекта,
не требует Canvas, рендерит SVG который хорошо смотрится с брендовыми цветами).
Если что-то уже есть — используй то.

#### Вариант 2: Excel-экспорт

Кнопка «Экспорт в Excel» на каждой странице данных. Endpoint:
`GET /organisations/{org_id}/{domain}/export?format=xlsx&period_year=2025`

Сначала проверь что установлено:
```bash
grep -E "(openpyxl|xlsxwriter)" /opt/edu-monitoring/edu_backend/requirements.txt
```

Если ничего нет — поставь `openpyxl` (поддерживает xlsx + чтение/запись + форматирование).
Структура файла:
- Заголовки на 2 языках (RU + EN)
- Группировка по вкладкам формы
- Числа с форматированием (тенге, проценты)
- Лист «Метаданные» (когда выгружено, кем, статус заявки)

#### Вариант 3: Admin reference editor

Страница `/admin/references` для редактирования справочников без psql:
- Таблицы: regions, specialties, org_types, ownership_forms, study_forms, study_languages
- CRUD с inline-edit
- Только superadmin
- Audit-log записи всех изменений

#### Вариант 4: Глубокая детализация полей (оставшиеся 380 из 795)

Расширение существующих форм через JSONB-структуры:
- Контингент: помесячный снимок (вместо снимка на дату)
- Финансы: квартальная разбивка статей бюджета
- Выпускники: разбивка зарплат по специальностям
- Наука: помесячные публикации с детализацией по авторам

#### Вариант 5: Mobile/PWA

Адаптация для мобильных + установка как PWA:
- manifest.json с иконками логотипа
- Service worker для offline-режима data_entry юзеров
- Touch-friendly формы (бóльшие тапы, упрощённая навигация по вкладкам)

## Известные подводные камни на этой машине

1. **Docker compose v2** — `docker compose`, без дефиса. v1 (`docker-compose`) сломан
   с `KeyError 'ContainerConfig'`.

2. **CORS** — `app/main.py` хардкодит `http://192.168.13.245:3000`. Если меняешь IP сервера —
   меняй и здесь, и в `src/api/client.ts` (там `API_BASE = "http://192.168.13.245:8000/api/v1"`).

3. **Frontend build context** — в docker-compose.yml backend контейнера написано
   `build: context: ../edu-portal/edu_frontend`. Не путай где корень фронта.

4. **Аудит и mixin** — `app/models/mixins.py` содержит `_audit_recursion_guard` через
   `ContextVar`, маскировку `password_hash`/`token_hash` как `"***"`, idempotent
   `register_audit_hooks`. **НЕ ТРОГАЙ эту логику без крайней необходимости** — она была
   тщательно отлажена.

5. **RLS / multi-tenancy** — в `app/api/dependencies.py` используется
   `SELECT set_config('app.org_id', :v, false)` (session-scoped, не `SET LOCAL`!)
   Это критично, иначе данные одной организации видны другим.

6. **Refresh tokens** — хранятся через `jti` с UNIQUE индексом для O(1) lookup.
   НЕ возвращайся к O(n) bcrypt-verify — это было главным bottleneck до фикса.

7. **Pydantic Optional[Decimal]** — НЕ пиши `decimal_places=2` для `Optional[Decimal]`,
   это ломается в V2. Просто `Optional[Decimal] = Field(None, ge=0)`.

8. **iOS/мобильные** — все `<input>` имеют `font-size: 16px` ниже sm-брейкпоинта чтобы
   мобильные не зумили при фокусе. Видно в `index.css` секции `@layer base`.

9. **Кэш браузера** — после деплоя фронта пользователи могут видеть старую версию.
   Всегда советуй проверять в инкогнито. На длинной перспективе нужно версионирование
   ассетов или service worker с правильной cache-стратегией.

10. **Brand pattern SVG** — я использую `data:image/svg+xml;utf8,...` inline в CSS для
    `.bg-fc-pattern`. Если будешь добавлять похожие фоны — следуй этому паттерну,
    не генерируй PNG.

## Стиль работы которого я ожидаю

1. **Сначала диагностика, потом изменения.** Не пиши код пока не понял что сломано.

2. **Не переписывай файлы целиком если можно поменять 5 строк.** Используй `str_replace`
   а не `create_file` поверх существующего.

3. **Маленькие коммиты с понятными сообщениями.** После каждой логической единицы работы:
   ```bash
   cd /opt/edu-monitoring && git add -A && git commit -m "fix: …"
   ```
   (если репозиторий есть — проверь `git status` сначала)

4. **Проверяй что собирается.** После изменений во фронте — `docker compose build frontend`,
   во бэкенде — `docker compose restart api && docker compose logs --tail=30 api`.

5. **Не выдумывай endpoints.** Если думаешь что нужен новый API — спроси меня.
   Список существующих — выше в этом промпте.

6. **Не удаляй существующие фичи** ради рефакторинга, если я об этом не просил.
   Особенно — auth, audit, RLS.

7. **Краткие отчёты после каждого этапа.** Не вываливай простыни логов. Скажи что сделал,
   что нашёл, что предлагаешь дальше.

## Мои предпочтения по UI/UX

- Минимум кликов до результата
- Минимум полей на экране за раз → tabs / progressive disclosure
- Вся валидация — inline, не модалками
- Loading states в каждой кнопке (Loader2 spinning)
- Empty states с понятным CTA или объяснением что будет дальше
- Error states с конкретной причиной + кнопкой Retry где применимо
- Hover-эффекты только на интерактивных элементах
- Никаких параллаксов, анимаций больше 200ms, бесконечных скроллов

## Начинай

1. Запусти Шаг 1 (smoke-test). Расскажи мне результат.
2. Если что-то красное — сначала чини.
3. Когда всё зелёное — переходи к Шагу 2 (Pydantic схемы).
4. Когда схемы синхронизированы — спроси какой из 5 вариантов roadmap делать дальше.

Жду первого отчёта по smoke-тесту.
