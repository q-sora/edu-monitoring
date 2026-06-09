// src/features/presentations/PresentationsPage.tsx
import React, { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Presentation, Plus, X, RefreshCw, Loader2, AlertTriangle, Download, Sparkles,
} from "lucide-react";
import client from "@/api/client";
import { useApi } from "@/hooks/useApi";
import { PresentationEngine } from "@/features/presentations/PresentationEngine";
import type { PresentationReport } from "@/features/presentations/PresentationEngine";

// ── Types ──────────────────────────────────────────────────────────────────

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
  pending:    "bg-white/5 text-white/40",
  generating: "bg-fc-cyan-500/15 text-fc-cyan-300",
  done:       "bg-success/10 text-success",
  failed:     "bg-danger/10 text-danger",
};
const REPORT_STATUS_LABELS: Record<string, string> = {
  pending: "В очереди", generating: "Генерация…", done: "Готово", failed: "Ошибка",
};

// ── PDF download ────────────────────────────────────────────────────────────

export function downloadPdf(report: PresentationReport) {
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

export function SlideDeckViewer({ report }: { report: PresentationReport }) {
  return (
    <div className="space-y-3">
      {/* meta bar */}
      <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{report.period_year} год</span>
        {report.org_name      && <span className="pill">Орг: {report.org_name}</span>}
        {report.region_name   && <span className="pill">Регион: {report.region_name}</span>}
        {report.org_type_name && <span className="pill">{report.org_type_name}</span>}
        {report.focus         && <span className="pill" style={{ color: "#c248c4", background: "rgba(128,30,130,0.12)" }}>«{report.focus}»</span>}
        <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
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

export function GenerateForm({
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
    <form onSubmit={handle} className="card p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Presentation className="w-4 h-4 text-fc-blue-400" />
        <h3 className="font-display font-semibold" style={{ color: "var(--text-primary)" }}>Новый отчёт</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label-eyebrow mb-1 block">Год анализа</label>
          <select className="input" value={year} onChange={e => setYear(+e.target.value)}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow mb-1 block">Регион</label>
          <select className="input" value={regionId} onChange={e => setRegionId(e.target.value ? +e.target.value : "")}>
            <option value="">Вся система</option>
            {(regions ?? []).map((r: any) => <option key={r.id} value={r.id}>{r.name_ru}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow mb-1 block">Тип организации</label>
          <select className="input" value={orgTypeId} onChange={e => setOrgTypeId(e.target.value ? +e.target.value : "")}>
            <option value="">Все типы</option>
            {(orgTypes ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.name_ru} ({t.code})</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow mb-1 block">Фокус анализа</label>
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

export function ReportRow({
  item,
  isActive,
  onClick,
}: { item: ReportItem; isActive: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full text-left px-4 py-3 rounded-xl border transition-all"
      style={isActive
        ? { borderColor: "rgba(0,168,202,0.5)", background: "rgba(0,168,202,0.08)" }
        : { borderColor: "var(--border-subtle)", background: "var(--surface-card)" }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(0,168,202,0.04)"; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "var(--surface-card)"; }}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>#{item.report_id} — {item.period_year} год</span>
        <span className={`pill text-[10px] px-2 py-0.5 ${REPORT_STATUS_COLORS[item.status]}`}>
          {REPORT_STATUS_LABELS[item.status]}
        </span>
      </div>
      {item.focus && <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>«{item.focus}»</p>}
      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
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
            <Presentation className="w-5 h-5 text-fc-blue-400" />
            <h1 className="font-display font-bold text-xl" style={{ color: "var(--text-primary)" }}>AI Презентации</h1>
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
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
            <p className="label-eyebrow">История</p>
            <button onClick={loadList} className="btn-ghost p-1">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {listLoading && (
            <div className="flex items-center gap-2 text-sm py-4" style={{ color: "var(--text-muted)" }}>
              <Loader2 className="w-4 h-4 animate-spin" /> Загрузка…
            </div>
          )}

          {!listLoading && reports.length === 0 && (
            <div className="card text-center py-8" style={{ color: "var(--text-muted)" }}>
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
            <div className="card flex flex-col items-center justify-center py-20 text-center" style={{ color: "var(--text-muted)" }}>
              <Presentation className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-medium">Выберите отчёт из истории</p>
              <p className="text-sm mt-1">или создайте новый</p>
            </div>
          )}

          {activeId && loadingRep && (
            <div className="card flex items-center justify-center py-20" style={{ color: "var(--text-muted)" }}>
              <Loader2 className="w-6 h-6 animate-spin mr-3" /> Загрузка…
            </div>
          )}

          {activeId && !loadingRep && pollingId === activeId && (
            <div className="card flex flex-col items-center justify-center py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-fc-cyan-400 mb-4" />
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                {activeItem?.status === "generating" ? "Генерация слайдов…" : "В очереди…"}
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
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
