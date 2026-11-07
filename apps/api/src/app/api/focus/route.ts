import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { body, handle, json } from '@/lib/http';

/** The phone reports focus mode so WhatsApp Business can reply for the user while they focus. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const { until } = await body(req, z.object({ until: z.number().nullable() }));
  const focusUntil = until && until > Date.now() ? new Date(Math.min(until, Date.now() + 4 * 3600000)) : null;
  await db.update(schema.users).set({ focusUntil }).where(eq(schema.users.id, user.id));
  return json({ focusUntil: focusUntil?.getTime() ?? null });
});
