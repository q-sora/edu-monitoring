# ЗАДАНИЕ ДЛЯ CLAUDE CODE: Универсальный импорт оценки эффективности колледжей

## ПРЕЖДЕ ВСЕГО

Прочитай `/opt/edu-monitoring/CLAUDE.md` — структура, конвенции, стек, подводные камни.

```bash
cd /opt/edu-monitoring/edu_backend
docker compose ps
```

---

## КОНТЕКСТ

Пользователь предоставил Excel-шаблон оценки эффективности колледжей ТиППО.
Таких файлов много — по одному на каждую область Казахстана (20 областей).
Нужно создать **универсальный импортёр**, который принимает любой такой файл
и кладёт данные в БД.

**Что за данные:**
- Шаблон оценки эффективности колледжей ТиППО, разработанный АО «Финансовый центр»
- 1 файл = 1 область = ~20-40 колледжей × ~5-15 специальностей = ~200-600 строк
- 115 столбцов: показатели колледжа в целом + показатели по каждой специальности
- Двухуровневая структура: строка без специальности = данные по колледжу,
  строки со специальностью = данные по специальностям
- Каждый показатель = числовое значение + балл (42 балльных столбца)
- Итого: `ИТОГОВЫЙ БАЛЛ ОБЩИЙ КОЛЛЕДЖ` (col 113) и `ИТОГОВЫЙ БАЛЛ ПО СПЕЦИАЛЬНОСТИ` (col 114)

---

## АРХИТЕКТУРА ДАННЫХ

### Структура строк в файле:
```
Строка 1: ID=1, Область=..., Колледж=..., БАЛЛ=12.5, специальность=пусто  ← данные колледжа
Строка 2: ID=1, Область=..., Колледж=..., специальность="07150100–Технология машиностроения", БАЛЛ=10
Строка 3: ID=1, Область=..., Колледж=..., специальность="07150500–Сварочное дело", БАЛЛ=9
...
Строка N: ID=2, следующий колледж
```

### Признак строки:
- **Строка колледжа**: col[46] (Специальности) = пустое
- **Строка специальности**: col[46] (Специальности) = заполнено

---

## ЧАСТЬ 1 — SQL-МИГРАЦИИ

Файл: `edu_backend/app/migrations/versions/013_college_assessment.sql`

### 1.1 Таблица колледжей (данные по уровню колледжа)

```sql
CREATE TABLE IF NOT EXISTS college_assessment (
    id                  BIGSERIAL PRIMARY KEY,

    -- Идентификация
    org_id              UUID REFERENCES organizations(id) ON DELETE SET NULL,
    college_id_source   INTEGER,            -- ID из файла (не уникален между регионами)
    region              VARCHAR(100),
    district            VARCHAR(100),
    college_name        TEXT NOT NULL,
    ownership_form      VARCHAR(100),       -- Коммунальная/Частная/Республиканская
    location_type       VARCHAR(50),        -- городская/сельская местность

    -- Метаданные периода
    period_year         INTEGER NOT NULL,
    source_file         VARCHAR(255),
    imported_at         TIMESTAMPTZ DEFAULT NOW(),
    imported_by         UUID REFERENCES users(id) ON DELETE SET NULL,

    -- ── ИНФРАСТРУКТУРА / РЕМОНТ ──────────────────────────────────────────
    repair_current_done BOOLEAN,            -- проведён текущий ремонт
    repair_not_required BOOLEAN,            -- не требует ремонта
    repair_capital_done BOOLEAN,            -- проведён капитальный ремонт
    repair_capital_needed BOOLEAN,          -- требует капитального ремонта
    repair_current_needed BOOLEAN,          -- требует текущего ремонта
    score_repair        NUMERIC(5,2),       -- БАЛЛ инфраструктуры [col 11]

    -- ── ЗАГРУЗКА ─────────────────────────────────────────────────────────
    capacity_design     INTEGER,            -- проектная мощность, чел [col 12]
    contingent_actual   INTEGER,            -- контингент обучающихся [col 13]
    capacity_pct        NUMERIC(6,2),       -- % загрузки [col 14]
    score_capacity      NUMERIC(5,2),       -- БАЛЛ загрузки [col 15]

    -- ── АТТЕСТАЦИЯ ───────────────────────────────────────────────────────
    attestation_result  VARCHAR(50),        -- с 1-го раза / со 2-го раза [col 16]
    score_attestation   NUMERIC(5,2),       -- БАЛЛ [col 17]

    -- ── СПОРТ И ОБЩЕЖИТИЕ ────────────────────────────────────────────────
    has_sports_facility BOOLEAN,            -- спортзал/стадион [col 18]
    score_sports        NUMERIC(5,2),       -- [col 19]
    has_dormitory       BOOLEAN,            -- общежитие [col 20]
    score_dormitory     NUMERIC(5,2),       -- [col 21]

    -- ── БИБЛИОТЕКА ───────────────────────────────────────────────────────
    library_readers_count INTEGER,          -- читателей-студентов [col 22]
    library_readers_pct   NUMERIC(6,2),     -- % от контингента [col 23]
    score_library         NUMERIC(5,2),     -- [col 24]

    -- ── МИНИ-ПРЕДПРИЯТИЯ ─────────────────────────────────────────────────
    mini_enterprise_count INTEGER,          -- количество мини-предприятий [col 25]
    score_mini_enterprise NUMERIC(5,2),     -- [col 26]
    mini_enterprise_income NUMERIC(15,2),   -- доход в тенге [col 27]
    score_mini_enterprise_income NUMERIC(5,2), -- [col 28]

    -- ── СПОНСОРСКИЕ СРЕДСТВА ─────────────────────────────────────────────
    sponsor_funds       NUMERIC(15,2),      -- сумма в тенге [col 29]
    score_sponsors      NUMERIC(5,2),       -- [col 30]

    -- ── МЕТОДИЧЕСКОЕ ОБЪЕДИНЕНИЕ ─────────────────────────────────────────
    has_methodical_union BOOLEAN,           -- республик. учебно-метод. объединение [col 31]
    score_methodical_union NUMERIC(5,2),    -- [col 32]

    -- ── ПЕДАГОГИ — КВАЛИФИКАЦИЯ ──────────────────────────────────────────
    teachers_master_count   INTEGER,        -- педагог-мастер/исследователь/эксперт [col 33]
    teachers_master_pct     NUMERIC(6,2),   -- [col 34]
    score_teachers_master   NUMERIC(5,2),   -- [col 35]
    teachers_science_count  INTEGER,        -- с научной степенью [col 36]
    teachers_science_pct    NUMERIC(6,2),   -- [col 37]
    score_teachers_science  NUMERIC(5,2),   -- [col 38]
    teachers_total          INTEGER,        -- общее количество педагогов [col 39]
    talap_trainers_count    INTEGER,        -- внештатных тренеров НАО Talap [col 40]
    score_talap_trainers    NUMERIC(5,2),   -- [col 41]
    best_teacher_winners    INTEGER,        -- победители «Лучший педагог» [col 42]
    score_best_teacher      NUMERIC(5,2),   -- [col 43]

    -- ── ШЕФСТВО ПРЕДПРИЯТИЙ ──────────────────────────────────────────────
    enterprise_patronage_count INTEGER,     -- предприятий-шефов [col 44]
    score_patronage            NUMERIC(5,2),-- [col 45]

    -- ── ИТОГ ─────────────────────────────────────────────────────────────
    total_score         NUMERIC(6,2),       -- ИТОГОВЫЙ БАЛЛ ОБЩИЙ КОЛЛЕДЖ [col 113]

    UNIQUE (college_name, region, period_year)
);

CREATE INDEX IF NOT EXISTS idx_ca_region      ON college_assessment (region);
CREATE INDEX IF NOT EXISTS idx_ca_year        ON college_assessment (period_year);
CREATE INDEX IF NOT EXISTS idx_ca_org         ON college_assessment (org_id);
CREATE INDEX IF NOT EXISTS idx_ca_score       ON college_assessment (total_score DESC);
```

