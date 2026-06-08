// src/features/graduates/GraduatesForm.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Форма выпускников и трудоустройства: 7 вкладок ≈ 80 полей
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import { useForm, useFieldArray, FormProvider, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Save, Send, Loader2 } from "lucide-react";
import client from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import {
  NumField, MoneyField, PercentField, SectionHeader, StatusBadge, ErrorBox,
} from "@/components/ui";

const employerSchema = z.object({
  name:           z.string().min(2),
  sector:         z.string().optional(),
  hired_count:    z.coerce.number().int().min(0).optional(),
  agreement_date: z.string().optional(),
});

const graduatesSchema = z.object({
  period_year: z.coerce.number().int().min(2015).max(2035),
  report_date: z.string().optional(),

  total_graduates:        z.coerce.number().int().min(0).optional(),
  graduates_bachelor:     z.coerce.number().int().min(0).optional(),
  graduates_master:       z.coerce.number().int().min(0).optional(),
  graduates_phd:          z.coerce.number().int().min(0).optional(),
  graduates_specialist:   z.coerce.number().int().min(0).optional(),
  graduates_full_time:    z.coerce.number().int().min(0).optional(),
  graduates_part_time:    z.coerce.number().int().min(0).optional(),
  graduates_with_honors:  z.coerce.number().int().min(0).optional(),
  graduates_grant_funded: z.coerce.number().int().min(0).optional(),
  graduates_paid_funded:  z.coerce.number().int().min(0).optional(),
  graduates_foreign:      z.coerce.number().int().min(0).optional(),

  employed_count:           z.coerce.number().int().min(0).optional(),
  employed_by_specialty:    z.coerce.number().int().min(0).optional(),
  employed_other_field:     z.coerce.number().int().min(0).optional(),
  unemployed_count:         z.coerce.number().int().min(0).optional(),
  self_employed:            z.coerce.number().int().min(0).optional(),
  started_business:         z.coerce.number().int().min(0).optional(),
  military_service:         z.coerce.number().int().min(0).optional(),
  maternity_leave:          z.coerce.number().int().min(0).optional(),
  continue_education:       z.coerce.number().int().min(0).optional(),
  continue_education_master:z.coerce.number().int().min(0).optional(),
  continue_education_phd:   z.coerce.number().int().min(0).optional(),
  continue_education_abroad:z.coerce.number().int().min(0).optional(),

  employed_state_sector:     z.coerce.number().int().min(0).optional(),
  employed_private_sector:   z.coerce.number().int().min(0).optional(),
  employed_education_sector: z.coerce.number().int().min(0).optional(),
  employed_healthcare:       z.coerce.number().int().min(0).optional(),
  employed_it_sector:        z.coerce.number().int().min(0).optional(),
  employed_industrial:       z.coerce.number().int().min(0).optional(),
  employed_agriculture:      z.coerce.number().int().min(0).optional(),
  employed_finance:          z.coerce.number().int().min(0).optional(),
  employed_other:            z.coerce.number().int().min(0).optional(),

  employed_in_region:    z.coerce.number().int().min(0).optional(),
  employed_other_region: z.coerce.number().int().min(0).optional(),
  employed_abroad:       z.coerce.number().int().min(0).optional(),

  avg_salary_first_year:        z.coerce.number().min(0).optional(),
  avg_salary_third_year:        z.coerce.number().min(0).optional(),
  avg_salary_fifth_year:        z.coerce.number().min(0).optional(),
  median_salary_first_year:     z.coerce.number().min(0).optional(),
  min_salary_first_year:        z.coerce.number().min(0).optional(),
  max_salary_first_year:        z.coerce.number().min(0).optional(),
  salary_above_national_median: z.coerce.number().int().min(0).optional(),

  employed_within_1_month:  z.coerce.number().int().min(0).optional(),
  employed_within_3_months: z.coerce.number().int().min(0).optional(),
  employed_within_6_months: z.coerce.number().int().min(0).optional(),
  employed_within_1_year:   z.coerce.number().int().min(0).optional(),

  partner_employers_count: z.coerce.number().int().min(0).optional(),
  employer_satisfaction:   z.coerce.number().min(0).max(100).optional(),
  graduate_satisfaction:   z.coerce.number().min(0).max(100).optional(),
  employer_partners_json:  z.array(employerSchema).default([]),
});

type GraduatesForm = z.infer<typeof graduatesSchema>;

