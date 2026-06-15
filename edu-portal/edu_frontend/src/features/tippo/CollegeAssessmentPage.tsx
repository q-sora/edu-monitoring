import React, { useCallback, useRef, useState } from "react";
import {
  AlertTriangle, Building2, CheckCircle2, ChevronDown, ChevronUp,
  FileUp, Loader2, MapPin, Trophy, Upload,
} from "lucide-react";
import AstanaRatingTab from "./AstanaRatingTab";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import client from "@/api/client";
import { useApi } from "@/hooks/useApi";
import { ErrorBox } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CollegeRating {
  id: number;
  college_name: string;
  region: string;
  district: string | null;
  ownership_form: string | null;
  location_type: string | null;
  period_year: number;
  contingent_actual: number | null;
  capacity_design: number | null;
  teachers_total: number | null;
  total_score: number | null;
  specialty_count: number;
  avg_specialty_score: number | null;
  rank: number;
}

interface Specialty {
  specialty_code: string | null;
  specialty_name: string | null;
  specialty_score: number | null;
  employment_pct: number | null;
  academic_performance_pct: number | null;
  score_employment: number | null;
  score_academic: number | null;
  score_dual: number | null;
  dual_students_count: number | null;
  demo_exam_students: number | null;
  ws_student_place_republic: string | null;
  ws_student_place_intl: string | null;
}

interface RegionStat {
  region: string;
  college_count: number;
  avg_score: number | null;
  max_score: number | null;
  min_score: number | null;
  total_students: number | null;
  high_performers: number;
  low_performers: number;
}

interface TopSpecialty {
  specialty_name: string | null;
  specialty_code: string | null;
  college_name: string;
  region: string;
  employment_pct: number | null;
  specialty_score: number | null;
  dual_students_count: number | null;
  demo_exam_students: number | null;
}

interface ImportResult {
  filename: string;
  colleges_inserted: number;
  specialties_inserted: number;
  skipped: number;
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (score === null) return "text-fc-steel-400";
  if (score >= 20) return "text-success";
  if (score >= 15) return "text-fc-cyan-600";
  if (score >= 10) return "text-warning";
  return "text-danger";
}

function scoreBadge(score: number | null): string {
  if (score === null) return "bg-slate-100 text-fc-steel-500";
  if (score >= 20) return "bg-success/10 text-success";
  if (score >= 15) return "bg-fc-cyan-500/10 text-fc-cyan-700";
  if (score >= 10) return "bg-warning/10 text-warning";
  return "bg-danger/10 text-danger";
}

