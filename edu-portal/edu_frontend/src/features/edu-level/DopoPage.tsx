// src/features/edu-level/DopoPage.tsx
import React, { useState } from "react";
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
    title: "I. Условия и доступность",
    level: "Организация в целом",
    indicatorsCount: 7,
    weightLabel: "~20",
    color: "#0D9E6E",
    borderColor: "border-[#86EFAC]",
    hoverColor: "hover:bg-emerald-50/40",
    bgLight: "#F0FDF4",
    indicators: [
      {
        id: "b1_i0",
        name: "Обеспеченность специализированными кабинетами, студиями и залами",
        scores: [
          { val: 0, desc: "Отсутствуют специализированные залы, занятия проводятся в общих учебных классах" },
          { val: 1, desc: "Частичная обеспеченность (например, есть хореографический зал, но нет мастерских)" },
          { val: 2.5, desc: "Полное соответствие направленности программ (залы, мастерские, лаборатории, студии звукозаписи)" }
        ]
      },
      {
        id: "b1_i1",
        name: "Территориальная доступность и удобство расположения для детей",
        scores: [
          { val: 0.5, desc: "Расположение в удаленном районе, отсутствие прямого общественного транспорта" },
          { val: 1.5, desc: "Хорошая транспортная доступность, наличие пешеходных переходов" },
          { val: 2, desc: "Центральное расположение или наличие организованной доставки/подвозки детей" }
        ]
      },
      {
        id: "b1_i2",
        name: "Доступность для детей из социально уязвимых категорий (инклюзия, льготы)",
        isGoso: true,
        scores: [
          { val: 0.5, desc: "Льготы не предусмотрены, инфраструктура для детей с ООП отсутствует" },
          { val: 1.5, desc: "Предусмотрены базовые квоты/скидки, установлены пандусы" },
          { val: 3, desc: "Адаптированные программы, специальные педагоги, 100% обеспечение льготных категорий" }
        ]
      },
      {
        id: "b1_i3",
        name: "Техническое состояние здания и прилегающей территории",
        scores: [
          { val: -1.5, desc: "Здание требует капитального ремонта (износ более 50%)", isNegative: true },
          { val: 1, desc: "Здание находится в хорошем эксплуатационном состоянии, благоустроенная территория" },
          { val: 2, desc: "Капитальный ремонт проведен в последние 3 года или новое здание" }
        ]
      },
      {
        id: "b1_i4",
        name: "Оснащенность современными техническими средствами обучения (ТСО)",
        isGoso: true,
        scores: [
          { val: 0.5, desc: "Базовые учебные доски, компьютеры устарели (износ более 70%)" },
          { val: 1.5, desc: "Наличие интерактивных панелей, доступ к сети Интернет в учебных классах" },
          { val: 2.5, desc: "Современные специализированные комплексы (робототехника, 3D-принтеры, графические станции)" }
        ]
      },
      {
        id: "b1_i5",
        name: "Обеспеченность учебными материалами, музыкальными инструментами и инвентарем",
        scores: [
          { val: 0.5, desc: "Ученики приобретают материалы и инвентарь полностью самостоятельно" },
          { val: 1.5, desc: "Частичное предоставление (основные инструменты в наличии, расходные материалы за счет родителей)" },
          { val: 2.5, desc: "100% обеспечение качественным профессиональным инвентарем и расходными материалами" }
        ]
      },
      {
        id: "b1_i6",
        name: "Режим работы организации и удобство расписания занятий",
        scores: [
          { val: 0.5, desc: "Расписание не учитывает сменность обучения в общеобразовательных школах" },
          { val: 1.5, desc: "Удобная сетка занятий в две смены, работа в выходные дни" }
        ]
      }
    ]
  },
  {
    id: "block_2",
    title: "II. Педагогический состав",
    level: "Организация в целом",
    indicatorsCount: 6,
    weightLabel: "~22",
    color: "#2563EB",
    borderColor: "border-[#BFDBFE]",
    hoverColor: "hover:bg-blue-50/40",
    bgLight: "#EFF6FF",
    indicators: [
      {
        id: "b2_i0",
        name: "Доля педагогов с высшим профильным образованием по направлению программ",
        isGoso: true,
        scores: [
          { val: 0.5, desc: "Менее 50% педагогов" },
          { val: 1.5, desc: "От 50% до 80% педагогов" },
          { val: 2.5, desc: "Более 80% педагогов имеют профильное (художественное, спортивное, музыкальное) образование" }
        ]
      },
      {
        id: "b2_i1",
        name: "Доля преподавателей высшей и первой квалификационных категорий",
        scores: [
          { val: 0.5, desc: "Менее 25% от общего числа сотрудников" },
          { val: 1.5, desc: "От 25% до 50% сотрудников" },
          { val: 2.5, desc: "Более 50% сотрудников имеют высшую/первую категории или почетные звания" }
        ]
      },
      {
        id: "b2_i2",
        name: "Прохождение курсов повышения квалификации и стажировок за последние 3 года",
        isGoso: true,
        scores: [
          { val: 0.5, desc: "Курсы прошли менее 60% педагогов в плановые сроки" },
          { val: 1.5, desc: "Курсы прошли от 60% до 90% педагогов" },
          { val: 2.5, desc: "100% выполнение плана повышения квалификации, прохождение профильных мастер-классов" }
        ]
      },
      {
        id: "b2_i3",
        name: "Доля педагогов с почетными званиями, наградами и статусом мастеров спорта/лауреатов",
        scores: [
          { val: 0.5, desc: "Менее 10% от штата педагогов" },
          { val: 1.5, desc: "От 10% до 30% от штата педагогов" },
          { val: 2.5, desc: "Более 30% педагогов являются признанными деятелями культуры, спорта, науки" }
        ]
      },
      {
        id: "b2_i4",
        name: "Текучесть кадров среди основного педагогического состава за учебный год",
        scores: [
          { val: -1.5, desc: "Текучесть превышает 20% (негативно влияет на учебный процесс)", isNegative: true },
          { val: 1, desc: "Текучесть в рамках естественной нормы (5-20%)" },
          { val: 2, desc: "Стабильный коллектив, текучесть менее 5%" }
        ]
      },
      {
        id: "b2_i5",
        name: "Участие педагогов в разработке авторских программ и методических пособий",
        scores: [
          { val: 0.5, desc: "Используются стандартные типовые программы без адаптации" },
          { val: 1.5, desc: "Разработаны и утверждены авторские сертифицированные программы" }
        ]
      }
    ]
  },
  {
    id: "block_3",
    title: "III. Результаты и качество",
    level: "Организация в целом",
    indicatorsCount: 6,
    weightLabel: "~28",
    color: "#D97706",
    borderColor: "border-[#FCD34D]",
    hoverColor: "hover:bg-amber-50/40",
    bgLight: "#FFFBEB",
    indicators: [
      {
        id: "b3_i0",
        name: "Доля обучающихся — призеров и победителей конкурсов/соревнований",
        scores: [
          { val: 0.5, desc: "Единичные призеры на районном/городском уровне" },
          { val: 1.5, desc: "Системные победы на областном/республиканском уровнях (более 10% контингента)" },
          { val: 3, desc: "Победители и лауреаты международных конкурсов, фестивалей, чемпионатов" }
        ]
      },
      {
        id: "b3_i1",
        name: "Сохранность контингента обучающихся в течение учебного года",
        scores: [
          { val: -1, desc: "Отсев учащихся в течение года превышает 30%", isNegative: true },
          { val: 1, desc: "Сохранность контингента на уровне 70-85%" },
          { val: 2.5, desc: "Высокая сохранность контингента (свыше 85% завершили курс)" }
        ]
      },
      {
        id: "b3_i2",
        name: "Доля выпускников, продолживших обучение по профилю в СУЗах и ВУЗах",
        scores: [
          { val: 0.5, desc: "Менее 5% выпускников связывают дальнейшую учебу с профилем" },
          { val: 1.5, desc: "От 5% до 15% выпускников поступают на профильные специальности" },
          { val: 2.5, desc: "Более 15% выпускников поступают в художественные, музыкальные академии, спортфаки и т.д." }
        ]
      },
      {
        id: "b3_i3",
        name: "Регулярность проведения отчетных мероприятий, концертов и выставок",
        isGoso: true,
        scores: [
          { val: 0.5, desc: "Отчетные мероприятия проводятся реже 1 раза в год" },
          { val: 1.5, desc: "Ежегодные отчетные выставки, концерты, показательные выступления" },
          { val: 2, desc: "Регулярная концертная, выставочная или соревновательная деятельность (не реже 1 раза в квартал)" }
        ]
      },
      {
        id: "b3_i4",
        name: "Индекс удовлетворенности родителей качеством услуг (NPS)",
        scores: [
          { val: 0.5, desc: "Индекс NPS ниже 50%" },
          { val: 1.5, desc: "Индекс NPS от 50% до 80%" },
          { val: 2.5, desc: "Высокий уровень лояльности родителей (NPS более 80%)" }
        ]
      },
      {
        id: "b3_i5",
        name: "Участие организации в социально значимых и благотворительных проектах",
        scores: [
          { val: 0.5, desc: "Организация замыкается внутри своей деятельности" },
          { val: 1.5, desc: "Регулярное проведение благотворительных акций, волонтерских выступлений" }
        ]
      }
    ]
  },
  {
    id: "block_4",
    title: "IV. Управление и финансовая прозрачность",
    level: "Организация в целом",
    indicatorsCount: 7,
    weightLabel: "~22",
    color: "#DB2777",
    borderColor: "border-[#FECDD3]",
    hoverColor: "hover:bg-pink-50/40",
    bgLight: "#FDF2F8",
    indicators: [
      {
        id: "b4_i0",
        name: "Информационная открытость (активный сайт, страницы в соцсетях)",
        scores: [
          { val: 0.5, desc: "Сайт отсутствует или не обновляется более полугода" },
          { val: 1.5, desc: "Наличие сайта и социальных сетей с еженедельными обновлениями" },
          { val: 2, desc: "Интерактивный портал: онлайн-запись, портфолио учеников, актуальное расписание" }
        ]
      },
      {
        id: "b4_i1",
        name: "Своевременность и полнота подачи данных в НОБД",
        isGoso: true,
        scores: [
          { val: -1.5, desc: "Зафиксированы задержки подачи отчетности или искажение данных", isNegative: true },
          { val: 1.5, desc: "Данные вносятся строго в установленные сроки, проходят автоматические проверки" }
        ]
      },
      {
        id: "b4_i2",
        name: "Эффективность расходования средств в рамках подушевого финансирования/ваучеров",
        isGoso: true,
        scores: [
          { val: 0.5, desc: "Замечания по нецелевому расходованию или неполному освоению ваучеров" },
          { val: 1.5, desc: "Целевое использование средств, отсутствие замечаний при внешних проверках" }
        ]
      },
      {
        id: "b4_i3",
        name: "Доля внебюджетных поступлений от общего объема финансирования",
        scores: [
          { val: 0, desc: "Полная зависимость от бюджетного финансирования/госзаказа" },
          { val: 1, desc: "Внебюджетные средства (платные услуги, кружки, спонсоры) составляют 5-15%" },
          { val: 2, desc: "Внебюджетные средства превышают 15% (высокая степень автономии)" }
        ]
      },
      {
        id: "b4_i4",
        name: "Наличие внутренней системы контроля качества образования",
        scores: [
          { val: 0.5, desc: "Контроль носит неформальный/эпизодический характер" },
          { val: 1.5, desc: "Регулярный внутренний мониторинг успеваемости, анкетирование участников" }
        ]
      },
      {
        id: "b4_i5",
        name: "Отсутствие обоснованных жалоб родителей и предписаний контролирующих органов",
        scores: [
          { val: -2, desc: "Наличие зафиксированных обоснованных жалоб родителей или предписаний СЭС/МЧС", isNegative: true },
          { val: 1.5, desc: "Отсутствие жалоб и предписаний за отчетный период" }
        ]
      },
      {
        id: "b4_i6",
        name: "Уровень цифровизации внутренних процессов",
        scores: [
          { val: 0.5, desc: "Ведение документации полностью в бумажном виде" },
          { val: 1.5, desc: "Внедрение электронного журнала, электронного документооборота" }
        ]
      }
    ]
  }
];

