// src/features/gdp/GdpMacroPage.tsx
import { useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { PageHeader } from "@/components/ui";

// ── Constants from reference model ───────────────────────────────────────────
const GDP_BASE_TRN    = 120;    // ВВП РК 2023: $261.8 млрд ≈ 120 трлн тг
const AVG_SALARY_BASE = 403;    // тыс тг/мес средняя зарплата РК (2024)
const POTENTIAL_SALARY = 420;   // тыс тг/мес если все работают по специальности
const PISA_GDP_COEFF  = 0.0087; // +1 балл PISA = +0.87% ВВП за 40 лет
const MULTIPLIER      = 1.55;   // мультипликатор образования
const TAX             = 0.21;

function buildSeries(annual: number, growth: number) {
  let cumul = 0;
  return Array.from({ length: 31 }, (_, y) => {
    cumul += annual * Math.pow(1 + growth, y);
    return cumul;
  });
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-fc-sm p-5 flex flex-col gap-1">
      <div className="label-eyebrow text-slate-500">{label}</div>
      <div className="font-display text-2xl font-extrabold tabular-nums" style={{ color: color ?? "#19286d" }}>
        {value}
      </div>
      <div className="text-xs text-slate-400">{sub}</div>
    </div>
  );
}

function Slider({
  label, hint, value, min, max, step, display,
  onChange,
}: {
  label: string; hint: string; value: number; min: number; max: number; step: number;
  display: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-1.5">{label}</div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-slate-400">{hint}</span>
        <span className="text-sm font-bold text-slate-700">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-fc-navy cursor-pointer"
      />
    </div>
  );
}

function ScenarioCard({
  label, desc, value, diff, extra,
  bg, border, titleColor, valueColor,
}: {
  label: string; desc: string; value: string; diff?: string; extra: string;
  bg: string; border: string; titleColor: string; valueColor: string;
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="text-xs font-bold mb-1" style={{ color: titleColor }}>{label}</div>
      <div className="text-xs mb-3" style={{ color: titleColor }}>{desc}</div>
      <div className="font-display text-2xl font-bold tabular-nums" style={{ color: valueColor }}>{value}</div>
      <div className="text-xs mt-0.5" style={{ color: titleColor }}>вклад когорты в ВВП/год</div>
      {diff && <div className="text-xs mt-2 leading-relaxed" style={{ color: titleColor }} dangerouslySetInnerHTML={{ __html: diff }} />}
      <div className="text-xs mt-1 leading-relaxed" style={{ color: titleColor }} dangerouslySetInnerHTML={{ __html: extra }} />
    </div>
  );
}

function FormulaCard({ accent, title, formula, note }: { accent: string; title: string; formula: string; note: string }) {
  return (
    <div className="bg-white rounded-lg p-3.5 border border-slate-200">
      <div className="text-xs font-semibold mb-2" style={{ color: accent }}>{title}</div>
      <pre className="font-mono text-[11px] text-slate-500 bg-slate-50 rounded-md p-2.5 leading-loose whitespace-pre-wrap">
        {formula}
      </pre>
      <div className="text-xs text-slate-400 mt-2 leading-relaxed">{note}</div>
    </div>
  );
}

