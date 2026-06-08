// src/features/analytics/SupersetDashboard.tsx
// Standalone Superset embedded dashboard with branded skeleton loader and framer-motion.
// Uses the backend proxy at /admin/superset/guest-token/{dashboardId}.
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { embedDashboard } from "@superset-ui/embedded-sdk";
import { AlertTriangle, RefreshCw } from "lucide-react";
import client from "@/api/client";
import { fadeInUp } from "@/lib/animations";

// ── Props ────────────────────────────────────────────────────────────────────

interface SupersetDashboardProps {
  dashboardId:   number;   // integer ID used by our backend proxy
  embeddedUuid:  string;   // UUID passed to Superset SDK
  hideTitle?:    boolean;
  hideFilters?:  boolean;
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-5 animate-pulse overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-52 bg-fc-navy-100 rounded" />
        <div className="h-4 w-20 bg-slate-100 rounded" />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4 space-y-2.5 overflow-hidden relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-fc-navy-100 rounded" />
            <div className="h-2.5 w-16 bg-fc-steel-100 rounded" />
            <div className="h-8 w-20 bg-fc-navy-100 rounded" />
            <div className="h-2 w-14 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-3 w-32 bg-fc-steel-100 rounded" />
              <div className="h-3 w-10 bg-slate-100 rounded" />
            </div>
            <div className="h-52 bg-gradient-to-b from-fc-navy-50 to-slate-50 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="h-2.5 w-40 bg-fc-steel-100 rounded" />
        </div>
        <div className="p-4 space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4 items-center">
              <div className="h-2.5 flex-1 bg-slate-100 rounded" style={{ opacity: 1 - i * 0.12 }} />
              <div className="h-2.5 w-16 bg-fc-navy-50 rounded" />
              <div className="h-2.5 w-12 bg-slate-100 rounded" />
              <div className="h-2.5 w-10 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SupersetDashboard({
  dashboardId,
  embeddedUuid,
  hideTitle   = true,
  hideFilters = false,
}: SupersetDashboardProps) {
  const mountRef  = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [retries, setRetries] = useState(0);

  useEffect(() => {
    if (!mountRef.current) return;
    const el = mountRef.current;
    let cancelled = false;

    setLoading(true);
    setError(null);

    const fetchToken = async () => {
      const resp = await client.get<{ token: string }>(
        `/admin/superset/guest-token/${dashboardId}`
      );
      return resp.data.token;
    };

    embedDashboard({
      id: embeddedUuid,
      supersetDomain: window.location.origin,
      mountPoint: el,
      fetchGuestToken: fetchToken,
      dashboardUiConfig: {
        hideTitle,
        hideChartControls: false,
        filters: { expanded: !hideFilters },
      },
    })
      .then(()            => { if (!cancelled) setLoading(false); })
      .catch((e: Error)   => { if (!cancelled) { setError(e.message); setLoading(false); } });

    return () => { cancelled = true; el.innerHTML = ""; };
  }, [dashboardId, embeddedUuid, hideTitle, hideFilters, retries]);

  return (
    <div className="relative w-full h-full min-h-[560px]">

      {/* Skeleton — fades out when dashboard is ready */}
      <AnimatePresence>
        {loading && !error && (
          <motion.div
            key="skeleton"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } }}
            className="absolute inset-0 z-10 bg-white overflow-auto"
          >
            <DashboardSkeleton />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-white">
          <div className="card p-6 text-center max-w-sm shadow-fc-lg border border-danger/10">
            <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-danger" />
            </div>
            <p className="font-display font-bold text-fc-navy-900 mb-1">Не удалось загрузить дашборд</p>
            <p className="text-xs text-fc-steel-500 mb-4 leading-relaxed">{error}</p>
            <button
              onClick={() => setRetries(r => r + 1)}
              className="btn-secondary flex items-center gap-1.5 mx-auto text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Повторить
            </button>
          </div>
        </div>
      )}

      {/* Dashboard frame — fades in after skeleton exits */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate={loading ? "hidden" : "visible"}
        className="w-full h-full"
      >
        <div ref={mountRef} className="superset-embed" />
      </motion.div>
    </div>
  );
}
