// src/features/edu-level/PreschoolPage.tsx
import React, { useState } from "react";
import { useApi, EduLevelStats, EduLevelSectorStats } from "@/hooks/useApi";
import {
  ChevronDown
} from "lucide-react";
import { PageHeader } from "@/components/ui";
import { motion, AnimatePresence } from "framer-motion";

interface IndicatorScore {
  val: number | string;
  desc: string;
  isNegative?: boolean;
}

interface Indicator {
  id: string;
  name: string;
  isGoso?: boolean;
  scores: IndicatorScore[];
}

interface AssessmentBlock {
  id: string;
  title: string;
  level: string;
  indicatorsCount: number;
  weightLabel: string;
  color: string;
  borderColor: string;
  hoverColor: string;
  bgLight: string;
  indicators: Indicator[];
}

// Data from dirty_layout.html
const BLOCKS_DATA: AssessmentBlock[] = [
  {
    id: "block_1",
    title: "I. Условия развития и безопасность",
    level: "Детсад в целом",
    indicatorsCount: 8,
    weightLabel: "~25",
    color: "#0D9E6E",
    borderColor: "border-[#86EFAC]",
    hoverColor: "hover:bg-emerald-50/40",
    bgLight: "#F0FDF4",
    indicators: [
      {
        id: "b1_i0",
        name: "Техническое состояние здания",
        scores: [
          { val: -2, desc: "Требует капремонта — аварийное или критически изношенное", isNegative: true },
          { val: -1, desc: "Требует текущего ремонта — заметные нарушения", isNegative: true },
          { val: 0.5, desc: "Не требует ремонта" },
          { val: 1, desc: "Проведён текущий ремонт" },
          { val: 2, desc: "Проведён капремонт" }
        ]
      },
      {
        id: "b1_i1",
        name: "Соответствие СанПиН (наполняемость, площадь, вентиляция)",
        isGoso: true,
        scores: [
          { val: -2, desc: "Нарушение СанПиН, зафиксированное проверкой", isNegative: true },
          { val: 0, desc: "Незначительные нарушения, устраняются" },
          { val: 2, desc: "Полное соответствие СанПиН, подтверждено актом" }
        ]
      },
      {
        id: "b1_i2",
        name: "ИНДЕКС ЗДОРОВЬЯ КОНТИНГЕНТА (интеграция с ИС РЦЭЗ Минздрава)",
        scores: [
          { val: -2, desc: "Заболеваемость выше среднего по кластеру более чем на 30% — системная проблема", isNegative: true },
          { val: 0, desc: "На уровне среднего по кластеру ±10%" },
          { val: 2, desc: "На 10–30% ниже среднего — хорошие условия" },
          { val: 3, desc: "На 30%+ ниже среднего — отличные условия" }
        ]
      },
      {
        id: "b1_i3",
        name: "Развивающая предметно-пространственная среда",
        isGoso: true,
        scores: [
          { val: 1, desc: "Базовая среда: минимальный набор, зонирования нет" },
          { val: 2, desc: "Частичное зонирование: 2–3 зоны" },
          { val: 3, desc: "Полноценная среда: игра, творчество, исследование, физактивность" }
        ]
      },
      {
        id: "b1_i4",
        name: "Прогулочный участок и спортплощадка",
        scores: [
          { val: 0, desc: "Нет — дети лишены прогулочной/спортивной активности" },
          { val: 2, desc: "Есть оборудованный участок и/или спортплощадка" }
        ]
      },
      {
        id: "b1_i5",
        name: "Питание: охват и соответствие нормам калорийности",
        isGoso: true,
        scores: [
          { val: 1, desc: "Охват 80–89%, меню без грубых нарушений" },
          { val: 2, desc: "Охват 90–99%, меню соответствует нормам" },
          { val: 3, desc: "100% охват, нет замечаний" }
        ]
      },
      {
        id: "b1_i6",
        name: "Система безопасности (антитеррор, СКУД, видеонаблюдение)",
        scores: [
          { val: 0, desc: "Нет ни одного элемента" },
          { val: 1, desc: "Частично: тревожная кнопка без СКУД/видео" },
          { val: 2, desc: "Полный комплект" }
        ]
      },
      {
        id: "b1_i7",
        name: "Охват детей с ОПП — инклюзия",
        isGoso: true,
        scores: [
          { val: 0, desc: "Нет условий для детей с ОПП" },
          { val: 1, desc: "Есть 1–2 ребёнка, базовые условия" },
          { val: 2, desc: "Системная инклюзия: адаптир. программа + специалист + среда" }
        ]
      }
    ]
  },
  {
    id: "block_2",
    title: "II. Кадровый потенциал",
    level: "Детсад в целом",
    indicatorsCount: 7,
    weightLabel: "~22",
    color: "#2563EB",
    borderColor: "border-[#BFDBFE]",
    hoverColor: "hover:bg-blue-50/40",
    bgLight: "#EFF6FF",
    indicators: [
      {
        id: "b2_i0",
        name: "Педагоги с профильным образованием (дошкольная педагогика)",
        isGoso: true,
        scores: [
          { val: 1, desc: "Менее 50%" },
          { val: 1.5, desc: "50–70%" },
          { val: 2, desc: "71–85%" },
          { val: 2.5, desc: "86%+" }
        ]
      },
      {
        id: "b2_i1",
        name: "Квалификационная категория (первая / высшая)",
        isGoso: true,
        scores: [
          { val: 0, desc: "Нет" },
          { val: 0.5, desc: "1–20%" },
          { val: 1, desc: "21–40%" },
          { val: 1.5, desc: "41–60%" },
          { val: 2, desc: "61%+" }
        ]
      },
      {
        id: "b2_i2",
        name: "Повышение квалификации за год",
        isGoso: true,
        scores: [
          { val: 1, desc: "20–40%" },
          { val: 1.5, desc: "41–60%" },
          { val: 2, desc: "61%+" }
        ]
      },
      {
        id: "b2_i3",
        name: "Специалисты сопровождения: психолог, логопед, дефектолог",
        isGoso: true,
        scores: [
          { val: -2, desc: "Нет ни одного специалиста при ОПП / контингенте >60 детей", isNegative: true },
          { val: 0, desc: "Отсутствуют, контингент до 60 без ОПП" },
          { val: 1.5, desc: "Есть 1 специалист" },
          { val: 2.5, desc: "Полный набор: психолог + логопед + дефектолог" }
        ]
      },
      {
        id: "b2_i4",
        name: "Текучесть кадров (обратный)",
        scores: [
          { val: 1, desc: "20–30%" },
          { val: 1.5, desc: "10–20%" },
          { val: 2, desc: "Менее 10%" }
        ]
      },
      {
        id: "b2_i5",
        name: "Победители педагогических конкурсов (областной / республиканский)",
        scores: [
          { val: 0, desc: "Нет" },
          { val: 1, desc: "Областной уровень" },
          { val: 2, desc: "Республиканский / международный" }
        ]
      },
      {
        id: "b2_i6",
        name: "Соотношение педагог / воспитанник к нормативу ГОСО",
        isGoso: true,
        scores: [
          { val: -1, desc: "Превышение норматива более чем на 20%", isNegative: true },
          { val: 0, desc: "Превышение 10–20%" },
          { val: 1, desc: "Соответствует нормативу ±10%" },
          { val: 1.5, desc: "Ниже норматива" }
        ]
      }
    ]
  },
  {
    id: "block_3",
    title: "III. Образовательные результаты и готовность к школе",
    level: "Детсад в целом",
    indicatorsCount: 4,
    weightLabel: "~30",
    color: "#D97706",
    borderColor: "border-[#FCD34D]",
    hoverColor: "hover:bg-amber-50/40",
    bgLight: "#FFFBEB",
    indicators: [
      {
        id: "b3_i0",
        name: "ГОТОВНОСТЬ К ШКОЛЕ — входное тестирование 1-классников (внешняя оценка)",
        isGoso: true,
        scores: [
          { val: 0, desc: "менее 30%" },
          { val: 1, desc: "40–60% детей в норме" },
          { val: 1.5, desc: "61–80%" },
          { val: 2, desc: "81%+" },
          { val: 3, desc: "51–65% выпускников показали высокий уровень" },
          { val: 5, desc: "66–80% выпускников показали высокий уровень" },
          { val: 7, desc: "81%+ — системная высококачественная подготовка" }
        ]
      },
      {
        id: "b3_i1",
        name: "Охват 3-языковым развитием (каз / рус / иностр.)",
        isGoso: true,
        scores: [
          { val: 0, desc: "Только один язык" },
          { val: 1, desc: "Два языка" },
          { val: 2, desc: "Три языка, занятия на иностранном" },
          { val: 3, desc: "Системное трёхъязычие" }
        ]
      },
      {
        id: "b3_i2",
        name: "Посещаемость воспитанников",
        scores: [
          { val: 0, desc: "менее 60%" },
          { val: 1, desc: "60–75%" },
          { val: 1.5, desc: "76–89%" },
          { val: 2, desc: "90%+" }
        ]
      },
      {
        id: "b3_i3",
        name: "МОНИТОРИНГ ВЫПУСКНИКОВ ДОВ в 1–2 классе (сквозная оценка)",
        isGoso: true,
        scores: [
          { val: 0, desc: "Мониторинг не проводится" },
          { val: 1.5, desc: "Неформальное взаимодействие со школой" },
          { val: 3, desc: "Систематический мониторинг: данные НОБД используются для коррекции программы" }
        ]
      }
    ]
  },
  {
    id: "block_4",
    title: "IV. Управление и прозрачность",
    level: "Детсад в целом",
    indicatorsCount: 4,
    weightLabel: "~15",
    color: "#DB2777",
    borderColor: "border-[#FECDD3]",
    hoverColor: "hover:bg-pink-50/40",
    bgLight: "#FFF1F2",
    indicators: [
      {
        id: "b4_i0",
        name: "Наполняемость групп к проектной мощности",
        scores: [
          { val: 0.5, desc: "40–60%" },
          { val: 1, desc: "менее 40% или 61–80%" },
          { val: 1.5, desc: "81–100%" },
          { val: 2, desc: "Выше 100% — максимально востребован" }
        ]
      },
      {
        id: "b4_i1",
        name: "Подача данных в НОБД (полнота, срок)",
        scores: [
          { val: 0, desc: "С опозданием или неполные" },
          { val: 2, desc: "В срок, полные, прошли автопроверку" }
        ]
      },
      {
        id: "b4_i2",
        name: "Лицензия и соответствие фактической деятельности",
        scores: [
          { val: -5, desc: "Без лицензии или по отозванной → расторжение ГОЗ", isNegative: true },
          { val: 0, desc: "Есть, с замечаниями" },
          { val: 1.5, desc: "Действующая без замечаний" }
        ]
      },
      {
        id: "b4_i3",
        name: "Обратная связь от родителей (NPS / анкетирование)",
        scores: [
          { val: 0, desc: "Нет механизма" },
          { val: 0.5, desc: "Есть механизм, NPS не измеряется" },
          { val: 1, desc: "NPS 50–70%" },
          { val: 1.5, desc: "NPS 70%+, меры документируются" }
        ]
      }
    ]
  }
];

