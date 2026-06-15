// src/features/education/EducationForm.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Форма образовательного процесса: 7 вкладок ≈ 70 полей
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, Send, Loader2 } from "lucide-react";
import client from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import {
  NumField, PercentField, SectionHeader, Field, StatusBadge, ErrorBox,
} from "@/components/ui";

const educationSchema = z.object({
  period_year: z.coerce.number().int().min(2015).max(2035),
  report_date: z.string().optional(),

  // Teachers
  teachers_total:           z.coerce.number().int().min(0).optional(),
  teachers_full_time:       z.coerce.number().int().min(0).optional(),
  teachers_part_time:       z.coerce.number().int().min(0).optional(),
  teachers_with_phd:        z.coerce.number().int().min(0).optional(),
  teachers_with_candidate:  z.coerce.number().int().min(0).optional(),
  teachers_with_doctorate:  z.coerce.number().int().min(0).optional(),
  teachers_professors:      z.coerce.number().int().min(0).optional(),
  teachers_docents:         z.coerce.number().int().min(0).optional(),
  teachers_senior:          z.coerce.number().int().min(0).optional(),
  teachers_assistants:      z.coerce.number().int().min(0).optional(),
  teachers_under_35:        z.coerce.number().int().min(0).optional(),
  teachers_above_60:        z.coerce.number().int().min(0).optional(),
  teachers_foreign:         z.coerce.number().int().min(0).optional(),
  avg_teacher_age:          z.coerce.number().min(0).optional(),
  teacher_to_student_ratio: z.coerce.number().min(0).optional(),

  // Specialties
  specialties_total:           z.coerce.number().int().min(0).optional(),
  specialties_bachelor:        z.coerce.number().int().min(0).optional(),
  specialties_master:          z.coerce.number().int().min(0).optional(),
  specialties_phd:             z.coerce.number().int().min(0).optional(),
  specialties_accredited:      z.coerce.number().int().min(0).optional(),
  specialties_intl_accredited: z.coerce.number().int().min(0).optional(),
  dual_degree_programs:        z.coerce.number().int().min(0).optional(),
  english_programs:            z.coerce.number().int().min(0).optional(),
  new_programs_launched:       z.coerce.number().int().min(0).optional(),

  // Academic
  avg_gpa:                  z.coerce.number().min(0).max(4).optional(),
  gpa_above_3_5_count:      z.coerce.number().int().min(0).optional(),
  gpa_below_2_0_count:      z.coerce.number().int().min(0).optional(),
  expulsion_total:          z.coerce.number().int().min(0).optional(),
  expulsion_academic:       z.coerce.number().int().min(0).optional(),
  expulsion_financial:      z.coerce.number().int().min(0).optional(),
  expulsion_personal:       z.coerce.number().int().min(0).optional(),
  retention_rate:           z.coerce.number().min(0).max(100).optional(),
  pass_rate_first_attempt:  z.coerce.number().min(0).max(100).optional(),
  state_exam_pass_rate:     z.coerce.number().min(0).max(100).optional(),

  // Internships
  internship_partners_count:  z.coerce.number().int().min(0).optional(),
  students_on_internship:     z.coerce.number().int().min(0).optional(),
  students_internship_abroad: z.coerce.number().int().min(0).optional(),
  dual_education_count:       z.coerce.number().int().min(0).optional(),
  academic_mobility_in:       z.coerce.number().int().min(0).optional(),
  academic_mobility_out:      z.coerce.number().int().min(0).optional(),

  // Olympiads
  olympiad_participants:     z.coerce.number().int().min(0).optional(),
  olympiad_winners_intl:     z.coerce.number().int().min(0).optional(),
  olympiad_winners_republic: z.coerce.number().int().min(0).optional(),
  olympiad_winners_regional: z.coerce.number().int().min(0).optional(),
  competition_winners_total: z.coerce.number().int().min(0).optional(),

  // Continuing
  continuing_education_count: z.coerce.number().int().min(0).optional(),
  qualification_courses:      z.coerce.number().int().min(0).optional(),
  retraining_programs:        z.coerce.number().int().min(0).optional(),
  certificates_issued:        z.coerce.number().int().min(0).optional(),

  // Infra
  classrooms_total:             z.coerce.number().int().min(0).optional(),
  computer_classrooms:          z.coerce.number().int().min(0).optional(),
  lab_classrooms:               z.coerce.number().int().min(0).optional(),
  library_books_count:          z.coerce.number().int().min(0).optional(),
  library_electronic_resources: z.coerce.number().int().min(0).optional(),
  lms_platform_used:            z.string().optional(),
});

