// src/features/contingent/ContingentForm.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Форма контингента студентов: 5 вкладок
//   • Основные показатели (численность, приём, отчисления)
//   • Уровни и формы (бакалавр/магистр/PhD, очно/дистанционно, бюджет/платное)
//   • Языки обучения
//   • Льготные категории
//   • Победители олимпиад (JSONB)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import { useForm, useFieldArray, FormProvider, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Save, Send, Loader2, AlertTriangle, Users } from "lucide-react";
import client from "@/api/client";
import { useAuth } from "@/auth/AuthContext";

// ═════════════════════════════════════════════════════════════════════════════
// ZOD SCHEMA
// ═════════════════════════════════════════════════════════════════════════════

const prizeWinnerSchema = z.object({
  event_type: z.string().min(2, "Укажите тип мероприятия"),
  level:      z.enum(["regional", "republican", "international"]),
  count:      z.coerce.number().int().min(0),
});

const contingentSchema = z.object({
  snapshot_date: z.string().min(1, "Дата обязательна"),

  total_count:  z.coerce.number().int().min(0).optional(),
  new_enrolled: z.coerce.number().int().min(0).optional(),
  withdrawn:    z.coerce.number().int().min(0).optional(),

  bachelor_count:  z.coerce.number().int().min(0).optional(),
  master_count:    z.coerce.number().int().min(0).optional(),
  phd_count:       z.coerce.number().int().min(0).optional(),
  full_time_count: z.coerce.number().int().min(0).optional(),
  distance_count:  z.coerce.number().int().min(0).optional(),
  budget_count:    z.coerce.number().int().min(0).optional(),
  paid_count:      z.coerce.number().int().min(0).optional(),

  kz_lang_count:    z.coerce.number().int().min(0).optional(),
  ru_lang_count:    z.coerce.number().int().min(0).optional(),
  en_lang_count:    z.coerce.number().int().min(0).optional(),
  other_lang_count: z.coerce.number().int().min(0).optional(),

  many_children_count:  z.coerce.number().int().min(0).optional(),
  low_income_count:     z.coerce.number().int().min(0).optional(),
  disabled_count:       z.coerce.number().int().min(0).optional(),
  orphan_count:         z.coerce.number().int().min(0).optional(),
  oop_count:            z.coerce.number().int().min(0).optional(),
  foreign_count:        z.coerce.number().int().min(0).optional(),
  privileged_share:     z.coerce.number().min(0).max(100).optional(),
  boarding_school_count:z.coerce.number().int().min(0).optional(),
  absences_count:       z.coerce.number().int().min(0).optional(),

  prize_winners_json: z.array(prizeWinnerSchema).default([]),
});

type ContingentFormData = z.infer<typeof contingentSchema>;

// ═════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════════

function NumField({ name, label, hint }: { name: string; label: string; hint?: string }) {
  const { register, formState: { errors } } = useFormContext<ContingentFormData>();
  const err = (errors as any)[name]?.message as string | undefined;
  return (
    <div className="flex flex-col gap-1">
      <label className="label-eyebrow">{label}</label>
      {hint && <p className="text-xs text-fc-steel-400 -mt-0.5">{hint}</p>}
      <input
        type="number"
        min={0}
        step={1}
        className={`input ${err ? "border-danger" : ""}`}
        {...register(name as any)}
      />
      {err && <p className="text-xs text-danger">{err}</p>}
    </div>
  );
}

function PercentField({ name, label }: { name: string; label: string }) {
  const { register, formState: { errors } } = useFormContext<ContingentFormData>();
  const err = (errors as any)[name]?.message as string | undefined;
  return (
    <div className="flex flex-col gap-1">
      <label className="label-eyebrow">{label}</label>
      <div className="relative">
        <input
          type="number"
          min={0}
          max={100}
          step={0.01}
          className={`input pr-7 ${err ? "border-danger" : ""}`}
          {...register(name as any)}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fc-steel-400 text-sm">%</span>
      </div>
      {err && <p className="text-xs text-danger">{err}</p>}
    </div>
  );
}

