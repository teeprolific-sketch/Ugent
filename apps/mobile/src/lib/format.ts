import type { Lang, TimeStr } from '@ugent/core';
import { addDays, fmtDate, langMeta, parseDate, pad } from '@ugent/core';

/** "2:00 PM" (or "14 h 00" in French). */
export function timeParts(hhmm: TimeStr, lang: Lang): [string, string] {
  const [h, m] = hhmm.split(':').map(Number);
  if (lang === 'fr') return [`${h}:${pad(m)}`, ''];
  return [`${h % 12 || 12}:${pad(m)}`, h < 12 ? 'AM' : 'PM'];
}
export const fmtTime = (lang: Lang) => (hhmm: TimeStr) => timeParts(hhmm, lang).join(' ').trim();

export function fmtDay(date: string, lang: Lang, opts: Intl.DateTimeFormatOptions): string {
  try { return new Intl.DateTimeFormat(langMeta(lang).locale, opts).format(parseDate(date)); } catch { return date; }
}

/** Short date for a timestamp in the user's language, e.g. "10 Nov". */
export const fmtStamp = (at: number, lang: Lang) => fmtDay(fmtDate(new Date(at)), lang, { day: 'numeric', month: 'short' });

export const fmtDur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);

export function dayWord(date: string, lang: Lang): string {
  const d0 = fmtDate(new Date());
  if (date === d0) return 'Today';
  if (date === addDays(d0, 1)) return 'Tomorrow';
  return fmtDay(date, lang, { weekday: 'short', day: 'numeric', month: 'short' });
}

export const KIND_LABEL = { meeting: 'Meeting', deep: 'Deep work', errand: 'Errand', personal: 'Personal' } as const;

/** Local wall-clock time as "YYYY-MM-DDTHH:MM" for the API. */
export const localNow = (d = new Date()) => `${fmtDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
