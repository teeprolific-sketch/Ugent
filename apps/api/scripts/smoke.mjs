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
