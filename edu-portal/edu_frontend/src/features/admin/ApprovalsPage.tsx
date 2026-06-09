// src/features/admin/ApprovalsPage.tsx
import React, { useState } from "react";
import { RefreshCw, X, Check } from "lucide-react";
import { useApi, useRegions, mutate } from "@/hooks/useApi";
import { Loader, ErrorBox, EmptyState, StatusBadge, PageHeader } from "@/components/ui";

const DOMAIN_OPTIONS = [
  { value: "",                       label: "Все модули" },
  { value: "science_activity",       label: "Научная деятельность" },
  { value: "contingent_snapshots",   label: "Контингент" },
  { value: "finance_records",        label: "Финансы" },
  { value: "graduates_records",      label: "Выпускники" },
  { value: "educational_process",    label: "Образ. процесс" },
];

export function ApprovalsPage() {
  const [statusF, setStatusF] = useState("submitted");
  const [domain,  setDomain]  = useState("");
  const [year,    setYear]    = useState<number | "">("");
  const [regionId, setRegionId] = useState<number | "">("");
  const [page,    setPage]    = useState(0);
  const limit = 50;

  const regions = useRegions();

  const apiUrl = React.useMemo(() => {
    const p = new URLSearchParams();
    p.set("status_filter", statusF);
    p.set("limit", String(limit));
    p.set("offset", String(page * limit));
    if (domain)   p.set("domain",    domain);
    if (year)     p.set("year",      String(year));
    if (regionId) p.set("region_id", String(regionId));
    return `/admin/pending-submissions?${p.toString()}`;
  }, [statusF, domain, year, regionId, page]);

  const { data: resp, loading, error, refetch } = useApi<{ items: any[]; total: number }>(apiUrl, [apiUrl]);
  const data = resp?.items ?? [];

  const resetPage = () => setPage(0);

  return (
    <>
      <PageHeader
        title="Согласование заявок"
        subtitle={`Очередь на проверку${resp ? ` · всего ${resp.total}` : ""}`}
        actions={
          <button onClick={refetch} className="btn-ghost">
            <RefreshCw className="w-3.5 h-3.5" /> Обновить
          </button>
        }
      />

      {/* Фильтры */}
      <div className="card mb-4 px-4 py-3 flex flex-wrap gap-2 items-center">
        <select value={statusF} onChange={e => { setStatusF(e.target.value); resetPage(); }}
          className="input py-1.5 text-sm min-w-[160px]">
          <option value="submitted">Отправлено</option>
          <option value="under_review">На рассмотрении</option>
        </select>

        <select value={domain} onChange={e => { setDomain(e.target.value); resetPage(); }}
          className="input py-1.5 text-sm min-w-[180px]">
          {DOMAIN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select value={year} onChange={e => { setYear(e.target.value ? Number(e.target.value) : ""); resetPage(); }}
          className="input py-1.5 text-sm w-24">
          <option value="">Все годы</option>
          {[2025,2024,2023,2022,2021,2020].map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select value={regionId} onChange={e => { setRegionId(e.target.value ? Number(e.target.value) : ""); resetPage(); }}
          className="input py-1.5 text-sm min-w-[160px]">
          <option value="">Все регионы</option>
          {regions.map(r => <option key={r.id} value={r.id}>{r.name_ru}</option>)}
        </select>

        {(domain || year || regionId) && (
          <button onClick={() => { setDomain(""); setYear(""); setRegionId(""); resetPage(); }}
            className="btn-ghost py-1.5 text-xs hover:text-danger">
            <X className="w-3 h-3" /> Сбросить
          </button>
        )}
      </div>

      {loading && <Loader />}
      {error && <ErrorBox message={error} onRetry={refetch} />}
      {!loading && data.length === 0 && (
        <EmptyState title="Нет заявок по выбранным фильтрам" hint="Попробуйте изменить фильтры или статус" icon={Check} />
      )}
      {data.length > 0 && (
        <div className="space-y-2">
          {data.map((item: any, i: number) => (
            <ApprovalRow key={item.id ?? i} item={item} onChange={refetch} />
          ))}
        </div>
      )}

      {resp && resp.total > limit && (
        <div className="mt-4 flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
          <span>{page * limit + 1}–{Math.min((page + 1) * limit, resp.total)} из {resp.total}</span>
          <div className="flex gap-1">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="btn-ghost btn-sm">← Назад</button>
            <button disabled={(page + 1) * limit >= resp.total} onClick={() => setPage(p => p + 1)} className="btn-ghost btn-sm">Вперёд →</button>
          </div>
        </div>
      )}
    </>
  );
}

export function ApprovalRow({ item, onChange }: { item: any; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);

  const changeStatus = async (status: string) => {
    setBusy(true);
    try {
      const domain = item.domain ?? item.table_name ?? "science-activity";
      await mutate("PATCH", `/organisations/${item.org_id}/${domain}/${item.id}/status`,
        { new_status: status, comment: comment || undefined });
      onChange();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-display font-bold" style={{ color: "var(--text-primary)" }}>{item.domain ?? item.table_name ?? "Раздел"}</p>
            <StatusBadge status={item.submission_status ?? "submitted"} />
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {item.org_name ?? item.org_id} · период {item.period_year ?? "—"} ·
            отправлено {item.submitted_at ? new Date(item.submitted_at).toLocaleString("ru-RU") : "—"}
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button onClick={() => setOpen(!open)} className="btn-ghost btn-sm">Комментарий</button>
          <button onClick={() => changeStatus("approved")} disabled={busy}
            className="btn-success btn-sm">
            <Check className="w-3 h-3" /> Одобрить
          </button>
          <button onClick={() => changeStatus("rejected")} disabled={busy || !comment}
            title={!comment ? "Добавьте комментарий" : ""} className="btn-danger btn-sm">
            <X className="w-3 h-3" /> Отклонить
          </button>
        </div>
      </div>
      {open && (
        <textarea value={comment} onChange={e => setComment(e.target.value)}
          placeholder="Комментарий для отправителя (обязателен при отклонении)…"
          className="input mt-3" rows={2} />
      )}
    </div>
  );
}
