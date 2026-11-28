/* What the server allows this phone to do right now: kill switches set by Ugent staff, the user's trust level
 * and account status. Fetched with sync and kept on the phone, so it also applies to the offline assistant.
 * With no server (offline-only build) or before the first fetch, nothing is blocked. */
import type { AppPolicy } from '@ugent/core';
import { actionAllowed, actionInfo, AppPolicySchema } from '@ugent/core';
import { useApp } from '@/store';
import { ApiError, apiConfigured, hasSession, request } from './api';

type Reason = 'action_disabled' | 'trust_level' | 'account_suspended';

export async function refreshPolicy() {
  if (!apiConfigured() || !hasSession()) return;
  try {
    const { policy } = await request<{ policy: unknown }>('GET', '/api/config', undefined, 10000);
    const parsed = AppPolicySchema.safeParse(policy);
    if (parsed.success) useApp.getState().setPolicy(parsed.data);
  } catch (e) {
    // A suspended or banned account can't fetch its policy: remember that, so actions stop on the phone too.
    if (e instanceof ApiError && (e.code === 'account_suspended' || e.code === 'account_banned')) {
      const old = useApp.getState().policy;
      useApp.getState().setPolicy({ version: old?.version ?? 0, disabledActions: old?.disabledActions ?? [], disabledIntegrations: old?.disabledIntegrations ?? [],
        cloudChat: false, trustLevel: old?.trustLevel ?? 2, status: e.code === 'account_banned' ? 'banned' : 'suspended' });
    }
    // Offline or other errors: keep the last known policy.
  }
  void flushTelemetry();
}

/** Splits actions into those the phone may run and those switched off right now. */
export function checkActions<A extends { type: string }>(actions: A[], policy: AppPolicy | null = useApp.getState().policy) {
  const allowed: A[] = [], blocked: { action: A; reason: Reason }[] = [];
  for (const a of actions) {
    const r = policy ? actionAllowed(policy, a.type) : { ok: true as const };
    if (r.ok) allowed.push(a); else blocked.push({ action: a, reason: r.reason as Reason });
  }
  return { allowed, blocked };
}

/** One plain sentence for the user about what didn't run and why. */
export function blockedMessage(blocked: { action: { type: string }; reason: Reason }[]) {
  if (blocked.some((b) => b.reason === 'account_suspended')) return 'Your account is paused, so Ugent can\'t do this. Contact support from Help.';
  const names = [...new Set(blocked.map((b) => (actionInfo(b.action.type)?.name ?? b.action.type).toLowerCase()))].join(', ');
  return blocked.some((b) => b.reason === 'trust_level')
    ? `To ${names}, allow calls and messages in Privacy and memory.`
    : `${names[0].toUpperCase()}${names.slice(1)} is paused right now. Please try again later.`;
}

/* Telemetry: only the action type, a fixed status and an error code. Never text, names or numbers. */
type Status = 'executed' | 'failed' | 'undone' | 'blocked';
type Code = 'ACTION_DISABLED' | 'TRUST_LEVEL' | 'ACCOUNT_SUSPENDED' | 'APP_NOT_INSTALLED' | 'UNKNOWN';
const queue: { type: string; status: Status; errorCode?: Code | null }[] = [];
const CODE: Record<Reason, Code> = { action_disabled: 'ACTION_DISABLED', trust_level: 'TRUST_LEVEL', account_suspended: 'ACCOUNT_SUSPENDED' };

export function reportActions(types: string[], status: Status, errorCode: Code | null = null) {
  if (!apiConfigured()) return;
  for (const type of types) if (actionInfo(type)) queue.push({ type, status, errorCode });
  if (queue.length > 200) queue.splice(0, queue.length - 200);
}
export const reportBlocked = (blocked: { action: { type: string }; reason: Reason }[]) => {
  for (const b of blocked) reportActions([b.action.type], 'blocked', CODE[b.reason]);
};

let flushing = false;
export async function flushTelemetry() {
  if (flushing || !queue.length || !hasSession()) return;
  flushing = true;
  const batch = queue.splice(0, 50);
  try { await request('POST', '/api/telemetry/actions', { events: batch }, 10000); }
  catch (e) { if (!(e instanceof ApiError) || e.status === 0) queue.unshift(...batch); /* offline: try later; rejected: drop */ }
  finally { flushing = false; }
}

/** The user chooses how much Ugent may do on its own. Saved on the server, which only staff can lower. */
export async function setTrustLevel(level: 0 | 1 | 2) {
  const { policy } = await request<{ policy: unknown }>('POST', '/api/me/trust', { level }, 10000);
  const parsed = AppPolicySchema.safeParse(policy);
  if (parsed.success) useApp.getState().setPolicy(parsed.data);
}
