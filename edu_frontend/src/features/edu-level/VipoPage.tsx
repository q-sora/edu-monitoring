// src/features/edu-level/VipoPage.tsx
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
    title: "I. Инфраструктура и цифровизация",
    level: "ОВПО в целом",
    indicatorsCount: 7,
    weightLabel: "~18",
    color: "#0D9E6E",
    borderColor: "border-[#86EFAC]",
    hoverColor: "hover:bg-emerald-50/40",
    bgLight: "#F0FDF4",
    indicators: [
      {
        id: "b1_i0",
        name: "Обеспеченность учебными площадями и корпусами согласно нормам СЭС",
        isGoso: true,
        scores: [
          { val: 0.5, desc: "Дефицит учебных площадей, обучение в 3 смены" },
          { val: 1.5, desc: "Соответствие площадей нормативам при 2-сменном обучении" },
          { val: 2, desc: "Полная обеспеченность, современный кампус с зонами коворкинга" }
        ]
      },
      {
        id: "b1_i1",
        name: "Оснащенность научно-исследовательских лабораторий и инновационных центров",
        scores: [
          { val: 0.5, desc: "Устаревшая лабораторная база, отсутствие современного оборудования" },
          { val: 1.5, desc: "Наличие базовых лабораторий, частичное обновление оборудования" },
          { val: 2.5, desc: "Передовые исследовательские центры, наличие уникального оборудования и технопарков" }
        ]
      },
      {
        id: "b1_i2",
        name: "Цифровые сервисы для студентов и ППС (LMS, личные кабинеты, портал)",
        isGoso: true,
        scores: [
          { val: 0.5, desc: "Фрагментарное внедрение ИС, отсутствие полноценной LMS" },
          { val: 1.5, desc: "Функционирует базовая LMS, электронные зачетки и журналы" },
          { val: 2, desc: "Интегрированная цифровая экосистема, мобильное приложение, прокторинг-системы" }
        ]
      },
      {
        id: "b1_i3",
        name: "Обеспеченность студентов местами в общежитиях",
        scores: [
          { val: -1, desc: "Острая нехватка мест (удовлетворенность спроса менее 50%)", isNegative: true },
          { val: 1, desc: "Обеспечение местами от 50% до 85% нуждающихся" },
          { val: 2, desc: "Удовлетворенность спроса более 85% или наличие программ компенсации жилья" }
        ]
      },
      {
        id: "b1_i4",
        name: "Объем электронного библиотечного фонда и подписки на базы данных (Scopus, WoS)",
        scores: [
          { val: 0.5, desc: "Минимальный доступ к международным базам, преимущественно бумажный фонд" },
          { val: 1.5, desc: "Доступ к ключевым базам данных, электронная библиотека вуза" },
          { val: 2.5, desc: "Неограниченный доступ к Scopus, WoS, Springer, развитый собственный репозиторий" }
        ]
      },
      {
        id: "b1_i5",
        name: "Доступность скоростного интернета и Wi-Fi в учебных зонах и общежитиях",
        scores: [
          { val: 0, desc: "Скорость менее 30 Мбит/с, нестабильное покрытие" },
          { val: 1, desc: "Скорость 30-100 Мбит/с, покрытие в учебных аудиториях" },
          { val: 2, desc: "Бесшовный скоростной Wi-Fi (более 100 Мбит/с) по всей территории кампуса" }
        ]
      },
      {
        id: "b1_i6",
        name: "Инклюзивная доступность кампуса (безбарьерная среда)",
        isGoso: true,
        scores: [
          { val: 0.5, desc: "Частичная доступность (только пандусы на входе)" },
          { val: 1.5, desc: "Безбарьерная среда во всех учебных корпусах и общежитиях" }
        ]
      }
    ]
  },
  {
    id: "block_2",
    title: "II. Кадровый потенциал и наука",
    level: "ОВПО в целом",
    indicatorsCount: 7,
    weightLabel: "~25",
    color: "#2563EB",
    borderColor: "border-[#BFDBFE]",
    hoverColor: "hover:bg-blue-50/40",
    bgLight: "#EFF6FF",
    indicators: [
      {
        id: "b2_i0",
        name: "Доля ППС с учеными степенями (доктор наук, кандидат наук, PhD)",
        isGoso: true,
        scores: [
          { val: 0.5, desc: "Остепененность менее 40%" },
          { val: 1.5, desc: "Остепененность от 40% до 60%" },
          { val: 2.5, desc: "Остепененность свыше 60%" }
        ]
      },
      {
        id: "b2_i1",
        name: "Индекс цитируемости ППС и публикации в журналах Q1/Q2 (Scopus/WoS)",
        scores: [
          { val: 0.5, desc: "Единичные публикации за последние 3 года" },
          { val: 1.5, desc: "Более 0.5 публикаций на одного преподавателя в год в индексируемых базах" },
          { val: 3, desc: "Высокая публикационная активность (более 1.0 публикации в год на ППС, высокая цитируемость)" }
        ]
      },
      {
        id: "b2_i2",
        name: "Объем финансирования НИОКР на одного штатного преподавателя",
        scores: [
          { val: 0.5, desc: "НИОКР финансируется преимущественно за счет собственных средств вуза" },
          { val: 1.5, desc: "Привлечение внешнего грантового финансирования" },
          { val: 2.5, desc: "Высокий объем хоздоговорных и грантовых исследований (свыше 1 млн тенге на ППС)" }
        ]
      },
      {
        id: "b2_i3",
        name: "Доля иностранных преподавателей и исследователей в штате",
        scores: [
          { val: 0, desc: "Иностранные преподаватели отсутствуют" },
          { val: 1, desc: "Доля зарубежных лекторов составляет от 1% до 5%" },
          { val: 2, desc: "Доля зарубежных лекторов и исследователей более 5%" }
        ]
      },
      {
        id: "b2_i4",
        name: "Участие университета в международных и республиканских научных проектах",
        scores: [
          { val: 0.5, desc: "Участие ограничено внутривузовскими грантами" },
          { val: 1.5, desc: "Участие в грантах министерств, АО «Финансовый центр» и международных фондов" }
        ]
      },
      {
        id: "b2_i5",
        name: "Программы академической мобильности и стажировок ППС в ведущих мировых вузах",
        scores: [
          { val: 0.5, desc: "Академическая мобильность ППС отсутствует или носит единичный характер" },
          { val: 1.5, desc: "Регулярные стажировки (более 10% ППС ежегодно проходят зарубежное обучение)" }
        ]
      },
      {
        id: "b2_i6",
        name: "Участие ученых университета в редколлегиях авторитетных научных изданий",
        scores: [
          { val: 0.5, desc: "Членство в редколлегиях ограничено вестниками вуза" },
          { val: 1.5, desc: "Представители ППС входят в редколлегии журналов, индексируемых в Scopus/WoS" }
        ]
      }
    ]
  },
  {
    id: "block_3",
    title: "III. Образовательные результаты",
    level: "ОВПО в целом",
    indicatorsCount: 7,
    weightLabel: "~32",
    color: "#D97706",
    borderColor: "border-[#FCD34D]",
    hoverColor: "hover:bg-amber-50/40",
    bgLight: "#FFFBEB",
    indicators: [
      {
        id: "b3_i0",
        name: "Доля образовательных программ, прошедших международную аккредитацию",
        isGoso: true,
        scores: [
          { val: 0.5, desc: "Менее 30% образовательных программ аккредитованы международными агентствами" },
          { val: 1.5, desc: "От 30% до 70% образовательных программ" },
          { val: 2.5, desc: "Свыше 70% программ имеют аккредитацию в признанных зарубежных агентствах" }
        ]
      },
      {
        id: "b3_i1",
        name: "Результаты независимого тестирования и ВОУД",
        scores: [
          { val: 0.5, desc: "Результаты ниже средних показателей по стране в соответствующем кластере" },
          { val: 1.5, desc: "На уровне средних показателей ±10%" },
          { val: 2, desc: "Результаты значительно превышают средние по стране" }
        ]
      },
      {
        id: "b3_i2",
        name: "Доля студентов, обучающихся по программам двудипломного образования",
        scores: [
          { val: 0, desc: "Программы двойного диплома отсутствуют" },
          { val: 1, desc: "Доля студентов составляет от 1% до 5%" },
          { val: 2, desc: "Более 5% студентов обучаются по программам двойного диплома с зарубежными вузами-партнерами" }
        ]
      },
      {
        id: "b3_i3",
        name: "Участие студентов в международных и республиканских олимпиадах и конкурсах",
        scores: [
          { val: 0.5, desc: "Редкое участие без призовых мест" },
          { val: 1.5, desc: "Регулярное завоевание призовых мест на республиканских олимпиадах" },
          { val: 2.5, desc: "Победители и призеры престижных международных конкурсов, хакатонов и олимпиад" }
        ]
      },
      {
        id: "b3_i4",
        name: "Сохранность контингента студентов (минимальный уровень отсева)",
        scores: [
          { val: -1.5, desc: "Уровень отсева превышает 15% за учебный год (негативный фактор)", isNegative: true },
          { val: 0.5, desc: "Уровень отсева в пределах 5-15%" },
          { val: 1.5, desc: "Уровень отсева менее 5% (высокая мотивация и поддержка студентов)" }
        ]
      },
      {
        id: "b3_i5",
        name: "Доля выпускников бакалавриата, продолживших обучение в магистратуре/докторантуре",
        scores: [
          { val: 0.5, desc: "Менее 10% выпускников продолжают академическую траекторию" },
          { val: 1.5, desc: "От 10% до 25% выпускников" },
          { val: 2, desc: "Более 25% выпускников поступают в магистратуру/докторантуру" }
        ]
      },
      {
        id: "b3_i6",
        name: "Уровень удовлетворенности студентов образовательным процессом",
        scores: [
          { val: 0.5, desc: "Индекс NPS ниже 60%" },
          { val: 1.5, desc: "Индекс NPS от 60% до 80%" },
          { val: 2.5, desc: "Индекс NPS выше 80% (высокая оценка качества преподавания)" }
        ]
      }
    ]
  },
  {
    id: "block_4",
    title: "IV. Трудоустройство и взаимодействие с экономикой",
    level: "ОВПО в целом",
    indicatorsCount: 4,
    weightLabel: "~25",
    color: "#DB2777",
    borderColor: "border-[#FECDD3]",
    hoverColor: "hover:bg-pink-50/40",
    bgLight: "#FDF2F8",
    indicators: [
      {
        id: "b4_i0",
        name: "Доля трудоустроенных выпускников в первый год после окончания (по данным ГЦВП)",
        isGoso: true,
        scores: [
          { val: 0.5, desc: "Менее 65% выпускников трудоустроены" },
          { val: 2, desc: "От 65% до 85% выпускников" },
          { val: 3.5, desc: "Свыше 85% выпускников успешно трудоустроены в первый год" }
        ]
      },
      {
        id: "b4_i1",
        name: "Соответствие сферы деятельности выпускников полученной специальности (работа по профилю)",
        isGoso: true,
        scores: [
          { val: 0.5, desc: "Менее 50% выпускников работают по специальности" },
          { val: 1.5, desc: "От 50% до 75% выпускников" },
          { val: 3, desc: "Свыше 75% выпускников трудоустроены строго по профилю подготовки" }
        ]
      },
      {
        id: "b4_i2",
        name: "Объем коммерциализации результатов научной деятельности (патенты, лицензии, стартапы)",
        scores: [
          { val: 0.5, desc: "Отсутствие зарегистрированных коммерческих эффектов" },
          { val: 1.5, desc: "Регистрация патентов, наличие единичных хоздоговорных внедрений" },
          { val: 3, desc: "Высокий доход от коммерциализации, успешные стартапы на базе вуза" }
        ]
      },
      {
        id: "b4_i3",
        name: "Совместные образовательные программы и базовые кафедры с индустриальными партнерами",
        scores: [
          { val: 0.5, desc: "Взаимодействие ограничено только прохождением практики" },
          { val: 1.5, desc: "Функционируют совместные лаборатории и базовые кафедры крупных компаний" }
        ]
      }
    ]
  }
];

