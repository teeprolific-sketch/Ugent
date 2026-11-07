import { and, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { handle, HttpError, json } from '@/lib/http';

/** Disconnect a cloud service and delete its stored tokens. */
export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ provider: string }> }) => {
  const user = await requireUser(req);
  const { provider } = await ctx.params;
  if (provider === 'whatsappBusiness') {
    await db.delete(schema.waBusiness).where(eq(schema.waBusiness.userId, user.id));
  } else if (['googleCalendar', 'gmail', 'googleTasks'].includes(provider)) {
    const [c] = await db.select().from(schema.connections).where(and(eq(schema.connections.userId, user.id), eq(schema.connections.provider, provider))).limit(1);
    if (c) {
      // Tell Google too, so the permission disappears from the user's Google account.
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(c.refreshToken ?? c.accessToken)}`, { method: 'POST' }).catch(() => {});
      await db.delete(schema.connections).where(and(eq(schema.connections.userId, user.id), eq(schema.connections.provider, provider)));
    }
  } else {
    throw new HttpError(404, 'Unknown service.', 'not_found');
  }
  return json({ disconnected: provider });
});