export default function GraduatesForm({ recordId, orgId: propOrgId }: { recordId?: string; orgId?: string }) {
  const { user } = useAuth();
  const orgId = propOrgId ?? user?.org_id;
  const [tab, setTab] = useState("output");
  const [status, setStatus] = useState("draft");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const methods = useForm<GraduatesForm>({
    resolver: zodResolver(graduatesSchema),
    defaultValues: {
      period_year: new Date().getFullYear(),
      employer_partners_json: [],
    },
  });

  useEffect(() => {
    if (!recordId || !orgId) return;
    (async () => {
      try {
        const { data } = await client.get(`/organisations/${orgId}/graduates/${recordId}`);
        methods.reset(data);
        setStatus(data.submission_status ?? "draft");
      } catch (e: any) {
        setError(e?.response?.data?.detail ?? "Ошибка загрузки");
      }
    })();
  }, [recordId, orgId, methods]);

  const saveDraft = useCallback(async (values: GraduatesForm) => {
    if (!orgId) return;
    setSaving(true); setError(null);
    try {
      if (recordId) await client.patch(`/organisations/${orgId}/graduates/${recordId}`, values);
      else await client.post(`/organisations/${orgId}/graduates`, values);
      setLastSaved(new Date());
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Ошибка сохранения");
    } finally { setSaving(false); }
  }, [orgId, recordId]);

  const submitForApproval = async () => {
    if (!recordId) { setError("Сначала сохраните"); return; }
    setSubmitting(true);
    try {
      await client.patch(`/organisations/${orgId}/graduates/${recordId}/status`,
        { new_status: "submitted" });
      setStatus("submitted");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Ошибка");
    } finally { setSubmitting(false); }
  };

  const isReadOnly = ["approved", "submitted", "under_review"].includes(status);
  const tabs = [
    { id: "output",     label: "Выпуск" },
    { id: "employment", label: "Трудоустройство" },
    { id: "sectors",    label: "По секторам" },
    { id: "geography",  label: "География" },
    { id: "salaries",   label: "Зарплаты" },
    { id: "timeline",   label: "Сроки" },
    { id: "employers",  label: "Работодатели" },
  ];

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(saveDraft)}>
        <FormHeader status={status} lastSaved={lastSaved} saving={saving} submitting={submitting}
          onSubmit={submitForApproval} canSubmit={!!recordId} readOnly={isReadOnly} />

        {error && (
          <div className="mb-4">
            <ErrorBox message={error} />
          </div>
        )}

        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 overflow-x-auto scrollbar-thin">
            <div className="flex gap-0.5 p-1.5 min-w-max">
              {tabs.map(t => (
                <button key={t.id} type="button" onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap ${
                    tab === t.id ? "bg-fc-steel-500 text-white" : "text-fc-steel-600 hover:bg-slate-100"
                  }`}>{t.label}</button>
              ))}
            </div>
          </div>

          <fieldset disabled={isReadOnly} className="p-6 disabled:opacity-60">
            <NumField name="period_year" label="Отчётный год *" />
            <div className="my-5 border-b border-slate-100" />

            {tab === "output" && (
              <>
                <SectionHeader title="Выпуск" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <NumField name="total_graduates" label="Всего выпускников *" highlight />
                  <NumField name="graduates_bachelor" label="Бакалавров" />
                  <NumField name="graduates_master" label="Магистров" />
                  <NumField name="graduates_phd" label="PhD/докторов" />
                  <NumField name="graduates_specialist" label="Специалистов (мед.)" />
                  <NumField name="graduates_with_honors" label="С отличием" />
                </div>
                <SectionHeader title="По форме обучения и финансированию" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <NumField name="graduates_full_time" label="Очная" />
                  <NumField name="graduates_part_time" label="Заочная" />
                  <NumField name="graduates_grant_funded" label="На грант" />
                  <NumField name="graduates_paid_funded" label="Платное" />
                  <NumField name="graduates_foreign" label="Иностранных" />
                </div>
              </>
            )}

            {tab === "employment" && (
              <>
                <SectionHeader title="Трудоустройство"
                  hint="Главный показатель ROI образования" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <NumField name="employed_count" label="Трудоустроено всего *" highlight />
                  <NumField name="employed_by_specialty" label="ПО специальности"
                    hint="Главный показатель релевантности" highlight />
                  <NumField name="employed_other_field" label="Не по специальности" />
                  <NumField name="unemployed_count" label="Не трудоустроено" />
                  <NumField name="self_employed" label="Самозанятые" />
                  <NumField name="started_business" label="Открыли бизнес" />
                  <NumField name="military_service" label="В армии" />
                  <NumField name="maternity_leave" label="В декрете" />
                </div>
                <SectionHeader title="Продолжили обучение" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <NumField name="continue_education" label="Всего" />
                  <NumField name="continue_education_master" label="В магистратуру" />
                  <NumField name="continue_education_phd" label="В докторантуру" />
                  <NumField name="continue_education_abroad" label="За рубежом" highlight />
                </div>
              </>
            )}

            {tab === "sectors" && (
              <>
                <SectionHeader title="Трудоустройство по секторам экономики" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <NumField name="employed_state_sector" label="Госсектор" />
                  <NumField name="employed_private_sector" label="Частный сектор" />
                  <NumField name="employed_education_sector" label="Образование" />
                  <NumField name="employed_healthcare" label="Здравоохранение" />
                  <NumField name="employed_it_sector" label="IT" />
                  <NumField name="employed_industrial" label="Промышленность" />
                  <NumField name="employed_agriculture" label="Сельское хозяйство" />
                  <NumField name="employed_finance" label="Финансы" />
                  <NumField name="employed_other" label="Другие сектора" />
                </div>
              </>
            )}

            {tab === "geography" && (
              <>
                <SectionHeader title="География трудоустройства" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <NumField name="employed_in_region" label="Остались в своём регионе" highlight
                    hint="Удержание кадров в регионе" />
                  <NumField name="employed_other_region" label="В другом регионе РК" />
                  <NumField name="employed_abroad" label="За рубежом"
                    hint="Утечка мозгов" />
                </div>
              </>
            )}

            {tab === "salaries" && (
              <>
                <SectionHeader title="Зарплаты выпускников"
                  hint="Главный показатель отдачи от инвестиций в образование" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <MoneyField name="avg_salary_first_year" label="Средняя в 1й год" highlight />
                  <MoneyField name="avg_salary_third_year" label="Средняя в 3й год" />
                  <MoneyField name="avg_salary_fifth_year" label="Средняя в 5й год" />
                </div>
                <SectionHeader title="Распределение в первый год" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <MoneyField name="median_salary_first_year" label="Медиана" />
                  <MoneyField name="min_salary_first_year" label="Минимум" />
                  <MoneyField name="max_salary_first_year" label="Максимум" />
                  <NumField name="salary_above_national_median" label="Получают выше медианы по РК"
                    hint="Количество выпускников" />
                </div>
              </>
            )}

            {tab === "timeline" && (
              <>
                <SectionHeader title="Сроки трудоустройства"
                  hint="Чем быстрее трудоустраиваются — тем актуальнее образование" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <NumField name="employed_within_1_month" label="В течение 1 месяца" highlight />
                  <NumField name="employed_within_3_months" label="В течение 3 месяцев" />
                  <NumField name="employed_within_6_months" label="В течение 6 месяцев" />
                  <NumField name="employed_within_1_year" label="В течение года" />
                </div>
              </>
            )}

            {tab === "employers" && <EmployersTab />}
          </fieldset>
        </div>
      </form>
    </FormProvider>
  );
}

function EmployersTab() {
  const { control, register } = useFormContext<GraduatesForm>();
  const { fields, append, remove } = useFieldArray({ control, name: "employer_partners_json" });

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <NumField name="partner_employers_count" label="Партнёров-работодателей" />
        <PercentField name="employer_satisfaction" label="Удовлетворённость работодателей, %" highlight />
        <PercentField name="graduate_satisfaction" label="Удовлетворённость выпускников, %" />
      </div>

      <div className="border-t border-slate-200 pt-5">
        <div className="flex items-center justify-between mb-3">
          <p className="font-display font-bold text-fc-navy-900">Реестр крупных работодателей</p>
          <button type="button"
            onClick={() => append({ name: "", sector: "", hired_count: 0, agreement_date: "" })}
            className="btn-primary btn-sm">
            <Plus className="w-3 h-3" /> Добавить
          </button>
        </div>

        {fields.length === 0 && (
          <p className="text-center text-sm text-fc-steel-400 py-6">Список пуст</p>
        )}

        <div className="space-y-2">
          {fields.map((f, idx) => (
            <div key={f.id} className="grid grid-cols-[1fr_140px_100px_140px_auto] gap-2 items-center">
              <input {...register(`employer_partners_json.${idx}.name`)}
                placeholder="Название компании" className="input" />
              <input {...register(`employer_partners_json.${idx}.sector`)}
                placeholder="Сектор" className="input" />
              <input {...register(`employer_partners_json.${idx}.hired_count`)}
                type="number" placeholder="Чел." className="input text-right" />
              <input {...register(`employer_partners_json.${idx}.agreement_date`)}
                type="date" className="input" />
              <button type="button" onClick={() => remove(idx)}
                className="p-1.5 text-danger hover:bg-danger/10 rounded-md">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Local — form chrome ───────────────────────────────────────────────────

function FormHeader({ status, lastSaved, saving, submitting, onSubmit, canSubmit, readOnly }: any) {
  return (
    <div className="card p-4 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <StatusBadge status={status} />
        {lastSaved && <span className="text-xs text-fc-steel-500">Сохранено: {lastSaved.toLocaleTimeString("ru-RU")}</span>}
      </div>
      {!readOnly && (
        <div className="flex items-center gap-2">
          <button type="submit" disabled={saving} className="btn-ghost">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Сохранить черновик
          </button>
          <button type="button" onClick={onSubmit} disabled={submitting || !canSubmit} className="btn-primary">
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            На согласование
          </button>
        </div>
      )}
    </div>
  );
}
