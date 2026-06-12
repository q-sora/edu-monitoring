// src/features/finance/FinanceForm.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Эталонная форма финансов.
// 13 вкладок ≈ 100 полей, JSONB grants_json репитер.
// КЛЮЧЕВОЙ ИНСТРУМЕНТ ПРОЗРАЧНОСТИ финансирования образования.
//
// Особенности:
//   • Все денежные поля форматируются с пробелами (1 234 567 ₸)
//   • Live-расчёт коэффициентов: расходы/студент, ФОТ/бюджет, % гос.финанс.
//   • Cross-check сумм по секциям (бюджет = сумма всех источников)
//   • Tooltips на ключевых полях с объяснением для оператора
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import {
  useForm, useFieldArray, FormProvider, useFormContext,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Trash2, Save, Send, Check, AlertTriangle, Loader2,
  Calculator, TrendingUp, TrendingDown,
} from "lucide-react";
import client from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import {
  NumField, MoneyField, PercentField, DateField, TextField, SelectField,
  SectionHeader, StatusBadge, ErrorBox,
} from "@/components/ui";

// ═════════════════════════════════════════════════════════════════════════════
// ZOD SCHEMA
// ═════════════════════════════════════════════════════════════════════════════

const grantSchema = z.object({
  name:       z.string().min(2, "Название обязательно"),
  amount:     z.coerce.number().min(0),
  source:     z.string().min(2, "Укажите источник"),
  start_date: z.string().optional(),
  end_date:   z.string().optional(),
  status:     z.enum(["active", "completed", "suspended"]).default("active"),
  leader:     z.string().optional(),
});

