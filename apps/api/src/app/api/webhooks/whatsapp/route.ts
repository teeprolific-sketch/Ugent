import { uid } from '@ugent/core';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { json } from '@/lib/http';
import { sendText, validSignature } from '@/lib/whatsapp';

/** Meta checks the webhook once when it is set up. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get('hub.mode') === 'subscribe' && process.env.WA_VERIFY_TOKEN && q.get('hub.verify_token') === process.env.WA_VERIFY_TOKEN) {
    return new Response(q.get('hub.challenge') ?? '', { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

interface WaPayload {
  entry?: { changes?: { value?: { metadata?: { phone_number_id?: string }; messages?: { from: string; type: string; text?: { body?: string } }[] } }[] }[];
}

/** A customer wrote to a linked business number. While the owner is in focus, Ugent replies for them. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get('x-hub-signature-256'))) return json({ error: 'bad_signature' }, 401);
  let payload: WaPayload;
  try { payload = JSON.parse(raw); } catch { return json({ error: 'bad_json' }, 400); }
  let received = 0;
  let replied = 0;
  let wouldReply = 0;
  for (const change of payload.entry?.flatMap((e) => e.changes ?? []) ?? []) {
    const v = change.value;
    const phoneNumberId = v?.metadata?.phone_number_id;
    if (!phoneNumberId || !v?.messages?.length) continue;
    const [biz] = await db.select().from(schema.waBusiness).where(eq(schema.waBusiness.phoneNumberId, phoneNumberId)).limit(1);
    if (!biz) continue;
    const [owner] = await db.select().from(schema.users).where(eq(schema.users.id, biz.userId)).limit(1);
    const focusing = !!owner?.focusUntil && owner.focusUntil.getTime() > Date.now();
    for (const m of v.messages) {
      received++;
      const should = focusing && biz.autoReplyOn;
      if (should) wouldReply++;
      const sent = should ? await sendText(phoneNumberId, m.from, biz.autoReply) : false;
      if (sent) replied++;
      await db.insert(schema.waInbox).values({ id: uid(), userId: biz.userId, from: m.from, text: m.type === 'text' ? m.text?.body ?? '' : `(${m.type})`, autoReplied: sent });
    }
  }
  // Always 200 for valid deliveries, so Meta does not retry.
  return json({ received, replied, wouldReply });
}
