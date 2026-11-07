import { requireUser } from '@/lib/auth';
import { accessToken, googleGet } from '@/lib/google';
import { handle, json } from '@/lib/http';

/** For the daily brief: how many important unread emails, and the top three senders and subjects. Bodies are never read. */
export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  const token = await accessToken(user.id, 'gmail');
  const q = new URLSearchParams({ q: 'is:unread is:important newer_than:2d', maxResults: '3' });
  const list = await googleGet<{ messages?: { id: string }[]; resultSizeEstimate?: number }>(token, `https://gmail.googleapis.com/gmail/v1/users/me/messages?${q}`);
  const top = await Promise.all((list.messages ?? []).map(async (m) => {
    const msg = await googleGet<{ payload?: { headers?: { name: string; value: string }[] } }>(
      token, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`);
    const h = (n: string) => msg.payload?.headers?.find((x) => x.name.toLowerCase() === n)?.value ?? '';
    return { from: h('from').replace(/<.*>/, '').replace(/"/g, '').trim() || 'Unknown sender', subject: h('subject') || '(no subject)' };
  }));
  return json({ unreadImportant: list.resultSizeEstimate ?? top.length, top });
});
