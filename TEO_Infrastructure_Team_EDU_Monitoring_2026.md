# Технико-экономическое обоснование
## Аппаратная инфраструктура и штатное расписание
## ГИС «EDU Monitoring» — АО «Финансовый центр»

**Версия:** 1.0  
**Дата:** май 2026  
**Статус:** Для внутреннего использования

---

## 1. Исходные данные и предположения

### 1.1 Масштаб системы

| Параметр | Значение |
|---|---|
| Организации в БД | 2 255 |
| Регионы | 20 |
| Уровни образования | 5 (ДО, ДопО, СО, ТиППО, ВиПО) |
| Записей в основных таблицах (est.) | ~10 млн строк |
| Полей на сущность (avg) | ~795 полей |
| Пиковые одновременные сессии | 3 000–5 000 |
| Суточный объём API-запросов | ~2 млн |
| Исторические данные | 5+ лет |

### 1.2 Требования к надёжности

| Параметр | Требование |
|---|---|
| Доступность (SLA) | 99,9% (≤ 8,7 ч/год плановых + внеплановых простоев) |
| RTO (Recovery Time Objective) | ≤ 30 минут |
| RPO (Recovery Point Objective) | ≤ 15 минут |
| Резервирование | N+1 по всем уровням стека |
| Геораспределение | Нет (on-premise, один ЦОД) |

### 1.3 Профиль нагрузки

- **Пиковое время**: 09:00–12:00, 14:00–17:00 AST (рабочие дни)
- **AI-нагрузка**: Celery tasks, ночные batch-задачи 01:00–05:00 AST
- **Отчётность**: Ежеквартальные дедлайны — кратковременный spike ×3–5 от среднего
- **Интеграции**: НОБД, ЕПВО, eGov, АРРФР, Кунделик, Студом, ГБДФЛ — webhook + pull sync

---

## 2. Аппаратная инфраструктура

### 2.1 Серверы приложений (Application Tier)

#### 2.1.1 API / Web серверы

**Конфигурация (4 узла, схема 3 active + 1 standby):**

| Компонент | Спецификация |
|---|---|
| CPU | 2× Intel Xeon Gold 6448Y (32 cores / 64 threads @ 2.1–4.1 GHz each) |
| RAM | 256 GB DDR5-4800 ECC (16× 16GB RDIMM) |
| Boot SSD | 2× 480GB SATA SSD RAID-1 |
| Cache SSD | 2× 1.92TB NVMe U.2 (Redis AOF, Celery spill) |
| NIC | 2× 25 GbE SFP28 (bond active-backup) |
| OOB | 1× IPMI/iDRAC/iLO |
| Form-factor | 1U rack |

**Итого: 4 сервера**

**Обоснование:**
- 64 физических ядра на узел × 3 активных = 192 vCPU для FastAPI uvicorn workers (4 workers × 16 CPUs = 64 asyncio workers per node)
- 256 GB RAM достаточно для 2× Gunicorn + Redis replica + Celery beat + OS overhead с запасом ×2.5 от текущего потребления
- NVMe кэш — Redis RDB/AOF checkpoint без нагрузки на SAN

**ПО:**
- OS: Rocky Linux 9 (RHEL-совместимый, LTS)
- Runtime: Python 3.12, uvicorn, gunicorn
- Process supervisor: systemd + Docker Compose v2
- Load balancing: HAProxy (L7) на отдельных узлах (см. 2.5)

---

#### 2.1.2 Celery Worker серверы

**Конфигурация (2 узла):**

| Компонент | Спецификация |
|---|---|
| CPU | 2× AMD EPYC 9354 (32 cores / 64 threads @ 2.85–3.8 GHz) |
| RAM | 512 GB DDR5-4800 ECC (16× 32GB RDIMM) |
| Boot SSD | 2× 480GB SATA SSD RAID-1 |
| Scratch NVMe | 4× 3.84TB NVMe U.2 (task spill, temp exports) |
| NIC | 2× 25 GbE SFP28 |
| Form-factor | 2U rack |

**Итого: 2 сервера**

**Обоснование:**
- EPYC 9354 — высокая IPC, большой кэш L3 (256 MB per socket) → эффективен для pandas/numpy в DataAnalyzer
- 512 GB RAM: одновременная обработка 3–5 крупных AI presentations (каждая ~50 MB JSON контекста) + Celery concurrency=32 workers
- Celery задачи: `build_ai_presentation`, `ai_anomaly_scan`, `sync_from_external`, `notify_admins_submission`

