import type { DateStr, TimeStr } from './types';

export const pad = (n: number) => String(n).padStart(2, '0');
export const fmtDate = (d: Date): DateStr => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDate = (s: DateStr): Date => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s: DateStr, n: number): DateStr => { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); };
export const toMin = (hhmm: TimeStr) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const fromMin = (m: number): TimeStr => {
  const c = Math.max(0, Math.min(23 * 60 + 59, Math.round(m)));
  return `${pad(Math.floor(c / 60))}:${pad(c % 60)}`;
};
export const minOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
