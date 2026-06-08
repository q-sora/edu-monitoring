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
  { value: "gons",  label: "ГОНС" },
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

  // Step 1: file
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 2: settings
  const [educationLevel, setEducationLevel] = useState("");
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const [periodMonth, setPeriodMonth] = useState<string>("");
  const [orgColumn, setOrgColumn] = useState("");

  // Step 2→3: preview
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Step 3: mappings
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [catalogSearch, setCatalogSearch] = useState<Record<number, string>>({});
  const [catalogOptions, setCatalogOptions] = useState<Record<number, { id: number; name: string }[]>>({});
  const [searchTimers, setSearchTimers] = useState<Record<number, ReturnType<typeof setTimeout>>>({});

  // Step 4: result
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // ─── File drop ───────────────────────────────────────────────────────────

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

  // ─── Preview ─────────────────────────────────────────────────────────────

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
      // Build initial mappings from suggestions
      const rows: MappingRow[] = r.data.suggested_mappings.map(s => ({
        excel_column:     s.excel_column,
        catalog_field_id: s.catalog_field_id,
        catalog_field_name: s.catalog_field_name,
        value_type:       s.value_type,
        match_score:      s.match_score,
      }));
      // Add unmapped columns
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

  // ─── Catalog field search ─────────────────────────────────────────────────

  const searchCatalogField = (idx: number, query: string) => {
    setCatalogSearch(prev => ({ ...prev, [idx]: query }));
    if (searchTimers[idx]) clearTimeout(searchTimers[idx]);
    if (query.length < 2) {
      setCatalogOptions(prev => ({ ...prev, [idx]: [] }));
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const levelParam = educationLevel || undefined;
        const url = levelParam
          ? `/data-catalog/fields/${levelParam}/all`
          : "/data-catalog/fields/vipo/general";
        // Search all active fields by fetching levels + searching client-side
        // (no dedicated search endpoint — filter from levels list)
        const r = await client.get<{ fields: { id: number; field_name: string }[] }>(
          levelParam
            ? `/data-catalog/fields/${levelParam}/all`
            : `/data-catalog/levels`
        );
        // Fallback: just show query-filtered options from already-loaded catalog
        // We'll use the existing catalog levels endpoint and filter
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

  // ─── Execute import ───────────────────────────────────────────────────────

  const executeImport = async () => {
    if (!file) return;
    const validMappings = mappings
      .filter(m => m.catalog_field_id !== "")
      .map(m => ({
        excel_column:    m.excel_column,
        catalog_field_id: m.catalog_field_id,
        value_type:      m.value_type,
      }));

    if (validMappings.length === 0) {
      setImportError("Не задан ни один маппинг");
      return;
    }

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
    setStep(0);
    setFile(null);
    setPreview(null);
    setMappings([]);
    setResult(null);
    setImportError(null);
    setEducationLevel("");
    setPeriodYear(new Date().getFullYear());
    setPeriodMonth("");
    setOrgColumn("");
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-fc-navy-800">
            Универсальный импорт
          </h1>
          <p className="mt-1 text-sm text-fc-navy-400">
            Загрузка данных из Excel по полям каталога
          </p>
        </div>
        <FileUp className="w-5 h-5 text-fc-navy-400" />
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              i === step
                ? "bg-fc-navy-700 text-white"
                : i < step
                ? "bg-fc-navy-100 text-fc-navy-600"
                : "text-fc-navy-400"
            }`}>
              <span className="tabular-nums">{i + 1}</span>
              <span>{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className={`w-3.5 h-3.5 mx-1 ${i < step ? "text-fc-navy-400" : "text-fc-navy-200"}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {importError && (
        <div className="card border-danger/30 bg-danger/5 flex items-center gap-3 text-danger text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {importError}
          <button onClick={() => setImportError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Step 0: File upload ── */}
      {step === 0 && (
        <div className="card">
          <h2 className="font-display font-semibold text-fc-navy-700 mb-4">Выберите файл</h2>
          <div
            onDrop={onDrop}
            onDragOver={e => e.preventDefault()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
              file
                ? "border-fc-cyan-400 bg-fc-cyan-50"
                : "border-fc-navy-200 hover:border-fc-navy-400 bg-fc-navy-50"
            }`}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className={`w-8 h-8 mx-auto mb-3 ${file ? "text-fc-cyan-600" : "text-fc-navy-400"}`} />
            {file ? (
              <p className="font-semibold text-fc-navy-700">{file.name}</p>
            ) : (
              <>
                <p className="font-semibold text-fc-navy-600">Перетащите .xlsx файл</p>
                <p className="text-xs text-fc-navy-400 mt-1">или кликните для выбора</p>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
          />
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
        <div className="card space-y-4">
          <h2 className="font-display font-semibold text-fc-navy-700">Параметры импорта</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-eyebrow block mb-1">Уровень образования</label>
              <select
                className="input"
                value={educationLevel}
                onChange={e => setEducationLevel(e.target.value)}
              >
                <option value="">Все уровни (авто-маппинг медленнее)</option>
                {EDUCATION_LEVELS.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-eyebrow block mb-1">Год периода *</label>
              <input
                type="number"
                className="input"
                value={periodYear}
                min={2020}
                max={2035}
                onChange={e => setPeriodYear(Number(e.target.value))}
              />
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
              <input
                type="text"
                className="input"
                placeholder="Например: БИН или Наименование"
                value={orgColumn}
                onChange={e => setOrgColumn(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button className="btn-ghost" onClick={() => setStep(0)}>Назад</button>
            <button
              className="btn-primary"
              onClick={loadPreview}
              disabled={loadingPreview}
            >
              {loadingPreview
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Анализируем файл…</>
                : <>Анализировать файл <ChevronRight className="w-3.5 h-3.5" /></>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Mapping ── */}
      {step === 2 && preview && (
        <div className="space-y-4">
          {/* Preview table */}
          <div className="card">
            <h2 className="font-display font-semibold text-fc-navy-700 mb-3">
              Превью файла
              <span className="ml-2 text-sm font-normal text-fc-navy-400">
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
                    {preview.columns.length > 8 && <th className="text-xs text-fc-navy-400">+{preview.columns.length - 8}</th>}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample_rows.slice(0, 3).map((row, i) => (
                    <tr key={i}>
                      {preview.columns.slice(0, 8).map(c => (
                        <td key={c} className="text-xs text-fc-navy-600 whitespace-nowrap max-w-32 truncate">
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
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-fc-navy-700">
                Маппинг колонок
                <span className="ml-2 text-sm font-normal text-fc-navy-400">
                  {mappings.filter(m => m.catalog_field_id !== "").length} из {mappings.length} сопоставлено
                </span>
              </h2>
            </div>

            <div className="space-y-2">
              {mappings.map((m, idx) => (
                <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg ${
                  m.catalog_field_id !== ""
                    ? m.match_score && m.match_score >= 90
                      ? "bg-success/5 border border-success/20"
                      : "bg-fc-navy-50 border border-fc-navy-100"
                    : "bg-warning/5 border border-warning/20"
                }`}>
                  {/* Excel column */}
                  <div className="w-44 shrink-0">
                    <p className="text-xs font-medium text-fc-navy-700 truncate">{m.excel_column}</p>
                    {m.match_score && (
                      <p className="text-xs text-fc-navy-400">совп. {m.match_score}%</p>
                    )}
                  </div>

                  <ChevronRight className="w-3.5 h-3.5 text-fc-navy-400 shrink-0" />

                  {/* Catalog field input */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      className="input text-sm py-1"
                      placeholder="Поле каталога (введите для поиска)"
                      value={catalogSearch[idx] ?? m.catalog_field_name}
                      onChange={e => searchCatalogField(idx, e.target.value)}
                    />
                    {catalogOptions[idx]?.length > 0 && (
                      <div className="absolute z-10 bg-white border border-fc-navy-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                        {catalogOptions[idx].map(opt => (
                          <button
                            key={opt.id}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-fc-navy-50 text-fc-navy-700"
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
                    onChange={e => updateMapping(idx, { value_type: e.target.value as any })}
                  >
                    {VALUE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => removeMapping(idx)}
                    className="text-fc-navy-400 hover:text-danger shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-between mt-4 pt-4 border-t border-fc-navy-100">
              <button className="btn-ghost" onClick={() => setStep(1)}>Назад</button>
              <button
                className="btn-primary"
                onClick={executeImport}
                disabled={importing || mappings.filter(m => m.catalog_field_id !== "").length === 0}
              >
                {importing
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Импорт…</>
                  : <><Upload className="w-3.5 h-3.5" /> Импортировать</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Result ── */}
      {step === 3 && result && (
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-success" />
            <h2 className="font-display font-semibold text-fc-navy-700">Импорт завершён</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card bg-fc-navy-50">
              <p className="label-eyebrow text-fc-navy-400">Строк в файле</p>
              <p className="font-display text-2xl font-bold text-fc-navy-700 tabular-nums">{result.total_rows.toLocaleString("ru-RU")}</p>
            </div>
            <div className="card bg-success/5 border-success/20">
              <p className="label-eyebrow text-success">Значений записано</p>
              <p className="font-display text-2xl font-bold text-success tabular-nums">{result.inserted_values.toLocaleString("ru-RU")}</p>
            </div>
            <div className="card bg-fc-navy-50">
              <p className="label-eyebrow text-fc-navy-400">Организаций найдено</p>
              <p className="font-display text-2xl font-bold text-fc-navy-700 tabular-nums">{result.matched_orgs.toLocaleString("ru-RU")}</p>
            </div>
            <div className={`card ${result.skipped > 0 ? "bg-warning/5 border-warning/20" : "bg-fc-navy-50"}`}>
              <p className={`label-eyebrow ${result.skipped > 0 ? "text-warning" : "text-fc-navy-400"}`}>Пропущено</p>
              <p className={`font-display text-2xl font-bold tabular-nums ${result.skipped > 0 ? "text-warning" : "text-fc-navy-700"}`}>
                {result.skipped.toLocaleString("ru-RU")}
              </p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="card border-warning/30 bg-warning/5">
              <p className="label-eyebrow text-warning mb-2">Ошибки ({result.errors.length})</p>
              <ul className="space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-xs text-fc-navy-600 font-mono">{e}</li>
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
