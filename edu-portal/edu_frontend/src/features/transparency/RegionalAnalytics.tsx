// features/transparency/RegionalAnalytics.tsx
// Интерактивная карта Казахстана — кастомная Mercator-проекция, 20 регионов
import React, { useState, useEffect, useMemo } from "react";
import client from "@/api/client";
import { Loader2, MapPin, X } from "lucide-react";

// ── Уровни образования ───────────────────────────────────────────────────────
const ORG_TYPES = [
  { id: 1, code: "ДО",    label: "Дошкольное образование",              contingent: "Воспитанников" },
  { id: 2, code: "ДопО",  label: "Дополнительное образование",          contingent: "Обучающихся"   },
  { id: 3, code: "СО",    label: "Среднее образование",                 contingent: "Учащихся"      },
  { id: 4, code: "ТиППО", label: "Техническое и профессиональное",      contingent: "Обучающихся"   },
  { id: 5, code: "ВиПО",  label: "Высшее и послевузовское",             contingent: "Студентов"     },
  { id: 6, code: "Общ-е", label: "Общежития",                           contingent: "Проживающих"   },
  { id: 7, code: "ГОНС",  label: "ГОНС Келешек",                        contingent: "Контингент"    },
] as const;

const YEARS = [2025, 2024, 2023, 2022, 2021, 2020];

// ── Mapping: DB region_id → ISO3166-2 ───────────────────────────────────────
const REGION_ISO: Record<number, string> = {
  1:  "KZ-71", 2:  "KZ-75", 3:  "KZ-79",
  4:  "KZ-11", 5:  "KZ-15", 6:  "KZ-19", 7:  "KZ-23",
  8:  "KZ-27", 9:  "KZ-31", 10: "KZ-33", 11: "KZ-35",
  12: "KZ-39", 13: "KZ-43", 14: "KZ-47", 15: "KZ-55",
  16: "KZ-59", 17: "KZ-61", 18: "KZ-62", 19: "KZ-10",
  20: "KZ-63",
};
const ISO_REGION: Record<string, number> = Object.fromEntries(
  Object.entries(REGION_ISO).map(([id, iso]) => [iso, Number(id)])
);

// ── Types ────────────────────────────────────────────────────────────────────
interface RegionStat {
  total_students: number;
  budget: number;
  org_count: number;
  name_ru: string;
}
type RegionalData = Record<string, RegionStat>;
type MetricKey = "total_students" | "budget";

interface GeoFeature {
  type: string;
  properties: Record<string, string>;
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
}

// ── Mercator-проекция ─────────────────────────────────────────────────────────
const W = 800, H = 460;
const SCALE = 800, CX = 67, CY = 48, TX = W / 2, TY = H / 2;
const LN_CY = Math.log(Math.tan(Math.PI / 4 + CY * Math.PI / 360));

function project(lon: number, lat: number): [number, number] {
  const x = SCALE * (lon - CX) * Math.PI / 180 + TX;
  const y = TY - SCALE * (Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) - LN_CY);
  return [x, y];
}

