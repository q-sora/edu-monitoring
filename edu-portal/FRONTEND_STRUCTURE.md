# Структура фронтенда — edu-portal

Корень: `edu-portal/edu_frontend/src/`

---

## Точка входа

| Файл | Назначение |
|------|-----------|
| `main.tsx` | Монтирование React-приложения |
| `App.tsx` | Роутер (React Router v6), все маршруты и guards |
| `portal.tsx` | Re-export файл — перенаправляет импорты на feature-файлы (не содержит логики) |
| `index.css` | Глобальные стили, CSS-токены, utility-классы (`.card`, `.btn-*`, `.input` и др.) |
| `vite-env.d.ts` | Типы Vite |

---

## Layout

| Файл | Компоненты |
|------|-----------|
| `layout/AppShell.tsx` | `NAV`, `SidebarNavItem`, `Sidebar`, `UserMenu`, `AppShell` |

---

## Auth

| Файл | Компоненты / Экспорты |
|------|----------------------|
| `auth/AuthContext.tsx` | `AuthProvider`, `useAuth` |
| `auth/LoginPage.tsx` | `LoginPage` (страница входа) |
| `auth/ProtectedRoute.tsx` | `RequireAuth`, `RequireRole`, `RequirePermission`, `BootLoader` |
| `auth/tokenStore.ts` | Хранение JWT-токенов (localStorage) |
| `auth/types.ts` | `UserRole`, `User` типы |

---

## API

| Файл | Назначение |
|------|-----------|
| `api/client.ts` | Axios-инстанс с интерцепторами (авторизация, рефреш токена) |
| `api/auth.ts` | Функции `login`, `refreshToken`, `logout` |

---

## Хуки

| Файл | Экспорты |
|------|---------|
| `hooks/useApi.ts` | `useApi<T>`, `mutate`, `useRegions`, тип `Region` |

---

## Утилиты

| Файл | Назначение |
|------|-----------|
| `lib/animations.ts` | Framer Motion варианты: `pageVariants`, `staggerContainer`, `staggerItem`, `fadeInUp` |

---

## Общие компоненты

| Файл | Компоненты |
|------|-----------|
| `components/brand/Logo.tsx` | `Logo`, `LogoWithText` — SVG логотип АО «Финансовый центр» |
| `components/layout/BrandHeader.tsx` | `BrandHeader` — шапка с логотипом (используется на LoginPage) |
| `components/ui/index.tsx` | `Loader`, `ErrorBox`, `EmptyState`, `StatCard`, `StatusBadge`, `RoleBadge`, `PageHeader`, `Modal`, `Field`, `SuccessBox`, `SkeletonGrid` |
| `components/ui/FormFields.tsx` | `NumField`, `MoneyField`, `PercentField`, `DateField`, `SelectField`, `TextField`, `SectionHeader`, `StatusPill` — переиспользуемые поля форм |

---

## Страницы — features

### Dashboard
| Файл | Компоненты |
|------|-----------|
| `features/dashboard/DashboardPage.tsx` | `DashboardPage`, `AdminDashboard`, `DataEntryDashboard`, `ManagementDashboard`, `StatusChart` |

### Прозрачность
| Файл | Компоненты |
|------|-----------|
| `features/transparency/TransparencyPage.tsx` | `TransparencyPage`, `MetricPill`, `RankCard` |
| `features/transparency/RegionalAnalytics.tsx` | `RegionalAnalytics` — карта регионов (SVG) со статистикой |

### Покрытие данных
| Файл | Компоненты |
|------|-----------|
| `features/coverage/CoveragePage.tsx` | `CoveragePage`, `CoverageCell` |

### Уровни образования (новые маршруты /edu/*)
| Файл | Компоненты |
|------|-----------|
| `features/edu-level/EduLevelPage.tsx` | `EduLevelPage` — единый компонент для всех уровней |
| `features/edu-level/levelConfig.ts` | `LEVEL_CONFIG`, `EduLevel` тип — конфигурация каждого уровня |

