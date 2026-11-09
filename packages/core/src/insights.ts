/* Conflicts and plain-language insights. Pure functions: pass `now` in. */
import { addDays, fmtDate, parseDate, toMin } from './dates';
import { suggestSlot } from './planner';
import type { Completion, FocusLog, Move, PlanEvent, PlannerState, RescheduleLog } from './types';

export interface Conflict { first: PlanEvent; second: PlanEvent }

/** Plans on `date` that overlap in time (imported calendar events included). */
export function findConflicts(events: PlanEvent[], date: string): Conflict[] {
  const day = events.filter((e) => !e.deleted && e.date === date).sort((a, b) => toMin(a.start) - toMin(b.start));
  const out: Conflict[] = [];
  for (let i = 0; i < day.length; i++) {
    for (let j = i + 1; j < day.length; j++) {
      if (toMin(day[j].start) >= toMin(day[i].start) + day[i].dur) break;
      out.push({ first: day[i], second: day[j] });
    }
  }
  return out;
}

/** One-tap fix: move the flexible plan to the next free time. Fixed and imported plans never move. */
export function conflictFix(state: PlannerState, c: Conflict, now: Date): Move | null {
  const canMove = (e: PlanEvent) => !e.fixed && !e.external;
  const mover = canMove(c.second) ? c.second : canMove(c.first) ? c.first : null;
  if (!mover) return null;
  const other = mover.id === c.first.id ? c.second : c.first;
  const others = { ...state, events: state.events.filter((e) => e.id !== mover.id) };
  // Next free time after the other plan ends (heavy work is not forced into the peak here: it just needs room).
  const slot = suggestSlot(others, mover.kind === 'deep' ? 'personal' : mover.kind, mover.dur, now, mover.date, toMin(other.start) + other.dur);
  return { id: mover.id, title: mover.title, fromDate: mover.date, from: mover.start, toDate: slot.date, to: slot.start };
}

export interface InsightInput {
  completions: Completion[];
  events: PlanEvent[];
  reschedules: RescheduleLog[];
  focus: FocusLog[];
}

const DAY_NAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
const pct = (a: number, b: number) => Math.round((a / b) * 100);

/** Up to four short, human sentences about how the person's time really goes. */
export function insights(d: InsightInput, now: Date): string[] {
  const out: string[] = [];
  const t = now.getTime();
  const month = t - 28 * 86400000;

  // When work gets done.
  const recent = d.completions.filter((c) => c.t >= month && c.t <= t);
  if (recent.length >= 8) {
    const early = recent.filter((c) => new Date(c.t).getHours() < 11).length;
    const late = recent.filter((c) => new Date(c.t).getHours() >= 17).length;
    if (early / recent.length >= 0.5) out.push(`You finish ${pct(early, recent.length)}% of your tasks before 11 AM. Ugent keeps mornings for your hardest work.`);
    else if (late / recent.length >= 0.4) out.push(`You get a lot done after 5 PM (${pct(late, recent.length)}% of finished tasks). Ugent plans your heavy work for the evening.`);
  }

  // The heaviest day of the week.
  const d0 = fmtDate(now);
  const since = addDays(d0, -28);
  const perDay = [0, 0, 0, 0, 0, 0, 0];
  const weeks = new Set<string>();
  for (const e of d.events) {
    if (e.deleted || e.date < since || e.date > d0) continue;
    const wd = parseDate(e.date).getDay();
    perDay[wd]++;
    weeks.add(addDays(e.date, -wd));
  }
  const total = perDay.reduce((a, b) => a + b, 0);
  if (total >= 10) {
    const max = Math.max(...perDay);
    const avg = total / 7;
    const day = perDay.indexOf(max);
    if (max >= avg * 1.4 && max >= 3) out.push(`${DAY_NAMES[day]} are usually your busiest day, about ${Math.round(max / Math.max(1, weeks.size))} plans each. Ugent will avoid adding more then.`);
  }

  // Evening plans that keep moving.
  const moved = d.reschedules.filter((r) => r.t >= month);
  const eveningMoved = moved.reduce((a, r) => a + (r.evening ?? 0), 0);
  const eveningPlans = d.events.filter((e) => !e.deleted && e.date >= since && e.date <= d0 && toMin(e.start) >= 17 * 60).length;
  if (eveningMoved >= 2 && eveningPlans >= 4) out.push(`You rescheduled ${Math.min(100, pct(eveningMoved, eveningPlans))}% of evening plans this month. Ugent will plan less after 5 PM.`);
  else if (moved.length >= 3) out.push(`Plans changed ${moved.length} times this month, mostly because of ${topReason(moved)}. Ugent adds more buffer when that happens.`);

  // Focus, this week against last week.
  const wk = t - 7 * 86400000;
  const thisWeek = d.focus.filter((f) => f.t >= wk && f.t <= t).reduce((a, f) => a + f.mins, 0);
  const lastWeek = d.focus.filter((f) => f.t >= wk - 7 * 86400000 && f.t < wk).reduce((a, f) => a + f.mins, 0);
  if (thisWeek >= 30) {
    const diff = thisWeek - lastWeek;
    const h = (m: number) => (m >= 60 ? `${(m / 60).toFixed(1).replace('.0', '')} hours` : `${m} minutes`);
    out.push(lastWeek && Math.abs(diff) >= 20 ? `You focused for ${h(thisWeek)} this week, ${h(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} than last week.` : `You focused for ${h(thisWeek)} this week.`);
  }

  // A streak keeps people going.
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const day = addDays(d0, -i);
    if (d.completions.some((c) => fmtDate(new Date(c.t)) === day)) streak++;
    else if (i > 0) break;
  }
  if (streak >= 3) out.push(`You've finished something ${streak} days in a row. Nice rhythm.`);

  return out.slice(0, 4);
}

function topReason(moved: RescheduleLog[]): string {
  const c: Record<string, number> = {};
  for (const r of moved) c[r.reason] = (c[r.reason] ?? 0) + 1;
  const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0];
  return ({ traffic: 'traffic', late: 'running late', power: 'power cuts', tired: 'low energy', emergency: 'family needs' } as Record<string, string>)[top ?? ''] ?? 'changes in the day';
}