---

### 2.2 База данных (Database Tier)

#### 2.2.1 PostgreSQL кластер (Patroni HA)

**Конфигурация (3 узла: 1 Primary + 2 Standby):**

| Компонент | Спецификация |
|---|---|
| CPU | 2× AMD EPYC 9554 (64 cores / 128 threads @ 3.1–3.75 GHz) |
| RAM | 512 GB DDR5-4800 ECC (16× 32GB RDIMM) |
| OS/Boot | 2× 480GB SATA SSD RAID-1 |
| WAL NVMe | 2× 1.92TB NVMe U.2 RAID-1 (Write-Ahead Log) |
| Data NVMe | 8× 7.68TB NVMe U.2 RAID-10 (4+4) → ~30 TB usable per node |
| NIC | 2× 25 GbE SFP28 (replication) + 1× 10 GbE (management) |
| Form-factor | 2U rack |

**Итого: 3 сервера**

**Программный стек:**
| Компонент | Версия / Конфигурация |
|---|---|
| PostgreSQL | 16 с расширениями: pgvector, pg_stat_statements, pg_partman, timescaledb-lite |
| Patroni | 3.x (etcd для DCS) |
| PgBouncer | 1.22 (transaction pooling, 5000→50 соединений) |
| etcd кластер | 3 узла (совмещены с DB серверами, отдельный порт) |

**PostgreSQL tuning (shared_buffers = 128GB, effective_cache_size = 384GB):**
```
shared_buffers           = 128GB
effective_cache_size     = 384GB
work_mem                 = 256MB
maintenance_work_mem     = 8GB
max_connections          = 200  # PgBouncer перед ним
wal_level                = replica
max_wal_senders          = 10
synchronous_commit       = remote_apply  # RPO ≤ 15 мин
checkpoint_completion_target = 0.9
random_page_cost         = 1.1  # NVMe
```

**Обоснование RAM:**
- 10 млн строк × средний row size ~2 KB = ~20 GB данных активных таблиц
- Индексы (B-tree + GIN для JSONB) ≈ 8–12 GB
- shared_buffers 128 GB обеспечивает кэш hit rate > 99% для горячих данных
- Остаток 384 GB = OS page cache + PgBouncer + etcd + OS

---

#### 2.2.2 Redis кластер

**Конфигурация (3 узла: 1 Master + 2 Replica, Sentinel режим):**

| Компонент | Спецификация |
|---|---|
| CPU | 2× Intel Xeon Silver 4416+ (20 cores @ 2.0–3.9 GHz) |
| RAM | 128 GB DDR4-3200 ECC |
| NVMe | 2× 1.92TB NVMe (AOF persistence) |
| NIC | 2× 10 GbE |
| Form-factor | 1U rack |

**Итого: 3 сервера**

**Использование Redis в системе:**
- Кэш AI insights (TTL 5 мин)
- Celery broker (очереди задач)
- Rate limiting (integrations trigger: 10/мин/user)
- Сессионные токены / JWT blacklist
- PubSub для realtime уведомлений

---

### 2.3 AI / GPU серверы (Inference Tier)

> **Стратегическое замечание по выбору GPU:**
> NVIDIA H100/H200 подпадают под экспортный контроль США (EAR/BIS Export Controls).
> Для Казахстана рекомендуется AMD Instinct MI300X — аналогичная производительность
> на LLM inference, без ограничений на поставку, официальные каналы дистрибуции в РК.

**Конфигурация (2 узла):**

| Компонент | Спецификация |
|---|---|
| CPU | 2× AMD EPYC 9374F (32 cores @ 3.85–4.3 GHz, оптимизирован под I/O) |
| RAM | 1 TB DDR5-4800 ECC (32× 32GB RDIMM) |
| GPU | 4× AMD Instinct MI300X 192GB HBM3 (768 GB HBM3 совокупно) |
| GPU Interconnect | AMD Infinity Fabric (peer-to-peer ~896 GB/s) |
| NVMe | 8× 7.68TB NVMe U.2 (модели, чекпойнты, vector index) |
| NIC | 2× 100 GbE QSFP28 (для модельного трафика) + 2× 25 GbE |
| Power | 2× 3000W PSU (redundant) |
| Form-factor | 4U rack |

