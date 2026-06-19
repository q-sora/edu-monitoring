// src/features/edu-level/TippoPage.tsx
import React, { useState } from "react";
import { useApi, EduLevelStats } from "@/hooks/useApi";
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
    title: "I. Инфраструктура и ресурсы (ОБЩИЙ БАЛЛ КОЛЛЕДЖА)",
    level: "Колледж в целом",
    indicatorsCount: 10,
    weightLabel: "~14",
    color: "#0D9E6E",
    borderColor: "border-[#86EFAC]",
    hoverColor: "hover:bg-emerald-50/40",
    bgLight: "#F0FDF4",
    indicators: [
      {
        id: "b1_i0",
        name: "Техническое состояние зданий и общежитий",
        scores: [
          { val: -2, desc: "Аварийное состояние / требуется капитальный ремонт", isNegative: true },
          { val: 0.5, desc: "Требуется текущий ремонт отдельных помещений" },
          { val: 1.5, desc: "Хорошее состояние, регулярное обслуживание" },
          { val: 2, desc: "Отличное состояние, здания введены в эксплуатацию менее 5 лет назад" }
        ]
      },
      {
        id: "b1_i1",
        name: "Уровень оснащенности учебных мастерских и лабораторий современным оборудованием",
        isGoso: true,
        scores: [
          { val: 0, desc: "Оборудование устарело (износ более 70%)" },
          { val: 1, desc: "Частичное соответствие современным требованиям (износ 40-70%)" },
          { val: 2, desc: "Высокий уровень оснащения, регулярное обновление (износ менее 40%)" }
        ]
      },
      {
        id: "b1_i2",
        name: "Наличие и оснащенность библиотечного фонда, включая доступ к цифровым библиотекам",
        scores: [
          { val: 0.5, desc: "Только бумажный фонд, обновление редкое" },
          { val: 1.5, desc: "Наличие электронного каталога, доступ к базовым базам данных" },
          { val: 2, desc: "Полный доступ к мировым цифровым библиотекам, регулярное обновление литературы" }
        ]
      },
      {
        id: "b1_i3",
        name: "Обеспеченность компьютерной техникой на одного обучающегося",
        isGoso: true,
        scores: [
          { val: 0.5, desc: "Менее 1 компьютера на 10 обучающихся" },
          { val: 1.5, desc: "От 1 до 2 компьютеров на 10 обучающихся" },
          { val: 2.5, desc: "Более 2 компьютеров на 10 обучающихся, наличие графических станций" }
        ]
      },
      {
        id: "b1_i4",
        name: "Доступность скоростного интернета и Wi-Fi на территории колледжа",
        scores: [
          { val: 0, desc: "Скорость менее 10 Мбит/с, покрытие частичное" },
          { val: 1, desc: "Скорость 10-50 Мбит/с, покрытие в учебных зонах" },
          { val: 2, desc: "Скорость более 50 Мбит/с, бесшовный Wi-Fi по всей территории и в общежитиях" }
        ]
      },
      {
        id: "b1_i5",
        name: "Соответствие санитарно-эпидемиологическим нормам и правилам безопасности",
        isGoso: true,
        scores: [
          { val: -1.5, desc: "Наличие зафиксированных нарушений СанПиН или требований безопасности", isNegative: true },
          { val: 1, desc: "Полное соответствие СанПиН, установлена базовая система видеонаблюдения" },
          { val: 2, desc: "Соответствие всем нормам безопасности, установлена СКУД и видеоаналитика" }
        ]
      },
      {
        id: "b1_i6",
        name: "Обеспеченность местами в общежитиях для иногородних студентов",
        scores: [
          { val: 0, desc: "Потребность не удовлетворена (менее 50% нуждающихся обеспечены местами)" },
          { val: 1, desc: "Обеспеченность местами от 50% до 90% нуждающихся" },
          { val: 2, desc: "Потребность полностью удовлетворена (90% и более)" }
        ]
      },
      {
        id: "b1_i7",
        name: "Условия для инклюзивного образования",
        isGoso: true,
        scores: [
          { val: 0, desc: "Отсутствуют условия (нет пандусов, специальных программ)" },
          { val: 1, desc: "Базовые условия (наличие пандусов и кнопок вызова)" },
          { val: 2, desc: "Полная доступность (адаптированные учебные программы, подъемники, ПО)" }
        ]
      },
      {
        id: "b1_i8",
        name: "Спортивная инфраструктура (спортзалы, открытые площадки, инвентарь)",
        scores: [
          { val: 0.5, desc: "Только один спортзал общего типа" },
          { val: 1.5, desc: "Наличие спортзала и открытой спортивной площадки/стадиона" },
          { val: 2, desc: "Специализированные залы (тренажерный, игровой), стадион, широкий ассортимент инвентаря" }
        ]
      },
      {
        id: "b1_i9",
        name: "Энергоэффективность и экологичность зданий",
        scores: [
          { val: 0, desc: "Низкий класс энергоэффективности, отсутствие приборов регулирования" },
          { val: 1, desc: "Средний класс энергоэффективности, частичное внедрение энергосберегающих технологий" }
        ]
      }
    ]
  },
  {
    id: "block_2",
    title: "II. Кадровое обеспечение (ОБЩИЙ БАЛЛ КОЛЛЕДЖА)",
    level: "Колледж в целом",
    indicatorsCount: 13,
    weightLabel: "~25",
    color: "#2563EB",
    borderColor: "border-[#BFDBFE]",
    hoverColor: "hover:bg-blue-50/40",
    bgLight: "#EFF6FF",
    indicators: [
      {
        id: "b2_i0",
        name: "Доля преподавателей высшей и первой квалификационных категорий",
        isGoso: true,
        scores: [
          { val: 0.5, desc: "Менее 30% от общего числа педагогов" },
          { val: 1.5, desc: "От 30% до 50% педагогов" },
          { val: 2.5, desc: "Более 50% педагогов" }
        ]
      },
      {
        id: "b2_i1",
        name: "Доля мастеров производственного обучения с профильным высшим или техническим образованием",
        isGoso: true,
        scores: [
          { val: 0.5, desc: "Менее 60% мастеров" },
          { val: 1.5, desc: "От 60% до 85% мастеров" },
          { val: 2, desc: "Более 85% мастеров" }
        ]
      },
      {
        id: "b2_i2",
        name: "Преподаватели спецдисциплин, прошедшие стажировку на производстве за последние 3 года",
        scores: [
          { val: 0.5, desc: "Менее 40% преподавателей спецдисциплин" },
          { val: 1.5, desc: "От 40% до 70% преподавателей спецдисциплин" },
          { val: 2, desc: "Более 70% преподавателей спецдисциплин" }
        ]
      },
      {
        id: "b2_i3",
        name: "Соотношение численности обучающихся к количеству штатных преподавателей",
        scores: [
          { val: 0.5, desc: "Соотношение более 18:1 (высокая нагрузка)" },
          { val: 1.5, desc: "Соотношение от 12:1 до 18:1 (оптимальная нагрузка)" },
          { val: 2, desc: "Соотношение менее 12:1" }
        ]
      },
      {
        id: "b2_i4",
        name: "Наличие сертифицированных экспертов WorldSkills среди преподавательского состава",
        scores: [
          { val: 0, desc: "Нет сертифицированных экспертов" },
          { val: 1, desc: "Имеются региональные сертифицированные эксперты" },
          { val: 2, desc: "Имеются национальные или международные сертифицированные эксперты" }
        ]
      },
      {
        id: "b2_i5",
        name: "Участие педагогов в научно-методической работе и публикации учебных пособий",
        scores: [
          { val: 0.5, desc: "Публикации отсутствуют или единичны за последние 2 года" },
          { val: 1.5, desc: "Более 30% педагогов ежегодно публикуют материалы или участвуют в разработке стандартов" }
        ]
      },
      {
        id: "b2_i6",
        name: "Доля молодых специалистов (стаж до 3 лет) и наличие системы наставничества",
        scores: [
          { val: 0.5, desc: "Доля молодых специалистов менее 10% или отсутствует система наставничества" },
          { val: 1.5, desc: "Наличие активной программы наставничества при доле молодых специалистов 10-25%" }
        ]
      },
      {
        id: "b2_i7",
        name: "Прохождение курсов повышения квалификации преподавателями (не реже 1 раза в 3 года)",
        isGoso: true,
        scores: [
          { val: 0.5, desc: "Курсы прошли менее 75% преподавателей в плановые сроки" },
          { val: 1.5, desc: "Курсы прошли от 75% до 95% преподавателей" },
          { val: 2, desc: "100% выполнение плана повышения квалификации" }
        ]
      },
      {
        id: "b2_i8",
        name: "Привлечение специалистов-практиков с предприятий к учебному процессу",
        scores: [
          { val: 0.5, desc: "Менее 5% учебных часов ведут практики с производства" },
          { val: 1.5, desc: "От 5% до 15% учебных часов" },
          { val: 2, desc: "Более 15% учебных часов ведут действующие специалисты индустрии" }
        ]
      },
      {
        id: "b2_i9",
        name: "Уровень удовлетворенности преподавателей условиями труда (опрос/NPS)",
        scores: [
          { val: 0.5, desc: "Индекс NPS ниже 40%" },
          { val: 1.5, desc: "Индекс NPS от 40% до 70%" },
          { val: 2, desc: "Индекс NPS выше 70%" }
        ]
      },
      {
        id: "b2_i10",
        name: "Доля преподавателей с учеными степенями по профилю дисциплин",
        scores: [
          { val: 0, desc: "Преподаватели со степенью отсутствуют" },
          { val: 1, desc: "Доля преподавателей со степенью (магистр, PhD) составляет 5-15%" },
          { val: 2, desc: "Доля превышает 15%" }
        ]
      },
      {
        id: "b2_i11",
        name: "Текучесть кадров среди преподавательского состава за учебный год",
        scores: [
          { val: -1, desc: "Текучесть кадров превышает 15% (негативный фактор)", isNegative: true },
          { val: 1, desc: "Умеренная текучесть (5-15%)" },
          { val: 2, desc: "Стабильный коллектив (текучесть менее 5%)" }
        ]
      },
      {
        id: "b2_i12",
        name: "Наличие наград, почетных грамот и достижений у педагогов",
        scores: [
          { val: 0.5, desc: "Единичные награды местного значения" },
          { val: 1.5, desc: "Более 20% штатного состава имеют ведомственные или государственные награды" }
        ]
      }
    ]
  },
  {
    id: "block_3",
    title: "III. Результаты по специальности (БАЛЛ ПО СПЕЦИАЛЬНОСТИ)",
    level: "Специальность",
    indicatorsCount: 13,
    weightLabel: "~30",
    color: "#D97706",
    borderColor: "border-[#FCD34D]",
    hoverColor: "hover:bg-amber-50/40",
    bgLight: "#FFFBEB",
    indicators: [
      {
        id: "b3_i0",
        name: "Качество знаний и средний балл успеваемости обучающихся",
        scores: [
          { val: 0.5, desc: "Средний балл успеваемости ниже 3.8" },
          { val: 1.5, desc: "Средний балл успеваемости от 3.8 до 4.4" },
          { val: 2, desc: "Средний балл успеваемости выше 4.4" }
        ]
      },
      {
        id: "b3_i1",
        name: "Доля выпускников, сдавших демонстрационный экзамен с оценкой 'отлично' или 'хорошо'",
        scores: [
          { val: 0.5, desc: "Менее 40% участников демэкзамена" },
          { val: 1.5, desc: "От 40% до 70% участников" },
          { val: 2.5, desc: "Более 70% участников получили оценки 4 и 5" }
        ]
      },
      {
        id: "b3_i2",
        name: "Доля обучающихся, охваченных дуальным обучением на предприятиях",
        isGoso: true,
        scores: [
          { val: 0.5, desc: "Охват дуальным обучением менее 20%" },
          { val: 1.5, desc: "Охват от 20% до 50%" },
          { val: 2.5, desc: "Охват свыше 50% по профильным специальностям" }
        ]
      },
      {
        id: "b3_i3",
        name: "Результаты участия студентов в региональных и национальных чемпионатах WorldSkills",
        scores: [
          { val: 0, desc: "Призовые места отсутствуют" },
          { val: 1, desc: "Наличие призеров регионального этапа WorldSkills" },
          { val: 2.5, desc: "Наличие призеров или победителей национального/международного чемпионата WorldSkills" }
        ]
      },
      {
        id: "b3_i4",
        name: "Доля выпускников, завершивших обучение с дипломом с отличием",
        scores: [
          { val: 0.5, desc: "Менее 5% выпускников" },
          { val: 1, desc: "От 5% до 15% выпускников" },
          { val: 2, desc: "Свыше 15% выпускников" }
        ]
      },
      {
        id: "b3_i5",
        name: "Процент отсева (ухода) обучающихся в процессе обучения",
        scores: [
          { val: -1.5, desc: "Ежегодный отсев превышает 10% обучающихся", isNegative: true },
          { val: 0.5, desc: "Отсев находится в пределах 5-10%" },
          { val: 1.5, desc: "Отсев минимален (менее 5%)" }
        ]
      },
      {
        id: "b3_i6",
        name: "Результаты сдачи независимой оценки квалификации выпускниками (НОК)",
        isGoso: true,
        scores: [
          { val: 0.5, desc: "НОК успешно сдали менее 65% выпускников" },
          { val: 1.5, desc: "НОК сдали от 65% до 90% выпускников" },
          { val: 2.5, desc: "Свыше 90% выпускников подтвердили квалификацию" }
        ]
      },
      {
        id: "b3_i7",
        name: "Доля студентов, вовлеченных в стартап-проекты и предпринимательство",
        scores: [
          { val: 0, desc: "Активность отсутствует" },
          { val: 1, desc: "Участие принимают до 10% студентов" },
          { val: 2, desc: "Созданы бизнес-инкубаторы, вовлечено более 10% обучающихся" }
        ]
      },
      {
        id: "b3_i8",
        name: "Охват студентов дополнительными профессиональными курсами",
        scores: [
          { val: 0.5, desc: "Менее 20% студентов прошли доп. сертификацию" },
          { val: 1.5, desc: "От 20% до 50% студентов" },
          { val: 2, desc: "Более 50% студентов имеют дополнительные сертификаты профессиональных вендоров" }
        ]
      },
      {
        id: "b3_i9",
        name: "Результаты участия в конкурсах профессионального мастерства (кроме WS)",
        scores: [
          { val: 0.5, desc: "Участие носит формальный характер" },
          { val: 1.5, desc: "Призовые места на республиканских конкурсах профессионального мастерства" }
        ]
      },
      {
        id: "b3_i10",
        name: "Доля выпускников, продолживших обучение в вузах по профилю",
        scores: [
          { val: 0.5, desc: "Менее 10% выпускников" },
          { val: 1.5, desc: "От 10% до 25% выпускников поступили в вузы по профильной специальности" }
        ]
      },
      {
        id: "b3_i11",
        name: "Отзывы работодателей о качестве подготовки выпускников (индекс удовлетворенности)",
        scores: [
          { val: 0.5, desc: "Индекс удовлетворенности работодателей ниже 60%" },
          { val: 1.5, desc: "Индекс удовлетворенности от 60% до 85%" },
          { val: 2, desc: "Индекс удовлетворенности превышает 85%" }
        ]
      },
      {
        id: "b3_i12",
        name: "Процент успеваемости по ключевым профессиональным модулям",
        scores: [
          { val: 0.5, desc: "Успеваемость по модулям ниже 75%" },
          { val: 1.5, desc: "Успеваемость от 75% до 90%" },
          { val: 2, desc: "Успеваемость по профессиональным модулям свыше 90%" }
        ]
      }
    ]
  },
  {
    id: "block_4",
    title: "IV. Партнёрство и трудоустройство (БАЛЛ ПО СПЕЦИАЛЬНОСТИ)",
    level: "Специальность",
    indicatorsCount: 4,
    weightLabel: "~12",
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
          { val: 0.5, desc: "Менее 60% трудоустроенных" },
          { val: 2, desc: "От 60% до 80% трудоустроенных выпускников" },
          { val: 3.5, desc: "Свыше 80% трудоустроенных выпускников по данным ГЦВП" }
        ]
      },
      {
        id: "b4_i1",
        name: "Количество активных договоров о социальном партнерстве с ведущими предприятиями",
        scores: [
          { val: 0.5, desc: "Менее 5 активных договоров с базой практики и найма" },
          { val: 1.5, desc: "От 5 до 15 active договоров" },
          { val: 2.5, desc: "Более 15 договоров с реальным трудоустройством и дуальным обучением" }
        ]
      },
      {
        id: "b4_i2",
        name: "Уровень средней заработной платы выпускников по отношению к средней в регионе",
        scores: [
          { val: 0.5, desc: "Зарплата выпускников ниже средней по региону более чем на 30%" },
          { val: 1.5, desc: "Зарплата в пределах ±15% от средней по региону" },
          { val: 3, desc: "Зарплата выпускников превышает среднюю по региону (высокооплачиваемые профессии)" }
        ]
      },
      {
        id: "b4_i3",
        name: "Доля выпускников, работающих непосредственно по полученной специальности",
        isGoso: true,
        scores: [
          { val: 0.5, desc: "Менее 50% трудоустроенных работают по специальности" },
          { val: 1.5, desc: "От 50% до 75% работают по специальности" },
          { val: 3, desc: "Более 75% выпускников работают в соответствии со своей квалификацией" }
        ]
      }
    ]
  }
];