### 1.2 Таблица специальностей (данные по специальности внутри колледжа)

```sql
CREATE TABLE IF NOT EXISTS college_assessment_specialty (
    id                  BIGSERIAL PRIMARY KEY,

    -- Связь с колледжем
    assessment_id       BIGINT NOT NULL REFERENCES college_assessment(id) ON DELETE CASCADE,

    -- Специальность
    specialty_raw       TEXT NOT NULL,      -- полная строка "07150100 – Технология..."
    specialty_code      VARCHAR(20),        -- "07150100" (извлечь regexp)
    specialty_name      TEXT,               -- "Технология машиностроения (по видам)"

    -- ── ЛАБОРАТОРИИ ──────────────────────────────────────────────────────
    labs_total          INTEGER,            -- количество лабораторий/мастерских [col 47]
    labs_equipped       INTEGER,            -- оснащённых специализированных [col 48]
    labs_equipped_pct   NUMERIC(6,2),       -- [col 49]
    score_labs          NUMERIC(5,2),       -- [col 50]

    -- ── ЖАС МАМАН ────────────────────────────────────────────────────────
    zhas_maman_participation VARCHAR(100),  -- участие в проекте [col 51]
    score_zhas_maman    NUMERIC(5,2),       -- [col 52]

    -- ── ПЕДАГОГИ СПЕЦДИСЦИПЛИН ───────────────────────────────────────────
    spec_teachers_total     INTEGER,        -- спецпредметников/ПМ педагогов [col 53]
    spec_teachers_master    INTEGER,        -- имеющих квалиф. уровень пед-мастер [col 54]
    spec_teachers_master_pct NUMERIC(6,2),  -- [col 55]
    score_spec_master       NUMERIC(5,2),   -- [col 56]
    spec_teachers_science   INTEGER,        -- с научной степенью [col 57]
    spec_teachers_science_pct NUMERIC(6,2), -- [col 58]
    score_spec_science      NUMERIC(5,2),   -- [col 59]

    -- ── УЧАСТИЕ В ЭКСПЕРТИЗАХ ────────────────────────────────────────────
    expertise_teachers      INTEGER,        -- участвовавших в экспертизе ОП [col 60]
    score_expertise         NUMERIC(5,2),   -- [col 61]

    -- ── WORLDSKILLS — ЭКСПЕРТЫ ───────────────────────────────────────────
    ws_expert_republic      INTEGER,        -- главных экспертов республик. WS [col 62]
    score_ws_expert_republic NUMERIC(5,2),  -- [col 63]
    ws_expert_intl          INTEGER,        -- международных экспертов WS/ES [col 64]
    score_ws_expert_intl    NUMERIC(5,2),   -- [col 65]

    -- ── СТАЖИРОВКА ЗА РУБЕЖОМ ────────────────────────────────────────────
    abroad_internship_count INTEGER,        -- педагогов на стажировке за рубежом [col 66]
    abroad_internship_pct   NUMERIC(6,2),   -- [col 67]
    score_abroad_internship NUMERIC(5,2),   -- [col 68]

    -- ── КОНКУРСЫ ПРОФМАСТЕРСТВА ──────────────────────────────────────────
    prof_contest_winners    INTEGER,        -- победители республик. конкурсов [col 69]
    score_prof_contest      NUMERIC(5,2),   -- [col 70]
    industry_teachers_count INTEGER,        -- педагогов с производства [col 71]
    industry_teachers_pct   NUMERIC(6,2),   -- [col 72]
    score_industry_teachers NUMERIC(5,2),   -- [col 73]

    -- ── УСПЕВАЕМОСТЬ ─────────────────────────────────────────────────────
    academic_performance_pct NUMERIC(6,2),  -- академическая успеваемость % [col 74]
    score_academic          NUMERIC(5,2),   -- [col 75]
    knowledge_quality_pct   NUMERIC(6,2),   -- качество знаний % [col 76]
    score_knowledge         NUMERIC(5,2),   -- [col 77]

    -- ── ПРИЁМ / ВЫПУСК ───────────────────────────────────────────────────
    admission_count         INTEGER,        -- приём обучающихся [col 78]
    graduates_count         INTEGER,        -- выпускников [col 79]
    graduates_pct           NUMERIC(6,2),   -- % [col 80]
    score_graduates         NUMERIC(5,2),   -- [col 81]

    -- ── ЖАС МАМАН — РЕЗУЛЬТАТЫ ───────────────────────────────────────────
    zm_students_count       INTEGER,        -- обучающихся по Жас маман [col 82]
    zm_academic_pct         NUMERIC(6,2),   -- успеваемость в рамках ЖМ [col 83]
    score_zm_academic       NUMERIC(5,2),   -- [col 84]
    zm_quality_pct          NUMERIC(6,2),   -- качество знаний ЖМ [col 85]
    score_zm_quality        NUMERIC(5,2),   -- [col 86]
    zm_admission_count      INTEGER,        -- приём ЖМ [col 87]
    zm_graduates_count      INTEGER,        -- выпускников ЖМ [col 88]
    zm_graduates_pct        NUMERIC(6,2),   -- % [col 89]
    score_zm_graduates      NUMERIC(5,2),   -- [col 90]

    -- ── WORLDSKILLS — СТУДЕНТЫ ───────────────────────────────────────────
    ws_student_place_republic VARCHAR(20),  -- призовое место WS республ. [col 91]
    score_ws_student_republic NUMERIC(5,2), -- [col 92]
    ws_student_place_intl     VARCHAR(20),  -- призовое место WS международн. [col 93]
    score_ws_student_intl     NUMERIC(5,2), -- [col 94]

    -- ── СТАРТАПЫ ─────────────────────────────────────────────────────────
    startup_count           INTEGER,        -- бизнес-стартапы [col 95]
    score_startups          NUMERIC(5,2),   -- [col 96]

    -- ── ДЕМОНСТРАЦИОННЫЙ ЭКЗАМЕН ─────────────────────────────────────────
    demo_exam_students      INTEGER,        -- сдавших демэкзамен [col 97]
    score_demo_exam         NUMERIC(5,2),   -- [col 98]

    -- ── ВЫПУСКНИКИ-ПРЕДПРИНИМАТЕЛИ ───────────────────────────────────────
    entrepreneur_graduates  INTEGER,        -- выпускников-предпринимателей [col 99]
    score_entrepreneurs     NUMERIC(5,2),   -- [col 100]

    -- ── ТРУДОУСТРОЙСТВО ──────────────────────────────────────────────────
    employment_graduates    INTEGER,        -- выпуск [col 101]
    employment_employed     VARCHAR(50),    -- трудоустройство (строка "1/7") [col 102]
    employment_pct          NUMERIC(6,2),   -- [col 103]
    score_employment        NUMERIC(5,2),   -- [col 104]
    zm_employment_graduates INTEGER,        -- выпуск ЖМ [col 105]
    zm_employment_employed  VARCHAR(50),    -- трудоустройство ЖМ [col 106]
    zm_employment_pct       NUMERIC(6,2),   -- [col 107]
    score_zm_employment     NUMERIC(5,2),   -- [col 108]

    -- ── ДУАЛЬНОЕ ОБУЧЕНИЕ ────────────────────────────────────────────────
    dual_students_count     INTEGER,        -- охвачено дуальным обучением [col 109]
    score_dual              NUMERIC(5,2),   -- [col 110]

    -- ── ЗАЯВКИ РАБОТОДАТЕЛЕЙ ─────────────────────────────────────────────
    employer_request_count  INTEGER,        -- по заявкам работодателей [col 111]
    score_employer_requests NUMERIC(5,2),   -- [col 112]

    -- ── ИТОГ ─────────────────────────────────────────────────────────────
    specialty_score         NUMERIC(6,2),   -- ИТОГОВЫЙ БАЛЛ ПО СПЕЦИАЛЬНОСТИ [col 114]

    UNIQUE (assessment_id, specialty_raw)
);

CREATE INDEX IF NOT EXISTS idx_cas_assessment ON college_assessment_specialty (assessment_id);
CREATE INDEX IF NOT EXISTS idx_cas_code       ON college_assessment_specialty (specialty_code);
CREATE INDEX IF NOT EXISTS idx_cas_score      ON college_assessment_specialty (specialty_score DESC);
CREATE INDEX IF NOT EXISTS idx_cas_employment ON college_assessment_specialty (employment_pct);

COMMENT ON TABLE college_assessment IS
    'Оценка эффективности колледжей ТиППО по методике АО «Финансовый центр». '
    'Данные уровня колледжа (итоговый балл col 113).';
COMMENT ON TABLE college_assessment_specialty IS
    'Данные оценки по специальностям внутри колледжа (итоговый балл col 114).';
```

