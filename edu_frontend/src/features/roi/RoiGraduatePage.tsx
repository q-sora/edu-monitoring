// src/features/roi/RoiGraduatePage.tsx
import { useState, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/ui";

// ── Constants ────────────────────────────────────────────────────────────────
const WORK    = 35; // лет трудовой жизни
const TAX     = 0.21; // ИПН + ЕНПФ + соц.отчисления
const POVERTY = 47; // тыс тг прожиточный минимум в РК

const LEVELS = [
  { key: "tvet",   label: "ТиПО",     cost: 4.2,  salary: 180, match: 42 },
  { key: "bach",   label: "Бакалавр", cost: 6.0,  salary: 320, match: 55 },
  { key: "master", label: "Магистр",  cost: 3.2,  salary: 520, match: 62 },
] as const;
type LevelKey = typeof LEVELS[number]["key"];

// ── ROI Calculation ──────────────────────────────────────────────────────────
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

// ── Status Info ──────────────────────────────────────────────────────────────
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

// ── Timeline Component ───────────────────────────────────────────────────────
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

// ── Main Page Component ──────────────────────────────────────────────────────
export function RoiGraduatePage() {
  const [level,  setLevel]  = useState<LevelKey>("bach");
  const [cost,   setCost]   = useState(6.0);
  const [salary, setSalary] = useState(320);
  const [match,  setMatch]  = useState(55);

  // ── Trajectory and RK Grant States ──
  const [grantTvet, setGrantTvet] = useState(false);
  const [grantTvetSemesters, setGrantTvetSemesters] = useState(6); // max 6 семестров
  const [grantBach, setGrantBach] = useState(true);
  const [grantBachSemesters, setGrantBachSemesters] = useState(8); // max 8 семестров
  const [grantMaster, setGrantMaster] = useState(false);
  const [grantMasterSemesters, setGrantMasterSemesters] = useState(4); // max 4 семестра

  const [monthsWorked, setMonthsWorked] = useState(0); // Фактически отработано (в месяцах)

  // Auto-init grants when primary education level switches (logical baseline)
  function applyLevel(k: LevelKey) {
    setLevel(k);
    const l = LEVELS.find(x => x.key === k)!;
    setSalary(l.salary);
    setMatch(l.match);

    if (k === "tvet") {
      setGrantTvet(true);
      setGrantBach(false);
      setGrantMaster(false);
    } else if (k === "bach") {
      setGrantTvet(false);
      setGrantBach(true);
      setGrantMaster(false);
    } else if (k === "master") {
      setGrantTvet(false);
      setGrantBach(true);
      setGrantMaster(true);
    }
    setMonthsWorked(0);
  }

  // Calculate cumulative education cost from selected trajectory
  useEffect(() => {
    let calculatedCost = 0;
    if (level === "tvet") {
      calculatedCost = grantTvet ? 4.2 * (grantTvetSemesters / 6) : 0;
    } else if (level === "bach") {
      calculatedCost = (grantBach ? 6.0 * (grantBachSemesters / 8) : 0) +
                       (grantTvet ? 4.2 * (grantTvetSemesters / 6) : 0);
    } else if (level === "master") {
      calculatedCost = (grantMaster ? 3.2 * (grantMasterSemesters / 4) : 0) +
                       (grantBach ? 6.0 * (grantBachSemesters / 8) : 0) +
                       (grantTvet ? 4.2 * (grantTvetSemesters / 6) : 0);
    }
    setCost(calculatedCost || 0.5); // fallback to 0.5M KZT if everything is paid
  }, [level, grantTvet, grantTvetSemesters, grantBach, grantBachSemesters, grantMaster, grantMasterSemesters]);

  // ── RK Law Grant Obligations Calculations ──
  const tvetCost = grantTvet ? 4.2 * (grantTvetSemesters / 6) : 0;
  const bachCost = (level === "bach" || level === "master") && grantBach ? 6.0 * (grantBachSemesters / 8) : 0;
  const masterCost = level === "master" && grantMaster ? 3.2 * (grantMasterSemesters / 4) : 0;

  const totalGrantCost = tvetCost + bachCost + masterCost;
  const hasActiveGrant = totalGrantCost > 0;

  // Work obligation durations (proportional to grant duration as per RK law)
  const tvetReq = (level === "tvet" || level === "bach" || level === "master") && grantTvet
    ? Math.round(36 * (grantTvetSemesters / 6))
    : 0;
  const bachReq = (level === "bach" || level === "master") && grantBach
    ? Math.round(36 * (grantBachSemesters / 8))
    : 0;
  const masterReq = level === "master" && grantMaster
    ? Math.round(36 * (grantMasterSemesters / 4))
    : 0;

  // Maximum work obligation is 36 months (obligations run concurrently after graduation)
  const requiredMonths = Math.max(tvetReq, bachReq, masterReq);
  const monthsRemaining = Math.max(0, requiredMonths - monthsWorked);
  const refundAmount = hasActiveGrant && requiredMonths > 0
    ? Math.max(0, (monthsRemaining / requiredMonths) * totalGrantCost)
    : 0;

  // Auto-adjust months worked if it exceeds new required duration limit
  useEffect(() => {
    if (monthsWorked > requiredMonths) {
      setMonthsWorked(requiredMonths);
    }
  }, [requiredMonths, monthsWorked]);

  const r = useMemo(() => calcROI(cost, salary, match), [cost, salary, match]);

  const status = statusInfo(r.payback);
  const pbColor = paybackColor(r.payback);

  const addedText = match < 50
    ? `Низкий % трудоустройства по специальности снижает потенциал на ${Math.round((1 - match / 100) * 30)}%.`
    : "";

  return (
    <>
      <PageHeader
        title="ROI выпускника"
        subtitle="Возврат государственных инвестиций в образование — на уровне одного выпускника"
      />

      <div className="space-y-4 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

          {/* ── Left Column: Inputs & Trajectory ───────────────────────────── */}
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

            {/* Slider: cost (manually adjustable, but synced by default) */}
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

            {/* ── Траектория обучения и грантов (Закон РК) ── */}
            <hr className="border-slate-100 my-4" />
            
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-4">
              <div className="text-xs font-bold text-fc-navy-800 uppercase tracking-wider flex items-center justify-between">
                <span>Конструктор траектории грантов</span>
                <span className="text-[9px] text-slate-400 normal-case font-normal">кликните для изменения</span>
              </div>
              
              <div className="space-y-3">
                {/* 1. ТиПО */}
                <div className={`p-3 rounded-lg border bg-white transition-all ${grantTvet ? 'border-emerald-300 shadow-sm' : 'border-slate-200 bg-slate-50/50'}`}>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={grantTvet} 
                        onChange={e => setGrantTvet(e.target.checked)} 
                        className="rounded text-emerald-600 focus:ring-emerald-500" 
                      />
                      <span>ТиПО / Колледж (Грант ~4.2 млн тг)</span>
                    </label>
                    {grantTvet && (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                        {tvetCost.toFixed(1)} млн тг
                      </span>
                    )}
                  </div>
                  {grantTvet && (
                    <div className="mt-2 pl-6 space-y-1 border-l-2 border-emerald-100">
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>Обучение на гранте:</span>
                        <span className="font-semibold">{grantTvetSemesters} сем. из 6 ({(grantTvetSemesters / 2).toFixed(1)} г.)</span>
                      </div>
                      <input 
                        type="range" 
                        min={1} 
                        max={6} 
                        step={1} 
                        value={grantTvetSemesters} 
                        onChange={e => setGrantTvetSemesters(Number(e.target.value))} 
                        className="w-full cursor-pointer accent-emerald-500 h-1.5" 
                      />
                    </div>
                  )}
                </div>

                {/* 2. Бакалавриат */}
                <div className={`p-3 rounded-lg border bg-white transition-all ${grantBach ? 'border-blue-300 shadow-sm' : 'border-slate-200 bg-slate-50/50'}`}>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={grantBach} 
                        onChange={e => setGrantBach(e.target.checked)} 
                        className="rounded text-blue-600 focus:ring-blue-500" 
                      />
                      <span>Бакалавриат (Грант ~6.0 млн тг)</span>
                    </label>
                    {grantBach && (
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                        {bachCost.toFixed(1)} млн тг
                      </span>
                    )}
                  </div>
                  {grantBach && (
                    <div className="mt-2 pl-6 space-y-1 border-l-2 border-blue-100">
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>Обучение на гранте:</span>
                        <span className="font-semibold">{grantBachSemesters} сем. из 8 ({(grantBachSemesters / 2).toFixed(1)} г.)</span>
                      </div>
                      <input 
                        type="range" 
                        min={1} 
                        max={8} 
                        step={1} 
                        value={grantBachSemesters} 
                        onChange={e => setGrantBachSemesters(Number(e.target.value))} 
                        className="w-full cursor-pointer accent-blue-500 h-1.5" 
                      />
                    </div>
                  )}
                </div>

                {/* 3. Магистратура */}
                <div className={`p-3 rounded-lg border bg-white transition-all ${grantMaster ? 'border-purple-300 shadow-sm' : 'border-slate-200 bg-slate-50/50'}`}>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={grantMaster} 
                        onChange={e => setGrantMaster(e.target.checked)} 
                        className="rounded text-purple-600 focus:ring-purple-500" 
                        disabled={level !== "master"}
                      />
                      <span className={level !== "master" ? "text-slate-400" : ""}>
                        Магистратура (Грант ~3.2 млн тг)
                        {level !== "master" && " — доступно в Магистратуре"}
                      </span>
                    </label>
                    {grantMaster && level === "master" && (
                      <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                        {masterCost.toFixed(1)} млн тг
                      </span>
                    )}
                  </div>
                  {grantMaster && level === "master" && (
                    <div className="mt-2 pl-6 space-y-1 border-l-2 border-purple-100">
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>Обучение на гранте:</span>
                        <span className="font-semibold">{grantMasterSemesters} сем. из 4 ({(grantMasterSemesters / 2).toFixed(1)} г.)</span>
                      </div>
                      <input 
                        type="range" 
                        min={1} 
                        max={4} 
                        step={1} 
                        value={grantMasterSemesters} 
                        onChange={e => setGrantMasterSemesters(Number(e.target.value))} 
                        className="w-full cursor-pointer accent-purple-500 h-1.5" 
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Status block */}
            <div className="rounded-xl px-4 py-3"
              style={{ background: status.bg, border: `1px solid ${status.border}` }}>
              <div className="text-sm font-bold" style={{ color: status.color }}>{status.title}</div>
              <div className="text-xs mt-0.5" style={{ color: status.color }}>{status.sub}</div>
            </div>
          </div>

          {/* ── Right Column: Results & Grant Obligation Tracker ───────────── */}
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

            {/* ── Обязательная отработка гранта (Закон РК) ── */}
            <div className="card p-5 border border-slate-200 space-y-4 shadow-sm bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-fc-navy-800 uppercase tracking-wider">Обязательная отработка гранта</h4>
                    <p className="text-[9px] text-slate-400">АО «Финансовый центр» Министерства науки и высшего образования РК</p>
                  </div>
                </div>
                <span className={`pill text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  !hasActiveGrant 
                    ? "bg-slate-100 text-slate-500 border border-slate-200" 
                    : monthsRemaining === 0 
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
                      : "bg-amber-100 text-amber-800 border border-amber-200"
                }`}>
                  {!hasActiveGrant ? "Платное обучение" : monthsRemaining === 0 ? "Выполнено" : "В процессе"}
                </span>
              </div>

              {!hasActiveGrant ? (
                <div className="text-xs text-slate-500 leading-relaxed py-4 text-center">
                  Обучение на платной основе (без привлечения государственного гранта). Обязательства по отработке отсутствуют.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Спецификация отработки */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Сумма всех грантов</span>
                      <span className="font-extrabold text-fc-navy-800 text-sm">{totalGrantCost.toFixed(2)} млн тг</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">Требуемый срок</span>
                      <span className="font-extrabold text-fc-navy-800 text-sm">
                        {requiredMonths} мес. ({ (requiredMonths / 12).toFixed(1) } г.)
                      </span>
                    </div>
                  </div>

                  {/* Интерактивный слайдер отработки */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-600 font-semibold">Фактически отработано выпускником</span>
                      <span className="font-bold text-fc-navy-800 tabular-nums">
                        {monthsWorked} мес. ({ (monthsWorked / 12).toFixed(1) } г.)
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min={0} 
                      max={requiredMonths} 
                      step={1} 
                      value={monthsWorked}
                      onChange={e => setMonthsWorked(Number(e.target.value))}
                      className="w-full cursor-pointer accent-fc-navy-700 h-1.5" 
                    />
                    <div className="flex justify-between text-[9px] text-slate-400">
                      <span>0 мес.</span>
                      <span>{requiredMonths} мес.</span>
                    </div>
                  </div>

                  {/* Статус отработки */}
                  <div className="p-3 rounded-lg border flex flex-col gap-1.5" 
                    style={{ 
                      background: monthsRemaining === 0 ? "#E1F5EE" : "#FFFBEB", 
                      borderColor: monthsRemaining === 0 ? "#9FE1CB" : "#FDE68A" 
                    }}>
                    <div className="flex justify-between items-center text-xs font-bold" 
                      style={{ color: monthsRemaining === 0 ? "#1D9E75" : "#B45309" }}>
                      <span>{monthsRemaining === 0 ? "Обязательства выполнены" : "Отработка в процессе"}</span>
                      <span>Осталось: {monthsRemaining} мес.</span>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-normal">
                      {monthsRemaining === 0 
                        ? "Выпускник успешно отработал установленный срок. Бюджетные средства не подлежат возврату." 
                        : `Выпускник отработал ${monthsWorked} из ${requiredMonths} месяцев. До завершения отработки осталось ${monthsRemaining} мес.`}
                    </p>
                  </div>

                  {/* Расчет штрафа в реальном времени */}
                  <div className="pt-3 border-t border-slate-100 space-y-2.5">
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      Расчет суммы к возмещению в бюджет
                    </div>
                    
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1.5 font-mono text-[11px] text-slate-700">
                      <div className="flex justify-between">
                        <span>Сумма грантов к возврату (C):</span>
                        <span className="font-semibold">{totalGrantCost.toFixed(2)} млн тг</span>
                      </div>
                      <div className="flex justify-between border-b border-dashed border-slate-200 pb-1.5">
                        <span>Неотработанная доля (1 - T_факт/T_треб):</span>
                        <span className="font-semibold">
                          1 - {monthsWorked}/{requiredMonths} = {(1 - monthsWorked/requiredMonths).toFixed(3)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1 font-bold text-xs">
                        <span>Штраф (C × Доля):</span>
                        <span style={{ color: refundAmount > 0 ? "#A32D2D" : "#1D9E75" }}>
                          {totalGrantCost.toFixed(2)} × {(1 - monthsWorked/requiredMonths).toFixed(3)} = {refundAmount.toFixed(3)} млн тг
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center p-3 rounded-lg border transition-all"
                      style={{
                        background: refundAmount > 0 ? "#FFF5F5" : "#FEB2B2",
                        borderColor: refundAmount > 0 ? "#FEB2B2" : "#9FE1CB"
                      }}>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">Итого к возврату в бюджет:</span>
                        <span className="text-[10px] text-slate-400">при текущем стаже работы</span>
                      </div>
                      <span className="text-xl font-extrabold tabular-nums animate-pulse" style={{ color: refundAmount > 0 ? "#C53030" : "#1D9E75" }}>
                        {(refundAmount * 1000000).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} тг
                      </span>
                    </div>
                  </div>
                </div>
              )}
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
