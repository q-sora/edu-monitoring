import React from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';

export default function AppShell() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { name: '📊 Дашборд', path: '/dashboard', roles: ['admin', 'superadmin', 'management', 'data_entry'] },
    { name: '👥 Пользователи', path: '/admin/users', roles: ['admin', 'superadmin'] },
    { name: '🛡️ Аудит', path: '/admin/audit', roles: ['admin', 'superadmin'] },
    { name: '📈 Контингент', path: '/data/contingent', roles: ['data_entry', 'superadmin', 'admin'] },
    { name: '🧪 Наука', path: '/data/science', roles: ['data_entry', 'superadmin', 'admin'] },
  ];

  // Фильтруем пункты меню по ролям пользователя
  const filteredMenu = menuItems.filter(item => item.roles.includes(user?.role || ''));

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 text-white flex flex-col shadow-2xl">
        <div className="p-8 border-b border-slate-800">
          <div className="text-2xl font-black tracking-tight">
            <span className="text-blue-500">EDU</span> MONITOR
          </div>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Kazakhstan System</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 mt-4">
          {filteredMenu.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="text-lg">{item.name.split(' ')[0]}</span>
                <span className="font-medium">{item.name.split(' ')[1]}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
          >
            <span>🚪</span>
            <span className="font-medium">Выйти из системы</span>
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm">
          <div className="flex items-center gap-4">
             <div className="h-8 w-1 bg-blue-500 rounded-full"></div>
             <h2 className="text-lg font-semibold text-slate-800 capitalize">
                {location.pathname.split('/').pop()?.replace('-', ' ') || 'Обзор'}
             </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-900 leading-tight">{user?.email}</p>
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter italic">{user?.role}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-slate-100 border flex items-center justify-center text-slate-400">
               👤
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-0 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
