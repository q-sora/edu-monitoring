// src/features/edu-level/SchoolPage.tsx
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

const BLOCKS_DATA: AssessmentBlock[] = [
  {
    id: "block_1",
    title: "I. Инфраструктура и безопасность",
    level: "Школа в целом",
    indicatorsCount: 8,
    weightLabel: "~22",
    color: "#0D9E6E",
    borderColor: "border-[#86EFAC]",
    hoverColor: "hover:bg-emerald-50/40",
    bgLight: "#F0FDF4",
    indicators: [
      {
        id: "b1_i0",
        name: "Техническое состояние здания",
        scores: [
          { val: -3, desc: "Требует капремонта — аварийное", isNegative: true },
          { val: -2, desc: "Требует текущего ремонта", isNegative: true },
          { val: 1, desc: "Проведён текущий ремонт" },
          { val: 0.5, desc: "Не требует ремонта" },
          { val: 2, desc: "Проведён капремонт" }
        ]
      },
      {
        id: "b1_i1",
        name: "СанПиН (наполняемость классов, площадь)",
        isGoso: true,
        scores: [
          { val: -2, desc: "Нарушение СанПиН по наполняемости", isNegative: true },
          { val: 0, desc: "Незначительные нарушения" },
          { val: 2, desc: "Соответствует" },
          { val: 3, desc: "С запасом — комфортные классы" }
        ]
      },
      {
        id: "b1_i2",
        name: "Спортзал и спортплощадка",
        isGoso: true,
        scores: [
          { val: 0, desc: "Нет ни зала, ни площадки" },
          { val: 1, desc: "Есть одно из двух" },
          { val: 2, desc: "Есть оба объекта" }
        ]
      },
      {
        id: "b1_i3",
        name: "Предметные лаборатории (физика, химия, биология) — доля оснащённых",
        isGoso: true,
        scores: [
          { val: 1, desc: "30–50% (Лига 3: 15–30%) оснащены" },
          { val: 2, desc: "51–80%" },
          { val: 3, desc: "81%+" }
        ]
      },
      {
        id: "b1_i4",
        name: "Компьютерный класс: учеников на 1 ПК к нормативу",
        isGoso: true,
        scores: [
          { val: 1, desc: "Более 5 учеников на ПК" },
          { val: 2, desc: "3–5 учеников" },
          { val: 3, desc: "Менее 3 учеников" }
        ]
      },
      {
        id: "b1_i5",
        name: "Система безопасности (СКУД, видео, тревожная кнопка)",
        scores: [
          { val: 0, desc: "Отсутствует" },
          { val: 1, desc: "Частично" },
          { val: 2, desc: "Полный комплект" }
        ]
      },
      {
        id: "b1_i6",
        name: "Организация питания (охват, соответствие нормам)",
        scores: [
          { val: 0, desc: "Охват менее 30%" },
          { val: 1, desc: "30-69%" },
          { val: 1.5, desc: "70–89%" },
          { val: 2, desc: "90%+, нет замечаний" }
        ]
      },
      {
        id: "b1_i7",
        name: "Библиотека / медиатека (охват, обновление фонда)",
        scores: [
          { val: 0.5, desc: "Устаревший фонд (>10 лет)" },
          { val: 1, desc: "Обновляется, охват 50–70%" },
          { val: 1.5, desc: "Медиатека + цифровые ресурсы, охват 70%+" }
        ]
      }
    ]
  },
  {
    id: "block_2",
    title: "II. Кадровое обеспечение",
    level: "Школа в целом",
    indicatorsCount: 7,
    weightLabel: "~22",
    color: "#2563EB",
    borderColor: "border-[#BFDBFE]",
    hoverColor: "hover:bg-blue-50/40",
    bgLight: "#EFF6FF",
    indicators: [
      {
        id: "b2_i0",
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
        id: "b2_i1",
        name: "Педагоги с профильной магистратурой / PhD",
        isGoso: true,
        scores: [
          { val: 0, desc: "Нет" },
          { val: 0.5, desc: "1–5%" },
          { val: 1, desc: "6–15%" },
          { val: 1.5, desc: "16–25%" },
          { val: 2, desc: "26%+" }
        ]
      },
      {
        id: "b2_i2",
        name: "Повышение квалификации педагогов",
        isGoso: true,
        scores: [
          { val: 1, desc: "20–40%" },
          { val: 1.5, desc: "41–60%" },
          { val: 2, desc: "61%+" }
        ]
      },
      {
        id: "b2_i3",
        name: "Психолог, логопед, дефектолог",
        isGoso: true,
        scores: [
          { val: -1, desc: "Нет при наличии детей с ОПП", isNegative: true },
          { val: 0, desc: "Нет, детей с ОПП нет" },
          { val: 1.5, desc: "Есть 1 специалист" },
          { val: 2.5, desc: "Полный комплект" }
        ]
      },
      {
        id: "b2_i4",
        name: "Победители 'Лучший учитель' / республиканских конкурсов",
        scores: [
          { val: 0, desc: "Нет" },
          { val: 1, desc: "Есть" },
          { val: 1, desc: "за каждого дополнительного" }
        ]
      },
      {
        id: "b2_i5",
        name: "Текучесть кадров (обратный)",
        scores: [
          { val: 0, desc: "Более 30%" },
          { val: 1, desc: "20–30%" },
          { val: 1.5, desc: "10–20%" },
          { val: 2, desc: "Менее 10%" }
        ]
      },
      {
        id: "b2_i6",
        name: "Инклюзия: охват детей с ОПП",
        isGoso: true,
        scores: [
          { val: 0, desc: "Нет условий" },
          { val: 1, desc: "Базовые условия" },
          { val: 2, desc: "Системная инклюзия: спец. педагог + среда + план" }
        ]
      }
    ]
  },
  {
    id: "block_3",
    title: "III. Образовательные результаты (с Value-Added)",
    level: "Школа в целом",
    indicatorsCount: 7,
    weightLabel: "~40",
    color: "#D97706",
    borderColor: "border-[#FCD34D]",
    hoverColor: "hover:bg-amber-50/40",
    bgLight: "#FFFBEB",
    indicators: [
      {
        id: "b3_i0",
        name: "VALUE-ADDED — добавленная стоимость знаний (МОДО-когорта)",
        isGoso: true,
        scores: [
          { val: 0, desc: "Дельта отрицательная: ученики деградируют к 9 классу" },
          { val: 3, desc: "Дельта нулевая ±5% от среднего по лиге" },
          { val: 7, desc: "Выше среднего по лиге на 10–25%" },
          { val: 10, desc: "Выше среднего по лиге на 25%+ — лидер добавленной стоимости" }
        ]
      },
      {
        id: "b3_i1",
        name: "Результаты ЕНТ / МОДО (% выше среднего ПО ЛИГЕ)",
        isGoso: true,
        scores: [
          { val: 1, desc: "Ниже среднего по лиге" },
          { val: 3, desc: "На уровне среднего" },
          { val: 5, desc: "На 10–25% выше среднего по лиге" },
          { val: 8, desc: "На 25%+ выше — явный лидер лиги" }
        ]
      },
      {
        id: "b3_i2",
        name: "Функциональная грамотность (PISA-типовые оценки МП)",
        isGoso: true,
        scores: [
          { val: 1, desc: "Ниже базового" },
          { val: 2, desc: "Базовый" },
          { val: 3, desc: "Выше базового" },
          { val: 4, desc: "Высокий уровень" },
          { val: 1, desc: "60–75%" },
          { val: 2, desc: "76–85%" },
          { val: 3, desc: "86–95%" },
          { val: 4, desc: "96–100%" }
        ]
      },
      {
        id: "b3_i3",
        name: "Качество обучения (доля '4' и '5')",
        scores: [
          { val: 1, desc: "20–40%" },
          { val: 1.5, desc: "41–60%" },
          { val: 2, desc: "61–80%" },
          { val: 2.5, desc: "81–100%" }
        ]
      },
      {
        id: "b3_i4",
        name: "Отсев / выбытие контингента (обратный)",
        scores: [
          { val: -2, desc: "Отсев >10% без обоснования — системная проблема", isNegative: true },
          { val: 1, desc: "До 5%" },
          { val: 1.5, desc: "До 3%" },
          { val: 2, desc: "До 1% или все с обоснованием" }
        ]
      },
      {
        id: "b3_i5",
        name: "'Алтын белгі' и президентские стипендии",
        scores: [
          { val: 0, desc: "Нет" },
          { val: 1, desc: "1 выпускник" },
          { val: 2, desc: "2–3" },
          { val: 3, desc: "4+" }
        ]
      },
      {
        id: "b3_i6",
        name: "Победители олимпиад (областной / республиканский / международный)",
        isGoso: true,
        scores: [
          { val: 1, desc: "Областной уровень" },
          { val: 2.5, desc: "Республиканский" },
          { val: 4, desc: "Международный" },
          { val: 1, desc: "30-40%" },
          { val: 1.5, desc: "40–60%" },
          { val: 2, desc: "61%+" }
        ]
      }
    ]
  },
  {
    id: "block_4",
    title: "IV. Управление и партнёрство",
    level: "Школа в целом",
    indicatorsCount: 6,
    weightLabel: "~18",
    color: "#DB2777",
    borderColor: "border-[#FECDD3]",
    hoverColor: "hover:bg-pink-50/40",
    bgLight: "#FFF1F2",
    indicators: [
      {
        id: "b4_i0",
        name: "Данные в НОБД: полнота и срок",
        isGoso: true,
        scores: [
          { val: -3, desc: "Не поданы → блокировка переменной части", isNegative: true },
          { val: 0, desc: "С нарушениями" },
          { val: 2, desc: "В срок, полные" }
        ]
      },
      {
        id: "b4_i1",
        name: "Обратная связь от родителей (NPS)",
        scores: [
          { val: 0, desc: "Нет механизма" },
          { val: 0.5, desc: "Есть механизм" },
          { val: 1, desc: "NPS 50–70%" },
          { val: 1.5, desc: "NPS 70%+, меры документируются" }
        ]
      },
      {
        id: "b4_i2",
        name: "Внеурочная деятельность: охват учеников",
        isGoso: true,
        scores: [
          { val: 0, desc: "Нет" },
          { val: 1, desc: "До 30%" },
          { val: 1.5, desc: "31–60%" },
          { val: 2, desc: "61%+" }
        ]
      },
      {
        id: "b4_i3",
        name: "Наполняемость к проектной мощности",
        scores: [
          { val: 0.5, desc: "Менее 50%" },
          { val: 1, desc: "50–70%" },
          { val: 1.5, desc: "71–90%" },
          { val: 2, desc: "91%+" }
        ]
      },
      {
        id: "b4_i4",
        name: "Лицензия и отсутствие предписаний надзорных органов",
        scores: [
          { val: -3, desc: "Без лицензии или приостановление по предписанию", isNegative: true },
          { val: 0, desc: "Есть замечания" },
          { val: 1.5, desc: "Лицензия без замечаний" }
        ]
      },
      {
        id: "b4_i5",
        name: "Связь с ДОВ: мониторинг входящих 1-классников (сквозная оценка)",
        isGoso: true,
        scores: [
          { val: 0, desc: "Тестирование не проводится / данные не передаются" },
          { val: 1.5, desc: "Тестирование проводится, данные идут в НОБД → ДОВ получает обратную связь" }
        ]
      }
    ]
  }
];