Применить:
```bash
docker compose exec -T postgres psql -U edu_user -d edu_monitoring \
    < app/migrations/versions/013_college_assessment.sql
```

---

## ЧАСТЬ 2 — ПАРСЕР EXCEL

Файл: `edu_backend/app/crud/college_assessment_import.py`

### Полный маппинг столбцов (0-индексация):

```python
"""
Маппинг столбцов Excel → поля БД.
Структура файла:
  - Строка 1: заголовки (115 столбцов)
  - Строка 2+: данные
  - Строка КОЛЛЕДЖА: col[46] (Специальности) = пустое, col[113] заполнен
  - Строка СПЕЦИАЛЬНОСТИ: col[46] заполнен, col[114] заполнен
"""

# Строки колледжа (col 46 = пустое)
COLLEGE_COLS = {
    "college_id_source":  0,
    "region":             1,
    "district":           2,
    "college_name":       3,
    "ownership_form":     4,
    "location_type":      5,
    # Инфраструктура
    "repair_current_done_raw":  6,
    "repair_not_required_raw":  7,
    "repair_capital_done_raw":  8,
    "repair_capital_needed_raw":9,
    "repair_current_needed_raw":10,
    "score_repair":       11,
    # Загрузка
    "capacity_design":    12,
    "contingent_actual":  13,
    "capacity_pct":       14,
    "score_capacity":     15,
    # Аттестация
    "attestation_result": 16,
    "score_attestation":  17,
    # Спорт и общежитие
    "has_sports_facility_raw": 18,
    "score_sports":       19,
    "has_dormitory_raw":  20,
    "score_dormitory":    21,
    # Библиотека
    "library_readers_count": 22,
    "library_readers_pct":   23,
    "score_library":         24,
    # Мини-предприятия
    "mini_enterprise_count":        25,
    "score_mini_enterprise":        26,
    "mini_enterprise_income":       27,
    "score_mini_enterprise_income": 28,
    # Спонсоры
    "sponsor_funds":      29,
    "score_sponsors":     30,
    # Методическое объединение
    "has_methodical_union_raw": 31,
    "score_methodical_union":   32,
    # Педагоги квалификация
    "teachers_master_count":  33,
    "teachers_master_pct":    34,
    "score_teachers_master":  35,
    "teachers_science_count": 36,
    "teachers_science_pct":   37,
    "score_teachers_science": 38,
    "teachers_total":         39,
    "talap_trainers_count":   40,
    "score_talap_trainers":   41,
    "best_teacher_winners":   42,
    "score_best_teacher":     43,
    # Шефство
    "enterprise_patronage_count": 44,
    "score_patronage":            45,
    # Итог
    "total_score": 113,
}

# Строки специальности (col 46 = заполнено)
SPECIALTY_COLS = {
    "specialty_raw":          46,
    "labs_total":             47,
    "labs_equipped":          48,
    "labs_equipped_pct":      49,
    "score_labs":             50,
    "zhas_maman_participation": 51,
    "score_zhas_maman":       52,
    "spec_teachers_total":    53,
    "spec_teachers_master":   54,
    "spec_teachers_master_pct": 55,
    "score_spec_master":      56,
    "spec_teachers_science":  57,
    "spec_teachers_science_pct": 58,
    "score_spec_science":     59,
    "expertise_teachers":     60,
    "score_expertise":        61,
    "ws_expert_republic":     62,
    "score_ws_expert_republic": 63,
    "ws_expert_intl":         64,
    "score_ws_expert_intl":   65,
    "abroad_internship_count": 66,
    "abroad_internship_pct":  67,
    "score_abroad_internship": 68,
    "prof_contest_winners":   69,
    "score_prof_contest":     70,
    "industry_teachers_count": 71,
    "industry_teachers_pct":  72,
    "score_industry_teachers": 73,
    "academic_performance_pct": 74,
    "score_academic":         75,
    "knowledge_quality_pct":  76,
    "score_knowledge":        77,
    "admission_count":        78,
    "graduates_count":        79,
    "graduates_pct":          80,
    "score_graduates":        81,
    "zm_students_count":      82,
    "zm_academic_pct":        83,
    "score_zm_academic":      84,
    "zm_quality_pct":         85,
    "score_zm_quality":       86,
    "zm_admission_count":     87,
    "zm_graduates_count":     88,
    "zm_graduates_pct":       89,
    "score_zm_graduates":     90,
    "ws_student_place_republic": 91,
    "score_ws_student_republic": 92,
    "ws_student_place_intl":  93,
    "score_ws_student_intl":  94,
    "startup_count":          95,
    "score_startups":         96,
    "demo_exam_students":     97,
    "score_demo_exam":        98,
    "entrepreneur_graduates": 99,
    "score_entrepreneurs":    100,
    "employment_graduates":   101,
    "employment_employed":    102,
    "employment_pct":         103,
    "score_employment":       104,
    "zm_employment_graduates": 105,
    "zm_employment_employed":  106,
    "zm_employment_pct":       107,
    "score_zm_employment":     108,
    "dual_students_count":    109,
    "score_dual":             110,
    "employer_request_count": 111,
    "score_employer_requests": 112,
    "specialty_score":        114,
}
```

