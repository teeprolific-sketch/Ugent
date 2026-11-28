import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { body, handle, json } from '@/lib/http';
import { policyFor } from '@/lib/policy';

/** The user chooses how much Ugent may do on its own (0 drafts only, 1 low risk, 2 calls and messages after confirming).
 * Only the user can raise it; staff can only lower it from the admin console. Returns the new policy. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const { level } = await body(req, z.object({ level: z.number().int().min(0).max(2) }));
  await db.update(schema.users).set({ trustLevel: level }).where(eq(schema.users.id, user.id));
  return json({ policy: await policyFor({ ...user, trustLevel: level }) });
});
