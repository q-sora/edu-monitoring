// src/features/data-entry/DataPages.tsx
import React, { useState } from "react";
import { History } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/auth/AuthContext";
import { Loader, ErrorBox, EmptyState, StatusBadge, PageHeader } from "@/components/ui";
import { DataEntryWrapper } from "./DataEntryWrapper";
import ContingentForm from "@/features/contingent/ContingentForm";
import FinanceForm    from "@/features/finance/FinanceForm";
import ScienceForm    from "@/features/science/ScienceForm";
import GraduatesForm  from "@/features/graduates/GraduatesForm";
import EducationForm  from "@/features/education/EducationForm";

export function ContingentPage() {
  return (
    <DataEntryWrapper
      title="Контингент студентов"
      subtitle="Численность по формам, курсам, специальностям, источникам финансирования"
      FormComponent={ContingentForm}
    />
  );
}

export function FinancePage() {
  return (
    <DataEntryWrapper
      title="Финансы и бюджет"
      subtitle="Доходы, расходы, ФОТ, капзатраты"
      FormComponent={FinanceForm}
    />
  );
}

export function SciencePage() {
  return (
    <DataEntryWrapper
      title="Научная деятельность"
      subtitle="Гранты, публикации, патенты, НИОКР"
      FormComponent={ScienceForm}
    />
  );
}

export function GraduatesPage() {
  return (
    <DataEntryWrapper
      title="Выпускники"
      subtitle="Трудоустройство, зарплаты, секторы"
      FormComponent={GraduatesForm}
    />
  );
}

export function EducationPage() {
  return (
    <DataEntryWrapper
      title="Образовательный процесс"
      subtitle="Преподаватели, специальности, академические результаты"
      FormComponent={EducationForm}
    />
  );
}

export function HistoryPage() {
  const { user } = useAuth();
  const orgId = user?.org_id;
  if (!orgId) {
    return (<>
      <PageHeader title="История заявок" subtitle="Все ваши отправленные заявки" />
      <EmptyState title="Нет данных" hint="История доступна только пользователям организаций" icon={History} />
    </>);
  }

  const domains = ["contingent", "finance", "science-activity", "graduates", "education"];
  const [active, setActive] = useState(domains[0]);
  const { data, loading, error, refetch } = useApi<{ items: any[]; total: number }>(
    `/organisations/${orgId}/${active}?limit=50`, [active],
  );

  return (
    <>
      <PageHeader title="История заявок" subtitle="Все ваши отправленные заявки" />
      <div className="flex gap-1 mb-4 p-1 rounded-md overflow-x-auto scrollbar-thin" style={{ background: "var(--surface-mid)" }}>
        {domains.map(d => (
          <button key={d} onClick={() => setActive(d)}
            className="px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-all"
            style={active === d
              ? { background: "var(--surface-card)", color: "var(--text-primary)", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }
              : { color: "var(--text-muted)" }}
            onMouseEnter={e => { if (active !== d) e.currentTarget.style.color = "var(--text-secondary)"; }}
            onMouseLeave={e => { if (active !== d) e.currentTarget.style.color = "var(--text-muted)"; }}>
            {d === "contingent" ? "Контингент" :
             d === "finance" ? "Финансы" :
             d === "science-activity" ? "Наука" :
             d === "graduates" ? "Выпускники" : "Образ. процесс"}
          </button>
        ))}
      </div>
      <div className="card overflow-hidden">
        {loading && <Loader />}
        {error && <div className="p-4"><ErrorBox message={error} onRetry={refetch} /></div>}
        {data && data.items.length === 0 && <EmptyState title="Записей нет" icon={History} />}
        {data && data.items.length > 0 && (
          <table className="data-table">
            <thead>
              <tr><th>#</th><th>Период</th><th>Статус</th><th>Отправлено</th><th>Обновлено</th></tr>
            </thead>
            <tbody>
              {data.items.map((item: any) => (
                <tr key={item.id}>
                  <td className="font-mono text-xs">{item.id}</td>
                  <td>{item.period_year ?? item.snapshot_date ?? "—"}</td>
                  <td><StatusBadge status={item.submission_status ?? "draft"} /></td>
                  <td className="text-xs" style={{ color: "var(--text-muted)" }}>{item.submitted_at ? new Date(item.submitted_at).toLocaleString("ru-RU") : "—"}</td>
                  <td className="text-xs" style={{ color: "var(--text-muted)" }}>{item.updated_at ? new Date(item.updated_at).toLocaleString("ru-RU") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