### Логика парсинга:

```python
import io, re, logging
from decimal import Decimal
from typing import Any, Optional
import pandas as pd
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


def _extract_year(filename: str) -> Optional[int]:
    """Извлечь год из имени файла. '2023_Абай.xlsx' → 2023."""
    m = re.search(r"(20\d{2})", filename)
    return int(m[1]) if m else None


def _to_float(v: Any) -> Optional[float]:
    """Безопасное приведение к float. None, NaN, '—', строки → None."""
    if v is None:
        return None
    s = str(v).strip().replace(",", ".").replace(" ", "").replace("–", "").replace("—", "")
    if s in ("", "nan", "None", "нет", "Нет", "#ДЕЛ/0!", "#DIV/0!"):
        return None
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def _to_int(v: Any) -> Optional[int]:
    f = _to_float(v)
    return int(round(f)) if f is not None else None


def _to_bool(v: Any) -> Optional[bool]:
    """'да' → True, 'нет' → False, None → None."""
    if v is None or (isinstance(v, float) and str(v) == 'nan'):
        return None
    s = str(v).strip().lower()
    if s in ("да", "yes", "1", "true"):
        return True
    if s in ("нет", "no", "0", "false"):
        return False
    return None


def _extract_specialty_code(raw: str) -> tuple[str, str]:
    """
    '07150100 – «Технология машиностроения (по видам)»'
    → ('07150100', 'Технология машиностроения (по видам)')
    """
    if not raw:
        return "", raw
    m = re.match(r"^(\d{8})\s*[–—-]\s*[«»]?(.+?)[«»]?\s*$", raw.strip())
    if m:
        return m[1].strip(), m[2].strip("«»\u00ab\u00bb '\"").strip()
    return "", raw.strip()


def _get(row: list, col_idx: int, as_type: str = "float") -> Any:
    """Безопасно получить значение из строки по индексу."""
    if col_idx >= len(row):
        return None
    v = row[col_idx]
    if as_type == "float":
        return _to_float(v)
    if as_type == "int":
        return _to_int(v)
    if as_type == "bool":
        return _to_bool(v)
    if as_type == "str":
        s = str(v).strip() if v is not None and str(v).strip() not in ("nan", "None", "") else None
        return s
    return v


async def parse_and_import_college_assessment(
    db: AsyncSession,
    file_bytes: bytes,
    filename: str,
    period_year: Optional[int] = None,
    user_id: Optional[str] = None,
) -> dict:
    """
    Главная функция импорта.
    Возвращает статистику: colleges/specialties inserted/updated/skipped/errors.
    """
    if period_year is None:
        period_year = _extract_year(filename) or 2024

    # Читаем весь файл как строки — pandas не портит числа
    df = pd.read_excel(io.BytesIO(file_bytes), header=0, dtype=str)

    # Маппинг организаций по имени (если есть)
    res = await db.execute(text(
        "SELECT id, name_ru FROM organizations WHERE name_ru IS NOT NULL"
    ))
    name_to_org_id = {r.name_ru.strip().lower(): str(r.id) for r in res.fetchall()}

    stats = dict(colleges_inserted=0, colleges_updated=0,
                 specialties_inserted=0, specialties_updated=0,
                 skipped=0, errors=[])

    current_college_id: Optional[int] = None
    current_college_name: Optional[str] = None

    for idx in range(len(df)):
        row = df.iloc[idx].tolist()

        # Пропускаем пустые и не-числовые строки
        id_val = _get(row, 0, "str")
        college_name = _get(row, 3, "str")
        if not college_name:
            continue

        specialty_raw = _get(row, 46, "str")
        is_college_row = not specialty_raw
        is_specialty_row = bool(specialty_raw)

        # ── СТРОКА КОЛЛЕДЖА ─────────────────────────────────────────────────
        if is_college_row:
            total_score = _get(row, 113, "float")
            if total_score is None:
                stats["skipped"] += 1
                continue

            org_id = name_to_org_id.get(college_name.strip().lower())

            college_data = dict(
                org_id              = org_id,
                college_id_source   = _get(row, 0, "int"),
                region              = _get(row, 1, "str"),
                district            = _get(row, 2, "str"),
                college_name        = college_name,
                ownership_form      = _get(row, 4, "str"),
                location_type       = _get(row, 5, "str"),
                period_year         = period_year,
                source_file         = filename,
                imported_by         = user_id,
                # Инфраструктура
                repair_current_done  = _to_bool(_get(row, 6, "str")),
                repair_not_required  = _to_bool(_get(row, 7, "str")),
                repair_capital_done  = _to_bool(_get(row, 8, "str")),
                repair_capital_needed= _to_bool(_get(row, 9, "str")),
                repair_current_needed= _to_bool(_get(row, 10, "str")),
                score_repair         = _get(row, 11, "float"),
                # Загрузка
                capacity_design     = _get(row, 12, "int"),
                contingent_actual   = _get(row, 13, "int"),
                capacity_pct        = _get(row, 14, "float"),
                score_capacity      = _get(row, 15, "float"),
                # Аттестация
                attestation_result  = _get(row, 16, "str"),
                score_attestation   = _get(row, 17, "float"),
                # Спорт и общежитие
                has_sports_facility = _to_bool(_get(row, 18, "str")),
                score_sports        = _get(row, 19, "float"),
                has_dormitory       = _to_bool(_get(row, 20, "str")),
                score_dormitory     = _get(row, 21, "float"),
                # Библиотека
                library_readers_count = _get(row, 22, "int"),
                library_readers_pct   = _get(row, 23, "float"),
                score_library         = _get(row, 24, "float"),
                # Мини-предприятия
                mini_enterprise_count        = _get(row, 25, "int"),
                score_mini_enterprise        = _get(row, 26, "float"),
                mini_enterprise_income       = _get(row, 27, "float"),
                score_mini_enterprise_income = _get(row, 28, "float"),
                # Спонсоры
                sponsor_funds  = _get(row, 29, "float"),
                score_sponsors = _get(row, 30, "float"),
                # Методическое объединение
                has_methodical_union   = _to_bool(_get(row, 31, "str")),
                score_methodical_union = _get(row, 32, "float"),
                # Педагоги
                teachers_master_count   = _get(row, 33, "int"),
                teachers_master_pct     = _get(row, 34, "float"),
                score_teachers_master   = _get(row, 35, "float"),
                teachers_science_count  = _get(row, 36, "int"),
                teachers_science_pct    = _get(row, 37, "float"),
                score_teachers_science  = _get(row, 38, "float"),
                teachers_total          = _get(row, 39, "int"),
                talap_trainers_count    = _get(row, 40, "int"),
                score_talap_trainers    = _get(row, 41, "float"),
                best_teacher_winners    = _get(row, 42, "int"),
                score_best_teacher      = _get(row, 43, "float"),
                # Шефство
                enterprise_patronage_count = _get(row, 44, "int"),
                score_patronage            = _get(row, 45, "float"),
                # Итог
                total_score = total_score,
            )

            try:
                result = await db.execute(text("""
                    INSERT INTO college_assessment (
                        org_id, college_id_source, region, district, college_name,
                        ownership_form, location_type, period_year, source_file, imported_by,
                        repair_current_done, repair_not_required, repair_capital_done,
                        repair_capital_needed, repair_current_needed, score_repair,
                        capacity_design, contingent_actual, capacity_pct, score_capacity,
                        attestation_result, score_attestation,
                        has_sports_facility, score_sports, has_dormitory, score_dormitory,
                        library_readers_count, library_readers_pct, score_library,
                        mini_enterprise_count, score_mini_enterprise,
                        mini_enterprise_income, score_mini_enterprise_income,
                        sponsor_funds, score_sponsors,
                        has_methodical_union, score_methodical_union,
                        teachers_master_count, teachers_master_pct, score_teachers_master,
                        teachers_science_count, teachers_science_pct, score_teachers_science,
                        teachers_total, talap_trainers_count, score_talap_trainers,
                        best_teacher_winners, score_best_teacher,
                        enterprise_patronage_count, score_patronage,
                        total_score
                    ) VALUES (
                        :org_id, :college_id_source, :region, :district, :college_name,
                        :ownership_form, :location_type, :period_year, :source_file, :imported_by,
                        :repair_current_done, :repair_not_required, :repair_capital_done,
                        :repair_capital_needed, :repair_current_needed, :score_repair,
                        :capacity_design, :contingent_actual, :capacity_pct, :score_capacity,
                        :attestation_result, :score_attestation,
                        :has_sports_facility, :score_sports, :has_dormitory, :score_dormitory,
                        :library_readers_count, :library_readers_pct, :score_library,
                        :mini_enterprise_count, :score_mini_enterprise,
                        :mini_enterprise_income, :score_mini_enterprise_income,
                        :sponsor_funds, :score_sponsors,
                        :has_methodical_union, :score_methodical_union,
                        :teachers_master_count, :teachers_master_pct, :score_teachers_master,
                        :teachers_science_count, :teachers_science_pct, :score_teachers_science,
                        :teachers_total, :talap_trainers_count, :score_talap_trainers,
                        :best_teacher_winners, :score_best_teacher,
                        :enterprise_patronage_count, :score_patronage,
                        :total_score
                    )
                    ON CONFLICT (college_name, region, period_year)
                    DO UPDATE SET
                        total_score   = EXCLUDED.total_score,
                        score_repair  = EXCLUDED.score_repair,
                        score_capacity = EXCLUDED.score_capacity,
                        contingent_actual = EXCLUDED.contingent_actual,
                        teachers_total = EXCLUDED.teachers_total,
                        source_file   = EXCLUDED.source_file,
                        imported_at   = NOW()
                    RETURNING id
                """), college_data)
                current_college_id   = result.scalar_one()
                current_college_name = college_name
                stats["colleges_inserted"] += 1
            except Exception as e:
                stats["errors"].append(f"Колледж '{college_name}': {e}")
                current_college_id = None
                logger.warning("College insert error: %s", e)

        # ── СТРОКА СПЕЦИАЛЬНОСТИ ─────────────────────────────────────────────
        elif is_specialty_row and current_college_id:
            specialty_code, specialty_name = _extract_specialty_code(specialty_raw)

            spec_data = dict(
                assessment_id           = current_college_id,
                specialty_raw           = specialty_raw,
                specialty_code          = specialty_code or None,
                specialty_name          = specialty_name or specialty_raw,
                labs_total              = _get(row, 47, "int"),
                labs_equipped           = _get(row, 48, "int"),
                labs_equipped_pct       = _get(row, 49, "float"),
                score_labs              = _get(row, 50, "float"),
                zhas_maman_participation = _get(row, 51, "str"),
                score_zhas_maman        = _get(row, 52, "float"),
                spec_teachers_total     = _get(row, 53, "int"),
                spec_teachers_master    = _get(row, 54, "int"),
                spec_teachers_master_pct = _get(row, 55, "float"),
                score_spec_master       = _get(row, 56, "float"),
                spec_teachers_science   = _get(row, 57, "int"),
                spec_teachers_science_pct = _get(row, 58, "float"),
                score_spec_science      = _get(row, 59, "float"),
                expertise_teachers      = _get(row, 60, "int"),
                score_expertise         = _get(row, 61, "float"),
                ws_expert_republic      = _get(row, 62, "int"),
                score_ws_expert_republic = _get(row, 63, "float"),
                ws_expert_intl          = _get(row, 64, "int"),
                score_ws_expert_intl    = _get(row, 65, "float"),
                abroad_internship_count = _get(row, 66, "int"),
                abroad_internship_pct   = _get(row, 67, "float"),
                score_abroad_internship = _get(row, 68, "float"),
                prof_contest_winners    = _get(row, 69, "int"),
                score_prof_contest      = _get(row, 70, "float"),
                industry_teachers_count = _get(row, 71, "int"),
                industry_teachers_pct   = _get(row, 72, "float"),
                score_industry_teachers = _get(row, 73, "float"),
                academic_performance_pct = _get(row, 74, "float"),
                score_academic          = _get(row, 75, "float"),
                knowledge_quality_pct   = _get(row, 76, "float"),
                score_knowledge         = _get(row, 77, "float"),
                admission_count         = _get(row, 78, "int"),
                graduates_count         = _get(row, 79, "int"),
                graduates_pct           = _get(row, 80, "float"),
                score_graduates         = _get(row, 81, "float"),
                zm_students_count       = _get(row, 82, "int"),
                zm_academic_pct         = _get(row, 83, "float"),
                score_zm_academic       = _get(row, 84, "float"),
                zm_quality_pct          = _get(row, 85, "float"),
                score_zm_quality        = _get(row, 86, "float"),
                zm_admission_count      = _get(row, 87, "int"),
                zm_graduates_count      = _get(row, 88, "int"),
                zm_graduates_pct        = _get(row, 89, "float"),
                score_zm_graduates      = _get(row, 90, "float"),
                ws_student_place_republic = _get(row, 91, "str"),
                score_ws_student_republic = _get(row, 92, "float"),
                ws_student_place_intl   = _get(row, 93, "str"),
                score_ws_student_intl   = _get(row, 94, "float"),
                startup_count           = _get(row, 95, "int"),
                score_startups          = _get(row, 96, "float"),
                demo_exam_students      = _get(row, 97, "int"),
                score_demo_exam         = _get(row, 98, "float"),
                entrepreneur_graduates  = _get(row, 99, "int"),
                score_entrepreneurs     = _get(row, 100, "float"),
                employment_graduates    = _get(row, 101, "int"),
                employment_employed     = _get(row, 102, "str"),
                employment_pct          = _get(row, 103, "float"),
                score_employment        = _get(row, 104, "float"),
                zm_employment_graduates = _get(row, 105, "int"),
                zm_employment_employed  = _get(row, 106, "str"),
                zm_employment_pct       = _get(row, 107, "float"),
                score_zm_employment     = _get(row, 108, "float"),
                dual_students_count     = _get(row, 109, "int"),
                score_dual              = _get(row, 110, "float"),
                employer_request_count  = _get(row, 111, "int"),
                score_employer_requests = _get(row, 112, "float"),
                specialty_score         = _get(row, 114, "float"),
            )

            try:
                await db.execute(text("""
                    INSERT INTO college_assessment_specialty (
                        assessment_id, specialty_raw, specialty_code, specialty_name,
                        labs_total, labs_equipped, labs_equipped_pct, score_labs,
                        zhas_maman_participation, score_zhas_maman,
                        spec_teachers_total, spec_teachers_master, spec_teachers_master_pct,
                        score_spec_master, spec_teachers_science, spec_teachers_science_pct,
                        score_spec_science, expertise_teachers, score_expertise,
                        ws_expert_republic, score_ws_expert_republic,
                        ws_expert_intl, score_ws_expert_intl,
                        abroad_internship_count, abroad_internship_pct, score_abroad_internship,
                        prof_contest_winners, score_prof_contest,
                        industry_teachers_count, industry_teachers_pct, score_industry_teachers,
                        academic_performance_pct, score_academic,
                        knowledge_quality_pct, score_knowledge,
                        admission_count, graduates_count, graduates_pct, score_graduates,
                        zm_students_count, zm_academic_pct, score_zm_academic,
                        zm_quality_pct, score_zm_quality, zm_admission_count,
                        zm_graduates_count, zm_graduates_pct, score_zm_graduates,
                        ws_student_place_republic, score_ws_student_republic,
                        ws_student_place_intl, score_ws_student_intl,
                        startup_count, score_startups,
                        demo_exam_students, score_demo_exam,
                        entrepreneur_graduates, score_entrepreneurs,
                        employment_graduates, employment_employed, employment_pct, score_employment,
                        zm_employment_graduates, zm_employment_employed, zm_employment_pct,
                        score_zm_employment, dual_students_count, score_dual,
                        employer_request_count, score_employer_requests, specialty_score
                    ) VALUES (
                        :assessment_id, :specialty_raw, :specialty_code, :specialty_name,
                        :labs_total, :labs_equipped, :labs_equipped_pct, :score_labs,
                        :zhas_maman_participation, :score_zhas_maman,
                        :spec_teachers_total, :spec_teachers_master, :spec_teachers_master_pct,
                        :score_spec_master, :spec_teachers_science, :spec_teachers_science_pct,
                        :score_spec_science, :expertise_teachers, :score_expertise,
                        :ws_expert_republic, :score_ws_expert_republic,
                        :ws_expert_intl, :score_ws_expert_intl,
                        :abroad_internship_count, :abroad_internship_pct, :score_abroad_internship,
                        :prof_contest_winners, :score_prof_contest,
                        :industry_teachers_count, :industry_teachers_pct, :score_industry_teachers,
                        :academic_performance_pct, :score_academic,
                        :knowledge_quality_pct, :score_knowledge,
                        :admission_count, :graduates_count, :graduates_pct, :score_graduates,
                        :zm_students_count, :zm_academic_pct, :score_zm_academic,
                        :zm_quality_pct, :score_zm_quality, :zm_admission_count,
                        :zm_graduates_count, :zm_graduates_pct, :score_zm_graduates,
                        :ws_student_place_republic, :score_ws_student_republic,
                        :ws_student_place_intl, :score_ws_student_intl,
                        :startup_count, :score_startups,
                        :demo_exam_students, :score_demo_exam,
                        :entrepreneur_graduates, :score_entrepreneurs,
                        :employment_graduates, :employment_employed, :employment_pct, :score_employment,
                        :zm_employment_graduates, :zm_employment_employed, :zm_employment_pct,
                        :score_zm_employment, :dual_students_count, :score_dual,
                        :employer_request_count, :score_employer_requests, :specialty_score
                    )
                    ON CONFLICT (assessment_id, specialty_raw)
                    DO UPDATE SET
                        specialty_score    = EXCLUDED.specialty_score,
                        employment_pct     = EXCLUDED.employment_pct,
                        score_employment   = EXCLUDED.score_employment,
                        academic_performance_pct = EXCLUDED.academic_performance_pct,
                        score_dual         = EXCLUDED.score_dual
                """), spec_data)
                stats["specialties_inserted"] += 1
            except Exception as e:
                stats["errors"].append(
                    f"Специальность '{specialty_raw[:40]}': {e}")
                logger.warning("Specialty insert error: %s", e)

    await db.commit()
    stats["errors"] = stats["errors"][:30]
    return stats
```

