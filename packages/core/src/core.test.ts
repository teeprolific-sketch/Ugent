import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyMoves, bestTime, computeReschedule, conflictFix, detectRoutines, findConflicts, insights, extractTitle, fmtDate, headsUp, parseTime, respond, routineToSuggest, sampleDay, scamCheck, searchLangs, suggestSlot, t } from './index';
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

test('clashes are found and fixed by moving the flexible plan', () => {
  const now = at(8);
  const s = stateAt(now);
  const clash = { ...s.events.find((e) => e.title === 'Client call with Kemi')!, id: 'x1', title: 'Pick up fabric', start: '14:15', fixed: false, kind: 'errand' as const, dur: 30 };
  const events = [...s.events, clash];
  const cs = findConflicts(events, fmtDate(now));
  assert.equal(cs.length, 1);
  const fix = conflictFix({ ...s, events }, cs[0], now)!;
  assert.equal(fix.id, 'x1');
  assert.ok(fix.to >= '14:45');
  // Two fixed plans that clash cannot be moved automatically.
  assert.equal(conflictFix({ ...s, events }, { first: cs[0].first, second: { ...clash, fixed: true } }, now), null);
});

test('insights speak plainly about real patterns', () => {
  const now = at(12);
  const s = sampleDay(now);
  const lines = insights({ completions: s.completions, events: s.events, reschedules: [{ t: now.getTime() - 86400000, reason: 'traffic', n: 3, evening: 2 }, { t: now.getTime() - 2 * 86400000, reason: 'traffic', n: 1 }, { t: now.getTime() - 3 * 86400000, reason: 'power', n: 1 }], focus: s.focus }, now);
  // The sample week is split almost evenly around 11 AM, so no "before 11" claim; the other patterns show.
  assert.ok(!lines.some((l) => /before 11 AM/.test(l)), lines.join(' | '));
  assert.ok(lines.some((l) => /mostly because of traffic/.test(l)));
  assert.ok(lines.length >= 2 && lines.length <= 4);
  // A clearly morning person gets the morning insight.
  const mornings = Array.from({ length: 10 }, (_, i) => ({ t: new Date(2026, 10, 7 - (i % 6), 9, i).getTime() }));
  assert.match(insights({ completions: mornings, events: [], reschedules: [], focus: [] }, now)[0], /You finish 100% of your tasks before 11 AM/);
  assert.ok(lines.every((l) => !/NaN|undefined/.test(l)));
});

test('ecosystem: Sleek bookings, robot commands and scam checks from chat', () => {
  const now = at(10);
  const s = stateAt(now);
  const sleek = respond('Book a plumber tomorrow at 10am', s, { lang: 'en', now, fmtTime }).actions[0];
  assert.deepEqual(sleek, { type: 'ecosystem', product: 'sleek', command: 'book plumber', detail: 'Book a plumber tomorrow at 10am', date: '2026-11-08', start: '10:00' });
  assert.equal((respond('Domestica status', s, { lang: 'en', now, fmtTime }).actions[0] as { command: string }).command, 'status');
  assert.equal((respond('Tell Afrika I to patrol the farm', s, { lang: 'en', now, fmtTime }).actions[0] as { product: string }).product, 'afrika');
  assert.match(respond('Is this a scam: URGENT send your BVN and OTP now or your account will be blocked', s, { lang: 'en', now, fmtTime }).text, /looks like a scam/);
});

test('admin: roles get exactly their permissions; Finance never sees users or activity', async () => {
  const { roleCan, staffCan, STAFF_ROLES, PERMISSIONS } = await import('./index');
  for (const p of PERMISSIONS) assert.equal(roleCan('super', p), true, p);
  for (const p of ['users.view', 'activity.view', 'support.view', 'privacy.view', 'audit.view'] as const) assert.equal(roleCan('finance', p), false, p);
  assert.equal(roleCan('support', 'users.ban'), false);
  assert.equal(roleCan('support', 'staff.manage'), false);
  assert.equal(roleCan('tns', 'controls.kill_action'), true);
  assert.equal(roleCan('ops', 'controls.kill_action'), false);
  assert.equal(roleCan('ops', 'controls.kill_integration'), true);
  for (const r of STAFF_ROLES) assert.equal(roleCan(r, 'overview.view'), true, r);
  for (const r of STAFF_ROLES.filter((x) => x !== 'super')) assert.equal(roleCan(r, 'approvals.decide') || roleCan(r, 'staff.manage'), false, r);
  assert.equal(staffCan(['growth', 'support'], 'users.view'), true);
});

test('admin: action policy blocks switched-off, not-live, suspended and above-trust actions', async () => {
  const { actionAllowed, actionSummary } = await import('./index');
  const p = { disabledActions: ['message'], trustLevel: 1, status: 'active' as const };
  assert.deepEqual(actionAllowed(p, 'addTask'), { ok: true });
  assert.equal(actionAllowed(p, 'message').ok, false);
  assert.equal(actionAllowed({ ...p, disabledActions: [] }, 'call').ok, false); // trust level 1 < 2
  assert.equal(actionAllowed({ ...p, disabledActions: [], trustLevel: 2 }, 'call').ok, true);
  assert.equal(actionAllowed({ ...p, disabledActions: [], trustLevel: 2 }, 'payBill').ok, false); // not live
  assert.equal(actionAllowed({ ...p, status: 'suspended' }, 'addTask').ok, false);
  const s = actionSummary({ type: 'message', channel: 'whatsapp', name: 'Mum', phone: '08031234567', text: 'Call me back' });
  assert.equal(s, 'WhatsApp to a contact · 12 characters');
  assert.equal(/Mum|0803|Call me/.test(s), false);
});

test('redaction removes numbers, emails, OTPs and known names; masking keeps a hint only', async () => {
  const { redactText, maskPhone, maskEmail } = await import('./index');
  const r = redactText('Hi, na Ngozi. Send ₦5,000 to 0123456789, my number na 0803 123 4567, email ada@gmail.com, OTP is 482913, card 4111 1111 1111 1111', ['Ngozi']);
  for (const leak of ['Ngozi', '0123456789', '0803', 'ada@gmail.com', '482913', '4111']) assert.equal(r.includes(leak), false, leak);
  assert.match(r, /\[name\]/); assert.match(r, /\[email\]/); assert.match(r, /OTP \[hidden\]/i);
  assert.equal(redactText('Meet at 4pm, room 12, 2 bags of rice'), 'Meet at 4pm, room 12, 2 bags of rice');
  assert.equal(maskPhone('+2348031234567'), '+234 803 ••• ••67');
  assert.equal(maskEmail('ada.obi@gmail.com'), 'a•••••@gmail.com');
});