function DateField({ name, label }: { name: string; label: string }) {
  const { register, formState: { errors } } = useFormContext<ContingentFormData>();
  const err = (errors as any)[name]?.message as string | undefined;
  return (
    <div className="flex flex-col gap-1">
      <label className="label-eyebrow">{label}</label>
      <input
        type="date"
        className={`input ${err ? "border-danger" : ""}`}
        {...register(name as any)}
      />
      {err && <p className="text-xs text-danger">{err}</p>}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="col-span-full border-b border-slate-100 pb-1 mb-1">
      <span className="label-eyebrow text-fc-navy-700">{title}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft:        "pill bg-slate-100 text-slate-600",
    submitted:    "pill bg-fc-blue-100 text-fc-blue-700",
    under_review: "pill bg-amber-100 text-amber-700",
    approved:     "pill bg-success/10 text-success",
    rejected:     "pill bg-danger/10 text-danger",
  };
  const labels: Record<string, string> = {
    draft: "Черновик", submitted: "На согласовании",
    under_review: "На проверке", approved: "Утверждено", rejected: "Отклонено",
  };
  return <span className={map[status] ?? "pill bg-slate-100 text-slate-600"}>{labels[status] ?? status}</span>;
}

// ═════════════════════════════════════════════════════════════════════════════
// TABS
// ═════════════════════════════════════════════════════════════════════════════

const TABS = [
  { id: "core",       label: "Основные" },
  { id: "levels",     label: "Уровни и формы" },
  { id: "languages",  label: "Языки" },
  { id: "privileged", label: "Льготники" },
  { id: "olympiads",  label: "Олимпиады" },
];

function CoreTab() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <SectionHeader title="Ключевые показатели" />
      <DateField name="snapshot_date" label="Дата среза" />
      <NumField name="total_count"  label="Всего студентов"  hint="Общая численность на дату среза" />
      <NumField name="new_enrolled" label="Принято"          hint="Вновь зачисленных" />
      <NumField name="withdrawn"    label="Отчислено"        hint="За период" />
      <NumField name="absences_count" label="Пропуски (дни)" />
    </div>
  );
}

function LevelsTab() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <SectionHeader title="По уровню образования" />
      <NumField name="bachelor_count" label="Бакалавриат" />
      <NumField name="master_count"   label="Магистратура" />
      <NumField name="phd_count"      label="Докторантура (PhD)" />

      <SectionHeader title="По форме обучения" />
      <NumField name="full_time_count" label="Очная форма" />
      <NumField name="distance_count"  label="Дистанционная / заочная" />

      <SectionHeader title="По источнику финансирования" />
      <NumField name="budget_count" label="Государственный грант" />
      <NumField name="paid_count"   label="Платная основа" />
      <NumField name="boarding_school_count" label="Интернат / общежитие" />
    </div>
  );
}

function LanguagesTab() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <SectionHeader title="Язык обучения" />
      <NumField name="kz_lang_count"    label="Казахский язык" />
      <NumField name="ru_lang_count"    label="Русский язык" />
      <NumField name="en_lang_count"    label="Английский язык" />
      <NumField name="other_lang_count" label="Другие языки" />
    </div>
  );
}

function PrivilegedTab() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <SectionHeader title="Льготные категории" />
      <NumField name="many_children_count" label="Из многодетных семей" />
      <NumField name="low_income_count"    label="Малообеспеченные" />
      <NumField name="disabled_count"      label="Студенты с ОВЗ" />
      <NumField name="orphan_count"        label="Сироты и приравненные" />
      <NumField name="oop_count"           label="ООП (особые образовательные потребности)" />
      <NumField name="foreign_count"       label="Иностранные студенты" />
      <PercentField name="privileged_share" label="Доля льготников, %" />
    </div>
  );
}

