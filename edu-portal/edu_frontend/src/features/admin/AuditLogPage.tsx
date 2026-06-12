// src/features/admin/AuditLogPage.tsx
import React, { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { Loader, ErrorBox, PageHeader } from "@/components/ui";

export function AuditLogPage() {
  const [page, setPage] = useState(0);
  const [tableFilter, setTableFilter] = useState("");
  const limit = 50;
  const url = `/admin/audit-log?limit=${limit}&offset=${page * limit}${tableFilter ? `&table_name=${tableFilter}` : ""}`;
  const { data, loading, error, refetch } = useApi<{ items: any[]; total: number }>(url, [page, tableFilter]);

  return (
    <>
      <PageHeader title="Журнал аудита" subtitle={`Все изменения в системе${data ? ` · всего ${data.total}` : ""}`} />
      <div className="card overflow-hidden">
        <div className="px-4 py-3 flex gap-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <select value={tableFilter} onChange={e => { setTableFilter(e.target.value); setPage(0); }} className="input max-w-xs">
            <option value="">Все таблицы</option>
            <option value="users">Пользователи</option>
            <option value="organizations">Организации</option>
            <option value="refresh_tokens">Сессии</option>
            <option value="science_activity">Научная деятельность</option>
            <option value="contingent_snapshots">Контингент</option>
            <option value="finance_records">Финансы</option>
            <option value="graduates_records">Выпускники</option>
            <option value="educational_process">Образ. процесс</option>
          </select>
        </div>
        {loading && <Loader />}
        {error && <div className="p-4"><ErrorBox message={error} onRetry={refetch} /></div>}
        {data && data.items.length > 0 && (
          <table className="data-table">
            <thead>
              <tr><th>Время</th><th>Таблица</th><th>Действие</th><th>Пользователь</th><th>Запись</th></tr>
            </thead>
            <tbody>
              {data.items.map((row: any) => (
                <tr key={row.id}>
                  <td className="text-xs whitespace-nowrap">
                    {new Date(row.changed_at).toLocaleString("ru-RU")}
                  </td>
                  <td className="font-mono text-xs">{row.table_name}</td>
                  <td>
                    <span className={`pill ${
                      row.action === "INSERT" ? "bg-success/10 text-success" :
                      row.action === "UPDATE" ? "bg-fc-blue-500/15 text-fc-blue-300" :
                      "bg-danger/10 text-danger"
                    }`}>{row.action}</span>
                  </td>
                  <td className="font-mono text-xs truncate max-w-[180px]">{row.changed_by ?? "system"}</td>
                  <td className="font-mono text-xs truncate max-w-[200px]" style={{ color: "var(--text-muted)" }}>{row.record_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && (
          <div className="px-4 py-3 flex items-center justify-between text-xs" style={{ borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
            <span>{page * limit + 1}–{Math.min((page + 1) * limit, data.total)} из {data.total}</span>
            <div className="flex gap-1">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="btn-ghost btn-sm">← Назад</button>
              <button disabled={(page + 1) * limit >= data.total} onClick={() => setPage(p => p + 1)} className="btn-ghost btn-sm">Вперёд →</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
