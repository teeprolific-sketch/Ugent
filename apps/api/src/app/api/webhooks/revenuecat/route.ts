import { eq } from 'drizzle-orm';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { handle, HttpError, json } from '@/lib/http';

/* RevenueCat tells us when a subscription starts, renews, changes or ends.
 * The app logs in to RevenueCat with our user id, so app_user_id is our users.id.
 * Entitlements: "team" (Team plan, $21/month) and "pro" (Pro plan, $2/month).
 */
const Event = z.object({
  event: z.object({
    type: z.string(),
    app_user_id: z.string(),
    entitlement_ids: z.array(z.string()).nullish(),
    expiration_at_ms: z.number().nullish(),
  }).passthrough(),
});

const GRANTS = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE', 'SUBSCRIPTION_EXTENDED', 'TEMPORARY_ENTITLEMENT_GRANT']);

function authorized(req: Request) {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  const got = req.headers.get('authorization') ?? '';
  if (!expected) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const POST = handle(async (req: Request) => {
  if (!authorized(req)) throw new HttpError(401, 'Bad webhook authorization.', 'unauthorized');
  const parsed = Event.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, 'Unrecognised webhook body.', 'invalid');
  const ev = parsed.data.event;
  const ent = ev.entitlement_ids ?? [];
  const plan = ent.includes('team') ? 'team' : ent.includes('pro') ? 'pro' : null;

  if (GRANTS.has(ev.type) && plan) {
    await db.update(schema.users).set({ plan, planExpiresAt: ev.expiration_at_ms ? new Date(ev.expiration_at_ms) : null })
      .where(eq(schema.users.id, ev.app_user_id));
  } else if (ev.type === 'EXPIRATION') {
    await db.update(schema.users).set({ plan: 'free', planExpiresAt: null }).where(eq(schema.users.id, ev.app_user_id));
  }
  // CANCELLATION and BILLING_ISSUE keep access until the expiry date we already hold.
  return json({ received: true });
});
