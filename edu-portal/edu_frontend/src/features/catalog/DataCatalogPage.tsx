import React, { useCallback, useEffect, useState } from "react";
import {
  BookOpen, ChevronRight, Database, FileText,
  Layers, Loader2, RefreshCw, Search, X,
} from "lucide-react";
import client from "@/api/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LevelItem {
  education_level: string;
  code: string;
  total_fields: number;
  sections: number;
}

interface SectionItem {
  section_slug: string;
  section: string;
  field_count: number;
}

interface FieldItem {
  id: number;
  field_name: string;
  field_slug: string;
  source: string | null;
  frequency: string | null;
  data_type_code: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const LEVEL_META: Record<string, { name: string; color: string; bg: string }> = {
  do:    { name: "Дошкольное образование",                color: "text-fc-navy-700",   bg: "bg-fc-navy-50   border-fc-navy-200"   },
  dopo:  { name: "Дополнительное образование",             color: "text-fc-blue-600",   bg: "bg-fc-blue-50   border-fc-blue-200"   },
  so:    { name: "Среднее образование",                    color: "text-fc-cyan-600",   bg: "bg-fc-cyan-50   border-fc-cyan-200"   },
  tippo: { name: "ТиППО",                                  color: "text-fc-steel-600",  bg: "bg-fc-steel-50  border-fc-steel-200"  },
  vipo:  { name: "Высшее и послевузовское образование",    color: "text-fc-purple-600", bg: "bg-fc-purple-50 border-fc-purple-200" },
  obsh:  { name: "Общежития",                              color: "text-fc-navy-500",   bg: "bg-fc-navy-50   border-fc-navy-100"   },
  gons:  { name: "ГОНС",                                   color: "text-fc-blue-700",   bg: "bg-fc-blue-50   border-fc-blue-300"   },
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function DataCatalogPage() {
  const [levels, setLevels] = useState<LevelItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [fields, setFields] = useState<FieldItem[]>([]);
  const [filteredFields, setFilteredFields] = useState<FieldItem[]>([]);

  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<SectionItem | null>(null);

  const [loadingLevels, setLoadingLevels] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [totalCatalog, setTotalCatalog] = useState<number | null>(null);

  // Load levels on mount
  useEffect(() => {
    setLoadingLevels(true);
    client.get<{ levels: LevelItem[] }>("/data-catalog/levels")
      .then(r => {
        setLevels(r.data.levels);
        const total = r.data.levels.reduce((s, l) => s + l.total_fields, 0);
        setTotalCatalog(total);
      })
      .catch(() => setError("Не удалось загрузить уровни образования"))
      .finally(() => setLoadingLevels(false));
  }, []);

  const selectLevel = useCallback((level: string) => {
    setSelectedLevel(level);
    setSelectedSection(null);
    setFields([]);
    setFilteredFields([]);
    setSearch("");
    setLoadingSections(true);
    client.get<{ sections: SectionItem[] }>(`/data-catalog/sections/${level}`)
      .then(r => setSections(r.data.sections))
      .catch(() => setError("Не удалось загрузить разделы"))
      .finally(() => setLoadingSections(false));
  }, []);

  const selectSection = useCallback((section: SectionItem) => {
    if (!selectedLevel) return;
    setSelectedSection(section);
    setSearch("");
    setLoadingFields(true);
    client.get<{ fields: FieldItem[] }>(`/data-catalog/fields/${selectedLevel}/${section.section_slug}`)
      .then(r => {
        setFields(r.data.fields);
        setFilteredFields(r.data.fields);
      })
      .catch(() => setError("Не удалось загрузить поля"))
      .finally(() => setLoadingFields(false));
  }, [selectedLevel]);

  // Filter fields by search
  useEffect(() => {
    if (!search.trim()) {
      setFilteredFields(fields);
      return;
    }
    const q = search.toLowerCase();
    setFilteredFields(fields.filter(f =>
      f.field_name.toLowerCase().includes(q) ||
      (f.source || "").toLowerCase().includes(q)
    ));
  }, [search, fields]);

  const resetLevel = () => {
    setSelectedLevel(null);
    setSelectedSection(null);
    setSections([]);
    setFields([]);
    setFilteredFields([]);
    setSearch("");
  };

  const meta = selectedLevel ? (LEVEL_META[selectedLevel] ?? { name: selectedLevel, color: "text-fc-navy-700", bg: "bg-fc-navy-50 border-fc-navy-200" }) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-fc-navy-800">
            Каталог данных
          </h1>
          <p className="mt-1 text-sm text-fc-navy-400">
            {totalCatalog !== null
              ? `${totalCatalog.toLocaleString("ru-RU")} полей по ${levels.length} уровням образования`
              : "Загрузка каталога…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-fc-navy-400" />
          <span className="label-eyebrow text-fc-navy-400">Каталог данных</span>
        </div>
      </div>

      {error && (
        <div className="card border-danger/30 bg-danger/5 flex items-center gap-3 text-danger text-sm">
          <X className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Breadcrumb */}
      {selectedLevel && (
        <div className="flex items-center gap-1.5 text-sm">
          <button onClick={resetLevel} className="text-fc-blue-600 hover:underline">
            Уровни образования
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-fc-navy-400" />
          <span className={meta?.color}>{meta?.name}</span>
          {selectedSection && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-fc-navy-400" />
              <span className="text-fc-navy-600">{selectedSection.section}</span>
            </>
          )}
        </div>
      )}

      {/* Levels grid */}
      {!selectedLevel && (
        <>
          {loadingLevels ? (
            <div className="flex items-center gap-2 text-fc-navy-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Загрузка уровней…
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {levels.map(lvl => {
                const m = LEVEL_META[lvl.education_level] ?? {
                  name: lvl.education_level,
                  color: "text-fc-navy-700",
                  bg: "bg-fc-navy-50 border-fc-navy-200",
                };
                return (
                  <button
                    key={lvl.education_level}
                    onClick={() => selectLevel(lvl.education_level)}
                    className={`card card-hover text-left border ${m.bg}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <BookOpen className={`w-5 h-5 ${m.color}`} />
                      <span className="label-eyebrow text-fc-navy-400">{lvl.code}</span>
                    </div>
                    <p className={`font-display font-semibold text-sm leading-snug mb-3 ${m.color}`}>
                      {m.name}
                    </p>
                    <div className="flex items-center justify-between text-xs text-fc-navy-500">
                      <span className="tabular-nums font-semibold text-base text-fc-navy-700">
                        {lvl.total_fields.toLocaleString("ru-RU")}
                      </span>
                      <span>{lvl.sections} разд.</span>
                    </div>
                    <p className="text-xs text-fc-navy-400 mt-0.5">полей</p>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Sections list */}
      {selectedLevel && !selectedSection && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Layers className={`w-4 h-4 ${meta?.color}`} />
            <h2 className="font-display font-semibold text-fc-navy-700">Разделы</h2>
          </div>
          {loadingSections ? (
            <div className="flex items-center gap-2 text-fc-navy-400 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Загрузка разделов…
            </div>
          ) : (
            <div className="divide-y divide-fc-navy-100">
              {sections.map(sec => (
                <button
                  key={sec.section_slug}
                  onClick={() => selectSection(sec)}
                  className="w-full flex items-center justify-between py-3 text-left hover:bg-fc-navy-50 -mx-1 px-1 rounded transition-colors"
                >
                  <span className="text-sm text-fc-navy-700">{sec.section}</span>
                  <div className="flex items-center gap-2">
                    <span className="pill bg-fc-navy-100 text-fc-navy-600 tabular-nums">
                      {sec.field_count}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-fc-navy-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fields table */}
      {selectedSection && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-fc-navy-500" />
              <h2 className="font-display font-semibold text-fc-navy-700">
                {selectedSection.section}
              </h2>
              <span className="pill bg-fc-navy-100 text-fc-navy-600 tabular-nums">
                {filteredFields.length} / {fields.length}
              </span>
            </div>
            <button
              onClick={() => { setSelectedSection(null); setFields([]); setFilteredFields([]); setSearch(""); }}
              className="btn-ghost text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" /> К разделам
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-fc-navy-400" />
            <input
              className="input pl-9"
              placeholder="Поиск по названию или источнику…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-fc-navy-400 hover:text-fc-navy-700">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {loadingFields ? (
            <div className="flex items-center gap-2 text-fc-navy-400 text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Загрузка полей…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th className="w-8">#</th>
                    <th>Название поля</th>
                    <th>Источник</th>
                    <th>Частота</th>
                    <th>Тип</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFields.map((f, i) => (
                    <tr key={f.id}>
                      <td className="tabular-nums text-fc-navy-400 text-xs">{i + 1}</td>
                      <td className="text-sm text-fc-navy-800">{f.field_name}</td>
                      <td className="text-xs text-fc-navy-500">{f.source ?? "—"}</td>
                      <td className="text-xs text-fc-navy-500">{f.frequency ?? "—"}</td>
                      <td className="text-xs">
                        {f.data_type_code === "1" && <span className="pill bg-fc-cyan-50 text-fc-cyan-700">первичные</span>}
                        {f.data_type_code === "2" && <span className="pill bg-fc-purple-50 text-fc-purple-700">расчётные</span>}
                        {!f.data_type_code && <span className="text-fc-navy-400">—</span>}
                      </td>
                    </tr>
                  ))}
                  {filteredFields.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-fc-navy-400 text-sm py-8">
                        Ничего не найдено
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
