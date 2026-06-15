// src/features/tippo/AstanaRatingTab.tsx
import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Spec {
  name: string;
  score: number;
}

interface AstanaCollege {
  id: string;
  name: string;
  district: string;
  ownership: string;
  block1: number; // Инфраструктура   (max 18)
  block2: number; // Кадры            (max 54)
  block3: number; // Успеваемость     (max 28.5)
  block4: number; // Трудоустройство  (max 21)
  score: number;  // Сырой балл
  specs: Spec[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Hardcoded data (Астана, ТиПО, 2024–2025)
// ─────────────────────────────────────────────────────────────────────────────

const ASTANA_DATA: AstanaCollege[] = [
  { id:"20", name:"ГКП на ПХВ «Высший колледж «ASTANA POLYTECHNIC»", district:"район Сарыарка", ownership:"Коммунальная собственность", block1:9.0, block2:47.5, block3:28.5, block4:12.0, score:97.0, specs:[{name:"06130100 — Программное обеспечение (по видам)",score:39.0},{name:"07321200 — Монтаж и эксплуатация оборудования и систем газоснабжения",score:28.5},{name:"10130100 — Гостиничный бизнес",score:26.5},{name:"07161300 — Техническое обслуживание, ремонт и эксплуатация автомобильного транспорта",score:26.0},{name:"07320100 — Строительство и эксплуатация зданий и сооружений",score:24.5},{name:"07140900 — Радиотехника, электроника и телекоммуникации",score:24.0},{name:"07310400 — Дизайн, реставрация и реконструкция гражданских зданий",score:23.0},{name:"04110100 — Учет и аудит",score:23.0},{name:"06120200 — Системы информационной безопасности",score:20.5},{name:"10150100 — Туризм",score:14.5},{name:"07140300 — Мехатроника (по отраслям)",score:13.0}]},
  { id:"1",  name:"ГКП на ПВХ «Колледж общественного питания и сервиса»", district:"район Алматы", ownership:"Коммунальная собственность", block1:18.0, block2:43.0, block3:22.2, block4:12.0, score:95.2, specs:[{name:"10130300 — Организация питания",score:48.5},{name:"07210300 — Хлебопекарное, макаронное и кондитерское производство",score:42.0},{name:"10130200 — Организация обслуживания в сфере питания",score:41.5},{name:"07210100 — Производство мяса и мясных продуктов",score:38.5},{name:"07230100 — Швейное производство и моделирование одежды",score:34.0}]},
  { id:"13", name:"ГКП на ПХВ «Высший колледж транспорта и коммуникации»", district:"район Сарыарка", ownership:"Коммунальная собственность", block1:12.0, block2:54.0, block3:13.6, block4:10.1, score:89.7, specs:[{name:"07160500 — Эксплуатация, ремонт и техническое обслуживание тягового подвижного состава",score:27.0},{name:"07130200 — Электроснабжение (по отраслям)",score:26.5},{name:"07160400 — Эксплуатация и техническое обслуживание подъемно-транспортных, строительных машин",score:24.5},{name:"10410200 — Организация перевозок и управление движением на железнодорожном транспорте",score:24.0},{name:"06130100 — Программное обеспечение (по видам)",score:23.5},{name:"04130100 — Менеджмент (по отраслям и областям применения)",score:22.5},{name:"10410300 — Организация перевозок и управление движением на автомобильном транспорте",score:22.0},{name:"07140900 — Радиотехника, электроника и телекоммуникации",score:18.5},{name:"07320800 — Строительство железных дорог, путь и путевое хозяйство",score:18.5},{name:"10410400 — Организация дорожного движения",score:18.5},{name:"07140800 — Эксплуатация устройств оперативной технологической связи",score:18.0},{name:"04130200 — Логистика (по отраслям)",score:16.0}]},
  { id:"17", name:"ТОО «Колледж менеджмента, бизнеса и образования»", district:"район Сарыарка", ownership:"Частная собственность", block1:13.0, block2:52.5, block3:8.0, block4:6.8, score:80.3, specs:[{name:"10130300 — Организация питания",score:29.5},{name:"01120100 — Дошкольное воспитание и обучение",score:23.5},{name:"07230100 — Швейное производство и моделирование одежды",score:23.5},{name:"06130100 — Программное обеспечение (по видам)",score:20.5},{name:"02120100 — Дизайн интерьера",score:20.0},{name:"10130100 — Гостиничный бизнес",score:18.5},{name:"10120100 — Парикмахерское искусство",score:18.0},{name:"06120100 — Вычислительная техника и информационные сети (по видам)",score:17.5},{name:"02310100 — Переводческое дело (по видам)",score:16.0},{name:"01140100 — Педагогика и методика начального обучения",score:15.0},{name:"02110300 — Графический и мультимедийный дизайн",score:12.5},{name:"04210100 — Правоведение",score:12.0},{name:"04120100 — Банковское и страховое дело",score:11.5},{name:"07140900 — Радиотехника, электроника и телекоммуникации",score:9.0}]},
  { id:"11", name:"ГКП на ПХВ «Технический колледж»", district:"район Сарыарка", ownership:"Коммунальная собственность", block1:14.0, block2:30.5, block3:24.1, block4:8.4, score:77.0, specs:[{name:"07150100 — Технология машиностроения (по видам)",score:44.0},{name:"07321000 — Лифтовое хозяйство и эскалаторы (по видам)",score:29.5},{name:"07150500 — Сварочное дело (по видам)",score:25.5},{name:"07130100 — Электрооборудование (по видам и отраслям)",score:20.5},{name:"07160500 — Эксплуатация, ремонт и техническое обслуживание тягового подвижного состава",score:20.0}]},
  { id:"19", name:"КГУ «Профессионально-технический колледж»", district:"район Есиль", ownership:"Коммунальная собственность", block1:15.0, block2:23.0, block3:12.6, block4:21.0, score:71.6, specs:[{name:"07161300 — Техническое обслуживание, ремонт и эксплуатация автомобильного транспорта",score:27.0},{name:"07150300 — Токарное дело (по видам)",score:19.0},{name:"07320700 — Строительство и эксплуатация автомобильных дорог и аэродромов",score:19.0},{name:"10130300 — Организация питания",score:14.0},{name:"07130100 — Электрооборудование (по видам и отраслям)",score:13.0},{name:"07150500 — Сварочное дело (по видам)",score:13.0},{name:"07151100 — Эксплуатация и техническое обслуживание машин и оборудования",score:12.0},{name:"07230100 — Швейное производство и моделирование одежды",score:12.0},{name:"07150700 — Грузоподъемные машины и транспортеры",score:11.5},{name:"07320100 — Строительство и эксплуатация зданий и сооружений",score:11.5},{name:"06130100 — Программное обеспечение (по видам)",score:7.5}]},
  { id:"14", name:"ГКП на ПХВ «Колледж сервиса и туризма»", district:"район Сарыарка", ownership:"Коммунальная собственность", block1:10.0, block2:22.0, block3:21.5, block4:6.0, score:59.5, specs:[{name:"08210100 — Лесное хозяйство",score:32.5},{name:"10130300 — Организация питания",score:26.5},{name:"10130100 — Гостиничный бизнес",score:23.5},{name:"07161300 — Техническое обслуживание, ремонт и эксплуатация автомобильного транспорта",score:22.5},{name:"06130100 — Программное обеспечение (по видам)",score:17.0},{name:"10150100 — Туризм",score:16.5},{name:"07211300 — Технология производства пищевых продуктов",score:15.0},{name:"10410400 — Организация дорожного движения",score:13.0},{name:"06120100 — Вычислительная техника и информационные сети (по видам)",score:9.0}]},
  { id:"6",  name:"ГККП «Строительно-технический колледж»", district:"район Байконур", ownership:"Коммунальная собственность", block1:14.5, block2:21.0, block3:14.5, block4:6.7, score:56.7, specs:[{name:"07130200 — Электроснабжение (по отраслям)",score:23.5},{name:"07161300 — Техническое обслуживание, ремонт и эксплуатация автомобильного транспорта",score:22.0},{name:"07150500 — Сварочное дело (по видам)",score:18.0},{name:"07320100 — Строительство и эксплуатация зданий и сооружений",score:18.0},{name:"07321100 — Монтаж и эксплуатация инженерных систем объектов жилищно-коммунального хозяйства",score:10.5},{name:"07320400 — Управление недвижимостью",score:10.5},{name:"07230100 — Швейное производство и моделирование одежды",score:8.0},{name:"07221400 — Мебельное производство",score:7.5}]},
  { id:"3",  name:"Учреждение образования «Высший колледж Казпотребсоюза» г. Астана", district:"район Алматы", ownership:"Собственность предприятий без государственного и иностранного участия", block1:15.0, block2:23.0, block3:10.3, block4:8.1, score:56.4, specs:[]},
  { id:"12", name:"ГКП на ПХВ «Технологический колледж»", district:"район Байконыр", ownership:"Коммунальная собственность", block1:11.0, block2:16.0, block3:12.0, block4:8.05, score:47.05, specs:[{name:"07210300 — Хлебопекарное, макаронное и кондитерское производство",score:37.5},{name:"07230100 — Швейное производство и моделирование одежды",score:17.5},{name:"10120100 — Парикмахерское искусство",score:15.5}]},
  { id:"22", name:"Учреждение «Высший колледж Евразийского гуманитарного института»", district:"район Алматы", ownership:"Частная собственность (при ВУЗе)", block1:11.0, block2:3.5, block3:17.1, block4:8.0, score:39.6, specs:[{name:"06130100 — Программное обеспечение (по видам)",score:18.5},{name:"01120100 — Дошкольное воспитание и обучение",score:17.0},{name:"10150100 — Туризм",score:15.5},{name:"01140600 — Педагогика и методика преподавания языка и литературы",score:14.5},{name:"02310100 — Переводческое дело (по видам)",score:13.0},{name:"04210100 — Правоведение",score:13.0},{name:"10130100 — Гостиничный бизнес",score:13.0}]},
  { id:"15", name:"РГП на ПХВ «Евразийский национальный университет им. Л.Н. Гумилёва»", district:"район Сарыарка", ownership:"Квазигосударственная собственность (при ВУЗе)", block1:12.0, block2:6.5, block3:11.4, block4:5.5, score:35.4, specs:[{name:"04110100 — Учет и аудит",score:18.5},{name:"06130100 — Программное обеспечение (по видам)",score:18.0},{name:"06120100 — Вычислительная техника и информационные сети (по видам)",score:17.5},{name:"04120200 — Оценка (по видам)",score:13.5},{name:"04140100 — Маркетинг (по отраслям)",score:13.0},{name:"10150100 — Туризм",score:8.0},{name:"04120100 — Банковское и страховое дело",score:7.5},{name:"Финансы",score:7.0}]},
  { id:"2",  name:"ГКП на ПХВ «Высший медицинский колледж»", district:"район Алматы", ownership:"Коммунальная собственность", block1:13.0, block2:9.5, block3:6.8, block4:3.5, score:32.8, specs:[{name:"09130100 — Сестринское дело",score:16.0},{name:"09120100 — Лечебное дело",score:15.5},{name:"09130200 — Акушерское дело",score:15.5},{name:"09140100 — Лабораторная диагностика",score:10.5},{name:"09110100 — Стоматология",score:8.0},{name:"09160100 — Фармация",score:3.0}]},
  { id:"18", name:"Учреждение «Колледж городского хозяйства «Астана Профи»", district:"район Сарыарка", ownership:"Частная собственность", block1:7.0, block2:9.5, block3:6.8, block4:7.15, score:30.45, specs:[{name:"07150500 — Сварочное дело (по видам)",score:20.0},{name:"07321000 — Лифтовое хозяйство и эскалаторы (по видам)",score:20.0},{name:"07321100 — Монтаж и эксплуатация инженерных систем объектов жилищно-коммунального хозяйства",score:18.5},{name:"10320100 — Пожарная безопасность",score:16.0},{name:"07140500 — Цифровая техника (по видам)",score:15.0},{name:"07140100 — Автоматизация и управление технологическими процессами",score:8.0},{name:"10410400 — Организация дорожного движения",score:8.0}]},
  { id:"7",  name:"ТОО «Республиканская медицинская академия»", district:"район Байконур", ownership:"Частная собственность", block1:11.0, block2:6.5, block3:9.0, block4:3.5, score:30.0, specs:[{name:"09130100 — Сестринское дело",score:17.5},{name:"09110200 — Стоматология ортопедическая",score:16.5},{name:"09110100 — Стоматология",score:14.5},{name:"09120100 — Лечебное дело",score:13.5}]},
  { id:"23", name:"Учреждение «Медицинский колледж «Шипагер»", district:"район Байконур", ownership:"Частная собственность", block1:11.5, block2:6.5, block3:5.5, block4:6.0, score:29.5, specs:[{name:"09120100 — Лечебное дело",score:17.0},{name:"09130100 — Сестринское дело",score:15.0}]},
  { id:"8",  name:"Колледж АО «Казахский университет технологии и бизнеса имени К. Кулажанова»", district:"район Есиль", ownership:"Частная собственность (при ВУЗе)", block1:9.0, block2:10.0, block3:6.3, block4:3.5, score:28.8, specs:[{name:"07110500 — Технология переработки нефти и газа",score:16.5},{name:"07211300 — Технология производства пищевых продуктов",score:14.0},{name:"04210100 — Правоведение",score:13.0},{name:"06130100 — Программное обеспечение (по видам)",score:13.0},{name:"01140500 — Физическая культура и спорт",score:12.0},{name:"07230100 — Швейное производство и моделирование одежды",score:11.5},{name:"10130100 — Гостиничный бизнес",score:11.5},{name:"07310100 — Архитектура",score:10.0},{name:"04120100 — Банковское и страховое дело",score:9.0},{name:"10150100 — Туризм",score:8.0}]},
  { id:"4",  name:"Учреждение образования «Колледж «Туран»", district:"район Алматы", ownership:"Частная собственность", block1:8.0, block2:9.0, block3:6.5, block4:5.0, score:28.5, specs:[{name:"02120100 — Дизайн интерьера",score:16.5},{name:"04130100 — Менеджмент (по отраслям и областям применения)",score:16.5},{name:"04210100 — Правоведение",score:14.5},{name:"04110100 — Учет и аудит",score:14.5},{name:"06130100 — Программное обеспечение (по видам)",score:14.5},{name:"02120200 — Дизайн одежды",score:12.5},{name:"07310100 — Архитектура",score:12.5},{name:"10150100 — Туризм",score:10.5}]},
  { id:"16", name:"ТОО «URBAN COLLEGE»", district:"район Сарыарка", ownership:"Частная собственность", block1:8.5, block2:10.0, block3:4.1, block4:4.5, score:27.1, specs:[{name:"07321100 — Монтаж и эксплуатация инженерных систем объектов жилищно-коммунального хозяйства",score:17.5},{name:"10130100 — Гостиничный бизнес",score:13.0},{name:"06120100 — Вычислительная техника и информационные сети (по видам)",score:11.5},{name:"06130100 — Программное обеспечение (по видам)",score:11.5},{name:"07130200 — Электроснабжение (по отраслям)",score:10.0}]},
  { id:"21", name:"ТОО «Акмолинский колледж АО «Казахская академия транспорта и коммуникаций им. М. Тынышпаева»", district:"район Сарыарка", ownership:"Частная собственность (при ВУЗе)", block1:11.0, block2:6.5, block3:5.0, block4:2.2, score:24.7, specs:[{name:"10410200 — Организация перевозок и управление движением на железнодорожном транспорте",score:16.0},{name:"07130200 — Электроснабжение (по отраслям)",score:13.5},{name:"07160500 — Эксплуатация, ремонт и техническое обслуживание тягового подвижного состава",score:13.5},{name:"07140700 — Автоматика, телемеханика и управление движением на железнодорожном транспорте",score:10.5},{name:"07320100 — Строительство и эксплуатация зданий и сооружений",score:9.0},{name:"04110100 — Учет и аудит",score:7.0},{name:"07320800 — Строительство железных дорог, путь и путевое хозяйство",score:6.5}]},
  { id:"5",  name:"Частное учреждение «Колледж медресе Астана»", district:"район Алматы", ownership:"Собственность общественных и религиозных объединений", block1:11.0, block2:3.0, block3:5.0, block4:3.0, score:22.0, specs:[{name:"02210100 — Исламоведение",score:13.0}]},
  { id:"10", name:"ТОО «Казахстанский Швейцарско-Американский колледж»", district:"район Есиль", ownership:"Частная собственность", block1:9.5, block2:5.5, block3:2.25, block4:4.4, score:21.65, specs:[{name:"09230100 — Социальная работа",score:15.0},{name:"02120100 — Дизайн интерьера",score:10.5},{name:"06130100 — Программное обеспечение (по видам)",score:9.0},{name:"10150100 — Туризм",score:9.0},{name:"10410400 — Организация дорожного движения",score:8.5},{name:"10130300 — Организация питания",score:7.5},{name:"02310100 — Переводческое дело (по видам)",score:7.0},{name:"10130100 — Гостиничный бизнес",score:6.5}]},
  { id:"9",  name:"ТОО «Astana IT University» (колледж)", district:"район Есиль", ownership:"Частная собственность (при ВУЗе)", block1:11.0, block2:5.5, block3:5.0, block4:0, score:21.5, specs:[{name:"06130100 — Программное обеспечение (по видам)",score:12.0},{name:"06120100 — Вычислительная техника и информационные сети (по видам)",score:10.0}]},
];

const MAX_SCORE = 97.0;
const B1_MAX = 18, B2_MAX = 54, B3_MAX = 28.5, B4_MAX = 21;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function norm(v: number): number {
  return Math.round((v / MAX_SCORE) * 1000) / 10;
}

function levelInfo(n: number): { label: string; cls: string; dotCls: string } {
  if (n >= 70) return { label: "Сильный",  cls: "bg-success/10 text-success border border-success/20",  dotCls: "bg-success" };
  if (n >= 40) return { label: "Средний",  cls: "bg-warning/10 text-warning border border-warning/20",  dotCls: "bg-warning" };
  return              { label: "Слабый",   cls: "bg-danger/10 text-danger border border-danger/20",    dotCls: "bg-danger" };
}

function scoreColor(n: number): string {
  if (n >= 70) return "#16A34A";
  if (n >= 40) return "#D97706";
  return "#DC2626";
}

// Heatmap cell coloring based on fraction of block max
function hmCell(val: number, max: number): { bg: string; text: string } {
  const p = val / max;
  if (p >= 0.6) return { bg: "#DCFCE7", text: "#166534" };
  if (p >= 0.3) return { bg: "#FEF9C3", text: "#854D0E" };
  return               { bg: "#FEE2E2", text: "#991B1B" };
}

// Spec badge coloring (reference: hmC(score, 50))
function specBadge(score: number): { bg: string; text: string } {
  const p = score / 50;
  if (p >= 0.6) return { bg: "#DCFCE7", text: "#166534" };
  if (p >= 0.3) return { bg: "#FEF9C3", text: "#854D0E" };
  return               { bg: "#FEE2E2", text: "#991B1B" };
}

function ownershipShort(s: string): string {
  return s
    .replace(" собственность", "")
    .replace("Коммунальная", "Комм.")
    .replace("Частная", "Частн.")
    .replace("Квазигосударственная", "Квази")
    .replace("Собственность предприятий без государственного и иностранного участия", "Без гос./ин.")
    .replace("Собственность общественных и религиозных объединений", "Обществ.");
}

// ─────────────────────────────────────────────────────────────────────────────
// Block bar row
// ─────────────────────────────────────────────────────────────────────────────

const BLOCKS = [
  { label: "Блок I: Инфраструктура",  key: "block1" as const, max: B1_MAX, color: "#0D9E6E" },
  { label: "Блок II: Кадры",          key: "block2" as const, max: B2_MAX, color: "#2563EB" },
  { label: "Блок III: Успеваемость",  key: "block3" as const, max: B3_MAX, color: "#D97706" },
  { label: "Блок IV: Трудоустройство",key: "block4" as const, max: B4_MAX, color: "#DB2777" },
];

function BlockBars({ college }: { college: AstanaCollege }) {
  return (
    <div className="flex flex-col gap-2">
      {BLOCKS.map(b => {
        const val = college[b.key];
        const pct = Math.round((val / b.max) * 100);
        return (
          <div key={b.key} className="flex items-center gap-2 text-xs">
            <span className="w-44 shrink-0 font-medium" style={{ color: b.color }}>{b.label}</span>
            <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: b.color }} />
            </div>
            <span className="w-8 text-right font-semibold tabular-nums" style={{ color: b.color }}>{val}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Heatmap
// ─────────────────────────────────────────────────────────────────────────────

function Heatmap({ data }: { data: AstanaCollege[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card p-0 overflow-hidden mb-4">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="font-semibold text-fc-navy-800 text-sm">Тепловая карта по блокам</span>
        <div className="flex items-center gap-4">
          <span className="hidden sm:flex items-center gap-3 text-xs text-fc-steel-400">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{background:"#DCFCE7",border:"1px solid #86EFAC"}} />Высокий</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{background:"#FEF9C3",border:"1px solid #FCD34D"}} />Средний</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{background:"#FEE2E2",border:"1px solid #FCA5A5"}} />Низкий</span>
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-fc-steel-400" /> : <ChevronDown className="w-4 h-4 text-fc-steel-400" />}
        </div>
      </button>

      {open && (
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-3 py-2 font-semibold text-fc-steel-600 min-w-[200px] border-b border-slate-200">Колледж</th>
                {BLOCKS.map(b => (
                  <th key={b.key} className="text-center px-3 py-2 font-semibold whitespace-nowrap border-b border-slate-200" style={{ color: b.color }}>
                    {b.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(c => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-3 py-2 font-medium text-fc-navy-800 max-w-xs">
                    <span className="block truncate" title={c.name}>{c.name}</span>
                  </td>
                  {BLOCKS.map(b => {
                    const { bg, text } = hmCell(c[b.key], b.max);
                    return (
                      <td key={b.key} className="text-center px-3 py-2">
                        <span className="inline-block px-2 py-0.5 rounded font-semibold tabular-nums min-w-[44px]"
                          style={{ background: bg, color: text }}>
                          {c[b.key]}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ranking table row (with expandable detail)
// ─────────────────────────────────────────────────────────────────────────────

function CollegeRow({ college, rank, avgNorm }: { college: AstanaCollege; rank: number; avgNorm: number }) {
  const [open, setOpen] = useState(false);
  const n = norm(college.score);
  const color = scoreColor(n);
  const level = levelInfo(n);
  const diff = n - avgNorm;
  const diffStr = (diff >= 0 ? "+" : "") + diff.toFixed(1);
  const diffColor = diff >= 0 ? "#16A34A" : "#DC2626";
  const barPct = Math.min(100, n);
  const shortName = college.name.length > 55 ? college.name.slice(0, 55) + "…" : college.name;

  return (
    <>
      <tr
        className={`cursor-pointer transition-colors border-b border-slate-100 ${open ? "bg-blue-50/50" : "hover:bg-slate-50/50"}`}
        onClick={() => setOpen(o => !o)}
      >
        <td className="px-3 py-3 text-center tabular-nums font-bold text-fc-steel-400 w-10">{rank}</td>
        <td className="px-3 py-3 font-medium text-fc-navy-800 max-w-[260px]">
          <span title={college.name}>{shortName}</span>
        </td>
        <td className="px-3 py-3 text-xs text-fc-steel-500 whitespace-nowrap">
          {ownershipShort(college.ownership)}
        </td>
        <td className="px-3 py-3 text-center tabular-nums font-bold text-base" style={{ color }}>{college.score}</td>
        <td className="px-3 py-3 text-center text-fc-steel-300 text-sm">—</td>
        <td className="px-3 py-3 w-36">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: color }} />
            </div>
            <span className="text-xs tabular-nums font-medium shrink-0" style={{ color: diffColor }}>{diffStr}</span>
          </div>
        </td>
        <td className="px-3 py-3">
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${level.cls}`}>
            {level.label}
          </span>
        </td>
        <td className="px-2 py-3 text-center text-fc-steel-300">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </td>
      </tr>

      {open && (
        <tr className="border-b border-slate-100">
          <td colSpan={8} className="px-4 pb-4 pt-2 bg-blue-50/30">
            <div className="flex flex-wrap gap-6">
              {/* Block bars */}
              <div className="min-w-[300px] flex-1">
                <p className="label-eyebrow text-fc-navy-700 mb-3">Профиль по блокам</p>
                <BlockBars college={college} />
              </div>

              {/* Specialties */}
              {college.specs.length > 0 && (
                <div className="flex-[2] min-w-[220px]">
                  <p className="label-eyebrow text-fc-navy-700 mb-3">
                    Специальности ({college.specs.length} шт.)
                  </p>
                  <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-1">
                    {college.specs.map((s, i) => {
                      const { bg, text } = specBadge(s.score);
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span
                            className="shrink-0 font-semibold rounded px-1.5 py-0.5 tabular-nums min-w-[36px] text-center"
                            style={{ background: bg, color: text }}
                          >
                            {s.score}
                          </span>
                          <span className="text-fc-steel-700 leading-tight">{s.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {college.specs.length === 0 && (
                <div className="flex-[2] min-w-[220px]">
                  <p className="label-eyebrow text-fc-navy-700 mb-3">Специальности</p>
                  <p className="text-xs text-fc-steel-400">Нет данных</p>
                </div>
              )}

              {/* Meta */}
              <div className="min-w-[160px] shrink-0">
                <p className="label-eyebrow text-fc-navy-700 mb-3">Данные</p>
                <div className="flex flex-col gap-1.5 text-xs text-fc-steel-700">
                  <div>Форма: <span className="font-semibold">{college.ownership}</span></div>
                  <div>Район: <span className="font-semibold">{college.district}</span></div>
                  <div>Факт. балл: <span className="font-semibold tabular-nums">{college.score}</span></div>
                  <div>Норм. балл: <span className="font-semibold tabular-nums" style={{ color }}>{n}</span></div>
                  <div>От среднего: <span className="font-semibold tabular-nums" style={{ color: diffColor }}>{diffStr}</span></div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main tab component
// ─────────────────────────────────────────────────────────────────────────────

type SortKey = "score" | "name" | "b1" | "b2" | "b3" | "b4";

export default function AstanaRatingTab() {
  const [ownershipFilter, setOwnershipFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score");

  const filtered = useMemo(() => {
    let d = [...ASTANA_DATA];
    if (ownershipFilter) {
      const f = ownershipFilter.toLowerCase();
      d = d.filter(c => c.ownership.toLowerCase().includes(f));
    }
    if (sortKey === "score") d.sort((a, b) => b.score - a.score);
    else if (sortKey === "name") d.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    else if (sortKey === "b1") d.sort((a, b) => b.block1 - a.block1);
    else if (sortKey === "b2") d.sort((a, b) => b.block2 - a.block2);
    else if (sortKey === "b3") d.sort((a, b) => b.block3 - a.block3);
    else if (sortKey === "b4") d.sort((a, b) => b.block4 - a.block4);
    return d;
  }, [ownershipFilter, sortKey]);

  const avgNorm = useMemo(() => {
    if (!filtered.length) return 0;
    return filtered.reduce((s, c) => s + norm(c.score), 0) / filtered.length;
  }, [filtered]);

  const strong = filtered.filter(c => norm(c.score) >= 70).length;
  const mid    = filtered.filter(c => norm(c.score) >= 40 && norm(c.score) < 70).length;
  const weak   = filtered.filter(c => norm(c.score) < 40).length;

  return (
    <div className="space-y-4">
      {/* Header + filters */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-display font-bold text-fc-navy-800">Рейтинг колледжей г. Астана</h2>
          <p className="text-sm text-fc-steel-500 mt-0.5">
            {ASTANA_DATA.length} организации ТиПО · Нормализованная шкала 0–100 (лучший = 100)
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label-eyebrow mb-1 block">Собственность</label>
            <select
              className="input w-44"
              value={ownershipFilter}
              onChange={e => setOwnershipFilter(e.target.value)}
            >
              <option value="">Все</option>
              <option value="коммунальная">Коммунальные</option>
              <option value="частная">Частные</option>
              <option value="квазигосударственная">Квазигосударственные</option>
            </select>
          </div>
          <div>
            <label className="label-eyebrow mb-1 block">Сортировка</label>
            <select
              className="input w-44"
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
            >
              <option value="score">По баллу ↓</option>
              <option value="name">По названию</option>
              <option value="b1">Блок I ↓</option>
              <option value="b2">Блок II ↓</option>
              <option value="b3">Блок III ↓</option>
              <option value="b4">Блок IV ↓</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="card text-center py-4">
          <p className="text-2xl font-display font-bold text-fc-navy-800 tabular-nums">{filtered.length}</p>
          <p className="text-xs text-fc-steel-500 mt-1">Всего колледжей</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-display font-bold text-fc-navy-800 tabular-nums">{avgNorm.toFixed(1)}</p>
          <p className="text-xs text-fc-steel-500 mt-1">Средний балл (норм.)</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-display font-bold tabular-nums" style={{color:"#16A34A"}}>{strong}</p>
          <p className="text-xs text-fc-steel-500 mt-1">Сильных (70+)</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-display font-bold tabular-nums" style={{color:"#D97706"}}>{mid}</p>
          <p className="text-xs text-fc-steel-500 mt-1">Средних (40–69)</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-display font-bold tabular-nums" style={{color:"#DC2626"}}>{weak}</p>
          <p className="text-xs text-fc-steel-500 mt-1">Слабых (0–39)</p>
        </div>
      </div>

      {/* Average pill */}
      <div>
        <span className="inline-flex items-center gap-2 text-sm bg-slate-100 text-fc-navy-800 px-3 py-1.5 rounded-lg">
          <span className="text-fc-steel-500">Средний нормализованный балл по Астане:</span>
          <span className="font-bold tabular-nums">{avgNorm.toFixed(1)}</span>
          <span className="text-fc-steel-400">/ 100</span>
        </span>
      </div>

      {/* Heatmap */}
      <Heatmap data={filtered} />

      {/* Ranking table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-fc-navy-800 text-white">
                <th className="px-3 py-2.5 text-center font-semibold w-10 text-xs">#</th>
                <th className="px-3 py-2.5 text-left font-semibold text-xs">Колледж</th>
                <th className="px-3 py-2.5 text-left font-semibold text-xs whitespace-nowrap">Форма</th>
                <th className="px-3 py-2.5 text-center font-semibold text-xs whitespace-nowrap">Балл (факт.)</th>
                <th className="px-3 py-2.5 text-center font-semibold text-xs whitespace-nowrap">Ожид. балл</th>
                <th className="px-3 py-2.5 text-left font-semibold text-xs w-36">Прогресс</th>
                <th className="px-3 py-2.5 text-left font-semibold text-xs">Уровень</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <CollegeRow key={c.id} college={c} rank={i + 1} avgNorm={avgNorm} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
