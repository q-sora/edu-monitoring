// src/components/ui/index.tsx
// Shared UI primitives — use design tokens from tailwind.config.js everywhere.
// ❌ bg-red-50 / bg-emerald-50 / bg-amber-50 — NEVER
// ✅ bg-danger/10 / bg-success/10 / bg-warning/10
import React, { ReactNode } from "react";
import {
  AlertTriangle, Check, FileSearch, Loader2, RefreshCw, X,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────

export function Loader({ label = "Загрузка…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-fc-steel-500">
      <Loader2 className="w-4 h-4 animate-spin mr-2" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-fc-navy-900">Ошибка</p>
        <p className="text-xs text-danger mt-0.5 break-words">{message}</p>
        {onRetry && (
          <button onClick={onRetry}
            className="mt-2 text-xs font-semibold text-danger hover:text-danger/80 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Повторить
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ title, hint, icon: Icon = FileSearch }: {
  title: string; hint?: string; icon?: React.ComponentType<any>;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
      <Icon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <p className="text-sm font-semibold text-fc-navy-900">{title}</p>
      {hint && <p className="text-xs text-fc-steel-500 mt-1">{hint}</p>}
    </div>
  );
}

export function StatCard({ label, value, hint, trend, accent, icon: Icon }: {
  label: string;
  value: string | number;
  hint?: string;
  trend?: "up" | "down" | "neutral";
  accent?: "navy" | "blue" | "cyan" | "steel" | "purple";
  icon?: React.ComponentType<any>;
}) {
  const accentBars: Record<string, string> = {
    navy:   "bg-fc-navy-700",
    blue:   "bg-fc-blue-500",
    cyan:   "bg-fc-cyan-500",
    steel:  "bg-fc-steel-500",
    purple: "bg-fc-purple-500",
  };
  const accentIcons: Record<string, string> = {
    navy:   "bg-fc-navy-50 text-fc-navy-700",
    blue:   "bg-fc-blue-50 text-fc-blue-600",
    cyan:   "bg-fc-cyan-50 text-fc-cyan-600",
    steel:  "bg-fc-steel-50 text-fc-steel-600",
    purple: "bg-fc-purple-50 text-fc-purple-600",
  };

  return (
    <div className="card p-4 relative overflow-hidden hover:shadow-fc-md transition-shadow">
      {accent && (
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentBars[accent]}`} />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="label-eyebrow truncate">{label}</p>
          <p className="text-3xl font-black font-display text-fc-navy-900 mt-2 tracking-fc-tight tabular-nums">
            {value}
          </p>
          {hint && (
            <p className={`text-xs mt-1.5 font-medium ${
              trend === "up"   ? "text-success" :
              trend === "down" ? "text-danger" :
                                 "text-fc-steel-500"
            }`}>
              {hint}
            </p>
          )}
        </div>
        {Icon && accent && (
          <div className={`p-2.5 rounded-lg shrink-0 ${accentIcons[accent] ?? ""}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    draft:        { bg: "bg-slate-100",      text: "text-slate-700",     label: "Черновик" },
    submitted:    { bg: "bg-fc-blue-50",     text: "text-fc-blue-700",   label: "Отправлено" },
    under_review: { bg: "bg-warning/10",     text: "text-warning",       label: "На рассмотрении" },
    approved:     { bg: "bg-success/10",     text: "text-success",       label: "Одобрено" },
    rejected:     { bg: "bg-danger/10",      text: "text-danger",        label: "Отклонено" },
  };
  const m = map[status] ?? { bg: "bg-slate-100", text: "text-slate-700", label: status };
  return <span className={`pill ${m.bg} ${m.text}`}>{m.label}</span>;
}

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    superadmin: { bg: "bg-fc-purple-50", text: "text-fc-purple-700", label: "Суперадмин" },
    admin:      { bg: "bg-fc-navy-50",   text: "text-fc-navy-700",   label: "Администратор" },
    management: { bg: "bg-fc-cyan-50",   text: "text-fc-cyan-700",   label: "Руководство" },
    data_entry: { bg: "bg-fc-steel-50",  text: "text-fc-steel-700",  label: "Ввод данных" },
  };
  const m = map[role] ?? { bg: "bg-slate-100", text: "text-slate-700", label: role };
  return <span className={`pill ${m.bg} ${m.text}`}>{m.label}</span>;
}

export function PageHeader({ title, subtitle, actions }: {
  title: string; subtitle?: string; actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
      <div className="min-w-0">
        <h1 className="text-2xl font-display font-extrabold text-fc-navy-900 tracking-fc-tight">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-fc-steel-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Modal({ open, title, onClose, children, size = "md" }: {
  open: boolean; title: string; onClose: () => void;
  children: ReactNode; size?: "sm" | "md" | "lg";
}) {
  if (!open) return null;
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };
  return (
    <div className="fixed inset-0 bg-fc-navy-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl ${widths[size]} w-full shadow-fc-xl max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <p className="font-display font-bold text-fc-navy-900">{title}</p>
          <button onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-md text-fc-steel-500 hover:text-fc-navy-900">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-eyebrow">{label}</span>
      {children}
    </label>
  );
}

export function SuccessBox({ message }: { message: string }) {
  return (
    <div className="p-3 bg-success/10 border border-success/20 rounded-md text-xs text-success flex items-center gap-1.5 font-semibold">
      <Check className="w-3.5 h-3.5 shrink-0" />
      {message}
    </div>
  );
}
