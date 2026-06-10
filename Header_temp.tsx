import React, { useState } from "react";
import { Menu, ChevronDown, UserCircle, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import Logo from "@/components/brand/Logo";

function RoleBadgeInline({ role }: { role: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    superadmin: { bg: "#F3E8FF", color: "#7C3AED", label: "Суперадмин" },
    admin:      { bg: "#EEF2FF", color: "#19286D", label: "Администратор" },
    management: { bg: "#E0F2FE", color: "#0068B4", label: "Руководство" },
    data_entry: { bg: "#E8F5E9", color: "#0D9E6E", label: "Ввод данных" },
  };
  const m = map[role] ?? { bg: "#F3F4F6", color: "#5A6478", label: role };
  return <span className="pill" style={{ background: m.bg, color: m.color }}>{m.label}</span>;
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 px-2 py-1.5 rounded-md transition" style={{ color: "rgba(255,255,255,0.9)" }}>
        <div className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs" style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}>
          {user.full_name.slice(0, 2).toUpperCase()}
        </div>
        <span className="hidden md:block text-sm font-medium max-w-[140px] truncate" style={{ color: "#fff" }}>{user.full_name}</span>
        <ChevronDown className="w-3.5 h-3.5" style={{ opacity: 0.7, color: "#fff" }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 rounded-xl w-60 z-50 overflow-hidden" style={{ background: "#ffffff", border: "1px solid #E5E9F2", boxShadow: "0 8px 32px rgba(25,40,109,0.15)" }}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid #E5E9F2", background: "#F4F6FA" }}>
              <p className="text-sm font-semibold truncate" style={{ color: "#1A2133" }}>{user.full_name}</p>
              <p className="text-xs truncate" style={{ color: "#5A6478" }}>{user.email}</p>
              <div className="mt-2"><RoleBadgeInline role={user.role} /></div>
            </div>
            <button onClick={() => { setOpen(false); navigate("/profile"); }} className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2" style={{ color: "#5A6478" }}><UserCircle className="w-4 h-4" /> Профиль</button>
            <button onClick={() => { setOpen(false); logout(); }} className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2" style={{ color: "#DC2626", borderTop: "1px solid #E5E9F2" }}><LogOut className="w-4 h-4" /> Выйти</button>
          </div>
        </>
      )}
    </div>
  );
}

export function Header({ setMobileNavOpen }: { setMobileNavOpen: (v: boolean) => void }) {
  return (
    <header style={{ background: "#19286D", color: "#fff", padding: "0 32px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div className="lg:hidden">
          <button onClick={() => setMobileNavOpen(true)} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "6px", padding: "6px", cursor: "pointer", color: "#fff" }}><Menu className="w-4 h-4" /></button>
        </div>
        <div>
          <div style={{ fontSize: "16px", fontWeight: 600, lineHeight: 1.2 }}>Система мониторинга образования</div>
          <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "1px" }}>АО «Финансовый центр» | 2026</div>
        </div>
      </div>
      <div style={{ height: "28px", display: "flex", alignItems: "center", gap: "16px" }}>
        <Logo variant="white" size={28} />
        <UserMenu />
      </div>
    </header>
  );
}
