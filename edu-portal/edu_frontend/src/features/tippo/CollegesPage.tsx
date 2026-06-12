// src/features/tippo/CollegesPage.tsx
import React from "react";
import { useAuth } from "@/auth/AuthContext";
import CollegeAssessmentPageComponent from "@/features/tippo/CollegeAssessmentPage";

export function CollegesPage() {
  const { user } = useAuth();
  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold" style={{ color: "var(--text-primary)" }}>Оценка эффективности колледжей</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Рейтинг ТиППО по методике АО «Финансовый центр»</p>
      </div>
      <CollegeAssessmentPageComponent userRole={user?.role} />
    </div>
  );
}