function fmt(v: number | null | undefined, decimals = 1): string {
  if (v === null || v === undefined) return "—";
  return v.toFixed(decimals);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SpecialtyPanel({ assessmentId, onClose }: { assessmentId: number; onClose: () => void }) {
  const { data, loading, error } = useApi<{ specialties: Specialty[] }>(
    `/college-assessment/${assessmentId}/specialties`,
    [assessmentId],
  );

  return (
    <div className="mt-2 card bg-fc-navy-50/50 border border-fc-navy-100">
      <div className="flex items-center justify-between mb-3">
        <span className="label-eyebrow text-fc-navy-700">Специальности</span>
        <button onClick={onClose} className="btn-ghost text-xs py-1 px-2">Свернуть</button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-fc-steel-400 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Загрузка…
        </div>
      )}
      {error && <ErrorBox message={error} />}

      {data && data.specialties.length === 0 && (
        <p className="text-sm text-fc-steel-400 py-2">Специальности не найдены</p>
      )}

      {data && data.specialties.length > 0 && (
        <div className="overflow-x-auto">
          <table className="data-table w-full text-xs">
            <thead>
              <tr>
                <th className="text-left">Специальность</th>
                <th className="text-right">Балл</th>
                <th className="text-right">Трудоустр.</th>
                <th className="text-right">Успеваемость</th>
                <th className="text-right">Дуальн.</th>
                <th className="text-center">WS РК</th>
              </tr>
            </thead>
            <tbody>
              {data.specialties.map((s, i) => (
                <tr key={i}>
                  <td className="font-medium max-w-xs">
                    <span className="text-fc-steel-400 mr-1">{s.specialty_code ?? ""}</span>
                    {s.specialty_name ?? "—"}
                  </td>
                  <td className={`text-right tabular-nums font-semibold ${scoreColor(s.specialty_score)}`}>
                    {fmt(s.specialty_score)}
                  </td>
                  <td className="text-right tabular-nums">{fmt(s.employment_pct)}%</td>
                  <td className="text-right tabular-nums">{fmt(s.academic_performance_pct)}%</td>
                  <td className="text-right tabular-nums">{s.dual_students_count ?? "—"}</td>
                  <td className="text-center">{s.ws_student_place_republic ?? "—"}</td>
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
// Tab: Import
// ─────────────────────────────────────────────────────────────────────────────

function ImportTab() {
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      setError("Поддерживаются только файлы .xlsx и .xls");
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onUpload = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (year) fd.append("period_year", year);
      const res = await client.post("/college-assessment/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [file, year]);

  return (
    <div className="max-w-2xl space-y-5">
      <div
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer
          ${dragging ? "border-fc-blue-400 bg-fc-blue-50" : "border-fc-navy-200 hover:border-fc-blue-300"}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="w-10 h-10 text-fc-steel-300 mx-auto mb-3" />
        {file ? (
          <p className="font-semibold text-fc-navy-800">{file.name}</p>
        ) : (
          <>
            <p className="font-semibold text-fc-navy-700">Перетащите файл или нажмите для выбора</p>
            <p className="text-sm text-fc-steel-400 mt-1">Шаблон оценки эффективности колледжей (.xlsx, .xls)</p>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      <div className="flex items-end gap-3">
        <div>
          <label className="label-eyebrow mb-1 block">Год (если не указан в имени файла)</label>
          <input
            type="number"
            className="input w-36"
            placeholder="2024"
            value={year}
            onChange={e => setYear(e.target.value)}
            min={2000}
            max={2100}
          />
        </div>
        <button
          className="btn-primary"
          onClick={onUpload}
          disabled={!file || loading}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <FileUp className="w-3.5 h-3.5 mr-1" />}
          {loading ? "Загрузка…" : "Загрузить"}
        </button>
      </div>

      {error && (
        <div className="card border-danger/20 bg-danger/5 flex items-start gap-2 text-sm text-danger">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {result && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <span className="font-semibold text-fc-navy-800">Импорт завершён: {result.filename}</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-display font-bold text-fc-navy-800 tabular-nums">
                {result.colleges_inserted}
              </p>
              <p className="text-xs text-fc-steel-500 label-eyebrow mt-1">Колледжей</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-display font-bold text-fc-cyan-600 tabular-nums">
                {result.specialties_inserted}
              </p>
              <p className="text-xs text-fc-steel-500 label-eyebrow mt-1">Специальностей</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-display font-bold text-fc-steel-500 tabular-nums">
                {result.skipped}
              </p>
              <p className="text-xs text-fc-steel-500 label-eyebrow mt-1">Пропущено</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div>
              <p className="label-eyebrow text-danger mb-2">Ошибки ({result.errors.length})</p>
              <ul className="text-xs text-danger/80 space-y-1 max-h-40 overflow-y-auto">
                {result.errors.map((e, i) => <li key={i} className="font-mono">{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Ratings
// ─────────────────────────────────────────────────────────────────────────────

function RatingsTab() {
  const [yearFilter, setYearFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [ownershipFilter, setOwnershipFilter] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
  if (yearFilter) params.set("period_year", yearFilter);
  if (regionFilter) params.set("region", regionFilter);
  if (ownershipFilter) params.set("ownership", ownershipFilter);

  const { data, loading, error } = useApi<{ items: CollegeRating[]; total: number }>(
    `/college-assessment/ratings?${params}`,
    [yearFilter, regionFilter, ownershipFilter, page],
  );

  const [expandedId, setExpandedId] = useState<number | null>(null);

  const doFilter = useCallback(() => setPage(0), []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="label-eyebrow mb-1 block">Год</label>
          <select className="input w-32" value={yearFilter} onChange={e => { setYearFilter(e.target.value); doFilter(); }}>
            <option value="">Все</option>
            {[2025, 2024, 2023, 2022].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow mb-1 block">Регион</label>
          <input
            className="input w-52"
            placeholder="Поиск по региону…"
            value={regionFilter}
            onChange={e => setRegionFilter(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doFilter()}
          />
        </div>
        <div>
          <label className="label-eyebrow mb-1 block">Форма собственности</label>
          <select className="input w-44" value={ownershipFilter} onChange={e => { setOwnershipFilter(e.target.value); doFilter(); }}>
            <option value="">Все</option>
            <option value="Коммунальная">Коммунальная</option>
            <option value="Частная">Частная</option>
            <option value="Республиканская">Республиканская</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-fc-steel-400 py-8">
          <Loader2 className="w-5 h-5 animate-spin" /> Загрузка рейтинга…
        </div>
      )}
      {error && <ErrorBox message={error} />}

      {data && (
        <>
          <p className="text-sm text-fc-steel-500">Всего: <span className="font-semibold text-fc-navy-800 tabular-nums">{data.total}</span> колледжей</p>

          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="text-center w-12">Ранг</th>
                  <th className="text-left">Колледж</th>
                  <th className="text-left">Регион</th>
                  <th className="text-center">Форма</th>
                  <th className="text-right">Контингент</th>
                  <th className="text-right">Педагогов</th>
                  <th className="text-right">Специальностей</th>
                  <th className="text-right">Ср. балл спец.</th>
                  <th className="text-right">Итоговый балл</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(c => (
                  <React.Fragment key={c.id}>
                    <tr
                      className="cursor-pointer hover:bg-fc-navy-50 transition-colors"
                      onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    >
                      <td className="text-center tabular-nums text-fc-steel-400 font-semibold">
                        {c.rank <= 3 ? (
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                            ${c.rank === 1 ? "bg-yellow-100 text-yellow-700"
                              : c.rank === 2 ? "bg-slate-100 text-slate-600"
                              : "bg-orange-100 text-orange-600"}`}>
                            {c.rank}
                          </span>
                        ) : c.rank}
                      </td>
                      <td className="font-medium text-fc-navy-800 max-w-xs">
                        <div className="truncate">{c.college_name}</div>
                        {c.district && <div className="text-xs text-fc-steel-400">{c.district}</div>}
                      </td>
                      <td className="text-fc-steel-600">{c.region}</td>
                      <td className="text-center">
                        {c.ownership_form && (
                          <span className="pill text-xs">{c.ownership_form}</span>
                        )}
                      </td>
                      <td className="text-right tabular-nums">{c.contingent_actual ?? "—"}</td>
                      <td className="text-right tabular-nums">{c.teachers_total ?? "—"}</td>
                      <td className="text-right tabular-nums">{c.specialty_count}</td>
                      <td className={`text-right tabular-nums font-medium ${scoreColor(c.avg_specialty_score)}`}>
                        {fmt(c.avg_specialty_score)}
                      </td>
                      <td className="text-right">
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-sm font-bold tabular-nums ${scoreBadge(c.total_score)}`}>
                          {fmt(c.total_score)}
                        </span>
                      </td>
                      <td className="text-center text-fc-steel-400">
                        {expandedId === c.id
                          ? <ChevronUp className="w-4 h-4" />
                          : <ChevronDown className="w-4 h-4" />}
                      </td>
                    </tr>
                    {expandedId === c.id && (
                      <tr>
                        <td colSpan={10} className="px-4 pb-3">
                          <SpecialtyPanel
                            assessmentId={c.id}
                            onClose={() => setExpandedId(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <button
              className="btn-ghost text-sm"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >← Назад</button>
            <span className="text-sm text-fc-steel-500">
              Стр. {page + 1} / {Math.ceil(data.total / PAGE_SIZE) || 1}
            </span>
            <button
              className="btn-ghost text-sm"
              disabled={(page + 1) * PAGE_SIZE >= data.total}
              onClick={() => setPage(p => p + 1)}
            >Вперёд →</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Regions
// ─────────────────────────────────────────────────────────────────────────────

function RegionsTab() {
  const [yearFilter, setYearFilter] = useState("");
  const params = yearFilter ? `?period_year=${yearFilter}` : "";
  const { data, loading, error } = useApi<{ by_region: RegionStat[] }>(
    `/college-assessment/stats/overview${params}`,
    [yearFilter],
  );

  const chartData = data?.by_region.map(r => ({
    name: r.region.length > 14 ? r.region.slice(0, 12) + "…" : r.region,
    avg_score: Number(r.avg_score) || 0,
    high: r.high_performers,
    low: r.low_performers,
  })) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-3">
        <div>
          <label className="label-eyebrow mb-1 block">Год</label>
          <select className="input w-32" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
            <option value="">Все</option>
            {[2025, 2024, 2023, 2022].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-fc-steel-400 py-8">
          <Loader2 className="w-5 h-5 animate-spin" /> Загрузка…
        </div>
      )}
      {error && <ErrorBox message={error} />}

      {data && data.by_region.length === 0 && (
        <div className="card text-center py-12 text-fc-steel-400">
          <MapPin className="w-10 h-10 mx-auto mb-3 text-fc-steel-200" />
          <p>Нет данных для отображения</p>
        </div>
      )}

      {data && data.by_region.length > 0 && (
        <>
          <div className="card">
            <p className="label-eyebrow text-fc-navy-700 mb-4">Средний балл по регионам</p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} domain={[0, "auto"]} />
                <Tooltip
                  formatter={(v: number) => [v.toFixed(1), "Средний балл"]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="avg_score" fill="#19286d" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.by_region.map(r => (
              <div key={r.region} className="card card-hover space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-fc-navy-800 text-sm">{r.region}</p>
                    <p className="text-xs text-fc-steel-400 mt-0.5">{r.college_count} колледжей</p>
                  </div>
                  <span className={`text-xl font-display font-bold tabular-nums ${scoreColor(r.avg_score)}`}>
                    {fmt(r.avg_score)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-success">
                    ↑ {r.high_performers} выше 20
                  </span>
                  <span className="text-danger">
                    ↓ {r.low_performers} ниже 10
                  </span>
                </div>
                {r.total_students !== null && (
                  <p className="text-xs text-fc-steel-400">
                    Контингент: <span className="tabular-nums font-medium text-fc-navy-700">{r.total_students.toLocaleString()}</span>
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-fc-steel-400">
                  <span>Мин: <span className="tabular-nums">{fmt(r.min_score)}</span></span>
                  <span className="text-fc-steel-200">|</span>
                  <span>Макс: <span className="tabular-nums">{fmt(r.max_score)}</span></span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Top Specialties
// ─────────────────────────────────────────────────────────────────────────────

function SpecialtiesTab() {
  const [yearFilter, setYearFilter] = useState("");
  const params = yearFilter ? `?period_year=${yearFilter}&limit=20` : "?limit=20";
  const { data, loading, error } = useApi<{ items: TopSpecialty[] }>(
    `/college-assessment/top-specialties/employment${params}`,
    [yearFilter],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div>
          <label className="label-eyebrow mb-1 block">Год</label>
          <select className="input w-32" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
            <option value="">Все</option>
            {[2025, 2024, 2023, 2022].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-fc-steel-400 py-8">
          <Loader2 className="w-5 h-5 animate-spin" /> Загрузка…
        </div>
      )}
      {error && <ErrorBox message={error} />}

      {data && (
        <div className="card">
          <p className="label-eyebrow text-fc-navy-700 mb-4">Топ-20 специальностей по трудоустройству</p>
          {data.items.length === 0 ? (
            <p className="text-sm text-fc-steel-400 py-4">Нет данных</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th className="text-center w-10">#</th>
                    <th className="text-left">Специальность</th>
                    <th className="text-left">Колледж</th>
                    <th className="text-left">Регион</th>
                    <th className="text-right">Трудоустр., %</th>
                    <th className="text-right">Дуальн. студ.</th>
                    <th className="text-right">Балл</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((s, i) => (
                    <tr key={i}>
                      <td className="text-center text-fc-steel-400 tabular-nums">{i + 1}</td>
                      <td className="font-medium text-fc-navy-800 max-w-xs">
                        {s.specialty_code && (
                          <span className="text-fc-steel-400 mr-1 text-xs">{s.specialty_code}</span>
                        )}
                        {s.specialty_name ?? "—"}
                      </td>
                      <td className="text-fc-steel-600 max-w-xs">
                        <div className="truncate">{s.college_name}</div>
                      </td>
                      <td className="text-fc-steel-500">{s.region}</td>
                      <td className="text-right">
                        <span className={`font-bold tabular-nums ${scoreColor(s.employment_pct)}`}>
                          {fmt(s.employment_pct)}%
                        </span>
                      </td>
                      <td className="text-right tabular-nums text-fc-steel-600">
                        {s.dual_students_count ?? "—"}
                      </td>
                      <td className={`text-right tabular-nums font-semibold ${scoreColor(s.specialty_score)}`}>
                        {fmt(s.specialty_score)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────


function MethodologyTab() {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="card">
        <h3 className="text-lg font-bold text-fc-navy-800 mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-warning" />
          Методика оценки эффективности колледжей ТиППО
        </h3>
        <p className="text-fc-steel-600 mb-4">
          Оценка проводится АО «Финансовый центр» на основе анализа деятельности организаций технического и профессионального, послесреднего образования по ряду ключевых показателей. Система оценки разделена на два уровня: уровень организации и уровень образовательной программы (специальности).
        </p>

        <div className="space-y-6">
          <section>
            <h4 className="font-bold text-fc-navy-700 mb-2 border-b border-fc-navy-100 pb-1">1. Показатели уровня колледжа</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-fc-navy-50 rounded-lg">
                <p className="font-semibold text-fc-navy-800">Инфраструктура и загрузка</p>
                <ul className="list-disc list-inside mt-1 text-fc-steel-600 space-y-1">
                  <li>Наличие и состояние ремонта</li>
                  <li>% загрузки проектной мощности</li>
                  <li>Наличие спортзала и общежития</li>
                  <li>Библиотечный фонд и читаемость</li>
                </ul>
              </div>
              <div className="p-3 bg-fc-navy-50 rounded-lg">
                <p className="font-semibold text-fc-navy-800">Кадровый потенциал и доходы</p>
                <ul className="list-disc list-inside mt-1 text-fc-steel-600 space-y-1">
                  <li>Доля педагогов-мастеров и экспертов</li>
                  <li>Педагоги с ученой степенью</li>
                  <li>Доход от мини-предприятий</li>
                  <li>Привлеченные спонсорские средства</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h4 className="font-bold text-fc-navy-700 mb-2 border-b border-fc-navy-100 pb-1">2. Показатели уровня специальности</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-fc-blue-50 rounded-lg">
                <p className="font-semibold text-fc-blue-800">Качество обучения и WS</p>
                <ul className="list-disc list-inside mt-1 text-fc-steel-600 space-y-1">
                  <li>Оснащенность лабораторий</li>
                  <li>Результаты WorldSkills (РК и межд.)</li>
                  <li>Качество знаний и успеваемость</li>
                  <li>Демонстрационные экзамены</li>
                </ul>
              </div>
              <div className="p-3 bg-fc-blue-50 rounded-lg">
                <p className="font-semibold text-fc-blue-800">Трудоустройство и партнерство</p>
                <ul className="list-disc list-inside mt-1 text-fc-steel-600 space-y-1">
                  <li>% трудоустройства выпускников</li>
                  <li>Охват дуальным обучением</li>
                  <li>Заявки от работодателей</li>
                  <li>Стартап-проекты студентов</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="bg-fc-navy-800 text-white p-4 rounded-xl shadow-lg">
            <h4 className="font-bold mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success" />
              Итоговый расчет
            </h4>
            <p className="text-sm opacity-90 leading-relaxed">
              Общий балл колледжа — это сумма баллов по всем общеорганизационным показателям. 
              Балл по специальности рассчитывается отдельно для каждой ОП на основе её специфических достижений. 
              В рейтинге «По регионам» используется средневзвешенный балл всех колледжей области.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}


export default function CollegeAssessmentPage({ userRole: _userRole }: { userRole?: string }) {
  return <AstanaRatingTab />;
}
