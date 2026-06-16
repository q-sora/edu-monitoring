// src/features/trajectory/TrajectoryPage.tsx
import { useState, useMemo, useEffect } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { useApi } from "@/hooks/useApi";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Org { id: string; name_ru: string; }
interface OrgsResponse { items?: Org[]; }

interface FunnelStep { label: string; n: number; pct: number; note: string; }
interface FunnelData  { total: number; funnel: FunnelStep[]; }

interface PatternCard { count: number; label: string; description: string; }
interface PatternsData {
  total: number;
  fallers: PatternCard;
  risers:  PatternCard;
  dropouts: PatternCard;
  salary_premium: {
    good_gpa_avg_tks: number | null;
    weak_gpa_avg_tks: number | null;
    difference_tks:   number | null;
  };
}

interface ScatterPoint {
  iin_masked: string;
  ent_score:  number | null;
  gpa_year1:  number | null;
  gpa_final:  number | null;
  trajectory: string;
}
interface ScatterData { points: ScatterPoint[]; }

interface TableRow {
  iin_masked:      string;
  ent_score:       number | null;
  gpa_year1:       number | null;
  gpa_final:       number | null;
  trajectory:      string;
  group_label:     string;
  employed:        boolean;
  specialty_match: boolean | null;
  avg_salary_tks:  number | null;
}
interface TableData { total: number; rows: TableRow[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function trajMeta(t: string): { text: string; col: string; bg: string; bd: string } {
  switch (t) {
    case "faller":  return { text: "Падение ↓",  col: "#A32D2D", bg: "#FCEBEB", bd: "#F09595" };
    case "riser":   return { text: "Рост ↑",     col: "#185FA5", bg: "#E6F1FB", bd: "#B5D4F4" };
    case "changed": return { text: "Изменился",  col: "#854F0B", bg: "#FAEEDA", bd: "#FAC775" };
    default:        return { text: "Стабильный", col: "#0F6E56", bg: "#E1F5EE", bd: "#9FE1CB" };
  }
}

function entColor(v: number | null) {
  if (v == null) return "#888780";
  return v >= 100 ? "#0F6E56" : v >= 70 ? "#854F0B" : "#A32D2D";
}
function gpaColor(v: number | null) {
  if (v == null) return "#888780";
  return v >= 4 ? "#0F6E56" : v >= 3 ? "#854F0B" : "#A32D2D";
}

const FUNNEL_COLORS = ["#378ADD", "#1D9E75", "#7F77DD", "#BA7517"];
const FUNNEL_BGS    = ["#E6F1FB", "#E1F5EE", "#EEEDFE", "#FAEEDA"];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

// ─────────────────────────────────────────────────────────────────────────────
// Scatter sub-component
// ─────────────────────────────────────────────────────────────────────────────

function ScatterPlot({ points }: { points: ScatterPoint[] }) {
  const groups = useMemo(() => {
    const g: Record<string, Array<{ x: number; y: number }>> = {
      stable: [], faller: [], riser: [], changed: [],
    };
    for (const p of points) {
      if (p.ent_score == null || p.gpa_year1 == null) continue;
      const key = (p.trajectory in g) ? p.trajectory : "stable";
      g[key].push({ x: p.ent_score, y: p.gpa_year1 });
    }
    return g;
  }, [points]);

  const TRAJ_COLOR: Record<string, string> = {
    stable: "#0F6E56", faller: "#A32D2D", riser: "#185FA5", changed: "#854F0B",
  };
  const TRAJ_LABEL: Record<string, string> = {
    stable: "Стабильный", faller: "Падение ↓ (отличник→слабее)",
    riser:  "Рост ↑ (троечник→лучше)", changed: "Изменился",
  };

  return (
    <div>
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 16, right: 16, bottom: 36, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0ddd6" strokeWidth={0.5} />
          <XAxis
            dataKey="x" type="number" domain={[0, 140]} ticks={[0,20,40,60,80,100,120,140]}
            tick={{ fontSize: 10, fill: "#888780" }}
            label={{ value: "Балл ЕНТ (школа)", position: "insideBottom", offset: -12, fontSize: 11, fill: "#73726c" }}
          />
          <YAxis
            dataKey="y" type="number" domain={[2, 5]} ticks={[2, 2.5, 3, 3.5, 4, 4.5, 5]}
            tick={{ fontSize: 10, fill: "#888780" }}
            label={{ value: "GPA 1-й курс", angle: -90, position: "insideLeft", offset: 12, fontSize: 11, fill: "#73726c" }}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload as { x: number; y: number };
              return (
                <div style={{ background: "#fff", border: "1px solid #E5E9F2", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
                  ЕНТ: <b>{d.x}</b>&nbsp;&nbsp;GPA: <b>{d.y}</b>
                </div>
              );
            }}
          />
          <ReferenceLine x={70}  stroke="#B5D4F4" strokeDasharray="4 3" strokeWidth={1} />
          <ReferenceLine x={100} stroke="#B5D4F4" strokeDasharray="4 3" strokeWidth={1} />
          <ReferenceLine y={3.5} stroke="#B5D4F4" strokeDasharray="4 3" strokeWidth={1} />
          {(Object.entries(groups) as [string, { x: number; y: number }[]][]).map(([key, data]) => (
            <Scatter key={key} data={data} fill={TRAJ_COLOR[key]} fillOpacity={0.73} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
      {/* Legend — matching reference */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginTop: 4 }}>
        {Object.entries(TRAJ_LABEL).map(([key, label]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#73726c" }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: TRAJ_COLOR[key] }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export function TrajectoryPage() {
  const [orgId, setOrgId] = useState<string>("");
  const [year,  setYear]  = useState<number>(CURRENT_YEAR);

  // Orgs list — auto-select first
  const { data: orgsRaw } = useApi<OrgsResponse | Org[]>("/admin/organisations?limit=300");
  const orgs: Org[] = useMemo(() => {
    if (!orgsRaw) return [];
    return Array.isArray(orgsRaw) ? orgsRaw : ((orgsRaw as OrgsResponse).items ?? []);
  }, [orgsRaw]);

  useEffect(() => {
    if (!orgId && orgs.length > 0) setOrgId(orgs[0].id);
  }, [orgs, orgId]);

  const params = orgId ? `?org_id=${orgId}&graduation_year=${year}` : null;

  const { data: funnel,   loading: lF } = useApi<FunnelData>(params   ? `/trajectory/analytics/funnel${params}`   : null, [orgId, year]);
  const { data: scatter,  loading: lS } = useApi<ScatterData>(params  ? `/trajectory/analytics/scatter${params}`  : null, [orgId, year]);
  const { data: patterns, loading: lP } = useApi<PatternsData>(params ? `/trajectory/analytics/patterns${params}` : null, [orgId, year]);
  const { data: table,    loading: lT } = useApi<TableData>(params    ? `/trajectory/analytics/table${params}`    : null, [orgId, year]);

  const loading = lF || lS || lP || lT;
  const hasData = !loading && (funnel?.total ?? 0) > 0;
  const isEmpty = !loading && !!orgId && (funnel?.total ?? 0) === 0;

  const selectedOrg = orgs.find(o => o.id === orgId);

  // Insight derivations
  const fallerPct = useMemo(() => {
    if (!scatter) return 0;
    const honour = scatter.points.filter(p => (p.ent_score ?? 0) >= 100);
    const fallers = honour.filter(p => (p.gpa_year1 ?? 0) < 3.5);
    return honour.length ? Math.round(fallers.length / honour.length * 100) : 0;
  }, [scatter]);

  const riserPct = useMemo(() => {
    if (!scatter) return 0;
    const weak   = scatter.points.filter(p => (p.ent_score ?? 0) < 70);
    const risers = weak.filter(p => (p.gpa_year1 ?? 0) >= 3.8);
    return weak.length ? Math.round(risers.length / weak.length * 100) : 0;
  }, [scatter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Page header + compact filter */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p className="label-eyebrow" style={{ marginBottom: 2 }}>Аналитика платформы ФЦ</p>
          <h1 className="font-display" style={{ fontSize: 22, fontWeight: 900, color: "#19286D", lineHeight: 1.2 }}>
            Траектория учащегося
          </h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select
            className="input"
            style={{ fontSize: 12, padding: "5px 10px", minWidth: 200 }}
            value={orgId}
            onChange={e => setOrgId(e.target.value)}
          >
            {orgs.map(o => <option key={o.id} value={o.id}>{o.name_ru}</option>)}
          </select>
          <select
            className="input"
            style={{ fontSize: 12, padding: "5px 10px" }}
            value={year}
            onChange={e => setYear(Number(e.target.value))}
          >
            {YEARS.map(y => <option key={y} value={y}>{y} год</option>)}
          </select>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {[0,1,2,3].map(i => (
            <div key={i} className="card animate-pulse" style={{ height: 110, background: "#F4F6FA", padding: "20px 20px" }} />
          ))}
        </div>
      )}

      {/* No org */}
      {!orgId && !loading && (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px", color: "#8B93A7" }}>
          <p style={{ fontSize: 14 }}>Нет организаций в системе</p>
          <p style={{ fontSize: 12, marginTop: 6 }}>Загрузите данные через скрипт seed_trajectory.py</p>
        </div>
      )}

      {/* Empty */}
      {isEmpty && (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px", color: "#8B93A7" }}>
          <p style={{ fontSize: 14 }}>Нет данных для {selectedOrg?.name_ru}, {year} год</p>
          <p style={{ fontSize: 12, marginTop: 6 }}>Данные за выбранный год отсутствуют</p>
        </div>
      )}

      {/* ── MAIN CONTENT (matches reference layout) ── */}
      {hasData && (
        <>
          {/* Info card — blue */}
          <div className="card" style={{ background: "#EBF4FF", border: "1px solid #B5D4F4", padding: "16px 20px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#185FA5", marginBottom: 6 }}>
              Образовательный лифт: куда едет студент
            </div>
            <div style={{ fontSize: 13, color: "#185FA5", lineHeight: 1.7 }}>
              Отследить как балл ЕНТ (школа) связан с успеваемостью в вузе/ТиПО, а успеваемость — с зарплатой.
              Если отличник школы скатывается на 1-м курсе — это сигнал не студенту, а школе.
              Если троечник расцветает — это сигнал системе профориентации.
            </div>
          </div>

          {/* 4 Pattern cards */}
          {patterns && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
              <div className="card" style={{ padding: "20px 20px" }}>
                <div style={{ fontSize: 12, color: "#73726c", marginBottom: 4 }}>«Падающие» отличники</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#A32D2D" }}>{patterns.fallers.count}</div>
                <div style={{ fontSize: 11, color: "#A32D2D", marginTop: 2 }}>ЕНТ ≥100, GPA 1-го курса &lt;3.5</div>
                <div style={{ fontSize: 11, color: "#73726c", marginTop: 6, lineHeight: 1.5 }}>
                  Школа завышала оценки <strong>или</strong> профориентация не сработала
                </div>
              </div>
              <div className="card" style={{ padding: "20px 20px" }}>
                <div style={{ fontSize: 12, color: "#73726c", marginBottom: 4 }}>«Растущие» троечники</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#185FA5" }}>{patterns.risers.count}</div>
                <div style={{ fontSize: 11, color: "#185FA5", marginTop: 2 }}>ЕНТ &lt;70, GPA 1-го курса ≥3.8</div>
                <div style={{ fontSize: 11, color: "#73726c", marginTop: 6, lineHeight: 1.5 }}>
                  Школа не раскрыла потенциал <strong>или</strong> специальность точно попала
                </div>
              </div>
              <div className="card" style={{ padding: "20px 20px" }}>
                <div style={{ fontSize: 12, color: "#73726c", marginBottom: 4 }}>Отсев / академотпуск</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#854F0B" }}>{patterns.dropouts.count}</div>
                <div style={{ fontSize: 11, color: "#854F0B", marginTop: 2 }}>GPA итоговый &lt;2.5</div>
                <div style={{ fontSize: 11, color: "#73726c", marginTop: 6, lineHeight: 1.5 }}>
                  Деньги вложены — результата нет. Цена: стоимость обучения без отдачи
                </div>
              </div>
              <div className="card" style={{ padding: "20px 20px" }}>
                <div style={{ fontSize: 12, color: "#73726c", marginBottom: 4 }}>Премия за успеваемость</div>
                {patterns.salary_premium.difference_tks != null ? (
                  <>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#1D9E75" }}>
                      {Math.round(patterns.salary_premium.difference_tks)} тыс.
                    </div>
                    <div style={{ fontSize: 11, color: "#1D9E75", marginTop: 2 }}>GPA ≥4 vs GPA &lt;3 (зарплата)</div>
                  </>
                ) : (
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#8B93A7" }}>—</div>
                )}
                <div style={{ fontSize: 11, color: "#73726c", marginTop: 6, lineHeight: 1.5 }}>
                  Рынок труда платит за знания — не за диплом
                </div>
              </div>
            </div>
          )}

          {/* Scatter chart */}
          {scatter && scatter.points.length > 0 && (
            <div className="card" style={{ padding: "20px 24px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1A2133", marginBottom: 12 }}>
                ЕНТ (школа) → GPA 1-го курса: каждая точка — студент
              </div>
              <ScatterPlot points={scatter.points} />
            </div>
          )}

          {/* Funnel */}
          {funnel && funnel.funnel.length > 0 && (
            <div className="card" style={{ background: "#F8F9FC", border: "1px solid #E5E9F2", padding: "20px 24px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1A2133", marginBottom: 14 }}>
                Воронка когорты: от поступления до работы по специальности
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {funnel.funnel.map((step, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 150, fontSize: 12, color: "#73726c", textAlign: "right", flexShrink: 0 }}>
                      {step.label}
                    </div>
                    <div style={{ flex: 1, height: 32, background: "#f0ede8", borderRadius: 6, overflow: "hidden", position: "relative" }}>
                      <div style={{
                        width: `${step.pct}%`, height: "100%",
                        background: FUNNEL_BGS[i],
                        borderRight: `2px solid ${FUNNEL_COLORS[i]}`,
                        transition: "width 0.5s",
                      }} />
                      <div style={{
                        position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                        fontSize: 12, fontWeight: 600, color: FUNNEL_COLORS[i],
                      }}>
                        {step.n} чел. ({step.pct}%)
                      </div>
                    </div>
                    <div style={{ width: 150, fontSize: 11, color: "#888780", flexShrink: 0 }}>{step.note}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insight */}
          {patterns && scatter && (
            <div className="card" style={{ background: "#EBF4FF", border: "1px solid #B5D4F4", padding: "20px 24px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#185FA5", marginBottom: 8 }}>
                Что это говорит о предыдущем уровне образования
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ padding: "10px 14px", background: "#fff", borderRadius: 8, border: "1px solid #B5D4F4", fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
                  <strong style={{ color: "#A32D2D" }}>Сигнал школе:</strong>{" "}
                  {fallerPct}% отличников школы теряют успеваемость на 1-м курсе.
                  Это значит — школьные оценки не отражают реального уровня знаний. Либо натяжка, либо нет профориентации.
                </div>
                <div style={{ padding: "10px 14px", background: "#fff", borderRadius: 8, border: "1px solid #B5D4F4", fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
                  <strong style={{ color: "#185FA5" }}>Сигнал для профориентации:</strong>{" "}
                  {riserPct}% троечников раскрываются в вузе/ТиПО.
                  Значит, школа не увидела их сильные стороны. Правильный выбор специальности важнее школьных оценок.
                </div>
                <div style={{ padding: "10px 14px", background: "#fff", borderRadius: 8, border: "1px solid #B5D4F4", fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
                  <strong style={{ color: "#854F0B" }}>Сигнал системе:</strong>{" "}
                  Отсев {patterns.dropouts.count} студентов из {patterns.total} = потеря бюджетных средств без отдачи.
                  Каждый отсеявшийся — это ~5.5 млн тг в никуда.
                </div>
              </div>
            </div>
          )}

          {/* Student table */}
          {table && table.rows.length > 0 && (
            <div className="card" style={{ padding: "20px 24px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1A2133", marginBottom: 12 }}>
                Траектории студентов когорты
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e0ddd6" }}>
                      {["Группа","ЕНТ","GPA 1-й курс","GPA итог","Траектория","Зарплата","По профилю"].map(h => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: h === "Группа" ? "left" : "center", color: "#73726c", fontWeight: 500 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, i) => {
                      const tl = trajMeta(row.trajectory);
                      const group = (row.ent_score ?? 0) >= 100 ? "А" : (row.ent_score ?? 0) >= 70 ? "Б" : "В";
                      const groupColor = group === "А" ? "#0F6E56" : group === "Б" ? "#854F0B" : "#185FA5";
                      const groupBg    = group === "А" ? "#E1F5EE" : group === "Б" ? "#FAEEDA" : "#E6F1FB";
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid #f0ede8" }}>
                          <td style={{ padding: "7px 10px" }}>
                            <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: groupBg, color: groupColor }}>
                              {row.group_label}
                            </span>
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 600, color: entColor(row.ent_score) }}>
                            {row.ent_score ?? "—"}
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 600, color: gpaColor(row.gpa_year1) }}>
                            {row.gpa_year1?.toFixed(1) ?? "—"}
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "center", color: gpaColor(row.gpa_final) }}>
                            {row.gpa_final?.toFixed(1) ?? "—"}
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "center" }}>
                            <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: tl.bg, color: tl.col, border: `1px solid ${tl.bd}` }}>
                              {tl.text}
                            </span>
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 600, color: row.employed ? "#1a1a18" : "#888780" }}>
                            {row.employed && row.avg_salary_tks != null ? `${Math.round(row.avg_salary_tks)} тыс.` : "—"}
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "center", color: row.specialty_match ? "#1D9E75" : "#A32D2D" }}>
                            {row.employed ? (row.specialty_match ? "✓" : "✗") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 11, color: "#888780", marginTop: 8 }}>
                Показаны первые 15 из {table.total} студентов когорты. ИИН частично скрыты.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
