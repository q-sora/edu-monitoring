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
  const s1 = { background: "rgba(255,255,255,0.08)" };
  const s2 = { background: "rgba(255,255,255,0.05)" };
  const s3 = { background: "rgba(255,255,255,0.03)" };
  return (
    <div className="p-6 space-y-5 animate-pulse overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-52 rounded" style={s1} />
        <div className="h-4 w-20 rounded" style={s2} />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4 space-y-2.5 overflow-hidden relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded" style={{ background: "rgba(0,168,202,0.3)" }} />
            <div className="h-2.5 w-16 rounded" style={s2} />
            <div className="h-8 w-20 rounded" style={s1} />
            <div className="h-2 w-14 rounded" style={s2} />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-3 w-32 rounded" style={s2} />
              <div className="h-3 w-10 rounded" style={s3} />
            </div>
            <div className="h-52 rounded-lg" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.06), rgba(255,255,255,0.02))" }} />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="h-2.5 w-40 rounded" style={s2} />
        </div>
        <div className="p-4 space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4 items-center">
              <div className="h-2.5 flex-1 rounded" style={{ ...s2, opacity: 1 - i * 0.12 }} />
              <div className="h-2.5 w-16 rounded" style={s3} />
              <div className="h-2.5 w-12 rounded" style={s2} />
              <div className="h-2.5 w-10 rounded" style={s2} />
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
            className="absolute inset-0 z-10 overflow-auto"
            style={{ background: "var(--surface-dark)" }}
          >
            <DashboardSkeleton />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: "var(--surface-dark)" }}>
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
