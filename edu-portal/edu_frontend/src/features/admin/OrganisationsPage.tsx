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

  return (
    <>
      <PageHeader
        title="Организации"
        subtitle={`Реестр образовательных организаций${data ? ` · ${data.total}` : ""}`}
      />

      <div className="card overflow-hidden">
        {/* ─── Панель фильтров ─── */}
        <div className="px-4 py-3 flex flex-wrap gap-2 items-center" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input value={q}
              onChange={e => { setQ(e.target.value); resetPage(); }}
              placeholder="Поиск по названию или БИН…"
              className="input pl-9 py-1.5 text-sm" />
          </div>

          <select value={regionId} onChange={e => { setRegionId(e.target.value ? Number(e.target.value) : ""); resetPage(); }}
            className="input py-1.5 text-sm min-w-[160px]">
            <option value="">Все регионы</option>
            {regions.map(r => <option key={r.id} value={r.id}>{r.name_ru}</option>)}
          </select>

          <select value={orgTypeId} onChange={e => { setOrgTypeId(e.target.value ? Number(e.target.value) : ""); resetPage(); }}
            className="input py-1.5 text-sm min-w-[160px]">
            <option value="">Все типы</option>
            {Object.entries(ORG_TYPE_RU).map(([id, label]) =>
              <option key={id} value={id}>{label}</option>
            )}
          </select>

          <select value={statusF} onChange={e => { setStatusF(e.target.value); resetPage(); }}
            className="input py-1.5 text-sm min-w-[140px]">
            <option value="">Все статусы</option>
            {Object.entries(STATUS_RU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>

          {activeFilters.length > 0 && (
            <button onClick={() => { setQ(""); setRegionId(""); setOrgTypeId(""); setStatusF(""); resetPage(); }}
              className="btn-ghost py-1.5 text-xs hover:text-danger">
              <X className="w-3 h-3" /> Сбросить
            </button>
          )}
        </div>

        {activeFilters.length > 0 && (
          <div className="px-4 py-2 flex gap-2 flex-wrap" style={{ borderBottom: "1px solid var(--border-subtle)", background: "rgba(0,104,180,0.08)" }}>
            {activeFilters.map((f, i) => (
              <span key={i} className="pill text-xs" style={{ background: "rgba(0,104,180,0.2)", color: "#4da8d8" }}>{f}</span>
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
                  <tr>
                    <th>Название</th>
                    <th>Уровень образования</th>
                    <th>Регион</th>
                    <th>БИН</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(org => (
                    <tr key={org.id}>
                      <td className="font-medium max-w-[220px] truncate" title={org.name_ru}>{org.name_ru}</td>
                      <td className="text-xs">
                        {org.org_type_id ? (ORG_TYPE_RU[org.org_type_id] ?? "—") : "—"}
                      </td>
                      <td className="text-xs">
                        {org.region_id ? (regions.find(r => r.id === org.region_id)?.name_ru ?? "—") : "—"}
                      </td>
                      <td className="font-mono text-xs">{org.bin_iin ?? "—"}</td>
                      <td>
                        <span className={`pill ${
                          org.status === "active" ? "bg-success/10 text-success" : "bg-white/5 text-white/40"
                        }`}>
                          {STATUS_RU[org.status ?? "active"] ?? org.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 flex items-center justify-between text-xs" style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
              <span>{page * limit + 1}–{Math.min((page + 1) * limit, data.total)} из {data.total}</span>
              <div className="flex gap-1">
                <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}
                  className="btn-ghost btn-sm">← Назад</button>
                <button disabled={(page + 1) * limit >= data.total} onClick={() => setPage(p => p + 1)}
                  className="btn-ghost btn-sm">Вперёд →</button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
