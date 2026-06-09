// src/layout/AppShell.tsx
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { pageVariants } from "@/lib/animations";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, UserCircle, Menu, X } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import Logo from "@/components/brand/Logo";

interface TabItem {
  to: string;
  label: string;
  color: string;
  show: (role: string) => boolean;
}

const TAB_GROUPS: TabItem[][] = [
  // Обзор
  [
    { to: "/dashboard", label: "Дашборд", color: "#19286D", show: r => ["superadmin","admin","management","data_entry"].includes(r) },
  ],
  // Уровни образования
  [
    { to: "/edu/preschool",          label: "ДДО",       color: "#0D9E6E", show: () => true },
    { to: "/edu/school",             label: "Школы",     color: "#2563EB", show: () => true },
    { to: "/edu/extracurricular",    label: "Доп. обр.", color: "#DB2777", show: () => true },
    { to: "/edu/college",            label: "ТиПО",      color: "#D97706", show: () => true },
    { to: "/edu/university",         label: "ОВПО",      color: "#7C3AED", show: () => true },
    { to: "/edu/special",            label: "ГОНС",      color: "#296695", show: () => true },
  ],
  // Аналитика
  [
    { to: "/transparency",           label: "Прозрачность", color: "#296695", show: r => ["superadmin","admin","management"].includes(r) },
    { to: "/anomalies",              label: "Аномалии",     color: "#DC2626", show: r => ["superadmin","admin","management"].includes(r) },
    { to: "/reports",                label: "AI-отчёты",    color: "#801E82", show: r => ["superadmin","admin","management"].includes(r) },
    { to: "/presentations",          label: "Презентации",  color: "#801E82", show: r => ["superadmin","admin","management"].includes(r) },
    { to: "/analytics/global-stats", label: "Глобальная",   color: "#0068B4", show: r => ["superadmin","admin"].includes(r) },
    { to: "/coverage",               label: "Покрытие",     color: "#0068B4", show: r => ["superadmin","admin"].includes(r) },
    { to: "/data/coefficients",      label: "Коэффициенты", color: "#296695", show: () => true },
    { to: "/catalog",                label: "Каталог",      color: "#00A6CA", show: () => true },
  ],
  // Администрирование
  [
    { to: "/admin/organisations",    label: "Организации",  color: "#19286D", show: r => ["superadmin","admin"].includes(r) },
    { to: "/admin/users",            label: "Пользователи", color: "#19286D", show: r => ["superadmin","admin"].includes(r) },
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
        className="flex items-center gap-2 px-2 py-1.5 rounded-md transition"
        style={{ color: "rgba(255,255,255,0.9)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs"
          style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}
        >
          {user.full_name.slice(0, 2).toUpperCase()}
        </div>
        <span className="hidden md:block text-sm font-medium max-w-[140px] truncate" style={{ color: "#fff" }}>
          {user.full_name}
        </span>
        <ChevronDown className="w-3.5 h-3.5" style={{ opacity: 0.7, color: "#fff" }} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 rounded-xl w-60 z-50 overflow-hidden"
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
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const visibleGroups = TAB_GROUPS
    .map(group => group.filter(t => t.show(role)))
    .filter(group => group.length > 0);

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-bg)" }}>

      {/* ── HEADER (точь в точь по референсу) ───────────────────── */}
      <header style={{
        background: "#19286D",
        color: "#fff",
        padding: "0 32px",
        height: "56px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
      }}>
        {/* Левая часть: [бургер моб.] + заголовок */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="lg:hidden">
            <button
              onClick={() => setMobileNavOpen(true)}
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "none",
                borderRadius: "6px",
                padding: "6px",
                cursor: "pointer",
                color: "#fff",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 600, lineHeight: 1.2 }}>
              Система мониторинга образования
            </div>
            <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "1px" }}>
              АО «Финансовый центр» | 2026
            </div>
          </div>
        </div>

        {/* Правая часть: logo-wrap + меню пользователя */}
        <div style={{ height: "28px", display: "flex", alignItems: "center", gap: "16px" }}>
          <Logo variant="white" size={28} />
          <UserMenu />
        </div>
      </header>

      {/* ── ГОРИЗОНТАЛЬНЫЙ НАВБАР (только десктоп) ───────────────── */}
      <nav
        ref={navRef}
        className="hidden lg:block scrollbar-thin"
        style={{
          background: "#ffffff",
          borderBottom: "2px solid #E5E9F2",
          position: "sticky",
          top: "56px",
          zIndex: 99,
          overflowX: "auto",
          overflowY: "hidden",
        }}
      >
        <div style={{ display: "flex", padding: "0 32px", gap: "2px", alignItems: "stretch" }}>
          {visibleGroups.map((group, gi) => (
            <React.Fragment key={gi}>
              {gi > 0 && (
                <div style={{
                  width: "1px",
                  background: "#E5E9F2",
                  margin: "10px 6px",
                  flexShrink: 0,
                }} />
              )}
              {group.map(tab => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) => `shell-tab${isActive ? " active" : ""}`}
                  style={{ "--tc": tab.color } as React.CSSProperties}
                >
                  {tab.label}
                </NavLink>
              ))}
            </React.Fragment>
          ))}
        </div>
      </nav>

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

      {/* ── КОНТЕНТ ───────────────────────────────────────────────── */}
      <main style={{
        maxWidth: "1264px",
        margin: "0 auto",
        padding: "28px 32px 48px",
      }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            className="w-full"
            variants={pageVariants}
            initial="initial"
            animate="enter"
            exit="exit"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
