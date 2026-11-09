/* Personalisation: patterns Ugent learns from the person's own plans. Pure functions. */
import { addDays, fmtDate, parseDate, toMin } from './dates';
import type { PlanEvent } from './types';

export interface Routine { title: string; weekday: number; start: string; times: number }

const key = (title: string) => title.trim().toLowerCase().replace(/\s+/g, ' ');
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const weekdayName = (d: number) => WEEKDAYS[d];

/**
 * Plans that repeat: the same title on the same weekday, at about the same time, on at least two
 * different weeks in the last six. Imported calendar events and samples are ignored.
 */
export function detectRoutines(events: PlanEvent[], now: Date): Routine[] {
  const since = addDays(fmtDate(now), -42);
  const groups = new Map<string, { title: string; weekday: number; starts: number[]; weeks: Set<string> }>();
  for (const e of events) {
    if (e.deleted || e.external || e.sample || e.date < since || e.date > fmtDate(now)) continue;
    const d = parseDate(e.date);
    const wd = d.getDay();
    const g = groups.get(`${key(e.title)}|${wd}`) ?? { title: e.title.trim(), weekday: wd, starts: [], weeks: new Set<string>() };
    g.starts.push(toMin(e.start));
    g.weeks.add(addDays(e.date, -wd)); // the Sunday that starts that week
    groups.set(`${key(e.title)}|${wd}`, g);
  }
  const out: Routine[] = [];
  for (const g of groups.values()) {
    if (g.weeks.size < 2) continue;
    const sorted = [...g.starts].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (sorted.some((m) => Math.abs(m - median) > 60)) continue; // not at a steady time
    const h = Math.floor(median / 60); const m = median % 60;
    out.push({ title: g.title, weekday: g.weekday, start: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, times: g.weeks.size });
  }
  return out.sort((a, b) => b.times - a.times);
}

/** A routine that usually happens today but is not planned yet. */
export function routineToSuggest(routines: Routine[], events: PlanEvent[], now: Date): Routine | null {
  const d0 = fmtDate(now);
  const today = events.filter((e) => !e.deleted && e.date === d0).map((e) => key(e.title));
  const nowM = now.getHours() * 60 + now.getMinutes();
  return routines.find((r) => r.weekday === now.getDay() && !today.includes(key(r.title)) && toMin(r.start) > nowM) ?? null;
}
