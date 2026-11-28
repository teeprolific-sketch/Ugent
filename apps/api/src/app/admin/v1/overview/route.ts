import { and, count, desc, eq, gte, isNull, sql, sum } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { handle, json } from '@/lib/http';
import { since } from '@/lib/adminview';
import { requireStaff } from '@/lib/staff';

/** The home screen: is Ugent healthy, how many people use it, what costs money, and what needs a person. Aggregates only. */
export const GET = handle(async (req: Request) => {
  await requireStaff(req, 'overview.view');
  const day = since(1), week = since(7), today = new Date().toISOString().slice(0, 10);
  const U = schema.users, A = schema.actionEvents, S = schema.usageRecords;

  const [[total], [active], [newWeek], plans, [chats], actionRows, [usage], [tickets], [approvals], [switches], [incidents], [privacy], [nextDue]] = await Promise.all([
    db.select({ n: count() }).from(U),
    db.select({ n: count() }).from(U).where(gte(U.lastSeenAt, day)),
    db.select({ n: count() }).from(U).where(gte(U.createdAt, week)),
    db.select({ plan: U.plan, n: count() }).from(U).groupBy(U.plan),
    db.select({ n: sum(U.chatCount) }).from(U).where(eq(U.chatDay, today)),
    db.select({ status: A.status, n: count() }).from(A).where(gte(A.at, day)).groupBy(A.status),
    db.select({ requests: count(), tin: sum(S.tokensIn), tout: sum(S.tokensOut), cost: sum(S.costUsdMicro), priced: sql<number>`count(${S.costUsdMicro})` }).from(S).where(gte(S.at, day)),
    db.select({ n: count() }).from(schema.supportRequests).where(eq(schema.supportRequests.status, 'open')),
    db.select({ n: count() }).from(schema.approvalRequests).where(and(eq(schema.approvalRequests.status, 'pending'), gte(schema.approvalRequests.expiresAt, new Date()))),
    db.select({ n: count() }).from(schema.killSwitches).where(isNull(schema.killSwitches.clearedAt)),
    db.select({ n: count() }).from(schema.incidents).where(isNull(schema.incidents.resolvedAt)),
    db.select({ n: count() }).from(schema.dataRequests).where(eq(schema.dataRequests.status, 'open')),
    db.select({ due: schema.dataRequests.dueAt }).from(schema.dataRequests).where(eq(schema.dataRequests.status, 'open')).orderBy(schema.dataRequests.dueAt).limit(1),
  ]);
  const by = Object.fromEntries(actionRows.map((r) => [r.status, Number(r.n)]));
  const done = (by.executed ?? 0), failed = (by.failed ?? 0);
  const [lastIncident] = await db.select().from(schema.incidents).where(isNull(schema.incidents.resolvedAt)).orderBy(desc(schema.incidents.startedAt)).limit(1);

  // Plain-language list of things a person should look at, most urgent first.
  const attention: { level: 'critical' | 'warning' | 'info'; title: string; detail: string; go: string }[] = [];
  if (incidents.n) attention.push({ level: 'critical', title: `${incidents.n} open incident${incidents.n > 1 ? 's' : ''}`, detail: lastIncident ? `${lastIncident.severity}: ${lastIncident.title}` : '', go: 'incidents' });
  if (switches.n) attention.push({ level: 'warning', title: `${switches.n} kill switch${switches.n > 1 ? 'es are' : ' is'} on`, detail: 'Some things Ugent normally does are paused.', go: 'controls' });
  if (approvals.n) attention.push({ level: 'warning', title: `${approvals.n} approval${approvals.n > 1 ? 's' : ''} waiting`, detail: 'Changes that need a second person.', go: 'approvals' });
  if (privacy.n) attention.push({ level: 'warning', title: `${privacy.n} privacy request${privacy.n > 1 ? 's' : ''} open`, detail: nextDue ? `Next one due ${nextDue.due.toISOString().slice(0, 10)}` : '', go: 'privacy' });
  if (tickets.n) attention.push({ level: 'info', title: `${tickets.n} support ticket${tickets.n > 1 ? 's' : ''} open`, detail: 'Users waiting for a reply.', go: 'support' });
  if (failed > 0 && failed / Math.max(1, done + failed) > 0.05) attention.push({ level: 'warning', title: 'More actions are failing than usual', detail: `${failed} failed in the last 24 hours.`, go: 'activity' });

  return json({
    people: { total: total.n, activeToday: active.n, newThisWeek: newWeek.n, byPlan: Object.fromEntries(plans.map((p) => [p.plan, p.n])) },
    usage: { chatsToday: Number(chats.n ?? 0), aiRequests24h: usage.requests, tokensIn24h: Number(usage.tin ?? 0), tokensOut24h: Number(usage.tout ?? 0),
      costUsd24h: usage.priced ? Number(usage.cost ?? 0) / 1e6 : null },
    actions: { last24h: by, successRate: done + failed ? done / (done + failed) : null },
    open: { tickets: tickets.n, approvals: approvals.n, killSwitches: switches.n, incidents: incidents.n, privacyRequests: privacy.n },
    attention,
  });
});
