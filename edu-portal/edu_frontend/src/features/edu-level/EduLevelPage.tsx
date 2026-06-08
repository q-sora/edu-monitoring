
import React, { useState, useMemo, useEffect } from "react";
import { 
  Building, GraduationCap, Users, Wallet, BarChart3, LineChart as LineChartIcon,
  Search, X, ChevronDown, Activity, TrendingUp, Info
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  LineChart, Line, Legend, AreaChart, Area
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { useApi, useRegions } from "@/hooks/useApi";
import { useAuth } from "@/auth/AuthContext";
import { 
  PageHeader, Loader, ErrorBox, StatCard, SkeletonGrid, EmptyState 
} from "@/components/ui";
import { LEVEL_CONFIG, EduLevel } from "./levelConfig";

// Forms
import ContingentForm from "@/features/contingent/ContingentForm";
import FinanceForm from "@/features/finance/FinanceForm";
import ScienceForm from "@/features/science/ScienceForm";
import GraduatesForm from "@/features/graduates/GraduatesForm";
import EducationForm from "@/features/education/EducationForm";

const TAB_COMPONENTS: Record<string, any> = {
  contingent: ContingentForm,
  finance:    FinanceForm,
  science:    ScienceForm,
  graduates:  GraduatesForm,
  education:  EducationForm,
};

const TAB_LABELS: Record<string, string> = {
  contingent: "Контингент",
  finance:    "Финансы",
  science:    "Наука",
  graduates:  "Выпускники",
  education:  "Образ. процесс",
};

interface Organisation {
  id: string;
  name_ru: string;
  org_type_id: number;
  region_id: number;
}

interface OrgType {
  id: number;
  code: string;
  name_ru: string;
}

export default function EduLevelPage({ level }: { level: EduLevel }) {
  const config = LEVEL_CONFIG[level];
  const { user } = useAuth();
  const regions = useRegions();
  
  // Persist selectedOrgId in localStorage
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(() => {
    // If user is data_entry, they are locked to their org
    if (user?.role === "data_entry" && user.org_id) return user.org_id;
    return localStorage.getItem(`selectedOrg_${level}`);
  });

  const [activeTab, setActiveTab] = useState(config.tabs[0]);

  // Sync with localStorage
  useEffect(() => {
    if (selectedOrgId && user?.role !== "data_entry") {
      localStorage.setItem(`selectedOrg_${level}`, selectedOrgId);
    }
  }, [selectedOrgId, level, user?.role]);

  // API calls
  const { data: orgTypes } = useApi<OrgType[]>("/admin/references/org-types");
  const { data: allOrgs, loading: loadingOrgs } = useApi<Organisation[]>("/admin/organisations");

  // Mapping org_type_id -> code (slug)
  const orgTypeSlugById = useMemo(() => {
    const map: Record<number, string> = {};
    orgTypes?.forEach(t => { map[t.id] = t.code; });
    return map;
  }, [orgTypes]);

  // Filter orgs for this level
  const levelOrgs = useMemo(() => {
    if (!allOrgs || !orgTypes) return [];
    return allOrgs.filter(org => 
      config.orgTypeSlugs.includes(orgTypeSlugById[org.org_type_id])
    );
  }, [allOrgs, orgTypeSlugById, config.orgTypeSlugs]);

  const selectedOrg = useMemo(() => 
    levelOrgs.find(o => o.id === selectedOrgId), 
    [levelOrgs, selectedOrgId]
  );

  // Data for charts and KPIs
  const { data: contingentRecords, loading: loadingC } = useApi<any[]>(
    selectedOrgId ? `/organisations/${selectedOrgId}/contingent` : null
  );
  const { data: financeRecords, loading: loadingF } = useApi<any[]>(
    selectedOrgId ? `/organisations/${selectedOrgId}/finance` : null
  );

  // KPI Calculations
  const kpis = useMemo(() => {
    if (!contingentRecords || contingentRecords.length === 0) return null;
    
    // Last record (sorted by period_year descending usually, or we sort here)
    const lastC = [...contingentRecords].sort((a, b) => b.period_year - a.period_year)[0];
    const lastF = financeRecords && financeRecords.length > 0 
      ? [...financeRecords].sort((a, b) => b.period_year - a.period_year)[0]
      : null;

    return {
      total_students: lastC.total_count || 0,
      new_enrolled: lastC.new_enrolled || 0,
      budget: lastF?.total_income || 0,
      payroll_pct: lastF?.payroll_pct || 0,
    };
  }, [contingentRecords, financeRecords]);

  // Chart Data
  const chartData = useMemo(() => {
    if (!contingentRecords) return [];
    
    // Combine contingent and finance by year
    const years = Array.from(new Set([
      ...contingentRecords.map(r => r.period_year),
      ...(financeRecords?.map(r => r.period_year) || [])
    ])).sort();

    return years.map(year => {
      const c = contingentRecords.find(r => r.period_year === year);
      const f = financeRecords?.find(r => r.period_year === year);
      return {
        year,
        students: c?.total_count || 0,
        budget: f?.total_income ? f.total_income / 1_000_000 : 0, // in millions
      };
    });
  }, [contingentRecords, financeRecords]);

  const ActiveForm = TAB_COMPONENTS[activeTab];

  return (
    <>
      <PageHeader 
        title={config.label}
        subtitle={`Управление и мониторинг: ${selectedOrg?.name_ru || "выберите организацию"}`}
      />

      {/* ЗОНА A: OrgSelector */}
      <div className="card p-4 mb-6 flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1 w-full">
          <label className="label-eyebrow mb-1.5 block">Организация</label>
          {user?.role === "data_entry" ? (
            <div className="input bg-slate-50 flex items-center gap-2 font-semibold">
              <Building className="w-4 h-4 text-fc-navy-400" />
              {selectedOrg?.name_ru || "Организация не привязана"}
            </div>
          ) : (
            <select 
              className="input pr-10"
              value={selectedOrgId || ""}
              onChange={(e) => setSelectedOrgId(e.target.value || null)}
            >
              <option value="">Выберите из списка ({levelOrgs.length})</option>
              {levelOrgs.map(org => (
                <option key={org.id} value={org.id}>{org.name_ru}</option>
              ))}
            </select>
          )}
        </div>
        
        {selectedOrg && (
          <div className="flex gap-4 shrink-0">
            <div>
              <p className="label-eyebrow mb-1">Регион</p>
              <p className="text-sm font-bold text-fc-navy-800">
                {regions.find(r => r.id === selectedOrg.region_id)?.name_ru || "—"}
              </p>
            </div>
            <div>
              <p className="label-eyebrow mb-1">ID</p>
              <p className="text-[10px] font-mono text-fc-steel-500">{selectedOrgId?.slice(0, 8)}...</p>
            </div>
          </div>
        )}
      </div>

      {!selectedOrgId ? (
        <EmptyState 
          title="Организация не выбрана" 
          hint="Используйте селектор выше, чтобы просмотреть показатели и формы ввода"
          icon={Building}
        />
      ) : (
        <>
          {/* ЗОНА B: KPI-карточки */}
          {(loadingC || loadingF) ? (
            <SkeletonGrid count={4} />
          ) : kpis ? (
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6"
              initial="hidden" animate="visible"
            >
              <StatCard 
                accent="navy" icon={GraduationCap} 
                label="Всего студентов" 
                value={kpis.total_students.toLocaleString("ru-RU")} 
                hint="Текущий контингент"
              />
              <StatCard 
                accent="blue" icon={TrendingUp} 
                label="Новый прием" 
                value={kpis.new_enrolled.toLocaleString("ru-RU")} 
                hint="В этом учебном году"
              />
              <StatCard 
                accent="cyan" icon={Wallet} 
                label="Бюджет" 
                value={kpis.budget > 1_000_000_000 
                  ? `${(kpis.budget / 1_000_000_000).toFixed(1)} млрд` 
                  : `${(kpis.budget / 1_000_000).toFixed(0)} млн`} 
                hint="Общий доход (₸)"
              />
              <StatCard 
                accent="steel" icon={Activity} 
                label="ФОТ" 
                value={`${kpis.payroll_pct}%`} 
                hint="Доля зарплат в бюджете"
              />
            </motion.div>
          ) : (
            <div className="card p-6 mb-6 text-center text-sm text-fc-steel-500">
              По данной организации еще не подано ни одной записи.
            </div>
          )}

          {/* ЗОНА C: Графики */}
          {chartData.length > 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <div className="card p-5">
                <p className="label-eyebrow mb-4 flex items-center gap-2">
                  <LineChartIcon className="w-3.5 h-3.5" /> Динамика контингента
                </p>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0068b4" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#0068b4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                    <Tooltip 
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                    />
                    <Area type="monotone" dataKey="students" stroke="#0068b4" fillOpacity={1} fill="url(#colorStudents)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="card p-5">
                <p className="label-eyebrow mb-4 flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5" /> Бюджет (млн ₸)
                </p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                    <Tooltip 
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                    />
                    <Bar dataKey="budget" fill="#19286d" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ЗОНА D: Табы ввода данных */}
          <div className="mt-8">
            <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-md overflow-x-auto scrollbar-thin">
              {config.tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${
                    activeTab === tab 
                      ? "bg-white text-fc-navy-900 shadow-fc-sm" 
                      : "text-fc-steel-500 hover:text-fc-navy-700 hover:bg-white/50"
                  }`}
                >
                  {TAB_LABELS[tab] || tab}
                </button>
              ))}
            </div>

            <div className="mt-4 bg-white rounded-xl shadow-fc-sm border border-slate-100 p-6">
              <ActiveForm 
                orgId={selectedOrgId} 
                readOnly={user?.role === "management"} 
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
