import { WaBusinessSettings } from '@ugent/core';
import { desc, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { body, handle, HttpError, json } from '@/lib/http';
import { effectivePlan } from '@/lib/plan';
import { waCanSend, waConfigured } from '@/lib/whatsapp';

/** The linked business number, auto-reply settings and the latest customer messages. */
export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  const [settings] = await db.select().from(schema.waBusiness).where(eq(schema.waBusiness.userId, user.id)).limit(1);
  const inbox = settings ? await db.select().from(schema.waInbox).where(eq(schema.waInbox.userId, user.id)).orderBy(desc(schema.waInbox.at)).limit(20) : [];
  return json({
    available: waConfigured(), canSend: waCanSend(),
    settings: settings ? { phoneNumberId: settings.phoneNumberId, displayNumber: settings.displayNumber, autoReplyOn: settings.autoReplyOn, autoReply: settings.autoReply } : null,
    inbox: inbox.map((m) => ({ id: m.id, from: m.from, text: m.text, autoReplied: m.autoReplied, at: m.at.getTime() })),
  });
});

export const PUT = handle(async (req: Request) => {
  const user = await requireUser(req);
  if (effectivePlan(user) === 'free') throw new HttpError(402, 'WhatsApp Business needs the Pro or Team plan.', 'plan_required');
  if (!waConfigured()) throw new HttpError(503, 'WhatsApp Business is not set up on this server yet.', 'not_configured');
  const s = await body(req, WaBusinessSettings);
  const [taken] = await db.select().from(schema.waBusiness).where(eq(schema.waBusiness.phoneNumberId, s.phoneNumberId)).limit(1);
  if (taken && taken.userId !== user.id) throw new HttpError(409, 'That business number is linked to another Ugent account.', 'taken');
  await db.insert(schema.waBusiness).values({ userId: user.id, ...s }).onConflictDoUpdate({ target: schema.waBusiness.userId, set: s });
  return json({ settings: s });
});