export default function DopoPage() {
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

  return (
    <>
      {/* Page Header */}
      <PageHeader
        title="Дополнительное образование"
        subtitle="Индикаторная модель развития сферы образования"
      />

      <div className="space-y-6">
            {/* Level Stats Bar */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-fc-sm flex flex-col md:flex-row md:items-center gap-4">
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center font-extrabold text-sm text-white shrink-0 shadow-sm"
                style={{ backgroundColor: "#DB2777" }}
              >
                до
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-slate-800">Дополнительное образование</h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-xs text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1 rounded-full">
                    <b>2 013</b> организаций в РК
                  </span>
                  <span className="text-xs text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1 rounded-full">
                    ГОЗ: <b>154</b> млрд тг
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
                <span className="block text-xs font-semibold mt-1">Приоритетный</span>
                <p className="text-xs opacity-90 mt-1">Расширенный ваучер + приоритет госзаказа</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-[#FFFBEB] p-4 text-amber-800 shadow-fc-sm">
                <span className="block text-xl font-bold font-display tracking-tight text-amber-700">40-69</span>
                <span className="block text-xs font-semibold mt-1">Базовый</span>
                <p className="text-xs opacity-90 mt-1">Стандартный ваучер + план</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-[#FEF2F2] p-4 text-red-800 shadow-fc-sm">
                <span className="block text-xl font-bold font-display tracking-tight text-red-700">0-39</span>
                <span className="block text-xs font-semibold mt-1">Под контролем</span>
                <p className="text-xs opacity-90 mt-1">Уменьшенный ваучер + надзор</p>
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
                      <td className="p-3 text-center text-slate-700">22%</td>
                      <td className="p-3 text-center text-slate-700">23%</td>
                      <td className="p-3 text-center text-slate-700">30%</td>
                      <td className="p-3 text-center text-slate-700">25%</td>
                      <td className="p-3 text-center text-slate-500">100%</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-800 font-medium">Рейтинг условий</td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-3 py-1 rounded font-bold text-white text-[10px]" style={{ backgroundColor: "#0D9E6E" }}>37%</span>
                      </td>
                      <td className="p-3 text-center">18%</td>
                      <td className="p-3 text-center">25%</td>
                      <td className="p-3 text-center">20%</td>
                      <td className="p-3 text-center font-semibold text-slate-500">100%</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-800 font-medium">Рейтинг педагогов</td>
                      <td className="p-3 text-center">17%</td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-3 py-1 rounded font-bold text-white text-[10px]" style={{ backgroundColor: "#2563EB" }}>38%</span>
                      </td>
                      <td className="p-3 text-center">25%</td>
                      <td className="p-3 text-center">20%</td>
                      <td className="p-3 text-center font-semibold text-slate-500">100%</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-800 font-medium">Рейтинг результатов</td>
                      <td className="p-3 text-center">17%</td>
                      <td className="p-3 text-center">18%</td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-3 py-1 rounded font-bold text-white text-[10px]" style={{ backgroundColor: "#D97706" }}>45%</span>
                      </td>
                      <td className="p-3 text-center">20%</td>
                      <td className="p-3 text-center font-semibold text-slate-500">100%</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-800 font-medium">Рейтинг прозрачности</td>
                      <td className="p-3 text-center">17%</td>
                      <td className="p-3 text-center">18%</td>
                      <td className="p-3 text-center">25%</td>
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
