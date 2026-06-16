// src/features/chain/ChainBreaksPage.tsx
import { PageHeader } from "@/components/ui";

// ── Chain steps ────────────────────────────────────────────────────────────────

const STEPS = [
  {
    label: "ВЛОЖЕНИЯ 2023",
    value: "5 546",
    unit: "млрд тг",
    note: "+91% к 2020\nЗП педагогов +67%",
    bg: "#EFF6FF", border: "#BFDBFE", color: "#1E40AF",
    round: "left",
  },
  {
    label: "КАЧЕСТВО",
    value: "ЕНТ 67",
    unit: "из 140 баллов",
    note: "был 73 в 2023 ↓\nPISA: 425 (46-е место)",
    bg: "#FEF2F2", border: "#FCA5A5", color: "#DC2626",
    topBorder: "#DC2626",
    round: "none",
  },
  {
    label: "ТРУДОУСТРОЙСТВО",
    value: "66%",
    unit: "вуз 2025",
    note: "было 82% в 2021 ↓\nТиПО: 60%",
    bg: "#FFFBEB", border: "#FCD34D", color: "#D97706",
    topBorder: "#D97706",
    round: "none",
  },
  {
    label: "ЗАРПЛАТА",
    value: "403 тыс",
    unit: "тг/мес среднее",
    note: "медиана: 309 тыс\nvs потенциал 500+ тыс",
    bg: "#F5F3FF", border: "#DDD6FE", color: "#7C3AED",
    topBorder: "#7C3AED",
    round: "none",
  },
  {
    label: "НАЛОГИ В БЮДЖЕТ",
    value: "~21%",
    unit: "ИПН+ЕНПФ+соц",
    note: "≈917 млрд тг/год\nот занятых",
    bg: "#F0FDF4", border: "#86EFAC", color: "#16A34A",
    round: "right",
  },
];

