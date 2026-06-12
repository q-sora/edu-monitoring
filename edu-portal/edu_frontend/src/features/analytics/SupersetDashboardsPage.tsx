// src/features/analytics/SupersetDashboardsPage.tsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, GraduationCap, Wallet, FlaskConical, UsersRound, BookOpen } from "lucide-react";
import { staggerContainer, staggerItem, fadeInUp } from "@/lib/animations";
import { useApi } from "@/hooks/useApi";
import { Loader, ErrorBox } from "@/components/ui";
import SupersetDashboard from "@/features/analytics/SupersetDashboard";
import { PageHeader } from "@/components/ui";

interface SupersetDash {
  id: number;
  title: string;
  description: string;
  embedded_uuid: string;
}

const BI_DASHBOARDS = [
  { id: 2, uuid: "a1b2c3d4-0001-4aaa-b001-100000000001", label: "Контингент",  icon: GraduationCap, color: "#8ca0c8" },
  { id: 3, uuid: "a1b2c3d4-0002-4aaa-b002-100000000002", label: "Финансы",     icon: Wallet,        color: "#4da8d8" },
  { id: 4, uuid: "a1b2c3d4-0003-4aaa-b003-100000000003", label: "Наука",       icon: FlaskConical,  color: "#00a6ca" },
  { id: 5, uuid: "a1b2c3d4-0004-4aaa-b004-100000000004", label: "Выпускники",  icon: UsersRound,    color: "#5b9ad6" },
  { id: 6, uuid: "a1b2c3d4-0005-4aaa-b005-100000000005", label: "Образование", icon: BookOpen,      color: "#c248c4" },
] as const;

function EmbeddedDashboard({ dash }: { dash: SupersetDash }) {
  return (
    <SupersetDashboard
      dashboardId={dash.id}
      embeddedUuid={dash.embedded_uuid}
    />
  );
}

export function SupersetSection() {
  const [activeDash, setActiveDash] = useState<SupersetDash | null>(null);
  const { data: dashResp, loading, error } = useApi<{ result: SupersetDash[] }>("/admin/superset/dashboards");
  const dashboards = dashResp?.result ?? [];

  if (activeDash) {
    return (
      <div className="card overflow-hidden" style={{ height: "calc(100vh - 180px)" }}>
        <div className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <button className="btn-ghost py-1" onClick={() => setActiveDash(null)}>
            ← Назад
          </button>
          <p className="label-eyebrow">{activeDash.title}</p>
        </div>
        <EmbeddedDashboard dash={activeDash} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="label-eyebrow">Дашборды Superset</p>
        <a href="/bi/superset/welcome" target="_blank" rel="noopener noreferrer"
           className="text-xs font-semibold text-fc-blue-400 hover:underline">
          Полный интерфейс →
        </a>
      </div>
      {loading && <Loader />}
      {error && <ErrorBox message={error} />}
      {!loading && !error && dashboards.length === 0 && (
        <div className="card p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Дашборды Superset не настроены
        </div>
      )}
      {dashboards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map(d => (
            <div key={d.id} className="card card-hover p-5 cursor-pointer"
                 onClick={() => setActiveDash(d)}>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg shrink-0" style={{ background: "rgba(0,168,202,0.15)" }}>
                  <BarChart3 className="w-5 h-5 text-fc-cyan-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-display font-bold text-sm leading-snug" style={{ color: "var(--text-primary)" }}>
                    {d.title}
                  </p>
                  {d.description && (
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{d.description}</p>
                  )}
                </div>
              </div>
              <button className="btn-primary mt-4 w-full text-sm">Открыть дашборд</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SupersetDashboardsPage() {
  const [activeDash, setActiveDash] = useState<SupersetDash | null>(null);
  const { data: dashResp, loading, error } = useApi<{ result: SupersetDash[] }>("/admin/superset/dashboards");
  const dashboards = dashResp?.result ?? [];

  return (
    <>
      <PageHeader
        title="Дашборды"
        subtitle="Интерактивная аналитика на основе Apache Superset"
        actions={
          activeDash !== null ? (
            <button className="btn-ghost" onClick={() => setActiveDash(null)}>
              ← Назад к списку
            </button>
          ) : undefined
        }
      />

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      <AnimatePresence mode="wait">
        {activeDash === null ? (
          <motion.div
            key="list"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <motion.div key={i} variants={staggerItem}
                    className="card p-5 space-y-3 animate-pulse">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg shrink-0" style={{ background: "rgba(0,168,202,0.1)" }} />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-40 rounded" style={{ background: "rgba(255,255,255,0.08)" }} />
                        <div className="h-2.5 w-full rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
                        <div className="h-2.5 w-3/4 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
                      </div>
                    </div>
                    <div className="h-8 rounded-md" style={{ background: "rgba(255,255,255,0.06)" }} />
                  </motion.div>
                ))
              : dashboards.map(d => (
                  <motion.div
                    key={d.id}
                    variants={staggerItem}
                    className="card card-hover p-5 cursor-pointer"
                    onClick={() => setActiveDash(d)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg shrink-0" style={{ background: "rgba(0,168,202,0.12)" }}>
                        <BarChart3 className="w-5 h-5 text-fc-cyan-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-display font-bold text-sm leading-snug" style={{ color: "var(--text-primary)" }}>
                          {d.title}
                        </p>
                        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{d.description}</p>
                      </div>
                    </div>
                    <button className="btn-primary mt-4 w-full text-sm">
                      Открыть дашборд
                    </button>
                  </motion.div>
                ))
            }
            <motion.div
              variants={staggerItem}
              className="card p-5 border-dashed border-2 flex flex-col
                         items-center justify-center gap-2 text-center min-h-[140px]"
              style={{ borderColor: "var(--border-active)" }}
            >
              <BarChart3 className="w-8 h-8" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                Superset — полный интерфейс
              </p>
              <a href="/bi/superset/welcome"
                 target="_blank" rel="noopener noreferrer"
                 className="btn-secondary text-xs mt-1">
                Открыть Superset →
              </a>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="embed"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="card overflow-hidden"
            style={{ height: "calc(100vh - 180px)" }}
          >
            <EmbeddedDashboard dash={activeDash} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}