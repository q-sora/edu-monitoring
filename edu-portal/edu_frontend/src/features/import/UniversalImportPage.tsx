import React, { useCallback, useRef, useState } from "react";
import {
  AlertTriangle, CheckCircle, ChevronRight, FileUp,
  Loader2, Plus, Trash2, Upload, X,
} from "lucide-react";
import client from "@/api/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SuggestedMapping {
  excel_column: string;
  catalog_field_id: number;
  catalog_field_name: string;
  match_score: number;
  value_type: "numeric" | "text" | "jsonb";
}

interface PreviewResult {
  filename: string;
  total_rows: number;
  columns: string[];
  sample_rows: Record<string, string>[];
  suggested_mappings: SuggestedMapping[];
}

interface MappingRow {
  excel_column: string;
  catalog_field_id: number | "";
  catalog_field_name: string;
  value_type: "numeric" | "text" | "jsonb";
  match_score?: number;
}

interface ImportResult {
  filename: string;
  total_rows: number;
  inserted_values: number;
  skipped: number;
  matched_orgs: number;
  errors: string[];
}

const EDUCATION_LEVELS = [
  { value: "do",    label: "Дошкольное образование" },
  { value: "dopo",  label: "Дополнительное образование" },
  { value: "so",    label: "Среднее образование" },
  { value: "tippo", label: "ТиППО" },
  { value: "vipo",  label: "Высшее и послевузовское образование" },
  { value: "obsh",  label: "Общежития" },
];

const VALUE_TYPES = [
  { value: "numeric", label: "Число" },
  { value: "text",    label: "Текст" },
  { value: "jsonb",   label: "JSON" },
];

