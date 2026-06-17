// src/features/roi/RoiGraduatePage.tsx
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/ui";

// ── Constants (same as reference) ─────────────────────────────────────────────
const WORK    = 35;
const TAX     = 0.21;
const POVERTY = 47; // тыс тг прожиточный минимум

const LEVELS = [
  { key: "tvet",   label: "ТиПО",     cost: 4.2,  salary: 180, match: 42 },
  { key: "bach",   label: "Бакалавр", cost: 6.0,  salary: 320, match: 55 },
  { key: "master", label: "Магистр",  cost: 3.2,  salary: 520, match: 62 },
] as const;
type LevelKey = typeof LEVELS[number]["key"];

// ── Calc (mirrors reference calcROI exactly) ───────────────────────────────────
function calcROI(cost: number, salary: number, match: number) {
  const annualTax = Math.round(salary * 12 * TAX / 1000 * 100) / 100;      // млн тг/год
  const payback   = annualTax > 0
    ? Math.round(cost / annualTax * 10) / 10
    : 999;
  const lifetime  = Math.round(annualTax * WORK * 10) / 10;                 // млн тг за 35 лет
  const roi       = Math.round(lifetime / cost * 10) / 10;
  const added     = Math.max(0, salary - POVERTY) * 12 / 1000 * WORK;
  const bonus     = (match / 100) * added * 0.3;
  return {
    annualTax,
    payback,
    lifetime,
    roi,
    added: Math.round((added + bonus) * 10) / 10,
  };
}

// ── Status (same thresholds as reference) ─────────────────────────────────────
function statusInfo(payback: number) {
  if (payback <= 8)  return { bg: "#E1F5EE", border: "#9FE1CB", color: "#1D9E75", title: "Эффективно",  sub: "Инвестиция в образование полностью оправдана" };
  if (payback <= 15) return { bg: "#FAEEDA", border: "#FAC775", color: "#854F0B", title: "Приемлемо",   sub: "Приемлемо, но есть резерв для роста зарплат выпускников" };
  return               { bg: "#FCEBEB", border: "#F09595", color: "#A32D2D", title: "Критично",    sub: "Вложения окупаются слишком долго или не окупаются вовсе" };
}

function paybackColor(payback: number) {
  if (payback <= 8)  return { col: "#1D9E75", bg: "#E1F5EE", border: "#9FE1CB" };
  if (payback <= 15) return { col: "#BA7517", bg: "#FAEEDA", border: "#FAC775" };
  return               { col: "#A32D2D", bg: "#FCEBEB", border: "#F09595" };
}

// ── Timeline (bar chart by year) ──────────────────────────────────────────────

