/* What Ugent is allowed to do right now: kill switches, money actions that were approved on, and each user's
 * status and trust level. Read by cloud chat, WhatsApp auto-reply, the Google and Maps routes, and /api/config
 * (which the phone uses to refuse switched-off actions). Also records content-free activity and AI usage. */
import type { AppPolicy } from '@ugent/core';
import { ACTION_TYPES, actionAllowed, actionInfo, actionSummary, uid } from '@ugent/core';
import { desc, eq, isNull } from 'drizzle-orm';
import type { User } from './auth';
import { db, schema } from './db';
import { HttpError } from './http';

interface Switches { actions: Set<string>; integrations: Set<string>; channels: Set<string>; enabled: Set<string>; version: number }
let cache: { at: number; value: Switches } | null = null;

/** Active kill switches, cached for 10 seconds so a switch reaches every request within seconds. */
export async function switches(): Promise<Switches> {
  if (cache && Date.now() - cache.at < 10_000) return cache.value;
  const rows = await db.select().from(schema.killSwitches).where(isNull(schema.killSwitches.clearedAt));
  const enabled = await db.select().from(schema.enabledActionTypes);
  const [last] = await db.select({ at: schema.killSwitches.createdAt }).from(schema.killSwitches).orderBy(desc(schema.killSwitches.createdAt)).limit(1);
  const value: Switches = {
    actions: new Set(rows.filter((r) => r.targetType === 'action').map((r) => r.targetKey)),
    integrations: new Set(rows.filter((r) => r.targetType === 'integration').map((r) => r.targetKey)),
    channels: new Set(rows.filter((r) => r.targetType === 'channel').map((r) => r.targetKey)),
    enabled: new Set(enabled.map((e) => e.key)),
    version: Math.floor((last?.at.getTime() ?? 0) / 1000) + rows.length + enabled.length,
  };
  cache = { at: Date.now(), value };
  return value;
}
export const invalidateSwitches = () => { cache = null; };

/** The policy for one user, exactly as the phone receives it. */
export async function policyFor(user: Pick<User, 'status' | 'trustLevel'>): Promise<AppPolicy> {
  const s = await switches();
  const disabledActions = ACTION_TYPES.filter((a) => s.actions.has(a.key) || (!a.live && !s.enabled.has(a.key))).map((a) => a.key);
  return {
    version: s.version,
    disabledActions,
    disabledIntegrations: [...s.integrations],
    cloudChat: !s.channels.has('cloudChat'),
    trustLevel: Math.max(0, Math.min(2, user.trustLevel)),
    status: (['active', 'suspended', 'banned'].includes(user.status) ? user.status : 'active') as AppPolicy['status'],
  };
}

/** Throws a friendly 503 when an integration has been switched off by staff. */
export async function requireIntegrationOn(key: string, name: string) {
  if ((await switches()).integrations.has(key)) throw new HttpError(503, `${name} is paused for now. Ugent keeps working without it.`, 'integration_paused');
}

/** Splits proposed actions into allowed and blocked for this user's policy. */
export function filterActions<A extends { type: string }>(policy: AppPolicy, actions: A[]): { allowed: A[]; blocked: { action: A; reason: string }[] } {
  const allowed: A[] = []; const blocked: { action: A; reason: string }[] = [];
  for (const a of actions) {
    const v = actionAllowed(policy, a.type);
    if (v.ok) allowed.push(a); else blocked.push({ action: a, reason: v.reason });
  }
  return { allowed, blocked };
}

export async function recordActionEvents(userId: string, events: { type: string; status: string; source: 'cloud' | 'device' | 'server'; model?: string | null; latencyMs?: number | null; errorCode?: string | null; action?: Record<string, unknown> }[]) {
  if (!events.length) return;
  await db.insert(schema.actionEvents).values(events.map((e) => ({
    id: 'ae_' + uid(), userId, actionType: e.type, risk: actionInfo(e.type)?.risk ?? 'low', status: e.status, source: e.source,
    model: e.model ?? null, latencyMs: e.latencyMs ?? null, errorCode: e.errorCode ?? null,
    summary: e.action ? actionSummary({ type: e.type, ...e.action }) : (actionInfo(e.type)?.name ?? e.type),
  })));
}

/** Model prices in US dollar micro-units per million tokens, set from the console (Cost settings). */
export async function modelPrices(): Promise<Record<string, { inPerMTok: number; outPerMTok: number }>> {
  const [row] = await db.select().from(schema.configVersions).where(eq(schema.configVersions.key, 'model_prices')).orderBy(desc(schema.configVersions.version)).limit(1);
  return (row?.value as Record<string, { inPerMTok: number; outPerMTok: number }>) ?? {};
}

export async function recordUsage(u: { userId: string; model: string; taskType: string; tokensIn: number; tokensOut: number; latencyMs: number; fallback: boolean }) {
  const price = (await modelPrices())[u.model];
  const costUsdMicro = price ? Math.round((u.tokensIn * price.inPerMTok + u.tokensOut * price.outPerMTok) / 1_000_000) : null;
  await db.insert(schema.usageRecords).values({ id: 'us_' + uid(), ...u, costUsdMicro });
}
