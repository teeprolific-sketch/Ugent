/* Admin console: staff roles, what each role may do, the registry of agent actions and the policy the phone receives.
 * Shared by the backend (which enforces it on every request), the admin console (which hides what a role can't use)
 * and the phone app (which refuses actions that are switched off). Pure data and functions only. */
import { z } from 'zod';

export const STAFF_ROLES = ['super', 'support', 'quality', 'tns', 'ops', 'finance', 'growth', 'analyst'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_INFO: Record<StaffRole, { name: string; does: string }> = {
  super: { name: 'Super Admin', does: 'Everything, including staff, access keys and approvals.' },
  support: { name: 'Support', does: 'Helps users: tickets, account status and privacy requests. Sees masked details only.' },
  quality: { name: 'AI Quality', does: 'Watches how well Ugent answers: activity and AI usage.' },
  tns: { name: 'Trust & Safety', does: 'Stops abuse: suspends accounts, switches off risky actions, runs incidents.' },
  ops: { name: 'Integrations & Ops', does: 'Keeps connections healthy: switches integrations off and on, runs incidents.' },
  finance: { name: 'Finance', does: 'Money and AI cost. No access to users or their activity.' },
  growth: { name: 'Growth', does: 'Aggregate numbers only.' },
  analyst: { name: 'Analyst', does: 'Read-only aggregate dashboards.' },
};

export const PERMISSIONS = [
  'overview.view',
  'users.view', 'users.suspend', 'users.ban', 'users.logout', 'users.disconnect', 'users.trust_lower', 'users.note',
  'activity.view',
  'controls.view', 'controls.kill_action', 'controls.kill_integration', 'controls.request_high_risk',
  'approvals.view', 'approvals.decide',
  'support.view', 'support.reply',
  'privacy.view', 'privacy.process',
  'incidents.view', 'incidents.manage',
  'usage.view', 'usage.configure',
  'audit.view',
  'staff.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL = [...PERMISSIONS];
export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  super: ALL,
  support: ['overview.view', 'users.view', 'users.suspend', 'users.logout', 'users.disconnect', 'users.trust_lower', 'users.note', 'activity.view',
    'approvals.view', 'support.view', 'support.reply', 'privacy.view', 'privacy.process'],
  quality: ['overview.view', 'activity.view', 'controls.view', 'usage.view', 'approvals.view'],
  tns: ['overview.view', 'users.view', 'users.suspend', 'users.ban', 'users.logout', 'users.trust_lower', 'users.note', 'activity.view',
    'controls.view', 'controls.kill_action', 'controls.kill_integration', 'approvals.view', 'incidents.view', 'incidents.manage', 'audit.view'],
  ops: ['overview.view', 'controls.view', 'controls.kill_integration', 'incidents.view', 'incidents.manage', 'approvals.view'],
  finance: ['overview.view', 'usage.view', 'usage.configure', 'approvals.view'],
  growth: ['overview.view'],
  analyst: ['overview.view', 'usage.view'],
};

export const roleCan = (role: StaffRole, perm: Permission) => ROLE_PERMISSIONS[role].includes(perm);
export const staffCan = (roles: readonly StaffRole[], perm: Permission) => roles.some((r) => roleCan(r, perm));

/** Everything the agent can do, or will be able to do. Money actions start switched off. */
export type Risk = 'low' | 'medium' | 'high';
export interface ActionTypeInfo { key: string; name: string; risk: Risk; confirm: boolean; limit: string; live: boolean; money?: boolean; note?: string }
export const ACTION_TYPES: readonly ActionTypeInfo[] = [
  { key: 'addTask', name: 'Add a task', risk: 'low', confirm: false, limit: '60 an hour', live: true },
  { key: 'addEvent', name: 'Add a plan', risk: 'low', confirm: false, limit: '60 an hour', live: true },
  { key: 'reschedule', name: 'Reschedule the day', risk: 'low', confirm: true, limit: '20 a day', live: true },
  { key: 'moveEvent', name: 'Move one plan', risk: 'low', confirm: true, limit: '40 a day', live: true },
  { key: 'completeTask', name: 'Mark a task done', risk: 'low', confirm: false, limit: '100 a day', live: true },
  { key: 'focus', name: 'Start focus mode', risk: 'low', confirm: false, limit: '10 a day', live: true },
  { key: 'remember', name: 'Remember a fact', risk: 'low', confirm: true, limit: '30 a day', live: true },
  { key: 'directions', name: 'Open directions', risk: 'low', confirm: true, limit: '30 a day', live: true },
  { key: 'call', name: 'Start a phone call', risk: 'medium', confirm: true, limit: '30 a day', live: true },
  { key: 'message', name: 'Send a WhatsApp or SMS', risk: 'medium', confirm: true, limit: '200 a day', live: true },
  { key: 'waAutoReply', name: 'WhatsApp Business auto-reply', risk: 'medium', confirm: false, limit: '1 per customer an hour', live: true, note: 'The user turns this on in advance; it runs only during Focus.' },
  { key: 'ecosystem', name: 'Me AI product request', risk: 'low', confirm: true, limit: '10 a day', live: true, note: 'Saved as a request until the products launch.' },
  { key: 'payBill', name: 'Pay a bill', risk: 'high', confirm: true, limit: '3 a day, up to ₦50,000', live: false, money: true },
  { key: 'buyAirtime', name: 'Buy airtime or data', risk: 'high', confirm: true, limit: '5 a day, up to ₦10,000', live: false, money: true },
  { key: 'transfer', name: 'Send money', risk: 'high', confirm: true, limit: '2 a day, up to ₦100,000', live: false, money: true },
];
export const actionInfo = (key: string) => ACTION_TYPES.find((a) => a.key === key);

/** Things a kill switch can turn off, apart from single action types. */
export const KILL_TARGETS = {
  integration: [
    { key: 'googleCalendar', name: 'Google Calendar' },
    { key: 'gmail', name: 'Gmail' },
    { key: 'googleTasks', name: 'Google Tasks' },
    { key: 'googleMaps', name: 'Google Maps travel times' },
    { key: 'whatsappBusiness', name: 'WhatsApp Business' },
  ],
  channel: [
    { key: 'cloudChat', name: 'Cloud AI chat (falls back to the on-phone assistant)' },
  ],
} as const;
export type KillTargetType = 'action' | 'integration' | 'channel';

/** Trust levels: users unlock automation gradually. Staff can only lower a level. */
export const TRUST_LEVELS = [
  { level: 0, name: 'Drafts only', does: 'Ugent suggests, nothing runs without the user tapping it.' },
  { level: 1, name: 'Low risk automatic', does: 'Low-risk actions such as adding a task run straight away.' },
  { level: 2, name: 'Medium risk with confirmation', does: 'Calls and messages are allowed after the user confirms.' },
] as const;

/** What the phone receives from GET /api/config. */
export const AppPolicy = z.object({
  version: z.number().int(),
  disabledActions: z.array(z.string()),
  disabledIntegrations: z.array(z.string()),
  cloudChat: z.boolean(),
  trustLevel: z.number().int().min(0).max(2),
  status: z.enum(['active', 'suspended', 'banned']),
});
export type AppPolicy = z.infer<typeof AppPolicy>;

/** Is this action allowed for a user right now? Shared by the server (chat) and the phone (before running). */
export function actionAllowed(policy: Pick<AppPolicy, 'disabledActions' | 'trustLevel' | 'status'>, actionType: string): { ok: true } | { ok: false; reason: string } {
  if (policy.status !== 'active') return { ok: false, reason: 'account_suspended' };
  if (policy.disabledActions.includes(actionType)) return { ok: false, reason: 'action_disabled' };
  const info = actionInfo(actionType);
  if (!info) return { ok: true };
  if (!info.live) return { ok: false, reason: 'action_disabled' };
  if (info.risk === 'medium' && policy.trustLevel < 2) return { ok: false, reason: 'trust_level' };
  return { ok: true };
}

/** Plain, content-free summary of an action for the admin activity log. Never includes text, names or numbers. */
export function actionSummary(a: { type: string } & Record<string, unknown>): string {
  switch (a.type) {
    case 'addTask': return 'Add a task';
    case 'addEvent': return `Add a plan · ${Number(a.dur) || 0} min`;
    case 'reschedule': return `Reschedule (${String(a.reason)}) · ${Array.isArray(a.moves) ? a.moves.length : 0} plans`;
    case 'moveEvent': return 'Move one plan';
    case 'completeTask': return 'Mark a task done';
    case 'focus': return `Focus · ${Number(a.mins) || 0} min`;
    case 'call': return 'Call a contact';
    case 'message': return `${a.channel === 'sms' ? 'SMS' : 'WhatsApp'} to a contact · ${typeof a.text === 'string' ? a.text.length : 0} characters`;
    case 'directions': return 'Directions to a place';
    case 'remember': return 'Remember a fact';
    case 'ecosystem': return `Me AI request · ${String(a.product)}`;
    default: return a.type;
  }
}
