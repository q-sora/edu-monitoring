// src/features/admin/ApiKeysPage.tsx
import React, { FormEvent, useState } from "react";
import { Plus, Key } from "lucide-react";
import { useApi, mutate } from "@/hooks/useApi";
import { Loader, ErrorBox, EmptyState, PageHeader, Modal, Field } from "@/components/ui";

export function ApiKeysPage() {
  const { data, loading, error, refetch } = useApi<any[]>("/admin/api-keys");
  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const revoke = async (id: string) => {
    if (!confirm("Отозвать этот токен? Действие необратимо.")) return;
    await mutate("DELETE", `/admin/api-keys/${id}`);
    refetch();
  };

  return (
    <>
      <PageHeader
        title="API ключи" subtitle="Машинные токены доступа к API"
        actions={
          <button onClick={() => setCreateOpen(true)} className="btn-primary">
            <Plus className="w-3.5 h-3.5" /> Создать
          </button>
        }
      />
      {newKey && (
        <div className="mb-4 p-4 bg-warning/5 border border-warning/20 rounded-lg">
          <p className="font-bold text-warning text-sm">Сохраните этот токен — он больше не отобразится:</p>
          <code className="block mt-2 p-2 rounded border border-warning/20 font-mono text-xs break-all" style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-primary)" }}>{newKey}</code>
          <button onClick={() => setNewKey(null)} className="mt-2 text-xs font-semibold text-warning hover:underline">
            Я сохранил
          </button>
        </div>
      )}
      <div className="card overflow-hidden">
        {loading && <Loader />}
        {error && <div className="p-4"><ErrorBox message={error} onRetry={refetch} /></div>}
        {data && data.length === 0 && <EmptyState title="Токенов нет" icon={Key} />}
        {data && data.length > 0 && (
          <table className="data-table">
            <thead>
              <tr><th>Название</th><th>Scopes</th><th>Создан</th><th>Использовался</th><th className="text-right">Действия</th></tr>
            </thead>
            <tbody>
              {data.map((k: any) => (
                <tr key={k.id}>
                  <td className="font-medium">{k.name ?? "—"}</td>
                  <td className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{(k.scopes ?? []).join(", ") || "—"}</td>
                  <td className="text-xs" style={{ color: "var(--text-muted)" }}>{k.created_at ? new Date(k.created_at).toLocaleDateString("ru-RU") : "—"}</td>
                  <td className="text-xs" style={{ color: "var(--text-muted)" }}>{k.last_used_at ? new Date(k.last_used_at).toLocaleString("ru-RU") : "Не использовался"}</td>
                  <td className="text-right">
                    <button onClick={() => revoke(k.id)} className="text-xs font-semibold text-danger hover:underline">Отозвать</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <CreateApiKeyModal open={createOpen} onClose={() => setCreateOpen(false)}
        onCreated={(token) => { setNewKey(token); refetch(); }} />
    </>
  );
}

export function CreateApiKeyModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: (token: string) => void;
}) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const resp: any = await mutate("POST", "/admin/api-keys", { name, scopes });
      onCreated(resp.token ?? resp.api_token ?? "");
      setName(""); setScopes(["read"]);
      onClose();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const toggleScope = (s: string) => {
    setScopes(scopes.includes(s) ? scopes.filter(x => x !== s) : [...scopes, s]);
  };

  return (
    <Modal open={open} title="Новый API токен" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Название">
          <input required value={name} onChange={e => setName(e.target.value)}
            className="input" placeholder="Например: nightly-sync-bot" />
        </Field>
        <Field label="Scopes">
          <div className="flex gap-2">
            {["read", "write", "admin"].map(s => (
              <label key={s}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border rounded-md cursor-pointer text-sm font-semibold transition-colors"
                style={scopes.includes(s)
                  ? { borderColor: "rgba(0,104,180,0.6)", background: "rgba(0,104,180,0.15)", color: "#4da8d8" }
                  : { borderColor: "var(--border-subtle)", color: "var(--text-secondary)", background: "transparent" }}>
                <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggleScope(s)} className="hidden" />
                {s}
              </label>
            ))}
          </div>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Отмена</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "..." : "Создать"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
