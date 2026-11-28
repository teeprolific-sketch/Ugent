// End-to-end checks for the admin console API: access keys, roles, real actions and their effect on users, audit.
// Run against a live API with two Super Admin keys from `npm run admin:create-staff`:
//   SUPER_KEY=ugk_… SUPER2_KEY=ugk_… node scripts/admin-smoke.mjs [baseUrl]
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const BASE = process.argv[2] ?? 'http://localhost:3000';
let passed = 0;
const step = (name) => { passed++; console.log(`  ok ${passed} - ${name}`); };
async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => null) };
}
const login = async (accessKey) => { const r = await call('POST', '/admin/v1/auth/login', { body: { accessKey } }); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data.token; };
const today = new Date().toISOString().slice(0, 10);

// Access keys
let r = await call('GET', '/admin/v1/me');
assert.equal(r.status, 401);
r = await call('POST', '/admin/v1/auth/login', { body: { accessKey: 'ugk_aaaaaaaa_' + 'b'.repeat(32) } });
assert.equal(r.status, 401);
const S1 = await login(process.env.SUPER_KEY);
const S2 = await login(process.env.SUPER2_KEY);
r = await call('GET', '/admin/v1/me', { token: S1 });
assert.ok(r.data.permissions.includes('staff.manage'));
step('access keys: no key and a wrong key are refused; a Super Admin key signs in');

// Super Admin adds staff; each gets a personal key, shown once
const add = async (name, role) => { const x = await call('POST', '/admin/v1/staff', { token: S1, body: { name, role, reason: 'Smoke test staff' } }); assert.equal(x.status, 201, JSON.stringify(x.data)); assert.match(x.data.accessKey, /^ugk_/); return x.data; };
const support = await add('Bola Support', 'support');
const finance = await add('Halima Finance', 'finance');
const tns = await add('Ifeanyi Safety', 'tns');
const ops = await add('Sani Ops', 'ops');
const SUP = await login(support.accessKey), FIN = await login(finance.accessKey), TNS = await login(tns.accessKey), OPS = await login(ops.accessKey);
r = await call('GET', '/admin/v1/staff', { token: S1 });
assert.ok(r.data.staff.every((s) => s.keys.every((k) => !('keyHash' in k) && k.hint.endsWith('…'))));
r = await call('GET', '/admin/v1/staff', { token: SUP });
assert.equal(r.status, 403);
step('staff: Super Admin adds Support, Finance, Trust & Safety and Ops; keys are never listed; Support can\'t manage staff');

// A real user to act on
const dev = randomUUID();
r = await call('POST', '/api/auth/device', { body: { deviceId: dev, platform: 'android', name: 'Adaeze Okafor' } });
const U = r.data.token; const uid = r.data.me.id;
r = await call('POST', '/api/support', { token: U, body: { topic: 'problem', message: 'Ugent moved my meeting. Call me on 0803 123 4567 or ada@gmail.com, I am Adaeze', contact: '+2348031234567' } });
assert.equal(r.status, 201);

// Role boundaries, enforced by the server
r = await call('GET', '/admin/v1/users', { token: FIN });
assert.equal(r.status, 403);
r = await call('GET', '/admin/v1/tickets', { token: FIN });
assert.equal(r.status, 403);
r = await call('GET', '/admin/v1/usage', { token: FIN });
assert.equal(r.status, 200);
r = await call('GET', `/admin/v1/users?q=${uid}`, { token: SUP });
assert.equal(r.data.users[0].name, 'Adaeze O.');
step('roles: Finance is refused users and tickets but sees usage; Support sees users with masked names');

// Support ticket is redacted
r = await call('GET', '/admin/v1/tickets', { token: SUP });
const ticket = r.data.tickets.find((t) => t.userId === uid);
r = await call('GET', `/admin/v1/tickets/${ticket.id}`, { token: SUP });
for (const leak of ['0803', 'ada@gmail.com', 'Adaeze']) assert.equal(JSON.stringify(r.data.ticket).includes(leak), false, leak);
assert.match(r.data.ticket.contact, /•••/);
r = await call('POST', `/admin/v1/tickets/${ticket.id}`, { token: SUP, body: { action: 'reply', body: 'Thanks, we are looking into it.' } });
assert.equal(r.status, 200);
step('support: ticket text and contact are redacted; Support replies');

