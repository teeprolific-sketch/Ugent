import { uid } from '@ugent/core';
import { count, desc, eq, gte, sql, sum } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { body, handle, json } from '@/lib/http';
import { since } from '@/lib/adminview';
import { modelPrices } from '@/lib/policy';
import { audit, needReason, requireStaff } from '@/lib/staff';

/** AI usage and cost: per day for 14 days and per model. Cost appears once prices are set. Stored in USD micro-units. */
export const GET = handle(async (req: Request) => {
  await requireStaff(req, 'usage.view');
  const S = schema.usageRecords;
  const day = sql<string>`to_char(${S.at}, 'YYYY-MM-DD')`;
  const [daily, byModel, prices, [fx]] = await Promise.all([
    db.select({ day, requests: count(), tokensIn: sum(S.tokensIn), tokensOut: sum(S.tokensOut), costMicro: sum(S.costUsdMicro), users: sql<number>`count(distinct ${S.userId})` })
      .from(S).where(gte(S.at, since(14))).groupBy(day).orderBy(day),
    db.select({ model: S.model, requests: count(), tokensIn: sum(S.tokensIn), tokensOut: sum(S.tokensOut), costMicro: sum(S.costUsdMicro), avgMs: sql<number>`round(avg(${S.latencyMs}))` })
      .from(S).where(gte(S.at, since(30))).groupBy(S.model),
    modelPrices(),
    db.select().from(schema.configVersions).where(eq(schema.configVersions.key, 'ngn_per_usd')).orderBy(desc(schema.configVersions.version)).limit(1),
  ]);
  const num = (v: unknown) => Number(v ?? 0);
  return json({
    daily: daily.map((d) => ({ day: d.day, requests: d.requests, tokensIn: num(d.tokensIn), tokensOut: num(d.tokensOut), costUsd: d.costMicro == null ? null : num(d.costMicro) / 1e6, users: num(d.users) })),
    byModel: byModel.map((m) => ({ model: m.model, requests: m.requests, tokensIn: num(m.tokensIn), tokensOut: num(m.tokensOut), costUsd: m.costMicro == null ? null : num(m.costMicro) / 1e6, avgMs: num(m.avgMs) })),
    prices, ngnPerUsd: (fx?.value as { rate: number } | undefined)?.rate ?? null,
  });
});

/** Set model prices (USD per million tokens) and the naira rate. Versioned: each change is a new row, nothing is overwritten. */
export const POST = handle(async (req: Request) => {
  const staff = await requireStaff(req, 'usage.configure');
  const input = await body(req, z.object({
    prices: z.record(z.string().max(80), z.object({ inUsdPerMTok: z.number().min(0).max(1000), outUsdPerMTok: z.number().min(0).max(1000) })).optional(),
    ngnPerUsd: z.number().min(1).max(100000).optional(),
    reason: z.string().max(500),
  }));
  const reason = needReason(input.reason);
  const C = schema.configVersions;
  await db.transaction(async (tx) => {
    const save = async (key: string, value: unknown) => {
      const [last] = await tx.select().from(C).where(eq(C.key, key)).orderBy(desc(C.version)).limit(1);
      await tx.insert(C).values({ id: 'cfg_' + uid(), key, version: (last?.version ?? 0) + 1, value, createdBy: staff.id, reason });
      await audit(tx, staff, { action: `config.${key}`, targetType: 'config', targetId: key, reason, before: last?.value ?? null, after: value });
    };
    // Stored as integer micro-dollars per million tokens, so no money is ever kept as a float.
    if (input.prices) await save('model_prices', Object.fromEntries(Object.entries(input.prices).map(([m, p]) => [m, { inPerMTok: Math.round(p.inUsdPerMTok * 1e6), outPerMTok: Math.round(p.outUsdPerMTok * 1e6) }])));
    if (input.ngnPerUsd) await save('ngn_per_usd', { rate: input.ngnPerUsd });
  });
  return json({ ok: true, message: 'Saved as a new version. New usage is costed with these prices.' });
});
