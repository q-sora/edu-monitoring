// src/features/admin/OrganisationsPage.tsx
import React, { useState } from "react";
import { Search, X, Building2 } from "lucide-react";
import { useApi, useRegions } from "@/hooks/useApi";
import { Loader, ErrorBox, EmptyState, PageHeader } from "@/components/ui";
import { ORG_TYPE_RU, STATUS_RU } from "@/features/transparency/TransparencyPage";

interface Organisation {
  id: string;
  name_ru: string;
  bin_iin?: string;
  region_id?: number | null;
  org_type_id?: number | null;
  ownership_form_id?: number | null;
  status?: string;
}

export function OrganisationsPage() {
  const [q,          setQ]          = useState("");
  const [regionId,   setRegionId]   = useState<number | "">("");
  const [orgTypeId,  setOrgTypeId]  = useState<number | "">("");
  const [statusF,    setStatusF]    = useState<string>("");
  const [page,       setPage]       = useState(0);
  const limit = 50;

  const regions = useRegions();

  const resetPage = () => setPage(0);

  const apiUrl = React.useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit",  String(limit));
    params.set("offset", String(page * limit));
    if (q)         params.set("search", q);
    if (regionId)  params.set("region_id", String(regionId));
    if (orgTypeId) params.set("org_type_id", String(orgTypeId));
    if (statusF)   params.set("status", statusF);
    return `/admin/organisations?${params.toString()}`;
  }, [q, regionId, orgTypeId, statusF, page]);

  const { data, loading, error, refetch } = useApi<{ items: Organisation[]; total: number }>(
    apiUrl, [apiUrl],
  );

  const activeFilters = [
    q && `«${q}»`,
    regionId && regions.find(r => r.id === regionId)?.name_ru,
    orgTypeId && ORG_TYPE_RU[orgTypeId as number],
    statusF && STATUS_RU[statusF],
  ].filter(Boolean);

  const totalOrgs = data?.total ?? 0;
  const activeOrgs = data?.items.filter(o => o.status === "active").length ?? 0;
  const reorganizedOrgs = data?.items.filter(o => o.status === "reorganized").length ?? 0;
  const liquidatedOrgs = data?.items.filter(o => o.status === "liquidated").length ?? 0;
  const totalRegions = regions?.length ?? 0;

  const getStatusPillClass = (status?: string) => {
    switch (status) {
      case "active":
        return "bg-green-50 text-green-700 border-green-200/50";
      case "reorganized":
        return "bg-amber-50 text-amber-700 border-amber-200/50";
      case "liquidated":
        return "bg-red-50 text-red-700 border-red-200/50";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200/50";
    }
  };

  const headerActions = (
    <div className="flex flex-wrap items-center gap-3">
      {/* Поиск */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); resetPage(); }}
          placeholder="Поиск по названию или БИН..."
          className="border border-slate-200 bg-white rounded-md pl-8 pr-3 py-1.5 text-xs font-medium text-slate-700 outline-none w-48 focus:border-fc-navy transition-colors"
        />
      </div>

      {/* Выбор региона */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-500 font-medium font-sans">Регион:</span>
        <select
          value={regionId}
          onChange={e => { setRegionId(e.target.value ? Number(e.target.value) : ""); resetPage(); }}
          className="border border-slate-200 bg-white rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none cursor-pointer focus:border-fc-navy transition-colors"
        >
          <option value="">Все регионы</option>
          {regions.map(r => <option key={r.id} value={r.id}>{r.name_ru}</option>)}
        </select>
      </div>

      {/* Выбор типа */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-500 font-medium font-sans">Тип:</span>
        <select
          value={orgTypeId}
          onChange={e => { setOrgTypeId(e.target.value ? Number(e.target.value) : ""); resetPage(); }}
          className="border border-slate-200 bg-white rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none cursor-pointer focus:border-fc-navy transition-colors"
        >
          <option value="">Все типы</option>
          {Object.entries(ORG_TYPE_RU).map(([id, label]) =>
            <option key={id} value={id}>{label}</option>
          )}
        </select>
      </div>

      {/* Выбор статуса */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-500 font-medium font-sans">Статус:</span>
        <select
          value={statusF}
          onChange={e => { setStatusF(e.target.value); resetPage(); }}
          className="border border-slate-200 bg-white rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none cursor-pointer focus:border-fc-navy transition-colors"
        >
          <option value="">Все статусы</option>
          {Object.entries(STATUS_RU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Кнопка сброса */}
      {activeFilters.length > 0 && (
        <button
          onClick={() => { setQ(""); setRegionId(""); setOrgTypeId(""); setStatusF(""); resetPage(); }}
          className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 transition"
        >
          <X className="w-3.5 h-3.5" /> Сбросить
        </button>
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Реестр организаций"
        subtitle={`Система мониторинга образовательных организаций платформы ФЦ`}
        actions={headerActions}
      />

      {/* ─── Информационные карточки (метрики) ─── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-fc-sm p-5 flex flex-col items-center justify-center min-h-[96px] transition-all hover:shadow-fc-md hover:border-slate-300">
          <span className="text-3xl font-extrabold text-fc-navy tracking-tight">{totalOrgs}</span>
          <span className="text-xs text-slate-500 mt-2 font-semibold uppercase tracking-wider text-center">Всего организаций</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-fc-sm p-5 flex flex-col items-center justify-center min-h-[96px] transition-all hover:shadow-fc-md hover:border-slate-300">
          <span className="text-3xl font-extrabold text-success tracking-tight">{activeOrgs}</span>
          <span className="text-xs text-slate-500 mt-2 font-semibold uppercase tracking-wider text-center">Активные (на стр.)</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-fc-sm p-5 flex flex-col items-center justify-center min-h-[96px] transition-all hover:shadow-fc-md hover:border-slate-300">
          <span className="text-3xl font-extrabold text-amber-600 tracking-tight">{reorganizedOrgs}</span>
          <span className="text-xs text-slate-500 mt-2 font-semibold uppercase tracking-wider text-center">Реорганизовано</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-fc-sm p-5 flex flex-col items-center justify-center min-h-[96px] transition-all hover:shadow-fc-md hover:border-slate-300">
          <span className="text-3xl font-extrabold text-danger tracking-tight">{liquidatedOrgs}</span>
          <span className="text-xs text-slate-500 mt-2 font-semibold uppercase tracking-wider text-center">Ликвидировано</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-fc-sm p-5 flex flex-col items-center justify-center min-h-[96px] transition-all hover:shadow-fc-md hover:border-slate-300">
          <span className="text-3xl font-extrabold text-fc-blue tracking-tight">{totalRegions}</span>
          <span className="text-xs text-slate-500 mt-2 font-semibold uppercase tracking-wider text-center">Всего регионов</span>
        </div>
      </div>

      {/* ─── Информационный баннер (доля активности) ─── */}
      <div className="flex items-center gap-2.5 text-xs text-slate-700 bg-white border border-slate-200/80 rounded-xl px-4 py-2.5 mb-6 shadow-fc-sm">
        <span className="text-base select-none">📊</span>
        <span className="font-medium">
          Доля активных образовательных организаций в системе мониторинга АО «Финансовый центр»: <strong className="text-fc-navy font-bold">{totalOrgs > 0 ? ((activeOrgs / Math.max(1, data?.items.length ?? 1)) * 100).toFixed(1) : 0}%</strong> (на основе текущей страницы)
        </span>
      </div>

      <div className="card overflow-hidden shadow-fc-sm border border-slate-200/80">
        {/* ─── Шапка таблицы с легендой ─── */}
        <div className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <h3 className="font-display font-bold text-xs text-fc-navy uppercase tracking-fc-eyebrow">
            Реестр образовательных организаций
          </h3>
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-success"></span>
              <span>Активна</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-warning"></span>
              <span>Реорганизована</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-danger"></span>
              <span>Ликвидирована</span>
            </div>
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="px-5 py-2 flex gap-2 flex-wrap bg-slate-50" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            {activeFilters.map((f, i) => (
              <span key={i} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-fc-navy-50 text-fc-navy-700 border border-fc-navy-100">
                {f}
              </span>
            ))}
          </div>
        )}

        {loading && <Loader />}
        {error && <div className="p-4"><ErrorBox message={error} onRetry={refetch} /></div>}
        {data && data.items.length === 0 && <EmptyState title="Организации не найдены" hint="Попробуйте изменить фильтры" icon={Building2} />}

        {data && data.items.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr className="text-white bg-fc-navy font-semibold text-xs">
                    <th className="py-3 px-4 border-none first:rounded-tl-lg text-left" style={{ backgroundColor: "#19286d", color: "#ffffff", borderBottom: "none" }}>#</th>
                    <th className="py-3 px-4 border-none text-left" style={{ backgroundColor: "#19286d", color: "#ffffff", borderBottom: "none" }}>Название</th>
                    <th className="py-3 px-4 border-none text-left" style={{ backgroundColor: "#19286d", color: "#ffffff", borderBottom: "none" }}>Уровень образования</th>
                    <th className="py-3 px-4 border-none text-left" style={{ backgroundColor: "#19286d", color: "#ffffff", borderBottom: "none" }}>Регион</th>
                    <th className="py-3 px-4 border-none text-left" style={{ backgroundColor: "#19286d", color: "#ffffff", borderBottom: "none" }}>БИН</th>
                    <th className="py-3 px-4 border-none last:rounded-tr-lg text-left" style={{ backgroundColor: "#19286d", color: "#ffffff", borderBottom: "none" }}>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((org, idx) => (
                    <tr key={org.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-400 font-medium text-xs">
                        {(page * limit) + idx + 1}
                      </td>
                      <td className="px-4 py-3 font-semibold text-sm text-fc-navy max-w-[280px] truncate" title={org.name_ru}>
                        {org.name_ru}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {org.org_type_id ? (ORG_TYPE_RU[org.org_type_id] ?? "—") : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {org.region_id ? (regions.find(r => r.id === org.region_id)?.name_ru ?? "—") : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {org.bin_iin ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusPillClass(org.status)}`}>
                          {STATUS_RU[org.status ?? "active"] ?? org.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3.5 flex items-center justify-between text-xs bg-white" style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
              <span className="font-medium text-slate-500 font-sans">
                Показано {page * limit + 1}–{Math.min((page + 1) * limit, data.total)} из {data.total} записей
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  className="border border-slate-200 bg-white rounded-md px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Назад
                </button>
                <button
                  disabled={(page + 1) * limit >= data.total}
                  onClick={() => setPage(p => p + 1)}
                  className="border border-slate-200 bg-white rounded-md px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Вперёд →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