// Suspend really stops the user; restore lets them back
r = await call('POST', `/admin/v1/users/${uid}`, { token: SUP, body: { action: 'ban', reason: 'Trying to ban as Support' } });
assert.equal(r.status, 403);
r = await call('POST', `/admin/v1/users/${uid}`, { token: SUP, body: { action: 'suspend', reason: 'x' } });
assert.equal(r.status, 400);
r = await call('POST', `/admin/v1/users/${uid}`, { token: SUP, body: { action: 'suspend', reason: 'Checking a report about this account' } });
assert.equal(r.status, 200);
r = await call('GET', '/api/me', { token: U });
assert.equal(r.status, 401); // suspension also signed them out everywhere
r = await call('POST', '/api/auth/device', { body: { deviceId: dev, platform: 'android' } });
const U2 = r.data.token;
r = await call('GET', '/api/me', { token: U2 });
assert.equal(r.status, 403); assert.equal(r.data.error, 'account_suspended');
r = await call('POST', `/admin/v1/users/${uid}`, { token: SUP, body: { action: 'restore', reason: 'Report checked, all fine' } });
r = await call('GET', '/api/me', { token: U2 });
assert.equal(r.status, 200);
step('users: Support can\'t ban; a reason is required; suspend signs the user out and blocks them; restore lets them back');

// Force logout
r = await call('POST', `/admin/v1/users/${uid}`, { token: SUP, body: { action: 'logout', reason: 'User lost their phone' } });
r = await call('GET', '/api/me', { token: U2 });
assert.equal(r.status, 401); assert.equal(r.data.error, 'signed_out');
r = await call('POST', '/api/auth/device', { body: { deviceId: dev, platform: 'android' } });
const U3 = r.data.token;
step('users: force logout invalidates every existing session');

// Kill switches reach the user's policy and chat
r = await call('GET', '/api/config', { token: U3 });
assert.equal(r.data.policy.disabledActions.includes('addTask'), false);
assert.ok(r.data.policy.disabledActions.includes('payBill'));
r = await call('POST', '/admin/v1/controls', { token: OPS, body: { op: 'kill', targetType: 'action', targetKey: 'addTask', reason: 'Ops trying an action switch' } });
assert.equal(r.status, 403);
r = await call('POST', '/admin/v1/controls', { token: TNS, body: { op: 'kill', targetType: 'action', targetKey: 'addTask', reason: 'Testing the kill switch' } });
assert.equal(r.status, 200); const ks = r.data.id;
await new Promise((res) => setTimeout(res, 11000)); // the server caches switches for 10 s
r = await call('GET', '/api/config', { token: U3 });
assert.ok(r.data.policy.disabledActions.includes('addTask'));
r = await call('POST', '/api/chat', { token: U3, body: { message: 'Remind me to buy bread tomorrow', history: [], lang: 'en', localNow: `${today}T10:00`, state: { name: 'Ada', peak: 'morning', learn: true, focusMins: 50, events: [], tasks: [], completions: [] } } });
assert.equal(r.status, 200);
assert.equal(r.data.reply.actions.some((a) => a.type === 'addTask'), false);
assert.match(r.data.reply.text, /add a task is paused/);
r = await call('GET', `/admin/v1/activity?user=${uid}&status=blocked`, { token: TNS });
assert.ok(r.data.events.some((e) => e.actionType === 'addTask' && e.errorCode === 'ACTION_DISABLED'));
assert.equal(JSON.stringify(r.data).toLowerCase().includes('bread'), false);
r = await call('POST', '/admin/v1/controls', { token: TNS, body: { op: 'clear', id: ks, reason: 'Test finished' } });
assert.equal(r.status, 200);
step('kill switch: Ops can\'t switch off actions; Trust & Safety can; the phone\'s policy and chat drop the action; activity shows it blocked, with no content');

r = await call('POST', '/admin/v1/controls', { token: OPS, body: { op: 'kill', targetType: 'integration', targetKey: 'googleMaps', reason: 'Maps quota exhausted' } });
assert.equal(r.status, 200); const ks2 = r.data.id;
await new Promise((res) => setTimeout(res, 11000));
r = await call('POST', '/api/maps/eta', { token: U3, body: { origin: 'Yaba', destination: 'Ikeja' } });
assert.equal(r.status, 503); assert.equal(r.data.error, 'integration_paused');
await call('POST', '/admin/v1/controls', { token: OPS, body: { op: 'clear', id: ks2, reason: 'Quota reset' } });
step('kill switch: Ops pauses an integration and the server refuses it');

