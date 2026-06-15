// src/layout/AppShell.tsx
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { pageVariants } from "@/lib/animations";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, UserCircle, Menu, X } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import Logo from "@/components/brand/Logo";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface TabItem {
  to: string;
  label: string;
  color: string;
  show: (role: string) => boolean;
}

const TAB_GROUPS: TabItem[][] = [
  // Обзор
  [
    { to: "/dashboard", label: "Дашборд", color: "#60A5FA", show: r => ["superadmin","admin","management","data_entry"].includes(r) },
  ],
  // Уровни образования
  [
    { to: "/edu/preschool",          label: "ДДО",       color: "#0D9E6E", show: () => true },
    { to: "/edu/school",             label: "Школы",     color: "#2563EB", show: () => true },
    { to: "/edu/extracurricular",    label: "Доп. обр.", color: "#DB2777", show: () => true },
    { to: "/edu/college",            label: "ТиПО",      color: "#D97706", show: () => true },
    { to: "/edu/university",         label: "ОВПО",      color: "#7C3AED", show: () => true },
  ],
  // Аналитика
  [
    { to: "/tippo/colleges", label: "Рейтинг Астаны", color: "#D97706", show: r => ["superadmin","admin","management"].includes(r) },
  ],
  // Администрирование
  [
    { to: "/admin/organisations",    label: "Организации",  color: "#60A5FA", show: r => ["superadmin","admin"].includes(r) },
    { to: "/admin/users",            label: "Пользователи", color: "#60A5FA", show: r => ["superadmin","admin"].includes(r) },
    { to: "/admin/approvals",        label: "Согласования", color: "#0068B4", show: r => ["superadmin","admin"].includes(r) },
    { to: "/admin/integrations",     label: "Интеграции",   color: "#296695", show: r => ["superadmin","admin"].includes(r) },
    { to: "/admin/universal-import", label: "Импорт",       color: "#00A6CA", show: r => ["superadmin","admin"].includes(r) },
    { to: "/admin/audit",            label: "Аудит",        color: "#5A6478", show: r => ["superadmin","admin"].includes(r) },
    { to: "/admin/api-keys",         label: "API-ключи",    color: "#801E82", show: r => r === "superadmin" },
  ],
];

