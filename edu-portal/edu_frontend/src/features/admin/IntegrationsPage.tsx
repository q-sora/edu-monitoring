// src/features/admin/IntegrationsPage.tsx
import React, { useState } from "react";
import { RefreshCw, Loader2, Clock } from "lucide-react";
import { useApi, mutate } from "@/hooks/useApi";
import { Loader, ErrorBox, EmptyState, PageHeader } from "@/components/ui";

export function IntegrationsPage() {
  const { data: logs, loading, error, refetch } = useApi<any[]>("/integrations/sync-logs?limit=20");
  const [busy, setBusy] = useState<string | null>(null);

  const triggerSync = async (source: string) => {
    setBusy(source);
    try {
      await mutate("POST", "/integrations/sync/trigger", { source });
      setTimeout(refetch, 1500);
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Ошибка");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Интеграции" subtitle="Синхронизация с внешними системами" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {[
          { code: "nobd", name: "НОБД", desc: "Национальная образовательная база данных" },
          { code: "epvo", name: "ЕПВО", desc: "Единый портал высшего образования" },
        ].map(sys => (
          <div key={sys.code} className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="font-display font-bold" style={{ color: "var(--text-primary)" }}>{sys.name}</p>
              <span className="pill bg-success/10 text-success inline-flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-success rounded-full" />
                Активно
              </span>
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>{sys.desc}</p>
            <button onClick={() => triggerSync(sys.code)} disabled={busy !== null}
              className="btn-primary w-full">
              {busy === sys.code ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Запустить синхронизацию
            </button>
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <p className="font-display font-bold" style={{ color: "var(--text-primary)" }}>История синхронизаций</p>
        </div>
        {loading && <Loader />}
        {error && <div className="p-4"><ErrorBox message={error} onRetry={refetch} /></div>}
        {logs && logs.length === 0 && <EmptyState title="История пуста" icon={Clock} />}
        {logs && logs.length > 0 && (
          <table className="data-table">
            <thead>
              <tr><th>Время</th><th>Источник</th><th>Статус</th><th className="text-right">Записей</th></tr>
            </thead>
            <tbody>
              {logs.map((l: any) => (
                <tr key={l.id}>
                  <td className="text-xs" style={{ color: "var(--text-muted)" }}>{l.started_at ? new Date(l.started_at).toLocaleString("ru-RU") : "—"}</td>
                  <td className="font-medium uppercase">{l.source ?? "—"}</td>
                  <td>
                    <span className={`pill ${
                      l.status === "success" ? "bg-success/10 text-success" :
                      l.status === "failed"  ? "bg-danger/10 text-danger" :
                      "bg-warning/10 text-warning"
                    }`}>{l.status ?? "—"}</span>
                  </td>
                  <td className="text-right font-mono text-xs">{l.rows_synced ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