type EducationForm = z.infer<typeof educationSchema>;

export default function EducationForm({ recordId, orgId: propOrgId }: { recordId?: string; orgId?: string }) {
  const { user } = useAuth();
  const orgId = propOrgId ?? user?.org_id;
  const [tab, setTab] = useState("teachers");
  const [status, setStatus] = useState("draft");
  const [currentRecordId, setCurrentRecordId] = useState(recordId);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const methods = useForm<EducationForm>({
    resolver: zodResolver(educationSchema),
    defaultValues: { period_year: new Date().getFullYear() },
  });

  useEffect(() => {
    setCurrentRecordId(recordId);
  }, [recordId]);

  useEffect(() => {
    if (!currentRecordId || !orgId) return;
    (async () => {
      try {
        const { data } = await client.get(`/organisations/${orgId}/education/${currentRecordId}`);
        methods.reset(data);
        setStatus(data.submission_status ?? "draft");
      } catch (e: any) { setError(e?.response?.data?.detail ?? "Ошибка"); }
    })();
  }, [currentRecordId, orgId, methods]);

  const saveDraft = useCallback(async (values: EducationForm) => {
    if (!orgId) return;
    setSaving(true); setError(null);
    try {
      if (currentRecordId) await client.patch(`/organisations/${orgId}/education/${currentRecordId}`, values);
      else {
        const { data } = await client.post(`/organisations/${orgId}/education`, values);
        if (data?.id) setCurrentRecordId(String(data.id));
      }
      setLastSaved(new Date());
    } catch (e: any) { setError(e?.response?.data?.detail ?? "Ошибка сохранения"); }
    finally { setSaving(false); }
  }, [orgId, currentRecordId]);

  const submitForApproval = async () => {
    if (!currentRecordId) { setError("Сначала сохраните"); return; }
    setSubmitting(true);
    try {
      await client.patch(`/organisations/${orgId}/education/${currentRecordId}/status`,
        { new_status: "submitted" });
      setStatus("submitted");
    } catch (e: any) { setError(e?.response?.data?.detail ?? "Ошибка"); }
    finally { setSubmitting(false); }
  };

  const isReadOnly = ["approved", "submitted", "under_review"].includes(status);
  const tabs = [
    { id: "teachers",     label: "Преподаватели" },
    { id: "specialties",  label: "Специальности" },
    { id: "academic",     label: "Успеваемость" },
    { id: "internships",  label: "Практика" },
    { id: "olympiads",    label: "Олимпиады" },
    { id: "continuing",   label: "Доп. обучение" },
    { id: "infra",        label: "Инфраструктура" },
  ];

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(saveDraft)}>
        <FormHeader status={status} lastSaved={lastSaved} saving={saving} submitting={submitting}
          onSubmit={submitForApproval} canSubmit={!!currentRecordId} readOnly={isReadOnly} />

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
                    tab === t.id ? "bg-fc-purple-500 text-white" : "text-fc-steel-600 hover:bg-slate-100"
                  }`}>{t.label}</button>
              ))}
            </div>
          </div>

          <fieldset disabled={isReadOnly} className="p-6 disabled:opacity-60">
            <NumField name="period_year" label="Отчётный год *" />
            <div className="my-5 border-b border-slate-100" />

            {tab === "teachers" && (
              <>
                <SectionHeader title="Преподавательский состав" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <NumField name="teachers_total" label="Всего преподавателей *" highlight />
                  <NumField name="teachers_full_time" label="Штатных" />
                  <NumField name="teachers_part_time" label="Совместителей" />
                </div>
                <SectionHeader title="По учёным степеням и званиям" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <NumField name="teachers_with_phd" label="С PhD" />
                  <NumField name="teachers_with_candidate" label="Кандидаты наук" />
                  <NumField name="teachers_with_doctorate" label="Доктора наук" />
                  <NumField name="teachers_professors" label="Профессоров" />
                  <NumField name="teachers_docents" label="Доцентов" />
                  <NumField name="teachers_senior" label="Старших преподавателей" />
                  <NumField name="teachers_assistants" label="Ассистентов" />
                </div>
                <SectionHeader title="Демография" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <NumField name="teachers_under_35" label="Молодые (до 35 лет)" highlight
                    hint="Показатель устойчивости" />
                  <NumField name="teachers_above_60" label="Старше 60 лет" />
                  <NumField name="teachers_foreign" label="Иностранные" />
                  <NumField name="avg_teacher_age" label="Средний возраст" step="0.1" />
                  <NumField name="teacher_to_student_ratio" label="Препод : Студенты"
                    step="0.01" hint="Норма 1:10–15" highlight />
                </div>
              </>
            )}

            {tab === "specialties" && (
              <>
                <SectionHeader title="Образовательные программы" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <NumField name="specialties_total" label="Всего специальностей *" highlight />
                  <NumField name="specialties_bachelor" label="Бакалавриат" />
                  <NumField name="specialties_master" label="Магистратура" />
                  <NumField name="specialties_phd" label="Докторантура" />
                </div>
                <SectionHeader title="Аккредитация и международность" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <NumField name="specialties_accredited" label="С нац. аккредитацией" />
                  <NumField name="specialties_intl_accredited" label="С международной аккред." highlight
                    hint="ABET, ACCA, AACSB и т.д." />
                  <NumField name="dual_degree_programs" label="Двойные дипломы" />
                  <NumField name="english_programs" label="На английском языке" />
                  <NumField name="new_programs_launched" label="Новых в этом году" />
                </div>
              </>
            )}

            {tab === "academic" && (
              <>
                <SectionHeader title="Успеваемость" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <NumField name="avg_gpa" label="Средний GPA *" step="0.01" highlight
                    hint="0.00–4.00" />
                  <NumField name="gpa_above_3_5_count" label="С GPA выше 3.5" />
                  <NumField name="gpa_below_2_0_count" label="С GPA ниже 2.0" />
                  <PercentField name="retention_rate" label="Удержание (retention), %" highlight
                    hint="% продолживших обучение" />
                  <PercentField name="pass_rate_first_attempt" label="Сдача с 1 раза, %" />
                  <PercentField name="state_exam_pass_rate" label="Сдача итоговой госаттестации, %" />
                </div>
                <SectionHeader title="Отчисления" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <NumField name="expulsion_total" label="Всего отчислено" />
                  <NumField name="expulsion_academic" label="За неуспеваемость" />
                  <NumField name="expulsion_financial" label="За неоплату" />
                  <NumField name="expulsion_personal" label="По собственному желанию" />
                </div>
              </>
            )}

            {tab === "internships" && (
              <>
                <SectionHeader title="Практика и стажировки" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <NumField name="internship_partners_count" label="Баз практики" />
                  <NumField name="students_on_internship" label="Студентов на практике" />
                  <NumField name="students_internship_abroad" label="На стажировке за рубежом" highlight />
                  <NumField name="dual_education_count" label="Дуальное обучение" />
                </div>
                <SectionHeader title="Академическая мобильность" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <NumField name="academic_mobility_in" label="К нам на семестр (входящая)" />
                  <NumField name="academic_mobility_out" label="От нас на семестр (исходящая)" />
                </div>
              </>
            )}

            {tab === "olympiads" && (
              <>
                <SectionHeader title="Олимпиады и конкурсы" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <NumField name="olympiad_participants" label="Участников" />
                  <NumField name="olympiad_winners_intl" label="Победителей международных" highlight />
                  <NumField name="olympiad_winners_republic" label="Республиканских" />
                  <NumField name="olympiad_winners_regional" label="Региональных" />
                  <NumField name="competition_winners_total" label="Всего призёров конкурсов" />
                </div>
              </>
            )}

            {tab === "continuing" && (
              <>
                <SectionHeader title="Дополнительное образование"
                  hint="Курсы повышения квалификации, переподготовка, lifelong learning" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <NumField name="continuing_education_count" label="Слушателей доп. курсов" />
                  <NumField name="qualification_courses" label="Курсов повышения квал." />
                  <NumField name="retraining_programs" label="Программ переподготовки" />
                  <NumField name="certificates_issued" label="Сертификатов выдано" />
                </div>
              </>
            )}

            {tab === "infra" && (
              <>
                <SectionHeader title="Инфраструктура обучения" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <NumField name="classrooms_total" label="Всего аудиторий" />
                  <NumField name="computer_classrooms" label="Компьютерных классов" />
                  <NumField name="lab_classrooms" label="Лабораторий" />
                  <NumField name="library_books_count" label="Книг в библиотеке" />
                  <NumField name="library_electronic_resources" label="Эл. подписок" highlight />
                </div>
                <div className="mt-5">
                  <LmsPlatformField />
                </div>
              </>
            )}
          </fieldset>
        </div>
      </form>
    </FormProvider>
  );
}

// ─── Local — form chrome + LMS field ──────────────────────────────────────

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
            Сохранить
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

function LmsPlatformField() {
  const { register } = useFormContext();
  return (
    <Field label="LMS-платформа">
      <input {...register("lms_platform_used")} className="input"
        placeholder="Moodle / Canvas / Univer / другая" />
    </Field>
  );
}