export default function TippoPage() {
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

  const { data: stats } = useApi<EduLevelStats>('/edu-level/tippo/stats?period_year=2026');

  return (
    <>
      {/* Page Header */}
      <PageHeader
        title="Техническое и профессиональное образование"
        subtitle="Индикаторная модель развития сферы образования"
      />

      <div className="space-y-6">
            {/* Level Stats Bar */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-fc-sm flex flex-col md:flex-row md:items-center gap-4">
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center font-extrabold text-sm text-white shrink-0 shadow-sm"
                style={{ backgroundColor: "#D97706" }}
              >
                ТиПО
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-slate-800">Техническое и профессиональное образование</h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-xs text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1 rounded-full">
                    <b>{stats?.summary.org_count ?? "—"}</b> орг. в системе
                  </span>
                  <span className="text-xs text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1 rounded-full">
                    ГОЗ: <b>514</b> млрд тг
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
                <p className="text-xs opacity-90 mt-1">Стимул + КУ + инвест. план + шефство</p>
                {stats && <span className="block text-xs tabular-nums font-bold mt-2 text-emerald-700">{stats.summary.zones.green} орг.</span>}
              </div>
              <div className="rounded-xl border border-amber-200 bg-[#FFFBEB] p-4 text-amber-800 shadow-fc-sm">
                <span className="block text-xl font-bold font-display tracking-tight text-amber-700">40-69</span>
                <span className="block text-xs font-semibold mt-1">Средний</span>
                <p className="text-xs opacity-90 mt-1">Стимул + инвест. план + шефство слабого</p>
                {stats && <span className="block text-xs tabular-nums font-bold mt-2 text-amber-700">{stats.summary.zones.yellow} орг.</span>}
              </div>
              <div className="rounded-xl border border-red-200 bg-[#FEF2F2] p-4 text-red-800 shadow-fc-sm">
                <span className="block text-xl font-bold font-display tracking-tight text-red-700">0-39</span>
                <span className="block text-xs font-semibold mt-1">Слабый</span>
                <p className="text-xs opacity-90 mt-1">Затратный / индексация + план Talap</p>
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
                      <td className="p-3 text-center text-slate-700">16%</td>
                      <td className="p-3 text-center text-slate-700">29%</td>
                      <td className="p-3 text-center text-slate-700">41%</td>
                      <td className="p-3 text-center text-slate-700">14%</td>
                      <td className="p-3 text-center text-slate-500">100%</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-800 font-medium">Рейтинг инфраструктуры</td>
                      <td className="p-3 text-center">31%</td>
                      <td className="p-3 text-center">24%</td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-3 py-1 rounded font-bold text-white text-[10px]" style={{ backgroundColor: "#D97706" }}>36%</span>
                      </td>
                      <td className="p-3 text-center">9%</td>
                      <td className="p-3 text-center font-semibold text-slate-500">100%</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-800 font-medium">Рейтинг кадров</td>
                      <td className="p-3 text-center">11%</td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-3 py-1 rounded font-bold text-white text-[10px]" style={{ backgroundColor: "#2563EB" }}>44%</span>
                      </td>
                      <td className="p-3 text-center">36%</td>
                      <td className="p-3 text-center">9%</td>
                      <td className="p-3 text-center font-semibold text-slate-500">100%</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-800 font-medium">Рейтинг результатов</td>
                      <td className="p-3 text-center">11%</td>
                      <td className="p-3 text-center">24%</td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-3 py-1 rounded font-bold text-white text-[10px]" style={{ backgroundColor: "#D97706" }}>56%</span>
                      </td>
                      <td className="p-3 text-center">9%</td>
                      <td className="p-3 text-center font-semibold text-slate-500">100%</td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-800 font-medium">Рейтинг трудоустройства</td>
                      <td className="p-3 text-center">11%</td>
                      <td className="p-3 text-center">24%</td>
                      <td className="p-3 text-center">
                        <span className="inline-block px-3 py-1 rounded font-bold text-white text-[10px]" style={{ backgroundColor: "#D97706" }}>36%</span>
                      </td>
                      <td className="p-3 text-center">29%</td>
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
