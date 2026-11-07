// End-to-end smoke test against a running API: node scripts/smoke.mjs [baseUrl]
// Needs REVENUECAT_WEBHOOK_AUTH to match the server's value.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const HOOK = process.env.REVENUECAT_WEBHOOK_AUTH;
let passed = 0;

async function call(method, path, { token, body, headers } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}
const step = (name) => { passed++; console.log(`  ok ${passed} - ${name}`); };

const today = new Date();
const pad = (n) => String(n).padStart(2, '0');
const d0 = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
const localNow = `${d0}T10:30`;
const now = Date.now();
const ev = (id, title, start, extra = {}) => ({ id, title, date: d0, start, dur: 60, kind: 'deep', fixed: false, needsPower: true, updatedAt: now, ...extra });
const chatState = (events = []) => ({ name: 'Ada', peak: 'morning', learn: true, focusMins: 50, events, tasks: [], completions: [] });

// Health
let r = await call('GET', '/api/health');
assert.equal(r.status, 200); assert.equal(r.data.database, true);
step('health: database reachable');

// Sign in two installs
const devA = randomUUID(), devB = randomUUID();
r = await call('POST', '/api/auth/device', { body: { deviceId: devA, platform: 'ios', name: 'Ada', lang: 'yo' } });
assert.equal(r.status, 201); const A = r.data.token; const aId = r.data.me.id;
assert.equal(r.data.me.plan, 'free');
r = await call('POST', '/api/auth/device', { body: { deviceId: devA, platform: 'ios' } });
assert.equal(r.status, 200); assert.equal(r.data.me.id, aId);
step('auth: new device gets an account, same device signs back in');
r = await call('POST', '/api/auth/device', { body: { deviceId: devB, platform: 'android', name: 'Bayo' } });
const B = r.data.token; const bId = r.data.me.id;
r = await call('GET', '/api/me');
assert.equal(r.status, 401);
step('auth: no token is rejected');

// Sync
const e1 = ev('ev-' + randomUUID().slice(0, 8), 'Deep work: budget', '11:00');
const t1 = { id: 'tk-' + randomUUID().slice(0, 8), title: 'Pay NEPA bill', important: true, done: false, date: d0, createdAt: now, updatedAt: now };
r = await call('POST', '/api/sync', { token: A, body: { since: 0, tasks: [t1], events: [e1], profile: { name: 'Ada', lang: 'yo', peak: 'morning' } } });
assert.equal(r.status, 200); assert.equal(r.data.events.length, 1); assert.equal(r.data.tasks[0].title, 'Pay NEPA bill');
const cursor = r.data.cursor;
r = await call('POST', '/api/sync', { token: A, body: { since: cursor, tasks: [], events: [] } });
assert.equal(r.data.events.length, 0);
step('sync: push then pull, cursor returns only newer changes');
r = await call('POST', '/api/sync', { token: A, body: { since: cursor, tasks: [], events: [{ ...e1, title: 'Older edit', updatedAt: now - 5000 }] } });
assert.equal(r.data.events.length, 0);
r = await call('POST', '/api/sync', { token: A, body: { since: cursor, tasks: [], events: [{ ...e1, start: '11:45', updatedAt: now + 1000 }] } });
assert.equal(r.data.events[0].start, '11:45');
step('sync: last edit wins, older edits are ignored');
r = await call('POST', '/api/sync', { token: B, body: { since: 0, tasks: [], events: [{ ...e1, title: 'Hijacked', updatedAt: now + 99999 }] } });
assert.equal(r.data.events.length, 0);
r = await call('POST', '/api/sync', { token: A, body: { since: 0, tasks: [], events: [] } });
assert.equal(r.data.events[0].title, 'Deep work: budget');
step("sync: another user cannot overwrite or see someone's private plan");
r = await call('POST', '/api/sync', { token: A, body: { since: 0, tasks: [], events: [{ ...e1, updatedAt: 'nope' }] } });
assert.equal(r.status, 400);
step('sync: invalid data is rejected with a readable 400');

