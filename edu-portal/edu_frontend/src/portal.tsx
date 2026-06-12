// src/portal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Re-export file — all components have been moved to their own feature files.
// This file exists for backwards compatibility only.
// ─────────────────────────────────────────────────────────────────────────────

export { AppShell }           from "@/layout/AppShell";
export { DashboardPage }      from "@/features/dashboard/DashboardPage";
export { TransparencyPage }   from "@/features/transparency/TransparencyPage";
export { CoveragePage }       from "@/features/coverage/CoveragePage";
export { UsersPage }          from "@/features/admin/UsersPage";
export { OrganisationsPage }  from "@/features/admin/OrganisationsPage";
export { ApprovalsPage }      from "@/features/admin/ApprovalsPage";
export { AuditLogPage }       from "@/features/admin/AuditLogPage";
export { IntegrationsPage }   from "@/features/admin/IntegrationsPage";
export { ApiKeysPage }        from "@/features/admin/ApiKeysPage";
export { ContingentPage, FinancePage, SciencePage, GraduatesPage, EducationPage, HistoryPage } from "@/features/data-entry/DataPages";
export { SupersetDashboardsPage, SupersetSection } from "@/features/analytics/SupersetDashboardsPage";
export { AnalyticsGlobalStatsPage } from "@/features/analytics/AnalyticsGlobalStatsPage";
export { AIReportsPage }      from "@/features/ai/AIReportsPage";
export { ProfilePage }        from "@/features/profile/ProfilePage";
export { PresentationsPage }  from "@/features/presentations/PresentationsPage";
export { CollegesPage }       from "@/features/tippo/CollegesPage";
export { NotFoundPage }       from "@/pages/NotFoundPage";

// These are already in their own files and imported directly in App.tsx
export { default as CoefficientsPage } from "@/features/coefficients/CoefficientsPage";
export { default as AnomaliesPage }    from "@/features/anomalies/AnomaliesPage";