function PriorityItem({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex gap-3 items-start p-3 bg-white rounded-lg border border-emerald-200">
      <div className="text-2xl font-extrabold text-emerald-600 leading-none min-w-[28px]">{n}</div>
      <div>
        <div className="text-sm font-semibold mb-0.5">{title}</div>
        <div className="text-xs text-slate-500 leading-relaxed">{desc}</div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function GdpMacroPage() {
  const [graduates, setGraduates] = useState(150);
  const [matchPct,  setMatchPct]  = useState(48);
  const [pisaDelta, setPisaDelta] = useState(0);

  const c = useMemo(() => {
    // currentAvgSal — тыс тг/мес; делим на 1e9 (не 1e12) чтобы получить трлн тг
    const currentAvgSal   = AVG_SALARY_BASE * (0.7 + matchPct / 100 * 0.5);
    const annualGDPContrib = graduates * 1000 * currentAvgSal * 12 * MULTIPLIER / 1e9;
    const pisaGDPEffect   = GDP_BASE_TRN * pisaDelta * PISA_GDP_COEFF;
    const lossPerYear     = Math.max(0, (POTENTIAL_SALARY - currentAvgSal) * 12 * graduates * 1000 / 1e9);

    const base      = annualGDPContrib;
    const moderate  = graduates * 1000 * (AVG_SALARY_BASE * (0.7 + 0.70 * 0.5)) * 12 * MULTIPLIER / 1e9;
    const ambitious = graduates * 1000 * POTENTIAL_SALARY * 12 * MULTIPLIER / 1e9 * (1 + pisaDelta * 0.005);

    const diff1Raw = (moderate  - base) / base * 100;
    const diff2Raw = (ambitious - base) / base * 100;
    const sign = (n: number) => n >= 0 ? "+" : "";
    const diff1 = `${sign(diff1Raw)}${diff1Raw.toFixed(1)}`;
    const diff2 = `${sign(diff2Raw)}${diff2Raw.toFixed(1)}`;

    const sBase = buildSeries(base,      0.025);
    const sMod  = buildSeries(moderate,  0.038);
    const sAmb  = buildSeries(ambitious, 0.052 + pisaDelta * 0.0003);

    const chartData = sBase.map((v, i) => ({
      year:      i,
      base:      v,
      moderate:  sMod[i],
      ambitious: sAmb[i],
    }));

    const budgetDiff1 = (moderate  - base) * TAX;
    const budgetDiff2 = (ambitious - base) * TAX;
    return { annualGDPContrib, pisaGDPEffect, lossPerYear, base, moderate, ambitious, diff1, diff2, budgetDiff1, budgetDiff2, sign, chartData, currentAvgSal };
  }, [graduates, matchPct, pisaDelta]);

  return (
    <>
      <PageHeader
        title="ВВП / Макроэффект"
        subtitle="Вклад образования в экономику страны — сценарный анализ"
      />

      {/* ── Hero header ─────────────────────────────────────────────────────── */}
      <div className="border-l-4 border-emerald-500 pl-4 mb-6">
        <div className="font-display text-lg font-bold text-slate-800 mb-1">
          Каждый тенге в образование — это X тенге роста ВВП
        </div>
        <div className="text-sm text-slate-500 leading-relaxed max-w-2xl">
          Для Министерства финансов важен не ROI одного человека, а совокупный эффект на экономику страны.
          Модель показывает три вещи: вклад образования в ВВП сейчас, потери от низкого качества,
          и что даст улучшение — в триллионах тенге.
        </div>
      </div>

      {/* ── Macro stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        <StatCard
          label="ВВП РК 2023"
          value="120 трлн тг"
          sub="$261.8 млрд (базовый уровень)"
        />
        <StatCard
          label="Вклад образования в ВВП"
          value={`${c.annualGDPContrib.toFixed(1)} трлн тг`}
          sub="ежегодно от когорты"
          color="#1D9E75"
        />
        <StatCard
          label={`Потенциал PISA +${pisaDelta}`}
          value={`${pisaDelta > 0 ? "+" : ""}${c.pisaGDPEffect.toFixed(1)} трлн тг`}
          sub="эффект за 40 лет"
          color="#7F77DD"
        />
        <StatCard
          label="Цена бездействия / год"
          value={`-${c.lossPerYear.toFixed(1)} трлн тг`}
          sub="недобранные налоги"
          color="#A32D2D"
        />
      </div>

      {/* ── Scenario sliders ─────────────────────────────────────────────────── */}
      <div className="card p-5 mb-4" style={{ overflow: "visible" }}>
        <div className="label-eyebrow text-slate-500 mb-4">Сценарный анализ для Минфина</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
          <Slider
            label="Ежегодный выпуск (тыс. чел.)"
            hint="Значение"
            value={graduates} min={50} max={300} step={5}
            display={`${graduates} тыс.`}
            onChange={setGraduates}
          />
          <Slider
            label="Трудоустройство по специальности (%)"
            hint="Текущее"
            value={matchPct} min={20} max={90} step={1}
            display={`${matchPct}%`}
            onChange={setMatchPct}
          />
          <Slider
            label="Прирост баллов PISA (цель)"
            hint="Прирост"
            value={pisaDelta} min={0} max={60} step={1}
            display={`${pisaDelta > 0 ? "+" : ""}${pisaDelta} балл`}
            onChange={setPisaDelta}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ScenarioCard
            label="Базовый сценарий"
            desc="Ничего не меняем. Текущая траектория."
            value={`${c.base.toFixed(2)} трлн тг`}
            extra={`Трудоустройство по спец: ${matchPct}%<br/>Рост ВВП от образования: +0%`}
            bg="#FCEBEB" border="#F09595" titleColor="#A32D2D" valueColor="#A32D2D"
          />
          <ScenarioCard
            label="Умеренный сценарий"
            desc="Трудоустройство по специальности → 70%"
            value={`${c.moderate.toFixed(2)} трлн тг`}
            diff={`Прирост к базовому: ${c.diff1}%<br/>Доп. доход бюджета: ${c.sign(c.budgetDiff1)}${c.budgetDiff1.toFixed(2)} трлн тг`}
            extra=""
            bg="#FAEEDA" border="#FAC775" titleColor="#854F0B" valueColor="#BA7517"
          />
          <ScenarioCard
            label="Амбициозный сценарий"
            desc={`Занятость 70% + рост PISA на ${pisaDelta} баллов`}
            value={`${c.ambitious.toFixed(2)} трлн тг`}
            diff={`Прирост к базовому: ${c.diff2}%<br/>Доп. доход бюджета: ${c.sign(c.budgetDiff2)}${c.budgetDiff2.toFixed(2)} трлн тг`}
            extra=""
            bg="#E1F5EE" border="#9FE1CB" titleColor="#0F6E56" valueColor="#1D9E75"
          />
        </div>
      </div>

      {/* ── 30-year chart ────────────────────────────────────────────────────── */}
      <div className="card mb-4">
        <div className="label-eyebrow text-slate-500 px-5 pt-5 mb-4">
          Прогноз вклада образования в ВВП — 30 лет (трлн тг)
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={c.chartData} margin={{ top: 8, right: 40, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gBase" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#A32D2D" stopOpacity={0.10} />
                <stop offset="95%" stopColor="#A32D2D" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gMod" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#BA7517" stopOpacity={0.10} />
                <stop offset="95%" stopColor="#BA7517" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gAmb" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#1D9E75" stopOpacity={0.13} />
                <stop offset="95%" stopColor="#1D9E75" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0ddd6" strokeWidth={0.5} />
            <XAxis
              dataKey="year"
              type="number"
              domain={[0, 30]}
              ticks={[0, 5, 10, 15, 20, 25, 30]}
              tickFormatter={v => `год ${v}`}
              tick={{ fontSize: 10, fill: "#888780" }}
            />
            <YAxis
              tickFormatter={v => `${Number(v).toFixed(0)} трлн`}
              tick={{ fontSize: 10, fill: "#888780" }}
              width={76}
            />
            <Tooltip
              formatter={(v: number, name: string) => [
                `${Number(v).toFixed(1)} трлн тг`,
                name === "base" ? "Базовый" : name === "moderate" ? "Умеренный" : "Амбициозный",
              ]}
              labelFormatter={l => `Год ${l}`}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e9f2" }}
            />
            <Area type="monotone" dataKey="base"      stroke="#A32D2D" strokeWidth={2}   strokeDasharray="6 3" fill="url(#gBase)" dot={false} />
            <Area type="monotone" dataKey="moderate"  stroke="#BA7517" strokeWidth={2.5} fill="url(#gMod)"  dot={false} />
            <Area type="monotone" dataKey="ambitious" stroke="#1D9E75" strokeWidth={2.5} fill="url(#gAmb)"  dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex gap-5 px-5 pb-5 mt-3 flex-wrap">
          {[
            { color: "#A32D2D", dashed: true,  label: "Базовый — ничего не меняем" },
            { color: "#BA7517", dashed: false, label: "Умеренный — поднимаем трудоустройство" },
            { color: "#1D9E75", dashed: false, label: "Амбициозный — качество + занятость" },
          ].map(({ color, dashed, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
              <svg width="24" height="4" style={{ flexShrink: 0 }}>
                <line x1="0" y1="2" x2="24" y2="2"
                  stroke={color} strokeWidth="2.5"
                  strokeDasharray={dashed ? "6 3" : undefined}
                />
              </svg>
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Methodology ──────────────────────────────────────────────────────── */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 mb-4">
        <div className="label-eyebrow text-slate-500 mb-4">Как считается привязка к ВВП</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormulaCard
            accent="#185FA5"
            title="Уравнение Минцера (Всемирный банк)"
            formula={`ln(зарплата) = α + β×годы_обучения + γ×опыт\nβ ≈ 0.08–0.12 для Казахстана\n+1 год качественного обучения ≈ +8–12% зарплата`}
            note="Зарплата = производительность = вклад в ВВП. Рост зарплат в экономике — это и есть рост ВВП."
          />
          <FormulaCard
            accent="#1D9E75"
            title="PISA → ВВП (Hanushek & Woessmann, 50 стран)"
            formula={`+1 балл PISA ≈ +0.87% ВВП за 40 лет\nКЗ PISA 2022: 425 баллов (математика, место 46)\nСреднее ОЭСР: 440 → разрыв −15 баллов (+13.1% ВВП потенциал)`}
            note="Не теория — данные 50 стран за 40 лет. Качество школы — сильнейший предиктор роста ВВП."
          />
          <FormulaCard
            accent="#7F77DD"
            title="Агрегация: когорта → ВВП"
            formula={`ΔВВП/год = N × Δзарплата × 12\n× доля_по_спец × мультипликатор\nМультипликатор образования ≈ 1.4–1.8`}
            note="Один выпускник с высокой зарплатой создаёт спрос, рабочие места, налоги — мультипликативный эффект."
          />
          <FormulaCard
            accent="#A32D2D"
            title="Цена бездействия"
            formula={`Потери = (потенц.зарплата − реальная)\n× N_выпускников × 35 лет\n× налоговая_ставка`}
            note="Каждый год низкого качества — недобранный ВВП, который уже не вернуть. Это и есть цена бездействия."
          />
        </div>
      </div>

      {/* ── Loss card ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 mb-4">
        <div className="text-sm font-bold text-[#A32D2D] mb-2">Цена бездействия для бюджета РК</div>
        <div className="text-sm text-[#791F1F] leading-relaxed">
          При текущем трудоустройстве по специальности <strong>{matchPct}%</strong> и потенциале <strong>70%+</strong> — экономика РК недополучает{" "}
          <strong>{c.lossPerYear.toFixed(2)} трлн тг производительности в год</strong> только от этой когорты.<br />
          За 10 лет — <strong>{(c.lossPerYear * 10).toFixed(1)} трлн тг</strong> потерянного ВВП.<br />
          Налоговые потери бюджета: <strong>{(c.lossPerYear * TAX * 10).toFixed(2)} трлн тг за 10 лет</strong>.<br />
          <span className="text-xs opacity-75">Это деньги, которые уже потрачены на обучение — но экономика их не получила обратно.</span>
        </div>
      </div>

      {/* ── Priorities ───────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="text-sm font-bold text-emerald-800 mb-3">
          Приоритеты для Минфина: где 1 тенге даёт максимум ВВП
        </div>
        <div className="flex flex-col gap-2">
          <PriorityItem
            n={1}
            title="Дошкольное образование — ROI ×7–12"
            desc="Нобелевский лауреат Хекман: каждый тенге в дошкольное возвращает 7–12 тенге в ВВП через 20 лет. Наибольший эффект у детей из малообеспеченных семей."
          />
          <PriorityItem
            n={2}
            title="Качество учителей начальной школы"
            desc="+1 σ качества учителя = +$600 тыс. доходов ученика за жизнь (Chetty et al.). Рост зарплаты учителю без роста качества его работы — выброшенные деньги."
          />
          <PriorityItem
            n={3}
            title="Дуальное обучение в ТиПО"
            desc="Поднять трудоустройство по специальности с 42% до 70% = +28% налоговых поступлений с когорты ТиПО ежегодно. Окупается за 3–4 года."
          />
        </div>
      </div>
    </>
  );
}