**Итого: 2 сервера (активный + резервный/offline batch)**

**Программный стек:**
| Компонент | Назначение |
|---|---|
| ROCm 6.x | AMD GPU runtime |
| vLLM (ROCm build) | LLM inference engine, OpenAI-compatible API |
| Qwen2.5-72B-Instruct (FP8) | Локальная LLM (заменитель/дополнение Gemini) |
| LLaMA 3.1 70B (FP8) | Резервная модель |
| pgvector | Vector similarity (в PostgreSQL на DB серверах) |
| Chroma / Qdrant | Standalone vector store для RAG (опционально) |

**Модели и их использование (FP8 квантизация):**
- Qwen2.5-72B @ 4× MI300X: ~40 GB/GPU в FP8 → fits comfortably, ~150 tokens/sec throughput
- Параллельная обработка: до 8 concurrent inference requests
- Ночные batch задачи: DataAnalyzer + полный пересчёт аномалий по всем 2255 организациям

**Связь с Gemini API:**
- Текущая конфигурация использует Google Gemini (gemini-2.5-flash/pro) через API
- Локальные GPU — для: (а) offline/air-gap режима, (б) снижения API costs при масштабе,
  (в) RAG над внутренними документами без утечки данных

---

### 2.4 Системы хранения данных (Storage)

#### 2.4.1 Primary All-NVMe SAN

| Параметр | Значение |
|---|---|
| Тип | All-NVMe SAN (NVMe-oF / FC-NVMe) |
| Raw ёмкость | 24× 15.36TB NVMe SSD = 368 TB raw |
| RAID | RAID-6 (22+2) → ~320 TB usable |
| Защита | 2 контроллера active-active, dual-port |
| Пропускная способность | ~100 GB/s seq read / ~60 GB/s seq write |
| IOPS | > 5 млн random read 4K |
| Latency | < 100 μs |
| Connectivity | 4× 32Gb FC per controller |

**Распределение ёмкости:**
| Назначение | Объём |
|---|---|
| PostgreSQL data (3 узла × 30 TB) | 90 TB |
| PostgreSQL WAL + архив | 20 TB |
| AI модели + чекпойнты | 30 TB |
| Vector embeddings index | 10 TB |
| Backup staging (hot tier) | 50 TB |
| Логи, экспорты, temp | 20 TB |
| **Резерв (≥ 30%)** | **100 TB** |
| **Итого usable** | **~320 TB** |

#### 2.4.2 Backup / Archive Storage

| Параметр | Значение |
|---|---|
| Тип | NL-SAS HDD NAS (холодный tier) |
| Raw ёмкость | 48× 18TB NL-SAS = 864 TB raw |
| RAID | RAID-6 группы → ~672 TB usable |
| Compression | 2:1 avg → ~1.3 PB logical |
| Retention | PostgreSQL: ежедневно 30 дней + еженедельно 52 нед + ежемесячно 24 мес |
| Backup ПО | pgBackRest (инкрементальный, WAL архивирование) |

---

### 2.5 Сетевая инфраструктура и безопасность

#### 2.5.1 Межсетевые экраны (NGFW)

| Параметр | Значение |
|---|---|
| Устройство | Palo Alto PA-5250 **или** Fortinet FortiGate 3000F (2 шт., HA Active-Passive) |
| Пропускная способность | 72 Gbps firewall / 22 Gbps threat prevention |
| Функции | NGFW + IPS/IDS + SSL inspection + App-ID + User-ID |
| VPN | IPSec/SSL VPN для remote admin |

#### 2.5.2 Web Application Firewall (WAF)

| Параметр | Значение |
|---|---|
| Устройство | F5 BIG-IP i5800 **или** Imperva SecureSphere X6500 |
| Пропускная способность | 10 Gbps |
| Функции | OWASP Top 10, Bot management, API security, Rate limiting |
| Интеграция | В разрыв перед Load Balancer |

#### 2.5.3 Anti-DDoS

| Параметр | Значение |
|---|---|
| Устройство | Arbor Networks APS 2900 (on-premise scrubbing) |
| Пропускная способность | 40 Gbps mitigation |
| Функции | Volumetric + application-layer DDoS protection |
| Интеграция | На входе в ЦОД, перед NGFW |

