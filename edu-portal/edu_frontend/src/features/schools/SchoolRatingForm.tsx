/**
 * SchoolRatingForm.tsx — Модуль рейтинга школ для АО «Финансовый центр».
 * Сбор данных по 7 блокам (А-Ж) с живым расчётом.
 */

import React, { useState, useMemo, useEffect } from "react";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  ChevronDown, Save, Send, CheckCircle2, AlertCircle, 
  BarChart3, School, Users, GraduationCap, Briefcase, 
  Coins, Trophy, Sparkles, HelpCircle, Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { 
  NumField, TextField, SectionHeader, StatusBadge, 
  PageHeader, ErrorBox, SuccessBox, Modal
} from "@/components/ui";
import { calculateSchoolRatingClient, SchoolRatingData } from "./ratingLogic";
import client from "@/api/client";
import { useAuth } from "@/auth/AuthContext";

// --- Schema ---
const schoolRatingSchema = z.object({
  academic_year: z.coerce.number().int().min(2020).max(2030),
  
  // Блок А
  repair_current: z.boolean().default(false),
  repair_not_needed: z.boolean().default(false),
  repair_capital_done: z.boolean().default(false),
  repair_capital_needed: z.boolean().default(false),
  repair_current_needed: z.boolean().default(false),
  has_sports_facility: z.boolean().default(false),
  has_extended_day: z.boolean().default(false),
  has_school_bus: z.boolean().default(false),

  // Блок Б
  design_capacity: z.coerce.number().min(1, "Мощность должна быть > 0").default(1),
  enrolled_students: z.coerce.number().min(0).default(0),

  // Блок В
  accreditation_passed: z.boolean().default(false),
  accreditation_attempt: z.coerce.number().int().min(1).max(2).default(1),
  ent_average_score: z.coerce.number().min(0).max(140).default(0),
  academic_performance_pct: z.coerce.number().min(0).max(100).default(0),
  knowledge_quality_pct: z.coerce.number().min(0).max(100).default(0),

  // Блок Г
  teachers_total: z.coerce.number().min(0).default(0),
  teachers_high_category: z.coerce.number().min(0).default(0),
  teachers_with_degree: z.coerce.number().min(0).default(0),
  teachers_best_teacher_award: z.coerce.number().min(0).default(0),
  teachers_trained_abroad: z.coerce.number().min(0).default(0),
  teachers_from_industry: z.coerce.number().min(0).default(0),

  // Блок Д
  olympiad_winners_republican: z.coerce.number().min(0).default(0),
  olympiad_winners_international: z.coerce.number().min(0).default(0),
  sport_achievements: z.coerce.number().min(0).default(0),
  creative_achievements: z.coerce.number().min(0).default(0),

  // Блок Е
  graduates_total: z.coerce.number().min(0).default(0),
  graduates_enrolled_university: z.coerce.number().min(0).default(0),
  graduates_enrolled_by_specialty: z.coerce.number().min(0).default(0),

  // Блок Ж
  sponsor_funds: z.coerce.number().min(0).default(0),
  enterprise_partnerships: z.coerce.number().min(0).default(0),
  self_earned_income: z.coerce.number().min(0).default(0),
}).refine(data => !(data.repair_not_needed && data.repair_current_needed), {
  message: "Нельзя отметить одновременно 'Ремонт не требуется' и 'Требуется ремонт'",
  path: ["repair_not_needed"]
});

type SchoolRatingFormValues = z.infer<typeof schoolRatingSchema>;

// --- Components ---

const MethodologyModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
  <Modal open={open} onClose={onClose} title="Методология оценки рейтинга школ" size="lg">
    <div className="space-y-6 text-sm">
      <section>
        <h4 className="font-bold text-fc-navy-900 mb-2 flex items-center gap-2">
          <School className="w-4 h-4 text-fc-blue-500" /> Блок А: Инфраструктура (Макс. 10.5 баллов)
        </h4>
        <ul className="list-disc pl-5 space-y-1 text-fc-steel-700">
          <li>Капитальный ремонт проведён: <span className="font-bold text-success">+2.0</span></li>
          <li>Капитальный ремонт требуется: <span className="font-bold text-danger">-2.0</span></li>
          <li>Текущий ремонт проведён: <span className="font-bold text-success">+1.0</span></li>
          <li>Текущий ремонт требуется: <span className="font-bold text-danger">-1.0</span></li>
          <li>Ремонт не требуется: <span className="font-bold text-success">+0.5</span></li>
          <li>Спортзал, продлёнка, автобус: по <span className="font-bold text-success">+1.0</span> за каждый пункт</li>
        </ul>
      </section>

      <section>
        <h4 className="font-bold text-fc-navy-900 mb-2 flex items-center gap-2">
          <Users className="w-4 h-4 text-fc-blue-500" /> Блок Б: Контингент (Макс. 4 балла)
        </h4>
        <p className="text-fc-steel-700 mb-1 italic text-xs">Оценивается процент заполняемости (учащиеся / мощность):</p>
        <ul className="list-disc pl-5 space-y-1 text-fc-steel-700">
          <li>80% – 100% (оптимально): <span className="font-bold text-success">4 балла</span></li>
          <li>60% – 80% или 100% – 110%: <span className="font-bold text-fc-navy-600">3 балла</span></li>
          <li>40% – 60% или 110% – 120%: <span className="font-bold text-warning">2 балла</span></li>
          <li>Ниже 40% или выше 120%: <span className="font-bold text-danger">1 балл</span></li>
        </ul>
      </section>

      <section>
        <h4 className="font-bold text-fc-navy-900 mb-2 flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-fc-blue-500" /> Блок В: Качество образования (Макс. 11 баллов)
        </h4>
        <ul className="list-disc pl-5 space-y-1 text-fc-steel-700">
          <li>Аккредитация: <span className="font-bold">2 балла</span> (1 попытка), <span className="font-bold">1 балл</span> (2 попытка)</li>
          <li>Средний балл ЕНТ: <span className="font-bold">5</span> (&ge;110), <span className="font-bold">3</span> (&ge;90), <span className="font-bold">1</span> (&ge;70)</li>
          <li>Успеваемость (&ge;90%): <span className="font-bold">1.5 балла</span></li>
          <li>Качество знаний (&ge;80%): <span className="font-bold">2.5 балла</span></li>
        </ul>
      </section>

      <section>
        <h4 className="font-bold text-fc-navy-900 mb-2 flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-fc-blue-500" /> Блок Г: Педагогический потенциал (Макс. 19 баллов)
        </h4>
        <ul className="list-disc pl-5 space-y-1 text-fc-steel-700">
          <li>Высшая категория (&ge;40% штата): <span className="font-bold">2 балла</span></li>
          <li>Учёная степень (&ge;10% штата): <span className="font-bold">4 балла</span></li>
          <li>Стажировки за рубежом (&ge;5%): <span className="font-bold">3 балла</span></li>
          <li>Производственный опыт (&ge;10%): <span className="font-bold">3 балла</span></li>
          <li>Награда «Лучший педагог» (&ge;3 чел): <span className="font-bold">3 балла</span></li>
        </ul>
      </section>

      <div className="p-4 bg-fc-navy-50 rounded-lg border border-fc-navy-100">
        <p className="text-xs text-fc-navy-700 leading-relaxed">
          <b>Примечание:</b> Расчёт производится автоматически на основе введённых данных. 
          Итоговый балл является суммой всех показателей по 7 блокам. 
          Система АО «Финансовый центр» обеспечивает непредвзятость оценки через верификацию подтверждающих документов.
        </p>
      </div>
    </div>
  </Modal>
);