function RoleBadgeInline({ role }: { role: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    superadmin: { bg: "#F3E8FF", color: "#7C3AED", label: "Суперадмин" },
    admin:      { bg: "#EEF2FF", color: "#19286D", label: "Администратор" },
    management: { bg: "#E0F2FE", color: "#0068B4", label: "Руководство" },
    data_entry: { bg: "#E8F5E9", color: "#0D9E6E", label: "Ввод данных" },
  };
  const m = map[role] ?? { bg: "#F3F4F6", color: "#5A6478", label: role };
  return (
    <span className="pill" style={{ background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md transition w-full text-left"
        style={{ color: "rgba(255,255,255,0.9)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs shrink-0"
          style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}
        >
          {user.full_name.slice(0, 2).toUpperCase()}
        </div>
        <span className="text-sm font-medium max-w-[140px] truncate" style={{ color: "#fff" }}>
          {user.full_name}
        </span>
        <ChevronDown className="w-3.5 h-3.5 ml-auto" style={{ opacity: 0.7, color: "#fff" }} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 lg:left-0 lg:right-auto top-full lg:top-auto lg:bottom-full mt-1 lg:mt-0 lg:mb-2 rounded-xl w-60 z-50 overflow-hidden"
            style={{
              background: "#ffffff",
              border: "1px solid #E5E9F2",
              boxShadow: "0 8px 32px rgba(25,40,109,0.15)",
            }}
          >
            <div className="px-4 py-3" style={{ borderBottom: "1px solid #E5E9F2", background: "#F4F6FA" }}>
              <p className="text-sm font-semibold truncate" style={{ color: "#1A2133" }}>{user.full_name}</p>
              <p className="text-xs truncate" style={{ color: "#5A6478" }}>{user.email}</p>
              <div className="mt-2">
                <RoleBadgeInline role={user.role} />
              </div>
            </div>
            <button
              onClick={() => { setOpen(false); navigate("/profile"); }}
              className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition"
              style={{ color: "#5A6478" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#F4F6FA")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <UserCircle className="w-4 h-4" /> Профиль
            </button>
            <button
              onClick={() => { setOpen(false); logout(); }}
              className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition"
              style={{ color: "#DC2626", borderTop: "1px solid #E5E9F2" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#FEF2F2")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <LogOut className="w-4 h-4" /> Выйти
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function AppShell() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const visibleGroups = TAB_GROUPS
    .map(group => group.filter(t => t.show(role)))
    .filter(group => group.length > 0);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen" style={{ background: "var(--surface-bg)" }}>

      {/* ── ЛЕВЫЙ ВЕРТИКАЛЬНЫЙ САЙДБАР (только десктоп) ───────────────── */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#19286D] text-white shrink-0 sticky top-0 h-screen border-r border-slate-800 shadow-2xl">
        {/* Брендированная шапка сайдбара */}
        <div className="p-5 border-b border-slate-800 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Logo variant="white" size={32} />
            <div className="text-sm font-black tracking-tight leading-tight">
              Система мониторинга образования
            </div>
          </div>
          <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
            АО «Финансовый центр» | 2026
          </div>
        </div>

        {/* Навигация */}
        <nav className="flex-1 p-4 space-y-4 overflow-y-auto scrollbar-thin">
          {visibleGroups.map((group, gi) => (
            <div key={gi} className="space-y-1">
              {gi > 0 && <div className="h-px bg-slate-800 my-2 opacity-50" />}
              {group.map(tab => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) => `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    isActive 
                      ? 'bg-white/15 text-white shadow-inner' 
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                  style={{ borderLeft: `3px solid ${tab.color}` }}
                >
                  {tab.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Пользовательское меню внизу сайдбара */}
        <div className="p-4 border-t border-slate-800 bg-black/10">
          <UserMenu />
        </div>
      </aside>

      {/* Правая часть (Основной контент) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* Мобильная верхняя панель */}
        <header className="lg:hidden h-14 bg-[#19286D] text-white px-4 flex items-center justify-between sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="bg-white/10 hover:bg-white/20 p-1.5 rounded-md transition"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm font-semibold truncate max-w-[180px]">
              Финансовый центр
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Logo variant="white" size={24} />
            <UserMenu />
          </div>
        </header>

        {/* Верхний статус-бар на десктопе */}
        <header className="hidden lg:flex h-14 bg-white border-b border-gray-200 px-8 items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 bg-[#19286D] rounded-full" />
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Панель управления
            </h2>
          </div>
          <div className="text-xs text-gray-400 font-medium">
            Текущая сессия: <span className="font-semibold text-gray-600">{user?.email}</span>
          </div>
        </header>

        {/* Контентная область */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 w-full max-w-[1264px] mx-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              className="w-full"
              variants={pageVariants}
              initial="initial"
              animate="enter"
              exit="exit"
            >
              <ErrorBoundary key={location.pathname}>
                <Outlet />
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ── МОБИЛЬНОЕ МЕНЮ (drawer) ───────────────────────────────── */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-[200] lg:hidden">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(25,40,109,0.5)" }}
            onClick={() => setMobileNavOpen(false)}
          />
          <div style={{
            position: "absolute",
            left: 0, top: 0, bottom: 0,
            width: "280px",
            background: "#fff",
            overflowY: "auto",
            boxShadow: "4px 0 20px rgba(25,40,109,0.15)",
          }}>
            <div style={{
              background: "#19286D",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Logo variant="white" size={24} />
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>
                  Финансовый центр
                </span>
              </div>
              <button
                onClick={() => setMobileNavOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", padding: "4px" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div style={{ padding: "8px 0" }}>
              {visibleGroups.map((group, gi) => (
                <React.Fragment key={gi}>
                  {gi > 0 && (
                    <div style={{
                      height: "1px",
                      background: "#E5E9F2",
                      margin: "6px 20px",
                    }} />
                  )}
                  {group.map(tab => (
                    <NavLink
                      key={tab.to}
                      to={tab.to}
                      onClick={() => setMobileNavOpen(false)}
                      className={({ isActive }) => `mobile-nav-item${isActive ? " active" : ""}`}
                      style={{ "--tc": tab.color } as React.CSSProperties}
                    >
                      <span style={{
                        display: "block",
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: tab.color,
                        flexShrink: 0,
                      }} />
                      {tab.label}
                    </NavLink>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