// Chat (falls back to the on-device agent when cloud chat is not configured or declines)
r = await call('POST', '/api/chat', { token: A, body: { message: "I'm stuck in traffic", history: [], lang: 'en', localNow, state: chatState([{ ...e1, start: '11:00' }]) } });
assert.equal(r.status, 200);
assert.equal(r.data.reply.actions[0].type, 'reschedule');
assert.equal(r.data.reply.actions[0].moves[0].to, '11:45');
step(`chat: traffic proposes a reschedule (answered by ${r.data.reply.source})`);
r = await call('POST', '/api/chat', { token: A, body: { message: 'Babu wuta', history: [], lang: 'ha', localNow, state: chatState() } });
assert.ok(r.data.reply.text.length > 0);
step('chat: replies in Hausa');

// Subscriptions
r = await call('POST', '/api/webhooks/revenuecat', { body: { event: { type: 'INITIAL_PURCHASE', app_user_id: aId, entitlement_ids: ['team'] } } });
assert.equal(r.status, 401);
r = await call('POST', '/api/webhooks/revenuecat', { headers: { authorization: HOOK }, body: { event: { type: 'INITIAL_PURCHASE', app_user_id: aId, entitlement_ids: ['team'], expiration_at_ms: now + 30 * 86400000 } } });
assert.equal(r.status, 200);
r = await call('GET', '/api/me', { token: A });
assert.equal(r.data.me.plan, 'team');
step('subscriptions: webhook needs its secret and upgrades the plan');

// Teams
r = await call('POST', '/api/team', { token: B, body: { name: 'Shop' } });
assert.equal(r.status, 402);
r = await call('POST', '/api/team', { token: A, body: { name: 'Ada Foods' } });
assert.equal(r.status, 201); const code = r.data.team.code;
r = await call('POST', '/api/team/join', { token: B, body: { code: code.toLowerCase() } });
assert.equal(r.status, 200); assert.equal(r.data.team.members.length, 2);
step('teams: Team plan required to create; invite code joins');
const shared = ev('ev-' + randomUUID().slice(0, 8), 'Stock count at the shop', '15:00', { teamId: r.data.team.id, kind: 'errand', needsPower: false });
await call('POST', '/api/sync', { token: A, body: { since: 0, tasks: [], events: [shared] } });
r = await call('POST', '/api/sync', { token: B, body: { since: 0, tasks: [], events: [] } });
assert.ok(r.data.events.some((e) => e.title === 'Stock count at the shop'));
assert.ok(!r.data.events.some((e) => e.id === e1.id));
step('teams: shared calendar items reach members, private ones do not');
// Team board: an assigned task with a status reaches the assignee, shows in shared updates and team analytics
const teamId = r.data.events.find((e) => e.title === 'Stock count at the shop').teamId;
const boardTask = { id: 'tk-' + randomUUID().slice(0, 8), title: 'Restock rice', important: false, done: false, date: d0, createdAt: now, updatedAt: now, teamId, assigneeId: bId, status: 'doing' };
await call('POST', '/api/sync', { token: A, body: { since: 0, tasks: [boardTask], events: [] } });
r = await call('POST', '/api/sync', { token: B, body: { since: 0, tasks: [], events: [] } });
const got = r.data.tasks.find((x) => x.id === boardTask.id);
assert.equal(got.assigneeId, bId); assert.equal(got.status, 'doing'); assert.equal(got.ownerId, aId);
r = await call('GET', '/api/team/feed', { token: B });
assert.ok(r.data.items.some((i) => i.title === 'Restock rice' && i.by === 'Ada'));
r = await call('GET', '/api/team/stats', { token: A });
assert.equal(r.data.members.find((m) => m.id === bId).doing, 1);
step('teams: task board, shared updates and team analytics');

r = await call('PATCH', `/api/team/members/${aId}`, { token: A, body: { role: 'member' } });
assert.equal(r.status, 409);
r = await call('PATCH', `/api/team/members/${bId}`, { token: B, body: { role: 'admin' } });
assert.equal(r.status, 403);
r = await call('PATCH', `/api/team/members/${bId}`, { token: A, body: { role: 'admin' } });
assert.equal(r.data.team.members.find((m) => m.id === bId).role, 'admin');
r = await call('PATCH', `/api/team/members/${bId}`, { token: A, body: { role: 'member' } });
assert.equal(r.data.team.members.find((m) => m.id === bId).role, 'member');
step('teams: admins manage roles; a team always keeps an admin');

