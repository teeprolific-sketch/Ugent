import { ACTION_TYPES, KILL_TARGETS, uid } from '@ugent/core';
import { and, count, countDistinct, desc, eq, gte, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { body, handle, HttpError, json } from '@/lib/http';
import { since } from '@/lib/adminview';
import { invalidateSwitches } from '@/lib/policy';
import { audit, needReason, requireStaff } from '@/lib/staff';

/** Agent controls: every action type with its risk and status, integrations and channels, active kill switches,
 *  and how many people each switch would affect. */
export const GET = handle(async (req: Request) => {
  await requireStaff(req, 'controls.view');
  const K = schema.killSwitches, A = schema.actionEvents;
  const [active, history, enabled, usageByType, conns, [chatUsers]] = await Promise.all([
    db.select().from(K).where(isNull(K.clearedAt)).orderBy(desc(K.createdAt)),
    db.select().from(K).orderBy(desc(K.createdAt)).limit(30),
    db.select().from(schema.enabledActionTypes),
    db.select({ type: A.actionType, users: countDistinct(A.userId) }).from(A).where(gte(A.at, since(7))).groupBy(A.actionType),
    db.select({ provider: schema.connections.provider, n: count() }).from(schema.connections).groupBy(schema.connections.provider),
    db.select({ n: count() }).from(schema.users).where(gte(schema.users.lastSeenAt, since(7))),
  ]);
  const [wa] = await db.select({ n: count() }).from(schema.waBusiness);
  const affected = (type: string, key: string) => type === 'action' ? Number(usageByType.find((u) => u.type === key)?.users ?? 0)
    : type === 'integration' ? (key === 'whatsappBusiness' ? wa.n : key === 'googleMaps' ? chatUsers.n : Number(conns.find((c) => c.provider === key)?.n ?? 0))
    : chatUsers.n;
  const on = (type: string, key: string) => active.find((k) => k.targetType === type && k.targetKey === key) ?? null;
  return json({
    actions: ACTION_TYPES.map((a) => ({ ...a, enabled: a.live ? !on('action', a.key) : enabled.some((e) => e.key === a.key) && !on('action', a.key), killSwitch: on('action', a.key), affectedUsers: affected('action', a.key) })),
    integrations: KILL_TARGETS.integration.map((t) => ({ ...t, killSwitch: on('integration', t.key), affectedUsers: affected('integration', t.key) })),
    channels: KILL_TARGETS.channel.map((t) => ({ ...t, killSwitch: on('channel', t.key), affectedUsers: affected('channel', t.key) })),
    history,
  });
});

const Op = z.discriminatedUnion('op', [
  z.object({ op: z.literal('kill'), targetType: z.enum(['action', 'integration', 'channel']), targetKey: z.string().max(40), reason: z.string().max(500) }),
  z.object({ op: z.literal('clear'), id: z.string().max(60), reason: z.string().max(500) }),
  z.object({ op: z.literal('request_enable'), key: z.string().max(40), reason: z.string().max(500) }),
]);

/** Switch something off now, turn it back on, or ask for a money action to be enabled (needs a second approval). */
export const POST = handle(async (req: Request) => {
  const input = await body(req, Op);
  const K = schema.killSwitches;
  if (input.op === 'kill') {
    const staff = await requireStaff(req, input.targetType === 'action' ? 'controls.kill_action' : 'controls.kill_integration');
    const reason = needReason(input.reason);
    const known = input.targetType === 'action' ? ACTION_TYPES.some((a) => a.key === input.targetKey) : KILL_TARGETS[input.targetType].some((t) => t.key === input.targetKey);
    if (!known) throw new HttpError(400, 'Unknown thing to switch off.', 'invalid');
    const [existing] = await db.select().from(K).where(and(eq(K.targetType, input.targetType), eq(K.targetKey, input.targetKey), isNull(K.clearedAt))).limit(1);
    if (existing) throw new HttpError(409, 'That is already switched off.', 'conflict');
    const id = 'ks_' + uid();
    await db.transaction(async (tx) => {
      await tx.insert(K).values({ id, targetType: input.targetType, targetKey: input.targetKey, reason, setBy: staff.id });
      await audit(tx, staff, { action: 'controls.kill', targetType: input.targetType, targetId: input.targetKey, reason, after: { switchedOff: true } });
    });
    invalidateSwitches();
    return json({ ok: true, id, message: 'Switched off. Phones and the server stop using it within a minute.' });
  }
  if (input.op === 'clear') {
    const [row] = await db.select().from(K).where(and(eq(K.id, input.id), isNull(K.clearedAt))).limit(1);
    if (!row) throw new HttpError(404, 'That kill switch is not active.', 'not_found');
    const staff = await requireStaff(req, row.targetType === 'action' ? 'controls.kill_action' : 'controls.kill_integration');
    const reason = needReason(input.reason);
    await db.transaction(async (tx) => {
      await tx.update(K).set({ clearedAt: new Date(), clearedBy: staff.id }).where(eq(K.id, row.id));
      await audit(tx, staff, { action: 'controls.clear', targetType: row.targetType, targetId: row.targetKey, reason, before: { switchedOff: true }, after: { switchedOff: false } });
    });
    invalidateSwitches();
    return json({ ok: true, message: 'Turned back on.' });
  }
  // request_enable: high-risk action types are never enabled directly.
  const staff = await requireStaff(req, 'controls.request_high_risk');
  const reason = needReason(input.reason);
  const info = ACTION_TYPES.find((a) => a.key === input.key);
  if (!info || info.live) throw new HttpError(400, 'Only action types that are off by default can be requested.', 'invalid');
  const id = 'ap_' + uid();
  await db.transaction(async (tx) => {
    await tx.insert(schema.approvalRequests).values({ id, type: 'enable_action_type', payload: { key: info.key }, summary: `Switch on "${info.name}" (${info.risk} risk)`, reason, requestedBy: staff.id, expiresAt: new Date(Date.now() + 48 * 3600000) });
    await audit(tx, staff, { action: 'approval.request', targetType: 'action', targetId: info.key, reason, after: { approvalId: id } });
  });
  return json({ ok: true, id, message: 'Sent for approval. Another Super Admin must approve it within 48 hours.' }, 201);
});
