// src/features/overview/OverviewPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { Loader, ErrorBox, PageHeader } from "@/components/ui";

interface LevelStat {
  org_count:   number;
  budget_mlrd: number;
}
interface OverviewData {
  levels: Record<string, LevelStat>;
}

const LEVELS = [
  { key: "do",    label: "Дошкольное воспитание и обучение (ДОВ)", short: "ДОВ", color: "#0D9E6E", route: "/edu/preschool"    },
  { key: "so",    label: "Среднее образование (СО)",                short: "СО",  color: "#2563EB", route: "/edu/school"       },
  { key: "tippo", label: "ТиПО — Техническое и профессиональное образование", short: "ТиПО", color: "#D97706", route: "/edu/college"  },
  { key: "vipo",  label: "ОВПО — Высшее и послевузовское образование",        short: "ОВПО", color: "#7C3AED", route: "/edu/university"},
  { key: "dopo",  label: "Дополнительное образование (ДО)",         short: "ДО",  color: "#DB2777", route: "/edu/extracurricular"},
] as const;

const ASTANA = {
  label: "Реальный рейтинг — г. Астана (23 колледжа)",
  meta:  "Нормализованная шкала 0–100 · Детализация по блокам",
  route: "/tippo/colleges",
};

const INACTIVE = [
  { n: 2, title: "Индекс экономического благополучия" },
  { n: 3, title: "Индекс качества управления и институтов" },
  { n: 4, title: "Индекс субъективного благополучия и соц. среды" },
];

function fmt(n: number) {
  return n.toLocaleString("ru-RU");
}

export function OverviewPage() {
  const navigate = useNavigate();
  const [eduOpen, setEduOpen]   = useState(true);
  const [block1Open, setBlock1] = useState(true);

  const { data, loading, error } = useApi<OverviewData>("/admin/overview-stats", []);

  return (
    <>
      <PageHeader
        title="Обзор"
        subtitle="Индекс благополучия страны — составной индекс из 4 компонентов"
      />

      {loading && <Loader />}
      {error   && <ErrorBox message={error} />}

      {/* ── Tree ──────────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto">

        {/* Root */}
        <div className="border-l-4 border-fc-navy pl-4 mb-6">
          <div className="font-display text-xl font-extrabold text-fc-navy">Индекс благополучия страны</div>
          <div className="text-sm text-slate-500 mt-0.5">Составной индекс из 4 компонентов — нажмите на компонент для раскрытия</div>
        </div>

        {/* Connector line */}
        <div className="ml-3 border-l-2 border-slate-200 pl-6 space-y-3">

          {/* ── Component 1: Human Capital ──────────────────────────────── */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-fc-sm overflow-hidden">
            {/* Header */}
            <button
              onClick={() => setBlock1(!block1Open)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: "#3b82f6" }}>1</div>
                <span className="font-display font-semibold text-sm text-slate-800">
                  Индекс развития человеческого капитала
                </span>
              </div>
              {block1Open
                ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
            </button>

            {block1Open && (
              <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-2">

                {/* Education sub-accordion */}
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setEduOpen(!eduOpen)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <span className="text-xs font-semibold text-slate-700">
                      Образование — Индикаторная модель развития сферы образования
                    </span>
                    {eduOpen
                      ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                  </button>

                  {eduOpen && (
                    <div className="divide-y divide-slate-100">
                      {LEVELS.map(lvl => {
                        const stat = data?.levels[lvl.key];
                        return (
                          <button
                            key={lvl.key}
                            onClick={() => navigate(lvl.route)}
                            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
                            style={{ borderLeft: `3px solid ${lvl.color}` }}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: lvl.color }} />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-700 truncate">{lvl.label}</div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {loading
                                    ? "загрузка..."
                                    : stat
                                      ? `${fmt(stat.org_count)} орг.${stat.budget_mlrd > 0 ? ` · ${fmt(stat.budget_mlrd)} млрд тг` : ""}`
                                      : "нет данных"}
                                </div>
                              </div>
                            </div>
                            <span
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-md shrink-0 ml-3 text-white"
                              style={{ background: lvl.color }}
                            >
                              Методика →
                            </span>
                          </button>
                        );
                      })}

                      {/* Astana rating — special row */}
                      <button
                        onClick={() => navigate(ASTANA.route)}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
                        style={{ borderLeft: "3px dashed #475569" }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-2 h-2 rounded-full shrink-0 bg-slate-400" />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-600 truncate">{ASTANA.label}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{ASTANA.meta}</div>
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md shrink-0 ml-3 text-slate-400 bg-slate-100">
                          Рейтинг →
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Inactive sub-items */}
                {["Здоровье", "Навыки и компетенции рабочей силы"].map(label => (
                  <div key={label}
                    className="px-3 py-2 rounded-lg border border-slate-100 text-xs text-slate-400 bg-slate-50">
                    {label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Components 2–4: in development ──────────────────────────── */}
          {INACTIVE.map(item => (
            <div key={item.n} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 bg-slate-400">
                {item.n}
              </div>
              <span className="text-sm font-medium text-slate-400 flex-1">{item.title}</span>
              <span className="text-[11px] text-slate-400 bg-slate-200 rounded px-2 py-0.5 shrink-0">в разработке</span>
            </div>
          ))}

        </div>
      </div>
    </>
  );
}