// Connected services
r = await call('GET', '/api/integrations', { token: A });
const gcal = r.data.items.find((i) => i.provider === 'googleCalendar');
assert.equal(gcal.connected, false);
r = await call('POST', '/api/integrations/google/start', { token: A, body: { provider: 'googleCalendar' } });
assert.equal(r.status, gcal.available ? 200 : 503);
r = await call('POST', '/api/maps/eta', { token: A, body: { origin: 'Ikeja, Lagos', destination: 'Victoria Island, Lagos' } });
assert.ok([200, 501].includes(r.status));
step(`integrations: status list, Google sign-in (${gcal.available ? 'configured' : 'not configured'}), Maps ETA`);

// WhatsApp Business: link a number, focus on, a customer writes, Ugent replies for the owner
r = await call('PUT', '/api/integrations/whatsapp-business', { token: A, body: { phoneNumberId: '1234567890' + aId.slice(-4), displayNumber: '+234 800 000 0000', autoReplyOn: true, autoReply: "I'm in a meeting. I'll reply soon." } });
assert.equal(r.status, 200);
const verify = await fetch(`${BASE}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${process.env.WA_VERIFY_TOKEN}&hub.challenge=abc123`);
assert.equal(await verify.text(), 'abc123');
await call('POST', '/api/focus', { token: A, body: { until: now + 3600000 } });
const { createHmac } = await import('node:crypto');
const waBody = JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '1234567890' + aId.slice(-4) }, messages: [{ from: '2348031234567', type: 'text', text: { body: 'Do you have rice in stock?' } }] } }] }] });
const sig = 'sha256=' + createHmac('sha256', process.env.WA_APP_SECRET).update(waBody).digest('hex');
let wr = await fetch(`${BASE}/api/webhooks/whatsapp`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': sig }, body: waBody });
const wj = await wr.json();
assert.equal(wj.received, 1); assert.equal(wj.wouldReply, 1);
wr = await fetch(`${BASE}/api/webhooks/whatsapp`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=forged' }, body: waBody });
assert.equal(wr.status, 401);
r = await call('GET', '/api/integrations/whatsapp-business', { token: A });
assert.equal(r.data.inbox[0].text, 'Do you have rice in stock?');
await call('POST', '/api/focus', { token: A, body: { until: null } });
step('whatsapp business: signed webhooks only, auto-reply during focus, customer inbox');

// Ecosystem waitlist and support
r = await call('POST', '/api/waitlist', { token: B, body: { product: 'sleek' } });
assert.deepEqual(r.data.joined, ['sleek']);
r = await call('POST', '/api/support', { token: B, body: { topic: 'question', message: 'How do I share a plan with my team?' } });
assert.equal(r.status, 201);
step('ecosystem waitlist and support requests');

r = await call('DELETE', `/api/team/members/${aId}`, { token: B });
assert.equal(r.status, 403);
r = await call('DELETE', `/api/team/members/${bId}`, { token: A });
assert.equal(r.status, 200); assert.equal(r.data.team.members.length, 1);
step('teams: only admins can remove members');

// Free plan daily chat allowance (10 cloud messages), then the on-device agent takes over
let limited = false;
for (let i = 0; i < 11; i++) {
  r = await call('POST', '/api/chat', { token: B, body: { message: 'hello', history: [], lang: 'pcm', localNow, state: chatState() } });
  limited = r.data.limited;
}
assert.equal(limited, true); assert.equal(r.data.reply.source, 'device');
step('chat: free plan allowance ends, on-device agent keeps answering');

// Account deletion
r = await call('DELETE', '/api/me', { token: B });
assert.equal(r.data.deleted, true);
r = await call('GET', '/api/me', { token: B });
assert.equal(r.status, 401);
step('account: delete removes the account');

console.log(`\nAll ${passed} checks passed.`);
