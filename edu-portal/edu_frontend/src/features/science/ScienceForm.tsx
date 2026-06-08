// src/features/science/ScienceForm.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Форма научной деятельности: 8 вкладок ≈ 80 полей
//   • Публикации (по базам, квартилям)
//   • Гранты (с реестром)
//   • НИОКР и коммерциализация
//   • Патенты и лицензии
//   • Цитирование (H-index, FWCI)
//   • Кадры (всего/PhD/молодых)
//   • Международная деятельность
//   • Студенческая наука
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import { useForm, useFieldArray, FormProvider, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Trash2, Save, Send, Loader2,
  FlaskConical, Award, Globe2, Users,
} from "lucide-react";
import client from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import {
  NumField, MoneyField, SectionHeader, StatusBadge, ErrorBox,
} from "@/components/ui";

// ═════════════════════════════════════════════════════════════════════════════
// ZOD
// ═════════════════════════════════════════════════════════════════════════════

const grantSchema = z.object({
  name:    z.string().min(2),
  amount:  z.coerce.number().min(0),
  source:  z.string().min(2),
  status:  z.enum(["active", "completed", "suspended"]).default("active"),
  leader:  z.string().optional(),
  start_date: z.string().optional(),
  end_date:   z.string().optional(),
});

const partnerSchema = z.object({
  country:        z.string().min(2),
  organization:   z.string().min(2),
  cooperation:    z.string().optional(),  // тип сотрудничества
  agreement_date: z.string().optional(),
});

const scienceSchema = z.object({
  period_year:  z.coerce.number().int().min(2015).max(2035),
  report_date:  z.string().optional(),

  // Публикации
  publications_total:           z.coerce.number().int().min(0).optional(),
  publications_scopus:          z.coerce.number().int().min(0).optional(),
  publications_wos:             z.coerce.number().int().min(0).optional(),
  publications_q1:              z.coerce.number().int().min(0).optional(),
  publications_q2:              z.coerce.number().int().min(0).optional(),
  publications_q3:              z.coerce.number().int().min(0).optional(),
  publications_q4:              z.coerce.number().int().min(0).optional(),
  publications_kokson:          z.coerce.number().int().min(0).optional(),
  publications_rinc:            z.coerce.number().int().min(0).optional(),
  publications_books:           z.coerce.number().int().min(0).optional(),
  publications_textbooks:       z.coerce.number().int().min(0).optional(),
  publications_conference_intl: z.coerce.number().int().min(0).optional(),
  publications_conference_local:z.coerce.number().int().min(0).optional(),
  publications_open_access:     z.coerce.number().int().min(0).optional(),

  // Гранты
  grants_active_count:           z.coerce.number().int().min(0).optional(),
  grants_completed_count:        z.coerce.number().int().min(0).optional(),
  grants_total_funding:          z.coerce.number().min(0).optional(),
  grants_state_funding:          z.coerce.number().min(0).optional(),
  grants_international_funding:  z.coerce.number().min(0).optional(),
  grants_per_researcher:         z.coerce.number().min(0).optional(),
  grants_json:                   z.array(grantSchema).default([]),

  // НИОКР
  niokr_total_count:         z.coerce.number().int().min(0).optional(),
  niokr_total_funding:       z.coerce.number().min(0).optional(),
  niokr_with_industry:       z.coerce.number().int().min(0).optional(),
  niokr_implemented:         z.coerce.number().int().min(0).optional(),
  commercialized_results:    z.coerce.number().int().min(0).optional(),
  commercialization_revenue: z.coerce.number().min(0).optional(),

  // Патенты
  patents_filed:         z.coerce.number().int().min(0).optional(),
  patents_granted_kz:    z.coerce.number().int().min(0).optional(),
  patents_granted_intl:  z.coerce.number().int().min(0).optional(),
  patents_active:        z.coerce.number().int().min(0).optional(),
  licenses_sold:         z.coerce.number().int().min(0).optional(),
  licenses_revenue:      z.coerce.number().min(0).optional(),
  software_registrations:z.coerce.number().int().min(0).optional(),

  // Цитирование
  citations_total_scopus:      z.coerce.number().int().min(0).optional(),
  citations_total_wos:         z.coerce.number().int().min(0).optional(),
  hirsch_index_avg:            z.coerce.number().min(0).optional(),
  hirsch_index_max:            z.coerce.number().int().min(0).optional(),
  researchers_with_h_above_5:  z.coerce.number().int().min(0).optional(),
  researchers_with_h_above_10: z.coerce.number().int().min(0).optional(),
  field_weighted_citation:     z.coerce.number().min(0).optional(),

  // Кадры
  researchers_total:         z.coerce.number().int().min(0).optional(),
  researchers_phd:           z.coerce.number().int().min(0).optional(),
  researchers_candidate:     z.coerce.number().int().min(0).optional(),
  researchers_young:         z.coerce.number().int().min(0).optional(),
  researchers_foreign:       z.coerce.number().int().min(0).optional(),
  phd_students_total:        z.coerce.number().int().min(0).optional(),
  phd_dissertations_defended:z.coerce.number().int().min(0).optional(),

  // Международная
  intl_partners_count:        z.coerce.number().int().min(0).optional(),
  intl_joint_projects:        z.coerce.number().int().min(0).optional(),
  intl_conferences_organized: z.coerce.number().int().min(0).optional(),
  intl_visiting_scholars_in:  z.coerce.number().int().min(0).optional(),
  intl_visiting_scholars_out: z.coerce.number().int().min(0).optional(),
  visiting_partners_json:     z.array(partnerSchema).default([]),

  // Студенческая
  student_research_circles: z.coerce.number().int().min(0).optional(),
  student_publications:     z.coerce.number().int().min(0).optional(),
  student_conferences:      z.coerce.number().int().min(0).optional(),
  student_grants_won:       z.coerce.number().int().min(0).optional(),
  student_olympiad_winners: z.coerce.number().int().min(0).optional(),

  // Инфраструктура
  research_labs_count:           z.coerce.number().int().min(0).optional(),
  research_centers_count:        z.coerce.number().int().min(0).optional(),
  shared_use_centers:            z.coerce.number().int().min(0).optional(),
  scientific_journals_published: z.coerce.number().int().min(0).optional(),
});

