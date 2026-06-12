// src/features/admin/UsersPage.tsx
import React, { FormEvent, useState } from "react";
import { Plus, ShieldCheck, Loader2 } from "lucide-react";
import { mutate } from "@/hooks/useApi";
import { useAuth } from "@/auth/AuthContext";
import {
  ErrorBox, SuccessBox, PageHeader, Modal, Field, RoleBadge,
} from "@/components/ui";

export function UsersPage() {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Пользователи"
        subtitle="Управление учётными записями системы"
        actions={
          <button onClick={() => setCreateOpen(true)} className="btn-primary">
            <Plus className="w-3.5 h-3.5" /> Добавить
          </button>
        }
      />

      <div className="card p-6">
        <div className="flex items-start gap-3 p-4 rounded-lg" style={{ background: "rgba(0,104,180,0.1)", border: "1px solid rgba(0,104,180,0.25)" }}>
          <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-fc-blue-400" />
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Создание новых пользователей</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              Используйте кнопку «Добавить» для создания учётных записей.
              Пользователи получат приглашение на смену пароля при первом входе.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <p className="label-eyebrow mb-3">Ваш аккаунт</p>
          <table className="data-table">
            <thead>
              <tr><th>ФИО</th><th>Email</th><th>Роль</th></tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-medium">{user?.full_name}</td>
                <td>{user?.email}</td>
                <td><RoleBadge role={user?.role ?? ""} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

export function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    email: "", password: "", full_name: "", role: "data_entry", org_id: "", phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: any = {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        full_name: form.full_name.trim(),
        role: form.role,
        phone: form.phone || undefined,
        org_id: form.org_id || undefined,
      };
      await mutate("POST", "/auth/register", payload);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onClose(); }, 1500);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Ошибка создания");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} title="Новый пользователь" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Email">
          <input type="email" required value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            className="input" placeholder="user@university.kz" />
        </Field>
        <Field label="ФИО">
          <input required value={form.full_name}
            onChange={e => setForm({ ...form, full_name: e.target.value })}
            className="input" placeholder="Иванов Иван Иванович" />
        </Field>
        <Field label="Пароль">
          <input type="password" required minLength={8} value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            className="input" placeholder="Не менее 8 символов" />
        </Field>
        <Field label="Роль">
          <select value={form.role}
            onChange={e => setForm({ ...form, role: e.target.value })}
            className="input">
            <option value="data_entry">Ввод данных</option>
            <option value="management">Руководство</option>
            <option value="admin">Администратор</option>
            <option value="superadmin">Суперадмин</option>
          </select>
        </Field>
        {form.role === "data_entry" && (
          <Field label="UUID организации">
            <input required value={form.org_id}
              onChange={e => setForm({ ...form, org_id: e.target.value })}
              className="input font-mono text-xs" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          </Field>
        )}
        <Field label="Телефон (опц.)">
          <input value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            className="input" placeholder="+7 777 123 45 67" />
        </Field>
        {error && <ErrorBox message={error} />}
        {success && <SuccessBox message="Пользователь создан" />}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Отмена</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Создать
          </button>
        </div>
      </form>
    </Modal>
  );
}
