// src/pages/NotFoundPage.tsx
import React from "react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface-dark)" }}>
      <div className="text-center">
        <p className="text-7xl font-display font-black tracking-fc-tight" style={{ color: "var(--text-muted)" }}>404</p>
        <p className="text-xl font-display font-bold mt-3" style={{ color: "var(--text-primary)" }}>Страница не найдена</p>
        <Link to="/" className="text-fc-blue-400 text-sm mt-4 inline-block hover:underline font-semibold">
          На главную →
        </Link>
      </div>
    </div>
  );
}