---

## ЧАСТЬ 3 — API ENDPOINTS

Файл: `edu_backend/app/api/v1/college_assessment.py`

```python
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.dependencies import get_db, require_roles
from app.crud.college_assessment_import import parse_and_import_college_assessment

router = APIRouter(prefix="/college-assessment", tags=["College Assessment"])


@router.post("/import", summary="Загрузить Excel оценки эффективности колледжей")
async def import_college_assessment(
    file: UploadFile = File(...),
    period_year: Optional[int] = Form(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["superadmin", "admin"])),
):
    """
    Принимает Excel-шаблон оценки эффективности колледжей ТиППО.
    Поддерживает файлы по любой области. Год берётся из имени файла
    (например '2024_Абай_шаблон.xlsx' → 2024) или из параметра period_year.
    """
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(422, "Только .xlsx/.xls")
    contents = await file.read()
    result = await parse_and_import_college_assessment(
        db, contents, file.filename, period_year, str(user.id)
    )
    return {"filename": file.filename, **result}


@router.get("/ratings", summary="Рейтинг колледжей")
async def get_ratings(
    period_year: Optional[int] = Query(None),
    region:      Optional[str] = Query(None),
    ownership:   Optional[str] = Query(None),
    limit:  int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["superadmin","admin","management","data_entry"])),
):
    """Рейтинг колледжей по итоговому баллу с фильтрами."""
    where, params = ["1=1"], {}
    if period_year:
        where.append("period_year = :year"); params["year"] = period_year
    if region:
        where.append("region ILIKE :region"); params["region"] = f"%{region}%"
    if ownership:
        where.append("ownership_form ILIKE :own"); params["own"] = f"%{ownership}%"
    params.update({"limit": limit, "offset": offset})

    rows = await db.execute(text(f"""
        SELECT
            ca.id, ca.college_name, ca.region, ca.district,
            ca.ownership_form, ca.location_type, ca.period_year,
            ca.contingent_actual, ca.capacity_design, ca.teachers_total,
            ca.total_score,
            COUNT(cas.id) AS specialty_count,
            ROUND(AVG(cas.specialty_score), 2) AS avg_specialty_score,
            RANK() OVER (PARTITION BY ca.period_year ORDER BY ca.total_score DESC) AS rank
        FROM college_assessment ca
        LEFT JOIN college_assessment_specialty cas ON cas.assessment_id = ca.id
        WHERE {" AND ".join(where)}
        GROUP BY ca.id
        ORDER BY ca.total_score DESC
        LIMIT :limit OFFSET :offset
    """), params)

    count = await db.execute(text(f"""
        SELECT COUNT(*) FROM college_assessment WHERE {" AND ".join([w for w in where if 'limit' not in w and 'offset' not in w])}
    """), {k: v for k, v in params.items() if k not in ("limit","offset")})

    return {"items": [dict(r._mapping) for r in rows.fetchall()], "total": count.scalar()}


@router.get("/{assessment_id}/specialties", summary="Специальности колледжа")
async def get_specialties(
    assessment_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["superadmin","admin","management","data_entry"])),
):
    rows = await db.execute(text("""
        SELECT specialty_code, specialty_name, specialty_score,
               employment_pct, academic_performance_pct,
               score_employment, score_academic, score_dual,
               dual_students_count, demo_exam_students,
               ws_student_place_republic, ws_student_place_intl
        FROM college_assessment_specialty
        WHERE assessment_id = :id
        ORDER BY specialty_score DESC
    """), {"id": assessment_id})
    return {"specialties": [dict(r._mapping) for r in rows.fetchall()]}


@router.get("/stats/overview", summary="Сводная статистика по всем регионам")
async def get_overview(
    period_year: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["superadmin","admin","management"])),
):
    where = "WHERE period_year = :year" if period_year else ""
    params = {"year": period_year} if period_year else {}
    rows = await db.execute(text(f"""
        SELECT
            region,
            COUNT(*)           AS college_count,
            ROUND(AVG(total_score), 2) AS avg_score,
            MAX(total_score)   AS max_score,
            MIN(total_score)   AS min_score,
            SUM(contingent_actual) AS total_students,
            COUNT(CASE WHEN total_score >= 20 THEN 1 END) AS high_performers,
            COUNT(CASE WHEN total_score < 10  THEN 1 END) AS low_performers
        FROM college_assessment {where}
        GROUP BY region
        ORDER BY avg_score DESC
    """), params)
    return {"by_region": [dict(r._mapping) for r in rows.fetchall()]}


@router.get("/stats/comparison", summary="Сравнение годов")
async def get_year_comparison(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["superadmin","admin","management"])),
):
    rows = await db.execute(text("""
        SELECT period_year,
               COUNT(*) AS colleges,
               ROUND(AVG(total_score), 2) AS avg_score,
               ROUND(AVG(employment_pct), 2) AS avg_employment_pct
        FROM college_assessment ca
        LEFT JOIN LATERAL (
            SELECT AVG(employment_pct) AS employment_pct
            FROM college_assessment_specialty
            WHERE assessment_id = ca.id
        ) spec ON TRUE
        GROUP BY period_year
        ORDER BY period_year
    """))
    return {"by_year": [dict(r._mapping) for r in rows.fetchall()]}
```

