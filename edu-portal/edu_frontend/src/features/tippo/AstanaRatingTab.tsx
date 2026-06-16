// src/features/tippo/AstanaRatingTab.tsx
import React, { useState, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/ui";
import { ChevronDown, ChevronUp } from "lucide-react";
import client from "@/api/client";

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

const B1_MAX = 18, B2_MAX = 54, B3_MAX = 28.5, B4_MAX = 21;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function norm(v: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((v / max) * 1000) / 10;
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

function CollegeRow({ college, rank, avgNorm, maxScore }: { college: AstanaCollege; rank: number; avgNorm: number; maxScore: number }) {
  const [open, setOpen] = useState(false);
  const n = norm(college.score, maxScore);
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
  const [rawData, setRawData] = useState<AstanaCollege[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ownershipFilter, setOwnershipFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score");

  useEffect(() => {
    setLoading(true);
    setError(null);
    client.get("/college-assessment/ratings", {
      params: { region: "Астана", limit: 500 },
    }).then(resp => {
      const items: any[] = resp.data.items ?? [];
      setRawData(items.map(item => ({
        id: String(item.id),
        name: item.college_name ?? "",
        district: item.district ?? "",
        ownership: item.ownership_form ?? "",
        block1: Number(item.block1_score) || 0,
        block2: Number(item.block2_score) || 0,
        block3: Number(item.block3_score) || 0,
        block4: Number(item.block4_score) || 0,
        score: Number(item.total_score) || 0,
        specs: (item.specs ?? []).map((s: any) => ({
          name: s.name ?? "",
          score: Number(s.score) || 0,
        })),
      })));
    }).catch(e => {
      setError(e?.response?.data?.detail ?? e?.message ?? "Ошибка загрузки");
    }).finally(() => setLoading(false));
  }, []);

  const maxScore = useMemo(
    () => rawData.reduce((m, c) => Math.max(m, c.score), 1),
    [rawData],
  );

  const filtered = useMemo(() => {
    let d = [...rawData];
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
  }, [rawData, ownershipFilter, sortKey]);

  const avgNorm = useMemo(() => {
    if (!filtered.length) return 0;
    return filtered.reduce((s, c) => s + norm(c.score, maxScore), 0) / filtered.length;
  }, [filtered, maxScore]);

  const strong = filtered.filter(c => norm(c.score, maxScore) >= 70).length;
  const mid    = filtered.filter(c => norm(c.score, maxScore) >= 40 && norm(c.score, maxScore) < 70).length;
  const weak   = filtered.filter(c => norm(c.score, maxScore) < 40).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-fc-steel-400 text-sm">
        Загрузка данных…
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-center text-danger text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Рейтинг колледжей г. Астана"
        subtitle={`${rawData.length} организации ТиПО · Нормализованная шкала 0–100 (лучший = 100)`}
      />

      {/* Filters */}
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
                <CollegeRow key={c.id} college={c} rank={i + 1} avgNorm={avgNorm} maxScore={maxScore} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
