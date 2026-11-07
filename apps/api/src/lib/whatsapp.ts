/* WhatsApp Business through Meta's Cloud API.
 * Needs META_WA_TOKEN (system user token), WA_APP_SECRET (to verify webhooks) and WA_VERIFY_TOKEN.
 * Business numbers are added to Me AI's WhatsApp Business account; each Ugent user links one number by its phone number ID.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const waConfigured = () => !!(process.env.WA_APP_SECRET && process.env.WA_VERIFY_TOKEN);
export const waCanSend = () => !!process.env.META_WA_TOKEN;

export function validSignature(raw: string, header: string | null): boolean {
  const secret = process.env.WA_APP_SECRET;
  if (!secret || !header) return false;
  const expected = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function sendText(phoneNumberId: string, to: string, body: string): Promise<boolean> {
  if (!waCanSend()) return false;
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.META_WA_TOKEN}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
  });
  return res.ok;
}
