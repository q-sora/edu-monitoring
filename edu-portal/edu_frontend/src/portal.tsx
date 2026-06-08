// src/portal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Все страницы портала, layout, и общие компоненты в одном файле.
// Полностью обновлено под фирменный стиль АО «Финансовый центр» (брендбук 2025).
//
// Ключевые изменения от прошлой версии:
//   • blue-600  → fc-navy-700 (основной)
//   • blue-500  → fc-blue-500 (акцент)
//   • slate-100 → slate-100 (нейтральный фон сохраняется)
//   • emerald   → success (#0e8c5a)
//   • амбер     → warning (#c47200)
//   • red-600   → danger  (#c1272d)
//
// Тон: язык расчёта и моделей, без декларативных лозунгов.
// Все UPPERCASE-метки используют tracking-fc-eyebrow (0.18em).
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  FormEvent, ReactNode, useCallback, useEffect, useState,
} from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { pageVariants, staggerContainer, staggerItem, fadeInUp } from "@/lib/animations";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, Building2, FileCheck2, Plug, FileSearch,
  Key, GraduationCap, Wallet, FlaskConical, UsersRound, BookOpen, History,
  Sparkles, Menu, LogOut, UserCircle, ChevronDown, Plus, X, Search,
  Check, AlertTriangle, Loader2, RefreshCw, Clock, ShieldCheck, BarChart3,
  Grid3X3, ArrowUpDown, ChevronUp, Presentation,
  MessageSquare, RotateCcw, Download, Building, Database, FileUp,
} from "lucide-react";

const ChevronDownIcon = ChevronDown;
import client from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import BrandHeader from "@/components/layout/BrandHeader";
import Logo from "@/components/brand/Logo";
import RegionalAnalytics from "@/features/transparency/RegionalAnalytics";
import SupersetDashboard from "@/features/analytics/SupersetDashboard";
import { PresentationEngine } from "@/features/presentations/PresentationEngine";
import CollegeAssessmentPageComponent from "@/features/tippo/CollegeAssessmentPage";
import type { PresentationReport as EngineReport } from "@/features/presentations/PresentationEngine";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useApi, mutate, useRegions } from "@/hooks/useApi";
import type { Region } from "@/hooks/useApi";
import {
  Loader, ErrorBox, EmptyState, StatCard, StatusBadge, RoleBadge,
  PageHeader, Modal, Field, SuccessBox,
} from "@/components/ui";

// Hooks and shared UI components are imported from their own files.
// See: src/hooks/useApi.ts and src/components/ui/index.tsx

// ════════════════════════════════════════════════════════════════════════════
//  LAYOUT — APP SHELL
// ════════════════════════════════════════════════════════════════════════════

