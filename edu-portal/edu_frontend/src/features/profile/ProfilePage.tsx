// src/features/profile/ProfilePage.tsx
import React, { FormEvent, ReactNode, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { mutate } from "@/hooks/useApi";
import { ErrorBox, SuccessBox, PageHeader, Modal, Field, RoleBadge } from "@/components/ui";

export function ProfilePage() {
  const { user } = useAuth();
  const [changePwdOpen, setChangePwdOpen] = useState(false);
  if (!user) return null;

  return (
    <>
      <PageHeader title="Профиль" subtitle="Данные вашей учётной записи" />
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-lg flex items-center justify-center font-display font-black text-lg text-white"
               style={{ background: "rgba(0,104,180,0.4)" }}>
            {user.full_name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-xl font-display font-extrabold tracking-fc-tight" style={{ color: "var(--text-primary)" }}>{user.full_name}</p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{user.email}</p>
          </div>
        </div>
        <dl className="pt-4 space-y-3 text-sm" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <Row label="Роль"><RoleBadge role={user.role} /></Row>
          <Row label="UUID"><code className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{user.id}</code></Row>
          {user.org_id && <Row label="Организация"><code className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>{user.org_id}</code></Row>}
        </dl>
        <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={() => setChangePwdOpen(true)} className="btn-ghost">Сменить пароль</button>
        </div>
      </div>
      <ChangePasswordModal open={changePwdOpen} onClose={() => setChangePwdOpen(false)} />
    </>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="font-semibold" style={{ color: "var(--text-secondary)" }}>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== confirm) { setError("Пароли не совпадают"); return; }
    if (next.length < 8)  { setError("Минимум 8 символов"); return; }
    setLoading(true); setError(null);
    try {
      await mutate("POST", "/auth/change-password", { current_password: current, new_password: next });
      setOk(true);
      setTimeout(() => { setOk(false); onClose(); setCurrent(""); setNext(""); setConfirm(""); }, 1500);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Ошибка");
    } finally { setLoading(false); }
  };

  return (
    <Modal open={open} title="Смена пароля" onClose={onClose} size="sm">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Текущий пароль"><input type="password" required value={current} onChange={e => setCurrent(e.target.value)} className="input" /></Field>
        <Field label="Новый пароль"><input type="password" required minLength={8} value={next} onChange={e => setNext(e.target.value)} className="input" /></Field>
        <Field label="Подтвердите"><input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} className="input" /></Field>
        {error && <ErrorBox message={error} />}
        {ok && <SuccessBox message="Пароль изменён" />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Отмена</button>
          <button type="submit" disabled={loading} className="btn-primary">{loading ? "..." : "Сменить"}</button>
        </div>
      </form>
    </Modal>
  );
}
