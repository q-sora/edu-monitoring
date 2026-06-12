// src/features/dashboard/DashboardPage.tsx
import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  GraduationCap, Wallet, FlaskConical, UsersRound, BookOpen,
  RefreshCw, Building, ShieldCheck, BarChart3, Sparkles,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell,
} from "recharts";
import { staggerContainer } from "@/lib/animations";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/auth/AuthContext";
import {
  Loader, ErrorBox, StatCard, StatusBadge, PageHeader,
} from "@/components/ui";
import { SupersetSection } from "@/features/analytics/SupersetDashboardsPage";

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
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <p className="font-display font-bold" style={{ color: "var(--text-primary)" }}>Последние заявки</p>
          <Link to="/admin/approvals" className="text-xs font-semibold text-fc-blue-400 hover:underline">
            Все →
          </Link>
        </div>
        {pending.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>Заявок на согласование нет</div>
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
                  <td>{p.org_name ?? p.org_id ?? "—"}</td>
                  <td>{p.period_year ?? "—"}</td>
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
    navy:   "bg-fc-navy-700/20 text-fc-navy-300",
    blue:   "bg-fc-blue-500/15 text-fc-blue-300",
    cyan:   "bg-fc-cyan-500/15 text-fc-cyan-400",
    steel:  "bg-fc-steel-500/15 text-fc-steel-300",
    purple: "bg-fc-purple-500/20 text-fc-purple-300",
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
              <p className="font-display font-bold" style={{ color: "var(--text-primary)" }}>{s.label}</p>
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
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
          <div className="p-2.5 rounded-lg shrink-0" style={{ background: "rgba(0,168,202,0.15)" }}>
            <BarChart3 className="w-5 h-5 text-fc-cyan-400" />
          </div>
          <div>
            <p className="font-display font-bold text-sm" style={{ color: "var(--text-primary)" }}>Прозрачность</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Карта регионов и показатели организаций</p>
          </div>
        </Link>
        <Link to="/reports" className="card-hover p-5 flex items-center gap-4">
          <div className="p-2.5 rounded-lg shrink-0" style={{ background: "rgba(128,30,130,0.2)" }}>
            <Sparkles className="w-5 h-5 text-fc-purple-400" />
          </div>
          <div>
            <p className="font-display font-bold text-sm" style={{ color: "var(--text-primary)" }}>AI инсайты</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Аналитика на основе Gemini</p>
          </div>
        </Link>
      </div>
      <SupersetSection />
    </>
  );
}