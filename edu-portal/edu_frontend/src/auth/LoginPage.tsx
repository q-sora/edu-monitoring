// src/auth/LoginPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Страница входа в систему — фирменный стиль АО «Финансовый центр».
//
// Структура: split-layout
//   ┌──────────────────┬─────────────────────┐
//   │ Левая панель     │  Форма входа        │
//   │ (navy + pattern) │  (white)            │
//   │ + лого           │  + email/password   │
//   │ + ценности       │  + кнопка           │
//   └──────────────────┴─────────────────────┘
//
// На мобильных — только правая панель, лого мини-версия наверху.
//
// Тон коммуникации (по брендбуку):
//   "язык расчёта, моделей и решений; без декларативных лозунгов;
//    акцент на управляемость, сопоставимость и результат"
// ─────────────────────────────────────────────────────────────────────────────

import { FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import Logo, { LogoWithText } from "@/components/brand/Logo";

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Already logged in → bounce to where the user wanted to go
  if (!isLoading && isAuthenticated) {
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const err = await login(email, password);
      if (err) setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">

      {/* ═══════════════════════════════════════════════════════════════════
          LEFT PANEL — brand identity, dark navy with pattern
          ═══════════════════════════════════════════════════════════════════ */}
      <aside className="hidden lg:flex lg:w-[44%] xl:w-[40%] flex-col justify-between
                        bg-fc-gradient bg-fc-pattern relative overflow-hidden">

        {/* Top: logo + product name */}
        <div className="relative z-10 p-10">
          <LogoWithText variant="white" lang="ru" />

          <div className="mt-12">
            <p className="label-eyebrow text-white/60">Платформа</p>
            <h1 className="mt-2 font-display font-extrabold text-4xl xl:text-5xl text-white tracking-fc-tight leading-[1.05]">
              ЕДУ
              <br />
              Мониторинг
            </h1>
            <p className="mt-4 text-sm text-white/70 max-w-sm leading-relaxed">
              Система мониторинга образования и финансирования
              государственных программ. Прозрачные данные,
              сопоставимые параметры, управляемые результаты.
            </p>
          </div>
        </div>

        {/* Bottom: brand values from brandbook */}
        <div className="relative z-10 p-10 pt-0">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 max-w-md border-t border-white/15 pt-6">
            {[
              "Системность",
              "Прозрачность",
              "Ответственность",
              "Профессиональная глубина",
              "Устойчивость",
            ].map(value => (
              <div key={value} className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-fc-cyan-400 shrink-0" />
                <span className="text-xs font-medium text-white/80">{value}</span>
              </div>
            ))}
          </div>

          <p className="mt-6 text-[10px] text-white/40 uppercase tracking-fc-eyebrow">
            © 2026 АО «Финансовый центр»
          </p>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════════════
          RIGHT PANEL — login form
          ═══════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col">

        {/* Mobile-only top bar with brand */}
        <div className="lg:hidden bg-fc-navy-700 px-5 py-4 flex items-center gap-2.5">
          <Logo variant="white" className="w-7 h-7" />
          <div>
            <p className="font-display font-extrabold text-sm text-white uppercase tracking-fc-tight leading-none">
              Финансовый центр
            </p>
            <p className="text-[9px] text-white/60 uppercase tracking-fc-eyebrow mt-0.5">
              ЕДУ Мониторинг
            </p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
          <div className="w-full max-w-sm">

            <div className="mb-8">
              <p className="label-eyebrow">Вход в систему</p>
              <h2 className="mt-2 font-display font-extrabold text-3xl text-fc-navy-900 tracking-fc-tight">
                Авторизация
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Используйте корпоративные учётные данные
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="label-eyebrow block mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@university.kz"
                  className="input"
                />
              </div>

              <div>
                <label className="label-eyebrow block mb-1.5">Пароль</label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                    tabIndex={-1}
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !email || !password}
                className="btn-primary w-full btn-lg"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Проверка…
                  </>
                ) : (
                  "Войти"
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Платформа предназначена для уполномоченных пользователей.
                Действия фиксируются в журнале аудита системы.
                По вопросам доступа обращайтесь к администратору организации.
              </p>
            </div>
          </div>
        </div>

        <footer className="border-t border-slate-100 px-6 py-3 flex items-center justify-between">
          <p className="text-[10px] text-slate-400">
            v1.0 · {new Date().getFullYear()}
          </p>
          <p className="text-[10px] text-slate-400 hidden sm:block">
            АО «Финансовый центр» · Astana, Kazakhstan
          </p>
        </footer>
      </main>
    </div>
  );
}
