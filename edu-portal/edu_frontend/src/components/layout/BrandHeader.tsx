// src/components/layout/BrandHeader.tsx
import { motion } from "framer-motion";
import { fadeInUp } from "@/lib/animations";
import { LogoWithText } from "@/components/brand/Logo";

interface BrandHeaderProps {
  /** Тёмная версия — для использования на navy-фонах */
  dark?: boolean;
  /** Версия с английским логотипом */
  lang?: "ru" | "kz" | "en";
  /** Показать ли подпись «ЕДУ Мониторинг / v1.0» под логотипом */
  showProductName?: boolean;
  className?: string;
}

export default function BrandHeader({
  dark = false,
  lang = "ru",
  showProductName = false,
  className = "",
}: BrandHeaderProps) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className={`px-4 py-4 ${dark ? "border-b border-white/10" : "border-b border-slate-200"} ${className}`}
    >
      <LogoWithText variant={dark ? "white" : "navy"} lang={lang} />

      {showProductName && (
        <div className={`mt-2.5 pt-2.5 border-t ${dark ? "border-white/10" : "border-slate-100"}`}>
          <p className={`text-[10px] font-bold uppercase tracking-fc-eyebrow ${dark ? "text-white/60" : "text-fc-steel-500"}`}>
            ЕДУ Мониторинг
          </p>
          <p className={`text-[9px] mt-0.5 ${dark ? "text-white/40" : "text-slate-400"}`}>
            Система мониторинга образования · v1.0
          </p>
        </div>
      )}
    </motion.div>
  );
}
