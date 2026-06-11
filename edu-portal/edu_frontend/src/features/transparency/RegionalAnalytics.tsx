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
  if (hovered  === regionId && regionId !== null) return "#4dc8e8";
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

  // Обновляем цвета для карты, чтобы они лучше сочетались со светлым фоном и общей палитрой
  function lerpColor(ratio: number): string {
    const r = Math.round(0x87 + (0x00 - 0x87) * ratio); // От светлого сине-зеленого до акцентного синего
    const g = Math.round(0xc1 + (0xa6 - 0xc1) * ratio);
    const b = Math.round(0xd5 + (0xca - 0xd5) * ratio);
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
    if (selected === regionId && regionId !== null) return "#00a6ca"; // Выбранный регион
    if (hovered  === regionId && regionId !== null) return "#4dc8e8"; // Наведенный регион
    if (!data || regionId === null) return "#e0f2f7"; // Фоновый цвет для отсутствующих данных (светлый)
    const stat = data[String(regionId)];
    if (!stat || max === 0) return "#e0f2f7"; // Фоновый цвет
    const val = stat[metric];
    if (val === 0) return "#e0f2f7"; // Фоновый цвет для нулевых значений
    return lerpColor(Math.min(val / max, 1));
  }

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
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden mb-5 shadow-md">
      {/* ── Заголовок + фильтры ── */}
      <div className="px-5 py-3 border-b border-gray-200">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-bold text-slate-800 mr-auto text-lg">Региональная аналитика</p>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-600">Год</span>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="input py-0.5 text-xs w-20 rounded-lg">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-600">Уровень</span>
            <select
              value={orgTypeId ?? ""}
              onChange={e => setOrgTypeId(e.target.value === "" ? null : Number(e.target.value))}
              className="input py-0.5 text-xs w-52 rounded-lg"
            >
              <option value="">Все уровни</option>
              {ORG_TYPES.map(t => (
                <option key={t.id} value={t.id}>{t.code} — {t.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-600">Метрика</span>
            <select value={metric} onChange={e => setMetric(e.target.value as MetricKey)} className="input py-0.5 text-xs w-32 rounded-lg">
              <option value="total_students">{contingentLabel}</option>
              <option value="budget">Бюджет</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Тело ── */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm">Загрузка…</span>
        </div>
      )}
      {error && <div className="p-5 text-sm text-red-500">{error}</div>}

      {!loading && !error && (
        <div className="flex flex-col lg:flex-row">

          {/* ── Карта ── */}
          <div className="flex-1 min-w-0 relative bg-gray-50"> {/* Изменен фон на светлый серый */}
            {geoError ? (
              <div className="flex items-center justify-center py-16 text-sm text-red-500">
                Не удалось загрузить карту
              </div>
            ) : geoFeatures.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-gray-500">
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
                      stroke="#a3b1bf" // Более светлый серый для обводки
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
              <div className="absolute bottom-4 left-5 right-5 flex items-center gap-2 bg-white/80 backdrop-blur-sm p-2 rounded-xl border border-gray-200 shadow-sm">
                <span className="text-[10px] whitespace-nowrap text-gray-600">Меньше</span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: "linear-gradient(to right, #e0f2f7, #00a6ca)" }} /> {/* Обновленный градиент */}
                <span className="text-[10px] whitespace-nowrap text-gray-600">Больше</span>
              </div>
            )}
          </div>

          {/* ── Панель статистики ── */}
          <div className="w-full lg:w-64 xl:w-72 flex flex-col border-t lg:border-t-0 lg:border-l border-gray-200 bg-white">
            {selectedStat ? (
              <div className="p-5 flex flex-col gap-3 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-1">Регион</p>
                    <p className="font-semibold text-lg leading-snug text-slate-800">{selectedStat.name_ru}</p>
                    {orgTypeId && (
                      <span className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full text-xs font-semibold mt-2 inline-block">
                        {ORG_TYPES.find(t => t.id === orgTypeId)?.code}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setSelected(null)} className="mt-0.5 shrink-0 text-gray-400 hover:text-gray-600 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {[
                    { label: contingentLabel, value: selectedStat.total_students > 0 ? fmtN(selectedStat.total_students) : "—", big: true },
                    { label: "Бюджет", value: fmtMoney(selectedStat.budget), big: false },
                    ...(selectedStat.total_students > 0 && selectedStat.budget > 0
                      ? [{ label: "Бюджет на 1 чел.", value: fmtMoney(selectedStat.budget / selectedStat.total_students), big: false }]
                      : []),
                    { label: "Организаций", value: selectedStat.org_count > 0 ? fmtN(selectedStat.org_count) : "—", big: false },
                  ].map(item => (
                    <div key={item.label} className="rounded-2xl p-4 border border-gray-200 bg-gray-50"> {/* Обновлен стиль карточки статистики */}
                      <p className="text-xs font-semibold text-gray-600 mb-1">{item.label}</p>
                      <p className={`${item.big ? "text-2xl" : "text-base"} font-bold tabular-nums text-slate-800`}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="text-xs mt-auto text-gray-500">
                  {year} · {orgTypeId ? ORG_TYPES.find(t => t.id === orgTypeId)?.label : "Все уровни образования"}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center flex-1 text-gray-500">
                <MapPin className="w-6 h-6 mb-2 text-gray-400" />
                <p className="text-sm leading-relaxed">
                  Нажмите на регион для просмотра статистики
                </p>
              </div>
            )}

            {/* Топ-5 регионов */}
            {topRegions.length > 0 && (
              <div className="border-t border-gray-200">
                <div className="px-5 py-3 border-b border-gray-200">
                  <p className="text-xs font-semibold text-gray-600">
                    Топ по {metric === "total_students" ? contingentLabel.toLowerCase() : "бюджету"}
                  </p>
                </div>
                <ul>
                  {topRegions.map(([id, stat], i) => (
                    <li
                      key={id}
                      className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors ${
                        selected === Number(id) ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                      onClick={() => toggleRegion(Number(id))}
                      onMouseEnter={() => setHovered(Number(id))}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <span className="text-xs w-4 shrink-0 tabular-nums font-bold text-gray-600">{i + 1}</span>
                      <span className="text-sm truncate flex-1 text-gray-800">{stat.name_ru}</span>
                      <span className="text-sm tabular-nums shrink-0 font-bold text-gray-700">
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