const financeSchema = z.object({
  period_year:    z.coerce.number().int().min(2015).max(2035),
  period_quarter: z.coerce.number().int().min(1).max(4).optional().nullable(),
  report_date:    z.string().optional(),
  currency_code:  z.string().default("KZT"),
  exchange_rate:  z.coerce.number().min(0).optional(),

  // Доходы
  budget_total:               z.coerce.number().min(0).optional(),
  budget_state_grant:         z.coerce.number().min(0).optional(),
  budget_target_funding:      z.coerce.number().min(0).optional(),
  budget_capital_investment:  z.coerce.number().min(0).optional(),
  budget_research_subsidy:    z.coerce.number().min(0).optional(),
  budget_social_program:      z.coerce.number().min(0).optional(),

  paid_tuition_total:    z.coerce.number().min(0).optional(),
  paid_tuition_bachelor: z.coerce.number().min(0).optional(),
  paid_tuition_master:   z.coerce.number().min(0).optional(),
  paid_tuition_phd:      z.coerce.number().min(0).optional(),
  paid_tuition_foreign:  z.coerce.number().min(0).optional(),
  paid_tuition_avg_cost: z.coerce.number().min(0).optional(),

  research_grants_total:      z.coerce.number().min(0).optional(),
  research_grants_count:      z.coerce.number().int().min(0).optional(),
  international_grants:       z.coerce.number().min(0).optional(),
  international_grants_count: z.coerce.number().int().min(0).optional(),
  commercial_contracts:       z.coerce.number().min(0).optional(),
  commercial_contracts_count: z.coerce.number().int().min(0).optional(),
  grants_json:                z.array(grantSchema).default([]),

  endowment_balance:     z.coerce.number().min(0).optional(),
  endowment_income:      z.coerce.number().min(0).optional(),
  donations_total:       z.coerce.number().min(0).optional(),
  alumni_donations:      z.coerce.number().min(0).optional(),
  corporate_sponsorship: z.coerce.number().min(0).optional(),

  rent_income:        z.coerce.number().min(0).optional(),
  hostel_income:      z.coerce.number().min(0).optional(),
  service_income:     z.coerce.number().min(0).optional(),
  publication_income: z.coerce.number().min(0).optional(),
  other_income:       z.coerce.number().min(0).optional(),
  total_income:       z.coerce.number().min(0).optional(),

  // Расходы
  salary_fund_total:     z.coerce.number().min(0).optional(),
  salary_teaching_staff: z.coerce.number().min(0).optional(),
  salary_administrative: z.coerce.number().min(0).optional(),
  salary_research_staff: z.coerce.number().min(0).optional(),
  salary_support_staff:  z.coerce.number().min(0).optional(),
  social_tax:            z.coerce.number().min(0).optional(),
  bonuses_total:         z.coerce.number().min(0).optional(),
  avg_salary_teaching:   z.coerce.number().min(0).optional(),
  avg_salary_research:   z.coerce.number().min(0).optional(),

  capex_total:        z.coerce.number().min(0).optional(),
  capex_construction: z.coerce.number().min(0).optional(),
  capex_equipment:    z.coerce.number().min(0).optional(),
  capex_it_systems:   z.coerce.number().min(0).optional(),
  capex_library:      z.coerce.number().min(0).optional(),
  capex_laboratory:   z.coerce.number().min(0).optional(),

  opex_utilities:   z.coerce.number().min(0).optional(),
  opex_maintenance: z.coerce.number().min(0).optional(),
  opex_consumables: z.coerce.number().min(0).optional(),
  opex_travel:      z.coerce.number().min(0).optional(),
  opex_advertising: z.coerce.number().min(0).optional(),
  opex_other:       z.coerce.number().min(0).optional(),

  scholarship_total:  z.coerce.number().min(0).optional(),
  scholarship_state:  z.coerce.number().min(0).optional(),
  scholarship_named:  z.coerce.number().min(0).optional(),
  scholarship_social: z.coerce.number().min(0).optional(),
  hostel_subsidy:     z.coerce.number().min(0).optional(),
  food_subsidy:       z.coerce.number().min(0).optional(),
  travel_subsidy:     z.coerce.number().min(0).optional(),

  research_expenses:      z.coerce.number().min(0).optional(),
  conference_expenses:    z.coerce.number().min(0).optional(),
  publication_expenses:   z.coerce.number().min(0).optional(),
  international_mobility: z.coerce.number().min(0).optional(),
  partnership_fees:       z.coerce.number().min(0).optional(),
  total_expenses:         z.coerce.number().min(0).optional(),

  cost_per_student:        z.coerce.number().min(0).optional(),
  fot_to_budget_ratio:     z.coerce.number().min(0).max(200).optional(),
  state_funding_ratio:     z.coerce.number().min(0).max(100).optional(),
  commercial_ratio:        z.coerce.number().min(0).max(100).optional(),
  research_to_total_ratio: z.coerce.number().min(0).max(100).optional(),

  audit_passed:          z.coerce.boolean().optional(),
  audit_company:         z.string().optional(),
  audit_date:            z.string().optional(),
  budget_execution_pct:  z.coerce.number().min(0).max(200).optional(),
  deficit_amount:        z.coerce.number().optional(),
  reserve_fund:          z.coerce.number().min(0).optional(),
});

