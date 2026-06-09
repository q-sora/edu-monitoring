/**
 * features/anomalies/AnomaliesPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * AI Anomaly Detection — "Inbox" pattern.
 *
 * Layout:
 *   Left sidebar  — filters (sphere, year, region, severity, status)
 *   Main area     — sorted anomaly cards with sparklines
 *   Right panel   — slide-over with Gemini explanation + ComposedChart
 */
import React, {
  useState, useEffect, useCallback, useRef, useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { staggerContainer, staggerItem, slideOver } from "@/lib/animations";
import {
  AlertTriangle, TrendingDown, TrendingUp, Info,
  ChevronRight, X, RefreshCw, Loader2, BarChart3,
  CheckCircle2, EyeOff, Sparkles, Filter,
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, ReferenceLine,
} from "recharts";
import client from "@/api/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TrendPoint {
  year:         number;
  value:        number;
  national_avg: number;
}

interface AIExplanation {
  summary:        string;
  reasons:        string[];
  recommendation: string;
  context:        string;
}

interface AnomalyItem {
  id:             number;
  sphere:         string;
  region_id:      number | null;
  region_name:    string | null;
  year:           number;
  severity:       "critical" | "warning" | "info";
  metric_name:    string;
  metric_label:   string | null;
  raw_value:      number | null;
  expected_value: number | null;
  deviation_pct:  number | null;
  z_score:        number | null;
  trend_json:     TrendPoint[] | null;
  ai_explanation_json: AIExplanation | null;
  status:         string;
  scan_run_at:    string;
  created_at:     string;
}

interface ListResponse {
  items:    AnomalyItem[];
  total:    int;
  page:     int;
  per_page: int;
}

type int = number;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SPHERE_LABELS: Record<string, string> = {
  contingent: "Контингент",
  finance:    "Финансирование",
  science:    "Наука",
  graduates:  "Выпускники",
  education:  "Образ. процесс",
};

const SEVERITY_CONFIG: Record<string, {
  label:  string;
  badge:  string;
  color:  string;
  icon:   React.FC<{ className?: string }>;
  dot:    string;
}> = {
  critical: {
    label:  "Критичное",
    badge:  "bg-danger/10 text-danger border-danger/20",
    color:  "#c1272d",
    icon:   ({ className }) => <AlertTriangle className={className} />,
    dot:    "bg-danger",
  },
  warning: {
    label:  "Предупреждение",
    badge:  "bg-warning/10 text-warning border-warning/20",
    color:  "#c47200",
    icon:   ({ className }) => <TrendingDown className={className} />,
    dot:    "bg-warning",
  },
  info: {
    label:  "К сведению",
    badge:  "bg-fc-blue-500/15 text-fc-blue-300 border-fc-blue-500/20",
    color:  "#0068b4",
    icon:   ({ className }) => <Info className={className} />,
    dot:    "bg-fc-blue-400",
  },
};

const SPHERE_COLORS: Record<string, string> = {
  contingent: "text-fc-navy-200 bg-fc-navy-800/60",
  finance:    "text-fc-navy-200 bg-fc-navy-800/60",
  science:    "text-fc-cyan-300 bg-fc-cyan-900/40",
  graduates:  "text-fc-steel-300 bg-fc-steel-800/40",
  education:  "text-fc-purple-300 bg-fc-purple-900/40",
};

const CHART_COLORS = ["#19286d", "#00a6ca", "#801e82", "#296695", "#0068b4"];

