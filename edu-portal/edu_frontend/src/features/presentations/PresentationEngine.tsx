/**
 * PresentationEngine.tsx
 *
 * 16:9 (1920×1080) presentation canvas that scales proportionally to any container.
 * Supports all slide types from the Agentic Orchestrator output.
 *
 * Layout approach:
 *   1. Outer div: relative w-full aspect-video overflow-hidden  → sets 16:9 height
 *   2. Inner div: absolute 1920×1080, transform: scale(w/1920)  → scales content
 *   3. ResizeObserver on outer div → recomputes scale live
 *
 * Recharts components use fixed pixel heights inside the 1920px canvas.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ComposedChart,
  ResponsiveContainer,
} from "recharts";
import {
  ChevronLeft, ChevronRight, Maximize2, Minimize2, X,
  TrendingUp, AlertTriangle, Trophy, Zap, FileText, BarChart2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChartDataset { label: string; data: (number | null)[]; color?: string | null; }
export interface ChartData    { type: string; labels: string[]; datasets: ChartDataset[]; unit?: string | null; }

export interface YoYComparison {
  metric: string; label: string; current_year: number; prev_year: number;
  current_val: number; prev_val: number; delta_pct: number; direction: string; unit?: string;
}
export interface NationalAvg {
  metric: string; label: string; scope_val: number; national_avg: number;
  deviation_pct: number; rank?: number; total_orgs?: number; unit?: string;
}
export interface KeyMetricItem {
  label: string; value: string; unit?: string | null; delta_pct?: number | null;
  direction?: string | null; color?: string | null;
}
export interface ComparisonRow { name: string; values: (number | string | null)[]; is_highlighted: boolean; }
export interface AnomalyItem {
  org_name: string; field: string; period: string; value: number | string;
  expected?: number | null; deviation?: number | null; severity: "high" | "medium" | "low"; description: string;
}

export interface Slide {
  slide_type: string;
  title: string; subtitle?: string | null; eyebrow?: string | null; bg_style?: string | null;
  bullets: string[];
  chart_data?: ChartData | null; chart_data_2?: ChartData | null; chart_data_3?: ChartData | null;
  anomalies: AnomalyItem[];
  yoy_comparisons: YoYComparison[];
  national_avgs: NationalAvg[];
  key_metrics: KeyMetricItem[];
  comparison_rows: ComparisonRow[];
  comparison_cols: string[];
}
export interface PresentationReport {
  report_id: number; org_name?: string; region_name?: string; org_type_name?: string;
  period_year: number; focus?: string; generated_at: string; model_used: string;
  context_rows: number; slides: Slide[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SLIDE_W = 1920;
const SLIDE_H = 1080;
const FC_COLORS = ["#19286d", "#0068b4", "#00a6ca", "#296695", "#801e82"];

const SEVERITY_BG: Record<string, string> = {
  high:   "bg-red-100 text-red-800 border-red-300",
  medium: "bg-amber-100 text-amber-800 border-amber-300",
  low:    "bg-slate-100 text-slate-600 border-slate-300",
};

// ─── Chart helper ─────────────────────────────────────────────────────────────

function SlideChart({ chart, height = 400 }: { chart: ChartData; height?: number }) {
  const data = chart.labels.map((lbl, i) => {
    const pt: Record<string, any> = { label: lbl };
    chart.datasets.forEach(ds => { pt[ds.label] = ds.data[i] ?? null; });
    return pt;
  });
  const unit = chart.unit ?? "";
  const fmt = (v: any) => `${Number(v).toLocaleString("ru-KZ")}${unit}`;
  const tickStyle = { fontSize: 18, fill: "#64748b" };
  const marg = { top: 8, right: 24, left: 8, bottom: 8 };

  if (chart.type === "line") return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={marg}>
        <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={tickStyle} interval={0} />
        <YAxis tick={tickStyle} width={80} tickFormatter={fmt} />
        <Tooltip formatter={fmt} contentStyle={{ fontSize: 16, borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 16 }} />
        {chart.datasets.map((ds, i) => (
          <Line key={ds.label} type="monotone" dataKey={ds.label}
            stroke={ds.color ?? FC_COLORS[i % FC_COLORS.length]} strokeWidth={4} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );

  if (chart.type === "area") return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={marg}>
        <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="label" tick={tickStyle} />
        <YAxis tick={tickStyle} width={80} tickFormatter={fmt} />
        <Tooltip formatter={fmt} contentStyle={{ fontSize: 16, borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 16 }} />
        {chart.datasets.map((ds, i) => {
          const c = ds.color ?? FC_COLORS[i % FC_COLORS.length];
          return <Area key={ds.label} type="monotone" dataKey={ds.label}
            stroke={c} fill={c + "33"} strokeWidth={4} />;
        })}
      </AreaChart>
    </ResponsiveContainer>
  );

  if (chart.type === "pie") {
    const pieData = chart.labels.map((lbl, i) => ({ name: lbl, value: chart.datasets[0]?.data[i] ?? 0 }));
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={height * 0.4}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
            {pieData.map((_, i) => <Cell key={i} fill={FC_COLORS[i % FC_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={fmt} contentStyle={{ fontSize: 16, borderRadius: 8 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // default: bar — vertical if many labels
  const isHoriz = data.length > 7;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={isHoriz ? "vertical" : "horizontal"} margin={marg}>
        <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
        {isHoriz ? (
          <>
            <XAxis type="number" tick={tickStyle} tickFormatter={fmt} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 16, fill: "#64748b" }} width={200} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" tick={{ fontSize: 15, fill: "#64748b" }} angle={-25} textAnchor="end" interval={0} height={80} />
            <YAxis tick={tickStyle} width={80} tickFormatter={fmt} />
          </>
        )}
        <Tooltip formatter={fmt} contentStyle={{ fontSize: 16, borderRadius: 8 }} />
        <Legend wrapperStyle={{ fontSize: 16 }} />
        {chart.datasets.map((ds, i) => (
          <Bar key={ds.label} dataKey={ds.label}
            fill={ds.color ?? FC_COLORS[i % FC_COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={60} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Slide type renderers (inside 1920×1080 canvas) ──────────────────────────

function SlideImageBackground({ slide, idx, total }: { slide: Slide; idx: number; total: number }) {
  return (
    <div className="w-full h-full relative flex flex-col justify-center overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0a1339 0%, #19286d 60%, #004c87 100%)" }}>
      {/* decorative grid */}
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 79px,#fff 79px,#fff 80px),repeating-linear-gradient(90deg,transparent,transparent 79px,#fff 79px,#fff 80px)" }} />
      {/* accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-3 bg-fc-cyan-500" />

      <div className="relative z-10 px-36 py-16">
        {slide.eyebrow && (
          <p className="label-eyebrow text-fc-cyan-400 text-2xl tracking-widest mb-8"
            style={{ letterSpacing: "0.25em" }}>
            {slide.eyebrow}
          </p>
        )}
        <h1 className="font-display font-extrabold text-white leading-tight mb-8"
          style={{ fontSize: 96 }}>
          {slide.title}
        </h1>
        {slide.subtitle && (
          <p className="text-fc-steel-200 mb-10" style={{ fontSize: 36 }}>
            {slide.subtitle}
          </p>
        )}
        {slide.bullets.length > 0 && (
          <ul className="space-y-4">
            {slide.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-4 text-white/85" style={{ fontSize: 28 }}>
                <span className="flex-none mt-2.5 w-2.5 h-2.5 rounded-full bg-fc-cyan-400" />
                {b}
              </li>
            ))}
          </ul>
        )}
        {slide.key_metrics && slide.key_metrics.length > 0 && (
          <div className="flex gap-12 mt-12">
            {slide.key_metrics.slice(0, 3).map((m, i) => (
              <div key={i} className="flex flex-col">
                <span className="font-display font-extrabold text-white tabular-nums"
                  style={{ fontSize: 64 }}>
                  {m.value}
                  {m.unit && <span className="font-normal ml-2 text-white/60" style={{ fontSize: 32 }}>{m.unit}</span>}
                </span>
                <span className="text-fc-steel-300" style={{ fontSize: 22 }}>{m.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="absolute bottom-10 right-14 text-white/20 tabular-nums" style={{ fontSize: 22 }}>
        {idx + 1} / {total}
      </div>
    </div>
  );
}

function SlideKeyMetrics({ slide, idx, total }: { slide: Slide; idx: number; total: number }) {
  const metrics = slide.key_metrics ?? [];
  const cols = metrics.length <= 3 ? metrics.length : metrics.length <= 4 ? 2 : metrics.length <= 6 ? 3 : 3;

  return (
    <div className="w-full h-full bg-white flex flex-col px-24 py-16">
      <div className="mb-8">
        {slide.eyebrow && <p className="label-eyebrow text-fc-steel-400 mb-3"
          style={{ fontSize: 22, letterSpacing: "0.2em" }}>{slide.eyebrow}</p>}
        <h2 className="font-display font-extrabold text-fc-navy-900" style={{ fontSize: 72 }}>
          {slide.title}
        </h2>
        {slide.subtitle && <p className="text-fc-steel-500 mt-2" style={{ fontSize: 28 }}>{slide.subtitle}</p>}
      </div>

      <div className="flex-1 grid gap-6" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {metrics.map((m, i) => {
          const accent = m.color === "cyan" ? "#00a6ca"
            : m.color === "purple" ? "#801e82"
            : "#19286d";
          return (
            <div key={i} className="rounded-2xl flex flex-col justify-between p-8"
              style={{ background: `${accent}0D`, border: `2px solid ${accent}22` }}>
              <p className="text-fc-steel-500 font-semibold" style={{ fontSize: 24 }}>{m.label}</p>
              <div className="mt-4">
                <span className="font-display font-extrabold tabular-nums"
                  style={{ fontSize: 72, color: accent }}>
                  {m.value}
                </span>
                {m.unit && <span className="text-fc-steel-400 ml-3" style={{ fontSize: 32 }}>{m.unit}</span>}
                {m.delta_pct != null && (
                  <div className="mt-2 font-semibold" style={{ fontSize: 24,
                    color: m.direction === "up" ? "#0e8c5a" : m.direction === "down" ? "#c1272d" : "#64748b" }}>
                    {m.delta_pct > 0 ? "▲" : m.delta_pct < 0 ? "▼" : "●"} {Math.abs(m.delta_pct).toFixed(1)}%
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center mt-4 text-fc-steel-300" style={{ fontSize: 18 }}>
        <span className="font-semibold tracking-widest" style={{ letterSpacing: "0.15em" }}>
          АО «ФИНАНСОВЫЙ ЦЕНТР»
        </span>
        <span className="tabular-nums">{idx + 1} / {total}</span>
      </div>
    </div>
  );
}

function SlideSplitTextChart({ slide, idx, total }: { slide: Slide; idx: number; total: number }) {
  const isNavy = slide.bg_style === "navy";
  return (
    <div className="w-full h-full flex">
      {/* Left: text panel */}
      <div className="w-1/2 flex flex-col justify-center px-20 py-16"
        style={{ background: isNavy ? "linear-gradient(160deg,#0a1339,#19286d)" : "#f8fafc" }}>
        {slide.eyebrow && (
          <p className="label-eyebrow mb-5" style={{ fontSize: 22, letterSpacing: "0.22em",
            color: isNavy ? "#5fc4df" : "#64748b" }}>
            {slide.eyebrow}
          </p>
        )}
        <h2 className="font-display font-extrabold leading-tight mb-6"
          style={{ fontSize: 68, color: isNavy ? "#fff" : "#0a1339" }}>
          {slide.title}
        </h2>
        {slide.subtitle && (
          <p className="mb-8" style={{ fontSize: 28, color: isNavy ? "rgba(255,255,255,.75)" : "#475569" }}>
            {slide.subtitle}
          </p>
        )}
        <ul className="space-y-5">
          {slide.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-4" style={{ fontSize: 24,
              color: isNavy ? "rgba(255,255,255,.9)" : "#1e293b" }}>
              <span className="flex-none mt-2.5 w-2.5 h-2.5 rounded-full"
                style={{ background: "#00a6ca" }} />
              {b}
            </li>
          ))}
        </ul>

        {/* YoY badges */}
        {slide.yoy_comparisons && slide.yoy_comparisons.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-3">
            {slide.yoy_comparisons.slice(0, 3).map((y, i) => (
              <div key={i} className="rounded-xl px-4 py-2"
                style={{ background: isNavy ? "rgba(255,255,255,.1)" : "#e2e8f0" }}>
                <span style={{ fontSize: 16, color: isNavy ? "#fff" : "#334155" }}>
                  {y.label}: {y.delta_pct > 0 ? "▲" : "▼"} {Math.abs(y.delta_pct).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: chart panel */}
      <div className="w-1/2 flex flex-col justify-center px-12 py-16 bg-white">
        {slide.chart_data
          ? <SlideChart chart={slide.chart_data} height={580} />
          : <div className="flex items-center justify-center h-full text-fc-steel-300" style={{ fontSize: 24 }}>
              Данные недоступны
            </div>
        }
      </div>
    </div>
  );
}

function SlideDashboard3Charts({ slide, idx, total }: { slide: Slide; idx: number; total: number }) {
  const charts = [slide.chart_data, slide.chart_data_2, slide.chart_data_3].filter(Boolean) as ChartData[];
  return (
    <div className="w-full h-full bg-white flex flex-col px-20 py-12">
      <div className="mb-6">
        {slide.eyebrow && <p className="label-eyebrow text-fc-steel-400 mb-2"
          style={{ fontSize: 20, letterSpacing: "0.2em" }}>{slide.eyebrow}</p>}
        <h2 className="font-display font-extrabold text-fc-navy-900" style={{ fontSize: 60 }}>
          {slide.title}
        </h2>
        {slide.subtitle && <p className="text-fc-steel-500 mt-1" style={{ fontSize: 24 }}>{slide.subtitle}</p>}
      </div>
      <div className="flex-1 grid gap-6" style={{ gridTemplateColumns: `repeat(${Math.min(3, charts.length)}, 1fr)` }}>
        {charts.map((chart, i) => (
          <div key={i} className="rounded-2xl p-6 flex flex-col"
            style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0" }}>
            <p className="font-semibold text-fc-steel-500 mb-3" style={{ fontSize: 20 }}>
              {chart.datasets[0]?.label ?? ""}
            </p>
            <div className="flex-1">
              <SlideChart chart={chart} height={300} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center mt-4 text-fc-steel-300" style={{ fontSize: 18 }}>
        <span className="font-semibold tracking-widest" style={{ letterSpacing: "0.15em" }}>
          АО «ФИНАНСОВЫЙ ЦЕНТР»
        </span>
        <span className="tabular-nums">{idx + 1} / {total}</span>
      </div>
    </div>
  );
}

function SlideComparisonTable({ slide, idx, total }: { slide: Slide; idx: number; total: number }) {
  const cols = slide.comparison_cols ?? [];
  const rows = slide.comparison_rows ?? [];
  const fmt = (v: number | string | null) => {
    if (v == null) return "—";
    if (typeof v === "number") return v.toLocaleString("ru-KZ");
    return v;
  };
  return (
    <div className="w-full h-full bg-white flex flex-col px-20 py-12">
      <div className="mb-6">
        {slide.eyebrow && <p className="label-eyebrow text-fc-steel-400 mb-2"
          style={{ fontSize: 20, letterSpacing: "0.2em" }}>{slide.eyebrow}</p>}
        <h2 className="font-display font-extrabold text-fc-navy-900" style={{ fontSize: 60 }}>
          {slide.title}
        </h2>
        {slide.subtitle && <p className="text-fc-steel-500 mt-1" style={{ fontSize: 24 }}>{slide.subtitle}</p>}
      </div>
      <div className="flex-1 overflow-hidden">
        <table className="w-full border-collapse" style={{ fontSize: 20 }}>
          <thead>
            <tr style={{ background: "#19286d" }}>
              {cols.map((c, i) => (
                <th key={i} className="text-white font-semibold text-left px-5 py-3"
                  style={{ borderBottom: "2px solid #243879" }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{
                background: row.is_highlighted ? "#e6f0fa" : i % 2 === 0 ? "#fff" : "#f8fafc",
                fontWeight: row.is_highlighted ? 700 : undefined,
              }}>
                <td className="px-5 py-2.5 font-medium text-fc-navy-800" style={{ borderBottom: "1px solid #e2e8f0" }}>
                  {row.name}
                </td>
                {row.values.map((v, j) => (
                  <td key={j} className="px-5 py-2.5 tabular-nums text-fc-navy-700" style={{ borderBottom: "1px solid #e2e8f0" }}>
                    {fmt(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center mt-4 text-fc-steel-300" style={{ fontSize: 18 }}>
        <span className="font-semibold" style={{ letterSpacing: "0.15em" }}>АО «ФИНАНСОВЫЙ ЦЕНТР»</span>
        <span className="tabular-nums">{idx + 1} / {total}</span>
      </div>
    </div>
  );
}

function SlideAnomalies({ slide, idx, total }: { slide: Slide; idx: number; total: number }) {
  const anoms = slide.anomalies ?? [];
  return (
    <div className="w-full h-full bg-white flex flex-col px-20 py-10">
      <div className="mb-4">
        {slide.eyebrow && <p className="label-eyebrow mb-2"
          style={{ fontSize: 20, letterSpacing: "0.2em", color: "#c1272d" }}>{slide.eyebrow}</p>}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ background: "#fee2e2" }}>
            <AlertTriangle style={{ width: 28, height: 28, color: "#c1272d" }} />
          </div>
          <h2 className="font-display font-extrabold text-fc-navy-900" style={{ fontSize: 60 }}>
            {slide.title}
          </h2>
        </div>
        {slide.subtitle && <p className="text-fc-steel-500 mt-2 ml-18" style={{ fontSize: 24 }}>{slide.subtitle}</p>}
      </div>
      <div className="flex-1 overflow-hidden">
        <table className="w-full border-collapse" style={{ fontSize: 18 }}>
          <thead>
            <tr style={{ background: "#f1f5f9" }}>
              {["Организация", "Показатель", "Период", "Значение", "Ожидаемое", "Отклонение", "Уровень"].map((h, i) => (
                <th key={i} className="text-left font-semibold text-fc-navy-700 px-4 py-3"
                  style={{ borderBottom: "2px solid #e2e8f0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {anoms.slice(0, 12).map((a, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                <td className="px-4 py-2.5 font-medium text-fc-navy-800"
                  style={{ borderBottom: "1px solid #f1f5f9" }}>{a.org_name}</td>
                <td className="px-4 py-2.5 text-fc-steel-600"
                  style={{ borderBottom: "1px solid #f1f5f9" }}>{a.field}</td>
                <td className="px-4 py-2.5 text-fc-steel-500"
                  style={{ borderBottom: "1px solid #f1f5f9" }}>{a.period}</td>
                <td className="px-4 py-2.5 tabular-nums font-medium"
                  style={{ borderBottom: "1px solid #f1f5f9" }}>
                  {typeof a.value === "number" ? a.value.toLocaleString("ru-KZ") : a.value}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-fc-steel-500"
                  style={{ borderBottom: "1px solid #f1f5f9" }}>
                  {a.expected != null ? Number(a.expected).toLocaleString("ru-KZ") : "—"}
                </td>
                <td className="px-4 py-2.5 tabular-nums"
                  style={{ borderBottom: "1px solid #f1f5f9",
                    color: (a.deviation ?? 0) > 0 ? "#c1272d" : "#0e8c5a" }}>
                  {a.deviation != null ? `${a.deviation > 0 ? "+" : ""}${Number(a.deviation).toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-2.5" style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <span className={`inline-block rounded-lg px-3 py-1 border font-semibold text-sm ${SEVERITY_BG[a.severity]}`}
                    style={{ fontSize: 14 }}>
                    {a.severity === "high" ? "ВЫСОКИЙ" : a.severity === "medium" ? "СРЕДНИЙ" : "НИЗКИЙ"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center mt-3 text-fc-steel-300" style={{ fontSize: 18 }}>
        <span style={{ letterSpacing: "0.15em" }}>АО «ФИНАНСОВЫЙ ЦЕНТР»</span>
        <span className="tabular-nums">{idx + 1} / {total}</span>
      </div>
    </div>
  );
}

function SlideRatingBoard({ slide, idx, total }: { slide: Slide; idx: number; total: number }) {
  return (
    <div className="w-full h-full bg-white flex flex-col px-20 py-10">
      <div className="mb-4">
        {slide.eyebrow && <p className="label-eyebrow text-fc-steel-400 mb-2"
          style={{ fontSize: 20, letterSpacing: "0.2em" }}>{slide.eyebrow}</p>}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ background: "#eef0f7" }}>
            <Trophy style={{ width: 28, height: 28, color: "#19286d" }} />
          </div>
          <h2 className="font-display font-extrabold text-fc-navy-900" style={{ fontSize: 60 }}>
            {slide.title}
          </h2>
        </div>
      </div>
      <div className="flex-1 flex gap-10">
        <div className="flex-1">
          {slide.chart_data
            ? <SlideChart chart={slide.chart_data} height={680} />
            : <div className="flex items-center justify-center h-full text-fc-steel-300" style={{ fontSize: 24 }}>
                Данные недоступны
              </div>
          }
        </div>
        {slide.bullets.length > 0 && (
          <div className="w-80 flex flex-col justify-center space-y-4">
            {slide.bullets.map((b, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="flex-none w-7 h-7 rounded-full flex items-center justify-center font-bold text-white"
                  style={{ fontSize: 14, background: "#19286d", minWidth: 28 }}>
                  {i + 1}
                </span>
                <span className="text-fc-navy-800 leading-snug" style={{ fontSize: 20 }}>{b}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-between items-center mt-3 text-fc-steel-300" style={{ fontSize: 18 }}>
        <span style={{ letterSpacing: "0.15em" }}>АО «ФИНАНСОВЫЙ ЦЕНТР»</span>
        <span className="tabular-nums">{idx + 1} / {total}</span>
      </div>
    </div>
  );
}

function SlideRecommendations({ slide, idx, total }: { slide: Slide; idx: number; total: number }) {
  return (
    <div className="w-full h-full flex flex-col px-24 py-14"
      style={{ background: "linear-gradient(135deg, #f5e8f5 0%, #e3bee4 50%, #f5e8f5 100%)" }}>
      <div className="mb-8">
        {slide.eyebrow && <p className="label-eyebrow mb-3"
          style={{ fontSize: 22, letterSpacing: "0.22em", color: "#5f1761" }}>{slide.eyebrow}</p>}
        <h2 className="font-display font-extrabold leading-tight"
          style={{ fontSize: 72, color: "#330a35" }}>
          {slide.title}
        </h2>
        {slide.subtitle && (
          <p className="mt-3" style={{ fontSize: 28, color: "#5f1761" }}>{slide.subtitle}</p>
        )}
      </div>
      <div className="flex-1 grid gap-5" style={{
        gridTemplateColumns: slide.bullets.length <= 3 ? "1fr" : "repeat(2, 1fr)"
      }}>
        {slide.bullets.map((b, i) => (
          <div key={i} className="rounded-2xl flex gap-5 items-start p-7"
            style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(8px)" }}>
            <div className="flex-none w-14 h-14 rounded-xl flex items-center justify-center font-bold text-white"
              style={{ fontSize: 28, background: "#801e82", minWidth: 56 }}>
              {i + 1}
            </div>
            <p className="text-fc-navy-900 leading-relaxed" style={{ fontSize: 24 }}>{b}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center mt-4"
        style={{ fontSize: 18, color: "#721b74", opacity: 0.6 }}>
        <span style={{ letterSpacing: "0.15em" }}>АО «ФИНАНСОВЫЙ ЦЕНТР»</span>
        <span className="tabular-nums">{idx + 1} / {total}</span>
      </div>
    </div>
  );
}

function SlideGeneric({ slide, idx, total }: { slide: Slide; idx: number; total: number }) {
  const isTitleSlide = slide.slide_type === "title_slide";
  const bg = isTitleSlide ? "linear-gradient(135deg,#0a1339,#19286d)" : "#fff";
  const titleColor = isTitleSlide ? "#fff" : "#0a1339";
  const textColor  = isTitleSlide ? "rgba(255,255,255,.85)" : "#1e293b";
  return (
    <div className="w-full h-full flex flex-col px-24 py-16" style={{ background: bg }}>
      <div className="mb-8">
        {slide.eyebrow && <p className="label-eyebrow mb-3"
          style={{ fontSize: 22, letterSpacing: "0.22em", color: isTitleSlide ? "#5fc4df" : "#64748b" }}>
          {slide.eyebrow}</p>}
        <h2 className="font-display font-extrabold leading-tight" style={{ fontSize: 72, color: titleColor }}>
          {slide.title}
        </h2>
        {slide.subtitle && <p className="mt-3" style={{ fontSize: 30, color: isTitleSlide ? "rgba(255,255,255,.7)" : "#475569" }}>
          {slide.subtitle}</p>}
      </div>
      {slide.chart_data && (
        <div className="mb-6 rounded-2xl p-4" style={{ background: "rgba(0,0,0,.04)" }}>
          <SlideChart chart={slide.chart_data} height={380} />
        </div>
      )}
      {slide.bullets.length > 0 && (
        <ul className="space-y-5 flex-1">
          {slide.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-4" style={{ fontSize: 26, color: textColor }}>
              <span className="flex-none mt-2.5 w-2.5 h-2.5 rounded-full" style={{ background: "#0068b4" }} />
              {b}
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-between items-center mt-6"
        style={{ fontSize: 18, color: isTitleSlide ? "rgba(255,255,255,.3)" : "#94a3b8" }}>
        <span style={{ letterSpacing: "0.15em" }}>АО «ФИНАНСОВЫЙ ЦЕНТР»</span>
        <span className="tabular-nums">{idx + 1} / {total}</span>
      </div>
    </div>
  );
}

// ─── Slide dispatcher ─────────────────────────────────────────────────────────

function SlideRenderer({ slide, idx, total }: { slide: Slide; idx: number; total: number }) {
  const props = { slide, idx, total };
  switch (slide.slide_type) {
    case "image_background":                return <SlideImageBackground {...props} />;
    case "title_slide":                     return <SlideImageBackground {...props} />;
    case "key_metrics":                     return <SlideKeyMetrics {...props} />;
    case "split_text_chart":                return <SlideSplitTextChart {...props} />;
    case "dashboard_3_charts":              return <SlideDashboard3Charts {...props} />;
    case "comparison_table":                return <SlideComparisonTable {...props} />;
    case "anomalies_warning":               return <SlideAnomalies {...props} />;
    case "rating_board":                    return <SlideRatingBoard {...props} />;
    case "ai_recommendations":              return <SlideRecommendations {...props} />;
    default:                                return <SlideGeneric {...props} />;
  }
}

// ─── PresentationEngine ───────────────────────────────────────────────────────

interface PresentationEngineProps {
  report: PresentationReport;
  onDownload?: () => void;
}

export function PresentationEngine({ report, onDownload }: PresentationEngineProps) {
  const [idx, setIdx]       = useState(0);
  const outerRef            = useRef<HTMLDivElement>(null);
  const fsRef               = useRef<HTMLDivElement>(null);
  const [scale, setScale]   = useState(1);
  const [fsMode, setFsMode] = useState(false);
  const total = report.slides.length;

  // Responsive scale
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => setScale(el.offsetWidth / SLIDE_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Native fullscreen
  useEffect(() => {
    const el = fsRef.current;
    if (!el) return;
    if (fsMode) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }
  }, [fsMode]);

  useEffect(() => {
    const onChange = () => { if (!document.fullscreenElement) setFsMode(false); };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown")
        setIdx(i => Math.min(total - 1, i + 1));
      if (e.key === "ArrowLeft" || e.key === "ArrowUp")
        setIdx(i => Math.max(0, i - 1));
      if (e.key === "Escape") setFsMode(false);
      if (e.key === "f" || e.key === "F") setFsMode(f => !f);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [total]);

  const goNext = useCallback(() => setIdx(i => Math.min(total - 1, i + 1)), [total]);
  const goPrev = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);

  const slideTypeLabel: Record<string, string> = {
    title_slide: "Обложка", metrics_comparison: "Метрики", anomalies_warning: "Аномалии",
    rating_board: "Рейтинг", ai_recommendations: "Рекомендации", split_text_chart: "Аналитика",
    dashboard_3_charts: "Дашборд", comparison_table: "Сравнение", key_metrics: "KPI",
    image_background: "Обложка",
  };

  return (
    <div ref={fsRef} className="flex flex-col bg-[#0b1120] rounded-xl overflow-hidden shadow-fc-xl">
      {/* ── Slide canvas ──────────────────────────────────────────────────── */}
      <div ref={outerRef} className="relative w-full overflow-hidden cursor-pointer select-none"
        style={{ aspectRatio: "16/9" }}
        onClick={() => {/* click to advance */}}>

        {/* Inner fixed-size canvas */}
        <div style={{
          width: SLIDE_W, height: SLIDE_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "absolute", top: 0, left: 0,
        }}>
          {report.slides[idx] && (
            <SlideRenderer slide={report.slides[idx]} idx={idx} total={total} />
          )}
        </div>
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────────── */}
      <div className="h-1 bg-white/10">
        <div className="h-1 bg-fc-cyan-500 transition-all duration-300"
          style={{ width: `${((idx + 1) / total) * 100}%` }} />
      </div>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3">
        {/* prev */}
        <button onClick={goPrev} disabled={idx === 0}
          className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white disabled:opacity-20 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10">
          <ChevronLeft className="w-4 h-4" /> Назад
        </button>

        {/* dot indicators */}
        <div className="flex items-center gap-1.5">
          {report.slides.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`rounded-full transition-all duration-200 ${
                i === idx ? "bg-fc-cyan-400 w-6 h-1.5" : "bg-white/25 hover:bg-white/50 w-1.5 h-1.5"
              }`} />
          ))}
        </div>

        {/* right controls */}
        <div className="flex items-center gap-2">
          <span className="text-white/30 text-xs hidden sm:block">
            {slideTypeLabel[report.slides[idx]?.slide_type] ?? "Слайд"}
          </span>
          <span className="text-white/30 text-xs tabular-nums">{idx + 1}/{total}</span>

          {onDownload && (
            <button onClick={onDownload}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              title="Скачать PDF">
              <BarChart2 className="w-4 h-4" />
            </button>
          )}

          <button onClick={() => setFsMode(f => !f)}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            title={fsMode ? "Выйти из полного экрана (F)" : "На весь экран (F)"}>
            {fsMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button onClick={goNext} disabled={idx === total - 1}
            className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white disabled:opacity-20 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10">
            Вперёд <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
