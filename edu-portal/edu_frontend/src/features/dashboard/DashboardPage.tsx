import React from 'react';

const StatCard = ({ title, value, icon, color }: any) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-slate-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
      </div>
      <div className={`p-3 rounded-xl ${color} bg-opacity-10 text-xl`}>{icon}</div>
    </div>
  </div>
);

export default function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Панель мониторинга</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Всего ВУЗов" value="124" icon="🏛️" color="text-blue-600" />
        <StatCard title="Студентов (РК)" value="620k" icon="🎓" color="text-green-600" />
        <StatCard title="Отчетов на проверке" value="18" icon="📄" color="text-amber-600" />
        <StatCard title="Точность данных" value="98.2%" icon="🎯" color="text-purple-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm min-h-[300px]">
          <h3 className="font-bold text-slate-800 mb-4">Активность ввода данных</h3>
          <div className="flex items-center justify-center h-48 bg-slate-50 rounded-xl border border-dashed border-slate-200">
             <p className="text-slate-400 text-sm italic">График динамики подгружается из Superset...</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">Последние события</h3>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-lg transition-colors">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">ВУЗ #{i+10} отправил отчет по контингенту</p>
                  <p className="text-xs text-slate-400">14 минут назад</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

