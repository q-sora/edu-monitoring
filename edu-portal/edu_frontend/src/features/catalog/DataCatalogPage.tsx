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
// Constants — dark theme
// ─────────────────────────────────────────────────────────────────────────────

const LEVEL_META: Record<string, { name: string; accent: string; icon: string }> = {
  do:    { name: "Дошкольное образование",             accent: "#5b9ad6", icon: "#5b9ad6" },
  dopo:  { name: "Дополнительное образование",          accent: "#4da8d8", icon: "#4da8d8" },
  so:    { name: "Среднее образование",                 accent: "#00a6ca", icon: "#00a6ca" },
  tippo: { name: "ТиППО",                               accent: "#7596b9", icon: "#7596b9" },
  vipo:  { name: "Высшее и послевузовское образование", accent: "#c248c4", icon: "#c248c4" },
  obsh:  { name: "Общежития",                           accent: "#8ca0c8", icon: "#8ca0c8" },
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

  useEffect(() => {
    if (!search.trim()) { setFilteredFields(fields); return; }
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

  const meta = selectedLevel ? (LEVEL_META[selectedLevel] ?? { name: selectedLevel, accent: "#00a6ca", icon: "#00a6ca" }) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Каталог данных
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {totalCatalog !== null
              ? `${totalCatalog.toLocaleString("ru-RU")} полей по ${levels.length} уровням образования`
              : "Загрузка каталога…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
          <span className="label-eyebrow">Каталог данных</span>
        </div>
      </div>

      {error && (
        <div className="card flex items-center gap-3 text-sm p-4" style={{ border: "1px solid rgba(193,39,45,0.3)", background: "rgba(193,39,45,0.08)", color: "#e74c3c" }}>
          <X className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Breadcrumb */}
      {selectedLevel && (
        <div className="flex items-center gap-1.5 text-sm">
          <button onClick={resetLevel} className="text-fc-blue-400 hover:underline">
            Уровни образования
          </button>
          <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
          <span style={{ color: "var(--text-secondary)" }}>{meta?.name}</span>
          {selectedSection && (
            <>
              <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              <span style={{ color: "var(--text-secondary)" }}>{selectedSection.section}</span>
            </>
          )}
        </div>
      )}

      {/* Levels grid */}
      {!selectedLevel && (
        <>
          {loadingLevels ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
              <Loader2 className="w-4 h-4 animate-spin" /> Загрузка уровней…
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {levels.map(lvl => {
                const m = LEVEL_META[lvl.education_level] ?? { name: lvl.education_level, accent: "#00a6ca", icon: "#00a6ca" };
                return (
                  <button
                    key={lvl.education_level}
                    onClick={() => selectLevel(lvl.education_level)}
                    className="card card-hover text-left p-5"
                    style={{ borderLeft: `3px solid ${m.accent}` }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <BookOpen className="w-5 h-5" style={{ color: m.icon }} />
                      <span className="label-eyebrow">{lvl.code}</span>
                    </div>
                    <p className="font-display font-semibold text-sm leading-snug mb-3" style={{ color: "var(--text-primary)" }}>
                      {m.name}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="tabular-nums font-bold text-base" style={{ color: "var(--text-primary)" }}>
                        {lvl.total_fields.toLocaleString("ru-RU")}
                      </span>
                      <span style={{ color: "var(--text-muted)" }}>{lvl.sections} разд.</span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>полей</p>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Sections list */}
      {selectedLevel && !selectedSection && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4" style={{ color: meta?.icon }} />
            <h2 className="font-display font-semibold" style={{ color: "var(--text-primary)" }}>Разделы</h2>
          </div>
          {loadingSections ? (
            <div className="flex items-center gap-2 text-sm py-4" style={{ color: "var(--text-muted)" }}>
              <Loader2 className="w-4 h-4 animate-spin" /> Загрузка разделов…
            </div>
          ) : (
            <div>
              {sections.map(sec => (
                <button
                  key={sec.section_slug}
                  onClick={() => selectSection(sec)}
                  className="w-full flex items-center justify-between py-3 text-left -mx-1 px-1 rounded transition-colors"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,168,202,0.05)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{sec.section}</span>
                  <div className="flex items-center gap-2">
                    <span className="pill tabular-nums" style={{ background: "rgba(0,168,202,0.12)", color: "#00a6ca" }}>
                      {sec.field_count}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fields table */}
      {selectedSection && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <h2 className="font-display font-semibold" style={{ color: "var(--text-primary)" }}>
                {selectedSection.section}
              </h2>
              <span className="pill tabular-nums" style={{ background: "rgba(0,168,202,0.12)", color: "#00a6ca" }}>
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
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              className="input pl-9"
              placeholder="Поиск по названию или источнику…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {loadingFields ? (
            <div className="flex items-center gap-2 text-sm py-4" style={{ color: "var(--text-muted)" }}>
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
                      <td className="tabular-nums text-xs" style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                      <td className="text-sm">{f.field_name}</td>
                      <td className="text-xs">{f.source ?? "—"}</td>
                      <td className="text-xs">{f.frequency ?? "—"}</td>
                      <td className="text-xs">
                        {f.data_type_code === "1" && (
                          <span className="pill" style={{ background: "rgba(0,168,202,0.12)", color: "#00a6ca" }}>первичные</span>
                        )}
                        {f.data_type_code === "2" && (
                          <span className="pill" style={{ background: "rgba(128,30,130,0.15)", color: "#c248c4" }}>расчётные</span>
                        )}
                        {!f.data_type_code && <span style={{ color: "var(--text-muted)" }}>—</span>}
                      </td>
                    </tr>
                  ))}
                  {filteredFields.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-sm py-8" style={{ color: "var(--text-muted)" }}>
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