export default function SchoolPage() {
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

  const { data: stats }       = useApi<EduLevelStats>('/edu-level/so/stats?period_year=2026');
  const { data: sectorStats } = useApi<EduLevelSectorStats>('/edu-level/so/sector-stats?period_year=2026');

  return (
    <>
      {/* Page Header */}
      <PageHeader
        title="Среднее образование"
        subtitle="Индикаторная модель развития сферы образования"
      />

      <div className="space-y-6">
            {/* Level Stats Bar */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-fc-sm flex flex-col md:flex-row md:items-center gap-4">
              <span 
                className="w-14 h-14 rounded-xl flex items-center justify-center font-extrabold text-sm text-white shrink-0 shadow-sm bg-blue-600"
              >
                СО
              </span>
              <div className="flex-1">
                <h2 className="text-base font-bold text-slate-800">Среднее образование</h2>
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
                <span className="block text-xs font-semibold mt-1">Сильная школа</span>
                <p className="text-xs opacity-90 mt-1">Стимул + KPI на рост</p>
                {stats && <span className="block text-xs tabular-nums font-bold mt-2 text-emerald-700">{stats.summary.zones.green} орг.</span>}
              </div>
              <div className="rounded-xl border border-amber-200 bg-[#FFFBEB] p-4 text-amber-800 shadow-fc-sm">
                <span className="block text-xl font-bold font-display tracking-tight text-amber-700">40-69</span>
                <span className="block text-xs font-semibold mt-1">Средняя</span>
                <p className="text-xs opacity-90 mt-1">База + план МИО</p>
                {stats && <span className="block text-xs tabular-nums font-bold mt-2 text-amber-700">{stats.summary.zones.yellow} орг.</span>}
              </div>
              <div className="rounded-xl border border-red-200 bg-[#FEF2F2] p-4 text-red-800 shadow-fc-sm">
                <span className="block text-xl font-bold font-display tracking-tight text-red-700">0-39</span>
                <span className="block text-xs font-semibold mt-1">Слабая</span>
                <p className="text-xs opacity-90 mt-1">База + усиленный надзор</p>
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
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-fc-sm transition-all duration-200"
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
                      <td className="p-3 text-center text-slate-700">22%</td>
                      <td className="p-3 text-center text-slate-700">21%</td>
                      <td className="p-3 text-center text-slate-700">40%</td>
                      <td className="p-3 text-center text-slate-700">17%</td>
                      <td className="p-3 text-center text-slate-500">100%</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-800 font-medium">Рейтинг инфраструктуры</td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-3 py-1 rounded font-bold text-white text-[10px]" style={{ backgroundColor: "#0D9E6E" }}>37%</span>
                      </td>
                      <td className="p-3 text-center">16%</td>
                      <td className="p-3 text-center">35%</td>
                      <td className="p-3 text-center">12%</td>
                      <td className="p-3 text-center font-semibold text-slate-500">100%</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-800 font-medium">Рейтинг кадров</td>
                      <td className="p-3 text-center">17%</td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-3 py-1 rounded font-bold text-white text-[10px]" style={{ backgroundColor: "#2563EB" }}>36%</span>
                      </td>
                      <td className="p-3 text-center">35%</td>
                      <td className="p-3 text-center">12%</td>
                      <td className="p-3 text-center font-semibold text-slate-500">100%</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-800 font-medium">Рейтинг результатов</td>
                      <td className="p-3 text-center">17%</td>
                      <td className="p-3 text-center">16%</td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-3 py-1 rounded font-bold text-white text-[10px]" style={{ backgroundColor: "#D97706" }}>55%</span>
                      </td>
                      <td className="p-3 text-center">12%</td>
                      <td className="p-3 text-center font-semibold text-slate-500">100%</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-800 font-medium">Рейтинг управления</td>
                      <td className="p-3 text-center">17%</td>
                      <td className="p-3 text-center">16%</td>
                      <td className="p-3 text-center">35%</td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-3 py-1 rounded font-bold text-white text-[10px]" style={{ backgroundColor: "#DB2777" }}>32%</span>
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
