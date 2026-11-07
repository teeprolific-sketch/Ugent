import { useColorScheme } from 'react-native';

/* Brand: sky blue #0EA5E9, white, deep blue #0B3D91. Calm, lots of white space, big readable text. */
const light = {
  bg: '#FFFFFF',
  surface: '#F3F8FD',
  surface2: '#E7F3FC',
  line: '#E1EAF3',
  ink: '#12233F',
  heading: '#0B3D91',
  muted: '#5A6B85',
  sky: '#0EA5E9',
  skyInk: '#0369A1',
  onSky: '#FFFFFF',
  good: '#15803D',
  warn: '#B45309',
  danger: '#B91C1C',
  bar: '#0B3D91',
  barSoft: '#BFE4F8',
  toast: '#0B3D91',
  scrim: 'rgba(6, 21, 47, 0.35)',
};
export type Colors = typeof light;

const dark: Colors = {
  bg: '#06152F',
  surface: '#0C2147',
  surface2: '#0E2C5C',
  line: '#1A3566',
  ink: '#E6EEF9',
  heading: '#DCEBFF',
  muted: '#9DB0CC',
  sky: '#0EA5E9',
  skyInk: '#5CC8F5',
  onSky: '#FFFFFF',
  good: '#4ADE80',
  warn: '#FBBF24',
  danger: '#F87171',
  bar: '#5CC8F5',
  barSoft: '#1E4A80',
  toast: '#1E4A80',
  scrim: 'rgba(0, 0, 0, 0.55)',
};

/* Outfit matches the Ugent wordmark. Yoruba, Igbo and Hausa stack tone marks (ẹ́, ụ̀) that Outfit cannot
 * position, so those languages use Noto Sans, which was designed for them. The getters read the current
 * language, so every component picks the right family without extra wiring. */
const OUTFIT = { regular: 'Outfit_400Regular', medium: 'Outfit_500Medium', semibold: 'Outfit_600SemiBold', bold: 'Outfit_700Bold' };
const NOTO = { regular: 'NotoSans_400Regular', medium: 'NotoSans_500Medium', semibold: 'NotoSans_600SemiBold', bold: 'NotoSans_700Bold' };
let family = OUTFIT;
export function setFontLanguage(lang: string) { family = lang === 'yo' || lang === 'ig' || lang === 'ha' ? NOTO : OUTFIT; }
export const font = {
  get regular() { return family.regular; },
  get medium() { return family.medium; },
  get semibold() { return family.semibold; },
  get bold() { return family.bold; },
};

export const size = { sm: 15, base: 17, lg: 20, xl: 28, hero: 40 };
export const radius = { md: 14, lg: 16, xl: 22 };
export const space = 20; // side gutter

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}
export const isDarkScheme = (s: string | null | undefined) => s === 'dark';
