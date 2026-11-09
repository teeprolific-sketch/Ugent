import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyMoves, bestTime, computeReschedule, detectRoutines, extractTitle, fmtDate, headsUp, parseTime, respond, routineToSuggest, sampleDay, scamCheck, searchLangs, suggestSlot, t } from './index';
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
  const late = respond("I'm stuck in traffic", { ...stateAt(now), events: stateAt(now).events.map((e) => (e.title === 'Client call with Kemi' ? { ...e, start: '11:15' } : e)) }, { lang: 'en', now, fmtTime });
  assert.match(late.draft ?? '', /running about 45 minutes late for "Client call with Kemi"/);
  assert.equal(respond('this is nice', stateAt(now), { lang: 'en', now, fmtTime }).text, t('en', 'help'));
});

test('copy: singular counts and empty names', () => {
  assert.equal(t('en', 'traffic', { n: 1 }), 'Traffic happens. I can move 1 plan back 45 minutes.');
  assert.equal(t('en', 'greet', { name: '' }), 'Hi. How can I help today?');
});

test('real actions: call, message and directions; reminders stay reminders', () => {
  const now = at(10, 30);
  const s = stateAt(now);
  assert.deepEqual(respond('Call Mum', s, { lang: 'en', now, fmtTime }).actions[0], { type: 'call', name: 'Mum', phone: null });
  const wa = respond("tell Kemi I'm running 10 minutes behind", s, { lang: 'en', now, fmtTime }).actions[0];
  assert.deepEqual(wa, { type: 'message', channel: 'whatsapp', name: 'Kemi', phone: null, text: "Hi Kemi, I'm running 10 minutes behind." });
  // A message that mentions a time is not sent now; Ugent treats it as a plan instead.
  assert.notEqual(respond('text Bayo the meeting is at 3', s, { lang: 'en', now, fmtTime }).actions[0]?.type, 'message');
  assert.equal(respond('sms Bayo I have arrived', s, { lang: 'en', now, fmtTime }).actions[0]?.type, 'message');
  assert.deepEqual(respond('Directions to Balogun Market', s, { lang: 'en', now, fmtTime }).actions[0], { type: 'directions', destination: 'Balogun Market' });
  assert.equal(respond('Remind me to call Mum at 6pm', s, { lang: 'en', now, fmtTime }).actions[0].type, 'addEvent');
  assert.match(respond('Pe Mama', s, { lang: 'yo', now, fmtTime }).text, /Mo lè pe Mama/);
});

test('language search finds languages by any name', () => {
  assert.deepEqual(searchLangs('naija').map((l) => l.code), ['pcm']);
  assert.deepEqual(searchLangs('Yorùbá').map((l) => l.code), ['yo']);
  assert.deepEqual(searchLangs('franc').map((l) => l.code), ['fr']);
  assert.equal(searchLangs('').length, 6);
});

test('scam check flags the classic tricks', () => {
  assert.equal(scamCheck('URGENT: your account will be blocked. Send your BVN and OTP to our customer care now').level, 'high');
  assert.equal(scamCheck('Congratulations you have won N500,000 in the MTN promo. Pay processing fee to claim').level, 'high');
  assert.equal(scamCheck('Hi, see you at church on Sunday').level, 'low');
});

test('daily rhythm: no plans before the user wakes', () => {
  const now = at(5, 0);
  const s = { ...stateAt(now), events: [], day: { start: 8 * 60, end: 20 * 60 } };
  assert.ok(suggestSlot(s, 'personal', 30, now).start >= '08:00');
});

test('remember: personal facts in several languages', () => {
  const now = at(10, 30);
  const s = stateAt(now);
  assert.deepEqual(respond("Remember that my mum's name is Ngozi", s, { lang: 'en', now, fmtTime }).actions[0], { type: 'remember', text: "My mum's name is Ngozi" });
  assert.equal(respond('Make you remember say I close shop by 7 on Saturday', s, { lang: 'pcm', now, fmtTime }).actions[0]?.type, 'remember');
  assert.equal(respond('Souviens-toi que je travaille de nuit le lundi', s, { lang: 'fr', now, fmtTime }).actions[0]?.type, 'remember');
});

test('routines: weekly repeats are learned and suggested on the right day', () => {
  // Gym on three Mondays at about 7 PM, plus one-off plans that must not count.
  const mon = new Date(2026, 10, 9, 8, 0); // Monday 9 Nov 2026
  const ev = (title: string, date: string, start: string) => ({ id: Math.random().toString(36), title, date, start, dur: 60, kind: 'personal' as const, fixed: false, needsPower: false, updatedAt: 0 });
  const events = [ev('Gym', '2026-10-26', '19:00'), ev('Gym', '2026-11-02', '19:15'), ev('gym', '2026-10-19', '18:45'), ev('Dentist', '2026-11-02', '10:00')];
  const routines = detectRoutines(events, mon);
  assert.equal(routines.length, 1);
  assert.equal(routines[0].title, 'Gym'); assert.equal(routines[0].weekday, 1); assert.equal(routines[0].times, 3);
  assert.equal(routineToSuggest(routines, events, mon)?.title, 'Gym');
  assert.equal(routineToSuggest(routines, [...events, ev('Gym', '2026-11-09', '19:00')], mon), null);
});