Зарегистрируй в `main.py`:
```python
from app.api.v1 import college_assessment
app.include_router(college_assessment.router, prefix="/api/v1")
```

---

## ЧАСТЬ 4 — UI: СТРАНИЦА ОЦЕНКИ КОЛЛЕДЖЕЙ

Файл: `edu_frontend/src/features/tippo/CollegeAssessmentPage.tsx`

### 4 раздела в одном компоненте:

**Вкладка 1 — «Загрузить файл»** (только admin/superadmin):
- Drag-and-drop зона или кнопка выбора .xlsx
- Опциональный выбор года (если не определяется из имени файла)
- Прогресс-спиннер во время загрузки
- Карточки результата: колледжей загружено / специальностей / ошибки

**Вкладка 2 — «Рейтинг»** (все роли):
- Фильтры сверху: Год (select) / Регион (поиск) / Форма собственности
- Таблица с колонками:
  ```
  Ранг | Колледж | Регион | Форма | Контингент | Педагоги | Балл | Специальностей
  ```
- Балл — цветовой индикатор: ≥20 зелёный, 10-19 жёлтый, <10 красный
- При клике на строку — открывается панель специальностей колледжа
- Кнопка «Экспорт» (CSV для начала)

**Вкладка 3 — «По регионам»** (admin+):
- Карточки регионов с avg_score, count, high_performers/low_performers
- Bar chart сравнения регионов (recharts BarChart)
- Цвет: fc-navy для высоких, fc-danger для низких