const GAPS = [
  { n: 1, color: "#DC2626", bg: "#FEF2F2", border: "#FCA5A5", label: "деньги есть\nкачество нет" },
  { n: 2, color: "#D97706", bg: "#FFFBEB", border: "#FCD34D", label: "диплом есть\nработы нет"   },
  { n: 3, color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", label: "работа есть\nзарплата низкая" },
];

// ── Gap detail cards ───────────────────────────────────────────────────────────

const GAP_CARDS = [
  {
    title: "Разрыв №1",
    sub:   "Деньги → Качество",
    color: "#DC2626",
    sep:   "vs",
    left:  { value: "+67%",    label: "рост ЗП педагогов\n2020–2023",       color: "#1E40AF" },
    right: { value: "−5%",     label: "ЕНТ 2023→2024\n(73→67)",             color: "#DC2626" },
    noteBg: "#FEF2F2",
    note: "Рост зарплаты учителя не связан с ростом качества обучения. Нет механизма привязки оплаты к результату.",
  },
  {
    title: "Разрыв №2",
    sub:   "Диплом → Рынок труда",
    color: "#D97706",
    sep:   "→",
    left:  { value: "276 762", label: "выпускников\nгосзаказа 2021–25",     color: "#1E40AF" },
    right: { value: "44%",     label: "не трудоустроены\n(госзаказ 2021–25)", color: "#DC2626" },
    noteBg: "#FFFBEB",
    note: "Каждый третий выпускник на госгранте не возвращает вложенное. При среднем гранте 6 млн тг — это десятки миллиардов ежегодных потерь.",
  },
  {
    title: "Разрыв №3",
    sub:   "Работа → Низкая зарплата",
    color: "#7C3AED",
    sep:   "vs",
    left:  { value: "309 тыс", label: "медиана\nзарплаты РК",               color: "#6B7280" },
    right: { value: "500+ тыс",label: "потенциал при\nкачестве ВУЗ ОЭСР",   color: "#16A34A" },
    noteBg: "#F5F3FF",
    note: "Работают, но ниже потенциала. Разрыв в производительности = разрыв в ВВП. PISA на 15 баллов ниже ОЭСР по математике — это −47% ВВП недобранного за 40 лет.",
  },
];

// ── Solutions ──────────────────────────────────────────────────────────────────

const SOLUTIONS = [
  {
    color: "#DC2626",
    title: "Разрыв №1 → Привязать ЗП к результату",
    text:  "Дифференцированная оплата: базовая + бонус за рост ЕНТ / PISA учеников. Рост зарплаты только вместе с ростом качества.",
  },
  {
    color: "#D97706",
    title: "Разрыв №2 → Гранты под реальный спрос",
    text:  "Госзаказ по специальностям — только там, где рынок труда подтверждает потребность через данные МТСЗН. Дуальное обучение для ТиПО.",
  },
  {
    color: "#7C3AED",
    title: "Разрыв №3 → Качество = PISA + навыки",
    text:  "Фокус на функциональной грамотности с начальной школы. +10 баллов PISA = +8.7% ВВП через 40 лет. Считаемая цель для системы мониторинга.",
  },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function ChainBreaksPage() {
  return (
    <>
      <PageHeader
        title="Разрывы в цепочке"
        subtitle="Государство вложило — но цепочка оборвалась. Три разрыва, три уровня потерь."
      />

      <div className="space-y-4 max-w-5xl">

        {/* Hero banner */}
        <div
          className="rounded-xl px-6 py-5 text-white"
          style={{ background: "linear-gradient(135deg,#7C0000 0%,#DC2626 100%)" }}
        >
          <div className="label-eyebrow mb-1" style={{ opacity: 0.7, letterSpacing: "2px" }}>
            Республика Казахстан · Анализ разрывов
          </div>
          <div className="text-xl font-display font-bold mb-1">Где деньги не доходят до ВВП</div>
          <div className="text-sm leading-relaxed" style={{ opacity: 0.85 }}>
            Государство вложило — но цепочка оборвалась. Три разрыва, три уровня потерь.
          </div>
        </div>

        {/* Chain diagram */}
        <div className="card p-5">
          <div className="text-sm font-bold text-fc-navy-800 mb-4">Сквозная цепочка: вложения → ВВП</div>
          <div className="flex items-stretch overflow-x-auto gap-0 pb-1">
            {STEPS.map((s, i) => {
              const gap = GAPS[i]; // gap after this step (if exists)
              return (
                <div key={i} className="flex items-stretch shrink-0">
                  {/* Step box */}
                  <div
                    className="flex-1 min-w-[120px] px-3 py-3.5"
                    style={{
                      background: s.bg,
                      border: `1px solid ${s.border}`,
                      borderTop: s.topBorder ? `3px solid ${s.topBorder}` : `1px solid ${s.border}`,
                      borderRadius:
                        s.round === "left"  ? "10px 0 0 10px" :
                        s.round === "right" ? "0 10px 10px 0" : "0",
                    }}
                  >
                    <div className="text-[10px] text-slate-500 mb-1">{s.label}</div>
                    <div className="text-xl font-display font-bold" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[11px] font-medium" style={{ color: s.color }}>{s.unit}</div>
                    <div className="text-[10px] text-slate-500 mt-1.5 leading-snug whitespace-pre-line">{s.note}</div>
                  </div>

                  {/* Gap marker */}
                  {gap && (
                    <div className="flex flex-col items-center justify-center px-2 shrink-0">
                      <div
                        className="text-[9px] font-bold rounded px-1.5 py-0.5 whitespace-nowrap mb-1"
                        style={{ color: gap.color, background: gap.bg, border: `1px solid ${gap.border}` }}
                      >
                        РАЗРЫВ №{gap.n}
                      </div>
                      <div className="text-lg font-bold" style={{ color: gap.color }}>→</div>
                      <div
                        className="text-[9px] text-center whitespace-pre-line leading-tight mt-0.5"
                        style={{ color: gap.color }}
                      >
                        {gap.label}
                      </div>
                    </div>
                  )}

                  {/* Final arrow (after last step) */}
                  {i === STEPS.length - 2 && !gap && (
                    <div className="flex items-center px-2 text-lg text-success shrink-0">→</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Gap detail cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {GAP_CARDS.map(g => (
            <div
              key={g.title}
              className="bg-white rounded-xl border border-slate-200 p-5"
              style={{ borderTop: `4px solid ${g.color}` }}
            >
              <div className="text-sm font-bold mb-3 leading-snug" style={{ color: g.color }}>
                {g.title}<br />{g.sub}
              </div>

              <div className="flex justify-between items-center mb-3">
                <div className="text-center">
                  <div className="text-2xl font-display font-bold tabular-nums" style={{ color: g.left.color }}>
                    {g.left.value}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 whitespace-pre-line leading-snug">
                    {g.left.label}
                  </div>
                </div>
                <div className="text-2xl text-slate-200 font-light">{g.sep}</div>
                <div className="text-center">
                  <div className="text-2xl font-display font-bold tabular-nums" style={{ color: g.right.color }}>
                    {g.right.value}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 whitespace-pre-line leading-snug">
                    {g.right.label}
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-700 leading-relaxed rounded-lg p-3" style={{ background: g.noteBg }}>
                <strong>Вывод:</strong> {g.note}
              </div>
            </div>
          ))}
        </div>

        {/* Solutions */}
        <div
          className="rounded-xl p-5"
          style={{ background: "#F0FDF4", border: "1px solid #86EFAC" }}
        >
          <div className="text-sm font-bold text-green-800 mb-4">Три решения для трёх разрывов</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {SOLUTIONS.map(s => (
              <div key={s.title} className="bg-white rounded-lg p-3 border border-green-200">
                <div className="text-xs font-bold mb-1.5" style={{ color: s.color }}>{s.title}</div>
                <div className="text-xs text-slate-700 leading-relaxed">{s.text}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
