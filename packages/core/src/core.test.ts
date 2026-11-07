import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyMoves, bestTime, computeReschedule, extractTitle, fmtDate, headsUp, parseTime, respond, sampleDay, suggestSlot, t } from './index';
import type { PlannerState } from './index';

const at = (h: number, m = 0) => new Date(2026, 10, 7, h, m); // Sat 7 Nov 2026
const fmtTime = (x: string) => x;

function stateAt(now: Date): PlannerState {
  const s = sampleDay(now);
  return { events: s.events, tasks: s.tasks, log: { completions: s.completions }, peak: 'morning', learn: true, focusMins: 50, name: 'Tobi' };
}

test('titles are clean in all six languages', () => {
  assert.equal(extractTitle('Remind me to call Mum tomorrow at 6pm'), 'Call Mum');
  assert.equal(extractTitle('Remind me make I buy fuel by 4'), 'Buy fuel');
  assert.equal(extractTitle('Rán mi létí láti pe Màmá ní 6pm'), 'Pe Màmá');
  assert.equal(extractTitle('Chetara m ịkpọ Mama na 6pm'), 'Ịkpọ Mama');
  assert.equal(extractTitle('Tunatar da ni in kira Mama da 6pm'), 'Kira Mama');
  assert.equal(extractTitle("Rappelle-moi d'appeler Maman à 18h"), 'Appeler Maman');
  assert.equal(extractTitle('Schedule time to finish the budget report'), 'Finish the budget report');
});

test('times: 12-hour, French 24-hour, and "by 4" meaning the afternoon', () => {
  assert.equal(parseTime('at 6pm'), 18 * 60);
  assert.equal(parseTime('a 18h30'), 18 * 60 + 30);
  assert.equal(parseTime('by 4'), 16 * 60);
  assert.equal(parseTime('9:15'), 9 * 60 + 15);
  assert.equal(parseTime('no time here'), null);
});

test('traffic pushes the next flexible plan back 45 minutes and keeps fixed plans', () => {
  const now = at(10, 30);
  const s = stateAt(now);
  const { moves } = computeReschedule(s, 'traffic', now);
  assert.equal(moves.length, 1);
  assert.equal(moves[0].title, 'Deep work: pitch deck');
  assert.equal(moves[0].to, '11:45');
  const after = applyMoves(s.events, moves, now.getTime());
  assert.equal(after.find((e) => e.title === 'Client call with Kemi')!.start, '14:00');
});

test('tired moves heavy work to tomorrow at the best time', () => {
  const now = at(10, 30);
  const { moves } = computeReschedule(stateAt(now), 'tired', now);
  assert.equal(moves[0].toDate, '2026-11-08');
});

test('smart scheduling puts deep work into the best time and avoids clashes', () => {
  const now = at(8);
  const s = stateAt(now);
  // A light day: only the 9:00 stand-up. Deep work goes straight after it, inside the morning peak.
  const light = { ...s, events: s.events.filter((e) => e.title === 'Team stand-up') };
  assert.deepEqual(suggestSlot(light, 'deep', 90, now), { date: fmtDate(now), start: '09:45' });
  // The full sample day has no 90-minute gap left today; tomorrow the 10:00 bank visit pushes it to 11:15.
  assert.deepEqual(suggestSlot(s, 'deep', 90, now), { date: '2026-11-08', start: '11:15' });
});

test('learning: sample history says mornings are best', () => {
  const now = at(8);
  assert.equal(bestTime({ ...stateAt(now), peak: 'evening' }, now), 'morning');
  assert.equal(bestTime({ ...stateAt(now), peak: 'evening', learn: false }, now), 'evening');
});

test('heads-up warns about evening traffic before school pickup', () => {
  const h = headsUp(stateAt(at(10)), at(10));
  assert.equal(h.key, 'headsTraffic');
});

test('agent replies in the chosen language with actions', () => {
  const now = at(10, 30);
  const yo = respond('Ó rẹ̀ mí', stateAt(now), { lang: 'yo', now, fmtTime });
  assert.match(yo.text, /Ìsinmi/);
  assert.equal(yo.actions[0].type, 'reschedule');
  const ha = respond('Babu wuta', stateAt(now), { lang: 'ha', now, fmtTime });
  assert.match(ha.text, /Wuta ta ɗauke/);
  const fr = respond("Rappelle-moi d'appeler Maman à 18h", stateAt(now), { lang: 'fr', now, fmtTime });
  assert.deepEqual(fr.actions[0], { type: 'addEvent', title: 'Appeler Maman', date: '2026-11-07', start: '18:00', dur: 30, kind: 'personal' });
  const draft = respond("tell Kemi I'm running 10 minutes behind", stateAt(now), { lang: 'en', now, fmtTime });
  assert.equal(draft.draft, "Hi Kemi, I'm running 10 minutes behind.");
  assert.equal(respond('this is nice', stateAt(now), { lang: 'en', now, fmtTime }).text, t('en', 'help'));
});

test('copy: singular counts and empty names', () => {
  assert.equal(t('en', 'traffic', { n: 1 }), 'Traffic happens. I can move 1 plan back 45 minutes.');
  assert.equal(t('en', 'greet', { name: '' }), 'Hi. How can I help today?');
});