type ScienceForm = z.infer<typeof scienceSchema>;

// ═════════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════════

export default function ScienceForm({ recordId, orgId: propOrgId }: { recordId?: string; orgId?: string }) {
  const { user } = useAuth();
  const orgId = propOrgId ?? user?.org_id;
  const [tab, setTab] = useState("publications");
  const [status, setStatus] = useState("draft");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const methods = useForm<ScienceForm>({
    resolver: zodResolver(scienceSchema),
    defaultValues: {
      period_year: new Date().getFullYear(),
      grants_json: [],
      visiting_partners_json: [],
    },
  });

  useEffect(() => {
    if (!recordId || !orgId) return;
    (async () => {
      try {
        const { data } = await client.get(`/organisations/${orgId}/science-activity/${recordId}`);
        methods.reset(data);
        setStatus(data.submission_status ?? "draft");
      } catch (e: any) {
        setError(e?.response?.data?.detail ?? "Ошибка загрузки");
      }
    })();
  }, [recordId, orgId, methods]);

  const saveDraft = useCallback(async (values: ScienceForm) => {
    if (!orgId) return;
    setSaving(true);
    setError(null);
    try {
      if (recordId) {
        await client.patch(`/organisations/${orgId}/science-activity/${recordId}`, values);
      } else {
        await client.post(`/organisations/${orgId}/science-activity`, values);
      }
      setLastSaved(new Date());
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }, [orgId, recordId]);

  const submitForApproval = async () => {
    if (!orgId || !recordId) { setError("Сначала сохраните"); return; }
    setSubmitting(true);
    try {
      await client.patch(`/organisations/${orgId}/science-activity/${recordId}/status`,
        { new_status: "submitted" });
      setStatus("submitted");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Ошибка");
    } finally { setSubmitting(false); }
  };

  const isReadOnly = ["approved", "submitted", "under_review"].includes(status);

  const tabs = [
    { id: "publications", label: "Публикации",     icon: FlaskConical },
    { id: "grants",       label: "Гранты",         icon: Award },
    { id: "niokr",        label: "НИОКР",          icon: FlaskConical },
    { id: "patents",      label: "Патенты",        icon: Award },
    { id: "citations",    label: "Цитирование",    icon: FlaskConical },
    { id: "researchers",  label: "Кадры",          icon: Users },
    { id: "international",label: "Международ.",    icon: Globe2 },
    { id: "students",     label: "Студ. наука",    icon: Users },
    { id: "infra",        label: "Инфраструктура", icon: FlaskConical },
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
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                    tab === t.id ? "bg-fc-cyan-500 text-white" : "text-fc-steel-600 hover:bg-slate-100"
                  }`}>
                  <t.icon className="w-3 h-3" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <fieldset disabled={isReadOnly} className="p-6 disabled:opacity-60">
            <NumField name="period_year" label="Отчётный год *" />
            <div className="my-5 border-b border-slate-100" />

            {tab === "publications" && <PublicationsTab />}
            {tab === "grants"       && <GrantsTab />}
            {tab === "niokr"        && <NiokrTab />}
            {tab === "patents"      && <PatentsTab />}
            {tab === "citations"    && <CitationsTab />}
            {tab === "researchers"  && <ResearchersTab />}
            {tab === "international"&& <InternationalTab />}
            {tab === "students"     && <StudentsTab />}
            {tab === "infra"        && <InfraTab />}
          </fieldset>
        </div>
      </form>
    </FormProvider>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TABS
// ═════════════════════════════════════════════════════════════════════════════

function PublicationsTab() {
  return (
    <>
      <SectionHeader title="Публикации по базам данных"
        hint="Scopus, Web of Science — главные международные базы. КОКСНВО — республиканский перечень." />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <NumField name="publications_total" label="Публикаций всего *" highlight />
        <NumField name="publications_scopus" label="В Scopus" />
        <NumField name="publications_wos" label="В Web of Science" />
        <NumField name="publications_kokson" label="В изданиях КОКСНВО (РК)" />
        <NumField name="publications_rinc" label="В РИНЦ" />
        <NumField name="publications_open_access" label="Open Access" />
      </div>

      <SectionHeader title="Распределение по квартилям (Scopus/WoS)"
        hint="Q1 — самые престижные журналы, Q4 — менее цитируемые" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <NumField name="publications_q1" label="Q1 (топ-25%)" highlight />
        <NumField name="publications_q2" label="Q2" />
        <NumField name="publications_q3" label="Q3" />
        <NumField name="publications_q4" label="Q4" />
      </div>

      <SectionHeader title="Книги, учебники, конференции" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NumField name="publications_books" label="Монографии" />
        <NumField name="publications_textbooks" label="Учебники и учебные пособия" />
        <NumField name="publications_conference_intl" label="Международные конференции" />
        <NumField name="publications_conference_local" label="Республиканские конференции" />
      </div>
    </>
  );
}

function GrantsTab() {
  const { control, register } = useFormContext<ScienceForm>();
  const { fields, append, remove } = useFieldArray({ control, name: "grants_json" });

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <NumField name="grants_active_count" label="Активных грантов" />
        <NumField name="grants_completed_count" label="Завершённых грантов" />
        <MoneyField name="grants_total_funding" label="Общий объём (тенге)" highlight />
        <MoneyField name="grants_state_funding" label="Из госбюджета РК" />
        <MoneyField name="grants_international_funding" label="Международные" />
        <MoneyField name="grants_per_researcher" label="На 1 учёного"
          hint="Показатель эффективности кадров" />
      </div>

      <div className="border-t border-slate-200 pt-5">
        <div className="flex items-center justify-between mb-3">
          <p className="font-display font-bold text-fc-navy-900">Реестр научных грантов</p>
          <button type="button"
            onClick={() => append({ name: "", amount: 0, source: "", status: "active",
              leader: "", start_date: "", end_date: "" })}
            className="btn-primary btn-sm">
            <Plus className="w-3 h-3" /> Добавить грант
          </button>
        </div>

        {fields.length === 0 && (
          <p className="text-center text-sm text-fc-steel-400 py-6">
            Список пуст. Добавьте крупные гранты вручную.
          </p>
        )}

        <div className="space-y-3">
          {fields.map((f, idx) => (
            <div key={f.id} className="p-3 border border-slate-200 rounded-lg bg-slate-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input {...register(`grants_json.${idx}.name`)} placeholder="Название гранта"
                  className="input md:col-span-2" />
                <input {...register(`grants_json.${idx}.source`)} placeholder="Источник (МНВО, БРК)"
                  className="input" />
                <input {...register(`grants_json.${idx}.amount`)} type="number" placeholder="Сумма"
                  className="input text-right" />
                <input {...register(`grants_json.${idx}.start_date`)} type="date" className="input" />
                <input {...register(`grants_json.${idx}.end_date`)} type="date" className="input" />
                <input {...register(`grants_json.${idx}.leader`)} placeholder="Руководитель проекта"
                  className="input md:col-span-2" />
              </div>
              <div className="flex justify-end mt-2">
                <button type="button" onClick={() => remove(idx)}
                  className="text-xs text-danger hover:underline flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function NiokrTab() {
  return (
    <>
      <SectionHeader title="НИОКР и хоздоговоры"
        hint="Научно-исследовательские и опытно-конструкторские работы" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NumField name="niokr_total_count" label="Количество НИОКР" />
        <MoneyField name="niokr_total_funding" label="Общее финансирование" />
        <NumField name="niokr_with_industry" label="С индустриальными партнёрами"
          hint="Договоры с промышленностью — показатель прикладной науки" />
        <NumField name="niokr_implemented" label="Внедрённых в производство" />
      </div>

      <SectionHeader title="Коммерциализация результатов"
        hint="Главный показатель прикладной отдачи науки" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NumField name="commercialized_results" label="Коммерциализованных проектов" />
        <MoneyField name="commercialization_revenue" label="Доход от коммерциализации" highlight />
      </div>
    </>
  );
}

function PatentsTab() {
  return (
    <>
      <SectionHeader title="Патенты и интеллектуальная собственность" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <NumField name="patents_filed" label="Поданных заявок" />
        <NumField name="patents_granted_kz" label="Выдано в РК" />
        <NumField name="patents_granted_intl" label="Выдано за рубежом" highlight
          hint="Международные патенты — показатель глобальной значимости" />
        <NumField name="patents_active" label="Действующих" />
        <NumField name="licenses_sold" label="Проданных лицензий" />
        <MoneyField name="licenses_revenue" label="Доход от лицензий" />
        <NumField name="software_registrations" label="Свидетельств на ПО" />
      </div>
    </>
  );
}

function CitationsTab() {
  return (
    <>
      <SectionHeader title="Цитирование и наукометрия"
        hint="Ключевые показатели для рейтингов QS, Times Higher Education" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NumField name="citations_total_scopus" label="Цитирований Scopus" />
        <NumField name="citations_total_wos" label="Цитирований WoS" />
      </div>

      <SectionHeader title="Индекс Хирша" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <NumField name="hirsch_index_avg" label="Средний H-индекс" step="0.1" />
        <NumField name="hirsch_index_max" label="Максимальный H-индекс" />
        <NumField name="researchers_with_h_above_5" label="Учёных с H > 5" />
        <NumField name="researchers_with_h_above_10" label="Учёных с H > 10" highlight />
        <NumField name="field_weighted_citation" label="FWCI (Field-Weighted Citation Impact)"
          step="0.01" hint="Норма для исследовательских ВУЗов: > 1.0" />
      </div>
    </>
  );
}

function ResearchersTab() {
  return (
    <>
      <SectionHeader title="Научные кадры" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <NumField name="researchers_total" label="Всего научных сотрудников *" highlight />
        <NumField name="researchers_phd" label="С PhD / докторской степенью" />
        <NumField name="researchers_candidate" label="С кандидатской степенью" />
        <NumField name="researchers_young" label="Молодые учёные (до 35 лет)"
          hint="Важный показатель устойчивости" />
        <NumField name="researchers_foreign" label="Иностранные учёные" />
      </div>

      <SectionHeader title="Докторантура" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NumField name="phd_students_total" label="Докторантов всего" />
        <NumField name="phd_dissertations_defended" label="Защитили диссертацию в году" highlight />
      </div>
    </>
  );
}

function InternationalTab() {
  const { control, register } = useFormContext<ScienceForm>();
  const { fields, append, remove } = useFieldArray({ control, name: "visiting_partners_json" });

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <NumField name="intl_partners_count" label="Зарубежных партнёров" />
        <NumField name="intl_joint_projects" label="Совместных проектов" />
        <NumField name="intl_conferences_organized" label="Проведено международных конференций" />
        <NumField name="intl_visiting_scholars_in" label="Приглашённых к нам" />
        <NumField name="intl_visiting_scholars_out" label="Наших за рубеж" />
      </div>

      <div className="border-t border-slate-200 pt-5">
        <div className="flex items-center justify-between mb-3">
          <p className="font-display font-bold text-fc-navy-900">Реестр зарубежных партнёров</p>
          <button type="button"
            onClick={() => append({ country: "", organization: "", cooperation: "", agreement_date: "" })}
            className="btn-primary btn-sm">
            <Plus className="w-3 h-3" /> Добавить партнёра
          </button>
        </div>

        {fields.length === 0 && (
          <p className="text-center text-sm text-fc-steel-400 py-6">Список пуст</p>
        )}

        <div className="space-y-2">
          {fields.map((f, idx) => (
            <div key={f.id} className="grid grid-cols-[100px_1fr_1fr_140px_auto] gap-2 items-center">
              <input {...register(`visiting_partners_json.${idx}.country`)}
                placeholder="Страна" className="input" />
              <input {...register(`visiting_partners_json.${idx}.organization`)}
                placeholder="Организация" className="input" />
              <input {...register(`visiting_partners_json.${idx}.cooperation`)}
                placeholder="Тип сотрудничества" className="input" />
              <input {...register(`visiting_partners_json.${idx}.agreement_date`)}
                type="date" className="input" />
              <button type="button" onClick={() => remove(idx)}
                className="p-1.5 text-danger hover:bg-red-50 rounded-md">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function StudentsTab() {
  return (
    <>
      <SectionHeader title="Студенческая наука" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <NumField name="student_research_circles" label="Научных кружков" />
        <NumField name="student_publications" label="Публикаций студентов" />
        <NumField name="student_conferences" label="Студенческих конференций" />
        <NumField name="student_grants_won" label="Выигранных грантов" highlight />
        <NumField name="student_olympiad_winners" label="Победителей олимпиад" />
      </div>
    </>
  );
}

function InfraTab() {
  return (
    <>
      <SectionHeader title="Научная инфраструктура" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NumField name="research_labs_count" label="Лабораторий" />
        <NumField name="research_centers_count" label="Научных центров" />
        <NumField name="shared_use_centers" label="Центров коллективного пользования (ЦКП)" />
        <NumField name="scientific_journals_published" label="Издаваемых научных журналов" />
      </div>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LOCAL — form chrome
// ═════════════════════════════════════════════════════════════════════════════

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
          <button type="button" onClick={onSubmit} disabled={submitting || !canSubmit}
            title={!canSubmit ? "Сначала сохраните" : ""} className="btn-primary">
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            На согласование
          </button>
        </div>
      )}
    </div>
  );
}
