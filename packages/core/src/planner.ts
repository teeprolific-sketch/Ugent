/* Learns the user's energy pattern, finds free time, and reschedules when life happens.
 * Every function is pure: pass `now` in, get new data out. Nothing here touches storage or the clock.
 */
import { addDays, fmtDate, fromMin, minOfDay, toMin } from './dates';
import type { DateStr, Kind, Move, Peak, PlanEvent, PlannerState, Reason } from './types';

export const DAY_START = 7 * 60;
export const DAY_END = 21 * 60 + 30;
const BUF = 10; // minutes between plans
export const PEAK_START: Record<Peak, number> = { morning: 9 * 60, afternoon: 13 * 60, evening: 18 * 60 };

export function periodOf(hour: number): Peak {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'evening';
}

/** Finished tasks by time of day over the last 14 days. */
export function energyPattern(state: Pick<PlannerState, 'log'>, now: Date): Record<Peak, number> {
  const since = now.getTime() - 14 * 86400000;
  const counts: Record<Peak, number> = { morning: 0, afternoon: 0, evening: 0 };
  for (const c of state.log.completions) if (c.t >= since && c.t <= now.getTime()) counts[periodOf(new Date(c.t).getHours())]++;
  return counts;
}

/** The learned best time once there is enough history (8+ finished tasks); otherwise the one the user chose. */
export function bestTime(state: Pick<PlannerState, 'log' | 'learn' | 'peak'>, now: Date): Peak {
  if (state.learn) {
    const c = energyPattern(state, now);
    if (c.morning + c.afternoon + c.evening >= 8) return (Object.keys(c) as Peak[]).sort((a, b) => c[b] - c[a])[0];
  }
  return state.peak;
}

const roundUp = (m: number, step = 15) => Math.ceil(m / step) * step;
const live = (events: PlanEvent[]) => events.filter((e) => !e.deleted);

function freeSlot(events: PlanEvent[], date: DateStr, earliest: number, dur: number, ignore?: Set<string>): number | null {
  const busy = live(events)
    .filter((e) => e.date === date && !(ignore && ignore.has(e.id)))
    .map((e) => [toMin(e.start), toMin(e.start) + e.dur] as const)
    .sort((a, b) => a[0] - b[0]);
  let t = roundUp(Math.max(earliest, DAY_START));
  for (const [s, e] of busy) {
    if (t + dur + BUF <= s) break;
    if (e + BUF > t) t = roundUp(e + BUF);
  }
  return t + dur <= DAY_END ? t : null;
}

/** First free time on or after (date, earliest). Rolls to the next day's best time when a day is full. */
function place(events: PlanEvent[], date: DateStr, earliest: number, dur: number, ignore: Set<string> | undefined, peakStart: number) {
  for (let i = 0; i < 7; i++) {
    const t = freeSlot(events, date, earliest, dur, ignore);
    if (t !== null) return { date, start: fromMin(t) };
    date = addDays(date, 1);
    earliest = peakStart;
  }
  return { date, start: fromMin(earliest) };
}

/** Best slot for a new plan: heavy work goes into the user's best time, everything else into the next gap. */
export function suggestSlot(state: PlannerState, kind: Kind, dur: number, now: Date, date?: DateStr) {
  const d0 = fmtDate(now);
  const nowM = minOfDay(now);
  date = date ?? d0;
  const ps = PEAK_START[bestTime(state, now)];
  let earliest = date === d0 ? nowM + 15 : DAY_START + 60;
  if (kind === 'deep') {
    if (date === d0 && nowM > ps + 120) { date = addDays(date, 1); earliest = ps; } else earliest = Math.max(earliest, ps);
  }
  return place(state.events, date, earliest, dur, undefined, ps);
}

/** Works out what to move for a disruption. Returns the moves; does not change anything. */
export function computeReschedule(state: PlannerState, reason: Reason, now: Date): { moves: Move[]; fixedSoon: PlanEvent | null } {
  const d0 = fmtDate(now);
  const nowM = minOfDay(now);
  const events = live(state.events).map((e) => ({ ...e }));
  const upcoming = events
    .filter((e) => e.date === d0 && toMin(e.start) >= nowM - 5)
    .sort((a, b) => toMin(a.start) - toMin(b.start));
  const ps = PEAK_START[bestTime(state, now)];

  let pick: PlanEvent[] = [];
  let target: (e: PlanEvent) => { date: DateStr; earliest: number } = () => ({ date: d0, earliest: nowM });
  if (reason === 'traffic' || reason === 'late') {
    const shift = reason === 'traffic' ? 45 : 30;
    pick = upcoming.filter((e) => !e.fixed && toMin(e.start) < nowM + 180);
    target = (e) => ({ date: d0, earliest: toMin(e.start) + shift });
  } else if (reason === 'power') {
    pick = upcoming.filter((e) => !e.fixed && e.needsPower && toMin(e.start) < nowM + 180);
    target = () => ({ date: d0, earliest: nowM + 180 });
  } else if (reason === 'tired') {
    pick = upcoming.filter((e) => !e.fixed && e.kind === 'deep');
    target = () => ({ date: addDays(d0, 1), earliest: ps });
  } else if (reason === 'emergency') {
    pick = upcoming.filter((e) => !e.fixed);
    target = () => ({ date: addDays(d0, 1), earliest: DAY_START + 60 });
  }

  const ignore = new Set(pick.map((e) => e.id));
  const moves: Move[] = [];
  for (const e of pick) {
    const tg = target(e);
    const slot = place(events, tg.date, tg.earliest, e.dur, ignore, ps);
    moves.push({ id: e.id, title: e.title, fromDate: e.date, from: e.start, toDate: slot.date, to: slot.start });
    e.date = slot.date;
    e.start = slot.start;
    ignore.delete(e.id);
  }
  const fixedSoon = reason === 'traffic' || reason === 'late'
    ? upcoming.find((e) => e.fixed && toMin(e.start) < nowM + 120) ?? null
    : null;
  return { moves, fixedSoon };
}

/** Apply moves to a list of events (returns a new array). */
export function applyMoves(events: PlanEvent[], moves: Move[], at: number): PlanEvent[] {
  const byId = new Map(moves.map((m) => [m.id, m]));
  return events.map((e) => {
    const m = byId.get(e.id);
    return m ? { ...e, date: m.toDate, start: m.to, updatedAt: at } : e;
  });
}

export type HeadsUp = { key: 'headsTraffic' | 'headsPower'; ev: PlanEvent } | { key: 'headsPeak' };

/** One useful heads-up for the daily brief. */
export function headsUp(state: PlannerState, now: Date): HeadsUp {
  const d0 = fmtDate(now);
  const nowM = minOfDay(now);
  const up = live(state.events).filter((e) => e.date === d0 && toMin(e.start) > nowM).sort((a, b) => toMin(a.start) - toMin(b.start));
  const rush = up.find((e) => e.fixed && e.kind !== 'meeting' && toMin(e.start) >= 16 * 60 && toMin(e.start) <= 20 * 60);
  if (rush) return { key: 'headsTraffic', ev: rush };
  const pw = up.find((e) => e.needsPower);
  if (pw) return { key: 'headsPower', ev: pw };
  return { key: 'headsPeak' };
}

/** Draft for the people waiting on a fixed-time plan. */
export function lateMessage(reason: Reason, ev: PlanEvent): string {
  const mins = reason === 'traffic' ? 45 : 30;
  return `Hi, I'm running about ${mins} minutes late for "${ev.title}" because of ${reason === 'traffic' ? 'traffic' : 'a delay'}. Sorry, I'm on my way.`;
}
