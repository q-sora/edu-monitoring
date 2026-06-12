
// src/features/edu-level/levelConfig.ts
export const LEVEL_CONFIG = {
  do: {
    label: 'Дошкольное образование',
    shortLabel: 'ДДО',
    icon: '🏫',
    orgTypeSlugs: ['ddo'],           // slug из org-types справочника
    tabs: ['contingent', 'finance', 'education'],
    accentColor: 'teal',
  },
  so: {
    label: 'Общеобразовательные школы',
    shortLabel: 'Школы',
    icon: '🎒',
    orgTypeSlugs: ['school'],
    tabs: ['contingent', 'finance', 'graduates', 'education'],
    accentColor: 'blue',
  },
  dopo: {
    label: 'Дополнительное образование',
    shortLabel: 'Доп. обр.',
    icon: '🎨',
    orgTypeSlugs: ['dopo'],
    tabs: ['contingent', 'finance', 'education'],
    accentColor: 'steel',
  },
  tippo: {
    label: 'ТиПО / Колледжи',
    shortLabel: 'ТиПО',
    icon: '🔧',
    orgTypeSlugs: ['tippo'],
    tabs: ['contingent', 'finance', 'science', 'graduates', 'education'],
    accentColor: 'steel',
  },
  vipo: {
    label: 'ОВПО / Университеты',
    shortLabel: 'ОВПО',
    icon: '🎓',
    orgTypeSlugs: ['vipo'],
    tabs: ['contingent', 'finance', 'science', 'graduates', 'education'],
    accentColor: 'purple',
  },
  gons: {
    label: 'ГОНС / Спец. организации',
    shortLabel: 'ГОНС',
    icon: '🏛',
    orgTypeSlugs: ['gons'],
    tabs: ['contingent', 'finance', 'education'],
    accentColor: 'navy',
  },
} as const;

export type EduLevel = keyof typeof LEVEL_CONFIG;