**Вкладка 4 — «Специальности»** (все роли):
- Таблица топ-20 специальностей по трудоустройству
- Топ-10 по WorldSkills
- Топ-10 по дуальному обучению
- Колонки: Специальность | Колледж | Регион | Трудоустройство % | Балл

### Цветовая логика баллов:
```tsx
const getScoreColor = (score: number) => {
  if (score >= 20) return "text-success";
  if (score >= 15) return "text-fc-cyan-600";
  if (score >= 10) return "text-warning";
  return "text-danger";
};
```

### API calls:
```typescript
// Загрузка
client.post("/college-assessment/import", formData, {
  headers: { "Content-Type": "multipart/form-data" }
})

// Рейтинг с фильтрами
client.get("/college-assessment/ratings", { params: { period_year, region, limit, offset } })

// Специальности конкретного колледжа
client.get(`/college-assessment/${id}/specialties`)

// Статистика по регионам
client.get("/college-assessment/stats/overview", { params: { period_year } })
```

### Подключить в `portal.tsx`:
```tsx
import CollegeAssessmentPage from "@/features/tippo/CollegeAssessmentPage";

// В nav sidebar — секция "Данные":
{ to: "/tippo/colleges", label: "Оценка колледжей", icon: Building2,
  show: r => true },

// Экспорт страницы:
export function CollegesPage() {
  return (
    <>
      <PageHeader
        title="Оценка эффективности колледжей"
        subtitle="Рейтинг ТиППО по методике АО «Финансовый центр»"
      />
      <CollegeAssessmentPage />
    </>
  );
}
```

