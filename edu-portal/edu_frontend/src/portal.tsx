// src/portal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Re-export file — all components have been moved to their own feature files.
// This file exists for backwards compatibility only.
// ─────────────────────────────────────────────────────────────────────────────

export { AppShell }           from "@/layout/AppShell";
export { DashboardPage }      from "@/features/dashboard/DashboardPage";
export { UsersPage }          from "@/features/admin/UsersPage";
export { OrganisationsPage }  from "@/features/admin/OrganisationsPage";
export { ApprovalsPage }      from "@/features/admin/ApprovalsPage";
export { AuditLogPage }       from "@/features/admin/AuditLogPage";
export { IntegrationsPage }   from "@/features/admin/IntegrationsPage";
export { ApiKeysPage }        from "@/features/admin/ApiKeysPage";
export { ContingentPage, FinancePage, SciencePage, GraduatesPage, EducationPage, HistoryPage } from "@/features/data-entry/DataPages";
export { SupersetDashboardsPage, SupersetSection } from "@/features/analytics/SupersetDashboardsPage";
export { ProfilePage }        from "@/features/profile/ProfilePage";
export { CollegesPage }       from "@/features/tippo/CollegesPage";
export { NotFoundPage }       from "@/pages/NotFoundPage";

// These are already in their own files and imported directly in App.tsx
