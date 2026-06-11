
// src/features/edu-level/levelConfig.ts
// org_type_ids соответствуют БД: 1=ДО, 2=ДопО, 3=СО, 4=ТиППО, 5=ВиПО, 6=Общ-е, 7=ГОНС
export const LEVEL_CONFIG = {
  do: {
    label: 'Дошкольное образование',
    shortLabel: 'ДДО',
    icon: '🏫',
    orgTypeIds: [1],
    tabs: ['contingent', 'finance', 'education'],
    accentColor: 'teal',
  },
  so: {
    label: 'Общеобразовательные школы',
    shortLabel: 'Школы',
    icon: '🎒',
    orgTypeIds: [3],
    tabs: ['contingent', 'finance', 'graduates', 'education'],
    accentColor: 'blue',
  },
  dopo: {
    label: 'Дополнительное образование',
    shortLabel: 'Доп. обр.',
    icon: '🎨',
    orgTypeIds: [2],
    tabs: ['contingent', 'finance', 'education'],
    accentColor: 'steel',
  },
  tippo: {
    label: 'ТиПО / Колледжи',
    shortLabel: 'ТиПО',
    icon: '🔧',
    orgTypeIds: [4],
    tabs: ['contingent', 'finance', 'science', 'graduates', 'education'],
    accentColor: 'steel',
  },
  vipo: {
    label: 'ОВПО / Университеты',
    shortLabel: 'ОВПО',
    icon: '🎓',
    orgTypeIds: [5],
    tabs: ['contingent', 'finance', 'science', 'graduates', 'education'],
    accentColor: 'purple',
  },
  gons: {
    label: 'ГОНС / Спец. организации',
    shortLabel: 'ГОНС',
    icon: '🏛',
    orgTypeIds: [7],
    tabs: ['contingent', 'finance', 'education'],
    accentColor: 'navy',
  },
} as const;

export type EduLevel = keyof typeof LEVEL_CONFIG;