function OlympiadsTab() {
  const { control, register } = useFormContext<ContingentFormData>();
  const { fields, append, remove } = useFieldArray({ control, name: "prize_winners_json" });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="label-eyebrow text-fc-navy-700">Победители олимпиад и конкурсов</span>
        <button type="button" className="btn-secondary text-xs"
          onClick={() => append({ event_type: "", level: "regional", count: 0 })}>
          <Plus className="w-3.5 h-3.5" /> Добавить
        </button>
      </div>

      {fields.length === 0 && (
        <div className="text-center py-8 text-fc-steel-400 text-sm">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Нет данных о победителях. Нажмите «Добавить» для ввода.
        </div>
      )}

      {fields.map((field, idx) => (
        <div key={field.id} className="card p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="label-eyebrow">Тип мероприятия</label>
            <input
              className="input"
              placeholder="Олимпиада / конкурс / чемпионат"
              {...register(`prize_winners_json.${idx}.event_type`)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="label-eyebrow">Уровень</label>
            <select className="input" {...register(`prize_winners_json.${idx}.level`)}>
              <option value="regional">Региональный</option>
              <option value="republican">Республиканский</option>
              <option value="international">Международный</option>
            </select>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex flex-col gap-1 flex-1">
              <label className="label-eyebrow">Количество</label>
              <input
                type="number"
                min={0}
                className="input"
                {...register(`prize_winners_json.${idx}.count`)}
              />
            </div>
            <button type="button" onClick={() => remove(idx)}
              className="btn-danger mb-0 p-2 shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function ContingentForm({ recordId, orgId: propOrgId }: { recordId?: string; orgId?: string }) {
  const { user } = useAuth();
  const orgId = propOrgId ?? user?.org_id;
  const [tab, setTab] = useState("core");
  const [status, setStatus] = useState("draft");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const methods = useForm<ContingentFormData>({
    resolver: zodResolver(contingentSchema),
    defaultValues: {
      snapshot_date: new Date().toISOString().slice(0, 10),
      prize_winners_json: [],
    },
  });

  const { handleSubmit, reset, formState: { isDirty } } = methods;

  // Load existing record
  useEffect(() => {
    if (!orgId || !recordId) return;
    client.get(`/organisations/${orgId}/contingent/${recordId}`)
      .then(r => {
        const d = r.data as any;
        setStatus(d.submission_status ?? "draft");
        reset({
          ...d,
          snapshot_date: d.snapshot_date ?? "",
          prize_winners_json: d.prize_winners_json ?? [],
        });
      })
      .catch(() => setError("Не удалось загрузить запись"));
  }, [orgId, recordId, reset]);

  const isReadOnly = status === "submitted" || status === "under_review" || status === "approved";

  const doSave = useCallback(async (data: ContingentFormData) => {
    if (!orgId) { setError("Организация не выбрана"); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...data,
        total_count:  data.total_count  ?? null,
        new_enrolled: data.new_enrolled ?? null,
        withdrawn:    data.withdrawn    ?? null,
      };
      if (recordId) {
        await client.patch(`/organisations/${orgId}/contingent/${recordId}`, payload);
      } else {
        await client.post(`/organisations/${orgId}/contingent`, payload);
      }
      setLastSaved(new Date());
      setStatus("draft");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }, [orgId, recordId]);

  const doSubmit = useCallback(async (data: ContingentFormData) => {
    if (!orgId) { setError("Организация не выбрана"); return; }
    setSubmitting(true);
    setError(null);
    try {
      if (!recordId) {
        const res = await client.post<any>(`/organisations/${orgId}/contingent`, data);
        const newId = res.data.id;
        await client.patch(`/organisations/${orgId}/contingent/${newId}/status`, { status: "submitted" });
      } else {
        await client.patch(`/organisations/${orgId}/contingent/${recordId}`, data);
        await client.patch(`/organisations/${orgId}/contingent/${recordId}/status`, { status: "submitted" });
      }
      setStatus("submitted");
      setLastSaved(new Date());
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Ошибка отправки");
    } finally {
      setSubmitting(false);
    }
  }, [orgId, recordId]);

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(doSave)} noValidate>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <StatusPill status={status} />
            {lastSaved && (
              <span className="text-xs text-fc-steel-400">
                Сохранено {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>
          {!isReadOnly && (
            <div className="flex gap-2">
              <button type="submit" className="btn-secondary" disabled={saving || !isDirty}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Сохранить
              </button>
              <button type="button" className="btn-primary"
                disabled={submitting}
                onClick={handleSubmit(doSubmit)}>
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                На согласование
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 text-sm text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-md overflow-x-auto scrollbar-thin">
          {TABS.map(t => (
            <button key={t.id} type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
                tab === t.id
                  ? "bg-fc-navy-700 text-white shadow-fc-sm"
                  : "text-fc-steel-600 hover:text-fc-navy-900"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <fieldset disabled={isReadOnly} className="card p-4 md:p-6">
          {tab === "core"       && <CoreTab />}
          {tab === "levels"     && <LevelsTab />}
          {tab === "languages"  && <LanguagesTab />}
          {tab === "privileged" && <PrivilegedTab />}
          {tab === "olympiads"  && <OlympiadsTab />}
        </fieldset>
      </form>
    </FormProvider>
  );
}
