// src/lib/animations.ts
// Centralized animation presets for the EDU Monitoring portal.
// Corporate physics: no bounce, clean easing, subtle motion.
import type { Variants } from "framer-motion";

// Precise cubic-bezier — feels premium, not bouncy
export const EASE_FC  = [0.25, 0.1, 0.25, 1.0] as const;
export const EASE_OUT = [0.0,  0.0,  0.2,  1.0] as const;

// ── Page-level transition (used in AppShell Outlet wrapper) ─────────────────
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  enter:   { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_FC } },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.14, ease: EASE_FC } },
};

// ── Single element: fade-in from below (cards, headers, etc.) ───────────────
export const fadeInUp: Variants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE_FC } },
};

// ── List stagger: parent container ──────────────────────────────────────────
export const staggerContainer: Variants = {
  hidden:  {},
  visible: {
    transition: { staggerChildren: 0.055, delayChildren: 0.04 },
  },
};

// ── List stagger: each child item ───────────────────────────────────────────
export const staggerItem: Variants = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE_FC } },
};

// ── Modal backdrop ──────────────────────────────────────────────────────────
export const modalOverlay: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
  exit:    { opacity: 0, transition: { duration: 0.14 } },
};

// ── Modal dialog — scale from center ────────────────────────────────────────
export const modalContent: Variants = {
  hidden:  { opacity: 0, scale: 0.96, y: 6 },
  visible: { opacity: 1, scale: 1.00, y: 0, transition: { duration: 0.22, ease: EASE_FC } },
  exit:    { opacity: 0, scale: 0.98, y: 4, transition: { duration: 0.14 } },
};

// ── Slide-over panel from right (anomaly detail, etc.) ──────────────────────
export const slideOver: Variants = {
  hidden:  { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.22, ease: EASE_OUT } },
  exit:    { opacity: 0, x: 16, transition: { duration: 0.14 } },
};