// Maker-checker: money actions need a second Super Admin
r = await call('POST', '/admin/v1/controls', { token: S1, body: { op: 'request_enable', key: 'buyAirtime', reason: 'Beta test of airtime' } });
assert.equal(r.status, 201); const ap = r.data.id;
r = await call('POST', `/admin/v1/approvals/${ap}`, { token: S1, body: { decision: 'approve', reason: 'Approving my own request' } });
assert.equal(r.status, 403); assert.equal(r.data.error, 'own_request');
r = await call('POST', `/admin/v1/approvals/${ap}`, { token: FIN, body: { decision: 'approve', reason: 'Finance approving' } });
assert.equal(r.status, 403);
r = await call('POST', `/admin/v1/approvals/${ap}`, { token: S2, body: { decision: 'approve', reason: 'Checked the limits, fine for beta' } });
assert.equal(r.status, 200);
await new Promise((res) => setTimeout(res, 11000));
r = await call('GET', '/api/config', { token: U3 });
assert.equal(r.data.policy.disabledActions.includes('buyAirtime'), false);
step('approvals: a money action needs a second Super Admin; nobody approves their own request; Finance can\'t approve');

// Trust level: new accounts may do calls and messages (after confirming); staff can only lower it; only the user raises it
r = await call('GET', '/api/config', { token: U3 });
assert.equal(r.data.policy.trustLevel, 2);
r = await call('POST', `/admin/v1/users/${uid}`, { token: TNS, body: { action: 'trust_lower', reason: 'Too many sends' } });
assert.equal(r.status, 200);
r = await call('GET', '/api/config', { token: U3 });
assert.equal(r.data.policy.trustLevel, 1);
r = await call('POST', '/api/me/trust', { token: U3, body: { level: 2 } });
assert.equal(r.status, 200);
assert.equal(r.data.policy.trustLevel, 2);
r = await call('POST', '/api/me/trust', { token: U3, body: { level: 5 } });
assert.equal(r.status, 400);
step('trust level: starts at 2; staff can lower it and the phone sees it; only the user can raise it again');

// Telemetry takes no free text
r = await call('POST', '/api/telemetry/actions', { token: U3, body: { events: [{ type: 'message', status: 'executed', text: 'hello Mum' }] } });
assert.equal(r.status, 400);
r = await call('POST', '/api/telemetry/actions', { token: U3, body: { events: [{ type: 'message', status: 'executed', latencyMs: 900 }] } });
assert.equal(r.status, 200);
step('telemetry: free text is rejected, content-free events are accepted');

// Incidents
r = await call('POST', '/admin/v1/incidents', { token: OPS, body: { title: 'Slow cloud replies', severity: 'SEV-2', components: 'Cloud chat', reason: 'p95 latency above 8 s' } });
assert.equal(r.status, 201); const inc = r.data.id;
r = await call('POST', `/admin/v1/incidents/${inc}`, { token: OPS, body: { action: 'resolve', body: 'Provider recovered' } });
assert.equal(r.status, 200);
r = await call('POST', '/admin/v1/incidents', { token: SUP, body: { title: 'x', severity: 'SEV-3', reason: 'Support trying' } });
assert.equal(r.status, 403);
step('incidents: Ops opens and resolves; Support can\'t');

// Privacy: deletion request processed by Support
r = await call('POST', '/api/privacy/requests', { token: U3, body: { type: 'deletion' } });
assert.equal(r.status, 201); const dr = r.data.id;
r = await call('POST', `/admin/v1/privacy/${dr}`, { token: SUP, body: { action: 'run_deletion', reason: 'User asked to delete their account' } });
assert.equal(r.status, 200);
r = await call('GET', '/api/me', { token: U3 });
assert.equal(r.status, 401);
step('privacy: the user asks for deletion; Support runs the workflow; the account is gone');

// Audit trail and revoking a key
r = await call('GET', '/admin/v1/audit?view=controls', { token: S1 });
assert.ok(r.data.entries.some((e) => e.action === 'controls.kill' && e.reason === 'Testing the kill switch'));
assert.ok(r.data.entries.some((e) => e.action === 'approval.approve'));
r = await call('GET', '/admin/v1/audit', { token: SUP });
assert.equal(r.status, 403);
const sup = (await call('GET', '/admin/v1/staff', { token: S1 })).data.staff.find((s) => s.name === 'Bola Support');
r = await call('POST', `/admin/v1/staff/${sup.id}`, { token: S1, body: { action: 'revoke_key', keyId: sup.keys[0].id, reason: 'Laptop lost' } });
assert.equal(r.status, 200);
r = await call('GET', '/admin/v1/users', { token: SUP });
assert.equal(r.status, 401);
step('audit: every change is logged with its reason; Support can\'t read the audit log; a revoked key ends its session');

console.log(`\nAll ${passed} admin checks passed.`);