#### 2.5.4 Load Balancers

| Параметр | Значение |
|---|---|
| Устройство | 2× HAProxy на выделенных серверах (1U, 10 GbE) ИЛИ F5 BIG-IP LTM |
| Режим | Active-Passive (VRRP/keepalived) |
| Алгоритм | Least connections + health checks (HTTP /health) |
| SSL termination | На LB уровне (Let's Encrypt / корпоративный CA) |

#### 2.5.5 Коммутационное оборудование

**Уровень ядра (Core):**
- 2× Cisco Nexus 93360YC-FX2 (100 GbE spine, VXLAN/EVPN)

**Уровень доступа (Access/ToR):**
- 6× Cisco Nexus 93180YC-FX (25 GbE leaf, по 1 на стойку)

**Ленточная топология:** Spine-Leaf (все серверы connected to both spines для резервирования)

#### 2.5.6 Контроль доступа

| Компонент | Решение |
|---|---|
| SIEM | ELK Stack (self-hosted) + Wazuh агенты |
| PAM | CyberArk PAS **или** HashiCorp Vault + Teleport |
| Network segmentation | VLAN + Micro-segmentation (NSX-T опционально) |
| Certificate management | HashiCorp Vault PKI |
| Vulnerability scanner | OpenVAS / Qualys |

---

### 2.6 Сводная таблица оборудования

| # | Тип сервера | Количество | CPU | RAM | Storage |
|---|---|---|---|---|---|
| 1 | API сервер | 4 | 2× Xeon Gold 6448Y (64c) | 256 GB | 4 TB NVMe local |
| 2 | Celery Worker | 2 | 2× EPYC 9354 (64c) | 512 GB | 16 TB NVMe local |
| 3 | PostgreSQL (Patroni) | 3 | 2× EPYC 9554 (128c) | 512 GB | ~32 TB NVMe (WAL+Data) |
| 4 | Redis (Sentinel) | 3 | 2× Xeon Silver 4416+ (40c) | 128 GB | 4 TB NVMe |
| 5 | AI/GPU сервер | 2 | 2× EPYC 9374F (64c) | 1 TB | 60 TB NVMe + 4×MI300X |
| 6 | Load Balancer | 2 | — (dedicated) | 32 GB | 480 GB |
| **7** | **Итого серверов** | **16** | — | — | — |
| 8 | SAN All-NVMe | 1 система | — | — | ~320 TB usable |
| 9 | NAS Backup | 1 система | — | — | ~672 TB usable |
| 10 | NGFW | 2 (HA) | — | — | — |
| 11 | WAF | 1–2 | — | — | — |
| 12 | Anti-DDoS | 1 | — | — | — |
| 13 | Core Switch | 2 | — | — | — |
| 14 | Access Switch | 6 | — | — | — |

---

### 2.7 Ориентировочная стоимость оборудования

> Цены указаны в USD, ориентировочные (2025–2026 прайс-листы вендоров).
> Курс для бюджетирования: 1 USD ≈ 520 KZT.

| Категория | Кол-во | Стоимость (USD) |
|---|---|---|
| API серверы (×4) | 4 | ~$120 000 |
| Celery Worker серверы (×2) | 2 | ~$80 000 |
| PostgreSQL серверы (×3) | 3 | ~$210 000 |
| Redis серверы (×3) | 3 | ~$45 000 |
| AI/GPU серверы 4×MI300X (×2) | 2 | ~$1 200 000 |
| Load Balancer серверы (×2) | 2 | ~$20 000 |
| SAN All-NVMe | 1 | ~$400 000 |
| NAS Backup | 1 | ~$120 000 |
| Сетевое оборудование (Cisco Nexus × 8) | 8 | ~$180 000 |
| Безопасность (NGFW + WAF + Anti-DDoS) | — | ~$250 000 |
| ИБП, PDU, кабельная инфраструктура | — | ~$80 000 |
| **ИТОГО оборудование** | | **~$2 705 000** |
| **≈ в KZT (×520)** | | **≈ 1 406 600 000 ₸** |

> **Примечание:** Цены на AMD MI300X могут варьироваться ($200–300K/GPU в зависимости от партии).
> Альтернативный вариант без GPU серверов (только Gemini API): сокращение на ~$1.2M,
> но зависимость от внешнего API и ежегодные операционные расходы ~$200–400K/год.

---

## 3. Штатное расписание команды

### 3.1 Принципы формирования команды

- Команда рассчитана на **разработку + production support** системы
- Все специализации покрыты минимум 2 людьми (bus factor ≥ 2)
- Выделенные роли InfoSec (требование для государственных ИС Казахстана)
- SLA 99,9% требует **круглосуточного дежурства** (ротация DevSecOps/DBA)

---

### 3.2 Состав команды (19 человек)

#### Инженерный состав

| # | Роль | Кол-во | Ответственность |
|---|---|---|---|
| 1 | **Tech Lead / Solution Architect** | 1 | Архитектурные решения, code review, технический roadmap, взаимодействие с заказчиком |
| 2 | **Senior Backend Engineer** | 2 | FastAPI, SQLAlchemy, Celery; разработка новых модулей, performance tuning |
| 3 | **Middle Backend Engineer** | 2 | CRUD endpoints, интеграции с внешними системами (НОБД, ЕПВО и др.), unit tests |
| 4 | **Senior Frontend Engineer** | 1 | React/TypeScript/Vite архитектура, design system, complex UI (coefficients, charts) |
| 5 | **Middle Frontend Engineer** | 1 | Формы данных, feature компоненты, Tailwind/Recharts |
| 6 | **AI/ML Engineer** | 2 | Gemini API интеграция, prompt engineering, RAG система, vLLM настройка, DataAnalyzer |
| 7 | **QA Engineer** | 2 | E2E тесты (Playwright), API тесты (pytest), нагрузочное тестирование (k6), регрессия |
| 8 | **DevSecOps Engineer** | 2 | CI/CD (GitLab/Jenkins), Docker, мониторинг (Prometheus/Grafana), патчи, duty rotation |
| 9 | **DBA (PostgreSQL)** | 2 | Patroni, миграции, query optimization, backup/restore, pgBouncer tuning |
| 10 | **System Administrator** | 1 | Физическое оборудование, OS, сети, SAN, NAS, BIOS/firmware |

#### Аналитический и обеспечивающий состав

| # | Роль | Кол-во | Ответственность |
|---|---|---|---|
| 11 | **Information Security Engineer** | 2 | SIEM, WAF правила, пентест, соответствие требованиям МЦРИАП РК, аудит доступа |
| 12 | **Business Analyst / Technical Writer** | 1 | Требования, функциональные спецификации, пользовательская документация, TEO |

**ИТОГО: 19 человек**

---

### 3.3 Матрица ответственности (RACI — ключевые процессы)

| Процесс | Tech Lead | Sr Backend | DevSecOps | DBA | InfoSec |
|---|---|---|---|---|---|
| Архитектурные изменения | **A/R** | C | I | C | C |
| Production deploy | A | R | **R** | I | I |
| DB миграция | A | R | I | **R** | I |
| Incident response | **A** | R | R | R | R |
| Доступ к prod данным | A | I | I | I | **R** |
| AI модели (prompts) | C | I | I | I | I |

---

### 3.4 Фонд оплаты труда (ориентировочный, Алматы/Астана 2025–2026)

| Роль | Кол-во | Зарплата (KZT/мес gross) | Годовой ФОТ (KZT) |
|---|---|---|---|
| Tech Lead | 1 | 1 800 000 | 21 600 000 |
| Senior Backend Engineer | 2 | 1 400 000 | 33 600 000 |
| Middle Backend Engineer | 2 | 900 000 | 21 600 000 |
| Senior Frontend Engineer | 1 | 1 300 000 | 15 600 000 |
| Middle Frontend Engineer | 1 | 800 000 | 9 600 000 |
| AI/ML Engineer | 2 | 1 600 000 | 38 400 000 |
| QA Engineer | 2 | 700 000 | 16 800 000 |
| DevSecOps Engineer | 2 | 1 200 000 | 28 800 000 |
| DBA | 2 | 1 300 000 | 31 200 000 |
| System Administrator | 1 | 900 000 | 10 800 000 |
| InfoSec Engineer | 2 | 1 100 000 | 26 400 000 |
| BA / Technical Writer | 1 | 700 000 | 8 400 000 |
| **ИТОГО** | **19** | — | **262 800 000 ₸** |

> Сверху: +20% социальные отчисления (ОПВ, ВОСМС, СО, ИПН) ≈ +52 560 000 ₸/год
> **Полный ФОТ с начислениями: ~315 360 000 ₸/год**

---

### 3.5 Дополнительные операционные расходы (OPEX)

| Статья | Год, KZT |
|---|---|
| Лицензии ПО (SIEM, PAM, сканеры) | ~12 000 000 |
| Gemini API (текущий) | ~8 000 000 – 20 000 000 |
| Расширенная поддержка вендоров (3-year support) | ~30 000 000 |
| ЦОД аренда/коммунальные (если не собственный) | ~24 000 000 |
| Обучение и сертификация команды | ~5 000 000 |
| **ИТОГО OPEX (без ФОТ)** | **~79 000 000 – 91 000 000 ₸/год** |

---

## 4. Сводный бюджет

| Категория | Сумма |
|---|---|
| **CAPEX** | |
| Оборудование | ~1 406 600 000 ₸ |
| Монтаж, ПНР, интеграция (10% от CAPEX) | ~140 660 000 ₸ |
| **Итого CAPEX** | **~1 547 260 000 ₸** |
| **OPEX (год 1)** | |
| ФОТ с начислениями | ~315 360 000 ₸ |
| Прочие операционные | ~85 000 000 ₸ |
| **Итого OPEX год 1** | **~400 360 000 ₸** |
| **TCO 3 года** | **~2 748 340 000 ₸** |

---

## 5. Фазирование внедрения

### Фаза 1 — MVP Production (месяцы 1–3)
- Закупка и монтаж минимального ядра: 2 API сервера, 3 PostgreSQL (Patroni), 1 Redis, SAN
- Развёртывание текущего стека (FastAPI + Celery + Gemini API)
- CI/CD, мониторинг, backup
- Команда: 10 человек (Tech Lead + 2 Backend + 1 Frontend + 2 DevSecOps + 2 DBA + 1 QA)

### Фаза 2 — HA & Scale (месяцы 4–6)
- Добавление 2 API серверов + 2 Celery Worker
- Redis HA (3 узла Sentinel)
- WAF, Anti-DDoS
- Нагрузочное тестирование
- Команда: +3 человека (InfoSec, QA, Frontend)

### Фаза 3 — AI On-Premise (месяцы 7–12)
- AI/GPU серверы (2× AMD MI300X)
- vLLM deployment, RAG система
- Переход с Gemini API на гибридный режим
- Команда: +2 AI/ML Engineers, +1 SysAdmin, +1 BA

---

## 6. Риски и митигация

| Риск | Вероятность | Влияние | Митигация |
|---|---|---|---|
| Задержка поставки MI300X | Средняя | Высокое | Фаза 1–2 на Gemini API; MI300X в Фазу 3 |
| Ключевой сотрудник уходит (bus factor) | Средняя | Высокое | Минимум 2 человека на каждую специализацию; документация |
| PostgreSQL primary failure | Низкая | Критическое | Patroni автофейловер < 30 сек; RPO ≤ 15 мин через WAL |
| Компрометация через интеграции (НОБД/ЕПВО) | Средняя | Высокое | HMAC-SHA256 webhooks; NGFW; изолированный DMZ для интеграций |
| Утечка данных образовательных организаций | Низкая | Критическое | RLS в PostgreSQL; AES-256 at rest; TLS 1.3; PAM; аудит |
| Нехватка ёмкости SAN при росте данных | Низкая | Среднее | 30% резерв в SAN + online expansion; тиеринг на NAS |

---

## 7. Соответствие требованиям РК

| Требование | Статус |
|---|---|
| Закон РК «О персональных данных» (2013, ред. 2023) | ✅ Данные в РК, шифрование, аудит |
| Требования МЦРИАП РК к государственным ИС | ✅ On-premise, отечественный ЦОД |
| СТ РК ISO/IEC 27001 | Рекомендуется сертификация (год 2) |
| Требования к аттестации ИС (НТС) | В плане (год 2) |
| Экспортный контроль на оборудование | ✅ AMD MI300X не под ограничениями EAR |

---

*Документ подготовлен для внутреннего использования АО «Финансовый центр».*  
*Все цены ориентировочны и требуют уточнения по актуальным коммерческим предложениям.*

---
**Конец документа**
