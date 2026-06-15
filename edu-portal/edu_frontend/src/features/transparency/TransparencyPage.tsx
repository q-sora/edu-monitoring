// src/features/transparency/TransparencyPage.tsx
import React, { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react";
import { staggerContainer } from "@/lib/animations";
import { useApi, useRegions } from "@/hooks/useApi";
import { Loader, ErrorBox, PageHeader } from "@/components/ui"; // Удален StatCard
import RegionalAnalytics from "@/features/transparency/RegionalAnalytics";

const ChevronDownIcon = ChevronDown;

// --- Новые компоненты для блоков оценки и KPI-ячеек ---
interface AssessmentBlockCardProps {
  title: string;
  subtitle: string;
  value: string;
  colorClass: string; // Tailwind class for border and text color, e.g., "border-emerald-500 text-emerald-500"
}

function AssessmentBlockCard({ title, subtitle, value, colorClass }: AssessmentBlockCardProps) {
  return (
    <div className={`p-5 bg-white rounded-2xl border ${colorClass} shadow-md flex items-center justify-between`}>
      <div>
        <p className="font-semibold text-slate-800 mb-0.5">{title}</p>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-3xl font-bold ${colorClass}`}>{value}</span>
        <ChevronDownIcon className={`w-5 h-5 ${colorClass}`} />
      </div>
    </div>
  );
}

interface KpiCellProps {
  value: string | number | null;
  isKeyMetric?: boolean;
  blockColorClass?: string; // e.g., "bg-emerald-500 text-white"
  format?: (v: number | null) => string;
}

function KpiCell({ value, isKeyMetric = false, blockColorClass = "", format = fmt }: KpiCellProps) {
  const formattedValue = value === null || value === undefined ? "—" : format(value as number);

  if (isKeyMetric) {
    return (
      <div className={`inline-block px-4 py-2 rounded-xl font-bold ${blockColorClass}`}>
        {formattedValue}
      </div>
    );
  }
  return <span className="text-gray-800">{formattedValue}</span>;
}

interface StatCardProps {
  accent: "navy" | "blue" | "cyan" | "steel";
  label: string;
  value: string;
  hint: string;
}

function StatCard({ accent, label, value, hint }: StatCardProps) {
  const accentColors = {
    navy: "border-slate-200 text-slate-800",
    blue: "border-blue-100 text-blue-600",
    cyan: "border-cyan-100 text-cyan-600",
    steel: "border-gray-200 text-gray-600",
  };
  return (
    <div className={`p-4 bg-white rounded-2xl border ${accentColors[accent] || "border-gray-200"} shadow-md`}>
      <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold mb-1">{value}</p>
      <p className="text-[10px] text-gray-400 leading-none">{hint}</p>
    </div>
  );
}
// --- Конец новых компонентов ---

export const ORG_TYPE_RU: Record<number, string> = {
  1: "Дошкольное",
  2: "Дополнительное",
  3: "Среднее",
  4: "Техн. и проф.",
  5: "Высшее и послевуз.",
  6: "Общежитие",
  7: "ГОНС Келешек",
  8: "Иное",
};

export const STATUS_RU: Record<string, string> = {
  active:       "Активна",
  reorganized:  "Реорганизована",
  liquidated:   "Ликвидирована",
};

export interface TransparencyOrg {
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

export function fmt(v: number | null, digits = 0): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("ru-KZ", { maximumFractionDigits: digits });
}
export function fmtM(v: number | null): string {
  if (v === null || v === undefined) return "—";
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} млрд ₸`;
  if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(0)} млн ₸`;
  return `${fmt(Math.round(v))} ₸`;
}

// Форматирование для KpiCell, добавляющее "~"
const fmtKpiValue = (v: number | null): string => {
  if (v === null || v === undefined) return "—";
  return `~${fmt(v, 0)}`; // Округляем до целых для значений KPI в шапке
};

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
      className="cursor-pointer select-none text-center px-3 py-3" // Убраны стили наведения, добавлено центрирование и паддинги
      onClick={() => toggleSort(k)}
    >
      <div className="flex items-center justify-center gap-1 text-white font-bold"> {/* Изменен цвет текста на белый */}
        {children}
        {sortKey === k
          ? (sortAsc ? <ChevronUp className="w-3 h-3 text-white" /> : <ChevronDownIcon className="w-3 h-3 text-white" />)
          : <ArrowUpDown className="w-3 h-3 text-gray-400" />}
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
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden overflow-x-auto mb-5">
          <div className="px-5 py-4 flex items-center gap-3 border-b border-gray-100">
            <p className="font-semibold text-gray-800 mr-auto">Финансы и контингент — {mapYear}</p>
            <span className="pill text-[10px]">{filterLabel}</span>
          </div>

          {orgs.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              Нет данных по выбранному фильтру
            </div>
          ) : (
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-gradient-to-r from-fc-blue-700 to-fc-blue-900">
                  <th className="sticky left-0 z-10 bg-fc-blue-700 px-4 py-3 text-left font-bold text-white min-w-[180px]">Организация</th>
                  <th className="px-3 py-3 text-left font-bold text-white">Уровень образования</th>
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
                  <tr key={org.id} className="group border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="sticky left-0 px-4 py-2.5 font-medium max-w-[180px] truncate z-10 bg-white group-hover:bg-gray-50 text-gray-800 transition-colors">
                      <span title={org.name_ru}>{org.name_ru}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">
                      {org.org_type_id ? (ORG_TYPE_RU[org.org_type_id] ?? "—") : "—"}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-right text-gray-800">{fmt(org.students)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-right text-gray-800">{fmtM(org.budget)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-right font-semibold text-gray-800">
                      {org.cost_per_student ? `${(org.cost_per_student / 1000).toFixed(0)} тыс` : "—"}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-right">
                      <MetricPill value={org.payroll_pct} avg={avg?.payroll_pct} higherIsBad />
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-right text-gray-800">
                      {fmt(org.rnd_pct, 1)}{org.rnd_pct !== null ? "%" : ""}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-right text-gray-800">{fmt(org.grant_pct, 1)}{org.grant_pct !== null ? "%" : ""}</td>
                    <td className="px-3 py-2.5 tabular-nums text-right">
                      <MetricPill value={org.employment_rate} avg={avg?.employment_rate} higherIsBad={false} />
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-right text-gray-800">{fmt(org.h_index_avg, 2)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-right text-gray-800">{fmt(org.publications_scopus)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-right text-gray-800">{fmt(org.publications_wos)}</td>
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
  if (value === null || value === undefined) return <span style={{ color: "var(--text-muted)" }}>—</span>;
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

export function RankCard({ title, orgs, metric, accentClass }: {
  title: string;
  orgs: TransparencyOrg[];
  metric: (o: TransparencyOrg) => string;
  accentClass: string;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <p className="label-eyebrow">{title}</p>
      </div>
      <ul>
        {orgs.map((org, i) => (
          <li key={org.id} className="flex items-center gap-3 px-5 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <span className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0" style={{ background: "rgba(0,168,202,0.15)", color: "var(--text-secondary)" }}>
              {i + 1}
            </span>
            <span className="text-sm flex-1 truncate" style={{ color: "var(--text-secondary)" }} title={org.name_ru}>
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
