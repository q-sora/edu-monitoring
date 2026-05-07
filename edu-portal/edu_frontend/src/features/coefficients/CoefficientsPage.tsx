// features/coefficients/CoefficientsPage.tsx
// Система коэффициентов оценки образовательных организаций

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, BarChart3, CheckCircle, ChevronDown,
  Loader2, RefreshCw, Save, TrendingDown, TrendingUp,
} from "lucide-react";
import client from "@/api/client";
import { useAuth } from "@/auth/AuthContext";

interface Region { id: number; name_ru: string; type: string; }

function useRegions() {
  const [regions, setRegions] = useState<Region[]>([]);
  useEffect(() => {
    client.get<Region[]>("/admin/references/regions")
      .then(r => setRegions(r.data))
      .catch(() => {});
  }, []);
  return regions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CoefficientDef {
  id: number;
  code: string;
  education_level: string;
  principle: string;
  number: number;
  name_ru: string;
  formula_text: string;
  formula_type: string;
  numerator_desc?: string;
  denominator_desc?: string;
  norm_min?: number;
  norm_max?: number;
  norm_target?: number;
}

interface CoefficientRecord {
  id: number;
  org_id: string;
  coeff_def_id: number;
  period_year: number;
  numerator_value?: number;
  denominator_value?: number;
  coefficient_value?: number;
  status: string;
  submission_status: string;
  definition?: CoefficientDef;
}

interface Score {
  org_id: string;
  education_level: string;
  period_year: number;
  score_transparency?: number;
  score_self_development?: number;
  score_financial_stability?: number;
  score_safety?: number;
  score_investment_appeal?: number;
  total_score?: number;
  rating_category?: string;
}

interface RatingEntry {
  org_id: string;
  org_name: string;
  region_id?: number;
  region_name_ru?: string;
  education_level: string;
  period_year: number;
  total_score?: number;
  rating_category?: string;
  score_transparency?: number;
  score_self_development?: number;
  score_financial_stability?: number;
  score_safety?: number;
  score_investment_appeal?: number;
  prev_total_score?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const LEVELS = [
  { code: "DO",   label: "Дошкольное образование",                  prefix: "Кдо"  },
  { code: "SO",   label: "Среднее образование",                      prefix: "Ксо"  },
  { code: "TPPO", label: "ТиППО",                                    prefix: "Ктпп" },
  { code: "VIPO", label: "ВиПО",                                     prefix: "Квпо" },
  { code: "DOP",  label: "Дополнительное образование",               prefix: "Кдоп" },
];

const PRINCIPLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  transparency:          { label: "Прозрачность",                    color: "text-fc-blue-600",   bg: "bg-fc-blue-50",   border: "border-fc-blue-200"   },
  self_development:      { label: "Саморазвитие",                    color: "text-fc-cyan-600",   bg: "bg-fc-cyan-50",   border: "border-fc-cyan-200"   },
  financial_stability:   { label: "Финансовая устойчивость",         color: "text-fc-navy-700",   bg: "bg-fc-navy-50",   border: "border-fc-navy-200"   },
  safety:                { label: "Безопасность",                    color: "text-fc-steel-600",  bg: "bg-fc-steel-50",  border: "border-fc-steel-200"  },
  investment_appeal:     { label: "Инвестиционная привлекательность",color: "text-fc-purple-600", bg: "bg-fc-purple-50", border: "border-fc-purple-200" },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  excellent: { label: "Отлично",   bg: "bg-emerald-50",  text: "text-emerald-700" },
  normal:    { label: "Норма",     bg: "bg-fc-blue-50",  text: "text-fc-blue-700" },
  warning:   { label: "Внимание",  bg: "bg-amber-50",    text: "text-amber-700"   },
  critical:  { label: "Критично",  bg: "bg-red-50",      text: "text-red-700"     },
};

const CATEGORY_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300" },
  B: { bg: "bg-fc-blue-100", text: "text-fc-blue-800", border: "border-fc-blue-300" },
  C: { bg: "bg-amber-100",   text: "text-amber-800",   border: "border-amber-300"   },
  D: { bg: "bg-red-100",     text: "text-red-800",     border: "border-red-300"     },
};