function fmtVal(v: number | null, label: string | null): string {
  if (v === null || v === undefined) return "—";
  const lc = (label ?? "").toLowerCase();
  if (lc.includes("%") || lc.includes("pct")) return `${v.toFixed(1)}%`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} млн`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)} тыс.`;
  return v.toFixed(2).replace(/\.00$/, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// Sparkline — tiny inline trend chart
// ─────────────────────────────────────────────────────────────────────────────

function Sparkline({ trend, severity }: { trend: TrendPoint[]; severity: string }) {
  if (!trend || trend.length === 0) return <div className="w-[100px] h-[36px] rounded" style={{ background: "rgba(255,255,255,0.04)" }} />;

  const lineColor = severity === "critical" ? "#c1272d"
                  : severity === "warning"  ? "#c47200"
                  : "#0068b4";

  return (
    <ResponsiveContainer width={100} height={36}>
      <LineChart data={trend} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line
          type="monotone" dataKey="national_avg"
          stroke="#cbd5e1" strokeWidth={1} dot={false} strokeDasharray="3 2"
        />
        <Line
          type="monotone" dataKey="value"
          stroke={lineColor} strokeWidth={2} dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Anomaly card
// ─────────────────────────────────────────────────────────────────────────────

function AnomalyCard({
  item, selected, onClick,
}: { item: AnomalyItem; selected: boolean; onClick: () => void }) {
  const cfg  = SEVERITY_CONFIG[item.severity] ?? SEVERITY_CONFIG.info;
  const Icon = cfg.icon;
  const dev  = item.deviation_pct;
  const sphereColor = SPHERE_COLORS[item.sphere] ?? "text-fc-cyan-300 bg-fc-cyan-500/15";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left card p-4 relative transition-all duration-150
        ${selected ? "ring-2 ring-fc-cyan-400" : ""}
        ${item.status === "dismissed" ? "opacity-40" : ""}
      `}
      style={selected ? { borderColor: "var(--border-active)" } : {}}
    >
      {/* Colored left strip — uses absolute positioning to preserve rounded corners */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
           style={{ background: cfg.color }} />
      <div className="flex items-start gap-3 pl-3">
        <div className={`flex-none w-8 h-8 rounded-lg flex items-center justify-center ${cfg.badge}`}>
          <Icon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`label-eyebrow text-[10px] px-1.5 py-0.5 rounded font-semibold ${sphereColor}`}>
                {SPHERE_LABELS[item.sphere] ?? item.sphere}
              </span>
              <span className={`pill text-[10px] px-2 py-0.5 border ${cfg.badge}`}>
                {cfg.label}
              </span>
              {item.status === "reviewed" && (
                <span className="pill text-[10px] px-2 py-0.5 border border-success/20 bg-success/10 text-success">
                  Проверено
                </span>
              )}
            </div>
            <ChevronRight className={`w-4 h-4 flex-none transition-transform ${selected ? "rotate-90" : ""}`}
                          style={{ color: "var(--text-muted)" }} />
          </div>

          <p className="font-semibold text-sm leading-snug truncate" style={{ color: "var(--text-primary)" }}>
            {item.metric_label ?? item.metric_name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {item.region_name ?? "Все регионы"} · {item.year} г.
          </p>

          <div className="flex items-center justify-between mt-3 gap-3">
            <div className="flex items-baseline gap-3">
              <span className="text-base font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                {fmtVal(item.raw_value, item.metric_label)}
              </span>
              {dev !== null && (
                <span className={`flex items-center gap-0.5 text-xs font-semibold tabular-nums
                  ${dev > 0 ? "text-fc-cyan-400" : "text-danger"}`}>
                  {dev > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {dev > 0 ? "+" : ""}{dev.toFixed(1)}%
                </span>
              )}
              {item.expected_value !== null && (
                <span className="text-xs tabular-nums hidden sm:inline" style={{ color: "var(--text-muted)" }}>
                  ср. {fmtVal(item.expected_value, item.metric_label)}
                </span>
              )}
            </div>

            {item.trend_json && item.trend_json.length > 0 && (
              <div className="flex-none">
                <Sparkline trend={item.trend_json} severity={item.severity} />
              </div>
            )}
          </div>

          {item.ai_explanation_json?.summary && (
            <p className="text-xs mt-2 line-clamp-2 italic" style={{ color: "var(--text-muted)" }}>
              {item.ai_explanation_json.summary}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide-over detail panel
// ─────────────────────────────────────────────────────────────────────────────

function DetailPanel({
  item, onClose, onStatusChange,
}: {
  item: AnomalyItem;
  onClose: () => void;
  onStatusChange: (id: number, status: string) => void;
}) {
  const cfg  = SEVERITY_CONFIG[item.severity] ?? SEVERITY_CONFIG.info;
  const ai   = item.ai_explanation_json;
  const trend = item.trend_json ?? [];
  const [saving, setSaving] = useState(false);

  const updateStatus = async (newStatus: string) => {
    setSaving(true);
    try {
      await client.patch(`/admin/anomalies/${item.id}`, { status: newStatus });
      onStatusChange(item.id, newStatus);
    } finally {
      setSaving(false);
    }
  };

  // Compose chart data with national avg reference
  const chartData = trend.map(pt => ({
    year:         pt.year.toString(),
    "Регион":     pt.value,
    "Среднее":    pt.national_avg,
  }));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-5 sticky top-0 z-10"
           style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-card)" }}>
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`pill text-[10px] px-2 py-0.5 border ${cfg.badge}`}>
              {cfg.label}
            </span>
            <span className="label-eyebrow text-[10px]" style={{ color: "var(--text-muted)" }}>
              {SPHERE_LABELS[item.sphere] ?? item.sphere}
            </span>
          </div>
          <h2 className="font-display font-bold text-lg leading-tight" style={{ color: "var(--text-primary)" }}>
            {item.metric_label ?? item.metric_name}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {item.region_name ?? "—"} · {item.year} г.
          </p>
        </div>
        <button onClick={onClose}
          className="flex-none p-2 rounded-lg transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Факт",     value: fmtVal(item.raw_value, item.metric_label) },
            { label: "Ожидаемо", value: fmtVal(item.expected_value, item.metric_label) },
            { label: "Откл.",    value: item.deviation_pct != null ? `${item.deviation_pct > 0 ? "+" : ""}${item.deviation_pct.toFixed(1)}%` : "—" },
          ].map(kpi => (
            <div key={kpi.label} className="card p-3 text-center">
              <p className="label-eyebrow text-[10px] mb-1">{kpi.label}</p>
              <p className="font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* ComposedChart */}
        {chartData.length > 0 && (
          <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)" }}>
            <p className="label-eyebrow text-[10px] mb-2" style={{ color: "var(--text-muted)" }}>Динамика по годам</p>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#4d6296" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#4d6296" }} width={48} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: "11px", borderRadius: "8px", border: "1px solid rgba(0,168,202,0.3)", background: "#1a2d5a", color: "#e8edf8" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", color: "#8ca0c8" }} />
                <Area
                  type="monotone" dataKey="Среднее"
                  fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.2)"
                  fillOpacity={1} strokeWidth={1}
                />
                <Line
                  type="monotone" dataKey="Регион"
                  stroke={item.severity === "critical" ? "#c1272d" : item.severity === "warning" ? "#c47200" : "#0068b4"}
                  strokeWidth={2.5} dot={{ r: 3 }}
                />
                <ReferenceLine
                  y={item.expected_value ?? undefined}
                  stroke="#94a3b8" strokeDasharray="4 3"
                  label={{ value: "ср.", fontSize: 9, fill: "#94a3b8" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* AI Explanation */}
        {ai ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-fc-purple-500" />
              <p className="label-eyebrow text-[10px]" style={{ color: "var(--text-muted)" }}>Анализ Gemini AI</p>
            </div>

            {/* Summary */}
            <div className="rounded-xl p-4" style={{ background: "rgba(0,104,180,0.12)", border: "1px solid rgba(0,168,202,0.2)" }}>
              <p className="text-sm font-semibold leading-relaxed" style={{ color: "var(--text-primary)" }}>{ai.summary}</p>
            </div>

            {/* Reasons */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-muted)" }}>
                Возможные причины
              </p>
              <ol className="space-y-2.5">
                {ai.reasons.map((r, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="flex-none w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center mt-0.5"
                          style={{ background: "rgba(0,104,180,0.25)", color: "#4da8d8" }}>
                      {i + 1}
                    </span>
                    <span className="leading-relaxed" style={{ color: "var(--text-secondary)" }}>{r}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Recommendation */}
            <div className="rounded-xl p-4" style={{ border: "1px solid rgba(0,168,202,0.25)", background: "rgba(0,168,202,0.08)" }}>
              <p className="label-eyebrow text-[10px] mb-1.5" style={{ color: "#00a6ca" }}>Рекомендация</p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{ai.recommendation}</p>
            </div>

            {/* Context */}
            {ai.context && (
              <p className="text-xs italic leading-relaxed" style={{ color: "var(--text-muted)" }}>{ai.context}</p>
            )}
          </div>
        ) : (
          <div className="text-center py-8" style={{ color: "var(--text-muted)" }}>
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">AI-объяснение формируется…</p>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="p-4 flex items-center gap-2" style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--surface-mid)" }}>
        {item.status !== "reviewed" && (
          <button
            onClick={() => updateStatus("reviewed")}
            disabled={saving}
            className="btn-success flex items-center gap-1.5 text-xs px-3 py-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Проверено
          </button>
        )}
        {item.status !== "dismissed" && (
          <button
            onClick={() => updateStatus("dismissed")}
            disabled={saving}
            className="btn-ghost flex items-center gap-1.5 text-xs px-3 py-1.5"
          >
            <EyeOff className="w-3.5 h-3.5" />
            Игнорировать
          </button>
        )}
        {item.status !== "new" && (
          <button
            onClick={() => updateStatus("new")}
            disabled={saving}
            className="btn-ghost flex items-center gap-1.5 text-xs px-3 py-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Сбросить
          </button>
        )}
        {saving && <Loader2 className="w-4 h-4 animate-spin ml-auto" style={{ color: "var(--text-muted)" }} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────────────────────────────────────

interface Filters {
  sphere:    string;
  year:      string;
  region_id: string;
  severity:  string;
  status:    string;
}

export default function AnomaliesPage() {
  const [items,    setItems]    = useState<AnomalyItem[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [selected, setSelected] = useState<AnomalyItem | null>(null);
  const [regions,  setRegions]  = useState<{ id: number; name_ru: string }[]>([]);
  const [summary,  setSummary]  = useState<{ critical: number; warning: number; info: number; total: number } | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    sphere: "", year: "", region_id: "", severity: "", status: "new",
  });
  const PER_PAGE = 20;

  // Load reference data
  useEffect(() => {
    client.get("/admin/references/regions").then(r => setRegions(r.data));
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      const r = await client.get("/admin/anomalies/meta/summary");
      setSummary(r.data);
    } catch {}
  };

  const load = useCallback(async (p = 1, f = filters) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(p), per_page: String(PER_PAGE) };
      if (f.sphere)    params.sphere    = f.sphere;
      if (f.year)      params.year      = f.year;
      if (f.region_id) params.region_id = f.region_id;
      if (f.severity)  params.severity  = f.severity;
      if (f.status)    params.status    = f.status;

      const resp = await client.get("/admin/anomalies", { params });
      setItems(resp.data.items);
      setTotal(resp.data.total);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(1, filters); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilter = (key: keyof Filters, val: string) => {
    const next = { ...filters, [key]: val };
    setFilters(next);
    load(1, next);
  };

  const handleStatusChange = (id: number, status: string) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, status } : it));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
    loadSummary();
  };

  const triggerScan = async () => {
    setTriggering(true);
    try {
      await client.post("/admin/anomalies/trigger");
      // Reload after a short delay
      setTimeout(() => { load(1, filters); loadSummary(); setTriggering(false); }, 2000);
    } catch {
      setTriggering(false);
    }
  };

  const years = useMemo(() => {
    const cur = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => cur - i);
  }, []);

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">

      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-64 flex-none flex flex-col overflow-y-auto"
             style={{ borderRight: "1px solid var(--border-subtle)", background: "var(--surface-mid)" }}>
        <div className="p-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-danger" />
            <h2 className="font-display font-bold text-sm" style={{ color: "var(--text-primary)" }}>Точки внимания</h2>
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Значимые статистические отклонения</p>

          {/* Summary badges */}
          {summary && (
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {summary.critical > 0 && (
                <span className="pill text-[10px] px-1.5 py-0.5 bg-danger/10 text-danger border-danger/20 border">
                  {summary.critical} крит.
                </span>
              )}
              {summary.warning > 0 && (
                <span className="pill text-[10px] px-1.5 py-0.5 bg-warning/10 text-warning border-warning/20 border">
                  {summary.warning} предупр.
                </span>
              )}
              {summary.info > 0 && (
                <span className="pill text-[10px] px-1.5 py-0.5 bg-fc-blue-50 text-fc-blue-600 border-fc-blue-100 border">
                  {summary.info} инфо
                </span>
              )}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="p-4 space-y-4 flex-1">
          <div className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
            <Filter className="w-3 h-3" />
            <span className="label-eyebrow text-[10px]">Фильтры</span>
          </div>

          {/* Severity */}
          <div>
            <label className="label-eyebrow text-[10px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
              Критичность
            </label>
            <div className="space-y-1">
              {["", "critical", "warning", "info"].map(sev => (
                <button key={sev}
                  onClick={() => applyFilter("severity", sev)}
                  className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                  style={filters.severity === sev
                    ? { background: "#0068b4", color: "#fff" }
                    : { color: "var(--text-secondary)" }}
                  onMouseEnter={e => { if (filters.severity !== sev) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={e => { if (filters.severity !== sev) e.currentTarget.style.background = "transparent"; }}
                >
                  {sev === "" ? "Все уровни" :
                   sev === "critical" ? "⬤ Критичные" :
                   sev === "warning"  ? "⬤ Предупреждения" : "⬤ К сведению"}
                </button>
              ))}
            </div>
          </div>

          {/* Sphere */}
          <div>
            <label className="label-eyebrow text-[10px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
              Сфера
            </label>
            <select
              value={filters.sphere}
              onChange={e => applyFilter("sphere", e.target.value)}
              className="input text-xs w-full"
            >
              <option value="">Все сферы</option>
              {Object.entries(SPHERE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div>
            <label className="label-eyebrow text-[10px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
              Год
            </label>
            <select
              value={filters.year}
              onChange={e => applyFilter("year", e.target.value)}
              className="input text-xs w-full"
            >
              <option value="">Все годы</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Region */}
          <div>
            <label className="label-eyebrow text-[10px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
              Регион
            </label>
            <select
              value={filters.region_id}
              onChange={e => applyFilter("region_id", e.target.value)}
              className="input text-xs w-full"
            >
              <option value="">Все регионы</option>
              {regions.map(r => <option key={r.id} value={r.id}>{r.name_ru}</option>)}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="label-eyebrow text-[10px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
              Статус
            </label>
            <select
              value={filters.status}
              onChange={e => applyFilter("status", e.target.value)}
              className="input text-xs w-full"
            >
              <option value="">Все</option>
              <option value="new">Новые</option>
              <option value="reviewed">Проверено</option>
              <option value="dismissed">Игнорируется</option>
            </select>
          </div>
        </div>

        {/* Trigger scan */}
        <div className="p-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button
            onClick={triggerScan}
            disabled={triggering}
            className="btn-secondary w-full flex items-center justify-center gap-1.5 text-xs py-2"
          >
            {triggering
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Запуск…</>
              : <><RefreshCw className="w-3.5 h-3.5" /> Запустить сканирование</>
            }
          </button>
          <p className="text-[10px] mt-1.5 text-center" style={{ color: "var(--text-muted)" }}>
            Автоматически каждый понедельник в 03:00
          </p>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 flex flex-col overflow-hidden transition-all ${selected ? "max-w-[calc(100%-420px)]" : "max-w-full"}`}>
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-mid)" }}>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-fc-blue-500" />
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {loading ? "Загрузка…" : `${total} отклонений`}
              </span>
            </div>
            <button onClick={() => load(page, filters)}
              className="btn-ghost flex items-center gap-1.5 text-xs px-2.5 py-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Обновить
            </button>
          </div>

          {/* Cards list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {loading && items.length === 0 ? (
              <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>
                <Loader2 className="w-8 h-8 mx-auto animate-spin mb-2" />
                <p className="text-sm">Загрузка данных…</p>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Отклонений не обнаружено</p>
                <p className="text-sm">
                  {Object.values(filters).some(Boolean)
                    ? "Попробуйте изменить фильтры или запустить сканирование"
                    : "Запустите сканирование для выявления аномалий"}
                </p>
              </div>
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="space-y-2.5"
              >
                {items.map(item => (
                  <motion.div key={item.id} variants={staggerItem}>
                    <AnomalyCard
                      item={item}
                      selected={selected?.id === item.id}
                      onClick={() => setSelected(prev => prev?.id === item.id ? null : item)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--surface-mid)" }}>
              <button onClick={() => load(page - 1)} disabled={page === 1}
                className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-30">
                ← Назад
              </button>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {page} / {totalPages}
              </span>
              <button onClick={() => load(page + 1)} disabled={page === totalPages}
                className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-30">
                Вперёд →
              </button>
            </div>
          )}
        </div>

        {/* ── Slide-over panel ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {selected && (
            <motion.div
              variants={slideOver}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-[420px] flex-none overflow-hidden flex flex-col"
              style={{ borderLeft: "1px solid var(--border-subtle)", background: "var(--surface-card)", boxShadow: "-8px 0 32px rgba(0,0,0,0.3)" }}
            >
              <DetailPanel
                item={selected}
                onClose={() => setSelected(null)}
                onStatusChange={handleStatusChange}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
