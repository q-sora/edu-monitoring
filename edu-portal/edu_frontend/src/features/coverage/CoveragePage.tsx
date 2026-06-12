// src/features/coverage/CoveragePage.tsx
import React, { useState } from "react";
import { Search, X } from "lucide-react";
import { useApi, useRegions } from "@/hooks/useApi";
import { Loader, ErrorBox, StatCard, PageHeader } from "@/components/ui";
import { ORG_TYPE_RU } from "@/features/transparency/TransparencyPage";

interface CoverageOrg {
  id: string;
  name_ru: string;
  approved: number;
  total: number;
  modules: {
    contingent?: string | null;
    finance?: string | null;
    science?: string | null;
    graduates?: string | null;
    education?: string | null;
  };
}

interface CoverageData {
  year: number;
  organizations: CoverageOrg[];
  summary: {
    orgs_total: number;
    cells_total: number;
    cells_filled: number;
    cells_approved: number;
    coverage_pct: number;
  };
}

const MODULE_LABELS: Record<string, string> = {
  contingent: "Контингент",
  finance:    "Финансы",
  science:    "Наука",
  graduates:  "Выпускники",
  education:  "Образование",
};

const STATUS_COLORS: Record<string, string> = {
  approved:     "bg-success/15 text-success",
  under_review: "bg-warning/15 text-warning",
  submitted:    "bg-fc-blue-500/15 text-fc-blue-300",
  draft:        "bg-gray-100 text-gray-700",
};
const STATUS_LABELS: Record<string, string> = {
  approved:     "Утверждено",
  under_review: "На проверке",
  submitted:    "Подано",
  draft:        "Черновик",
};

const STATUS_CELL_COLORS: Record<string, string> = {
  approved:     "text-success",
  under_review: "text-warning",
  submitted:    "text-fc-blue-500",
  draft:        "text-gray-500",
};

export function CoverageCell({ status }: { status: string | null | undefined }) {
  if (!status) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm font-bold text-gray-400">—</span>
      </div>
    );
  }
  const colorClass = STATUS_CELL_COLORS[status] ?? "text-gray-500";
  const lbl = STATUS_LABELS[status] ?? status;
  return (
    <div className="flex items-center justify-center h-full">
      <span className={`text-sm font-bold uppercase ${colorClass}`}>
        {lbl}
      </span>
    </div>
  );
}

