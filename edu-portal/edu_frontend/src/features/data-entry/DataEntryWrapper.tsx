// src/features/data-entry/DataEntryWrapper.tsx
import React, { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/auth/AuthContext";
import { Loader, PageHeader } from "@/components/ui";

interface Organisation {
  id: string;
  name_ru: string;
  bin_iin?: string;
  region_id?: number | null;
  org_type_id?: number | null;
  ownership_form_id?: number | null;
  status?: string;
}

// OrgPicker — shown to admins/superadmins who have no fixed org_id
export function OrgPicker({ onSelect }: { onSelect: (id: string, name: string) => void }) {
  const { data, loading } = useApi<{ items: Organisation[]; total: number }>(
    "/admin/organisations?limit=50",
  );
  return (
    <div className="card p-6 max-w-md mx-auto">
      <p className="label-eyebrow text-fc-navy-700 mb-3">Выберите организацию</p>
      {loading && <Loader />}
      {data && (
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {data.items.map(org => (
            <button key={org.id} type="button"
              onClick={() => onSelect(org.id, org.name_ru)}
              className="w-full text-left px-3 py-2 rounded-md text-sm transition-colors"
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,168,202,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              {org.name_ru}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Generic wrapper used by all 5 domain pages
export function DataEntryWrapper({
  title, subtitle, FormComponent,
}: {
  title: string;
  subtitle: string;
  FormComponent: React.ComponentType<{ orgId?: string }>;
}) {
  const { user } = useAuth();
  const fixedOrgId = user?.org_id;
  const [pickedOrgId, setPickedOrgId] = useState<string | null>(null);
  const [pickedOrgName, setPickedOrgName] = useState<string | null>(null);

  const orgId = fixedOrgId ?? pickedOrgId;

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={
        !fixedOrgId && pickedOrgName ? (
          <div className="flex items-center gap-2">
            <span className="label-eyebrow" style={{ color: "var(--text-secondary)" }}>{pickedOrgName}</span>
            <button className="btn-ghost text-xs" onClick={() => { setPickedOrgId(null); setPickedOrgName(null); }}>
              Сменить
            </button>
          </div>
        ) : undefined
      } />
      {!orgId
        ? <OrgPicker onSelect={(id, name) => { setPickedOrgId(id); setPickedOrgName(name); }} />
        : <FormComponent orgId={orgId} />
      }
    </>
  );
}
