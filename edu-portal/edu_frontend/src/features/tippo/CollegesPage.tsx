// src/features/tippo/CollegesPage.tsx
import React from "react";
import { useAuth } from "@/auth/AuthContext";
import CollegeAssessmentPageComponent from "@/features/tippo/CollegeAssessmentPage";

export function CollegesPage() {
  const { user } = useAuth();
  return (
    <div className="p-6">
      <CollegeAssessmentPageComponent userRole={user?.role} />
    </div>
  );
}
