/* Demo mode: a pretend admin API that runs in the browser with made-up data.
 * It follows the same rules as the real server (it uses the same permission map from @ugent/core):
 * access keys, roles, reasons, approvals that need a second person, and an audit entry for every change.
 * Nothing here touches real users. */
import type { Permission, StaffRole } from '@ugent/core/admin';
import { ACTION_TYPES, KILL_TARGETS, PERMISSIONS, staffCan, STAFF_ROLES, TRUST_LEVELS } from '@ugent/core/admin';
import { maskEmail, maskPhone, redactText } from '@ugent/core/redact';
import { ApiError, type Transport } from './api';

const H = 3600000, D = 24 * H;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const ahead = (ms: number) => new Date(Date.now() + ms).toISOString();
let seq = 100;
const id = (p: string) => `${p}_${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface Key { id: string; prefix: string; key: string; label: string; expiresAt: string | null; lastUsedAt: string | null; revokedAt: string | null; createdAt: string }
interface Staff { id: string; name: string; email: string | null; roles: StaffRole[]; disabledAt: string | null; createdAt: string; keys: Key[] }

const demoKey = (prefix: string) => `ugk_${prefix}_${'demo'.repeat(8)}`;
const mkStaff = (sid: string, name: string, roles: StaffRole[], prefix: string): Staff => ({
  id: sid, name, email: null, roles, disabledAt: null, createdAt: ago(40 * D),
  keys: [{ id: `key_${prefix}`, prefix, key: demoKey(prefix), label: 'Demo key', expiresAt: ahead(60 * D), lastUsedAt: ago(2 * H), revokedAt: null, createdAt: ago(30 * D) }],
});
const staff: Staff[] = [
  mkStaff('st_ope', 'Ope Adeyemi', ['super'], 'demosupr'),
  mkStaff('st_tolu', 'Tolu Bakare', ['super'], 'demoboss'),
  mkStaff('st_bola', 'Bola Nwosu', ['support'], 'demohelp'),
  mkStaff('st_kemi', 'Kemi Danjuma', ['quality'], 'demoqual'),
  mkStaff('st_ife', 'Ifeanyi Obi', ['tns'], 'demosafe'),
  mkStaff('st_sani', 'Sani Musa', ['ops'], 'demoopsx'),
  mkStaff('st_halima', 'Halima Bello', ['finance'], 'demomony'),
  mkStaff('st_tobi', 'Tobi Ade', ['growth'], 'demogrow'),
  mkStaff('st_guest', 'Investor guest', ['analyst'], 'demoview'),
];
/** Shown on the demo sign-in screen. */
export const DEMO_KEYS = staff.map((s) => ({ name: s.name, role: s.roles[0], key: s.keys[0].key }));

interface DemoUser { id: string; name: string; plan: string; status: string; trustLevel: number; lang: string; platform: string; createdAt: string; lastSeenAt: string; tasks: number; plans: number; connected: string[]; chatsToday: number; sessionVersion: number }
const users: DemoUser[] = [
  { id: 'u_8f3k2a', name: 'Adaeze Okafor', plan: 'pro', status: 'active', trustLevel: 2, lang: 'pcm', platform: 'android', createdAt: ago(72 * D), lastSeenAt: ago(4 * 60000), tasks: 48, plans: 131, connected: ['googleCalendar', 'whatsappBusiness'], chatsToday: 14, sessionVersion: 0 },
  { id: 'u_2m9q7d', name: 'Tunde Bamidele', plan: 'free', status: 'active', trustLevel: 1, lang: 'yo', platform: 'android', createdAt: ago(52 * D), lastSeenAt: ago(H), tasks: 21, plans: 40, connected: [], chatsToday: 6, sessionVersion: 0 },
  { id: 'u_7c1x4p', name: 'Musa Ibrahim', plan: 'team', status: 'active', trustLevel: 2, lang: 'ha', platform: 'ios', createdAt: ago(90 * D), lastSeenAt: ago(20 * 60000), tasks: 210, plans: 388, connected: ['googleCalendar', 'gmail', 'googleTasks'], chatsToday: 31, sessionVersion: 0 },
  { id: 'u_5r8t3k', name: 'Chiamaka Eze', plan: 'free', status: 'active', trustLevel: 0, lang: 'ig', platform: 'android', createdAt: ago(5 * D), lastSeenAt: ago(D), tasks: 3, plans: 5, connected: [], chatsToday: 0, sessionVersion: 0 },
  { id: 'u_9h2w6n', name: 'Kofi Asante', plan: 'pro', status: 'active', trustLevel: 1, lang: 'en', platform: 'web', createdAt: ago(23 * D), lastSeenAt: ago(3 * D), tasks: 17, plans: 22, connected: ['gmail'], chatsToday: 0, sessionVersion: 0 },
  { id: 'u_4k7z1s', name: 'Fatima Sule', plan: 'free', status: 'suspended', trustLevel: 0, lang: 'en', platform: 'android', createdAt: ago(7 * D), lastSeenAt: ago(2 * D), tasks: 2, plans: 1, connected: ['whatsappBusiness'], chatsToday: 0, sessionVersion: 1 },
  { id: 'u_6p3n8b', name: 'Ngozi Umeh', plan: 'pro', status: 'active', trustLevel: 2, lang: 'en', platform: 'ios', createdAt: ago(61 * D), lastSeenAt: ago(2 * H), tasks: 64, plans: 102, connected: ['googleCalendar'], chatsToday: 9, sessionVersion: 0 },
  { id: 'u_3d5v9m', name: 'Emeka Nnadi', plan: 'free', status: 'active', trustLevel: 1, lang: 'pcm', platform: 'android', createdAt: ago(2 * D), lastSeenAt: ago(5 * H), tasks: 4, plans: 6, connected: [], chatsToday: 3, sessionVersion: 0 },
];
const TOTALS = { total: 12840, activeToday: 4182, newThisWeek: 918, byPlan: { free: 10512, pro: 2041, team: 287 }, chatsToday: 26912 };

const EV = (userId: string, actionType: string, status: string, source: string, summary: string, minsAgo: number, errorCode: string | null = null, model: string | null = 'claude-opus-5-5') =>
  ({ id: id('ae'), userId, actionType, risk: ACTION_TYPES.find((a) => a.key === actionType)?.risk ?? 'low', status, source, model, latencyMs: model === 'claude-opus-5-5' ? 1800 + Math.round(Math.random() * 1500) : 12, errorCode, summary, at: ago(minsAgo * 60000) });
const events = [
  EV('u_8f3k2a', 'reschedule', 'proposed', 'cloud', 'Reschedule (traffic) · 2 plans', 3),
  EV('u_8f3k2a', 'reschedule', 'executed', 'device', 'Reschedule the day', 2, null, null),
  EV('u_7c1x4p', 'message', 'proposed', 'cloud', 'WhatsApp to a contact · 84 characters', 9),
  EV('u_7c1x4p', 'message', 'executed', 'device', 'Send a WhatsApp or SMS', 8, null, null),
  EV('u_7c1x4p', 'waAutoReply', 'executed', 'server', 'WhatsApp Business auto-reply', 14, null, null),
  EV('u_4k7z1s', 'message', 'blocked', 'server', 'WhatsApp to a contact · 61 characters', 22, 'ACCOUNT_SUSPENDED'),
  EV('u_2m9q7d', 'addEvent', 'proposed', 'device', 'Add a plan · 30 min', 31, null, 'on-device'),
  EV('u_9h2w6n', 'call', 'failed', 'device', 'Start a phone call', 47, 'CONTACT_NOT_FOUND', null),
  EV('u_8f3k2a', 'payBill', 'blocked', 'server', 'Pay a bill', 58, 'ACTION_DISABLED'),
  EV('u_6p3n8b', 'addTask', 'undone', 'device', 'Add a task', 75, null, null),
  EV('u_3d5v9m', 'remember', 'proposed', 'cloud', 'Remember a fact', 90),
  EV('u_5r8t3k', 'call', 'blocked', 'server', 'Call a contact', 120, 'TRUST_LEVEL'),
];

interface Ticket { id: string; userId: string; topic: string; message: string; contact: string | null; status: string; priority: string; assignedTo: string | null; createdAt: string; replies: { id: string; staffId: string; body: string; createdAt: string }[] }
const tickets: Ticket[] = [
  { id: 's_t1042', userId: 'u_8f3k2a', topic: 'problem', message: 'Ugent moved my 4pm meeting with Kemi without asking me. Call me on 0803 123 4567 if you need to. – Adaeze', contact: '+2348031234567', status: 'open', priority: 'high', assignedTo: null, createdAt: ago(40 * 60000), replies: [] },
  { id: 's_t1041', userId: 'u_7c1x4p', topic: 'problem', message: 'Gmail summary stopped showing in my brief since yesterday. My email is musa@adamafoods.ng', contact: 'musa@adamafoods.ng', status: 'open', priority: 'normal', assignedTo: null, createdAt: ago(5 * H), replies: [] },
  { id: 's_t1039', userId: 'u_9h2w6n', topic: 'question', message: 'How do I cancel Pro? I was charged on my card ending 4111 1111 1111 1111', contact: null, status: 'waiting', priority: 'low', assignedTo: 'st_bola', createdAt: ago(2 * D), replies: [{ id: 'tm_1', staffId: 'st_bola', body: 'You can cancel in Google Play > Subscriptions. Your Pro stays on until the end of the month.', createdAt: ago(D) }] },
  { id: 's_t1036', userId: 'u_2m9q7d', topic: 'idea', message: 'Voice doesn\'t understand my Yoruba when I speak fast.', contact: null, status: 'open', priority: 'normal', assignedTo: null, createdAt: ago(3 * D), replies: [] },
];
const kills: { id: string; targetType: string; targetKey: string; reason: string; setBy: string; clearedBy: string | null; clearedAt: string | null; createdAt: string }[] = [
  { id: 'ks_old1', targetType: 'integration', targetKey: 'googleMaps', reason: 'Maps quota ran out', setBy: 'st_sani', clearedBy: 'st_sani', clearedAt: ago(5 * D), createdAt: ago(5 * D + 3 * H) },
];
const enabled = new Set<string>();
const approvals: { id: string; type: string; payload: { key: string }; summary: string; reason: string; requestedBy: string; decidedBy: string | null; status: string; decisionReason: string | null; expiresAt: string; decidedAt: string | null; createdAt: string }[] = [
  { id: 'ap_31', type: 'enable_action_type', payload: { key: 'buyAirtime' }, summary: 'Switch on "Buy airtime or data" (high risk)', reason: 'Beta test with 12 staff accounts', requestedBy: 'st_tolu', decidedBy: null, status: 'pending', decisionReason: null, expiresAt: ahead(41 * H), decidedAt: null, createdAt: ago(7 * H) },
];
const privacy = [
  { id: 'dr_88', userId: 'u_9h2w6n', type: 'export', status: 'open', source: 'app', dueAt: ahead(3 * D), completedAt: null as string | null, createdAt: ago(27 * D) },
  { id: 'dr_87', userId: 'u_3d5v9m', type: 'deletion', status: 'open', source: 'app', dueAt: ahead(25 * D), completedAt: null as string | null, createdAt: ago(5 * D) },
  { id: 'dr_85', userId: 'u_5r8t3k', type: 'consent_withdrawal', status: 'done', source: 'staff', dueAt: ago(2 * D), completedAt: ago(3 * D) as string | null, createdAt: ago(9 * D) },
];
const incidents = [
  { id: 'INC-7', title: 'Slow replies from the cloud model', severity: 'SEV-2', status: 'monitoring', components: 'Cloud chat', ownerId: 'st_sani', userComms: 'In-app banner: "Replies may be slower right now."', startedAt: ago(3 * H), resolvedAt: null as string | null,
    updates: [{ id: 'iu1', body: 'Opened: p95 latency above 8 s for 10 minutes', at: ago(3 * H), staffId: 'st_sani' }, { id: 'iu2', body: 'On-phone assistant is answering when the cloud takes over 8 s', at: ago(2.6 * H), staffId: 'st_sani' }, { id: 'iu3', body: 'Latency back to 3.1 s; monitoring', at: ago(H), staffId: 'st_sani' }] },
  { id: 'INC-6', title: 'WhatsApp Business quality dropped to Medium on one number', severity: 'SEV-3', status: 'resolved', components: 'WhatsApp Business', ownerId: 'st_ife', userComms: 'Not needed', startedAt: ago(4 * D), resolvedAt: ago(3 * D) as string | null,
    updates: [{ id: 'iu4', body: 'Opened: quality rating Medium', at: ago(4 * D), staffId: 'st_ife' }, { id: 'iu5', body: 'Resolved: rating back to High', at: ago(3 * D), staffId: 'st_ife' }] },
];
const notes: { id: string; userId: string; staffId: string; note: string; createdAt: string }[] = [
  { id: 'n1', userId: 'u_4k7z1s', staffId: 'st_ife', note: 'Sent the same message to 290 contacts in 2 days. Suspended pending review.', createdAt: ago(2 * D) },
];
const audit: { id: string; at: string; staffId: string; role: string; action: string; targetType: string; targetId: string; reason: string; before: unknown; after: unknown; ip: string }[] = [
  { id: 'au1', at: ago(2 * D), staffId: 'st_ife', role: 'tns', action: 'user.suspend', targetType: 'user', targetId: 'u_4k7z1s', reason: 'Mass messaging: 290 contacts in 2 days', before: { status: 'active' }, after: { status: 'suspended' }, ip: '102.89.•••.••' },
  { id: 'au2', at: ago(5 * D), staffId: 'st_sani', role: 'ops', action: 'controls.clear', targetType: 'integration', targetId: 'googleMaps', reason: 'Quota reset', before: { switchedOff: true }, after: { switchedOff: false }, ip: '102.89.•••.••' },
  { id: 'au3', at: ago(7 * H), staffId: 'st_tolu', role: 'super', action: 'approval.request', targetType: 'action', targetId: 'buyAirtime', reason: 'Beta test with 12 staff accounts', before: null, after: { approvalId: 'ap_31' }, ip: '102.89.•••.••' },
];
const prices: Record<string, { inPerMTok: number; outPerMTok: number }> = {};
let ngnPerUsd: number | null = 1550;
const daily = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(Date.now() - (13 - i) * D).toISOString().slice(0, 10);
  const requests = 15000 + Math.round(Math.sin(i / 2) * 2500 + i * 300);
  return { day: d, requests, tokensIn: requests * 2240, tokensOut: requests * 370, users: Math.round(requests / 4.6) };
});

/* ---------- Pretend server ---------- */
const sessions = new Map<string, string>(); // token → key id
const fail = (status: number, message: string, code: string): never => { throw new ApiError(status, message, code); };
const nameOf = (sid: string | null) => staff.find((s) => s.id === sid)?.name ?? null;
const maskName = (n: string) => { const p = n.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0]; };
const row = (u: DemoUser) => ({ id: u.id, name: maskName(u.name), plan: u.plan, status: u.status, trustLevel: u.trustLevel, lang: u.lang, platform: u.platform, createdAt: u.createdAt, lastSeenAt: u.lastSeenAt });
const reasonOf = (b: { reason?: string }) => { const r = (b.reason ?? '').trim(); if (r.length < 5) fail(400, 'Write a short reason (at least 5 characters). It is saved in the audit log.', 'reason_required'); return r; };
const costOf = (tin: number, tout: number, model = 'claude-opus-5-5') => { const p = prices[model]; return p ? (tin * p.inPerMTok + tout * p.outPerMTok) / 1e12 : null; };

function auth(token: string | null | undefined, perm: Permission | null) {
  const keyId = token ? sessions.get(token) : undefined;
  if (!keyId) fail(401, 'Sign in with your access key.', 'unauthorized');
  const s = staff.find((x) => x.keys.some((k) => k.id === keyId))!;
  const key = s.keys.find((k) => k.id === keyId)!;
  if (key.revokedAt) { sessions.delete(token!); fail(401, 'The access key for this session was revoked. Sign in with a new key.', 'key_revoked'); }
  if (s.disabledAt) fail(403, 'This staff account is disabled.', 'staff_disabled');
  if (perm && !staffCan(s.roles, perm)) fail(403, 'Your role can\'t do this.', 'forbidden');
  const role = (perm ? s.roles.find((r) => staffCan([r], perm)) : s.roles[0]) ?? s.roles[0];
  return { s, role };
}
function log(who: { s: Staff; role: StaffRole }, action: string, targetType: string, targetId: string, reason: string, before: unknown = null, after: unknown = null) {
  audit.unshift({ id: id('au'), at: new Date().toISOString(), staffId: who.s.id, role: who.role, action, targetType, targetId, reason, before, after, ip: 'this browser' });
}
const activeKill = (t: string, k: string) => kills.find((x) => x.targetType === t && x.targetKey === k && !x.clearedAt) ?? null;

type Handler = (p: { params: string[]; body: any; token: string | null; q: URLSearchParams }) => unknown;
const routes: [string, RegExp, Handler][] = [
  ['POST', /^\/auth\/login$/, ({ body }) => {
    const k = String(body.accessKey ?? '').trim();
    if (!/^ugk_[a-z2-9]{8}_[a-z2-9]{32}$/.test(k)) fail(401, 'That access key is not valid. Check it, or ask a Super Admin for a new one.', 'bad_key');
    const s = staff.find((x) => x.keys.some((key) => key.key === k));
    const key = s?.keys.find((x) => x.key === k);
    if (!s || !key) fail(401, 'That access key is not valid. Check it, or ask a Super Admin for a new one.', 'bad_key');
    if (key!.revokedAt) fail(401, 'This access key has been revoked. Ask a Super Admin for a new one.', 'key_revoked');
    if (s!.disabledAt) fail(403, 'This staff account is disabled.', 'staff_disabled');
    key!.lastUsedAt = new Date().toISOString();
    const token = id('tok');
    sessions.set(token, key!.id);
    return { token, staff: { id: s!.id, name: s!.name, roles: s!.roles }, expiresAt: ahead(12 * H) };
  }],
  ['POST', /^\/auth\/logout$/, ({ token }) => { sessions.delete(token ?? ''); return { signedOut: true }; }],
  ['GET', /^\/me$/, ({ token }) => { const { s } = auth(token, null); return { staff: { id: s.id, name: s.name, roles: s.roles }, permissions: PERMISSIONS.filter((p) => staffCan(s.roles, p)) }; }],
  ['GET', /^\/overview$/, ({ token }) => {
    auth(token, 'overview.view');
    const last = events.filter((e) => Date.now() - Date.parse(e.at) < D);
    const by: Record<string, number> = { executed: 3906, proposed: 5120, failed: 54, blocked: 31, undone: 40 };
    for (const e of last) by[e.status] = (by[e.status] ?? 0) + 1;
    const today = daily[daily.length - 1];
    const open = { tickets: tickets.filter((t) => t.status === 'open').length, approvals: approvals.filter((a) => a.status === 'pending').length,
      killSwitches: kills.filter((k) => !k.clearedAt).length, incidents: incidents.filter((i) => !i.resolvedAt).length, privacyRequests: privacy.filter((p) => p.status === 'open').length };
    const attention: { level: string; title: string; detail: string; go: string }[] = [];
    const inc = incidents.find((i) => !i.resolvedAt);
    if (open.incidents) attention.push({ level: 'critical', title: `${open.incidents} open incident${open.incidents > 1 ? 's' : ''}`, detail: inc ? `${inc.severity}: ${inc.title}` : '', go: 'incidents' });
    if (open.killSwitches) attention.push({ level: 'warning', title: `${open.killSwitches} kill switch${open.killSwitches > 1 ? 'es are' : ' is'} on`, detail: 'Some things Ugent normally does are paused.', go: 'controls' });
    if (open.approvals) attention.push({ level: 'warning', title: `${open.approvals} approval${open.approvals > 1 ? 's' : ''} waiting`, detail: 'Changes that need a second person.', go: 'approvals' });
    if (open.privacyRequests) attention.push({ level: 'warning', title: `${open.privacyRequests} privacy request${open.privacyRequests > 1 ? 's' : ''} open`, detail: `Next one due ${privacy.filter((p) => p.status === 'open').sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]?.dueAt.slice(0, 10) ?? ''}`, go: 'privacy' });
    if (open.tickets) attention.push({ level: 'info', title: `${open.tickets} support ticket${open.tickets > 1 ? 's' : ''} open`, detail: 'Users waiting for a reply.', go: 'support' });
    return { people: TOTALS, usage: { chatsToday: TOTALS.chatsToday, aiRequests24h: today.requests, tokensIn24h: today.tokensIn, tokensOut24h: today.tokensOut, costUsd24h: costOf(today.tokensIn, today.tokensOut) },
      actions: { last24h: by, successRate: by.executed / (by.executed + by.failed) }, open, attention };
  }],
  ['GET', /^\/users$/, ({ token, q }) => {
    auth(token, 'users.view');
    const s = (q.get('q') ?? '').toLowerCase();
    return { users: users.filter((u) => !s || u.id.startsWith(s) || u.name.toLowerCase().includes(s)).map(row) };
  }],
  ['GET', /^\/users\/([^/]+)$/, ({ token, params }) => {
    auth(token, 'users.view');
    const u = users.find((x) => x.id === params[0]) ?? fail(404, 'No user with that ID.', 'not_found');
    return { user: { ...row(u), chatsToday: u.chatsToday }, counts: { tasks: u.tasks, plans: u.plans, tickets: tickets.filter((t) => t.userId === u.id).length },
      connected: u.connected.map((c) => (c === 'whatsappBusiness' ? `whatsappBusiness (${maskPhone('+2348021112299')})` : c)), trust: { level: u.trustLevel, levels: TRUST_LEVELS },
      notes: notes.filter((n) => n.userId === u.id), activity: events.filter((e) => e.userId === u.id).slice(0, 15), privacyRequests: privacy.filter((p) => p.userId === u.id),
      onPhoneOnly: 'Chats, memory, notes and habits are stored only on the user\'s phone and are never visible here.' };
  }],
  ['POST', /^\/users\/([^/]+)$/, ({ token, params, body }) => {
    const perm: Record<string, Permission> = { suspend: 'users.suspend', restore: 'users.suspend', ban: 'users.ban', logout: 'users.logout', disconnect: 'users.disconnect', trust_lower: 'users.trust_lower', note: 'users.note' };
    const who = auth(token, perm[body.action] ?? fail(400, 'Unknown action.', 'invalid'));
    const reason = reasonOf(body);
    const u = users.find((x) => x.id === params[0]) ?? fail(404, 'No user with that ID.', 'not_found');
    const before = { status: u.status, trustLevel: u.trustLevel };
    let message = '';
    switch (body.action) {
      case 'suspend': if (u.status !== 'active') fail(409, 'This account is not active.', 'conflict'); u.status = 'suspended'; u.sessionVersion++; message = 'Account suspended and signed out on every device.'; break;
      case 'restore': if (u.status === 'active') fail(409, 'This account is already active.', 'conflict');
        if (u.status === 'banned' && !who.s.roles.some((r) => r === 'super' || r === 'tns')) fail(403, 'Only Trust & Safety or a Super Admin can lift a ban.', 'forbidden');
        u.status = 'active'; message = 'Account restored.'; break;
      case 'ban': if (u.status === 'banned') fail(409, 'This account is already banned.', 'conflict'); u.status = 'banned'; u.sessionVersion++; message = 'Account banned and signed out on every device.'; break;
      case 'logout': u.sessionVersion++; message = 'Signed out on every device. The app signs in again on next open.'; break;
      case 'disconnect': message = u.connected.length ? `Disconnected ${u.connected.length} service${u.connected.length > 1 ? 's' : ''}.` : 'Nothing was connected.'; u.connected = []; break;
      case 'trust_lower': if (u.trustLevel <= 0) fail(409, 'This user is already at the lowest level.', 'conflict'); u.trustLevel--; message = `Trust level lowered to ${u.trustLevel}.`; break;
      case 'note': if (!String(body.note ?? '').trim()) fail(400, 'Write the note.', 'invalid'); notes.unshift({ id: id('n'), userId: u.id, staffId: who.s.id, note: String(body.note).trim(), createdAt: new Date().toISOString() }); message = 'Note added.'; break;
    }
    log(who, `user.${body.action}`, 'user', u.id, reason, before, { status: u.status, trustLevel: u.trustLevel });
    return { ok: true, message };
  }],
  ['GET', /^\/activity$/, ({ token, q }) => {
    auth(token, 'activity.view');
    return { events: events.filter((e) => (!q.get('status') || e.status === q.get('status')) && (!q.get('user') || e.userId === q.get('user'))) };
  }],
  ['GET', /^\/controls$/, ({ token }) => {
    auth(token, 'controls.view');
    const affected: Record<string, number> = { addTask: 3120, addEvent: 2980, reschedule: 1404, moveEvent: 610, completeTask: 2210, focus: 830, remember: 1290, directions: 702, call: 958, message: 1387, waAutoReply: 41, ecosystem: 212 };
    const intAff: Record<string, number> = { googleCalendar: 1210, gmail: 742, googleTasks: 388, googleMaps: 4182, whatsappBusiness: 41 };
    return {
      actions: ACTION_TYPES.map((a) => ({ ...a, enabled: (a.live || enabled.has(a.key)) && !activeKill('action', a.key), killSwitch: activeKill('action', a.key), affectedUsers: affected[a.key] ?? 0 })),
      integrations: KILL_TARGETS.integration.map((t) => ({ ...t, killSwitch: activeKill('integration', t.key), affectedUsers: intAff[t.key] ?? 0 })),
      channels: KILL_TARGETS.channel.map((t) => ({ ...t, killSwitch: activeKill('channel', t.key), affectedUsers: TOTALS.activeToday })),
      history: kills.slice(0, 30),
    };
  }],
  ['POST', /^\/controls$/, ({ token, body }) => {
    if (body.op === 'kill') {
      const who = auth(token, body.targetType === 'action' ? 'controls.kill_action' : 'controls.kill_integration');
      const reason = reasonOf(body);
      if (activeKill(body.targetType, body.targetKey)) fail(409, 'That is already switched off.', 'conflict');
      const k = { id: id('ks'), targetType: body.targetType, targetKey: body.targetKey, reason, setBy: who.s.id, clearedBy: null, clearedAt: null, createdAt: new Date().toISOString() };
      kills.unshift(k);
      log(who, 'controls.kill', body.targetType, body.targetKey, reason, null, { switchedOff: true });
      return { ok: true, id: k.id, message: 'Switched off. Phones and the server stop using it within a minute.' };
    }
    if (body.op === 'clear') {
      const k = kills.find((x) => x.id === body.id && !x.clearedAt) ?? fail(404, 'That kill switch is not active.', 'not_found');
      const who = auth(token, k.targetType === 'action' ? 'controls.kill_action' : 'controls.kill_integration');
      const reason = reasonOf(body);
      k.clearedAt = new Date().toISOString(); k.clearedBy = who.s.id;
      log(who, 'controls.clear', k.targetType, k.targetKey, reason, { switchedOff: true }, { switchedOff: false });
      return { ok: true, message: 'Turned back on.' };
    }
    const who = auth(token, 'controls.request_high_risk');
    const reason = reasonOf(body);
    const info = ACTION_TYPES.find((a) => a.key === body.key);
    if (!info || info.live) fail(400, 'Only action types that are off by default can be requested.', 'invalid');
    const a = { id: id('ap'), type: 'enable_action_type', payload: { key: info!.key }, summary: `Switch on "${info!.name}" (${info!.risk} risk)`, reason, requestedBy: who.s.id, decidedBy: null, status: 'pending', decisionReason: null, expiresAt: ahead(48 * H), decidedAt: null, createdAt: new Date().toISOString() };
    approvals.unshift(a);
    log(who, 'approval.request', 'action', info!.key, reason, null, { approvalId: a.id });
    return { ok: true, id: a.id, message: 'Sent for approval. Another Super Admin must approve it within 48 hours.' };
  }],
  ['GET', /^\/approvals$/, ({ token }) => {
    const { s } = auth(token, 'approvals.view');
    return { approvals: approvals.map((a) => ({ ...a, requestedByName: nameOf(a.requestedBy), decidedByName: nameOf(a.decidedBy), mine: a.requestedBy === s.id })) };
  }],
  ['POST', /^\/approvals\/([^/]+)$/, ({ token, params, body }) => {
    const who = auth(token, 'approvals.decide');
    const reason = reasonOf(body);
    const a = approvals.find((x) => x.id === params[0]) ?? fail(404, 'No such approval request.', 'not_found');
    if (a.status !== 'pending') fail(409, 'This request has already been decided.', 'conflict');
    if (a.requestedBy === who.s.id) fail(403, 'You made this request, so someone else must approve it.', 'own_request');
    a.status = body.decision === 'approve' ? 'approved' : 'rejected'; a.decidedBy = who.s.id; a.decisionReason = reason; a.decidedAt = new Date().toISOString();
    if (a.status === 'approved') enabled.add(a.payload.key);
    log(who, `approval.${body.decision}`, 'approval', a.id, reason, { status: 'pending' }, { status: a.status, payload: a.payload });
    return { ok: true, message: a.status === 'approved' ? 'Approved. The change is live.' : 'Rejected.' };
  }],
  ['GET', /^\/tickets$/, ({ token }) => {
    auth(token, 'support.view');
    return { tickets: tickets.map((t) => { const u = users.find((x) => x.id === t.userId)!;
      return { id: t.id, userId: t.userId, userName: maskName(u.name), plan: u.plan, topic: t.topic, status: t.status, priority: t.priority, assignedTo: t.assignedTo, preview: redactText(t.message, u.name.split(' ')).slice(0, 140), createdAt: t.createdAt }; }) };
  }],
  ['GET', /^\/tickets\/([^/]+)$/, ({ token, params }) => {
    auth(token, 'support.view');
    const t = tickets.find((x) => x.id === params[0]) ?? fail(404, 'No such ticket.', 'not_found');
    const u = users.find((x) => x.id === t.userId)!;
    return { ticket: { id: t.id, topic: t.topic, status: t.status, priority: t.priority, assignedTo: t.assignedTo, createdAt: t.createdAt, message: redactText(t.message, u.name.split(' ')),
      contact: t.contact ? (t.contact.includes('@') ? maskEmail(t.contact) : maskPhone(t.contact)) : null },
      user: { id: u.id, name: maskName(u.name), plan: u.plan, status: u.status, lang: u.lang }, replies: t.replies, activity: events.filter((e) => e.userId === u.id).slice(0, 8) };
  }],
  ['POST', /^\/tickets\/([^/]+)$/, ({ token, params, body }) => {
    const who = auth(token, 'support.reply');
    const t = tickets.find((x) => x.id === params[0]) ?? fail(404, 'No such ticket.', 'not_found');
    if (body.action === 'reply') {
      if (!String(body.body ?? '').trim()) fail(400, 'Write the reply.', 'invalid');
      t.replies.push({ id: id('tm'), staffId: who.s.id, body: String(body.body).trim(), createdAt: new Date().toISOString() });
      if (t.status === 'open') t.status = 'waiting';
      log(who, 'ticket.reply', 'ticket', t.id, 'Replied to the user');
      return { ok: true, message: 'Reply sent. The ticket now waits for the user.' };
    }
    if (body.action === 'assign_me') { t.assignedTo = who.s.id; log(who, 'ticket.assign', 'ticket', t.id, 'Took the ticket'); return { ok: true, message: 'Assigned to you.' }; }
    const reason = reasonOf(body);
    if (body.action === 'status') { const b = t.status; t.status = body.status; log(who, 'ticket.status', 'ticket', t.id, reason, { status: b }, { status: t.status }); }
    if (body.action === 'priority') { const b = t.priority; t.priority = body.priority; log(who, 'ticket.priority', 'ticket', t.id, reason, { priority: b }, { priority: t.priority }); }
    return { ok: true, message: 'Ticket updated.' };
  }],
  ['GET', /^\/privacy$/, ({ token }) => {
    auth(token, 'privacy.view');
    return { requests: privacy.map((r) => ({ ...r, userName: users.find((u) => u.id === r.userId) ? maskName(users.find((u) => u.id === r.userId)!.name) : 'Deleted user' })) };
  }],
  ['POST', /^\/privacy$/, ({ token, body }) => {
    const who = auth(token, 'privacy.process');
    const reason = reasonOf(body);
    if (!users.some((u) => u.id === body.userId)) fail(404, 'No user with that ID.', 'not_found');
    const r = { id: id('dr'), userId: body.userId, type: body.type, status: 'open', source: 'staff', dueAt: ahead(30 * D), completedAt: null as string | null, createdAt: new Date().toISOString() };
    privacy.unshift(r);
    log(who, 'privacy.create', 'user', body.userId, reason, null, { requestId: r.id, type: body.type });
    return { ok: true, id: r.id, message: 'Logged. Due in 30 days.' };
  }],
  ['POST', /^\/privacy\/([^/]+)$/, ({ token, params, body }) => {
    const who = auth(token, 'privacy.process');
    const reason = reasonOf(body);
    const r = privacy.find((x) => x.id === params[0]) ?? fail(404, 'No such request.', 'not_found');
    if (r.status !== 'open') fail(409, 'This request is already closed.', 'conflict');
    let message = 'Request closed.';
    if (body.action === 'run_deletion') {
      if (r.type !== 'deletion') fail(400, 'Only deletion requests can run the deletion workflow.', 'invalid');
      const i = users.findIndex((u) => u.id === r.userId);
      if (i >= 0) users.splice(i, 1);
      message = 'Deleted. The account and its server data are gone; activity totals were anonymised.';
    }
    r.status = body.action === 'reject' ? 'rejected' : 'done'; r.completedAt = new Date().toISOString();
    log(who, `privacy.${body.action}`, 'user', r.userId, reason, { status: 'open', type: r.type }, { status: r.status });
    return { ok: true, message };
  }],
  ['GET', /^\/incidents$/, ({ token }) => {
    auth(token, 'incidents.view');
    return { incidents: incidents.map((i) => ({ ...i, ownerName: nameOf(i.ownerId), updates: i.updates.map((u) => ({ ...u, by: nameOf(u.staffId) })) })) };
  }],
  ['POST', /^\/incidents$/, ({ token, body }) => {
    const who = auth(token, 'incidents.manage');
    const reason = reasonOf(body);
    const inc = { id: `INC-${8 + incidents.length - 2}`, title: String(body.title ?? '').trim() || 'New incident', severity: body.severity ?? 'SEV-2', status: 'investigating', components: body.components ?? '', ownerId: who.s.id,
      userComms: 'Not yet', startedAt: new Date().toISOString(), resolvedAt: null as string | null, updates: [{ id: id('iu'), body: `Opened: ${reason}`, at: new Date().toISOString(), staffId: who.s.id }] };
    incidents.unshift(inc);
    log(who, 'incident.create', 'incident', inc.id, reason, null, { severity: inc.severity });
    return { ok: true, id: inc.id, message: `${inc.id} opened. You are the owner.` };
  }],
  ['POST', /^\/incidents\/([^/]+)$/, ({ token, params, body }) => {
    const who = auth(token, 'incidents.manage');
    const inc = incidents.find((x) => x.id === params[0]) ?? fail(404, 'No such incident.', 'not_found');
    if (inc.resolvedAt) fail(409, 'This incident is resolved.', 'conflict');
    const text = String(body.body ?? '').trim();
    if (text.length < 3) fail(400, 'Write the update.', 'invalid');
    if (body.action === 'resolve') { inc.status = 'resolved'; inc.resolvedAt = new Date().toISOString(); }
    if (body.action === 'comms') inc.userComms = text;
    if (body.action === 'update') inc.status = 'monitoring';
    inc.updates.push({ id: id('iu'), body: body.action === 'resolve' ? `Resolved: ${text}` : body.action === 'comms' ? `Users told: ${text}` : text, at: new Date().toISOString(), staffId: who.s.id });
    log(who, `incident.${body.action}`, 'incident', inc.id, text);
    return { ok: true, message: body.action === 'resolve' ? 'Incident resolved.' : 'Update added.' };
  }],
  ['GET', /^\/usage$/, ({ token }) => {
    auth(token, 'usage.view');
    const total = daily.reduce((a, d) => ({ r: a.r + d.requests, i: a.i + d.tokensIn, o: a.o + d.tokensOut }), { r: 0, i: 0, o: 0 });
    return { daily: daily.map((d) => ({ ...d, costUsd: costOf(d.tokensIn, d.tokensOut) })),
      byModel: [{ model: 'claude-opus-5-5', requests: total.r, tokensIn: total.i, tokensOut: total.o, costUsd: costOf(total.i, total.o), avgMs: 2380 }],
      prices, ngnPerUsd };
  }],
  ['POST', /^\/usage$/, ({ token, body }) => {
    const who = auth(token, 'usage.configure');
    const reason = reasonOf(body);
    if (body.prices) for (const [m, p] of Object.entries(body.prices as Record<string, { inUsdPerMTok: number; outUsdPerMTok: number }>)) {
      const before = prices[m] ?? null;
      prices[m] = { inPerMTok: Math.round(p.inUsdPerMTok * 1e6), outPerMTok: Math.round(p.outUsdPerMTok * 1e6) };
      log(who, 'config.model_prices', 'config', 'model_prices', reason, before, prices[m]);
    }
    if (body.ngnPerUsd) { const b = ngnPerUsd; ngnPerUsd = Number(body.ngnPerUsd); log(who, 'config.ngn_per_usd', 'config', 'ngn_per_usd', reason, { rate: b }, { rate: ngnPerUsd }); }
    return { ok: true, message: 'Saved as a new version. New usage is costed with these prices.' };
  }],
  ['GET', /^\/audit$/, ({ token, q }) => {
    auth(token, 'audit.view');
    const v = q.get('view');
    const keep = (a: typeof audit[number]) => !v || (v === 'controls' ? /^(controls|approval)\./.test(a.action) : v === 'users' ? a.targetType === 'user' : v === 'staff' ? a.action.startsWith('staff.') : v === 'money' ? a.action.startsWith('config.') : true);
    return { entries: audit.filter(keep).map((a) => ({ ...a, staffName: nameOf(a.staffId) ?? a.staffId })) };
  }],
  ['GET', /^\/staff$/, ({ token }) => {
    auth(token, 'staff.manage');
    return { staff: staff.map((s) => ({ id: s.id, name: s.name, email: s.email, createdAt: s.createdAt, disabledAt: s.disabledAt, roles: s.roles,
      keys: s.keys.map(({ key: _secret, ...k }) => ({ ...k, hint: `ugk_${k.prefix}_…` })) })) };
  }],
  ['POST', /^\/staff$/, ({ token, body }) => {
    const who = auth(token, 'staff.manage');
    const reason = reasonOf(body);
    if (String(body.name ?? '').trim().length < 2) fail(400, 'Write their name.', 'invalid');
    if (!STAFF_ROLES.includes(body.role)) fail(400, 'Pick a role.', 'invalid');
    const prefix = Array.from({ length: 8 }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('');
    const key = `ugk_${prefix}_${Array.from({ length: 32 }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('')}`;
    const s: Staff = { id: id('st'), name: String(body.name).trim(), email: body.email ?? null, roles: [body.role], disabledAt: null, createdAt: new Date().toISOString(),
      keys: [{ id: id('key'), prefix, key, label: 'First key', expiresAt: ahead((body.expiresInDays ?? 90) * D), lastUsedAt: null, revokedAt: null, createdAt: new Date().toISOString() }] };
    staff.push(s);
    log(who, 'staff.create', 'staff', s.id, reason, null, { name: s.name, role: body.role, keyPrefix: prefix });
    return { ok: true, id: s.id, accessKey: key, message: 'Staff member added. Copy the access key now and give it to them privately: it will not be shown again.' };
  }],
  ['POST', /^\/staff\/([^/]+)$/, ({ token, params, body }) => {
    const who = auth(token, 'staff.manage');
    const reason = reasonOf(body);
    const s = staff.find((x) => x.id === params[0]) ?? fail(404, 'No such staff member.', 'not_found');
    const supers = staff.filter((x) => x.roles.includes('super') && !x.disabledAt);
    if (body.action === 'issue_key') {
      const prefix = Array.from({ length: 8 }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('');
      const key = `ugk_${prefix}_${Array.from({ length: 32 }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('')}`;
      s.keys.unshift({ id: id('key'), prefix, key, label: 'Issued in console', expiresAt: ahead((body.expiresInDays ?? 90) * D), lastUsedAt: null, revokedAt: null, createdAt: new Date().toISOString() });
      log(who, 'staff.issue_key', 'staff', s.id, reason, null, { keyPrefix: prefix });
      return { ok: true, accessKey: key, message: 'New key issued. Copy it now: it will not be shown again.' };
    }
    if (body.action === 'revoke_key') {
      const k = s.keys.find((x) => x.id === body.keyId && !x.revokedAt) ?? fail(404, 'That key is not active.', 'not_found');
      k.revokedAt = new Date().toISOString();
      log(who, 'staff.revoke_key', 'staff', s.id, reason, null, { keyPrefix: k.prefix });
      return { ok: true, message: 'Key revoked. Anyone signed in with it is signed out on their next click.' };
    }
    if (body.action === 'set_roles') {
      const roles = (body.roles as StaffRole[]).filter((r) => STAFF_ROLES.includes(r));
      if (!roles.length) fail(400, 'Pick at least one role.', 'invalid');
      if (s.roles.includes('super') && !roles.includes('super') && supers.length <= 1) fail(409, 'Ugent needs at least one Super Admin. Make someone else a Super Admin first.', 'last_super');
      const before = s.roles; s.roles = [...new Set(roles)];
      log(who, 'staff.set_roles', 'staff', s.id, reason, { roles: before }, { roles: s.roles });
      return { ok: true, message: 'Roles updated.' };
    }
    if (body.action === 'disable') {
      if (s.id === who.s.id) fail(400, 'You can\'t disable your own account.', 'invalid');
      if (s.roles.includes('super') && supers.length <= 1) fail(409, 'Ugent needs at least one Super Admin.', 'last_super');
      s.disabledAt = new Date().toISOString();
      log(who, 'staff.disable', 'staff', s.id, reason);
      return { ok: true, message: 'Staff member disabled and signed out.' };
    }
    s.disabledAt = null;
    log(who, 'staff.enable', 'staff', s.id, reason);
    return { ok: true, message: 'Staff member re-enabled. They need an active key to sign in.' };
  }],
];

export function demoTransport(): Transport {
  return {
    async request<T>(method: 'GET' | 'POST', path: string, body?: unknown, token?: string | null): Promise<T> {
      await new Promise((r) => setTimeout(r, 120)); // feel like a network
      const url = new URL(path.replace(/^\/admin\/v1/, ''), 'https://demo.local');
      for (const [m, re, h] of routes) {
        const match = m === method ? re.exec(url.pathname) : null;
        if (match) return structuredClone(h({ params: match.slice(1), body: body ?? {}, token: token ?? null, q: url.searchParams })) as T;
      }
      throw new ApiError(404, 'Not found.', 'not_found');
    },
  };
}
