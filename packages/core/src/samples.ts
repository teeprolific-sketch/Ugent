/* A sample day so a new user can see how Ugent works. Every item carries sample: true and can be cleared. */
import { addDays, fmtDate, parseDate, uid } from './dates';
import type { Completion, FocusLog, Kind, PlanEvent, RescheduleLog, Task } from './types';

export function sampleDay(now: Date): { events: PlanEvent[]; tasks: Task[]; completions: Completion[]; focus: FocusLog[]; reschedules: RescheduleLog[] } {
  const d0 = fmtDate(now);
  const d1 = addDays(d0, 1);
  const at = now.getTime();
  const ev = (title: string, date: string, start: string, dur: number, kind: Kind, fixed: boolean, needsPower: boolean): PlanEvent =>
    ({ id: uid(), title, date, start, dur, kind, fixed, needsPower, updatedAt: at, sample: true });
  const tk = (title: string, important: boolean, done: boolean, date = d0): Task =>
    ({ id: uid(), title, important, done, date, createdAt: at, doneAt: done ? at : null, updatedAt: at, sample: true });

  const events = [
    ev('Team stand-up', d0, '09:00', 30, 'meeting', true, true),
    ev('Deep work: pitch deck', d0, '11:00', 90, 'deep', false, true),
    ev('Client call with Kemi', d0, '14:00', 45, 'meeting', true, true),
    ev('Buy diesel for the generator', d0, '16:00', 40, 'errand', false, false),
    ev('Pick up the kids from school', d0, '17:30', 30, 'personal', true, false),
    ev('Gym', d0, '19:00', 60, 'personal', false, false),
    ev('Bank visit: update BVN details', d1, '10:00', 60, 'errand', true, false),
  ];
  const tasks = [
    tk('Send invoice to Mrs. Adeyemi', true, false),
    tk('Finish pitch deck slides', true, false),
    tk('Call Mum', false, false),
    tk('Renew car papers', false, false, d1),
    tk('Buy prepaid electricity units', false, true),
  ];

  // A week of history so "Your week" is not empty on day one.
  const perDay = [3, 5, 2, 6, 4, 1];
  const hours = [8, 9, 10, 10, 11, 15, 16, 20];
  const focusMins = [50, 0, 75, 50, 25, 100];
  const completions: Completion[] = [];
  const focus: FocusLog[] = [];
  for (let i = 6; i >= 1; i--) {
    const base = parseDate(addDays(d0, -i));
    for (let j = 0; j < perDay[6 - i]; j++) {
      const c = new Date(base);
      c.setHours(hours[(i + j) % hours.length], 15 + j * 7);
      completions.push({ t: c.getTime(), sample: true });
    }
    const f = new Date(base);
    f.setHours(10);
    if (focusMins[6 - i]) focus.push({ t: f.getTime(), mins: focusMins[6 - i], sample: true });
  }
  return { events, tasks, completions, focus, reschedules: [{ t: at - 2 * 86400000, reason: 'traffic', n: 2, sample: true }] };
}