function ringToD(ring: number[][]): string {
  let d = "";
  for (let i = 0; i < ring.length; i++) {
    const [x, y] = project(ring[i][0], ring[i][1]);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d + "Z";
}

function featureToD(feat: GeoFeature): string {
  const { type, coordinates } = feat.geometry;
  if (type === "Polygon") {
    return (coordinates as number[][][]).map(ringToD).join(" ");
  }
  if (type === "MultiPolygon") {
    return (coordinates as number[][][][]).flatMap(poly => poly.map(ringToD)).join(" ");
  }
  return "";
}

// ── Цвета ────────────────────────────────────────────────────────────────────
function lerpColor(ratio: number): string {
  const r = Math.round(0x29 + (0x00 - 0x29) * ratio);
  const g = Math.round(0x66 + (0xa6 - 0x66) * ratio);
  const b = Math.round(0x95 + (0xca - 0x95) * ratio);
  return `rgb(${r},${g},${b})`;
}

function regionFill(
  regionId: number | null,
  data: RegionalData | null,
  metric: MetricKey,
  max: number,
  selected: number | null,
  hovered: number | null,
): string {
  if (selected === regionId && regionId !== null) return "#00a6ca";
  if (hovered  === regionId && regionId !== null) return "#19286d";
  if (!data || regionId === null) return "#296695";
  const stat = data[String(regionId)];
  if (!stat || max === 0) return "#296695";
  const val = stat[metric];
  if (val === 0) return "#296695";
  return lerpColor(Math.min(val / max, 1));
}

// ── Форматирование ───────────────────────────────────────────────────────────
function fmtN(n: number): string { return n.toLocaleString("ru-KZ"); }
function fmtMoney(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} млрд ₸`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(0)} млн ₸`;
  if (n > 0)              return `${fmtN(Math.round(n))} ₸`;
  return "—";
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface RegionalAnalyticsProps {
  onFilterChange?: (year: number, orgTypeId: number | null, regionId: number | null) => void;
}

// ── Компонент ────────────────────────────────────────────────────────────────
export default function RegionalAnalytics({ onFilterChange }: RegionalAnalyticsProps = {}) {
  const [year, setYear]           = useState(2024);
  const [orgTypeId, setOrgTypeId] = useState<number | null>(null);
  const [metric, setMetric]       = useState<MetricKey>("total_students");
  const [data, setData]           = useState<RegionalData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [selected, setSelected]   = useState<number | null>(null);
  const [hovered, setHovered]     = useState<number | null>(null);
  const [geoFeatures, setGeoFeatures] = useState<GeoFeature[]>([]);
  const [geoError, setGeoError]   = useState(false);

  useEffect(() => {
    fetch("/geo/kazakhstan.json")
      .then(r => r.json())
      .then((fc: { features: GeoFeature[] }) => setGeoFeatures(fc.features))
      .catch(() => setGeoError(true));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ year: String(year) });
    if (orgTypeId !== null) params.set("org_type_id", String(orgTypeId));
    client
      .get<RegionalData>(`/admin/regional-stats?${params}`)
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.detail ?? "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [year, orgTypeId]);

  // Уведомляем родителя о смене фильтров
  useEffect(() => {
    onFilterChange?.(year, orgTypeId, selected);
  }, [year, orgTypeId, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const max = useMemo(() => {
    if (!data) return 1;
    return Math.max(...Object.values(data).map(s => s[metric]), 1);
  }, [data, metric]);

  const selectedStat = selected !== null ? (data?.[String(selected)] ?? null) : null;
  const toggleRegion = (id: number) => setSelected(prev => (prev === id ? null : id));

  const contingentLabel = orgTypeId
    ? (ORG_TYPES.find(t => t.id === orgTypeId)?.contingent ?? "Контингент")
    : "Контингент";

  const topRegions = useMemo(() => {
    if (!data) return [];
    return Object.entries(data)
      .filter(([, s]) => s[metric] > 0)
      .sort(([, a], [, b]) => b[metric] - a[metric])
      .slice(0, 5);
  }, [data, metric]);

  return (
    <div className="card overflow-hidden mb-5">
      {/* ── Заголовок + фильтры ── */}
      <div className="px-5 py-3 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-3">
          <p className="label-eyebrow mr-auto">Региональная аналитика</p>

          <div className="flex items-center gap-1.5">
            <span className="label-eyebrow">Год</span>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="input py-0.5 text-xs w-20">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="label-eyebrow">Уровень</span>
            <select
              value={orgTypeId ?? ""}
              onChange={e => setOrgTypeId(e.target.value === "" ? null : Number(e.target.value))}
              className="input py-0.5 text-xs w-52"
            >
              <option value="">Все уровни</option>
              {ORG_TYPES.map(t => (
                <option key={t.id} value={t.id}>{t.code} — {t.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="label-eyebrow">Метрика</span>
            <select value={metric} onChange={e => setMetric(e.target.value as MetricKey)} className="input py-0.5 text-xs w-32">
              <option value="total_students">{contingentLabel}</option>
              <option value="budget">Бюджет</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Тело ── */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-fc-steel-500">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm">Загрузка…</span>
        </div>
      )}
      {error && <div className="p-5 text-sm text-danger">{error}</div>}

      {!loading && !error && (
        <div className="flex flex-col lg:flex-row">

          {/* ── Карта ── */}
          <div className="flex-1 min-w-0 bg-slate-50 relative">
            {geoError ? (
              <div className="flex items-center justify-center py-16 text-sm text-danger">
                Не удалось загрузить карту
              </div>
            ) : geoFeatures.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-fc-steel-500">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                <span className="text-sm">Карта…</span>
              </div>
            ) : (
              <svg
                viewBox={`0 0 ${W} ${H}`}
                style={{ width: "100%", height: "auto", display: "block" }}
                aria-label="Карта Казахстана"
              >
                {geoFeatures.map((feat, idx) => {
                  const iso      = feat.properties["ISO3166-2"] ?? "";
                  const regionId = ISO_REGION[iso] ?? null;
                  const d        = featureToD(feat);
                  if (!d) return null;
                  return (
                    <path
                      key={iso || idx}
                      d={d}
                      fill={regionFill(regionId, data, metric, max, selected, hovered)}
                      stroke="#fff"
                      strokeWidth={0.6}
                      strokeLinejoin="round"
                      style={{ cursor: "pointer", transition: "fill 0.15s" }}
                      onMouseEnter={() => setHovered(regionId)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => regionId !== null && toggleRegion(regionId)}
                    />
                  );
                })}
              </svg>
            )}

            {/* Легенда */}
            {geoFeatures.length > 0 && (
              <div className="absolute bottom-3 left-4 right-4 flex items-center gap-2">
                <span className="text-[10px] text-fc-steel-400 whitespace-nowrap">Меньше</span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: "linear-gradient(to right, #296695, #00a6ca)" }} />
                <span className="text-[10px] text-fc-steel-400 whitespace-nowrap">Больше</span>
              </div>
            )}
          </div>

          {/* ── Панель статистики ── */}
          <div className="w-full lg:w-64 xl:w-72 border-t lg:border-t-0 lg:border-l border-slate-100 flex flex-col">
            {selectedStat ? (
              <div className="p-5 flex flex-col gap-3 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="label-eyebrow mb-1">Регион</p>
                    <p className="font-semibold text-fc-navy-900 text-sm leading-snug">{selectedStat.name_ru}</p>
                    {orgTypeId && (
                      <span className="pill mt-1 inline-block text-[10px]">
                        {ORG_TYPES.find(t => t.id === orgTypeId)?.code}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setSelected(null)} className="text-fc-steel-300 hover:text-fc-steel-500 transition-colors mt-0.5 shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="label-eyebrow mb-1">{contingentLabel}</p>
                    <p className="text-2xl font-semibold tabular-nums text-fc-navy-900">
                      {selectedStat.total_students > 0 ? fmtN(selectedStat.total_students) : "—"}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="label-eyebrow mb-1">Бюджет</p>
                    <p className="text-base font-semibold tabular-nums text-fc-navy-900">{fmtMoney(selectedStat.budget)}</p>
                  </div>
                  {selectedStat.total_students > 0 && selectedStat.budget > 0 && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="label-eyebrow mb-1">Бюджет на 1 чел.</p>
                      <p className="text-sm font-semibold tabular-nums text-fc-navy-900">
                        {fmtMoney(selectedStat.budget / selectedStat.total_students)}
                      </p>
                    </div>
                  )}
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="label-eyebrow mb-1">Организаций</p>
                    <p className="text-base font-semibold tabular-nums text-fc-navy-900">
                      {selectedStat.org_count > 0 ? fmtN(selectedStat.org_count) : "—"}
                    </p>
                  </div>
                </div>

                <p className="text-[10px] text-fc-steel-300 mt-auto">
                  {year} · {orgTypeId ? ORG_TYPES.find(t => t.id === orgTypeId)?.label : "Все уровни образования"}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center flex-1">
                <MapPin className="w-6 h-6 text-fc-steel-300 mb-2" />
                <p className="text-xs text-fc-steel-400 leading-relaxed">
                  Нажмите на регион для просмотра статистики
                </p>
              </div>
            )}

            {/* Топ-5 регионов */}
            {topRegions.length > 0 && (
              <div className="border-t border-slate-100">
                <div className="px-4 py-2 border-b border-slate-50">
                  <p className="label-eyebrow text-[10px]">
                    Топ по {metric === "total_students" ? contingentLabel.toLowerCase() : "бюджету"}
                  </p>
                </div>
                <ul className="divide-y divide-slate-50">
                  {topRegions.map(([id, stat], i) => (
                    <li
                      key={id}
                      className={`flex items-center gap-2 px-4 py-2 cursor-pointer transition-colors hover:bg-slate-50 ${selected === Number(id) ? "bg-sky-50" : ""}`}
                      onClick={() => toggleRegion(Number(id))}
                    >
                      <span className="text-[10px] text-fc-steel-400 w-3 shrink-0 tabular-nums">{i + 1}</span>
                      <span className="text-xs text-fc-navy-900 truncate flex-1">{stat.name_ru}</span>
                      <span className="text-[10px] tabular-nums text-fc-steel-500 shrink-0">
                        {metric === "total_students" ? fmtN(stat.total_students) : fmtMoney(stat.budget)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