interface NavItem {
  to: string;
  label: string;
  icon: any;
  show: (role: string) => boolean;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Обзор",
    items: [
      { to: "/dashboard", label: "Главный дашборд", icon: LayoutDashboard,
        show: r => ["superadmin", "admin", "management", "data_entry"].includes(r) },
    ],
  },
  {
    section: "Уровни образования",
    items: [
      { to: "/edu/preschool",       label: "Дошкольное (ДДО)",    icon: Building2,      show: r => true },
      { to: "/edu/school",          label: "Школы",               icon: GraduationCap,  show: r => true },
      { to: "/edu/extracurricular", label: "Доп. образование",    icon: Sparkles,       show: r => true },
      { to: "/edu/college",         label: "ТиПО / Колледжи",     icon: Building2,      show: r => true },
      { to: "/edu/university",      label: "ОВПО / Университеты",  icon: GraduationCap,  show: r => true },
      { to: "/edu/special",         label: "ГОНС",                icon: Building,       show: r => true },
    ],
  },
  {
    section: "Аналитика",
    items: [
      { to: "/anomalies",         label: "Аномалии",       icon: AlertTriangle,
        show: r => ["superadmin", "admin", "management"].includes(r) },
      { to: "/reports",           label: "AI-отчёты",      icon: Sparkles,
        show: r => ["superadmin", "admin", "management"].includes(r) },
      { to: "/presentations",     label: "Презентации",    icon: Presentation,
        show: r => ["superadmin", "admin", "management"].includes(r) },
      { to: "/transparency",      label: "Прозрачность",    icon: BarChart3,
        show: r => ["superadmin", "admin", "management"].includes(r) },
      { to: "/coverage",          label: "Покрытие данных", icon: Grid3X3,
        show: r => ["superadmin", "admin"].includes(r) },
    ],
  },
  {
    section: "Администрирование",
    items: [
      { to: "/admin/organisations", label: "Организации",   icon: Building2,
        show: r => ["superadmin", "admin"].includes(r) },
      { to: "/admin/users",         label: "Пользователи",  icon: Users,
        show: r => ["superadmin", "admin"].includes(r) },
      { to: "/admin/approvals",     label: "Согласования",  icon: FileCheck2,
        show: r => ["superadmin", "admin"].includes(r) },
      { to: "/admin/integrations",  label: "Интеграции",    icon: Plug,
        show: r => ["superadmin", "admin"].includes(r) },
      { to: "/catalog",             label: "Каталог данных", icon: Database,
        show: r => true },
      { to: "/admin/universal-import", label: "Импорт",     icon: FileUp,
        show: r => ["superadmin", "admin"].includes(r) },
      { to: "/admin/audit",         label: "Аудит",         icon: FileSearch,
        show: r => ["superadmin", "admin"].includes(r) },
      { to: "/admin/api-keys",      label: "API-ключи",     icon: Key,
        show: r => r === "superadmin" },
    ],
  },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const role = user?.role ?? "";
  
  const { data: pendingResp } = useApi<{ total: number }>(
    ["superadmin", "admin"].includes(role) ? "/admin/pending-submissions?limit=0" : null
  );
  const { data: anomalyResp } = useApi<{ total: number }>(
    ["superadmin", "admin", "management"].includes(role) ? "/admin/anomalies?limit=0" : null
  );

  const pendingCount = pendingResp?.total ?? 0;
  const anomalyCount = anomalyResp?.total ?? 0;

  return (
    <aside className="w-64 bg-fc-navy-900 bg-fc-pattern h-full flex flex-col shrink-0">
      <BrandHeader dark showProductName />

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2.5 pb-4 space-y-5 pt-5">
        <LayoutGroup id="sidebar-nav">
          {NAV.map(section => {
            const visibleItems = section.items.filter(i => i.show(role));
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.section}>
                <p className="px-3 mb-2 label-eyebrow !text-white/40">
                  {section.section}
                </p>
                <div className="space-y-0.5">
                  {visibleItems.map(item => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-2.5 px-3 py-2 rounded-md text-sm${
                          isActive ? "" : " hover:bg-white/5"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <motion.div
                              layoutId="nav-active-pill"
                              className="absolute inset-0 rounded-md bg-fc-blue-500 shadow-fc-sm"
                              style={{ zIndex: 0 }}
                              transition={{ type: "spring", stiffness: 420, damping: 34 }}
                            />
                          )}
                          <item.icon className={`relative z-10 w-4 h-4 shrink-0 transition-colors ${
                            isActive ? "text-white" : "text-white/60 group-hover:text-white"
                          }`} />
                          <span className={`relative z-10 truncate flex-1 transition-colors ${
                            isActive ? "text-white font-semibold" : "text-white/70 group-hover:text-white"
                          }`}>
                            {item.label}
                          </span>
                          
                          {item.to === "/anomalies" && anomalyCount > 0 && (
                            <span className="relative z-10 shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white
                                             text-[10px] font-bold flex items-center justify-center tabular-nums">
                              {anomalyCount > 99 ? "99+" : anomalyCount}
                            </span>
                          )}

                          {item.to === "/admin/approvals" && pendingCount > 0 && (
                            <span className="relative z-10 shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-fc-blue-400 text-white
                                             text-[10px] font-bold flex items-center justify-center tabular-nums">
                              {pendingCount > 99 ? "99+" : pendingCount}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </LayoutGroup>
      </nav>

      <div className="px-4 py-3 border-t border-white/10">
        <p className="text-[9px] text-white/40 uppercase tracking-fc-eyebrow">
          © 2026 АО «Финансовый центр»
        </p>
      </div>
    </aside>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 rounded-md">
        <div className="w-8 h-8 bg-fc-navy-700 text-white rounded-md flex items-center justify-center font-bold text-xs">
          {user.full_name.slice(0, 2).toUpperCase()}
        </div>
        <div className="text-left min-w-0 hidden md:block">
          <p className="text-xs font-semibold text-fc-navy-900 truncate max-w-[150px]">
            {user.full_name}
          </p>
          <p className="text-[10px] text-fc-steel-500 truncate max-w-[150px]">{user.email}</p>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-fc-steel-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-fc-lg border border-slate-200 w-60 z-50 overflow-hidden">
            <div className="px-3 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-sm font-semibold text-fc-navy-900 truncate">{user.full_name}</p>
              <p className="text-xs text-fc-steel-500 truncate">{user.email}</p>
              <div className="mt-2"><RoleBadge role={user.role} /></div>
            </div>
            <button onClick={() => { setOpen(false); navigate("/profile"); }}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-2 text-fc-navy-700">
              <UserCircle className="w-4 h-4" /> Профиль
            </button>
            <button onClick={() => { setOpen(false); logout(); }}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-danger/5 flex items-center gap-2 text-danger border-t border-slate-100">
              <LogOut className="w-4 h-4" /> Выйти
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-fc-navy-900/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 gap-4 shrink-0">
          <button onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 hover:bg-slate-100 rounded-md">
            <Menu className="w-5 h-5" />
          </button>
          <div className="lg:hidden flex items-center gap-2">
            <Logo className="w-6 h-6" />
            <p className="font-display font-extrabold text-sm text-fc-navy-900 uppercase tracking-fc-tight">
              Финансовый центр
            </p>
          </div>
          <div className="flex-1 min-w-0" />
          <UserMenu />
        </header>

        <main className="flex-1 overflow-y-auto p-5 lg:p-7">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              className="max-w-6xl mx-auto"
              variants={pageVariants}
              initial="initial"
              animate="enter"
              exit="exit"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  DASHBOARD PAGE
// ════════════════════════════════════════════════════════════════════════════

interface AdminStats {
  organizations: number;
  total_students: number;
  pending_science: number;
  pending_contingent: number;
  redis_version?: string;
  uptime_seconds?: number;
  by_status?: Record<string, number>;
}

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === "data_entry") return <DataEntryDashboard />;
  if (user.role === "management") return <ManagementDashboard />;
  return <AdminDashboard />;
}

function AdminDashboard() {
  const { user } = useAuth();
  const { data: stats, loading, error, refetch } = useApi<AdminStats>("/admin/stats");
  const { data: pendingResp } = useApi<{ items: any[]; total: number }>("/admin/pending-submissions?limit=5");
  const pending = pendingResp?.items ?? [];

  return (
    <>
      <PageHeader
        title={`Здравствуйте, ${user?.full_name ?? ""}`}
        subtitle="Сводка показателей системы мониторинга образования"
        actions={
          <button onClick={refetch} className="btn-ghost">
            <RefreshCw className="w-3.5 h-3.5" /> Обновить
          </button>
        }
      />

      {loading && <Loader />}
      {error && <ErrorBox message={error} onRetry={refetch} />}

      {stats && (
        <>
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <StatCard accent="navy"  icon={Building}       label="Организаций"    value={stats.organizations ?? 0}                                                                              hint="В реестре" />
            <StatCard accent="cyan"  icon={GraduationCap}  label="Контингент"     value={(stats.total_students ?? 0).toLocaleString("ru-RU")}                                                        hint="Обучающихся (всего)" />
            <StatCard accent="blue"  icon={FlaskConical}   label="На проверке"    value={(stats.pending_contingent ?? 0) + (stats.pending_science ?? 0)}                                             hint="Записей ожидают согласования" />
            <StatCard accent="steel" icon={ShieldCheck}    label="Аптайм"         value={`${Math.floor((stats.uptime_seconds ?? 0) / 3600)}ч`}                                                      hint="Сервер работает" />
          </motion.div>

          {stats.by_status && (
            <div className="card p-5 mb-6">
              <p className="label-eyebrow mb-4">Распределение по статусам</p>
              <StatusChart data={stats.by_status} />
            </div>
          )}
        </>
      )}

      <div className="card overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="font-display font-bold text-fc-navy-900">Последние заявки</p>
          <Link to="/admin/approvals" className="text-xs font-semibold text-fc-blue-600 hover:underline">
            Все →
          </Link>
        </div>
        {pending.length === 0 ? (
          <div className="p-8 text-center text-sm text-fc-steel-500">Заявок на согласование нет</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Раздел</th>
                <th>Организация</th>
                <th>Период</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {pending.slice(0, 10).map((p: any, i: number) => (
                <tr key={i}>
                  <td className="font-medium">{p.domain ?? p.table_name ?? "—"}</td>
                  <td className="text-fc-steel-600">{p.org_name ?? p.org_id ?? "—"}</td>
                  <td className="text-fc-steel-600">{p.period_year ?? "—"}</td>
                  <td><StatusBadge status={p.submission_status ?? "submitted"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SupersetSection />
    </>
  );
}

function StatusChart({ data }: { data: Record<string, number> }) {
  const STATUS_LABELS_MAP: Record<string, string> = {
    draft:        "Черновики",
    submitted:    "Отправлено",
    under_review: "На рассмотрении",
    approved:     "Одобрено",
    rejected:     "Отклонено",
  };
  const HEX_COLORS: Record<string, string> = {
    draft:        "#94a3b8",
    submitted:    "#0068b4",
    under_review: "#c47200",
    approved:     "#0e8c5a",
    rejected:     "#c1272d",
  };

  const chartData = Object.entries(data).map(([k, v]) => ({
    name: STATUS_LABELS_MAP[k] ?? k,
    value: v,
    fill: HEX_COLORS[k] ?? "#94a3b8",
    status: k,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,.06)" }}
          cursor={{ fill: "rgba(25,40,109,.04)" }}
          formatter={(v: any, _: any, entry: any) => [
            <span className="font-bold tabular-nums">{v}</span>,
            entry.payload.name,
          ]}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DataEntryDashboard() {
  const { user } = useAuth();
  const orgId = user?.org_id;
  const { data: completeness } = useApi<any>(orgId ? `/admin/completeness/${orgId}` : null);

  const sections: Array<{to: string; label: string; icon: any; accent: any}> = [
    { to: "/data/contingent", label: "Контингент",         icon: GraduationCap, accent: "blue" },
    { to: "/data/finance",    label: "Финансы",            icon: Wallet,        accent: "navy" },
    { to: "/data/science",    label: "Научная деят.",      icon: FlaskConical,  accent: "cyan" },
    { to: "/data/graduates",  label: "Выпускники",         icon: UsersRound,    accent: "steel" },
    { to: "/data/education",  label: "Образ. процесс",     icon: BookOpen,      accent: "purple" },
      { to: "/data/school-rating", label: "Рейтинг школ", icon: BarChart3, accent: "cyan" },
  ];

  const accentColors: Record<string, string> = {
    navy:   "bg-fc-navy-50 text-fc-navy-700",
    blue:   "bg-fc-blue-50 text-fc-blue-700",
    cyan:   "bg-fc-cyan-50 text-fc-cyan-700",
    steel:  "bg-fc-steel-50 text-fc-steel-700",
    purple: "bg-fc-purple-50 text-fc-purple-700",
  };

  return (
    <>
      <PageHeader
        title={`Здравствуйте, ${user?.full_name}`}
        subtitle="Заполните данные по вашей организации в разделах ниже"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sections.map(s => (
          <Link key={s.to} to={s.to} className="card-hover p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accentColors[s.accent]}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <p className="font-display font-bold text-fc-navy-900">{s.label}</p>
            </div>
            <p className="text-xs text-fc-steel-500 mt-2">
              {completeness?.[s.to.split("/").pop()!]?.filled ?? "—"} заполненных записей
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}

function ManagementDashboard() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader
        title={`Добро пожаловать, ${user?.full_name}`}
        subtitle="Аналитика и дашборды системы мониторинга АО «Финансовый центр»"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <Link to="/transparency" className="card-hover p-5 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-fc-cyan-50 shrink-0">
            <BarChart3 className="w-5 h-5 text-fc-cyan-600" />
          </div>
          <div>
            <p className="font-display font-bold text-fc-navy-900 text-sm">Прозрачность</p>
            <p className="text-xs text-fc-steel-500 mt-0.5">Карта регионов и показатели организаций</p>
          </div>
        </Link>
        <Link to="/reports" className="card-hover p-5 flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-fc-purple-50 shrink-0">
            <Sparkles className="w-5 h-5 text-fc-purple-500" />
          </div>
          <div>
            <p className="font-display font-bold text-fc-navy-900 text-sm">AI инсайты</p>
            <p className="text-xs text-fc-steel-500 mt-0.5">Аналитика на основе Gemini</p>
          </div>
        </Link>
      </div>
      <SupersetSection />
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  TRANSPARENCY PAGE — отдельный приоритет ребрендинга
// ════════════════════════════════════════════════════════════════════════════

const ORG_TYPE_RU: Record<number, string> = {
  1: "Дошкольное",
  2: "Дополнительное",
  3: "Среднее",
  4: "Техн. и проф.",
  5: "Высшее и послевуз.",
  6: "Общежитие",
  7: "ГОНС Келешек",
  8: "Иное",
};

const STATUS_RU: Record<string, string> = {
  active:       "Активна",
  reorganized:  "Реорганизована",
  liquidated:   "Ликвидирована",
};

interface TransparencyOrg {
  id: string;
  name_ru: string;
  org_type_id: number | null;
  region_id: number | null;
  budget: number | null;
  students: number | null;
  cost_per_student: number | null;
  payroll_pct: number | null;
  grant_pct: number | null;
  employment_rate: number | null;
  rnd_pct: number | null;
  state_order: number | null;
  h_index_avg: number | null;
  publications_scopus: number | null;
  publications_wos: number | null;
}

interface TransparencyData {
  year: number;
  organizations: TransparencyOrg[];
  averages: {
    cost_per_student: number | null;
    payroll_pct: number | null;
    grant_pct: number | null;
    employment_rate: number | null;
  };
}

type SortKey = keyof TransparencyOrg;

function fmt(v: number | null, digits = 0): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("ru-RU", { maximumFractionDigits: digits });
}
function fmtM(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return (v / 1_000_000_000).toFixed(1) + " млрд ₸";
}

export function TransparencyPage() {
  // Фильтры приходят из карты через коллбэк
  const [mapYear,      setMapYear]      = useState(2024);
  const [mapOrgTypeId, setMapOrgTypeId] = useState<number | null>(null);
  const [mapRegionId,  setMapRegionId]  = useState<number | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("cost_per_student");
  const [sortAsc, setSortAsc] = useState(false);

  const handleMapFilter = useCallback(
    (year: number, orgTypeId: number | null, regionId: number | null) => {
      setMapYear(year);
      setMapOrgTypeId(orgTypeId);
      setMapRegionId(regionId);
    },
    [],
  );

  const apiUrl = React.useMemo(() => {
    let url = `/admin/transparency?year=${mapYear}`;
    if (mapRegionId  !== null) url += `&region_id=${mapRegionId}`;
    if (mapOrgTypeId !== null) url += `&org_type_id=${mapOrgTypeId}`;
    return url;
  }, [mapYear, mapRegionId, mapOrgTypeId]);

  const { data, loading, error } = useApi<TransparencyData>(apiUrl, [apiUrl]);

  const regions = useRegions();
  const regionName = React.useMemo(
    () => mapRegionId ? (regions.find(r => r.id === mapRegionId)?.name_ru ?? null) : null,
    [mapRegionId, regions],
  );

  const orgs = React.useMemo(() => {
    if (!data?.organizations) return [];
    return [...data.organizations].sort((a, b) => {
      const av = a[sortKey] as number | null;
      const bv = b[sortKey] as number | null;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return sortAsc ? av - bv : bv - av;
    });
  }, [data, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortTh = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th
      className="cursor-pointer select-none hover:bg-slate-100 transition-colors"
      onClick={() => toggleSort(k)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortKey === k
          ? (sortAsc ? <ChevronUp className="w-3 h-3 text-fc-blue-500" /> : <ChevronDownIcon className="w-3 h-3 text-fc-blue-500" />)
          : <ArrowUpDown className="w-3 h-3 text-fc-steel-300" />}
      </div>
    </th>
  );

  const avg = data?.averages;

  // Строка активного фильтра
  const filterParts: string[] = [];
  if (regionName)    filterParts.push(regionName);
  if (mapOrgTypeId)  filterParts.push(ORG_TYPE_RU[mapOrgTypeId] ?? "");
  const filterLabel = filterParts.length ? filterParts.join(" · ") : "Все организации";

  return (
    <>
      <PageHeader
        title="Прозрачность финансирования"
        subtitle="Сравнительные параметры расходов на образование между организациями"
      />

      <div className="card p-5 bg-fc-gradient bg-fc-pattern text-white mb-5">
        <p className="label-eyebrow !text-white/60 mb-1">Методология</p>
        <p className="text-sm text-white/80 max-w-3xl">
          Расходы на одного студента, доля ФОТ в бюджете, охват грантами,
          трудоустройство выпускников и научная активность рассчитываются по
          данным, поданным организациями в систему мониторинга АО «Финансовый центр».
        </p>
      </div>

      <RegionalAnalytics onFilterChange={handleMapFilter} />

      {loading && <Loader />}
      {error && <ErrorBox message={error} />}

      {avg && (
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <StatCard accent="navy"   label="Расходы на студента"  value={avg.cost_per_student ? `${(avg.cost_per_student / 1000).toFixed(0)} тыс ₸` : "—"} hint="Среднее по системе" />
          <StatCard accent="blue"   label="ФОТ от бюджета"       value={avg.payroll_pct ? `${avg.payroll_pct}%` : "—"} hint="Доля фонда оплаты труда" />
          <StatCard accent="cyan"   label="Грантовое обеспечение" value={avg.grant_pct ? `${avg.grant_pct}%` : "—"} hint="Студентов на госгранте" />
          <StatCard accent="steel"  label="Трудоустройство 6 мес" value={avg.employment_rate ? `${avg.employment_rate}%` : "—"} hint="Доля трудоустроенных" />
        </motion.div>
      )}

      {!loading && !error && (
        <div className="card overflow-x-auto mb-5">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
            <p className="label-eyebrow mr-auto">Финансы и контингент — {mapYear}</p>
            <span className="pill text-[10px]">{filterLabel}</span>
          </div>

          {orgs.length === 0 ? (
            <div className="p-8 text-center text-sm text-fc-steel-400">
              Нет данных по выбранному фильтру
            </div>
          ) : (
            <table className="data-table whitespace-nowrap">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white z-10">Организация</th>
                  <th>Уровень образования</th>
                  <SortTh k="students">Контингент</SortTh>
                  <SortTh k="budget">Бюджет</SortTh>
                  <SortTh k="cost_per_student">₸/чел.</SortTh>
                  <SortTh k="payroll_pct">ФОТ %</SortTh>
                  <SortTh k="rnd_pct">НИОКР %</SortTh>
                  <SortTh k="grant_pct">Грант %</SortTh>
                  <SortTh k="employment_rate">Трудоустр %</SortTh>
                  <SortTh k="h_index_avg">h-индекс</SortTh>
                  <SortTh k="publications_scopus">Scopus</SortTh>
                  <SortTh k="publications_wos">WoS</SortTh>
                </tr>
              </thead>
              <tbody>
                {orgs.map(org => (
                  <tr key={org.id}>
                    <td className="sticky left-0 bg-white font-medium text-fc-navy-900 max-w-[180px] truncate z-10">
                      <span title={org.name_ru}>{org.name_ru}</span>
                    </td>
                    <td className="text-fc-steel-500 text-xs">
                      {org.org_type_id ? (ORG_TYPE_RU[org.org_type_id] ?? "—") : "—"}
                    </td>
                    <td className="tabular-nums text-right">{fmt(org.students)}</td>
                    <td className="tabular-nums text-right">{fmtM(org.budget)}</td>
                    <td className="tabular-nums text-right font-semibold">
                      {org.cost_per_student ? `${(org.cost_per_student / 1000).toFixed(0)} тыс` : "—"}
                    </td>
                    <td className="tabular-nums text-right">
                      <MetricPill value={org.payroll_pct} avg={avg?.payroll_pct} higherIsBad />
                    </td>
                    <td className="tabular-nums text-right">
                      {fmt(org.rnd_pct, 1)}{org.rnd_pct !== null ? "%" : ""}
                    </td>
                    <td className="tabular-nums text-right">{fmt(org.grant_pct, 1)}{org.grant_pct !== null ? "%" : ""}</td>
                    <td className="tabular-nums text-right">
                      <MetricPill value={org.employment_rate} avg={avg?.employment_rate} higherIsBad={false} />
                    </td>
                    <td className="tabular-nums text-right">{fmt(org.h_index_avg, 2)}</td>
                    <td className="tabular-nums text-right">{fmt(org.publications_scopus)}</td>
                    <td className="tabular-nums text-right">{fmt(org.publications_wos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {orgs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RankCard
            title="Наибольшие расходы на контингент"
            orgs={[...orgs].sort((a, b) => (b.cost_per_student ?? 0) - (a.cost_per_student ?? 0)).slice(0, 5)}
            metric={o => o.cost_per_student ? `${(o.cost_per_student / 1000).toFixed(0)} тыс ₸` : "—"}
            accentClass="text-warning"
          />
          <RankCard
            title="Наилучшее трудоустройство выпускников"
            orgs={[...orgs].sort((a, b) => (b.employment_rate ?? 0) - (a.employment_rate ?? 0)).slice(0, 5)}
            metric={o => o.employment_rate !== null ? `${o.employment_rate}%` : "—"}
            accentClass="text-success"
          />
        </div>
      )}
    </>
  );
}

function MetricPill({ value, avg, higherIsBad }: { value: number | null; avg: number | null | undefined; higherIsBad: boolean }) {
  if (value === null || value === undefined) return <span className="text-fc-steel-400">—</span>;
  const label = `${value.toFixed(1)}%`;
  if (!avg) return <span>{label}</span>;
  const diff = value - avg;
  const isBetter = higherIsBad ? diff < 0 : diff > 0;
  const isWorse  = higherIsBad ? diff > 0 : diff < 0;
  return (
    <span className={isBetter ? "text-success font-semibold" : isWorse ? "text-danger" : ""}>
      {label}
    </span>
  );
}

function RankCard({ title, orgs, metric, accentClass }: {
  title: string;
  orgs: TransparencyOrg[];
  metric: (o: TransparencyOrg) => string;
  accentClass: string;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <p className="label-eyebrow">{title}</p>
      </div>
      <ul className="divide-y divide-slate-50">
        {orgs.map((org, i) => (
          <li key={org.id} className="flex items-center gap-3 px-5 py-2.5">
            <span className="w-5 h-5 rounded-full bg-fc-navy-50 text-fc-navy-700 text-xs font-bold flex items-center justify-center shrink-0">
              {i + 1}
            </span>
            <span className="text-sm text-fc-navy-800 flex-1 truncate" title={org.name_ru}>
              {org.name_ru}
            </span>
            <span className={`text-sm font-bold tabular-nums ${accentClass}`}>
              {metric(org)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  COVERAGE PAGE — матрица покрытия данных
// ════════════════════════════════════════════════════════════════════════════

interface CoverageOrg {
  id: string;
  name_ru: string;
  approved: number;
  total: number;
  modules: {
    contingent?: string | null;
    finance?: string | null;
    science?: string | null;
    graduates?: string | null;
    education?: string | null;
  };
}

interface CoverageData {
  year: number;
  organizations: CoverageOrg[];
  summary: {
    orgs_total: number;
    cells_total: number;
    cells_filled: number;
    cells_approved: number;
    coverage_pct: number;
  };
}

const MODULE_LABELS: Record<string, string> = {
  contingent: "Контингент",
  finance:    "Финансы",
  science:    "Наука",
  graduates:  "Выпускники",
  education:  "Образование",
};

const STATUS_COLORS: Record<string, string> = {
  approved:     "bg-success/15 text-success border-success/30",
  under_review: "bg-warning/15 text-warning border-warning/30",
  submitted:    "bg-fc-blue-50 text-fc-blue-600 border-fc-blue-200",
  draft:        "bg-slate-100 text-slate-500 border-slate-200",
};
const STATUS_LABELS: Record<string, string> = {
  approved:     "Утверждено",
  under_review: "На проверке",
  submitted:    "Подано",
  draft:        "Черновик",
};

function CoverageCell({ status }: { status: string | null | undefined }) {
  if (!status) {
    return (
      <div className="flex items-center justify-center h-8 rounded border border-dashed border-slate-200 bg-slate-50">
        <span className="text-[10px] text-slate-400 font-medium">НЕТ</span>
      </div>
    );
  }
  const cls = STATUS_COLORS[status] ?? "bg-slate-100 text-slate-500 border-slate-200";
  const lbl = STATUS_LABELS[status] ?? status;
  return (
    <div className={`flex items-center justify-center h-8 rounded border text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {lbl}
    </div>
  );
}

export function CoveragePage() {
  const [year,       setYear]       = useState(2025);
  const [regionId,   setRegionId]   = useState<number | "">("");
  const [orgTypeId,  setOrgTypeId]  = useState<number | "">("");
  const [search,     setSearch]     = useState("");
  const [page,       setPage]       = useState(0);
  const limit = 50;

  const regions = useRegions();

  const apiUrl = React.useMemo(() => {
    const p = new URLSearchParams();
    p.set("year", String(year));
    p.set("limit", String(limit));
    p.set("offset", String(page * limit));
    if (regionId)  p.set("region_id",   String(regionId));
    if (orgTypeId) p.set("org_type_id",  String(orgTypeId));
    if (search)    p.set("search",       search);
    return `/admin/coverage?${p.toString()}`;
  }, [year, regionId, orgTypeId, search, page]);

  const { data, loading, error } = useApi<CoverageData & { total: number; limit: number; offset: number }>(
    apiUrl, [apiUrl],
  );

  const modules = ["contingent", "finance", "science", "graduates", "education"];

  const resetPage = () => setPage(0);

  return (
    <>
      <PageHeader
        title="Покрытие данных"
        subtitle="Какие организации подали данные по каждому модулю"
      />

      {/* ─── Фильтры ─── */}
      <div className="card mb-4 px-4 py-3 flex flex-wrap gap-2 items-center">
        <select value={year} onChange={e => { setYear(Number(e.target.value)); resetPage(); }}
          className="input py-1.5 text-sm w-24">
          {[2025,2024,2023,2022,2021,2020].map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select value={regionId} onChange={e => { setRegionId(e.target.value ? Number(e.target.value) : ""); resetPage(); }}
          className="input py-1.5 text-sm min-w-[160px]">
          <option value="">Все регионы</option>
          {regions.map(r => <option key={r.id} value={r.id}>{r.name_ru}</option>)}
        </select>

        <select value={orgTypeId} onChange={e => { setOrgTypeId(e.target.value ? Number(e.target.value) : ""); resetPage(); }}
          className="input py-1.5 text-sm min-w-[160px]">
          <option value="">Все типы</option>
          {Object.entries(ORG_TYPE_RU).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>

        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-fc-steel-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); resetPage(); }}
            placeholder="Поиск…" className="input pl-9 py-1.5 text-sm" />
        </div>

        {(regionId || orgTypeId || search) && (
          <button onClick={() => { setRegionId(""); setOrgTypeId(""); setSearch(""); resetPage(); }}
            className="btn-ghost py-1.5 text-xs text-fc-steel-500 hover:text-danger">
            <X className="w-3 h-3" /> Сбросить
          </button>
        )}
      </div>

      {loading && <Loader />}
      {error && <ErrorBox message={error} />}

      {data && (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <StatCard accent="navy"  label="Организаций в фильтре" value={data.total ?? data.summary.orgs_total} hint="По выбранным условиям" />
            <StatCard accent="blue"  label="Ячеек заполнено" value={`${data.summary.cells_filled}/${data.summary.cells_total}`} hint="Из 5 модулей" />
            <StatCard accent="cyan"  label="Утверждено"     value={data.summary.cells_approved} hint="Записей approved" />
            <StatCard accent={data.summary.coverage_pct === 100 ? "cyan" : "steel"}
              label="Покрытие" value={`${data.summary.coverage_pct}%`} hint="Ячеек с данными" />
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-4">
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <div key={k} className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-semibold ${STATUS_COLORS[k]}`}>
                {v}
              </div>
            ))}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-dashed border-slate-200 text-xs text-slate-400 font-semibold">
              НЕТ — данные не поданы
            </div>
          </div>

          {/* Matrix */}
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 text-left font-semibold text-fc-navy-800 min-w-[220px]">
                    Организация
                  </th>
                  {modules.map(m => (
                    <th key={m} className="px-3 py-3 text-center font-semibold text-fc-navy-800 min-w-[110px]">
                      {MODULE_LABELS[m]}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center font-semibold text-fc-navy-800 min-w-[80px]">
                    Итого
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.organizations.map(org => (
                  <tr key={org.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5 max-w-[220px]">
                      <p className="font-medium text-fc-navy-900 leading-snug truncate" title={org.name_ru}>{org.name_ru}</p>
                    </td>
                    {modules.map(m => (
                      <td key={m} className="px-3 py-2">
                        <CoverageCell status={(org.modules as any)[m]} />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                        org.approved === org.total
                          ? "bg-success/15 text-success"
                          : org.approved > 0
                          ? "bg-warning/15 text-warning"
                          : "bg-slate-100 text-slate-500"
                      }`}>
                        {org.approved}/{org.total}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Пагинация */}
            {data.total > limit && (
              <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-fc-steel-600">
                <span>
                  {page * limit + 1}–{Math.min((page + 1) * limit, data.total)} из {data.total}
                </span>
                <div className="flex gap-1">
                  <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}
                    className="btn-ghost btn-sm">← Назад</button>
                  <button disabled={(page + 1) * limit >= data.total} onClick={() => setPage(p => p + 1)}
                    className="btn-ghost btn-sm">Вперёд →</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  USERS / ORGANIZATIONS / APPROVALS / AUDIT / INTEGRATIONS / API KEYS
//  (структура та же что в прошлой версии, обновлены классы под брендбук)
// ════════════════════════════════════════════════════════════════════════════

export function UsersPage() {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Пользователи"
        subtitle="Управление учётными записями системы"
        actions={
          <button onClick={() => setCreateOpen(true)} className="btn-primary">
            <Plus className="w-3.5 h-3.5" /> Добавить
          </button>
        }
      />

      <div className="card p-6">
        <div className="flex items-start gap-3 p-4 bg-fc-blue-50 border border-fc-blue-100 rounded-lg">
          <ShieldCheck className="w-5 h-5 text-fc-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-fc-navy-900">Создание новых пользователей</p>
            <p className="text-xs text-fc-steel-700 mt-1">
              Используйте кнопку «Добавить» для создания учётных записей.
              Пользователи получат приглашение на смену пароля при первом входе.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <p className="label-eyebrow mb-3">Ваш аккаунт</p>
          <table className="data-table">
            <thead>
              <tr><th>ФИО</th><th>Email</th><th>Роль</th></tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-medium">{user?.full_name}</td>
                <td className="text-fc-steel-600">{user?.email}</td>
                <td><RoleBadge role={user?.role ?? ""} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    email: "", password: "", full_name: "", role: "data_entry", org_id: "", phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: any = {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        full_name: form.full_name.trim(),
        role: form.role,
        phone: form.phone || undefined,
        org_id: form.org_id || undefined,
      };
      await mutate("POST", "/auth/register", payload);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onClose(); }, 1500);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Ошибка создания");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} title="Новый пользователь" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Email">
          <input type="email" required value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            className="input" placeholder="user@university.kz" />
        </Field>
        <Field label="ФИО">
          <input required value={form.full_name}
            onChange={e => setForm({ ...form, full_name: e.target.value })}
            className="input" placeholder="Иванов Иван Иванович" />
        </Field>
        <Field label="Пароль">
          <input type="password" required minLength={8} value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            className="input" placeholder="Не менее 8 символов" />
        </Field>
        <Field label="Роль">
          <select value={form.role}
            onChange={e => setForm({ ...form, role: e.target.value })}
            className="input">
            <option value="data_entry">Ввод данных</option>
            <option value="management">Руководство</option>
            <option value="admin">Администратор</option>
            <option value="superadmin">Суперадмин</option>
          </select>
        </Field>
        {form.role === "data_entry" && (
          <Field label="UUID организации">
            <input required value={form.org_id}
              onChange={e => setForm({ ...form, org_id: e.target.value })}
              className="input font-mono text-xs" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          </Field>
        )}
        <Field label="Телефон (опц.)">
          <input value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            className="input" placeholder="+7 777 123 45 67" />
        </Field>
        {error && <ErrorBox message={error} />}
        {success && <SuccessBox message="Пользователь создан" />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Отмена</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Создать
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface Organisation {
  id: string;
  name_ru: string;
  bin_iin?: string;
  region_id?: number | null;
  org_type_id?: number | null;
  ownership_form_id?: number | null;
  status?: string;
}

export function OrganisationsPage() {
  const [q,          setQ]          = useState("");
  const [regionId,   setRegionId]   = useState<number | "">("");
  const [orgTypeId,  setOrgTypeId]  = useState<number | "">("");
  const [statusF,    setStatusF]    = useState<string>("");
  const [page,       setPage]       = useState(0);
  const limit = 50;

  const regions = useRegions();

  const resetPage = () => setPage(0);

  const apiUrl = React.useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit",  String(limit));
    params.set("offset", String(page * limit));
    if (q)         params.set("search", q);
    if (regionId)  params.set("region_id", String(regionId));
    if (orgTypeId) params.set("org_type_id", String(orgTypeId));
    if (statusF)   params.set("status", statusF);
    return `/admin/organisations?${params.toString()}`;
  }, [q, regionId, orgTypeId, statusF, page]);

  const { data, loading, error, refetch } = useApi<{ items: Organisation[]; total: number }>(
    apiUrl, [apiUrl],
  );

  const activeFilters = [
    q && `«${q}»`,
    regionId && regions.find(r => r.id === regionId)?.name_ru,
    orgTypeId && ORG_TYPE_RU[orgTypeId as number],
    statusF && STATUS_RU[statusF],
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        title="Организации"
        subtitle={`Реестр образовательных организаций${data ? ` · ${data.total}` : ""}`}
      />

      <div className="card overflow-hidden">
        {/* ─── Панель фильтров ─── */}
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-fc-steel-400" />
            <input value={q}
              onChange={e => { setQ(e.target.value); resetPage(); }}
              placeholder="Поиск по названию или БИН…"
              className="input pl-9 py-1.5 text-sm" />
          </div>

          <select value={regionId} onChange={e => { setRegionId(e.target.value ? Number(e.target.value) : ""); resetPage(); }}
            className="input py-1.5 text-sm min-w-[160px]">
            <option value="">Все регионы</option>
            {regions.map(r => <option key={r.id} value={r.id}>{r.name_ru}</option>)}
          </select>

          <select value={orgTypeId} onChange={e => { setOrgTypeId(e.target.value ? Number(e.target.value) : ""); resetPage(); }}
            className="input py-1.5 text-sm min-w-[160px]">
            <option value="">Все типы</option>
            {Object.entries(ORG_TYPE_RU).map(([id, label]) =>
              <option key={id} value={id}>{label}</option>
            )}
          </select>

          <select value={statusF} onChange={e => { setStatusF(e.target.value); resetPage(); }}
            className="input py-1.5 text-sm min-w-[140px]">
            <option value="">Все статусы</option>
            {Object.entries(STATUS_RU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>

          {activeFilters.length > 0 && (
            <button onClick={() => { setQ(""); setRegionId(""); setOrgTypeId(""); setStatusF(""); resetPage(); }}
              className="btn-ghost py-1.5 text-xs text-fc-steel-500 hover:text-danger">
              <X className="w-3 h-3" /> Сбросить
            </button>
          )}
        </div>

        {activeFilters.length > 0 && (
          <div className="px-4 py-2 bg-fc-blue-50 border-b border-fc-blue-100 flex gap-2 flex-wrap">
            {activeFilters.map((f, i) => (
              <span key={i} className="pill bg-fc-blue-100 text-fc-blue-700 text-xs">{f}</span>
            ))}
          </div>
        )}

        {loading && <Loader />}
        {error && <div className="p-4"><ErrorBox message={error} onRetry={refetch} /></div>}
        {data && data.items.length === 0 && <EmptyState title="Организации не найдены" hint="Попробуйте изменить фильтры" icon={Building2} />}

        {data && data.items.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Уровень образования</th>
                    <th>Регион</th>
                    <th>БИН</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(org => (
                    <tr key={org.id}>
                      <td className="font-medium max-w-[220px] truncate" title={org.name_ru}>{org.name_ru}</td>
                      <td className="text-fc-steel-500 text-xs">
                        {org.org_type_id ? (ORG_TYPE_RU[org.org_type_id] ?? "—") : "—"}
                      </td>
                      <td className="text-fc-steel-500 text-xs">
                        {org.region_id ? (regions.find(r => r.id === org.region_id)?.name_ru ?? "—") : "—"}
                      </td>
                      <td className="text-fc-steel-600 font-mono text-xs">{org.bin_iin ?? "—"}</td>
                      <td>
                        <span className={`pill ${
                          org.status === "active" ? "bg-success/10 text-success" : "bg-slate-100 text-slate-600"
                        }`}>
                          {STATUS_RU[org.status ?? "active"] ?? org.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-fc-steel-600">
              <span>{page * limit + 1}–{Math.min((page + 1) * limit, data.total)} из {data.total}</span>
              <div className="flex gap-1">
                <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}
                  className="btn-ghost btn-sm">← Назад</button>
                <button disabled={(page + 1) * limit >= data.total} onClick={() => setPage(p => p + 1)}
                  className="btn-ghost btn-sm">Вперёд →</button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

const DOMAIN_OPTIONS = [
  { value: "",                       label: "Все модули" },
  { value: "science_activity",       label: "Научная деятельность" },
  { value: "contingent_snapshots",   label: "Контингент" },
  { value: "finance_records",        label: "Финансы" },
  { value: "graduates_records",      label: "Выпускники" },
  { value: "educational_process",    label: "Образ. процесс" },
];

export function ApprovalsPage() {
  const [statusF, setStatusF] = useState("submitted");
  const [domain,  setDomain]  = useState("");
  const [year,    setYear]    = useState<number | "">("");
  const [regionId, setRegionId] = useState<number | "">("");
  const [page,    setPage]    = useState(0);
  const limit = 50;

  const regions = useRegions();

  const apiUrl = React.useMemo(() => {
    const p = new URLSearchParams();
    p.set("status_filter", statusF);
    p.set("limit", String(limit));
    p.set("offset", String(page * limit));
    if (domain)   p.set("domain",    domain);
    if (year)     p.set("year",      String(year));
    if (regionId) p.set("region_id", String(regionId));
    return `/admin/pending-submissions?${p.toString()}`;
  }, [statusF, domain, year, regionId, page]);

  const { data: resp, loading, error, refetch } = useApi<{ items: any[]; total: number }>(apiUrl, [apiUrl]);
  const data = resp?.items ?? [];

  const resetPage = () => setPage(0);

  return (
    <>
      <PageHeader
        title="Согласование заявок"
        subtitle={`Очередь на проверку${resp ? ` · всего ${resp.total}` : ""}`}
        actions={
          <button onClick={refetch} className="btn-ghost">
            <RefreshCw className="w-3.5 h-3.5" /> Обновить
          </button>
        }
      />

      {/* Фильтры */}
      <div className="card mb-4 px-4 py-3 flex flex-wrap gap-2 items-center">
        <select value={statusF} onChange={e => { setStatusF(e.target.value); resetPage(); }}
          className="input py-1.5 text-sm min-w-[160px]">
          <option value="submitted">Отправлено</option>
          <option value="under_review">На рассмотрении</option>
        </select>

        <select value={domain} onChange={e => { setDomain(e.target.value); resetPage(); }}
          className="input py-1.5 text-sm min-w-[180px]">
          {DOMAIN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select value={year} onChange={e => { setYear(e.target.value ? Number(e.target.value) : ""); resetPage(); }}
          className="input py-1.5 text-sm w-24">
          <option value="">Все годы</option>
          {[2025,2024,2023,2022,2021,2020].map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select value={regionId} onChange={e => { setRegionId(e.target.value ? Number(e.target.value) : ""); resetPage(); }}
          className="input py-1.5 text-sm min-w-[160px]">
          <option value="">Все регионы</option>
          {regions.map(r => <option key={r.id} value={r.id}>{r.name_ru}</option>)}
        </select>

        {(domain || year || regionId) && (
          <button onClick={() => { setDomain(""); setYear(""); setRegionId(""); resetPage(); }}
            className="btn-ghost py-1.5 text-xs text-fc-steel-500 hover:text-danger">
            <X className="w-3 h-3" /> Сбросить
          </button>
        )}
      </div>

      {loading && <Loader />}
      {error && <ErrorBox message={error} onRetry={refetch} />}
      {!loading && data.length === 0 && (
        <EmptyState title="Нет заявок по выбранным фильтрам" hint="Попробуйте изменить фильтры или статус" icon={Check} />
      )}
      {data.length > 0 && (
        <div className="space-y-2">
          {data.map((item: any, i: number) => (
            <ApprovalRow key={item.id ?? i} item={item} onChange={refetch} />
          ))}
        </div>
      )}

      {resp && resp.total > limit && (
        <div className="mt-4 flex items-center justify-between text-xs text-fc-steel-600">
          <span>{page * limit + 1}–{Math.min((page + 1) * limit, resp.total)} из {resp.total}</span>
          <div className="flex gap-1">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="btn-ghost btn-sm">← Назад</button>
            <button disabled={(page + 1) * limit >= resp.total} onClick={() => setPage(p => p + 1)} className="btn-ghost btn-sm">Вперёд →</button>
          </div>
        </div>
      )}
    </>
  );
}

function ApprovalRow({ item, onChange }: { item: any; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);

  const changeStatus = async (status: string) => {
    setBusy(true);
    try {
      const domain = item.domain ?? item.table_name ?? "science-activity";
      await mutate("PATCH", `/organisations/${item.org_id}/${domain}/${item.id}/status`,
        { new_status: status, comment: comment || undefined });
      onChange();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-display font-bold text-fc-navy-900">{item.domain ?? item.table_name ?? "Раздел"}</p>
            <StatusBadge status={item.submission_status ?? "submitted"} />
          </div>
          <p className="text-xs text-fc-steel-500">
            {item.org_name ?? item.org_id} · период {item.period_year ?? "—"} ·
            отправлено {item.submitted_at ? new Date(item.submitted_at).toLocaleString("ru-RU") : "—"}
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button onClick={() => setOpen(!open)} className="btn-ghost btn-sm">Комментарий</button>
          <button onClick={() => changeStatus("approved")} disabled={busy}
            className="btn-success btn-sm">
            <Check className="w-3 h-3" /> Одобрить
          </button>
          <button onClick={() => changeStatus("rejected")} disabled={busy || !comment}
            title={!comment ? "Добавьте комментарий" : ""} className="btn-danger btn-sm">
            <X className="w-3 h-3" /> Отклонить
          </button>
        </div>
      </div>
      {open && (
        <textarea value={comment} onChange={e => setComment(e.target.value)}
          placeholder="Комментарий для отправителя (обязателен при отклонении)…"
          className="input mt-3" rows={2} />
      )}
    </div>
  );
}

export function AuditLogPage() {
  const [page, setPage] = useState(0);
  const [tableFilter, setTableFilter] = useState("");
  const limit = 50;
  const url = `/admin/audit-log?limit=${limit}&offset=${page * limit}${tableFilter ? `&table_name=${tableFilter}` : ""}`;
  const { data, loading, error, refetch } = useApi<{ items: any[]; total: number }>(url, [page, tableFilter]);

  return (
    <>
      <PageHeader title="Журнал аудита" subtitle={`Все изменения в системе${data ? ` · всего ${data.total}` : ""}`} />
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex gap-3">
          <select value={tableFilter} onChange={e => { setTableFilter(e.target.value); setPage(0); }} className="input max-w-xs">
            <option value="">Все таблицы</option>
            <option value="users">Пользователи</option>
            <option value="organizations">Организации</option>
            <option value="refresh_tokens">Сессии</option>
            <option value="science_activity">Научная деятельность</option>
            <option value="contingent_snapshots">Контингент</option>
            <option value="finance_records">Финансы</option>
            <option value="graduates_records">Выпускники</option>
            <option value="educational_process">Образ. процесс</option>
          </select>
        </div>
        {loading && <Loader />}
        {error && <div className="p-4"><ErrorBox message={error} onRetry={refetch} /></div>}
        {data && data.items.length > 0 && (
          <table className="data-table">
            <thead>
              <tr><th>Время</th><th>Таблица</th><th>Действие</th><th>Пользователь</th><th>Запись</th></tr>
            </thead>
            <tbody>
              {data.items.map((row: any) => (
                <tr key={row.id}>
                  <td className="text-xs text-fc-steel-600 whitespace-nowrap">
                    {new Date(row.changed_at).toLocaleString("ru-RU")}
                  </td>
                  <td className="font-mono text-xs">{row.table_name}</td>
                  <td>
                    <span className={`pill ${
                      row.action === "INSERT" ? "bg-success/10 text-success" :
                      row.action === "UPDATE" ? "bg-fc-blue-50 text-fc-blue-700" :
                      "bg-danger/10 text-danger"
                    }`}>{row.action}</span>
                  </td>
                  <td className="text-fc-steel-600 font-mono text-xs truncate max-w-[180px]">{row.changed_by ?? "system"}</td>
                  <td className="text-fc-steel-500 font-mono text-xs truncate max-w-[200px]">{row.record_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-fc-steel-600">
            <span>{page * limit + 1}–{Math.min((page + 1) * limit, data.total)} из {data.total}</span>
            <div className="flex gap-1">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="btn-ghost btn-sm">← Назад</button>
              <button disabled={(page + 1) * limit >= data.total} onClick={() => setPage(p => p + 1)} className="btn-ghost btn-sm">Вперёд →</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function IntegrationsPage() {
  const { data: logs, loading, error, refetch } = useApi<any[]>("/integrations/sync-logs?limit=20");
  const [busy, setBusy] = useState<string | null>(null);

  const triggerSync = async (source: string) => {
    setBusy(source);
    try {
      await mutate("POST", "/integrations/sync/trigger", { source });
      setTimeout(refetch, 1500);
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Ошибка");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Интеграции" subtitle="Синхронизация с внешними системами" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {[
          { code: "nobd", name: "НОБД", desc: "Национальная образовательная база данных" },
          { code: "epvo", name: "ЕПВО", desc: "Единый портал высшего образования" },
        ].map(sys => (
          <div key={sys.code} className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="font-display font-bold text-fc-navy-900">{sys.name}</p>
              <span className="pill bg-success/10 text-success inline-flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-success rounded-full" />
                Активно
              </span>
            </div>
            <p className="text-xs text-fc-steel-500 mb-3">{sys.desc}</p>
            <button onClick={() => triggerSync(sys.code)} disabled={busy !== null}
              className="btn-primary w-full">
              {busy === sys.code ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Запустить синхронизацию
            </button>
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="font-display font-bold text-fc-navy-900">История синхронизаций</p>
        </div>
        {loading && <Loader />}
        {error && <div className="p-4"><ErrorBox message={error} onRetry={refetch} /></div>}
        {logs && logs.length === 0 && <EmptyState title="История пуста" icon={Clock} />}
        {logs && logs.length > 0 && (
          <table className="data-table">
            <thead>
              <tr><th>Время</th><th>Источник</th><th>Статус</th><th className="text-right">Записей</th></tr>
            </thead>
            <tbody>
              {logs.map((l: any) => (
                <tr key={l.id}>
                  <td className="text-xs text-fc-steel-600">{l.started_at ? new Date(l.started_at).toLocaleString("ru-RU") : "—"}</td>
                  <td className="font-medium uppercase">{l.source ?? "—"}</td>
                  <td>
                    <span className={`pill ${
                      l.status === "success" ? "bg-success/10 text-success" :
                      l.status === "failed"  ? "bg-danger/10 text-danger" :
                      "bg-warning/10 text-warning"
                    }`}>{l.status ?? "—"}</span>
                  </td>
                  <td className="text-right font-mono text-xs">{l.rows_synced ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export function ApiKeysPage() {
  const { data, loading, error, refetch } = useApi<any[]>("/admin/api-keys");
  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const revoke = async (id: string) => {
    if (!confirm("Отозвать этот токен? Действие необратимо.")) return;
    await mutate("DELETE", `/admin/api-keys/${id}`);
    refetch();
  };

  return (
    <>
      <PageHeader
        title="API ключи" subtitle="Машинные токены доступа к API"
        actions={
          <button onClick={() => setCreateOpen(true)} className="btn-primary">
            <Plus className="w-3.5 h-3.5" /> Создать
          </button>
        }
      />
      {newKey && (
        <div className="mb-4 p-4 bg-warning/5 border border-warning/20 rounded-lg">
          <p className="font-bold text-warning text-sm">Сохраните этот токен — он больше не отобразится:</p>
          <code className="block mt-2 p-2 bg-white rounded border border-warning/20 font-mono text-xs break-all">{newKey}</code>
          <button onClick={() => setNewKey(null)} className="mt-2 text-xs font-semibold text-warning hover:underline">
            Я сохранил
          </button>
        </div>
      )}
      <div className="card overflow-hidden">
        {loading && <Loader />}
        {error && <div className="p-4"><ErrorBox message={error} onRetry={refetch} /></div>}
        {data && data.length === 0 && <EmptyState title="Токенов нет" icon={Key} />}
        {data && data.length > 0 && (
          <table className="data-table">
            <thead>
              <tr><th>Название</th><th>Scopes</th><th>Создан</th><th>Использовался</th><th className="text-right">Действия</th></tr>
            </thead>
            <tbody>
              {data.map((k: any) => (
                <tr key={k.id}>
                  <td className="font-medium">{k.name ?? "—"}</td>
                  <td className="text-xs text-fc-steel-600 font-mono">{(k.scopes ?? []).join(", ") || "—"}</td>
                  <td className="text-xs text-fc-steel-600">{k.created_at ? new Date(k.created_at).toLocaleDateString("ru-RU") : "—"}</td>
                  <td className="text-xs text-fc-steel-600">{k.last_used_at ? new Date(k.last_used_at).toLocaleString("ru-RU") : "Не использовался"}</td>
                  <td className="text-right">
                    <button onClick={() => revoke(k.id)} className="text-xs font-semibold text-danger hover:underline">Отозвать</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <CreateApiKeyModal open={createOpen} onClose={() => setCreateOpen(false)}
        onCreated={(token) => { setNewKey(token); refetch(); }} />
    </>
  );
}

function CreateApiKeyModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: (token: string) => void;
}) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const resp: any = await mutate("POST", "/admin/api-keys", { name, scopes });
      onCreated(resp.token ?? resp.api_token ?? "");
      setName(""); setScopes(["read"]);
      onClose();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const toggleScope = (s: string) => {
    setScopes(scopes.includes(s) ? scopes.filter(x => x !== s) : [...scopes, s]);
  };

  return (
    <Modal open={open} title="Новый API токен" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Название">
          <input required value={name} onChange={e => setName(e.target.value)}
            className="input" placeholder="Например: nightly-sync-bot" />
        </Field>
        <Field label="Scopes">
          <div className="flex gap-2">
            {["read", "write", "admin"].map(s => (
              <label key={s} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 border rounded-md cursor-pointer text-sm font-semibold ${
                scopes.includes(s)
                  ? "border-fc-blue-400 bg-fc-blue-50 text-fc-blue-700"
                  : "border-slate-200 text-fc-steel-600 hover:bg-slate-50"
              }`}>
                <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggleScope(s)} className="hidden" />
                {s}
              </label>
            ))}
          </div>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Отмена</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "..." : "Создать"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  DATA ENTRY PAGES
// ════════════════════════════════════════════════════════════════════════════

import ContingentForm from "@/features/contingent/ContingentForm";
import FinanceForm    from "@/features/finance/FinanceForm";
import ScienceForm    from "@/features/science/ScienceForm";
import GraduatesForm  from "@/features/graduates/GraduatesForm";
import EducationForm  from "@/features/education/EducationForm";

// OrgPicker — shown to admins/superadmins who have no fixed org_id
function OrgPicker({ onSelect }: { onSelect: (id: string, name: string) => void }) {
  const { data, loading } = useApi<{ items: Organisation[]; total: number }>(
    "/admin/organisations?limit=50",
  );
  return (
    <div className="card p-6 max-w-md mx-auto">
      <p className="label-eyebrow text-fc-navy-700 mb-3">Выберите организацию</p>
      {loading && <Loader />}
      {data && (
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {data.items.map(org => (
            <button key={org.id} type="button"
              onClick={() => onSelect(org.id, org.name_ru)}
              className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-fc-navy-50 transition-colors">
              {org.name_ru}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Generic wrapper used by all 5 domain pages
function DataEntryWrapper({
  title, subtitle, FormComponent,
}: {
  title: string;
  subtitle: string;
  FormComponent: React.ComponentType<{ orgId?: string }>;
}) {
  const { user } = useAuth();
  const fixedOrgId = user?.org_id;
  const [pickedOrgId, setPickedOrgId] = useState<string | null>(null);
  const [pickedOrgName, setPickedOrgName] = useState<string | null>(null);

  const orgId = fixedOrgId ?? pickedOrgId;

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={
        !fixedOrgId && pickedOrgName ? (
          <div className="flex items-center gap-2">
            <span className="label-eyebrow text-fc-steel-500">{pickedOrgName}</span>
            <button className="btn-ghost text-xs" onClick={() => { setPickedOrgId(null); setPickedOrgName(null); }}>
              Сменить
            </button>
          </div>
        ) : undefined
      } />
      {!orgId
        ? <OrgPicker onSelect={(id, name) => { setPickedOrgId(id); setPickedOrgName(name); }} />
        : <FormComponent orgId={orgId} />
      }
    </>
  );
}

export function ContingentPage() {
  return (
    <DataEntryWrapper
      title="Контингент студентов"
      subtitle="Численность по формам, курсам, специальностям, источникам финансирования"
      FormComponent={ContingentForm}
    />
  );
}

export function FinancePage() {
  return (
    <DataEntryWrapper
      title="Финансы и бюджет"
      subtitle="Доходы, расходы, ФОТ, капзатраты"
      FormComponent={FinanceForm}
    />
  );
}

export function SciencePage() {
  return (
    <DataEntryWrapper
      title="Научная деятельность"
      subtitle="Гранты, публикации, патенты, НИОКР"
      FormComponent={ScienceForm}
    />
  );
}

export function GraduatesPage() {
  return (
    <DataEntryWrapper
      title="Выпускники"
      subtitle="Трудоустройство, зарплаты, секторы"
      FormComponent={GraduatesForm}
    />
  );
}

export function EducationPage() {
  return (
    <DataEntryWrapper
      title="Образовательный процесс"
      subtitle="Преподаватели, специальности, академические результаты"
      FormComponent={EducationForm}
    />
  );
}

export function HistoryPage() {
  const { user } = useAuth();
  const orgId = user?.org_id;
  if (!orgId) {
    return (<>
      <PageHeader title="История заявок" subtitle="Все ваши отправленные заявки" />
      <EmptyState title="Нет данных" hint="История доступна только пользователям организаций" icon={History} />
    </>);
  }

  const domains = ["contingent", "finance", "science-activity", "graduates", "education"];
  const [active, setActive] = useState(domains[0]);
  const { data, loading, error, refetch } = useApi<{ items: any[]; total: number }>(
    `/organisations/${orgId}/${active}?limit=50`, [active],
  );

  return (
    <>
      <PageHeader title="История заявок" subtitle="Все ваши отправленные заявки" />
      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-md overflow-x-auto scrollbar-thin">
        {domains.map(d => (
          <button key={d} onClick={() => setActive(d)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
              active === d ? "bg-white shadow-fc-sm text-fc-navy-900" : "text-fc-steel-600 hover:text-fc-navy-900"
            }`}>
            {d === "contingent" ? "Контингент" :
             d === "finance" ? "Финансы" :
             d === "science-activity" ? "Наука" :
             d === "graduates" ? "Выпускники" : "Образ. процесс"}
          </button>
        ))}
      </div>
      <div className="card overflow-hidden">
        {loading && <Loader />}
        {error && <div className="p-4"><ErrorBox message={error} onRetry={refetch} /></div>}
        {data && data.items.length === 0 && <EmptyState title="Записей нет" icon={History} />}
        {data && data.items.length > 0 && (
          <table className="data-table">
            <thead>
              <tr><th>#</th><th>Период</th><th>Статус</th><th>Отправлено</th><th>Обновлено</th></tr>
            </thead>
            <tbody>
              {data.items.map((item: any) => (
                <tr key={item.id}>
                  <td className="font-mono text-xs">{item.id}</td>
                  <td>{item.period_year ?? item.snapshot_date ?? "—"}</td>
                  <td><StatusBadge status={item.submission_status ?? "draft"} /></td>
                  <td className="text-xs text-fc-steel-500">{item.submitted_at ? new Date(item.submitted_at).toLocaleString("ru-RU") : "—"}</td>
                  <td className="text-xs text-fc-steel-500">{item.updated_at ? new Date(item.updated_at).toLocaleString("ru-RU") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  SUPERSET — переиспользуемая секция и полная страница
// ════════════════════════════════════════════════════════════════════════════

function SupersetSection() {
  const [activeDash, setActiveDash] = useState<SupersetDash | null>(null);
  const { data: dashResp, loading } = useApi<{ result: SupersetDash[] }>("/admin/superset/dashboards");
  const dashboards = dashResp?.result ?? [];

  if (activeDash) {
    return (
      <div className="card overflow-hidden" style={{ height: "calc(100vh - 180px)" }}>
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
          <button className="btn-ghost py-1" onClick={() => setActiveDash(null)}>
            ← Назад
          </button>
          <p className="label-eyebrow">{activeDash.title}</p>
        </div>
        <EmbeddedDashboard dash={activeDash} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="label-eyebrow">Дашборды Superset</p>
        <a href="/bi/superset/welcome" target="_blank" rel="noopener noreferrer"
           className="text-xs font-semibold text-fc-blue-600 hover:underline">
          Полный интерфейс →
        </a>
      </div>
      {loading && <Loader />}
      {!loading && dashboards.length === 0 && (
        <div className="card p-8 text-center text-sm text-fc-steel-400">
          Дашборды Superset не настроены
        </div>
      )}
      {dashboards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map(d => (
            <div key={d.id} className="card card-hover p-5 cursor-pointer"
                 onClick={() => setActiveDash(d)}>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-fc-cyan-50 shrink-0">
                  <BarChart3 className="w-5 h-5 text-fc-cyan-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-display font-bold text-fc-navy-900 text-sm leading-snug">
                    {d.title}
                  </p>
                  {d.description && (
                    <p className="text-xs text-fc-steel-500 mt-1">{d.description}</p>
                  )}
                </div>
              </div>
              <button className="btn-primary mt-4 w-full text-sm">Открыть дашборд</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface SupersetDash {
  id: number;
  title: string;
  description: string;
  embedded_uuid: string;
}

function EmbeddedDashboard({ dash }: { dash: SupersetDash }) {
  return (
    <SupersetDashboard
      dashboardId={dash.id}
      embeddedUuid={dash.embedded_uuid}
    />
  );
}

export { default as CoefficientsPage } from "@/features/coefficients/CoefficientsPage";
export { default as AnomaliesPage }    from "@/features/anomalies/AnomaliesPage";

// ════════════════════════════════════════════════════════════════════════════
//  ANALYTICS GLOBAL STATS — tabbed Superset BI dashboards
// ════════════════════════════════════════════════════════════════════════════

const BI_DASHBOARDS = [
  { id: 2, uuid: "a1b2c3d4-0001-4aaa-b001-100000000001", label: "Контингент",  icon: GraduationCap, accent: "text-fc-navy-700  bg-fc-navy-50"  },
  { id: 3, uuid: "a1b2c3d4-0002-4aaa-b002-100000000002", label: "Финансы",     icon: Wallet,        accent: "text-fc-blue-600 bg-fc-blue-50"  },
  { id: 4, uuid: "a1b2c3d4-0003-4aaa-b003-100000000003", label: "Наука",       icon: FlaskConical,  accent: "text-fc-cyan-600 bg-fc-cyan-50"  },
  { id: 5, uuid: "a1b2c3d4-0004-4aaa-b004-100000000004", label: "Выпускники",  icon: UsersRound,    accent: "text-fc-steel-600 bg-fc-steel-50" },
  { id: 6, uuid: "a1b2c3d4-0005-4aaa-b005-100000000005", label: "Образование", icon: BookOpen,      accent: "text-fc-purple-600 bg-fc-purple-50" },
] as const;

export function AnalyticsGlobalStatsPage() {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = BI_DASHBOARDS[activeIdx];

  return (
    <>
      <PageHeader
        title="Аналитика BI"
        subtitle="Интерактивные дашборды системы мониторинга образования"
        actions={
          <a href="/bi/superset/welcome" target="_blank" rel="noopener noreferrer"
             className="btn-ghost text-xs flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> Полный Superset
          </a>
        }
      />

      {/* Domain tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-lg overflow-x-auto shrink-0">
        {BI_DASHBOARDS.map((d, i) => {
          const Icon = d.icon;
          const isActive = i === activeIdx;
          return (
            <button
              key={d.id}
              onClick={() => setActiveIdx(i)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold
                          whitespace-nowrap transition-colors ${
                isActive ? "text-white" : "text-fc-steel-600 hover:bg-white/70 hover:text-fc-navy-700"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="bi-tab-active"
                  className="absolute inset-0 bg-fc-navy-700 rounded-md shadow-fc-sm"
                  style={{ zIndex: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <Icon className="relative z-10 w-3.5 h-3.5" />
              <span className="relative z-10">{d.label}</span>
            </button>
          );
        })}
      </div>

      {/* Embedded dashboard */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active.id}
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          className="card overflow-hidden"
          style={{ height: "calc(100vh - 230px)" }}
        >
          <SupersetDashboard
            dashboardId={active.id}
            embeddedUuid={active.uuid}
          />
        </motion.div>
      </AnimatePresence>
    </>
  );
}

export function SupersetDashboardsPage() {
  const [activeDash, setActiveDash] = useState<SupersetDash | null>(null);
  const { data: dashResp, loading } = useApi<{ result: SupersetDash[] }>("/admin/superset/dashboards");
  const dashboards = dashResp?.result ?? [];

  return (
    <>
      <PageHeader
        title="Дашборды"
        subtitle="Интерактивная аналитика на основе Apache Superset"
        actions={
          activeDash !== null ? (
            <button className="btn-ghost" onClick={() => setActiveDash(null)}>
              ← Назад к списку
            </button>
          ) : undefined
        }
      />

      <AnimatePresence mode="wait">
        {activeDash === null ? (
          <motion.div
            key="list"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <motion.div key={i} variants={staggerItem}
                    className="card p-5 space-y-3 animate-pulse">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-fc-cyan-50 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-40 bg-fc-navy-100 rounded" />
                        <div className="h-2.5 w-full bg-slate-100 rounded" />
                        <div className="h-2.5 w-3/4 bg-slate-100 rounded" />
                      </div>
                    </div>
                    <div className="h-8 bg-fc-navy-50 rounded-md" />
                  </motion.div>
                ))
              : dashboards.map(d => (
                  <motion.div
                    key={d.id}
                    variants={staggerItem}
                    className="card card-hover p-5 cursor-pointer"
                    onClick={() => setActiveDash(d)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-fc-cyan-50 shrink-0">
                        <BarChart3 className="w-5 h-5 text-fc-cyan-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-display font-bold text-fc-navy-900 text-sm leading-snug">
                          {d.title}
                        </p>
                        <p className="text-xs text-fc-steel-500 mt-1">{d.description}</p>
                      </div>
                    </div>
                    <button className="btn-primary mt-4 w-full text-sm">
                      Открыть дашборд
                    </button>
                  </motion.div>
                ))
            }
            <motion.div
              variants={staggerItem}
              className="card p-5 border-dashed border-2 border-fc-steel-200 flex flex-col
                         items-center justify-center gap-2 text-center min-h-[140px]"
            >
              <BarChart3 className="w-8 h-8 text-fc-steel-300" />
              <p className="text-sm font-semibold text-fc-steel-400">
                Superset — полный интерфейс
              </p>
              <a href="/bi/superset/welcome"
                 target="_blank" rel="noopener noreferrer"
                 className="btn-secondary text-xs mt-1">
                Открыть Superset →
              </a>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="embed"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="card overflow-hidden"
            style={{ height: "calc(100vh - 180px)" }}
          >
            <EmbeddedDashboard dash={activeDash} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

interface InsightResult {
  summary: string;
  anomalies: Array<{ field: string; value: string; issue: string; severity: "low" | "medium" | "high" }>;
  recommendations: string[];
  context_rows: number;
  data?: Record<string, any[]>;
}

interface InsightHistoryItem {
  id: number;
  query: string;
  region_id: number | null;
  org_type_id: number | null;
  year: number | null;
  include_tables: string[];
  summary: string;
  anomalies: InsightResult["anomalies"];
  recommendations: string[];
  model_used: string;
  context_rows: number;
  created_at: string;
  region_name: string | null;
  org_type_name: string | null;
}

const INSIGHT_CHART_CONFIGS: Record<string, { label: string; valueKey: string; valueLabel: string; color: string }> = {
  finance:             { label: "Финансы",      valueKey: "annual_budget",      valueLabel: "Годовой бюджет, ₸", color: "#0068b4" },
  contingent:          { label: "Контингент",   valueKey: "total",              valueLabel: "Обучающихся",       color: "#19286d" },
  science:             { label: "Наука",         valueKey: "publications_total", valueLabel: "Публикаций",        color: "#00a6ca" },
  graduates:           { label: "Выпускники",   valueKey: "employed_12m_pct",   valueLabel: "Трудоуст. 12 мес, %", color: "#296695" },
  educational_process: { label: "Образование",  valueKey: "teachers_total",     valueLabel: "Преподавателей",    color: "#801e82" },
  coefficient_scores:  { label: "Рейтинг",      valueKey: "total_score",        valueLabel: "Общий балл",        color: "#19286d" },
};

function InsightCharts({ data }: { data: Record<string, any[]> }) {
  const tabs = Object.keys(INSIGHT_CHART_CONFIGS).filter(
    k => Array.isArray(data[k]) && data[k].length > 0
  );
  const [activeTab, setActiveTab] = useState(tabs[0] ?? "");

  if (tabs.length === 0) return null;

  const cfg = INSIGHT_CHART_CONFIGS[activeTab];
  const rows = data[activeTab] ?? [];

  // One bar per org — take the first (latest-year) record per org_name
  const seen = new Set<string>();
  const chartData = rows
    .filter(r => { if (seen.has(r.org_name)) return false; seen.add(r.org_name); return true; })
    .map(r => ({
      name: (r.org_name?.length ?? 0) > 22 ? r.org_name.slice(0, 22) + "…" : (r.org_name ?? "—"),
      value: parseFloat(r[cfg.valueKey]) || 0,
      fullName: r.org_name ?? "—",
    }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 20);

  const allCols = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="card p-5 space-y-4">
      <p className="label-eyebrow">Данные для анализа</p>

      {/* Tab switcher */}
      <div className="flex gap-1 flex-wrap">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-colors border ${
              activeTab === t
                ? "bg-fc-navy-700 text-white border-fc-navy-700"
                : "bg-white text-fc-steel-600 border-fc-steel-200 hover:border-fc-navy-300"
            }`}
          >
            {INSIGHT_CHART_CONFIGS[t]?.label ?? t}
            <span className="ml-1.5 opacity-50 font-normal">{data[t].length}</span>
          </button>
        ))}
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && cfg && (
        <div>
          <p className="text-xs text-fc-steel-500 mb-2 font-medium">{cfg.valueLabel}</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 64 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#64748b" }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} width={56} />
              <Tooltip
                contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                formatter={(v: any) => [Number(v).toLocaleString("ru-KZ"), cfg.valueLabel]}
                labelFormatter={(_label: any, payload: any) => payload?.[0]?.payload?.fullName ?? _label}
              />
              <Bar dataKey="value" fill={cfg.color} radius={[3, 3, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Data table */}
      <div className="overflow-x-auto max-h-72 overflow-y-auto">
        <table className="data-table">
          <thead>
            <tr>{allCols.map(c => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.slice(0, 100).map((r, i) => (
              <tr key={i}>
                {allCols.map(c => (
                  <td key={c} className="whitespace-nowrap">
                    {r[c] != null ? String(r[c]) : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 100 && (
          <p className="text-xs text-fc-steel-400 mt-2">Показано 100 из {rows.length} записей</p>
        )}
      </div>
    </div>
  );
}

const SEVERITY_CLS: Record<string, string> = {
  high:   "bg-danger/10 text-danger border-danger/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low:    "bg-fc-steel-50 text-fc-steel-600 border-fc-steel-200",
};

const AI_PRESETS = [
  {
    label: "Аномалии бюджета",
    query: "Найди организации с аномальными финансовыми показателями: ФОТ > бюджета, резкий скачок бюджета >4x, расходы превышают доходы. Используй поле detected_anomalies и данные finance. Назови конкретные организации и годы.",
    tables: ["finance_records"],
  },
  {
    label: "Аномалии контингента",
    query: "Найди организации с резкими скачками или падениями контингента обучающихся (>4x за год). Проанализируй также detected_anomalies типа contingent_spike. Объясни возможные причины каждой аномалии.",
    tables: ["contingent_snapshots"],
  },
  {
    label: "Низкое трудоустройство",
    query: "Выяви организации с критически низким трудоустройством выпускников (<20% за 6 месяцев). Смотри detected_anomalies типа low_employment и данные graduates. Это высокий риск потери госфинансирования.",
    tables: ["graduates_records"],
  },
  {
    label: "Наука — лидеры и аутсайдеры",
    query: "Сравни научную активность вузов: Scopus, WoS, h-индекс, гранты. Выяви аномальные всплески публикаций (возможный накрут). Топ-5 лидеров и 5 аутсайдеров с конкретными цифрами.",
    tables: ["science_activity"],
  },
  {
    label: "Комплексный риск-аудит",
    query: "Проведи комплексный риск-аудит системы: выяви организации с одновременно высоким ФОТ, низким трудоустройством и слабой наукой. Это кандидаты на снижение госфинансирования. Конкретные названия, цифры, рекомендации.",
    tables: ["finance_records", "contingent_snapshots", "graduates_records", "science_activity"],
  },
  {
    label: "Тренды 2020–2025",
    query: "Проанализируй динамику системы образования 2020-2025: как менялся контингент, бюджет, трудоустройство по годам. Выяви устойчивые тренды и переломные точки. Какой год был аномальным?",
    tables: ["finance_records", "contingent_snapshots", "graduates_records"],
  },
];

export function AIReportsPage() {
  const [query,     setQuery]     = useState("");
  const [tables,    setTables]    = useState<string[]>(["finance_records", "contingent_snapshots", "graduates_records"]);
  const [regionId,  setRegionId]  = useState<number | "">("");
  const [orgTypeId, setOrgTypeId] = useState<number | "">("");
  const [year,      setYear]      = useState<number | "">("");
  const [result,    setResult]    = useState<InsightResult | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [history,   setHistory]   = useState<InsightHistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const regions = useRegions();

  const loadHistory = useCallback(async () => {
    try {
      const resp = await client.get<InsightHistoryItem[]>("/admin/insights/history");
      setHistory(resp.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const generate = async (forceRefresh = false) => {
    if (!query.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const resp = await client.post<InsightResult>(
        "/admin/insights",
        {
          query,
          include_tables: tables,
          region_id:   regionId   !== "" ? regionId   : null,
          org_type_id: orgTypeId  !== "" ? orgTypeId  : null,
          year:        year       !== "" ? year       : null,
          force_refresh: forceRefresh,
        },
        { timeout: 120_000 },
      );
      setResult(resp.data);
      loadHistory();
    } catch (e: any) {
      if (e?.code === "ECONNABORTED" || e?.message?.includes("timeout")) {
        setError("Модель долго отвечает — повторите запрос через несколько секунд");
      } else {
        setError(e?.response?.data?.detail ?? "Ошибка генерации");
      }
    } finally {
      setLoading(false);
    }
  };

  const restoreHistory = (h: InsightHistoryItem) => {
    setQuery(h.query);
    setTables(h.include_tables.length ? h.include_tables : ["finance_records", "contingent_snapshots"]);
    setRegionId(h.region_id ?? "");
    setOrgTypeId(h.org_type_id ?? "");
    setYear(h.year ?? "");
    setResult({
      summary:         h.summary,
      anomalies:       h.anomalies,
      recommendations: h.recommendations,
      context_rows:    h.context_rows,
    });
    setError(null);
    setHistoryOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const applyPreset = (p: typeof AI_PRESETS[number]) => {
    setQuery(p.query);
    setTables(p.tables);
  };

  const TABLE_LABELS: Record<string, string> = {
    finance_records:      "Финансы",
    contingent_snapshots: "Контингент",
    science_activity:     "Наука",
    graduates_records:    "Выпускники",
    educational_process:  "Образование",
    coefficient_scores:   "Рейтинг",
  };
  const ALL_TABLES = Object.keys(TABLE_LABELS);

  return (
    <>
      <PageHeader title="AI инсайты" subtitle="Аналитика данных на основе модели Gemini 2.5 Pro" />

      {/* Input card */}
      <div className="card p-5 mb-5 border-fc-purple-100">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-fc-purple-600" />
          <p className="label-eyebrow text-fc-purple-700">Запрос к модели</p>
        </div>

        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          rows={3}
          placeholder="Опишите вопрос — модель проанализирует данные и сформирует ответ"
          className="input bg-white w-full"
        />

        {/* Фильтры скоупа */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pb-3 border-b border-slate-100">
          <span className="text-xs text-fc-steel-500 font-medium shrink-0">Скоуп:</span>

          <select className="input text-xs py-1 min-w-[140px]" value={regionId}
            onChange={e => setRegionId(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">Все регионы</option>
            {regions.map(r => <option key={r.id} value={r.id}>{r.name_ru}</option>)}
          </select>

          <select className="input text-xs py-1 min-w-[150px]" value={orgTypeId}
            onChange={e => setOrgTypeId(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">Все типы</option>
            {Object.entries(ORG_TYPE_RU).map(([id, label]) =>
              <option key={id} value={id}>{label}</option>
            )}
          </select>

          <select className="input text-xs py-1 w-20" value={year}
            onChange={e => setYear(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">Все годы</option>
            {[2025,2024,2023,2022,2021,2020].map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {(regionId || orgTypeId || year) && (
            <button onClick={() => { setRegionId(""); setOrgTypeId(""); setYear(""); }}
              className="text-xs text-fc-steel-400 hover:text-danger flex items-center gap-0.5">
              <X className="w-3 h-3" /> сбросить
            </button>
          )}
        </div>

        {/* Модули */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-xs text-fc-steel-500 font-medium shrink-0">Модули:</span>
          {ALL_TABLES.map(t => (
            <button
              key={t}
              onClick={() => setTables(prev =>
                prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
              )}
              className={`text-xs px-2.5 py-1 rounded-full border font-semibold transition-colors ${
                tables.includes(t)
                  ? "bg-fc-purple-600 text-white border-fc-purple-600"
                  : "bg-white text-fc-steel-600 border-fc-steel-200 hover:border-fc-purple-300"
              }`}
            >
              {TABLE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 mt-3">
          {AI_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className="text-xs px-2.5 py-1 bg-fc-purple-50 border border-fc-purple-200 rounded-md text-fc-purple-700 hover:bg-fc-purple-100 transition-colors font-medium"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => generate(false)}
            disabled={loading || !query.trim() || tables.length === 0}
            className="btn-primary !bg-fc-purple-600 hover:!bg-fc-purple-700 disabled:opacity-50"
          >
            {loading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Sparkles className="w-3.5 h-3.5" />
            }
            {loading ? "Анализирую…" : "Сгенерировать"}
          </button>
          {result && (
            <button
              onClick={() => generate(true)}
              disabled={loading}
              className="btn-ghost text-fc-purple-700 border border-fc-purple-200 disabled:opacity-50"
              title="Сбросить кэш и получить новый анализ от модели"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Обновить анализ
            </button>
          )}
        </div>
      </div>

      {/* History panel */}
      {history.length > 0 && (
        <div className="card mb-5 overflow-hidden">
          <button
            onClick={() => setHistoryOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-fc-steel-400" />
              <p className="label-eyebrow text-fc-steel-500">История запросов</p>
              <span className="pill bg-fc-steel-100 text-fc-steel-600">{history.length}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-fc-steel-400 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
          </button>
          {historyOpen && (
            <div className="border-t border-slate-100 divide-y divide-slate-50 max-h-72 overflow-y-auto">
              {history.map(h => {
                const scopeParts = [
                  h.region_name,
                  h.org_type_name,
                  h.year ? String(h.year) : null,
                ].filter(Boolean);
                return (
                  <button
                    key={h.id}
                    onClick={() => restoreHistory(h)}
                    className="w-full flex items-start gap-3 px-5 py-3 text-left hover:bg-fc-purple-50 transition-colors group"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-fc-purple-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-fc-navy-800 truncate group-hover:text-fc-purple-700">
                        {h.query}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {scopeParts.length > 0 && (
                          <span className="text-xs text-fc-steel-400">{scopeParts.join(" · ")}</span>
                        )}
                        <span className="text-xs text-fc-steel-300">
                          {new Date(h.created_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                    <RotateCcw className="w-3 h-3 text-fc-steel-300 group-hover:text-fc-purple-400 shrink-0 mt-1" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {error && <ErrorBox message={error} />}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="card p-5">
            <p className="label-eyebrow mb-3">Сводка</p>
            <p className="text-sm text-fc-navy-900 leading-relaxed whitespace-pre-wrap">{result.summary}</p>
            <p className="text-xs text-fc-steel-400 mt-3">
              Проанализировано строк контекста: {result.context_rows}
            </p>
          </div>

          {/* Anomalies */}
          {result.anomalies.length > 0 && (
            <div className="card p-5">
              <p className="label-eyebrow mb-3">
                Аномалии · {result.anomalies.length}
              </p>
              <div className="space-y-2">
                {result.anomalies.map((a, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border px-4 py-3 text-sm ${SEVERITY_CLS[a.severity] ?? SEVERITY_CLS.low}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <span className="font-semibold">{a.field}</span>
                        {a.value && (
                          <span className="ml-2 font-mono text-xs opacity-75">{a.value}</span>
                        )}
                        <p className="mt-0.5 opacity-90">{a.issue}</p>
                      </div>
                      <span className="shrink-0 text-xs font-bold uppercase tracking-wide opacity-70">
                        {a.severity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="card p-5">
              <p className="label-eyebrow mb-3">
                Рекомендации · {result.recommendations.length}
              </p>
              <ol className="space-y-2">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-3 text-sm text-fc-navy-800">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-fc-purple-100 text-fc-purple-700 text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span>{r}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Charts & data tables */}
          {result.data && Object.keys(result.data).length > 0 && (
            <InsightCharts data={result.data} />
          )}
        </div>
      )}
    </>
  );
}

export function ProfilePage() {
  const { user } = useAuth();
  const [changePwdOpen, setChangePwdOpen] = useState(false);
  if (!user) return null;

  return (
    <>
      <PageHeader title="Профиль" subtitle="Данные вашей учётной записи" />
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 bg-fc-navy-700 text-white rounded-lg flex items-center justify-center font-display font-black text-lg">
            {user.full_name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-xl font-display font-extrabold text-fc-navy-900 tracking-fc-tight">{user.full_name}</p>
            <p className="text-sm text-fc-steel-500">{user.email}</p>
          </div>
        </div>
        <dl className="border-t border-slate-100 pt-4 space-y-3 text-sm">
          <Row label="Роль"><RoleBadge role={user.role} /></Row>
          <Row label="UUID"><code className="font-mono text-xs text-fc-steel-600">{user.id}</code></Row>
          {user.org_id && <Row label="Организация"><code className="font-mono text-xs text-fc-steel-600">{user.org_id}</code></Row>}
        </dl>
        <div className="mt-5 pt-4 border-t border-slate-100">
          <button onClick={() => setChangePwdOpen(true)} className="btn-ghost">Сменить пароль</button>
        </div>
      </div>
      <ChangePasswordModal open={changePwdOpen} onClose={() => setChangePwdOpen(false)} />
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-fc-steel-600 font-semibold">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== confirm) { setError("Пароли не совпадают"); return; }
    if (next.length < 8)  { setError("Минимум 8 символов"); return; }
    setLoading(true); setError(null);
    try {
      await mutate("POST", "/auth/change-password", { current_password: current, new_password: next });
      setOk(true);
      setTimeout(() => { setOk(false); onClose(); setCurrent(""); setNext(""); setConfirm(""); }, 1500);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Ошибка");
    } finally { setLoading(false); }
  };

  return (
    <Modal open={open} title="Смена пароля" onClose={onClose} size="sm">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Текущий пароль"><input type="password" required value={current} onChange={e => setCurrent(e.target.value)} className="input" /></Field>
        <Field label="Новый пароль"><input type="password" required minLength={8} value={next} onChange={e => setNext(e.target.value)} className="input" /></Field>
        <Field label="Подтвердите"><input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} className="input" /></Field>
        {error && <ErrorBox message={error} />}
        {ok && <SuccessBox message="Пароль изменён" />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Отмена</button>
          <button type="submit" disabled={loading} className="btn-primary">{loading ? "..." : "Сменить"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  AI PRESENTATIONS PAGE
// ════════════════════════════════════════════════════════════════════════════

// ── Types ──────────────────────────────────────────────────────────────────

// ── Presentation types (re-exported from PresentationEngine) ────────────────
type PresentationReport = EngineReport;
interface ReportItem {
  report_id: number; status: "pending"|"generating"|"done"|"failed";
  period_year: number; focus?: string; region_id?: number; org_type_id?: number;
  celery_task_id?: string; created_at: string; error_message?: string;
}

const SLIDE_TYPE_LABELS: Record<string, string> = {
  title_slide:        "Обложка",
  metrics_comparison: "Ключевые метрики",
  anomalies_warning:  "Аномалии",
  rating_board:       "Рейтинг",
  ai_recommendations: "Рекомендации",
  split_text_chart:   "Аналитика",
  dashboard_3_charts: "Дашборд",
  comparison_table:   "Сравнение",
  key_metrics:        "KPI",
  image_background:   "Обложка",
};
const REPORT_STATUS_COLORS: Record<string, string> = {
  pending:    "bg-slate-100 text-slate-600",
  generating: "bg-fc-cyan-50 text-fc-cyan-700",
  done:       "bg-success/10 text-success",
  failed:     "bg-danger/10 text-danger",
};
const REPORT_STATUS_LABELS: Record<string, string> = {
  pending: "В очереди", generating: "Генерация…", done: "Готово", failed: "Ошибка",
};

// ── PDF download ────────────────────────────────────────────────────────────

function downloadPdf(report: PresentationReport) {
  // build HTML first, then open as blob URL to bypass popup blockers
  let win: Window | null = null;

  const slidesHtml = report.slides.map((slide, idx) => {
    const isTitleSlide = slide.slide_type === "title_slide";
    const isReco = slide.slide_type === "ai_recommendations";
    const bulletsHtml = slide.bullets.map(b => `<li>${b}</li>`).join("");

    // render chart data as a table (recharts SVG can't be captured in a new window)
    const chartHtml = slide.chart_data ? (() => {
      const cd = slide.chart_data!;
      const headerCols = ["", ...cd.datasets.map(ds => ds.label)].map(h => `<th>${h}</th>`).join("");
      const dataRows = cd.labels.map((lbl, i) => {
        const cells = cd.datasets.map(ds => {
          const v = ds.data[i];
          return `<td>${v != null ? Number(v).toLocaleString("ru-KZ") + (cd.unit ?? "") : "—"}</td>`;
        }).join("");
        return `<tr><td><strong>${lbl}</strong></td>${cells}</tr>`;
      }).join("");
      return `<div class="chart-table"><p class="chart-label">Данные диаграммы</p><table><thead><tr>${headerCols}</tr></thead><tbody>${dataRows}</tbody></table></div>`;
    })() : "";

    const anomaliesHtml = slide.anomalies.length > 0 ? `
      <table>
        <thead><tr><th>Организация</th><th>Показатель</th><th>Период</th><th>Значение</th><th>Ожидаемое</th><th>Отклонение</th><th>Уровень</th></tr></thead>
        <tbody>${slide.anomalies.map(a => `
          <tr>
            <td>${a.org_name}</td><td>${a.field}</td><td>${a.period}</td>
            <td>${typeof a.value === "number" ? a.value.toLocaleString("ru-KZ") : a.value}</td>
            <td>${a.expected != null ? a.expected.toLocaleString("ru-KZ") : "—"}</td>
            <td>${a.deviation != null ? `${a.deviation > 0 ? "+" : ""}${a.deviation.toFixed(1)}%` : "—"}</td>
            <td class="sev-${a.severity}">${a.severity === "high" ? "ВЫСОКИЙ" : a.severity === "medium" ? "СРЕДНИЙ" : "НИЗКИЙ"}</td>
          </tr>`).join("")}
        </tbody>
      </table>` : "";

    const keyMetricsHtml = slide.key_metrics && slide.key_metrics.length > 0 ? `
      <div class="kpi-grid">${slide.key_metrics.map(m => `
        <div class="kpi-card">
          <div class="kpi-label">${m.label}</div>
          <div class="kpi-value">${m.value}${m.unit ? `<span class="kpi-unit"> ${m.unit}</span>` : ""}</div>
          ${m.delta_pct != null ? `<div class="kpi-delta ${(m.delta_pct ?? 0) >= 0 ? "up" : "down"}">${(m.delta_pct ?? 0) >= 0 ? "▲" : "▼"} ${Math.abs(m.delta_pct ?? 0).toFixed(1)}%</div>` : ""}
        </div>`).join("")}
      </div>` : "";

    const yoyHtml = slide.yoy_comparisons && slide.yoy_comparisons.length > 0 ? `
      <div class="chart-table"><p class="chart-label">Сравнение год к году</p>
      <table>
        <thead><tr><th>Показатель</th><th>${slide.yoy_comparisons[0]?.prev_year ?? ""}</th><th>${slide.yoy_comparisons[0]?.current_year ?? ""}</th><th>Δ%</th></tr></thead>
        <tbody>${slide.yoy_comparisons.map(y => `
          <tr>
            <td>${y.label}</td>
            <td>${y.prev_val.toLocaleString("ru-KZ")}${y.unit ? " " + y.unit : ""}</td>
            <td>${y.current_val.toLocaleString("ru-KZ")}${y.unit ? " " + y.unit : ""}</td>
            <td class="${y.delta_pct >= 0 ? "sev-low" : "sev-high"}">${y.delta_pct >= 0 ? "+" : ""}${y.delta_pct.toFixed(1)}%</td>
          </tr>`).join("")}
        </tbody>
      </table></div>` : "";

    const compTableHtml = slide.comparison_rows && slide.comparison_rows.length > 0 ? `
      <div class="chart-table"><p class="chart-label">Сравнительная таблица</p>
      <table>
        <thead><tr><th>Наименование</th>${(slide.comparison_cols ?? []).map(c => `<th>${c}</th>`).join("")}</tr></thead>
        <tbody>${slide.comparison_rows.map(r => `
          <tr${r.is_highlighted ? ' style="font-weight:600;background:#f0f7ff"' : ""}>
            <td>${r.name}</td>${r.values.map(v => `<td>${v != null ? (typeof v === "number" ? v.toLocaleString("ru-KZ") : v) : "—"}</td>`).join("")}
          </tr>`).join("")}
        </tbody>
      </table></div>` : "";

    return `
      <section class="slide ${isTitleSlide ? "title" : isReco ? "reco" : ""}">
        <div class="slide-meta">
          <span class="slide-num">${idx + 1} / ${report.slides.length}</span>
          <span class="slide-type">${SLIDE_TYPE_LABELS[slide.slide_type]}</span>
        </div>
        <h1>${slide.title}</h1>
        ${slide.subtitle ? `<p class="subtitle">${slide.subtitle}</p>` : ""}
        ${bulletsHtml ? `<ul>${bulletsHtml}</ul>` : ""}
        ${keyMetricsHtml}
        ${yoyHtml}
        ${compTableHtml}
        ${chartHtml}
        ${anomaliesHtml}
      </section>`;
  }).join("");

  const meta = [
    report.period_year + " год",
    report.org_name    ? "Орг: " + report.org_name : "",
    report.region_name ? "Регион: " + report.region_name : "",
    report.org_type_name ?? "",
    report.focus       ? `«${report.focus}»` : "",
  ].filter(Boolean).join(" · ");

  const html = `<!DOCTYPE html><html lang="ru"><head>
    <meta charset="UTF-8">
    <title>AI Презентация #${report.report_id} — ${report.period_year}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Inter,Arial,sans-serif;background:#f8fafc;color:#1e293b}
      .cover{background:#19286d;color:white;padding:48px 60px 32px;page-break-after:always}
      .cover h2{font-size:22px;font-weight:800;letter-spacing:-.01em;margin-bottom:8px}
      .cover p{font-size:14px;color:rgba(255,255,255,.6)}
      .slide{padding:48px 60px;background:white;min-height:100vh;page-break-after:always;display:flex;flex-direction:column;gap:20px}
      .slide.title{background:#19286d;color:white}
      .slide.reco{background:#faf5ff}
      .slide-meta{display:flex;justify-content:space-between;align-items:center}
      .slide-num{font-size:11px;color:#94a3b8;font-variant-numeric:tabular-nums}
      .slide-type{font-size:10px;text-transform:uppercase;letter-spacing:.18em;color:#64748b;font-weight:600}
      .slide.title .slide-type{color:rgba(255,255,255,.4)}
      h1{font-size:28px;font-weight:800;line-height:1.2;color:#0f172a}
      .slide.title h1{color:white}
      .slide.reco h1{color:#4a1d7a}
      .subtitle{font-size:16px;color:#64748b;line-height:1.5}
      .slide.title .subtitle{color:rgba(255,255,255,.7)}
      ul{list-style:none;display:flex;flex-direction:column;gap:10px}
      li{padding-left:18px;position:relative;font-size:14px;color:#334155;line-height:1.6}
      li::before{content:"•";position:absolute;left:0;color:#0068b4;font-weight:bold}
      .slide.title li{color:rgba(255,255,255,.9)}
      .slide.title li::before{color:#00a6ca}
      .slide.reco li::before{color:#801e82}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
      th{background:#f1f5f9;text-align:left;padding:7px 10px;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0}
      td{padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#334155}
      tr:nth-child(even) td{background:#f8fafc}
      .sev-high{color:#c1272d;font-weight:600}
      .sev-medium{color:#c47200;font-weight:600}
      .sev-low{color:#296695}
      .chart-table{margin-top:12px;margin-bottom:4px}
      .chart-label{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#94a3b8;font-weight:600;margin-bottom:6px}
      .kpi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin:8px 0}
      .kpi-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px}
      .kpi-label{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#64748b;margin-bottom:4px}
      .kpi-value{font-size:22px;font-weight:800;color:#0f172a;font-variant-numeric:tabular-nums}
      .kpi-unit{font-size:13px;font-weight:400;color:#64748b}
      .kpi-delta{font-size:11px;font-weight:600;margin-top:4px}
      .kpi-delta.up{color:#16a34a}.kpi-delta.down{color:#c1272d}
      @media print{.slide,.cover{page-break-after:always;min-height:auto}body{background:white}}
    </style></head><body>
    <div class="cover">
      <h2>АО «Финансовый центр» — Аналитический отчёт #${report.report_id}</h2>
      <p>${meta}</p>
      <p style="margin-top:6px;font-size:12px;color:rgba(255,255,255,.4)">${report.context_rows} орг. · ${report.model_used} · ${new Date(report.generated_at).toLocaleDateString("ru-KZ")}</p>
    </div>
    ${slidesHtml}
  </body></html>`;

  // use blob URL to avoid popup-blocker issues
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  win = window.open(url, "_blank");
  if (!win) {
    // fallback: trigger download
    const a = document.createElement("a");
    a.href = url;
    a.download = `presentation-${report.report_id}-${report.period_year}.html`;
    a.click();
  } else {
    setTimeout(() => { win!.focus(); win!.print(); URL.revokeObjectURL(url); }, 500);
  }
}

// ── Slide deck viewer ───────────────────────────────────────────────────────

function SlideDeckViewer({ report }: { report: PresentationReport }) {
  return (
    <div className="space-y-3">
      {/* meta bar */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-fc-steel-500">
        <span className="font-semibold text-fc-navy-800">{report.period_year} год</span>
        {report.org_name      && <span className="pill">Орг: {report.org_name}</span>}
        {report.region_name   && <span className="pill">Регион: {report.region_name}</span>}
        {report.org_type_name && <span className="pill">{report.org_type_name}</span>}
        {report.focus         && <span className="pill text-fc-purple-700 border-fc-purple-200">«{report.focus}»</span>}
        <span className="ml-auto text-xs text-fc-steel-400">
          {report.context_rows} орг. · {report.model_used}
        </span>
        <button onClick={() => downloadPdf(report)}
          className="btn-ghost flex items-center gap-1.5 text-xs px-2.5 py-1.5">
          <Download className="w-3.5 h-3.5" /> PDF / HTML
        </button>
      </div>

      {/* 16:9 presentation engine */}
      <PresentationEngine report={report} onDownload={() => downloadPdf(report)} />
    </div>
  );
}

// ── Generate form ───────────────────────────────────────────────────────────

function GenerateForm({
  onGenerated,
}: { onGenerated: (id: number) => void }) {
  const { data: regions } = useApi<any[]>("/admin/references/regions");
  const { data: orgTypes } = useApi<any[]>("/admin/references/org-types");

  const [year,       setYear]       = useState(new Date().getFullYear());
  const [regionId,   setRegionId]   = useState<number|"">("");
  const [orgTypeId,  setOrgTypeId]  = useState<number|"">("");
  const [focus,      setFocus]      = useState("");
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState<string|null>(null);

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const body: any = { period_year: year };
      if (regionId)  body.region_id  = regionId;
      if (orgTypeId) body.org_type_id = orgTypeId;
      if (focus.trim()) body.focus   = focus.trim();
      const resp = await client.post("/admin/presentations", body);
      onGenerated(resp.data.report_id);
    } catch (ex: any) {
      setErr(ex.response?.data?.detail ?? "Ошибка запуска генерации");
    } finally {
      setSaving(false);
    }
  };

  const years = Array.from({ length: 6 }, (_, i) => 2025 - i);

  return (
    <form onSubmit={handle} className="card space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Presentation className="w-4 h-4 text-fc-blue-500" />
        <h3 className="font-display font-semibold text-fc-navy-900">Новый отчёт</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label-eyebrow text-fc-steel-500 mb-1 block">Год анализа</label>
          <select className="input" value={year} onChange={e => setYear(+e.target.value)}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-fc-steel-500 mb-1 block">Регион</label>
          <select className="input" value={regionId} onChange={e => setRegionId(e.target.value ? +e.target.value : "")}>
            <option value="">Вся система</option>
            {(regions ?? []).map((r: any) => <option key={r.id} value={r.id}>{r.name_ru}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-fc-steel-500 mb-1 block">Тип организации</label>
          <select className="input" value={orgTypeId} onChange={e => setOrgTypeId(e.target.value ? +e.target.value : "")}>
            <option value="">Все типы</option>
            {(orgTypes ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.name_ru} ({t.code})</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow text-fc-steel-500 mb-1 block">Фокус анализа</label>
          <input className="input" maxLength={500} placeholder="Напр.: Почему падает трудоустройство?"
            value={focus} onChange={e => setFocus(e.target.value)} />
        </div>
      </div>

      {err && <p className="text-danger text-sm">{err}</p>}

      <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
        {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Запуск…</> : <><Sparkles className="w-3.5 h-3.5" /> Сгенерировать</>}
      </button>
    </form>
  );
}

// ── Report row in history list ──────────────────────────────────────────────

function ReportRow({
  item,
  isActive,
  onClick,
}: { item: ReportItem; isActive: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border transition-colors
        ${isActive
          ? "border-fc-navy-300 bg-fc-navy-50"
          : "border-slate-200 bg-white hover:border-fc-navy-200 hover:bg-slate-50"}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-semibold text-fc-navy-900 text-sm">#{item.report_id} — {item.period_year} год</span>
        <span className={`pill text-[10px] px-2 py-0.5 ${REPORT_STATUS_COLORS[item.status]}`}>
          {REPORT_STATUS_LABELS[item.status]}
        </span>
      </div>
      {item.focus && <p className="text-xs text-fc-steel-500 truncate">«{item.focus}»</p>}
      <p className="text-xs text-fc-steel-400 mt-0.5">
        {new Date(item.created_at).toLocaleString("ru-KZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
      </p>
    </button>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export function PresentationsPage() {
  const [reports,   setReports]    = useState<ReportItem[]>([]);
  const [activeId,  setActiveId]   = useState<number|null>(null);
  const [report,    setReport]     = useState<PresentationReport|null>(null);
  const [pollingId, setPollingId]  = useState<number|null>(null);
  const [loadingRep, setLoadingRep] = useState(false);
  const [showForm,  setShowForm]   = useState(false);
  const [listLoading, setListLoading] = useState(true);

  // load history — memoized so it can be safely used in effects
  const loadList = useCallback(async () => {
    try {
      const r = await client.get("/admin/presentations?limit=30");
      setReports(r.data.items ?? []);
    } catch {/* ignore */} finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  // polling for pending/generating
  useEffect(() => {
    if (!pollingId) return;
    const timer = setInterval(async () => {
      try {
        const r = await client.get(`/admin/presentations/${pollingId}`);
        const data = r.data;
        setReports(prev => prev.map(p => p.report_id === pollingId
          ? { ...p, status: data.status } : p));
        if (data.status === "done" || data.status === "failed") {
          clearInterval(timer);
          setPollingId(null);
          if (data.status === "done" && data.report) {
            setReport(data.report);
          }
          loadList();
        }
      } catch { clearInterval(timer); setPollingId(null); }
    }, 3000);
    return () => clearInterval(timer);
  }, [pollingId, loadList]);

  // open report
  const openReport = async (id: number) => {
    setActiveId(id);
    setReport(null);
    setLoadingRep(true);
    try {
      const r = await client.get(`/admin/presentations/${id}`);
      if (r.data.report) setReport(r.data.report);
      else if (r.data.status === "pending" || r.data.status === "generating") {
        setPollingId(id);
      }
    } catch {/* ignore */} finally {
      setLoadingRep(false);
    }
  };

  const handleGenerated = async (id: number) => {
    setShowForm(false);
    await loadList();
    setActiveId(id);
    setReport(null);
    setPollingId(id);
  };

  const activeItem = reports.find(r => r.report_id === activeId);

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
      {/* page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Presentation className="w-5 h-5 text-fc-blue-500" />
            <h1 className="font-display font-bold text-xl text-fc-navy-900">AI Презентации</h1>
          </div>
          <p className="text-sm text-fc-steel-500">
            Автоматическая генерация аналитических отчётов — DataAnalyzer + Gemini Flash/Pro
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center gap-2">
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? "Закрыть" : "Новый отчёт"}
        </button>
      </div>

      {showForm && (
        <div className="mb-6">
          <GenerateForm onGenerated={handleGenerated} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* left: history */}
        <div className="lg:col-span-1 space-y-2">
          <div className="flex items-center justify-between mb-3">
            <p className="label-eyebrow text-fc-steel-400">История</p>
            <button onClick={loadList} className="btn-ghost p-1">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {listLoading && (
            <div className="flex items-center gap-2 text-fc-steel-400 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Загрузка…
            </div>
          )}

          {!listLoading && reports.length === 0 && (
            <div className="card text-center py-8 text-fc-steel-400">
              <Presentation className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Нет сгенерированных отчётов</p>
            </div>
          )}

          {reports.map(item => (
            <div key={item.report_id} className="relative">
              <ReportRow item={item} isActive={activeId === item.report_id}
                onClick={() => openReport(item.report_id)} />
              {(item.status === "pending" || item.status === "generating") && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-fc-cyan-500 absolute top-3 right-3" />
              )}
            </div>
          ))}
        </div>

        {/* right: viewer */}
        <div className="lg:col-span-2">
          {!activeId && (
            <div className="card flex flex-col items-center justify-center py-20 text-center text-fc-steel-400">
              <Presentation className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-medium">Выберите отчёт из истории</p>
              <p className="text-sm mt-1">или создайте новый</p>
            </div>
          )}

          {activeId && loadingRep && (
            <div className="card flex items-center justify-center py-20 text-fc-steel-400">
              <Loader2 className="w-6 h-6 animate-spin mr-3" /> Загрузка…
            </div>
          )}

          {activeId && !loadingRep && pollingId === activeId && (
            <div className="card flex flex-col items-center justify-center py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-fc-cyan-500 mb-4" />
              <p className="font-semibold text-fc-navy-800">
                {activeItem?.status === "generating" ? "Генерация слайдов…" : "В очереди…"}
              </p>
              <p className="text-sm text-fc-steel-500 mt-1">
                DataAnalyzer вычисляет метрики, Gemini синтезирует текст
              </p>
            </div>
          )}

          {activeId && !loadingRep && !pollingId && !report && activeItem?.status === "failed" && (
            <div className="card border-danger/20 bg-danger/5 py-8 text-center">
              <AlertTriangle className="w-8 h-8 text-danger mx-auto mb-2" />
              <p className="font-semibold text-danger">Генерация завершилась с ошибкой</p>
              {activeItem.error_message && (
                <p className="text-xs text-danger/70 mt-2 font-mono">{activeItem.error_message}</p>
              )}
            </div>
          )}

          {report && <SlideDeckViewer report={report} />}
        </div>
      </div>
    </div>
  );
}

export function CollegesPage() {
  const { user } = useAuth();
  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold text-fc-navy-900">Оценка эффективности колледжей</h1>
        <p className="text-sm text-fc-steel-500 mt-1">Рейтинг ТиППО по методике АО «Финансовый центр»</p>
      </div>
      <CollegeAssessmentPageComponent userRole={user?.role} />
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <p className="text-7xl font-display font-black text-fc-navy-100 tracking-fc-tight">404</p>
        <p className="text-xl font-display font-bold text-fc-navy-900 mt-3">Страница не найдена</p>
        <Link to="/" className="text-fc-blue-600 text-sm mt-4 inline-block hover:underline font-semibold">
          На главную →
        </Link>
      </div>
    </div>
  );
}
