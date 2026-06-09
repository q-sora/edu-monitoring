// src/features/ai/AIReportsPage.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  Sparkles, X, Clock, ChevronDown, MessageSquare, RotateCcw, RefreshCw, Loader2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import client from "@/api/client";
import { useRegions } from "@/hooks/useApi";
import { ErrorBox, PageHeader } from "@/components/ui";
import { ORG_TYPE_RU } from "@/features/transparency/TransparencyPage";

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

export function InsightCharts({ data }: { data: Record<string, any[]> }) {
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
            className="text-xs px-3 py-1.5 rounded-md font-semibold transition-colors border"
            style={activeTab === t
              ? { background: "#0068b4", color: "#fff", borderColor: "#0068b4" }
              : { background: "transparent", color: "var(--text-secondary)", borderColor: "var(--border-subtle)" }
            }
          >
            {INSIGHT_CHART_CONFIGS[t]?.label ?? t}
            <span className="ml-1.5 opacity-50 font-normal">{data[t].length}</span>
          </button>
        ))}
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && cfg && (
        <div>
          <p className="text-xs mb-2 font-medium" style={{ color: "var(--text-muted)" }}>{cfg.valueLabel}</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 64 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#4d6296" }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 10, fill: "#4d6296" }} width={56} />
              <Tooltip
                contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid rgba(0,168,202,0.3)", background: "#1a2d5a", color: "#e8edf8" }}
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
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>Показано 100 из {rows.length} записей</p>
        )}
      </div>
    </div>
  );
}

const SEVERITY_CLS: Record<string, string> = {
  high:   "bg-danger/10 text-danger border-danger/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low:    "bg-white/5 text-white/50 border-white/10",
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
      <div className="card p-5 mb-5" style={{ borderColor: "rgba(128,30,130,0.25)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-fc-purple-400" />
          <p className="label-eyebrow" style={{ color: "#c248c4" }}>Запрос к модели</p>
        </div>

        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          rows={3}
          placeholder="Опишите вопрос — модель проанализирует данные и сформирует ответ"
          className="input w-full"
        />

        {/* Фильтры скоупа */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pb-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <span className="text-xs font-medium shrink-0" style={{ color: "var(--text-muted)" }}>Скоуп:</span>

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
              className="text-xs flex items-center gap-0.5 hover:text-danger" style={{ color: "var(--text-muted)" }}>
              <X className="w-3 h-3" /> сбросить
            </button>
          )}
        </div>

        {/* Модули */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-xs font-medium shrink-0" style={{ color: "var(--text-muted)" }}>Модули:</span>
          {ALL_TABLES.map(t => (
            <button
              key={t}
              onClick={() => setTables(prev =>
                prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
              )}
              className="text-xs px-2.5 py-1 rounded-full border font-semibold transition-colors"
              style={tables.includes(t)
                ? { background: "rgba(128,30,130,0.6)", color: "#fff", borderColor: "rgba(128,30,130,0.8)" }
                : { background: "transparent", color: "var(--text-secondary)", borderColor: "var(--border-subtle)" }
              }
              onMouseEnter={e => { if (!tables.includes(t)) (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(128,30,130,0.5)"; }}
              onMouseLeave={e => { if (!tables.includes(t)) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-subtle)"; }}
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
              className="text-xs px-2.5 py-1 rounded-md font-medium transition-colors"
              style={{ background: "rgba(128,30,130,0.12)", border: "1px solid rgba(128,30,130,0.25)", color: "#c248c4" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(128,30,130,0.2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(128,30,130,0.12)")}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => generate(false)}
            disabled={loading || !query.trim() || tables.length === 0}
            className="btn-primary disabled:opacity-50"
            style={{ background: "#801e82" }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#6e1870"; }}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "#801e82"}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {loading ? "Анализирую…" : "Сгенерировать"}
          </button>
          {result && (
            <button
              onClick={() => generate(true)}
              disabled={loading}
              className="btn-ghost disabled:opacity-50"
              style={{ borderColor: "rgba(128,30,130,0.4)", color: "#c248c4" }}
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
            className="w-full flex items-center justify-between px-5 py-3 transition-colors"
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <p className="label-eyebrow">История запросов</p>
              <span className="pill" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>{history.length}</span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${historyOpen ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} />
          </button>
          {historyOpen && (
            <div className="max-h-72 overflow-y-auto" style={{ borderTop: "1px solid var(--border-subtle)" }}>
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
                    className="w-full flex items-start gap-3 px-5 py-3 text-left transition-colors"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(128,30,130,0.08)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-fc-purple-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                        {h.query}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {scopeParts.length > 0 && (
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{scopeParts.join(" · ")}</span>
                        )}
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {new Date(h.created_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                    <RotateCcw className="w-3 h-3 shrink-0 mt-1" style={{ color: "var(--text-muted)" }} />
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
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>{result.summary}</p>
            <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
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
                  <li key={i} className="flex gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <span className="shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center mt-0.5"
                          style={{ background: "rgba(128,30,130,0.2)", color: "#c248c4" }}>
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
