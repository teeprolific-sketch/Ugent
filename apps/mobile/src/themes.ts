/* Ugent themes. White and Black are free; Pro and Team unlock the rest, plus a custom theme.
 * Every colour in the app comes from one of these token sets, so a theme changes the whole app at once.
 */
import type { Plan } from '@ugent/core';

export interface Colors {
  bg: string; surface: string; surface2: string; line: string;
  ink: string; heading: string; muted: string;
  /** The primary action colour (sky blue in the brand themes). */
  sky: string;
  /** The primary colour when used as text on the background. */
  skyInk: string;
  onSky: string;
  good: string; warn: string; danger: string;
  bar: string; barSoft: string; toast: string; scrim: string;
}

export type Base = 'light' | 'dark';
export type ThemeId = 'auto' | 'white' | 'black' | 'midnight' | 'ocean' | 'sunset' | 'forest' | 'royal' | 'custom';
export interface CustomTheme { base: Base; accent: string }
export interface ThemeDef { id: Exclude<ThemeId, 'auto'>; name: string; note: string; base: Base; pro: boolean; colors: Colors }

const white: Colors = {
  bg: '#FFFFFF', surface: '#F3F8FD', surface2: '#E7F3FC', line: '#E1EAF3',
  ink: '#12233F', heading: '#0B3D91', muted: '#5A6B85',
  sky: '#0EA5E9', skyInk: '#0369A1', onSky: '#FFFFFF',
  good: '#15803D', warn: '#B45309', danger: '#B91C1C',
  bar: '#0B3D91', barSoft: '#BFE4F8', toast: '#0B3D91', scrim: 'rgba(6, 21, 47, 0.35)',
};

const black: Colors = {
  bg: '#000000', surface: '#111317', surface2: '#0B1E2C', line: '#23272E',
  ink: '#F2F4F7', heading: '#FFFFFF', muted: '#9AA3AE',
  sky: '#0EA5E9', skyInk: '#38BDF8', onSky: '#FFFFFF',
  good: '#4ADE80', warn: '#FBBF24', danger: '#F87171',
  bar: '#38BDF8', barSoft: '#173A52', toast: '#1F2937', scrim: 'rgba(0, 0, 0, 0.65)',
};

const midnight: Colors = {
  bg: '#06152F', surface: '#0C2147', surface2: '#0E2C5C', line: '#1A3566',
  ink: '#E6EEF9', heading: '#DCEBFF', muted: '#9DB0CC',
  sky: '#0EA5E9', skyInk: '#5CC8F5', onSky: '#FFFFFF',
  good: '#4ADE80', warn: '#FBBF24', danger: '#F87171',
  bar: '#5CC8F5', barSoft: '#1E4A80', toast: '#1E4A80', scrim: 'rgba(0, 0, 0, 0.55)',
};

/* ---------- Colour maths for generated themes ---------- */
const hex = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
/** Blend: t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hex(a); const [r2, g2, b2] = hex(b);
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}
/** Relative luminance, used to pick readable text on the accent. */
function lum(h: string) {
  const [r, g, b] = hex(h).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

/** Builds a full, readable token set from a base and one accent colour. */
export function buildTheme(base: Base, accent: string, bg?: string): Colors {
  if (base === 'light') {
    const page = bg ?? '#FFFFFF';
    const heading = mix(accent, '#000000', 0.5);
    return {
      bg: page, surface: mix(page, accent, 0.06), surface2: mix(page, accent, 0.12), line: mix(page, accent, 0.16),
      ink: mix(accent, '#0F172A', 0.85), heading, muted: mix(accent, '#475569', 0.8),
      sky: accent, skyInk: contrast(accent, page) >= 4.5 ? accent : mix(accent, '#000000', 0.35),
      onSky: contrast('#FFFFFF', accent) >= 3 ? '#FFFFFF' : '#0F172A',
      good: '#15803D', warn: '#B45309', danger: '#B91C1C',
      bar: heading, barSoft: mix(page, accent, 0.3), toast: heading, scrim: 'rgba(0, 0, 0, 0.35)',
    };
  }
  const page = bg ?? '#0B0F14';
  return {
    bg: page, surface: mix(page, accent, 0.1), surface2: mix(page, accent, 0.18), line: mix(page, accent, 0.24),
    ink: '#EEF2F6', heading: mix(accent, '#FFFFFF', 0.82), muted: mix(accent, '#A3AEBB', 0.85),
    sky: accent, skyInk: mix(accent, '#FFFFFF', 0.35),
    onSky: contrast('#FFFFFF', accent) >= 3 ? '#FFFFFF' : '#0F172A',
    good: '#4ADE80', warn: '#FBBF24', danger: '#F87171',
    bar: mix(accent, '#FFFFFF', 0.25), barSoft: mix(page, accent, 0.35), toast: mix(page, accent, 0.35), scrim: 'rgba(0, 0, 0, 0.6)',
  };
}

export const THEMES: ThemeDef[] = [
  { id: 'white', name: 'White', note: 'Clean and bright', base: 'light', pro: false, colors: white },
  { id: 'black', name: 'Black', note: 'Easy on the eyes', base: 'dark', pro: false, colors: black },
  { id: 'midnight', name: 'Midnight', note: 'Deep Ugent blue', base: 'dark', pro: true, colors: midnight },
  { id: 'ocean', name: 'Ocean', note: 'Calm blue-green', base: 'light', pro: true, colors: buildTheme('light', '#0891B2', '#F7FCFD') },
  { id: 'sunset', name: 'Sunset', note: 'Warm and friendly', base: 'light', pro: true, colors: buildTheme('light', '#EA580C', '#FFFBF6') },
  { id: 'forest', name: 'Forest', note: 'Green and grounded', base: 'dark', pro: true, colors: buildTheme('dark', '#16A34A', '#0A1A12') },
  { id: 'royal', name: 'Royal', note: 'Rich purple', base: 'dark', pro: true, colors: buildTheme('dark', '#8B5CF6', '#120E24') },
];

/** Accent choices for the custom theme. */
export const ACCENTS = ['#0EA5E9', '#2563EB', '#0891B2', '#16A34A', '#CA8A04', '#EA580C', '#DC2626', '#DB2777', '#8B5CF6', '#0B3D91'];

export interface ResolvedTheme { id: Exclude<ThemeId, 'auto'>; base: Base; colors: Colors }

/** The theme to show right now. Pro themes need Pro or Team; otherwise White or Black with the same base. */
export function resolveTheme(id: ThemeId, custom: CustomTheme, plan: Plan, system: 'light' | 'dark' | null | undefined): ResolvedTheme {
  const fallback = (base: Base): ResolvedTheme => (base === 'dark' ? { id: 'black', base, colors: black } : { id: 'white', base, colors: white });
  if (id === 'auto') return fallback(system === 'dark' ? 'dark' : 'light');
  if (id === 'custom') return plan === 'free' ? fallback(custom.base) : { id, base: custom.base, colors: buildTheme(custom.base, custom.accent) };
  const t = THEMES.find((x) => x.id === id) ?? THEMES[0];
  if (t.pro && plan === 'free') return fallback(t.base);
  return { id: t.id, base: t.base, colors: t.colors };
}