function Timeline({ payback }: { payback: number }) {
  const years = Array.from({ length: WORK }, (_, i) => i + 1);
  const pb = Math.min(payback, WORK);

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[2px] min-w-[560px] h-10">
        {years.map(y => {
          const inPayback = y <= Math.ceil(pb);
          const isEdge    = y === Math.ceil(pb);
          return (
            <div
              key={y}
              className="flex-1 rounded-sm transition-colors"
              style={{
                background: inPayback
                  ? isEdge ? "#FECACA" : "#FCA5A5"
                  : "#86EFAC",
              }}
              title={`Год ${y}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 min-w-[560px]">
        <span>0</span>
        <span className="font-semibold" style={{ color: "#A32D2D" }}>
          {payback <= WORK ? `↑ окупаемость ~${payback} лет` : "не окупается за 35 лет"}
        </span>
        <span>{WORK} лет</span>
      </div>
      <div className="flex gap-4 mt-3 flex-wrap">
        <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="inline-block w-4 h-3 rounded-sm" style={{ background: "#FCA5A5" }} />
          Период окупаемости
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="inline-block w-4 h-3 rounded-sm" style={{ background: "#86EFAC" }} />
          Чистый доход государства
        </span>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function RoiGraduatePage() {
  const [level,  setLevel]  = useState<LevelKey>("bach");
  const [cost,   setCost]   = useState(6.0);
  const [salary, setSalary] = useState(320);
  const [match,  setMatch]  = useState(55);

  const r = useMemo(() => calcROI(cost, salary, match), [cost, salary, match]);

  const status = statusInfo(r.payback);
  const pbColor = paybackColor(r.payback);

  function applyLevel(k: LevelKey) {
    const l = LEVELS.find(x => x.key === k)!;
    setLevel(k); setCost(l.cost); setSalary(l.salary); setMatch(l.match);
  }

  // Added value text (same as reference)
  const addedText = match < 50
    ? `Низкий % трудоустройства по специальности снижает потенциал на ${Math.round((1 - match / 100) * 30)}%.`
    : "";

  // Conclusion text (same as reference)
  const concText = r.roi < 2
    ? `При зарплате ${salary} тыс. тг/мес и стоимости обучения ${cost.toFixed(1)} млн тг — государство получает вложенное обратно через ${r.payback} лет, а за всю трудовую жизнь выпускник принесёт в бюджет в ${r.roi}x больше, чем было вложено. Это ниже порога эффективности — нужно либо снизить стоимость обучения, либо повысить трудоустройство.`
    : `При зарплате ${salary} тыс. тг/мес и стоимости обучения ${cost.toFixed(1)} млн тг — государство получает вложенное обратно через ${r.payback} лет, а за всю трудовую жизнь выпускник принесёт в бюджет в ${r.roi}x больше, чем было вложено.`;

  return (
    <>
      <PageHeader
        title="ROI выпускника"
        subtitle="Возврат государственных инвестиций в образование — на уровне одного выпускника"
      />

      <div className="space-y-4 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

          {/* ── Inputs ─────────────────────────────────────────────────────── */}
          <div className="card p-5 space-y-5">
            <div className="text-sm font-bold text-fc-navy-800">Параметры выпускника</div>

            {/* Level buttons */}
            <div>
              <div className="label-eyebrow mb-2">Уровень образования</div>
              <div className="flex gap-2">
                {LEVELS.map(l => (
                  <button
                    key={l.key}
                    onClick={() => applyLevel(l.key)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                      level === l.key
                        ? "bg-fc-navy-800 text-white border-fc-navy-800"
                        : "bg-white text-fc-steel-600 border-slate-200 hover:border-fc-navy-300"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Slider: cost */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-slate-600">Стоимость обучения (млн тг, итого)</span>
                <span className="text-sm font-semibold text-fc-navy-800 tabular-nums">{cost.toFixed(1)} млн тг</span>
              </div>
              <input type="range" min={0.5} max={15} step={0.1} value={cost}
                onChange={e => setCost(Number(e.target.value))}
                className="w-full cursor-pointer accent-fc-navy-700" />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>0.5</span><span>15</span>
              </div>
            </div>

            {/* Slider: salary */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-slate-600">Зарплата выпускника (тыс. тг/мес)</span>
                <span className="text-sm font-semibold text-fc-navy-800 tabular-nums">{salary} тыс. тг</span>
              </div>
              <input type="range" min={80} max={2000} step={10} value={salary}
                onChange={e => setSalary(Number(e.target.value))}
                className="w-full cursor-pointer accent-fc-navy-700" />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>80</span><span>2 000</span>
              </div>
            </div>

            {/* Slider: match */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-slate-600">Трудоустроен по специальности (%)</span>
                <span className="text-sm font-semibold text-fc-navy-800 tabular-nums">{match}%</span>
              </div>
              <input type="range" min={0} max={100} step={1} value={match}
                onChange={e => setMatch(Number(e.target.value))}
                className="w-full cursor-pointer accent-fc-navy-700" />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>0%</span><span>100%</span>
              </div>
            </div>

            {/* Status block */}
            <div className="rounded-xl px-4 py-3"
              style={{ background: status.bg, border: `1px solid ${status.border}` }}>
              <div className="text-sm font-bold" style={{ color: status.color }}>{status.title}</div>
              <div className="text-xs mt-0.5" style={{ color: status.color }}>{status.sub}</div>
            </div>
          </div>

          {/* ── Results ────────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-4">
                <div className="text-[11px] text-slate-500 mb-1">Вложено государством</div>
                <div className="text-xl font-display font-bold text-fc-navy-800 tabular-nums">{cost.toFixed(1)} млн тг</div>
                <div className="text-[11px] text-slate-400 mt-0.5">итого за обучение</div>
              </div>
              <div className="card p-4">
                <div className="text-[11px] text-slate-500 mb-1">Зарплата выпускника</div>
                <div className="text-xl font-display font-bold text-fc-navy-800 tabular-nums">{salary} тыс/мес</div>
                <div className="text-[11px] text-slate-400 mt-0.5">vs прожит. минимум {POVERTY} тыс.</div>
              </div>
              <div className="card p-4">
                <div className="text-[11px] text-slate-500 mb-1">Налоги в год</div>
                <div className="text-xl font-display font-bold tabular-nums" style={{ color: "#1D9E75" }}>
                  {r.annualTax} млн тг
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">ИПН + ЕНПФ + соц.отч.</div>
              </div>
              <div className="card p-4">
                <div className="text-[11px] text-slate-500 mb-1">За {WORK} лет трудовой жизни</div>
                <div className="text-xl font-display font-bold tabular-nums" style={{ color: "#7C3AED" }}>
                  {r.lifetime} млн тг
                </div>
                <div className="text-[11px] font-semibold mt-0.5" style={{ color: "#7C3AED" }}>
                  ROI = ×{r.roi}
                </div>
              </div>
            </div>

            {/* Payback */}
            <div className="card p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-slate-500">Срок окупаемости</span>
                <span
                  className="pill text-xs font-medium"
                  style={{ background: pbColor.bg, color: pbColor.col, border: `1px solid ${pbColor.border}` }}
                >
                  {r.payback <= WORK ? `${r.payback} лет` : "не окупается"}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, r.payback / 30 * 100)}%`,
                    background: pbColor.col,
                  }}
                />
              </div>
            </div>

            {/* Added value */}
            <div className="card p-4">
              <div className="text-[11px] text-slate-500 mb-1.5">Добавленная стоимость</div>
              <div className="text-sm text-slate-800 leading-relaxed">
                За трудовую жизнь выпускник создаёт{" "}
                <strong style={{ color: "#BA7517" }}>{r.added} млн тг</strong>{" "}
                добавленной стоимости сверх прожиточного минимума.
                {addedText && (
                  <span style={{ color: "#A32D2D" }}> {addedText}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Timeline ───────────────────────────────────────────────────────── */}
        <div className="card p-5 overflow-hidden">
          <div className="text-sm font-bold text-fc-navy-800 mb-1">Временная шкала возврата инвестиций</div>
          <Timeline payback={r.payback} />
        </div>

        {/* ── Conclusion ─────────────────────────────────────────────────────── */}
        <div className="rounded-xl px-5 py-4" style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
          <div className="text-sm font-bold text-blue-800 mb-1.5">Главный вывод</div>
          <div className="text-sm text-blue-800 leading-relaxed">
            При зарплате <strong>{salary} тыс. тг/мес</strong> и стоимости обучения{" "}
            <strong>{cost.toFixed(1)} млн тг</strong> — государство получает вложенное обратно через{" "}
            <strong>{r.payback} лет</strong>, а за всю трудовую жизнь выпускник принесёт в бюджет в{" "}
            <strong>{r.roi}x</strong> больше, чем было вложено.
            {r.roi < 2 && (
              <span> Это ниже порога эффективности — нужно либо снизить стоимость обучения, либо повысить трудоустройство.</span>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
