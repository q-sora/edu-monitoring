// src/components/brand/Logo.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Графический знак АО «Финансовый центр» — три диагональных штриха внутри
// шестиугольной композиции. Воспроизведён вручную как inline-SVG по образцу
// из брендбука (страница 9–10).
//
// Преимущества inline SVG vs PNG:
//   • работает на retina-экранах в любом масштабе
//   • можно перекрашивать через `currentColor` (для темных/светлых фонов)
//   • не делает дополнительный HTTP-запрос
//   • легче поддержи: цвет меняется prop'ом, не через перекомпрессию PNG
//
// Использование:
//   <Logo />                       — большой navy-знак
//   <Logo variant="white" />       — белый для тёмного фона
//   <Logo size={32} />             — фиксированный размер в px
//   <Logo className="w-12 h-12" /> — через Tailwind
// ─────────────────────────────────────────────────────────────────────────────

interface LogoProps {
  /** "navy" — основной (#19286d), "white" — для тёмных фонов, "currentColor" — наследует от родителя */
  variant?: "navy" | "white" | "currentColor";
  /** Размер в пикселях (квадрат). Игнорируется если задан className с w-/h-. */
  size?: number;
  className?: string;
}

export default function Logo({
  variant = "navy",
  size,
  className = "",
}: LogoProps) {
  const fill =
    variant === "white"        ? "#ffffff" :
    variant === "currentColor" ? "currentColor" :
                                 "#19286d";

  const sizeProps = size
    ? { width: size, height: size }
    : { width: "100%", height: "100%" };

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Финансовый центр"
      {...sizeProps}
    >
      {/* Три диагональных штриха одинаковой толщины (по брендбуку:
          "линии — одинаковой толщины: признак равных правил") */}

      {/* Левый верхний штрих — диагональная полоса */}
      <path
        d="M 28 12 L 50 12 L 32 68 L 10 68 Z"
        fill={fill}
      />

      {/* Центральный штрих — самый длинный, проходит через всю композицию */}
      <path
        d="M 56 12 L 78 12 L 60 68 L 38 68 Z"
        fill={fill}
      />

      {/* Правый нижний штрих с угловым окончанием — "узел расчёта" */}
      <path
        d="M 84 12 L 92 12 L 78 56 L 78 78 L 66 78 L 56 68 L 66 68 Z"
        fill={fill}
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LogoWithText — горизонтальная композиция: знак + название
// Используется в шапке, на login, в письмах.
// ─────────────────────────────────────────────────────────────────────────────

interface LogoWithTextProps {
  variant?: "navy" | "white";
  /** Язык — определяет основной текст */
  lang?: "ru" | "kz" | "en";
  /** Показать дескриптор "Интегратор финансирования госпрограмм" */
  showDescriptor?: boolean;
  className?: string;
}

export function LogoWithText({
  variant = "navy",
  lang = "ru",
  showDescriptor = true,
  className = "",
}: LogoWithTextProps) {
  const isWhite = variant === "white";
  const textColor = isWhite ? "text-white" : "text-fc-navy-900";
  const descColor = isWhite ? "text-white/70" : "text-fc-steel-600";

  const titles = {
    ru: "Финансовый центр",
    kz: "Qarjy Ortalyğy",
    en: "Financial Center",
  };

  const descriptors = {
    ru: "Интегратор финансирования госпрограмм",
    kz: "Memlekettik baǵdarlamalardy qarjylandyru integratory",
    en: "Government Program Financing Integrator",
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Logo variant={variant} className="w-9 h-9 shrink-0" />
      <div className="min-w-0">
        <p className={`font-display font-extrabold text-[15px] leading-tight tracking-fc-tight uppercase ${textColor}`}>
          {titles[lang]}
        </p>
        {showDescriptor && (
          <p className={`text-[9px] font-bold uppercase tracking-fc-eyebrow leading-tight mt-0.5 ${descColor}`}>
            {descriptors[lang]}
          </p>
        )}
      </div>
    </div>
  );
}