const STEPS = ["Файл", "Настройки", "Маппинг", "Импорт"];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function UniversalImportPage() {
  const [step, setStep] = useState(0);

  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [educationLevel, setEducationLevel] = useState("");
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const [periodMonth, setPeriodMonth] = useState<string>("");
  const [orgColumn, setOrgColumn] = useState("");

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [catalogSearch, setCatalogSearch] = useState<Record<number, string>>({});
  const [catalogOptions, setCatalogOptions] = useState<Record<number, { id: number; name: string }[]>>({});
  const [searchTimers, setSearchTimers] = useState<Record<number, ReturnType<typeof setTimeout>>>({});

  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleFileChange = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setPreview(null);
    setMappings([]);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".xlsx") || f?.name.endsWith(".xls")) handleFileChange(f);
  }, []);

  const loadPreview = async () => {
    if (!file) return;
    setLoadingPreview(true);
    const form = new FormData();
    form.append("file", file);
    if (educationLevel) form.append("education_level", educationLevel);
    try {
      const r = await client.post<PreviewResult>("/universal-import/preview", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPreview(r.data);
      const rows: MappingRow[] = r.data.suggested_mappings.map(s => ({
        excel_column:       s.excel_column,
        catalog_field_id:   s.catalog_field_id,
        catalog_field_name: s.catalog_field_name,
        value_type:         s.value_type,
        match_score:        s.match_score,
      }));
      const mappedCols = new Set(rows.map(m => m.excel_column));
      r.data.columns.forEach(col => {
        if (!mappedCols.has(col) && !col.toLowerCase().startsWith("unnamed")) {
          rows.push({ excel_column: col, catalog_field_id: "", catalog_field_name: "", value_type: "numeric" });
        }
      });
      setMappings(rows);
      setStep(2);
    } catch {
      setImportError("Не удалось получить превью файла");
    } finally {
      setLoadingPreview(false);
    }
  };

  const searchCatalogField = (idx: number, query: string) => {
    setCatalogSearch(prev => ({ ...prev, [idx]: query }));
    if (searchTimers[idx]) clearTimeout(searchTimers[idx]);
    if (query.length < 2) {
      setCatalogOptions(prev => ({ ...prev, [idx]: [] }));
      return;
    }
    const timer = setTimeout(async () => {
      try {
        await client.get(`/data-catalog/fields/${educationLevel || "vipo"}/general`);
      } catch { /* ignore */ }
    }, 300);
    setSearchTimers(prev => ({ ...prev, [idx]: timer }));
  };

  const setMappingField = (idx: number, field: { id: number; name: string }) => {
    setMappings(prev => prev.map((m, i) =>
      i === idx ? { ...m, catalog_field_id: field.id, catalog_field_name: field.name } : m
    ));
    setCatalogOptions(prev => ({ ...prev, [idx]: [] }));
    setCatalogSearch(prev => ({ ...prev, [idx]: field.name }));
  };

  const updateMapping = (idx: number, patch: Partial<MappingRow>) => {
    setMappings(prev => prev.map((m, i) => i === idx ? { ...m, ...patch } : m));
  };

  const removeMapping = (idx: number) => {
    setMappings(prev => prev.filter((_, i) => i !== idx));
  };

  const executeImport = async () => {
    if (!file) return;
    const validMappings = mappings
      .filter(m => m.catalog_field_id !== "")
      .map(m => ({
        excel_column:     m.excel_column,
        catalog_field_id: m.catalog_field_id,
        value_type:       m.value_type,
      }));

    if (validMappings.length === 0) { setImportError("Не задан ни один маппинг"); return; }

    setImporting(true);
    setImportError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("mappings_json", JSON.stringify(validMappings));
    form.append("period_year", String(periodYear));
    if (periodMonth) form.append("period_month", periodMonth);
    if (orgColumn) form.append("org_column", orgColumn);

    try {
      const r = await client.post<ImportResult>("/universal-import/execute", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(r.data);
      setStep(3);
    } catch (e: any) {
      setImportError(e?.response?.data?.detail ?? "Ошибка при импорте");
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep(0); setFile(null); setPreview(null); setMappings([]);
    setResult(null); setImportError(null); setEducationLevel("");
    setPeriodYear(new Date().getFullYear()); setPeriodMonth(""); setOrgColumn("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Универсальный импорт
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Загрузка данных из Excel по полям каталога
          </p>
        </div>
        <FileUp className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors`}
              style={
                i === step
                  ? { background: "#0068b4", color: "#fff" }
                  : i < step
                  ? { background: "rgba(0,104,180,0.15)", color: "#4da8d8" }
                  : { color: "var(--text-muted)" }
              }>
              <span className="tabular-nums">{i + 1}</span>
              <span>{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className="w-3.5 h-3.5 mx-1" style={{ color: "var(--text-muted)" }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {importError && (
        <div className="card flex items-center gap-3 text-sm p-4" style={{ border: "1px solid rgba(193,39,45,0.3)", background: "rgba(193,39,45,0.08)", color: "#e74c3c" }}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {importError}
          <button onClick={() => setImportError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Step 0: File upload ── */}
      {step === 0 && (
        <div className="card p-5">
          <h2 className="font-display font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Выберите файл</h2>
          <div
            onDrop={onDrop}
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors"
            style={file
              ? { borderColor: "rgba(0,168,202,0.6)", background: "rgba(0,168,202,0.06)" }
              : { borderColor: "var(--border-subtle)", background: "rgba(255,255,255,0.02)" }
            }
            onClick={() => fileRef.current?.click()}
            onMouseEnter={e => { if (!file) (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-active)"; }}
            onMouseLeave={e => { if (!file) (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-subtle)"; }}
          >
            <Upload className="w-8 h-8 mx-auto mb-3" style={{ color: file ? "#00a6ca" : "var(--text-muted)" }} />
            {file ? (
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{file.name}</p>
            ) : (
              <>
                <p className="font-semibold" style={{ color: "var(--text-secondary)" }}>Перетащите .xlsx файл</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>или кликните для выбора</p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={e => handleFileChange(e.target.files?.[0] ?? null)} />
          {file && (
            <div className="mt-4 flex justify-end">
              <button className="btn-primary" onClick={() => setStep(1)}>
                Далее <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Step 1: Settings ── */}
      {step === 1 && (
        <div className="card p-5 space-y-4">
          <h2 className="font-display font-semibold" style={{ color: "var(--text-primary)" }}>Параметры импорта</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-eyebrow block mb-1">Уровень образования</label>
              <select className="input" value={educationLevel} onChange={e => setEducationLevel(e.target.value)}>
                <option value="">Все уровни (авто-маппинг медленнее)</option>
                {EDUCATION_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label-eyebrow block mb-1">Год периода *</label>
              <input type="number" className="input" value={periodYear} min={2020} max={2035}
                onChange={e => setPeriodYear(Number(e.target.value))} />
            </div>
            <div>
              <label className="label-eyebrow block mb-1">Месяц (если ежемесячные данные)</label>
              <select className="input" value={periodMonth} onChange={e => setPeriodMonth(e.target.value)}>
                <option value="">— Годовые данные —</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={String(i + 1)}>
                    {new Date(2000, i).toLocaleString("ru-RU", { month: "long" })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-eyebrow block mb-1">Колонка с БИН организации</label>
              <input type="text" className="input" placeholder="Например: БИН или Наименование"
                value={orgColumn} onChange={e => setOrgColumn(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-between pt-2">
            <button className="btn-ghost" onClick={() => setStep(0)}>Назад</button>
            <button className="btn-primary" onClick={loadPreview} disabled={loadingPreview}>
              {loadingPreview
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Анализируем файл…</>
                : <>Анализировать файл <ChevronRight className="w-3.5 h-3.5" /></>}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Mapping ── */}
      {step === 2 && preview && (
        <div className="space-y-4">
          {/* Preview table */}
          <div className="card p-5">
            <h2 className="font-display font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
              Превью файла
              <span className="ml-2 text-sm font-normal" style={{ color: "var(--text-muted)" }}>
                {preview.total_rows} строк, {preview.columns.length} колонок
              </span>
            </h2>
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    {preview.columns.slice(0, 8).map(c => (
                      <th key={c} className="whitespace-nowrap text-xs">{c}</th>
                    ))}
                    {preview.columns.length > 8 && (
                      <th className="text-xs" style={{ color: "var(--text-muted)" }}>+{preview.columns.length - 8}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample_rows.slice(0, 3).map((row, i) => (
                    <tr key={i}>
                      {preview.columns.slice(0, 8).map(c => (
                        <td key={c} className="text-xs whitespace-nowrap max-w-32 truncate">
                          {String(row[c] ?? "")}
                        </td>
                      ))}
                      {preview.columns.length > 8 && <td />}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mappings */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold" style={{ color: "var(--text-primary)" }}>
                Маппинг колонок
                <span className="ml-2 text-sm font-normal" style={{ color: "var(--text-muted)" }}>
                  {mappings.filter(m => m.catalog_field_id !== "").length} из {mappings.length} сопоставлено
                </span>
              </h2>
            </div>

            <div className="space-y-2">
              {mappings.map((m, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl"
                  style={
                    m.catalog_field_id !== ""
                      ? m.match_score && m.match_score >= 90
                        ? { background: "rgba(14,140,90,0.08)", border: "1px solid rgba(14,140,90,0.2)" }
                        : { background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)" }
                      : { background: "rgba(196,114,0,0.08)", border: "1px solid rgba(196,114,0,0.2)" }
                  }>
                  {/* Excel column */}
                  <div className="w-44 shrink-0">
                    <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{m.excel_column}</p>
                    {m.match_score && (
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>совп. {m.match_score}%</p>
                    )}
                  </div>

                  <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />

                  {/* Catalog field input */}
                  <div className="flex-1 min-w-0 relative">
                    <input
                      type="text"
                      className="input text-sm py-1"
                      placeholder="Поле каталога (введите для поиска)"
                      value={catalogSearch[idx] ?? m.catalog_field_name}
                      onChange={e => searchCatalogField(idx, e.target.value)}
                    />
                    {catalogOptions[idx]?.length > 0 && (
                      <div className="absolute z-10 rounded-xl mt-1 max-h-40 overflow-y-auto w-full"
                        style={{ background: "var(--surface-card)", border: "1px solid var(--border-active)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                        {catalogOptions[idx].map(opt => (
                          <button
                            key={opt.id}
                            className="w-full text-left px-3 py-2 text-sm transition-colors"
                            style={{ color: "var(--text-secondary)" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,168,202,0.1)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                            onClick={() => setMappingField(idx, opt)}
                          >
                            {opt.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Value type */}
                  <select
                    className="input py-1 w-28 text-sm shrink-0"
                    value={m.value_type}
                    onChange={e => updateMapping(idx, { value_type: e.target.value as "numeric" | "text" | "jsonb" })}
                  >
                    {VALUE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>

                  <button onClick={() => removeMapping(idx)} className="shrink-0 transition-colors"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#c1272d")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-between mt-4 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <button className="btn-ghost" onClick={() => setStep(1)}>Назад</button>
              <button
                className="btn-primary"
                onClick={executeImport}
                disabled={importing || mappings.filter(m => m.catalog_field_id !== "").length === 0}
              >
                {importing
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Импорт…</>
                  : <><Upload className="w-3.5 h-3.5" /> Импортировать</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Result ── */}
      {step === 3 && result && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-success" />
            <h2 className="font-display font-semibold" style={{ color: "var(--text-primary)" }}>Импорт завершён</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="label-eyebrow mb-1">Строк в файле</p>
              <p className="font-display text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                {result.total_rows.toLocaleString("ru-RU")}
              </p>
            </div>
            <div className="card p-4" style={{ border: "1px solid rgba(14,140,90,0.25)", background: "rgba(14,140,90,0.08)" }}>
              <p className="label-eyebrow mb-1 text-success">Значений записано</p>
              <p className="font-display text-2xl font-bold tabular-nums text-success">
                {result.inserted_values.toLocaleString("ru-RU")}
              </p>
            </div>
            <div className="card p-4">
              <p className="label-eyebrow mb-1">Организаций найдено</p>
              <p className="font-display text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                {result.matched_orgs.toLocaleString("ru-RU")}
              </p>
            </div>
            <div className="card p-4"
              style={result.skipped > 0 ? { border: "1px solid rgba(196,114,0,0.25)", background: "rgba(196,114,0,0.08)" } : {}}>
              <p className={`label-eyebrow mb-1 ${result.skipped > 0 ? "text-warning" : ""}`}>Пропущено</p>
              <p className={`font-display text-2xl font-bold tabular-nums ${result.skipped > 0 ? "text-warning" : ""}`}
                style={result.skipped === 0 ? { color: "var(--text-primary)" } : {}}>
                {result.skipped.toLocaleString("ru-RU")}
              </p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="card p-4" style={{ border: "1px solid rgba(196,114,0,0.25)", background: "rgba(196,114,0,0.06)" }}>
              <p className="label-eyebrow text-warning mb-2">Ошибки ({result.errors.length})</p>
              <ul className="space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <button className="btn-primary" onClick={reset}>
              <Plus className="w-3.5 h-3.5" /> Новый импорт
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