export default function VipoPage() {
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

  const { data: stats }       = useApi<EduLevelStats>('/edu-level/vipo/stats?period_year=2026');
  const { data: sectorStats } = useApi<EduLevelSectorStats>('/edu-level/vipo/sector-stats?period_year=2026');

  return (
    <>
      {/* Page Header */}
      <PageHeader
        title="Высшее и послевузовское образование"
        subtitle="Индикаторная модель развития сферы образования"
      />

      <div className="space-y-6">
            {/* Level Stats Bar */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-fc-sm flex flex-col md:flex-row md:items-center gap-4">
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center font-extrabold text-xs text-white shrink-0 shadow-sm"
                style={{ backgroundColor: "#7C3AED" }}
              >
                ОВПО
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-slate-800">Высшее и послевузовское образование</h2>
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
                <span className="block text-xs font-semibold mt-1">Ведущий</span>
                <p className="text-xs opacity-90 mt-1">Стимул + КУ + инвест. план + наставничество</p>
                {stats && <span className="block text-xs tabular-nums font-bold mt-2 text-emerald-700">{stats.summary.zones.green} орг.</span>}
              </div>
              <div className="rounded-xl border border-amber-200 bg-[#FFFBEB] p-4 text-amber-800 shadow-fc-sm">
                <span className="block text-xl font-bold font-display tracking-tight text-amber-700">40-69</span>
                <span className="block text-xs font-semibold mt-1">Развивающийся</span>
                <p className="text-xs opacity-90 mt-1">База + план ФЦ</p>
                {stats && <span className="block text-xs tabular-nums font-bold mt-2 text-amber-700">{stats.summary.zones.yellow} орг.</span>}
              </div>
              <div className="rounded-xl border border-red-200 bg-[#FEF2F2] p-4 text-red-800 shadow-fc-sm">
                <span className="block text-xl font-bold font-display tracking-tight text-red-700">0-39</span>
                <span className="block text-xs font-semibold mt-1">Под наблюдением</span>
                <p className="text-xs opacity-90 mt-1">База + риск ревизии лицензии</p>
                {stats && <span className="block text-xs tabular-nums font-bold mt-2 text-red-700">{stats.summary.zones.red} орг.</span>}
              </div>
            </div>

            {/* Assessment Blocks Header */}
            <div>
              <h3 className="text-base font-bold text-slate-800">Блоки оценки <span className="text-xs text-slate-400 font-normal ml-2">— нажмите на блок для раскрытия</span></h3>
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
                      <td className="p-3 text-center text-slate-700">18%</td>
                      <td className="p-3 text-center text-slate-700">22%</td>
                      <td className="p-3 text-center text-slate-700">35%</td>
                      <td className="p-3 text-center text-slate-700">25%</td>
                      <td className="p-3 text-center text-slate-500">100%</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-800 font-medium">Рейтинг инфраструктуры</td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-3 py-1 rounded font-bold text-white text-[10px]" style={{ backgroundColor: "#0D9E6E" }}>33%</span>
                      </td>
                      <td className="p-3 text-center">17%</td>
                      <td className="p-3 text-center">30%</td>
                      <td className="p-3 text-center">20%</td>
                      <td className="p-3 text-center font-semibold text-slate-500">100%</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-800 font-medium">Рейтинг кадров</td>
                      <td className="p-3 text-center">13%</td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-3 py-1 rounded font-bold text-white text-[10px]" style={{ backgroundColor: "#2563EB" }}>37%</span>
                      </td>
                      <td className="p-3 text-center">30%</td>
                      <td className="p-3 text-center">20%</td>
                      <td className="p-3 text-center font-semibold text-slate-500">100%</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-800 font-medium">Рейтинг результатов</td>
                      <td className="p-3 text-center">13%</td>
                      <td className="p-3 text-center">17%</td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-3 py-1 rounded font-bold text-white text-[10px]" style={{ backgroundColor: "#D97706" }}>50%</span>
                      </td>
                      <td className="p-3 text-center">20%</td>
                      <td className="p-3 text-center font-semibold text-slate-500">100%</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-800 font-medium">Рейтинг трудоустройства</td>
                      <td className="p-3 text-center">13%</td>
                      <td className="p-3 text-center">17%</td>
                      <td className="p-3 text-center">30%</td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-3 py-1 rounded font-bold text-white text-[10px]" style={{ backgroundColor: "#DB2777" }}>40%</span>
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