const YEARS = [2025, 2024, 2023, 2022, 2021, 2020];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(v?: number, dp = 3) {
  if (v === undefined || v === null) return "—";
  return Number(v).toFixed(dp);
}

function scoreColor(s?: number) {
  if (!s) return "text-slate-400";
  if (s >= 75) return "text-emerald-600";
  if (s >= 50) return "text-amber-600";
  return "text-red-600";
}

function scoreBg(s?: number) {
  if (!s) return "bg-slate-100";
  if (s >= 75) return "bg-emerald-50 border-emerald-200";
  if (s >= 50) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

// Simple SVG radar chart (no external dependency)
function RadarChart({ scores }: { scores: Score }) {
  const dims = [
    { key: "score_transparency",        label: "Прозрач." },
    { key: "score_self_development",    label: "Саморазв." },
    { key: "score_financial_stability", label: "Фин.уст." },
    { key: "score_safety",              label: "Безопас." },
    { key: "score_investment_appeal",   label: "Инвест." },
  ];

  const n = dims.length;
  const cx = 150, cy = 150, r = 100;
  const angleStep = (2 * Math.PI) / n;

  function polar(i: number, radius: number) {
    const a = i * angleStep - Math.PI / 2;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  }

  const gridLevels = [20, 40, 60, 80, 100];

  const dataPoints = dims.map((d, i) => {
    const val = ((scores as any)[d.key] ?? 0) / 100;
    return polar(i, r * val);
  });

  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";

  const axisLines = dims.map((_, i) => {
    const end = polar(i, r);
    return `M${cx},${cy} L${end.x},${end.y}`;
  });

  return (
    <svg viewBox="0 0 300 300" className="w-full max-w-xs mx-auto">
      {gridLevels.map(lvl => {
        const pts = dims.map((_, i) => polar(i, r * lvl / 100));
        const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";
        return <path key={lvl} d={path} fill="none" stroke="#e2e8f0" strokeWidth="1" />;
      })}
      {axisLines.map((d, i) => (
        <path key={i} d={d} stroke="#cbd5e1" strokeWidth="1" />
      ))}
      <path d={dataPath} fill="rgba(0,104,180,0.15)" stroke="#0068b4" strokeWidth="2" />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill="#0068b4" />
      ))}
      {dims.map((d, i) => {
        const label = polar(i, r + 22);
        return (
          <text key={i} x={label.x} y={label.y} textAnchor="middle"
            dominantBaseline="middle" fontSize="10" fill="#64748b">
            {d.label}
          </text>
        );
      })}
      {gridLevels.filter(l => l % 40 === 0).map(lvl => {
        const p = polar(0, r * lvl / 100);
        return <text key={lvl} x={p.x + 3} y={p.y} fontSize="8" fill="#94a3b8">{lvl}</text>;
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Data Entry
// ─────────────────────────────────────────────────────────────────────────────

function DataEntryTab({ orgId }: { orgId: string }) {
  const [level, setLevel] = useState("VIPO");
  const [year, setYear] = useState(2025);
  const [defs, setDefs] = useState<CoefficientDef[]>([]);
  const [records, setRecords] = useState<Map<number, CoefficientRecord>>(new Map());
  const [inputs, setInputs] = useState<Map<number, { num: string; den: string }>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [expandedPrinciple, setExpandedPrinciple] = useState<string | null>("transparency");

  const loadDefs = useCallback(async () => {
    setLoading(true);
    try {
      const [defsResp, recsResp] = await Promise.all([
        client.get<CoefficientDef[]>(`/coefficients/definitions/${level}`),
        client.get<CoefficientRecord[]>(`/organisations/${orgId}/coefficients/${year}?education_level=${level}`),
      ]);
      setDefs(defsResp.data);
      const recMap = new Map<number, CoefficientRecord>();
      const inpMap = new Map<number, { num: string; den: string }>();
      recsResp.data.forEach(r => {
        recMap.set(r.coeff_def_id, r);
        inpMap.set(r.coeff_def_id, {
          num: r.numerator_value !== undefined && r.numerator_value !== null ? String(r.numerator_value) : "",
          den: r.denominator_value !== undefined && r.denominator_value !== null ? String(r.denominator_value) : "",
        });
      });
      setRecords(recMap);
      setInputs(inpMap);
    } catch {
      setDefs([]);
    } finally {
      setLoading(false);
    }
  }, [level, year, orgId]);

  useEffect(() => { loadDefs(); }, [loadDefs]);

  async function saveOne(defId: number) {
    const inp = inputs.get(defId) ?? { num: "0", den: "1" };
    setSaving(defId);
    try {
      const resp = await client.post<CoefficientRecord>(`/organisations/${orgId}/coefficients`, {
        org_id: orgId,
        coeff_def_id: defId,
        period_year: year,
        period_quarter: null,
        numerator_value: parseFloat(inp.num) || 0,
        denominator_value: parseFloat(inp.den) || 1,
      });
      setRecords(prev => new Map(prev).set(defId, resp.data));
    } finally {
      setSaving(null);
    }
  }

  async function saveAll() {
    setSaving(-1);
    for (const def of defs) {
      const inp = inputs.get(def.id) ?? { num: "0", den: "1" };
      if (!inp.num && !inp.den) continue;
      await client.post(`/organisations/${orgId}/coefficients`, {
        org_id: orgId,
        coeff_def_id: def.id,
        period_year: year,
        period_quarter: null,
        numerator_value: parseFloat(inp.num) || 0,
        denominator_value: parseFloat(inp.den) || 1,
      });
    }
    await loadDefs();
    setSaving(null);
  }

  async function calculateAll() {
    setCalculating(true);
    try {
      await client.post(`/organisations/${orgId}/coefficients/${year}/calculate`);
      await loadDefs();
    } finally {
      setCalculating(false);
    }
  }

  const byPrinciple = defs.reduce((acc, d) => {
    acc[d.principle] = acc[d.principle] || [];
    acc[d.principle].push(d);
    return acc;
  }, {} as Record<string, CoefficientDef[]>);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1">
          <span className="label-eyebrow">Уровень образования</span>
          <select className="input w-56"
            value={level} onChange={e => setLevel(e.target.value)}>
            {LEVELS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="label-eyebrow">Год</span>
          <select className="input w-24"
            value={year} onChange={e => setYear(Number(e.target.value))}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex items-end gap-2 ml-auto">
          <button className="btn-secondary flex items-center gap-1.5"
            onClick={calculateAll} disabled={calculating}>
            {calculating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Рассчитать
          </button>
          <button className="btn-primary flex items-center gap-1.5"
            onClick={saveAll} disabled={saving === -1}>
            {saving === -1 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Сохранить все
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-fc-steel-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Загрузка…</span>
        </div>
      ) : (
        Object.entries(PRINCIPLES).map(([pKey, pCfg]) => {
          const pDefs = byPrinciple[pKey] || [];
          if (!pDefs.length) return null;
          const isOpen = expandedPrinciple === pKey;

          return (
            <div key={pKey} className={`rounded-lg border ${pCfg.border} overflow-hidden`}>
              <button
                className={`w-full flex items-center justify-between px-4 py-3 ${pCfg.bg} hover:brightness-95 transition-all`}
                onClick={() => setExpandedPrinciple(isOpen ? null : pKey)}
              >
                <div className="flex items-center gap-2">
                  <span className={`font-semibold text-sm ${pCfg.color}`}>{pCfg.label}</span>
                  <span className="text-xs text-fc-steel-500">{pDefs.length} показателей</span>
                </div>
                <ChevronDown className={`w-4 h-4 ${pCfg.color} transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="divide-y divide-slate-100">
                  {pDefs.map(def => {
                    const rec = records.get(def.id);
                    const inp = inputs.get(def.id) ?? { num: "", den: "" };
                    const stCfg = STATUS_CONFIG[rec?.status ?? "normal"];

                    return (
                      <div key={def.id} className="px-4 py-3 bg-white hover:bg-slate-50 grid grid-cols-12 gap-3 items-center">
                        {/* Code + name */}
                        <div className="col-span-5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-fc-navy-700 bg-fc-navy-50 px-1.5 py-0.5 rounded">
                              {def.code}
                            </span>
                            {rec?.status && (
                              <span className={`pill ${stCfg.bg} ${stCfg.text}`}>{stCfg.label}</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-700 mt-1 leading-tight">{def.name_ru}</p>
                          <p className="text-xs text-fc-steel-500 mt-0.5 font-mono">{def.formula_text}</p>
                        </div>

                        {/* Numerator */}
                        <div className="col-span-2">
                          <label className="label-eyebrow text-[9px]">
                            {def.numerator_desc ? def.numerator_desc.slice(0, 20) + "…" : "Числитель"}
                          </label>
                          {def.formula_type === "boolean" ? (
                            <select className="input text-xs py-1"
                              value={inp.num}
                              onChange={e => setInputs(prev => new Map(prev).set(def.id, { ...inp, num: e.target.value }))}>
                              <option value="1">Да (1)</option>
                              <option value="0">Нет (0)</option>
                            </select>
                          ) : (
                            <input className="input text-xs py-1 tabular-nums" type="number" step="any"
                              value={inp.num}
                              onChange={e => setInputs(prev => new Map(prev).set(def.id, { ...inp, num: e.target.value }))} />
                          )}
                        </div>

                        {/* Denominator */}
                        {def.formula_type !== "boolean" && (
                          <div className="col-span-2">
                            <label className="label-eyebrow text-[9px]">
                              {def.denominator_desc ? def.denominator_desc.slice(0, 20) + "…" : "Знаменатель"}
                            </label>
                            <input className="input text-xs py-1 tabular-nums" type="number" step="any"
                              value={inp.den}
                              onChange={e => setInputs(prev => new Map(prev).set(def.id, { ...inp, den: e.target.value }))} />
                          </div>
                        )}
                        {def.formula_type === "boolean" && <div className="col-span-2" />}

                        {/* Calculated value */}
                        <div className="col-span-2 text-center">
                          <p className="label-eyebrow text-[9px]">Значение</p>
                          <p className={`text-sm font-bold tabular-nums ${
                            rec?.status === "excellent" ? "text-emerald-600" :
                            rec?.status === "warning"   ? "text-amber-600" :
                            rec?.status === "critical"  ? "text-red-600" : "text-fc-navy-700"
                          }`}>
                            {rec?.coefficient_value !== undefined && rec.coefficient_value !== null
                              ? fmt(Number(rec.coefficient_value), 4)
                              : "—"}
                          </p>
                          <p className="text-[9px] text-fc-steel-500 mt-0.5">
                            {def.norm_target !== undefined && def.norm_target !== null ? `цель: ${def.norm_target}` :
                             def.norm_min !== undefined && def.norm_min !== null && def.norm_max !== undefined && def.norm_max !== null
                               ? `${def.norm_min}–${def.norm_max}` :
                             def.norm_min !== undefined && def.norm_min !== null ? `≥ ${def.norm_min}` :
                             def.norm_max !== undefined && def.norm_max !== null ? `≤ ${def.norm_max}` : ""}
                          </p>
                        </div>

                        {/* Save button */}
                        <div className="col-span-1 flex justify-end">
                          <button
                            className="p-1.5 rounded hover:bg-fc-navy-50 text-fc-steel-500 hover:text-fc-navy-700 transition-colors"
                            onClick={() => saveOne(def.id)}
                            disabled={saving === def.id}
                            title="Сохранить">
                            {saving === def.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Save className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Results
// ─────────────────────────────────────────────────────────────────────────────

function ResultsTab({ orgId }: { orgId: string }) {
  const [year, setYear] = useState(2025);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    client.get<Score[]>(`/organisations/${orgId}/coefficients/${year}/scores`)
      .then(r => setScores(r.data))
      .catch(() => setScores([]))
      .finally(() => setLoading(false));
  }, [orgId, year]);

  const principleKeys = [
    { key: "score_transparency",        label: "Прозрачность",                    color: "bg-fc-blue-500"   },
    { key: "score_self_development",    label: "Саморазвитие",                    color: "bg-fc-cyan-500"   },
    { key: "score_financial_stability", label: "Финансовая устойчивость",         color: "bg-fc-navy-700"   },
    { key: "score_safety",              label: "Безопасность",                    color: "bg-fc-steel-500"  },
    { key: "score_investment_appeal",   label: "Инвестиционная привлекательность",color: "bg-fc-purple-500" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <label className="label-eyebrow">Год</label>
        <select className="input w-24" value={year} onChange={e => setYear(Number(e.target.value))}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-fc-steel-500">
          <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Загрузка…</span>
        </div>
      ) : scores.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
          <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-fc-navy-900">Данные не рассчитаны</p>
          <p className="text-xs text-fc-steel-500 mt-1">Введите данные на вкладке «Ввод» и нажмите «Рассчитать»</p>
        </div>
      ) : (
        scores.map(score => {
          const catCfg = CATEGORY_CONFIG[score.rating_category ?? ""] ?? {};
          return (
            <div key={score.education_level} className="card p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-fc-navy-900">
                    {LEVELS.find(l => l.code === score.education_level)?.label ?? score.education_level}
                  </h3>
                  <p className="text-xs text-fc-steel-500 mt-0.5">{score.period_year} год</p>
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${catCfg.bg ?? ""} ${catCfg.border ?? ""}`}>
                    <span className={`text-3xl font-black font-display ${catCfg.text ?? "text-slate-700"}`}>
                      {score.rating_category ?? "—"}
                    </span>
                    <div>
                      <p className={`text-lg font-bold tabular-nums ${catCfg.text ?? "text-slate-700"}`}>
                        {score.total_score !== undefined && score.total_score !== null ? Number(score.total_score).toFixed(1) : "—"}
                      </p>
                      <p className="text-[10px] text-fc-steel-500">из 100</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Radar */}
                <div className="flex items-center justify-center">
                  <RadarChart scores={score} />
                </div>
                {/* Principle cards */}
                <div className="space-y-2">
                  {principleKeys.map(pk => {
                    const val = (score as any)[pk.key] as number | undefined;
                    const pct = val !== undefined && val !== null ? Number(val) : 0;
                    return (
                      <div key={pk.key} className={`rounded-lg border p-3 ${scoreBg(pct)}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-fc-navy-800">{pk.label}</span>
                          <span className={`text-sm font-bold tabular-nums ${scoreColor(pct)}`}>
                            {val !== undefined && val !== null ? Number(val).toFixed(1) : "—"}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/70 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pk.color} transition-all`}
                            style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Rating
// ─────────────────────────────────────────────────────────────────────────────

type RatingView = "table" | "byRegion";

interface RegionSummary {
  region_id: number | null;
  region_name_ru: string;
  orgs: RatingEntry[];
  avg_score: number | null;
  categories: Record<string, number>;
}

function buildRegionSummaries(entries: RatingEntry[]): RegionSummary[] {
  const map = new Map<number | null, RatingEntry[]>();
  for (const e of entries) {
    const key = e.region_id ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  const summaries: RegionSummary[] = [];
  map.forEach((orgs, region_id) => {
    const withScore = orgs.filter(o => o.total_score !== undefined && o.total_score !== null);
    const avg_score = withScore.length
      ? withScore.reduce((s, o) => s + Number(o.total_score), 0) / withScore.length
      : null;
    const categories: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const o of orgs) if (o.rating_category) categories[o.rating_category] = (categories[o.rating_category] ?? 0) + 1;
    summaries.push({
      region_id,
      region_name_ru: orgs[0]?.region_name_ru ?? "Без региона",
      orgs: [...orgs].sort((a, b) => (Number(b.total_score) || 0) - (Number(a.total_score) || 0)),
      avg_score,
      categories,
    });
  });
  return summaries.sort((a, b) => (b.avg_score ?? -1) - (a.avg_score ?? -1));
}

function RatingTab() {
  const [year, setYear] = useState(2025);
  const [level, setLevel] = useState("");
  const [regionId, setRegionId] = useState<number | "">("");
  const [ratings, setRatings] = useState<RatingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState<keyof RatingEntry>("total_score");
  const [view, setView] = useState<RatingView>("table");
  const [expandedRegion, setExpandedRegion] = useState<number | null | "ALL">("ALL");
  const regions = useRegions();

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (level)           params.set("education_level", level);
    if (regionId !== "") params.set("region_id", String(regionId));
    const qs = params.toString();
    client.get<RatingEntry[]>(`/coefficients/ratings/${year}${qs ? `?${qs}` : ""}`)
      .then(r => setRatings(r.data))
      .catch(() => setRatings([]))
      .finally(() => setLoading(false));
  }, [year, level, regionId]);

  const sorted = [...ratings].sort((a, b) => {
    const av = (a as any)[sortField] ?? -Infinity;
    const bv = (b as any)[sortField] ?? -Infinity;
    return bv - av;
  });

  const regionSummaries = buildRegionSummaries(ratings);
  const showRegionCol = regionId === "";

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1">
          <span className="label-eyebrow">Год</span>
          <select className="input w-24" value={year} onChange={e => setYear(Number(e.target.value))}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="label-eyebrow">Уровень</span>
          <select className="input w-52" value={level} onChange={e => setLevel(e.target.value)}>
            <option value="">Все уровни</option>
            {LEVELS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="label-eyebrow">Область / город</span>
          <select
            className="input w-52"
            value={regionId}
            onChange={e => {
              setRegionId(e.target.value === "" ? "" : Number(e.target.value));
              if (e.target.value !== "") setView("table");
            }}
          >
            <option value="">Все регионы</option>
            {regions
              .filter(r => r.type === "city")
              .map(r => <option key={r.id} value={r.id}>{r.name_ru}</option>)}
            {regions
              .filter(r => r.type === "oblast")
              .map(r => <option key={r.id} value={r.id}>{r.name_ru}</option>)}
          </select>
        </div>

        {/* View toggle — only when all regions */}
        {regionId === "" && (
          <div className="flex flex-col gap-1 ml-auto">
            <span className="label-eyebrow">Вид</span>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              <button
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === "table" ? "bg-fc-navy-700 text-white" : "bg-white text-fc-steel-500 hover:text-fc-navy-700"}`}
                onClick={() => setView("table")}
              >
                Список
              </button>
              <button
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === "byRegion" ? "bg-fc-navy-700 text-white" : "bg-white text-fc-steel-500 hover:text-fc-navy-700"}`}
                onClick={() => setView("byRegion")}
              >
                По регионам
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-fc-steel-500">
          <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Загрузка…</span>
        </div>
      ) : view === "byRegion" ? (
        /* ── By-region view ─────────────────────────────────────────── */
        <div className="space-y-3">
          {regionSummaries.length === 0 ? (
            <div className="py-12 text-center text-sm text-fc-steel-500">Нет данных</div>
          ) : regionSummaries.map(rs => {
            const isOpen = expandedRegion === "ALL" || expandedRegion === rs.region_id;
            return (
              <div key={rs.region_id ?? "null"} className="rounded-lg border border-slate-200 overflow-hidden">
                {/* Region header */}
                <button
                  className="w-full flex items-center justify-between px-4 py-3 bg-fc-navy-50 hover:bg-fc-navy-100 transition-colors"
                  onClick={() => setExpandedRegion(isOpen ? -999 : rs.region_id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-fc-navy-900">{rs.region_name_ru}</span>
                    <span className="text-xs text-fc-steel-500">{rs.orgs.length} орг.</span>
                    <div className="flex gap-1">
                      {(["A","B","C","D"] as const).map(cat => rs.categories[cat] > 0 ? (
                        <span key={cat} className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${CATEGORY_CONFIG[cat].bg} ${CATEGORY_CONFIG[cat].text} ${CATEGORY_CONFIG[cat].border}`}>
                          {cat}:{rs.categories[cat]}
                        </span>
                      ) : null)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {rs.avg_score !== null && (
                      <span className={`text-sm font-bold tabular-nums ${scoreColor(rs.avg_score)}`}>
                        ср. {rs.avg_score.toFixed(1)}
                      </span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-fc-steel-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {/* Org list */}
                {isOpen && (
                  <div className="divide-y divide-slate-100">
                    {rs.orgs.map((r, idx) => {
                      const catCfg = CATEGORY_CONFIG[r.rating_category ?? ""] ?? {};
                      const delta = r.total_score !== undefined && r.prev_total_score !== undefined
                        ? Number(r.total_score) - Number(r.prev_total_score) : null;
                      return (
                        <div key={`${r.org_id}-${r.education_level}`}
                          className="grid grid-cols-12 gap-2 items-center px-4 py-2 bg-white hover:bg-slate-50 text-sm">
                          <div className="col-span-1 text-xs text-fc-steel-500 tabular-nums">{idx + 1}</div>
                          <div className="col-span-5 font-medium text-fc-navy-900 truncate">{r.org_name}</div>
                          <div className="col-span-2 text-xs text-fc-steel-500">
                            {LEVELS.find(l => l.code === r.education_level)?.prefix ?? r.education_level}
                          </div>
                          <div className={`col-span-2 text-right font-bold tabular-nums ${scoreColor(r.total_score !== undefined ? Number(r.total_score) : undefined)}`}>
                            {r.total_score !== undefined && r.total_score !== null ? Number(r.total_score).toFixed(1) : "—"}
                          </div>
                          <div className="col-span-1 text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold border ${catCfg.bg ?? ""} ${catCfg.text ?? ""} ${catCfg.border ?? ""}`}>
                              {r.rating_category ?? "—"}
                            </span>
                          </div>
                          <div className="col-span-1 text-right text-xs tabular-nums">
                            {delta !== null ? (
                              <span className={`flex items-center justify-end gap-0.5 ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-slate-400"}`}>
                                {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                              </span>
                            ) : "—"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Flat table view ─────────────────────────────────────────── */
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="text-left">#</th>
                <th className="text-left">Организация</th>
                {showRegionCol && <th className="text-left">Регион</th>}
                <th className="text-left">Уровень</th>
                <th className="text-right cursor-pointer hover:text-fc-navy-900"
                  onClick={() => setSortField("total_score")}>
                  Итог {sortField === "total_score" ? "▼" : ""}
                </th>
                <th className="text-center">Кат.</th>
                <th className="text-right cursor-pointer hover:text-fc-navy-900"
                  onClick={() => setSortField("score_transparency")}>
                  Проз. {sortField === "score_transparency" ? "▼" : ""}
                </th>
                <th className="text-right cursor-pointer hover:text-fc-navy-900"
                  onClick={() => setSortField("score_self_development")}>
                  Саморазв. {sortField === "score_self_development" ? "▼" : ""}
                </th>
                <th className="text-right cursor-pointer hover:text-fc-navy-900"
                  onClick={() => setSortField("score_financial_stability")}>
                  Фин.уст. {sortField === "score_financial_stability" ? "▼" : ""}
                </th>
                <th className="text-right cursor-pointer hover:text-fc-navy-900"
                  onClick={() => setSortField("score_safety")}>
                  Безопас. {sortField === "score_safety" ? "▼" : ""}
                </th>
                <th className="text-right cursor-pointer hover:text-fc-navy-900"
                  onClick={() => setSortField("score_investment_appeal")}>
                  Инвест. {sortField === "score_investment_appeal" ? "▼" : ""}
                </th>
                <th className="text-right">Δ к пр.году</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, idx) => {
                const catCfg = CATEGORY_CONFIG[r.rating_category ?? ""] ?? {};
                const delta = r.total_score !== undefined && r.prev_total_score !== undefined
                  ? Number(r.total_score) - Number(r.prev_total_score) : null;
                return (
                  <tr key={`${r.org_id}-${r.education_level}`}>
                    <td className="text-fc-steel-500 text-xs">{idx + 1}</td>
                    <td className="font-medium text-fc-navy-900 max-w-xs truncate">{r.org_name}</td>
                    {showRegionCol && (
                      <td className="text-xs text-fc-steel-500 whitespace-nowrap">{r.region_name_ru ?? "—"}</td>
                    )}
                    <td className="text-xs text-fc-steel-500">
                      {LEVELS.find(l => l.code === r.education_level)?.prefix ?? r.education_level}
                    </td>
                    <td className={`text-right font-bold tabular-nums ${scoreColor(r.total_score !== undefined ? Number(r.total_score) : undefined)}`}>
                      {r.total_score !== undefined && r.total_score !== null ? Number(r.total_score).toFixed(1) : "—"}
                    </td>
                    <td className="text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${catCfg.bg ?? ""} ${catCfg.text ?? ""} ${catCfg.border ?? ""}`}>
                        {r.rating_category ?? "—"}
                      </span>
                    </td>
                    {(["score_transparency","score_self_development","score_financial_stability","score_safety","score_investment_appeal"] as const).map(k => (
                      <td key={k} className={`text-right text-xs tabular-nums ${scoreColor((r as any)[k] !== undefined ? Number((r as any)[k]) : undefined)}`}>
                        {(r as any)[k] !== undefined && (r as any)[k] !== null ? Number((r as any)[k]).toFixed(1) : "—"}
                      </td>
                    ))}
                    <td className="text-right text-xs tabular-nums">
                      {delta !== null ? (
                        <span className={`flex items-center justify-end gap-0.5 ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-slate-400"}`}>
                          {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                          {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sorted.length === 0 && (
            <div className="py-12 text-center text-sm text-fc-steel-500">
              Нет данных для выбранного периода
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function CoefficientsPage() {
  const { user } = useAuth();
  const isAdminRole = ["admin", "superadmin"].includes(user?.role ?? "");
  const orgId = user?.org_id ?? "";
  const [tab, setTab] = useState<"entry" | "results" | "rating">(
    isAdminRole ? "rating" : "results"
  );

  const tabs = [
    { key: "results" as const, label: "Результаты",  hidden: isAdminRole || !orgId },
    { key: "entry"   as const, label: "Ввод данных", hidden: isAdminRole || !orgId || !["data_entry", "admin", "superadmin"].includes(user?.role ?? "") },
    { key: "rating"  as const, label: "Рейтинг" },
  ].filter(t => !t.hidden);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-fc-navy-900 tracking-tight">
            Коэффициенты оценки
          </h1>
          <p className="text-sm text-fc-steel-500 mt-1">
            Мониторинг образовательных организаций по 5 принципам · аналог пруденциальных нормативов
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-100">
        <div className="flex gap-0 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.key
                  ? "border-fc-navy-700 text-fc-navy-700"
                  : "border-transparent text-fc-steel-500 hover:text-fc-navy-700"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div>
        {tab === "entry"   && <DataEntryTab orgId={orgId} />}
        {tab === "results" && <ResultsTab orgId={orgId} />}
        {tab === "rating"  && <RatingTab />}
      </div>
    </div>
  );
}