export function CoveragePage() {
  const [year,       setYear]       = useState(2025);
  const [regionId,   setRegionId]   = useState<number | "">("");
  const [orgTypeId,  setOrgTypeId]  = useState<number | "">("");
  const [search,     setSearch]     = useState("");
  const [page,       setPage]       = useState(0);
  const limit = 50;

  const regions = useRegions();

  const apiUrl = React.useMemo(() => {
    const p = new URLSearchParams();
    p.set("year", String(year));
    p.set("limit", String(limit));
    p.set("offset", String(page * limit));
    if (regionId)  p.set("region_id",   String(regionId));
    if (orgTypeId) p.set("org_type_id",  String(orgTypeId));
    if (search)    p.set("search",       search);
    return `/admin/coverage?${p.toString()}`;
  }, [year, regionId, orgTypeId, search, page]);

  const { data, loading, error } = useApi<CoverageData & { total: number; limit: number; offset: number }>(
    apiUrl, [apiUrl],
  );

  const modules = ["contingent", "finance", "science", "graduates", "education"];

  const resetPage = () => setPage(0);

  return (
    <>
      <PageHeader
        title="Покрытие данных"
        subtitle="Какие организации подали данные по каждому модулю"
      />

      {/* ─── Фильтры ─── */}
      <div className="rounded-2xl border border-gray-200 bg-white mb-4 px-4 py-3 flex flex-wrap gap-2 items-center">
        <select value={year} onChange={e => { setYear(Number(e.target.value)); resetPage(); }}
          className="input py-1.5 text-sm w-24">
          {[2025,2024,2023,2022,2021,2020].map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select value={regionId} onChange={e => { setRegionId(e.target.value ? Number(e.target.value) : ""); resetPage(); }}
          className="input py-1.5 text-sm min-w-[160px]">
          <option value="">Все регионы</option>
          {regions.map(r => <option key={r.id} value={r.id}>{r.name_ru}</option>)}
        </select>

        <select value={orgTypeId} onChange={e => { setOrgTypeId(e.target.value ? Number(e.target.value) : ""); resetPage(); }}
          className="input py-1.5 text-sm min-w-[160px]">
          <option value="">Все типы</option>
          {Object.entries(ORG_TYPE_RU).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>

        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input value={search} onChange={e => { setSearch(e.target.value); resetPage(); }}
            placeholder="Поиск…" className="input pl-9 py-1.5 text-sm" />
        </div>

        {(regionId || orgTypeId || search) && (
          <button onClick={() => { setRegionId(""); setOrgTypeId(""); setSearch(""); resetPage(); }}
            className="btn-ghost py-1.5 text-xs hover:text-danger">
            <X className="w-3 h-3" /> Сбросить
          </button>
        )}
      </div>

      {loading && <Loader />}
      {error && <ErrorBox message={error} />}

      {data && (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 p-5 bg-white rounded-2xl border border-gray-200">
            <StatCard accent="navy"  label="Организаций в фильтре" value={data.total ?? data.summary.orgs_total} hint="По выбранным условиям" />
            <StatCard accent="blue"  label="Ячеек заполнено" value={`${data.summary.cells_filled}/${data.summary.cells_total}`} hint="Из 5 модулей" />
            <StatCard accent="cyan"  label="Утверждено"     value={data.summary.cells_approved} hint="Записей approved" />
            <StatCard accent={data.summary.coverage_pct === 100 ? "cyan" : "steel"}
              label="Покрытие" value={`${data.summary.coverage_pct}%`} hint="Ячеек с данными" />
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-4 p-4 bg-white rounded-2xl border border-gray-200">
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <div key={k} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${STATUS_COLORS[k]}`}>
                {v}
              </div>
            ))}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
              НЕТ — данные не поданы
            </div>
          </div>

          {/* Matrix */}
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-fc-blue-700 to-fc-blue-900">
                  <th className="px-4 py-3 text-left font-bold min-w-[220px] text-white">
                    Организация
                  </th>
                  {modules.map(m => (
                    <th key={m} className="px-3 py-3 text-center font-bold min-w-[110px] text-white">
                      {MODULE_LABELS[m]}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center font-bold min-w-[80px] text-white">
                    Итого
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.organizations.map(org => (
                  <tr key={org.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 max-w-[220px]">
                      <p className="font-medium leading-snug truncate text-gray-800" title={org.name_ru}>{org.name_ru}</p>
                    </td>
                    {modules.map(m => (
                      <td key={m} className="px-3 py-2">
                        <CoverageCell status={(org.modules as any)[m]} />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold ${
                        org.approved === org.total
                          ? "bg-success/15 text-success"
                          : org.approved > 0
                          ? "bg-warning/15 text-warning"
                          : "bg-gray-100 text-gray-700"
                      }`}>
                        {org.approved}/{org.total}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Пагинация */}
            {data.total > limit && (
              <div className="px-4 py-3 flex items-center justify-between text-xs text-gray-500 border-t border-gray-200 rounded-b-2xl">
                <span>
                  {page * limit + 1}–{Math.min((page + 1) * limit, data.total)} из {data.total}
                </span>
                <div className="flex gap-1">
                  <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}
                    className="btn-ghost btn-sm text-gray-600 hover:bg-gray-100">← Назад</button>
                  <button disabled={(page + 1) * limit >= data.total} onClick={() => setPage(p => p + 1)}
                    className="btn-ghost btn-sm text-gray-600 hover:bg-gray-100">Вперёд →</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
