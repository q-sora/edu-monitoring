// src/hooks/useApi.ts
// Shared async data-fetching hooks used across all portal pages.
import { useCallback, useEffect, useState } from "react";
import client from "@/api/client";

export function useApi<T = unknown>(url: string | null, deps: unknown[] = []) {
  const [data,    setData]    = useState<T | null>(null);
  const [loading, setLoading] = useState(url !== null);
  const [error,   setError]   = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await client.get<T>(url);
      setData(resp.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
}

export async function mutate<T = unknown>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  url: string,
  body?: unknown,
): Promise<T> {
  const resp = await client.request<T>({ method, url, data: body });
  return resp.data;
}

export interface Region { id: number; name_ru: string; code: string; type: string; }

export interface EduLevelStats {
  period_year: number;
  edu_level: string;
  summary: {
    org_count: number;
    avg_score: number;
    zones: { green: number; yellow: number; red: number };
  };
  blocks: Array<{ id: string; title: string; weight: number; avg_score: number; avg_pct: number }>;
  orgs: Array<{ id: number; name: string; total_score: number; zone: string }>;
}

export function useRegions() {
  const [regions, setRegions] = useState<Region[]>([]);
  useEffect(() => {
    client.get<Region[]>("/admin/references/regions")
      .then(r => setRegions(r.data))
      .catch(() => {});
  }, []);
  return regions;
}