В `App.tsx`:
```tsx
<Route path="/tippo/colleges" element={<CollegesPage />} />
```

---

## ПОРЯДОК ВЫПОЛНЕНИЯ

```bash
# 1. Статус системы
docker compose ps

# 2. Миграция
docker compose exec -T postgres psql -U edu_user -d edu_monitoring \
    < app/migrations/versions/013_college_assessment.sql

# Проверить таблицы
docker compose exec -T postgres psql -U edu_user -d edu_monitoring -c "
    SELECT table_name FROM information_schema.tables
    WHERE table_name LIKE 'college%' ORDER BY 1;
"

# 3. Создать файлы бэкенда
# crud/college_assessment_import.py
# api/v1/college_assessment.py + регистрация в main.py

# 4. Проверить зависимости
grep -E "openpyxl|pandas" app/requirements.txt
# Если нет — добавить

# 5. Рестарт API
docker compose restart api
docker compose logs --tail=20 api

# 6. Проверить endpoints
curl -s http://localhost:8000/openapi.json | python3 -c "
import sys, json
for p in sorted(json.load(sys.stdin)['paths']):
    if 'college' in p: print(p)
"

# 7. Создать UI компонент
# src/features/tippo/CollegeAssessmentPage.tsx
# portal.tsx patch + App.tsx route

# 8. Пересборка фронта
docker compose build --no-cache frontend
docker compose --profile frontend up -d --force-recreate frontend
```

---

## ТЕСТ ПОСЛЕ РЕАЛИЗАЦИИ

```bash
# Загрузить тестовый файл через curl
curl -X POST http://localhost:8000/api/v1/college-assessment/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/Абаи__шаблон.xlsx"

# Ожидаемый результат:
# {"colleges_inserted": 33, "specialties_inserted": ~214, "errors": []}
```

Проверочные SQL:
```sql
-- Топ-5 колледжей
SELECT college_name, region, total_score
FROM college_assessment
ORDER BY total_score DESC LIMIT 5;

-- Средний балл по форме собственности
SELECT ownership_form,
       COUNT(*) AS cnt,
       ROUND(AVG(total_score), 2) AS avg_score
FROM college_assessment
GROUP BY ownership_form ORDER BY avg_score DESC;

-- Топ специальностей по трудоустройству
SELECT cas.specialty_name, ca.college_name, ca.region,
       cas.employment_pct, cas.specialty_score
FROM college_assessment_specialty cas
JOIN college_assessment ca ON ca.id = cas.assessment_id
WHERE cas.employment_pct IS NOT NULL
ORDER BY cas.employment_pct DESC LIMIT 10;
```

---

## КРИТЕРИИ ГОТОВНОСТИ

- [ ] Таблицы `college_assessment` и `college_assessment_specialty` созданы
- [ ] `POST /api/v1/college-assessment/import` принимает .xlsx, возвращает статистику
- [ ] При загрузке Абайского шаблона: 33 колледжа + ~214 специальностей без ошибок
- [ ] `GET /api/v1/college-assessment/ratings` возвращает ранжированный список
- [ ] `GET /api/v1/college-assessment/stats/overview` разбивка по регионам
- [ ] Страница `/tippo/colleges` открывается
- [ ] Drag-and-drop загрузка работает, показывает карточки результата
- [ ] Таблица рейтинга с цветовой индикацией баллов
- [ ] При клике на колледж — видны его специальности
- [ ] Повторная загрузка того же файла не дублирует данные (UPSERT)
- [ ] Загрузка файла другой области работает без изменений кода

---

## ПОДВОДНЫЕ КАМНИ

- **Двойная структура строк** — col[46] = признак типа строки. Не перепутай.
  Строка колледжа может идти ПОСЛЕ строк специальностей при неправильном порядке —
  отслеживай `current_college_id` по изменению col[0] (ID)

- **Балл может быть 0** — не путай с None. `_to_float("0") = 0.0`, не None

- **Строка трудоустройства "1/7"** — это не float. Храним как VARCHAR,
  % считается в col[103]. Не пытайся парсить "1/7" как число

- **Баллы типа "0.5"** с запятой — замени запятую на точку в `_to_float`

- **Имя файла без года** — тогда `_extract_year` вернёт None. Используй form-поле
  `period_year` как запасной вариант

- **UNIQUE (college_name, region, period_year)** — если в одном регионе два колледжа
  с одинаковым именем (маловероятно, но возможно) → первый перезапишет второй.
  Если понадобится — добавь `district` в UNIQUE constraint

- **`:param::jsonb` не нужен** — здесь нет JSONB полей, только скаляры. Но помни
  общее правило из CLAUDE.md: никаких `::` в SQLAlchemy text() параметрах

- **После деплоя фронта** — открывай в инкогнито
