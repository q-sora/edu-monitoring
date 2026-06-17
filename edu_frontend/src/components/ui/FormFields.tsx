// src/components/ui/FormFields.tsx
// Shared form inputs for react-hook-form contexts.
// Все компоненты предполагают <FormProvider> родителя и читают/пишут через useFormContext.
// Семантические токены брендбука: highlight = navy accent.

import { useFormContext } from "react-hook-form";

// Walk a dotted/array path through formState.errors → message.
// Например: getErrorMessage(errors, "prize_winners_json.0.event_type")
function getErrorMessage(errors: any, path: string): string | undefined {
  if (!path) return undefined;
  const parts = path.split(/[.[\]]/).filter(Boolean);
  let cur: any = errors;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return typeof cur?.message === "string" ? cur.message : undefined;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="text-[11px] text-danger mt-0.5">{message}</span>;
}

function FieldHint({ hint }: { hint?: string }) {
  if (!hint) return null;
  return <span className="text-[11px] text-fc-steel-500 mt-0.5">{hint}</span>;
}

type BaseFieldProps = {
  name: string;
  label: string;
  hint?: string;
  highlight?: boolean;
};

const labelClass = (highlight?: boolean) =>
  `label-eyebrow ${highlight ? "!text-fc-navy-900 font-black" : ""}`;

const numericInputClass = (highlight?: boolean, hasError?: boolean, extra = "") =>
  [
    "input text-right tabular-nums",
    extra,
    highlight ? "border-fc-navy-300 bg-fc-navy-50/30 font-bold" : "",
    hasError ? "border-danger" : "",
  ]
    .filter(Boolean)
    .join(" ");

// NumField — целое или дробное число
export function NumField({
  name, label, hint, highlight,
  step = "1", placeholder = "0", min,
}: BaseFieldProps & { step?: string | number; placeholder?: string; min?: number }) {
  const { register, formState: { errors } } = useFormContext();
  const err = getErrorMessage(errors, name);
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelClass(highlight)}>{label}</span>
      <input
        type="number"
        step={step}
        min={min}
        placeholder={placeholder}
        {...register(name)}
        className={numericInputClass(highlight, !!err)}
      />
      <FieldHint hint={hint} />
      <FieldError message={err} />
    </label>
  );
}

// MoneyField — денежное поле с ₸
export function MoneyField({ name, label, hint, highlight }: BaseFieldProps) {
  const { register, formState: { errors } } = useFormContext();
  const err = getErrorMessage(errors, name);
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelClass(highlight)}>{label}</span>
      <div className="relative">
        <input
          type="number"
          step="0.01"
          placeholder="0"
          {...register(name)}
          className={numericInputClass(highlight, !!err, "pr-12")}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fc-steel-400 pointer-events-none">
          ₸
        </span>
      </div>
      <FieldHint hint={hint} />
      <FieldError message={err} />
    </label>
  );
}

// PercentField — поле с %
export function PercentField({ name, label, hint, highlight }: BaseFieldProps) {
  const { register, formState: { errors } } = useFormContext();
  const err = getErrorMessage(errors, name);
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelClass(highlight)}>{label}</span>
      <div className="relative">
        <input
          type="number"
          step="0.01"
          min={0}
          max={100}
          placeholder="0"
          {...register(name)}
          className={numericInputClass(highlight, !!err, "pr-10")}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fc-steel-400 pointer-events-none">
          %
        </span>
      </div>
      <FieldHint hint={hint} />
      <FieldError message={err} />
    </label>
  );
}

// DateField
export function DateField({ name, label, hint }: { name: string; label: string; hint?: string }) {
  const { register, formState: { errors } } = useFormContext();
  const err = getErrorMessage(errors, name);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-eyebrow">{label}</span>
      <input
        type="date"
        {...register(name)}
        className={`input ${err ? "border-danger" : ""}`}
      />
      <FieldHint hint={hint} />
      <FieldError message={err} />
    </label>
  );
}

// TextField — обычный текст
export function TextField({
  name, label, hint, placeholder,
}: { name: string; label: string; hint?: string; placeholder?: string }) {
  const { register, formState: { errors } } = useFormContext();
  const err = getErrorMessage(errors, name);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-eyebrow">{label}</span>
      <input
        type="text"
        placeholder={placeholder}
        {...register(name)}
        className={`input ${err ? "border-danger" : ""}`}
      />
      <FieldHint hint={hint} />
      <FieldError message={err} />
    </label>
  );
}

// SelectField
export function SelectField({
  name, label, options, hint, placeholder = "—",
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  hint?: string;
  placeholder?: string;
}) {
  const { register, formState: { errors } } = useFormContext();
  const err = getErrorMessage(errors, name);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-eyebrow">{label}</span>
      <select {...register(name)} className={`input ${err ? "border-danger" : ""}`}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <FieldHint hint={hint} />
      <FieldError message={err} />
    </label>
  );
}

// SectionHeader — разделитель секции внутри таба
export function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="col-span-full my-5 first:mt-0 pb-3 border-b border-slate-100">
      <p className="font-display font-bold text-fc-navy-900">{title}</p>
      {hint && <p className="text-xs text-fc-steel-500 mt-1">{hint}</p>}
    </div>
  );
}