type FinanceForm = z.infer<typeof financeSchema>;

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function FinanceForm({ recordId, orgId: propOrgId }: { recordId?: string; orgId?: string }) {
  const { user } = useAuth();
  const orgId = propOrgId ?? user?.org_id;
  const [tab, setTab] = useState("general");
  const [status, setStatus] = useState("draft");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const methods = useForm<FinanceForm>({
    resolver: zodResolver(financeSchema),
    defaultValues: {
      period_year: new Date().getFullYear(),
      currency_code: "KZT",
      grants_json: [],
    },
  });

  useEffect(() => {
    if (!recordId || !orgId) return;
    (async () => {
      try {
        const { data } = await client.get(`/organisations/${orgId}/finance/${recordId}`);
        methods.reset(data);
        setStatus(data.submission_status ?? "draft");
      } catch (e: any) {
        setError(e?.response?.data?.detail ?? "Не удалось загрузить запись");
      }
    })();
  }, [recordId, orgId, methods]);

  const saveDraft = useCallback(async (values: FinanceForm) => {
    if (!orgId) return;
    setSaving(true);
    setError(null);
    try {
      if (recordId) {
        await client.patch(`/organisations/${orgId}/finance/${recordId}`, values);
      } else {
        await client.post(`/organisations/${orgId}/finance`, values);
      }
      setLastSaved(new Date());
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }, [orgId, recordId]);

  const submitForApproval = async () => {
    if (!orgId || !recordId) {
      setError("Сначала сохраните черновик");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await client.patch(`/organisations/${orgId}/finance/${recordId}/status`, {
        new_status: "submitted",
        comment: "Отправлено на согласование из формы",
      });
      setStatus("submitted");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Ошибка отправки");
    } finally {
      setSubmitting(false);
    }
  };

  const isReadOnly = ["approved", "submitted", "under_review"].includes(status);

  const tabs = [
    { id: "general",       label: "Общие",                count: 5  },
    { id: "income_budget", label: "Бюджет",               count: 6, group: "Доходы" },
    { id: "income_paid",   label: "Платное обуч.",        count: 6, group: "Доходы" },
    { id: "income_grants", label: "Гранты",               count: "∞", group: "Доходы" },
    { id: "income_endow",  label: "Эндаумент",            count: 5, group: "Доходы" },
    { id: "income_other",  label: "Прочие доходы",        count: 6, group: "Доходы" },
    { id: "expense_fot",   label: "ФОТ",                  count: 9, group: "Расходы" },
    { id: "expense_capex", label: "Капвложения",          count: 6, group: "Расходы" },
    { id: "expense_opex",  label: "Операционные",         count: 6, group: "Расходы" },
    { id: "expense_stud",  label: "Студенч. поддержка",   count: 7, group: "Расходы" },
    { id: "expense_sci",   label: "Наука/международ.",    count: 6, group: "Расходы" },
    { id: "ratios",        label: "Коэффициенты",         count: 5, group: "Аналитика" },
    { id: "audit",         label: "Аудит",                count: 6, group: "Контроль" },
  ];

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(saveDraft)}>
        {/* Status bar */}
        <div className="card p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusBadge status={status} />
            {lastSaved && (
              <span className="text-xs text-fc-steel-500">
                Сохранено: {lastSaved.toLocaleTimeString("ru-RU")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isReadOnly && (
              <>
                <button type="submit" disabled={saving} className="btn-ghost">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Сохранить черновик
                </button>
                <button type="button" onClick={submitForApproval} disabled={submitting || !recordId}
                  title={!recordId ? "Сначала сохраните" : ""}
                  className="btn-primary">
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  На согласование
                </button>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorBox message={error} />
          </div>
        )}

        {/* Tabs */}
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 overflow-x-auto scrollbar-thin">
            <div className="flex gap-0.5 p-1.5 min-w-max">
              {tabs.map(t => (
                <button key={t.id} type="button" onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    tab === t.id ? "bg-fc-navy-700 text-white" : "text-fc-steel-600 hover:bg-slate-100"
                  }`}>
                  {t.label}
                  <span className={`text-[10px] px-1 rounded ${tab === t.id ? "bg-white/20" : "bg-slate-200 text-fc-steel-700"}`}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <fieldset disabled={isReadOnly} className="p-6 disabled:opacity-60">
            {tab === "general"       && <GeneralTab />}
            {tab === "income_budget" && <BudgetTab />}
            {tab === "income_paid"   && <PaidTuitionTab />}
            {tab === "income_grants" && <GrantsTab />}
            {tab === "income_endow"  && <EndowmentTab />}
            {tab === "income_other"  && <OtherIncomeTab />}
            {tab === "expense_fot"   && <FotTab />}
            {tab === "expense_capex" && <CapexTab />}
            {tab === "expense_opex"  && <OpexTab />}
            {tab === "expense_stud"  && <StudentSupportTab />}
            {tab === "expense_sci"   && <ScienceExpenseTab />}
            {tab === "ratios"        && <RatiosTab />}
            {tab === "audit"         && <AuditTab />}
          </fieldset>
        </div>
      </form>
    </FormProvider>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// TABS
// ═════════════════════════════════════════════════════════════════════════════

function GeneralTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <NumField name="period_year" label="Отчётный год *" />
      <NumField name="period_quarter" label="Квартал (1–4 или пусто)" placeholder="оставьте пустым для года" />
      <DateField name="report_date" label="Дата отчёта" />
      <SelectField name="currency_code" label="Валюта"
        options={[{value:"KZT",label:"Тенге"},{value:"USD",label:"USD"},{value:"EUR",label:"EUR"}]} />
      <MoneyField name="exchange_rate" label="Курс к KZT" hint="Например 480.50 — для конвертации международных грантов" />
    </div>
  );
}

function BudgetTab() {
  return (
    <>
      <SectionHeader title="Доходы из государственного бюджета"
        hint="Деньги, поступающие через Министерство финансов и подведомственные организации" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MoneyField name="budget_total" label="Всего из бюджета *" highlight />
        <MoneyField name="budget_state_grant" label="Образовательный гос. грант"
          hint="Финансирование под государственные образовательные гранты студентов" />
        <MoneyField name="budget_target_funding" label="Целевое финансирование" />
        <MoneyField name="budget_capital_investment" label="Капитальные вложения"
          hint="Стройка, ремонт, оборудование из бюджета" />
        <MoneyField name="budget_research_subsidy" label="Субсидии на науку" />
        <MoneyField name="budget_social_program" label="Социальные программы"
          hint="Стипендии, льготы, поддержка социально уязвимых" />
      </div>

      <SectionTotalCheck
        title="Сумма по статьям бюджета должна совпадать с «Всего из бюджета»"
        totalField="budget_total"
        sumFields={[
          "budget_state_grant", "budget_target_funding", "budget_capital_investment",
          "budget_research_subsidy", "budget_social_program",
        ]}
      />
    </>
  );
}

function PaidTuitionTab() {
  return (
    <>
      <SectionHeader title="Доходы от платного обучения" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MoneyField name="paid_tuition_total" label="Платное обучение всего *" highlight />
        <MoneyField name="paid_tuition_bachelor" label="Бакалавриат" />
        <MoneyField name="paid_tuition_master" label="Магистратура" />
        <MoneyField name="paid_tuition_phd" label="Докторантура (PhD)" />
        <MoneyField name="paid_tuition_foreign" label="От иностранных студентов" />
        <MoneyField name="paid_tuition_avg_cost" label="Средняя стоимость обучения / год"
          hint="Тенге за один учебный год" />
      </div>
    </>
  );
}

function GrantsTab() {
  const { control, register } = useFormContext<FinanceForm>();
  const { fields, append, remove } = useFieldArray({ control, name: "grants_json" });

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <MoneyField name="research_grants_total" label="Гранты на исследования" />
        <NumField name="research_grants_count" label="Количество грантов" />
        <MoneyField name="international_grants" label="Международные гранты" />
        <NumField name="international_grants_count" label="Кол-во международных" />
        <MoneyField name="commercial_contracts" label="Коммерческие договоры" />
        <NumField name="commercial_contracts_count" label="Кол-во договоров" />
      </div>

      <div className="border-t border-slate-200 pt-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-display font-bold text-fc-navy-900">Реестр грантов и контрактов</p>
            <p className="text-xs text-fc-steel-500">Подробная разбивка по каждому гранту</p>
          </div>
          <button type="button"
            onClick={() => append({
              name: "", amount: 0, source: "", status: "active",
              start_date: "", end_date: "", leader: "",
            })}
            className="btn-primary btn-sm">
            <Plus className="w-3 h-3" /> Добавить грант
          </button>
        </div>

        {fields.length === 0 && (
          <p className="text-center text-sm text-fc-steel-400 py-6">
            Список пуст. Добавьте записи для каждого крупного гранта.
          </p>
        )}

        <div className="space-y-3">
          {fields.map((f, idx) => (
            <div key={f.id} className="p-3 border border-slate-200 rounded-lg bg-slate-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input {...register(`grants_json.${idx}.name`)}
                  placeholder="Название гранта" className="input md:col-span-2" />
                <input {...register(`grants_json.${idx}.source`)}
                  placeholder="Источник (ФЦ, EU, NIH, БРК)" className="input" />
                <input {...register(`grants_json.${idx}.amount`)}
                  type="number" placeholder="Сумма (тенге)" className="input text-right" />
                <input {...register(`grants_json.${idx}.start_date`)}
                  type="date" placeholder="Начало" className="input" />
                <input {...register(`grants_json.${idx}.end_date`)}
                  type="date" placeholder="Окончание" className="input" />
                <input {...register(`grants_json.${idx}.leader`)}
                  placeholder="Руководитель проекта" className="input" />
                <select {...register(`grants_json.${idx}.status`)} className="input">
                  <option value="active">Активный</option>
                  <option value="completed">Завершён</option>
                  <option value="suspended">Приостановлен</option>
                </select>
              </div>
              <div className="flex justify-end mt-2">
                <button type="button" onClick={() => remove(idx)}
                  className="text-xs text-danger hover:underline flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Удалить грант
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function EndowmentTab() {
  return (
    <>
      <SectionHeader title="Эндаумент и частные источники"
        hint="Долгосрочные фонды, благотворительность, корпоративная поддержка" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MoneyField name="endowment_balance" label="Баланс эндаумента на конец периода" />
        <MoneyField name="endowment_income" label="Доход от эндаумента за период" />
        <MoneyField name="donations_total" label="Благотворительные взносы" />
        <MoneyField name="alumni_donations" label="От выпускников"
          hint="Показатель связи с выпускниками — важная метрика международных рейтингов" />
        <MoneyField name="corporate_sponsorship" label="Корпоративное спонсорство" />
      </div>
    </>
  );
}

function OtherIncomeTab() {
  return (
    <>
      <SectionHeader title="Прочие доходы и итог" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MoneyField name="rent_income" label="Сдача помещений в аренду" />
        <MoneyField name="hostel_income" label="Доход от общежитий" />
        <MoneyField name="service_income" label="Платные услуги" />
        <MoneyField name="publication_income" label="Издательская деятельность" />
        <MoneyField name="other_income" label="Прочие доходы" />
        <MoneyField name="total_income" label="ИТОГО ДОХОДОВ *" highlight
          hint="Сумма всех источников: бюджет + платное + гранты + эндаумент + прочие" />
      </div>
    </>
  );
}

function FotTab() {
  return (
    <>
      <SectionHeader title="Фонд оплаты труда (ФОТ)"
        hint="Один из ключевых показателей эффективности — норма ФОТ от бюджета 50–65%" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MoneyField name="salary_fund_total" label="ФОТ всего *" highlight />
        <MoneyField name="salary_teaching_staff" label="Преподавательский состав" />
        <MoneyField name="salary_administrative" label="Административно-управленческий" />
        <MoneyField name="salary_research_staff" label="Научные сотрудники" />
        <MoneyField name="salary_support_staff" label="Технический персонал" />
        <MoneyField name="social_tax" label="Социальный налог + отчисления" />
        <MoneyField name="bonuses_total" label="Премии всего" />
        <MoneyField name="avg_salary_teaching" label="Средняя зарплата преподавателя"
          hint="В месяц, чистая на руки" />
        <MoneyField name="avg_salary_research" label="Средняя зарплата научного сотрудника" />
      </div>

      <SectionTotalCheck
        title="ФОТ по категориям"
        totalField="salary_fund_total"
        sumFields={["salary_teaching_staff", "salary_administrative", "salary_research_staff", "salary_support_staff"]}
      />
    </>
  );
}

function CapexTab() {
  return (
    <>
      <SectionHeader title="Капитальные вложения" hint="Долгосрочные инвестиции в инфраструктуру" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MoneyField name="capex_total" label="Капвложения всего *" highlight />
        <MoneyField name="capex_construction" label="Строительство и ремонт" />
        <MoneyField name="capex_equipment" label="Оборудование" />
        <MoneyField name="capex_it_systems" label="IT-инфраструктура"
          hint="Серверы, сети, программное обеспечение" />
        <MoneyField name="capex_library" label="Библиотечный фонд" />
        <MoneyField name="capex_laboratory" label="Лабораторное оборудование" />
      </div>

      <SectionTotalCheck
        title="Капвложения по категориям"
        totalField="capex_total"
        sumFields={["capex_construction", "capex_equipment", "capex_it_systems", "capex_library", "capex_laboratory"]}
      />
    </>
  );
}

function OpexTab() {
  return (
    <>
      <SectionHeader title="Операционные расходы" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MoneyField name="opex_utilities" label="Коммунальные услуги" />
        <MoneyField name="opex_maintenance" label="Содержание зданий" />
        <MoneyField name="opex_consumables" label="Расходные материалы" />
        <MoneyField name="opex_travel" label="Командировочные расходы" />
        <MoneyField name="opex_advertising" label="Маркетинг и реклама" />
        <MoneyField name="opex_other" label="Прочие операционные" />
      </div>
    </>
  );
}

function StudentSupportTab() {
  return (
    <>
      <SectionHeader title="Студенческая поддержка"
        hint="Стипендии, субсидии, льготы — социальная функция образования" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MoneyField name="scholarship_total" label="Стипендии всего *" highlight />
        <MoneyField name="scholarship_state" label="Государственная стипендия" />
        <MoneyField name="scholarship_named" label="Именные стипендии" />
        <MoneyField name="scholarship_social" label="Социальная стипендия"
          hint="Малообеспеченные, сироты, многодетные" />
        <MoneyField name="hostel_subsidy" label="Субсидии на общежитие" />
        <MoneyField name="food_subsidy" label="Субсидии на питание" />
        <MoneyField name="travel_subsidy" label="Транспортные льготы" />
      </div>
    </>
  );
}

function ScienceExpenseTab() {
  return (
    <>
      <SectionHeader title="Расходы на науку и международную деятельность" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MoneyField name="research_expenses" label="Расходы на научную деятельность" />
        <MoneyField name="conference_expenses" label="Конференции и семинары" />
        <MoneyField name="publication_expenses" label="Публикации (Open Access, перевод)" />
        <MoneyField name="international_mobility" label="Международная мобильность" />
        <MoneyField name="partnership_fees" label="Членские взносы в ассоциациях" />
        <MoneyField name="total_expenses" label="ИТОГО РАСХОДОВ *" highlight />
      </div>
    </>
  );
}

function RatiosTab() {
  const { watch, setValue } = useFormContext<FinanceForm>();

  // Auto-calculate from other fields
  const calculate = () => {
    const totalIncome = Number(watch("total_income") ?? 0);
    const budget = Number(watch("budget_total") ?? 0);
    const paid = Number(watch("paid_tuition_total") ?? 0);
    const grants = Number(watch("research_grants_total") ?? 0);
    const fot = Number(watch("salary_fund_total") ?? 0);
    const totalExp = Number(watch("total_expenses") ?? 0);
    const research = Number(watch("research_expenses") ?? 0);

    if (totalIncome > 0) {
      setValue("state_funding_ratio", Math.round((budget / totalIncome) * 10000) / 100);
      setValue("commercial_ratio", Math.round(((paid + grants) / totalIncome) * 10000) / 100);
    }
    if (totalExp > 0) {
      setValue("fot_to_budget_ratio", Math.round((fot / totalExp) * 10000) / 100);
      setValue("research_to_total_ratio", Math.round((research / totalExp) * 10000) / 100);
    }
  };

  return (
    <>
      <div className="card p-4 mb-5 bg-fc-navy-50 border-fc-navy-200">
        <div className="flex items-start gap-3">
          <Calculator className="w-5 h-5 text-fc-navy-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-sm text-fc-navy-900">Ключевые показатели прозрачности</p>
            <p className="text-xs text-fc-steel-700 mt-1">
              Эти коэффициенты используются для сравнительного анализа эффективности расходования средств.
              Можно ввести вручную или рассчитать автоматически из заполненных полей.
            </p>
            <button type="button" onClick={calculate}
              className="btn-secondary btn-sm mt-3">
              <Calculator className="w-3.5 h-3.5" /> Рассчитать автоматически
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PercentField name="cost_per_student" label="Расходы на студента (тенге/год)"
          hint="ГЛАВНЫЙ показатель эффективности" highlight />
        <PercentField name="fot_to_budget_ratio" label="ФОТ от бюджета, %"
          hint="Норма 50–65%" />
        <PercentField name="state_funding_ratio" label="Доля гос. финансирования, %"
          hint="Зависимость от бюджета" />
        <PercentField name="commercial_ratio" label="Доля коммерческих доходов, %"
          hint="Платное обучение + гранты" />
        <PercentField name="research_to_total_ratio" label="Расходы на науку, %"
          hint="Норма для исследовательских ВУЗов 15–25%" />
      </div>
    </>
  );
}

function AuditTab() {
  return (
    <>
      <SectionHeader title="Аудит и контроль исполнения" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SelectField name="audit_passed" label="Аудит пройден"
          options={[{value:"true",label:"Да"},{value:"false",label:"Нет"}]} />
        <TextField name="audit_company" label="Аудиторская компания" />
        <DateField name="audit_date" label="Дата аудита" />
        <PercentField name="budget_execution_pct" label="Исполнение бюджета, %"
          hint="100% = идеально, &lt;90% = недоосвоение, &gt;100% = перерасход" />
        <MoneyField name="deficit_amount" label="Дефицит / профицит"
          hint="Может быть отрицательным (дефицит)" />
        <MoneyField name="reserve_fund" label="Резервный фонд" />
      </div>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LOCAL HELPER — sum/total reconciliation (form-specific, не выносим в ui)
// ═════════════════════════════════════════════════════════════════════════════

function SectionTotalCheck({
  title, totalField, sumFields,
}: { title: string; totalField: string; sumFields: string[] }) {
  const { watch } = useFormContext<FinanceForm>();
  const total = Number(watch(totalField as any) ?? 0);
  const sum = sumFields.reduce((acc, f) => acc + Number(watch(f as any) ?? 0), 0);
  const diff = total - sum;
  const mismatch = total > 0 && Math.abs(diff) > 0.01;

  if (total === 0 && sum === 0) return null;

  return (
    <div className={`mt-5 rounded-md p-3 text-xs flex items-center justify-between border ${
      mismatch
        ? "bg-warning/10 border-warning/20 text-warning"
        : "bg-success/10 border-success/20 text-success"
    }`}>
      <span className="flex items-center gap-2">
        {mismatch ? <AlertTriangle className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
        <span>{title}: сумма <b className="tabular-nums">{sum.toLocaleString("ru-RU")}</b>, всего <b className="tabular-nums">{total.toLocaleString("ru-RU")}</b></span>
      </span>
      {mismatch && (
        <span className="font-bold flex items-center gap-1 tabular-nums">
          {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(diff).toLocaleString("ru-RU")} ₸
        </span>
      )}
    </div>
  );
}