### Формы ввода данных
| Файл | Компоненты | Маршрут |
|------|-----------|---------|
| `features/contingent/ContingentForm.tsx` | `ContingentForm` | используется в EduLevelPage |
| `features/finance/FinanceForm.tsx` | `FinanceForm` | используется в EduLevelPage |
| `features/science/ScienceForm.tsx` | `ScienceForm` | используется в EduLevelPage |
| `features/graduates/GraduatesForm.tsx` | `GraduatesForm` | используется в EduLevelPage |
| `features/education/EducationForm.tsx` | `EducationForm` | используется в EduLevelPage |
| `features/data-entry/DataEntryWrapper.tsx` | `OrgPicker`, `DataEntryWrapper` | обёртка для старых форм |
| `features/data-entry/DataPages.tsx` | `ContingentPage`, `FinancePage`, `SciencePage`, `GraduatesPage`, `EducationPage`, `HistoryPage` | legacy, перенаправлены на /edu/* |

### Школы / Рейтинг
| Файл | Компоненты |
|------|-----------|
| `features/schools/SchoolRatingForm.tsx` | `SchoolRatingForm` — рейтинг школ `/data/school-rating` |
| `features/schools/ratingLogic.ts` | Логика расчёта рейтинга |

### Аналитика
| Файл | Компоненты |
|------|-----------|
| `features/analytics/SupersetDashboardsPage.tsx` | `SupersetDashboardsPage`, `SupersetSection`, `EmbeddedDashboard`, `BI_DASHBOARDS` |
| `features/analytics/SupersetDashboard.tsx` | `SupersetDashboard` — компонент встраивания iframe с skeleton |
| `features/analytics/AnalyticsGlobalStatsPage.tsx` | `AnalyticsGlobalStatsPage` |

### AI
| Файл | Компоненты |
|------|-----------|
| `features/ai/AIReportsPage.tsx` | `AIReportsPage`, `InsightCharts` |
| `features/presentations/PresentationsPage.tsx` | `PresentationsPage`, `SlideDeckViewer`, `GenerateForm`, `ReportRow` |
| `features/presentations/PresentationEngine.tsx` | `PresentationEngine`, тип `PresentationReport` |
| `features/anomalies/AnomaliesPage.tsx` | `AnomaliesPage` |

### Администрирование
| Файл | Компоненты |
|------|-----------|
| `features/admin/UsersPage.tsx` | `UsersPage`, `CreateUserModal` |
| `features/admin/OrganisationsPage.tsx` | `OrganisationsPage` |
| `features/admin/ApprovalsPage.tsx` | `ApprovalsPage`, `ApprovalRow` |
| `features/admin/AuditLogPage.tsx` | `AuditLogPage` |
| `features/admin/IntegrationsPage.tsx` | `IntegrationsPage` |
| `features/admin/ApiKeysPage.tsx` | `ApiKeysPage`, `CreateApiKeyModal` |

### Каталог и импорт
| Файл | Компоненты |
|------|-----------|
| `features/catalog/DataCatalogPage.tsx` | `DataCatalogPage` |
| `features/import/UniversalImportPage.tsx` | `UniversalImportPage` |

### ТиПО / Колледжи
| Файл | Компоненты |
|------|-----------|
| `features/tippo/CollegesPage.tsx` | `CollegesPage` — список колледжей |
| `features/tippo/CollegeAssessmentPage.tsx` | `CollegeAssessmentPage` — оценка колледжа |

### Коэффициенты
| Файл | Компоненты |
|------|-----------|
| `features/coefficients/CoefficientsPage.tsx` | `CoefficientsPage` |

### Профиль
| Файл | Компоненты |
|------|-----------|
| `features/profile/ProfilePage.tsx` | `ProfilePage`, `ChangePasswordModal` |

---

## Прочие страницы

| Файл | Компоненты |
|------|-----------|
| `pages/NotFoundPage.tsx` | `NotFoundPage` — страница 404 |

---

## Маршруты (App.tsx)

| Путь | Компонент | Доступ |
|------|-----------|--------|
| `/login` | `LoginPage` | публичный |
| `/` | redirect | авторизация |
| `/dashboard` | `DashboardPage` | все роли |
| `/transparency` | `TransparencyPage` | все роли |
| `/profile` | `ProfilePage` | все роли |
| `/catalog` | `DataCatalogPage` | все роли |
| `/dashboards` | `SupersetDashboardsPage` | все роли |
| `/coverage` | `CoveragePage` | admin, superadmin |
| `/edu/preschool` | `EduLevelPage` (do) | все роли |
| `/edu/school` | `EduLevelPage` (so) | все роли |
| `/edu/extracurricular` | `EduLevelPage` (dopo) | все роли |
| `/edu/college` | `EduLevelPage` (tippo) | все роли |
| `/edu/university` | `EduLevelPage` (vipo) | все роли |
| `/edu/special` | `EduLevelPage` (gons) | все роли |
| `/data/school-rating` | `SchoolRatingForm` | data.submit |
| `/data/coefficients` | `CoefficientsPage` | все роли |
| `/analytics/global-stats` | `AnalyticsGlobalStatsPage` | все роли |
| `/reports` | `AIReportsPage` | ai_insights.view |
| `/presentations` | `PresentationsPage` | ai_insights.view |
| `/anomalies` | `AnomaliesPage` | ai_insights.view |
| `/admin/organisations` | `OrganisationsPage` | admin, superadmin |
| `/admin/users` | `UsersPage` | admin, superadmin |
| `/admin/approvals` | `ApprovalsPage` | admin, superadmin |
| `/admin/integrations` | `IntegrationsPage` | admin, superadmin |
| `/admin/audit` | `AuditLogPage` | admin, superadmin |
| `/admin/api-keys` | `ApiKeysPage` | superadmin |
| `/admin/universal-import` | `UniversalImportPage` | admin, superadmin |
| `/tippo/colleges` | `CollegesPage` | все роли |
| `*` | `NotFoundPage` | — |