const AccordionItem = ({ 
  id, title, icon: Icon, children, isOpen, onToggle, score 
}: { 
  id: string; title: string; icon: any; children: React.ReactNode; 
  isOpen: boolean; onToggle: () => void; score?: number 
}) => (
  <div className="border border-slate-200 rounded-xl mb-3 overflow-hidden bg-white shadow-sm transition-all hover:shadow-md">
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
        isOpen ? "bg-fc-navy-50" : "hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${isOpen ? "bg-fc-navy-700 text-white" : "bg-slate-100 text-fc-steel-600"}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-fc-navy-900">{title}</h3>
          {score !== undefined && (
            <p className="text-[10px] label-eyebrow text-fc-steel-500 mt-0.5">
              Балл: <span className="text-fc-navy-700 font-bold tabular-nums">{score}</span>
            </p>
          )}
        </div>
      </div>
      <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
        <ChevronDown className="w-5 h-5 text-fc-steel-400" />
      </motion.div>
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="p-5 border-t border-slate-100 bg-white">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const CheckboxField = ({ name, label, hint }: { name: string; label: string; hint?: string }) => {
  const { register } = useFormContext();
  return (
    <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
      <input type="checkbox" {...register(name)} className="mt-1 w-4 h-4 rounded text-fc-navy-700 focus:ring-fc-navy-500" />
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-fc-navy-900">{label}</span>
        {hint && <span className="text-xs text-fc-steel-500 mt-0.5">{hint}</span>}
      </div>
    </label>
  );
};

export default function SchoolRatingForm({ orgId: propOrgId, recordId }: { orgId?: string; recordId?: string }) {
  const { user } = useAuth();
  const orgId = propOrgId ?? user?.org_id;
  const [openItem, setOpenItem] = useState<string>("block-a");
  const [status, setStatus] = useState("draft");
  const [currentRecordId, setCurrentRecordId] = useState(recordId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showMethodology, setShowMethodology] = useState(false);

  const methods = useForm<SchoolRatingFormValues>({
    resolver: zodResolver(schoolRatingSchema),
    defaultValues: {
      academic_year: new Date().getFullYear(),
      design_capacity: 1,
      enrolled_students: 0
    }
  });

  const watchAll = methods.watch();
  const liveResults = useMemo(() => calculateSchoolRatingClient(watchAll as any), [watchAll]);

  useEffect(() => {
    setCurrentRecordId(recordId);
  }, [recordId]);

  useEffect(() => {
    if (!currentRecordId || !orgId) return;
    (async () => {
      try {
        const { data } = await client.get(`/organisations/${orgId}/school-rating/${currentRecordId}`);
        methods.reset(data.raw_data);
        setStatus(data.submission_status);
      } catch (e: any) {
        setError("Не удалось загрузить данные");
      }
    })();
  }, [currentRecordId, orgId]);

  const onSave = async (values: SchoolRatingFormValues) => {
    if (!orgId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        academic_year: values.academic_year,
        raw_data: values,
        submission_status: "draft"
      };
      if (currentRecordId) {
        await client.patch(`/organisations/${orgId}/school-rating/${currentRecordId}`, payload);
      } else {
        const { data } = await client.post(`/organisations/${orgId}/school-rating`, payload);
        if (data?.id) setCurrentRecordId(String(data.id));
      }
      setSuccess("Черновик успешно сохранён");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Ошибка при сохранении");
    } finally {
      setSaving(false);
    }
  };

  const isReadOnly = ["approved", "submitted", "under_review"].includes(status);

  return (
    <FormProvider {...methods}>
      <div className="max-w-5xl mx-auto pb-20">
        <PageHeader 
          title="Рейтинг школ" 
          subtitle="Система мониторинга АО «Финансовый центр»"
          actions={
            <div className="flex items-center gap-3">
              <button 
                type="button"
                onClick={() => setShowMethodology(true)}
                className="btn-ghost text-fc-blue-600"
              >
                <HelpCircle className="w-4 h-4" />
                Методология
              </button>
              <StatusBadge status={status} />
              {!isReadOnly && (
                <button 
                  onClick={methods.handleSubmit(onSave)} 
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? <Sparkles className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Сохранить черновик
                </button>
              )}
            </div>
          }
        />

        <MethodologyModal open={showMethodology} onClose={() => setShowMethodology(false)} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <div className="mb-6">
              <SectionHeader 
                title="Сбор данных для оценки" 
                hint="Заполните все блоки для получения итогового балла. Нажмите на иконку методики для справки." 
              />
            </div>

            <AccordionItem 
              id="block-a" 
              title="Блок А: Материально-техническая база" 
              icon={School}
              isOpen={openItem === "block-a"}
              onToggle={() => setOpenItem(openItem === "block-a" ? "" : "block-a")}
              score={liveResults.blocks.infrastructure}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CheckboxField name="repair_not_needed" label="Ремонт не требуется" />
                <CheckboxField name="repair_current_needed" label="Требуется текущий ремонт" />
                <CheckboxField name="repair_capital_needed" label="Требуется капитальный ремонт" />
                <CheckboxField name="repair_capital_done" label="Кап. ремонт проведён" />
                <CheckboxField name="repair_current" label="Текущий ремонт проведён" />
                <CheckboxField name="has_sports_facility" label="Наличие спортзала" />
                <CheckboxField name="has_extended_day" label="Наличие продлёнки" />
                <CheckboxField name="has_school_bus" label="Наличие школьного автобуса" />
              </div>
            </AccordionItem>

            <AccordionItem 
              id="block-b" 
              title="Блок Б: Контингент" 
              icon={Users}
              isOpen={openItem === "block-b"}
              onToggle={() => setOpenItem(openItem === "block-b" ? "" : "block-b")}
              score={liveResults.blocks.contingent}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <NumField name="design_capacity" label="Проектная мощность *" />
                <NumField name="enrolled_students" label="Фактически учащихся *" />
              </div>
            </AccordionItem>

            <AccordionItem 
              id="block-c" 
              title="Блок В: Качество образования" 
              icon={GraduationCap}
              isOpen={openItem === "block-c"}
              onToggle={() => setOpenItem(openItem === "block-c" ? "" : "block-c")}
              score={liveResults.blocks.quality}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CheckboxField name="accreditation_passed" label="Аккредитация пройдена" />
                  <NumField name="accreditation_attempt" label="Попытка (1 или 2)" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <NumField name="ent_average_score" label="Средний балл ЕНТ" />
                  <NumField name="academic_performance_pct" label="Успеваемость (%)" />
                  <NumField name="knowledge_quality_pct" label="Качество знаний (%)" />
                </div>
              </div>
            </AccordionItem>

            <AccordionItem 
              id="block-d" 
              title="Блок Г: Педагогический потенциал" 
              icon={Briefcase}
              isOpen={openItem === "block-d"}
              onToggle={() => setOpenItem(openItem === "block-d" ? "" : "block-d")}
              score={liveResults.blocks.pedagogical}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <NumField name="teachers_total" label="Всего педагогов" />
                <NumField name="teachers_high_category" label="Высшая категория" />
                <NumField name="teachers_with_degree" label="С учёной степенью" />
                <NumField name="teachers_best_teacher_award" label="Награда «Лучший педагог»" />
              </div>
            </AccordionItem>

            <AccordionItem 
              id="block-e" 
              title="Блок Д: Внеурочная деятельность" 
              icon={Trophy}
              isOpen={openItem === "block-e"}
              onToggle={() => setOpenItem(openItem === "block-e" ? "" : "block-e")}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <NumField name="olympiad_winners_republican" label="Победители респ. олимпиад" />
                <NumField name="olympiad_winners_international" label="Победители межд. олимпиад" />
                <NumField name="sport_achievements" label="Спортивные достижения" />
                <NumField name="creative_achievements" label="Творческие достижения" />
              </div>
            </AccordionItem>

            <AccordionItem 
              id="block-f" 
              title="Блок Е: Поступление в вузы" 
              icon={BarChart3}
              isOpen={openItem === "block-f"}
              onToggle={() => setOpenItem(openItem === "block-f" ? "" : "block-f")}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <NumField name="graduates_total" label="Всего выпускников" />
                <NumField name="graduates_enrolled_university" label="Поступили в вузы" />
                <NumField name="graduates_enrolled_by_specialty" label="По специальности" />
              </div>
            </AccordionItem>

            <AccordionItem 
              id="block-g" 
              title="Блок Ж: Финансы и партнёрство" 
              icon={Coins}
              isOpen={openItem === "block-g"}
              onToggle={() => setOpenItem(openItem === "block-g" ? "" : "block-g")}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <NumField name="sponsor_funds" label="Спонсорские средства (₸)" />
                <NumField name="enterprise_partnerships" label="Договоры с предприятиями" />
                <NumField name="self_earned_income" label="Собственный доход (₸)" />
              </div>
            </AccordionItem>

            {error && <ErrorBox message={error} />}
            {success && <SuccessBox message={success} />}
          </div>

          {/* Sidebar / Scorecard */}
          <div className="space-y-6">
            <div className="card p-6 bg-fc-navy-900 text-white sticky top-6 shadow-fc-xl">
              <div className="flex items-center gap-2 mb-4 text-fc-cyan-400">
                <Sparkles className="w-5 h-5" />
                <span className="label-eyebrow">Расчёт в реальном времени</span>
              </div>
              
              <div className="mb-6">
                <p className="text-fc-steel-300 text-xs mb-1 uppercase tracking-wider">Предварительный рейтинг</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black font-display tabular-nums tracking-tighter">
                    {liveResults.total_score}
                  </span>
                  <span className="text-fc-cyan-400 font-bold">баллов</span>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-fc-steel-400">Прогресс заполнения</span>
                  <span className="font-bold tabular-nums">{liveResults.completion}%</span>
                </div>
                <div className="h-1.5 w-full bg-fc-navy-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${liveResults.completion}%` }}
                    className="h-full bg-fc-cyan-500"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <p className="text-[10px] font-bold text-fc-steel-400 uppercase tracking-widest">Проверка валидации</p>
                <div className="flex items-center gap-2 text-xs">
                  {methods.formState.isValid ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      <span className="text-success font-medium">Данные корректны</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-warning" />
                      <span className="text-warning font-medium">Проверьте обязательные поля</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <button 
              type="button"
              onClick={() => setShowMethodology(true)}
              className="w-full card p-4 flex items-center gap-3 border-fc-blue-100 bg-fc-blue-50/30 hover:bg-fc-blue-50 transition-colors group"
            >
              <div className="p-2 bg-fc-blue-500 text-white rounded-lg group-hover:scale-110 transition-transform">
                <Info className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-fc-navy-900">Как считаются баллы?</p>
                <p className="text-[10px] text-fc-steel-500">Посмотреть методологию ФЦ</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </FormProvider>
  );
}
