// src/components/ui/index.tsx
import React, { ReactNode } from "react";
export * from "./FormFields";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, Check, FileSearch, Loader2, RefreshCw, X,
} from "lucide-react";
import { staggerItem, modalOverlay, modalContent } from "@/lib/animations";

export function Loader({ label = "Загрузка…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-12" style={{ color: "var(--text-muted)" }}>
      <Loader2 className="w-4 h-4 animate-spin mr-2" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="card p-4 space-y-3 overflow-hidden">
      <div className="h-2.5 w-20 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.08)" }} />
      <div className="h-8 w-14 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.12)" }} />
      {Array.from({ length: Math.max(0, lines - 1) }).map((_, i) => (
        <div key={i} className="h-2 rounded animate-pulse"
             style={{ width: `${55 + i * 18}%`, background: "rgba(255,255,255,0.06)" }} />
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={2} />
      ))}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-danger/20 bg-danger/10 p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Ошибка</p>
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
    <div className="rounded-lg p-12 text-center" style={{
      border: "1px dashed var(--border-active)",
      background: "rgba(255,255,255,0.02)",
    }}>
      <Icon className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
      {hint && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{hint}</p>}
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
  const accentColors: Record<string, string> = {
    navy:   "#19286d",
    blue:   "#0068b4",
    cyan:   "#00a6ca",
    steel:  "#296695",
    purple: "#801e82",
  };
  const color = accent ? accentColors[accent] : "#00a6ca";

  return (
    <motion.div
      variants={staggerItem}
      className="card p-4 relative overflow-hidden transition-all"
      style={{ cursor: "default" }}
      whileHover={{ borderColor: "var(--border-active)", y: -1 }}
    >
      {accent && (
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: color }} />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="label-eyebrow truncate">{label}</p>
          <p className="text-3xl font-black font-display mt-2 tracking-fc-tight tabular-nums"
             style={{ color: "var(--text-primary)" }}>
            {value}
          </p>
          {hint && (
            <p className={`text-xs mt-1.5 font-medium ${
              trend === "up"   ? "text-success" :
              trend === "down" ? "text-danger"  : ""
            }`} style={!trend || trend === "neutral" ? { color: "var(--text-muted)" } : {}}>
              {hint}
            </p>
          )}
        </div>
        {Icon && accent && (
          <div className="p-2.5 rounded-lg shrink-0"
               style={{ background: `${color}22`, color }}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    draft:        { bg: "rgba(255,255,255,0.06)", color: "var(--text-secondary)", label: "Черновик" },
    submitted:    { bg: "rgba(0,104,180,0.15)",   color: "#4da8d8",               label: "Отправлено" },
    under_review: { bg: "rgba(196,114,0,0.15)",   color: "#f39c12",               label: "На рассмотрении" },
    approved:     { bg: "rgba(14,140,90,0.15)",   color: "#2ecc71",               label: "Одобрено" },
    rejected:     { bg: "rgba(193,39,45,0.15)",   color: "#e74c3c",               label: "Отклонено" },
  };
  const m = map[status] ?? { bg: "rgba(255,255,255,0.06)", color: "var(--text-secondary)", label: status };
  return (
    <span className="pill" style={{ background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    superadmin: { bg: "rgba(128,30,130,0.2)", color: "#c248c4", label: "Суперадмин" },
    admin:      { bg: "rgba(25,40,109,0.4)",  color: "#8ca0c8", label: "Администратор" },
    management: { bg: "rgba(0,168,202,0.15)", color: "#00a6ca", label: "Руководство" },
    data_entry: { bg: "rgba(41,102,149,0.2)", color: "#4da8d8", label: "Ввод данных" },
  };
  const m = map[role] ?? { bg: "rgba(255,255,255,0.06)", color: "var(--text-secondary)", label: role };
  return (
    <span className="pill" style={{ background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: {
  title: string; subtitle?: string; actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 pb-4"
         style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <div className="min-w-0">
        <h1 className="text-2xl font-display font-extrabold tracking-fc-tight"
            style={{ color: "var(--text-primary)" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Modal({ open, title, onClose, children, size = "md" }: {
  open: boolean; title: string; onClose: () => void;
  children: ReactNode; size?: "sm" | "md" | "lg";
}) {
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={modalOverlay}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 bg-fc-navy-900/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
        >
          <motion.div
            variants={modalContent}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`card ${widths[size]} w-full max-h-[90vh] flex flex-col`}
            style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
          >
            <div className="flex items-center justify-between px-5 py-3"
                 style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <p className="font-display font-bold" style={{ color: "var(--text-primary)" }}>{title}</p>
              <button onClick={onClose}
                className="p-1 rounded-md transition"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
