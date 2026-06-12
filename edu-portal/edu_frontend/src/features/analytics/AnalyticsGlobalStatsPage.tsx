// src/features/analytics/AnalyticsGlobalStatsPage.tsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, GraduationCap, Wallet, FlaskConical, UsersRound, BookOpen } from "lucide-react";
import { fadeInUp } from "@/lib/animations";
import SupersetDashboard from "@/features/analytics/SupersetDashboard";
import { PageHeader } from "@/components/ui";

const BI_DASHBOARDS = [
  { id: 2, uuid: "a1b2c3d4-0001-4aaa-b001-100000000001", label: "Контингент",  icon: GraduationCap, color: "#8ca0c8" },
  { id: 3, uuid: "a1b2c3d4-0002-4aaa-b002-100000000002", label: "Финансы",     icon: Wallet,        color: "#4da8d8" },
  { id: 4, uuid: "a1b2c3d4-0003-4aaa-b003-100000000003", label: "Наука",       icon: FlaskConical,  color: "#00a6ca" },
  { id: 5, uuid: "a1b2c3d4-0004-4aaa-b004-100000000004", label: "Выпускники",  icon: UsersRound,    color: "#5b9ad6" },
  { id: 6, uuid: "a1b2c3d4-0005-4aaa-b005-100000000005", label: "Образование", icon: BookOpen,      color: "#c248c4" },
] as const;

export function AnalyticsGlobalStatsPage() {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = BI_DASHBOARDS[activeIdx];

  return (
    <>
      <PageHeader
        title="Аналитика BI"
        subtitle="Интерактивные дашборды системы мониторинга образования"
        actions={
          <a href="/bi/superset/welcome" target="_blank" rel="noopener noreferrer"
             className="btn-ghost text-xs flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" /> Полный Superset
          </a>
        }
      />

      {/* Domain tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-lg overflow-x-auto shrink-0" style={{ background: "var(--surface-mid)" }}>
        {BI_DASHBOARDS.map((d, i) => {
          const Icon = d.icon;
          const isActive = i === activeIdx;
          return (
            <button
              key={d.id}
              onClick={() => setActiveIdx(i)}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all"
              style={isActive
                ? { color: "var(--text-primary)" }
                : { color: "var(--text-muted)" }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = "var(--text-secondary)"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              {isActive && (
                <motion.div
                  layoutId="bi-tab-active"
                  className="absolute inset-0 rounded-md"
                  style={{ zIndex: 0, background: "var(--surface-card)", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <Icon className="relative z-10 w-3.5 h-3.5" />
              <span className="relative z-10">{d.label}</span>
            </button>
          );
        })}
      </div>

      {/* Embedded dashboard */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active.id}
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          className="card overflow-hidden"
          style={{ height: "calc(100vh - 230px)" }}
        >
          <SupersetDashboard
            dashboardId={active.id}
            embeddedUuid={active.uuid}
          />
        </motion.div>
      </AnimatePresence>
    </>
  );
}