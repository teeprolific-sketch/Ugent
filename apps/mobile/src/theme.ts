import { useColorScheme } from 'react-native';

/* Brand: sky blue #0EA5E9, white, deep blue #0B3D91. Calm, lots of white space, big readable text.
 * The colour tokens live in themes.ts; this file picks the one the user chose. */
import { useMemo } from 'react';
import { useApp } from './store';
import type { Colors, ResolvedTheme } from './themes';
import { resolveTheme } from './themes';
export type { Colors };

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

/** The active theme: the user's choice, or the phone's light/dark setting when it is "Automatic". */
export function useTheme(): ResolvedTheme {
  const system = useColorScheme();
  const id = useApp((s) => s.settings.theme);
  const custom = useApp((s) => s.settings.customTheme);
  const plan = useApp((s) => s.me?.plan ?? 'free');
  return useMemo(() => resolveTheme(id, custom, plan, system), [id, custom, plan, system]);
}

export function useColors(): Colors {
  return useTheme().colors;
}