export default function PreschoolPage() {
  // States for expandable assessment blocks
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({
    block_1: false,
    block_2: false,
    block_3: false,
    block_4: false,
  });

  // States for expandable indicators inside blocks
  const [expandedIndicators, setExpandedIndicators] = useState<Record<string, boolean>>({});

  const toggleBlock = (blockId: string) => {
    setExpandedBlocks(prev => ({ ...prev, [blockId]: !prev[blockId] }));
  };

  const toggleIndicator = (indId: string) => {
    setExpandedIndicators(prev => ({ ...prev, [indId]: !prev[indId] }));
  };

  const { data: stats }       = useApi<EduLevelStats>('/edu-level/do/stats?period_year=2026');
  const { data: sectorStats } = useApi<EduLevelSectorStats>('/edu-level/do/sector-stats?period_year=2026');

  return (
    <>
      {/* Page Header */}
      <PageHeader
        title="Дошкольное воспитание и обучение"
        subtitle="Индикаторная модель развития сферы образования"
      />


      <div className="space-y-6">
            {/* Level Stats Bar */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-fc-sm flex flex-col md:flex-row md:items-center gap-4">
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center font-extrabold text-sm text-white shrink-0 shadow-sm"
                style={{ backgroundColor: "#0D9E6E" }}
              >
                ДОВ
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-slate-800">Дошкольное воспитание и обучение</h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-xs text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1 rounded-full">
                    <b>{stats?.summary.org_count ?? "—"}</b> орг. в системе
                  </span>
                  <span className="text-xs text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1 rounded-full">
                    ГОЗ: <b>{sectorStats?.goz_billion_kzt != null ? Math.round(sectorStats.goz_billion_kzt).toLocaleString('ru-RU') : "—"}</b> млрд тг
                  </span>
                  <span className="text-xs text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1 rounded-full">
                    <b>4</b> блока оценки
                  </span>
                  <span className="text-xs text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1 rounded-full">
                    Шкала: <b>0-100</b> баллов
                  </span>
                </div>
              </div>
            </div>

            {/* Threshold Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border border-green-200 bg-[#F0FDF4] p-4 text-green-800 shadow-fc-sm">
                <span className="block text-xl font-bold font-display tracking-tight text-emerald-700">70-100</span>
                <span className="block text-xs font-semibold mt-1">Сильный</span>
                <p className="text-xs opacity-90 mt-1">Стимулирующий пакет, приоритет инвестиций</p>
                {stats && <span className="block text-xs tabular-nums font-bold mt-2 text-emerald-700">{stats.summary.zones.green} орг.</span>}
              </div>
              <div className="rounded-xl border border-amber-200 bg-[#FFFBEB] p-4 text-amber-800 shadow-fc-sm">
                <span className="block text-xl font-bold font-display tracking-tight text-amber-700">40-69</span>
                <span className="block text-xs font-semibold mt-1">Средний</span>
                <p className="text-xs opacity-90 mt-1">База + план МИО</p>
                {stats && <span className="block text-xs tabular-nums font-bold mt-2 text-amber-700">{stats.summary.zones.yellow} орг.</span>}
              </div>
              <div className="rounded-xl border border-red-200 bg-[#FEF2F2] p-4 text-red-800 shadow-fc-sm">
                <span className="block text-xl font-bold font-display tracking-tight text-red-700">0-39</span>
                <span className="block text-xs font-semibold mt-1">Слабый</span>
                <p className="text-xs opacity-90 mt-1">База + план МИО + надзор</p>
                {stats && <span className="block text-xs tabular-nums font-bold mt-2 text-red-700">{stats.summary.zones.red} орг.</span>}
              </div>
            </div>

            {/* Assessment Blocks Header */}
            <div>
              <h3 className="text-base font-bold text-slate-800">Блоки оценки</h3>
              <p className="text-xs text-slate-400 mt-0.5">Нажмите на блок для раскрытия показателей</p>
            </div>

            {/* Grid of Blocks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {BLOCKS_DATA.map(block => {
                const isOpen = expandedBlocks[block.id];
                return (
                  <div
                    key={block.id}
                    className={`bg-white rounded-xl border border-slate-200 overflow-hidden shadow-fc-sm transition-all duration-200`}
                    style={{ borderTop: `4px solid ${block.color}` }}
                  >
                    <div
                      onClick={() => toggleBlock(block.id)}
                      className={`p-4 flex items-center justify-between cursor-pointer select-none transition-colors ${block.hoverColor}`}
                    >
                      <div className="min-w-0 pr-4">
                        <h4 className="text-sm font-semibold font-display leading-snug" style={{ color: block.color }}>
                          {block.title}
                        </h4>
                        <span className="inline-block mt-1.5 text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          {block.level}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-slate-400">{block.indicatorsCount} показателей</span>
                        <span className="text-xl font-extrabold font-display leading-none" style={{ color: block.color }}>
                          {block.weightLabel}
                        </span>
                        <ChevronDown 
                          className="w-4 h-4 text-slate-400 transition-transform duration-200" 
                          style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                        />
                      </div>
                    </div>

                    {/* Expandable Indicators list */}
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: "auto" }}
                          exit={{ height: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden border-t border-slate-100 divide-y divide-slate-100"
                        >
                          {block.indicators.map(ind => {
                            const isIndOpen = expandedIndicators[ind.id];
                            return (
                              <div key={ind.id} className="bg-slate-50/30">
                                <div
                                  onClick={() => toggleIndicator(ind.id)}
                                  className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                                >
                                  <div className="text-xs font-semibold text-slate-700 flex items-center gap-2 flex-1 pr-4">
                                    {ind.name}
                                    {ind.isGoso && (
                                      <span className="text-[9px] font-bold tracking-wider uppercase bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 shrink-0">
                                        ГОСО
                                      </span>
                                    )}
                                  </div>
                                  <ChevronDown 
                                    className="w-3.5 h-3.5 text-slate-400 transition-transform shrink-0" 
                                    style={{ transform: isIndOpen ? "rotate(180deg)" : "none" }}
                                  />
                                </div>

                                <AnimatePresence>
                                  {isIndOpen && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden px-4 pl-8 bg-white border-t border-slate-100 space-y-1 pt-2 pb-3"
                                    >
                                      {ind.scores.map((score, sIdx) => (
                                        <div
                                          key={sIdx}
                                          className={`flex items-start gap-2.5 p-2 rounded-lg text-xs leading-relaxed ${
                                            score.isNegative 
                                              ? "bg-red-50 text-red-900" 
                                              : "bg-slate-50 text-slate-700"
                                          }`}
                                        >
                                          <span 
                                            className={`w-7 h-5 shrink-0 flex items-center justify-center font-bold text-xs rounded ${
                                              score.isNegative 
                                                ? "bg-red-100 text-red-700"
                                                : "bg-emerald-100 text-emerald-700"
                                            }`}
                                          >
                                            {Number(score.val) > 0 ? `+${score.val}` : score.val}
                                          </span>
                                          <span className="pt-0.5">{score.desc}</span>
                                        </div>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Sub-ratings weights section */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-fc-sm">
              <h3 className="text-base font-bold text-slate-800">Суб-рейтинги и веса блоков</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Единый Индекс — фиксированный, привязан к финансовому решению. Суб-рейтинги — веса перераспределены под конкретный аспект оценки.
              </p>
              
              <div className="mt-4 border border-slate-100 rounded-lg overflow-x-auto">
                <table className="w-full text-xs text-slate-600 border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white font-semibold text-left">
                      <th className="p-3">Суб-рейтинг</th>
                      <th className="p-3 text-center text-[#86EFAC]">Блок I</th>
                      <th className="p-3 text-center text-[#BFDBFE]">Блок II</th>
                      <th className="p-3 text-center text-[#FCD34D]">Блок III</th>
                      <th className="p-3 text-center text-[#FECDD3]">Блок IV</th>
                      <th className="p-3 text-center">Итого</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="font-bold bg-[#EFF6FF] border-y-2 border-blue-200">
                      <td className="p-3 text-slate-800">Единый индекс</td>
                      <td className="p-3 text-center text-slate-700">27%</td>
                      <td className="p-3 text-center text-slate-700">24%</td>
                      <td className="p-3 text-center text-slate-700">33%</td>
                      <td className="p-3 text-center text-slate-700">16%</td>
                      <td className="p-3 text-center text-slate-500">100%</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-800 font-medium">Рейтинг условий</td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-3 py-1 rounded font-bold text-white text-[10px]" style={{ backgroundColor: "#0D9E6E" }}>42%</span>
                      </td>
                      <td className="p-3 text-center">19%</td>
                      <td className="p-3 text-center">28%</td>
                      <td className="p-3 text-center">11%</td>
                      <td className="p-3 text-center font-semibold text-slate-500">100%</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-800 font-medium">Рейтинг готовности к школе</td>
                      <td className="p-3 text-center">22%</td>
                      <td className="p-3 text-center">19%</td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-3 py-1 rounded font-bold text-white text-[10px]" style={{ backgroundColor: "#D97706" }}>48%</span>
                      </td>
                      <td className="p-3 text-center">11%</td>
                      <td className="p-3 text-center font-semibold text-slate-500">100%</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-800 font-medium">Рейтинг кадров</td>
                      <td className="p-3 text-center">22%</td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-3 py-1 rounded font-bold text-white text-[10px]" style={{ backgroundColor: "#2563EB" }}>39%</span>
                      </td>
                      <td className="p-3 text-center">28%</td>
                      <td className="p-3 text-center">11%</td>
                      <td className="p-3 text-center font-semibold text-slate-500">100%</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-800 font-medium">Рейтинг прозрачности</td>
                      <td className="p-3 text-center">22%</td>
                      <td className="p-3 text-center">19%</td>
                      <td className="p-3 text-center">28%</td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-3 py-1 rounded font-bold text-white text-[10px]" style={{ backgroundColor: "#DB2777" }}>31%</span>
                      </td>
                      <td className="p-3 text-center font-semibold text-slate-500">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
      </div>
    </>
  );
}
