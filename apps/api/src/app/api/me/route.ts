import { and, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { handle, json } from '@/lib/http';
import { toMe } from '@/lib/plan';
import { leaveTeam } from '@/lib/team';

export const GET = handle(async (req: Request) => json({ me: toMe(await requireUser(req)) }));

/** Deletes the account and everything it owns. Required by the App Store and Play Store. */
export const DELETE = handle(async (req: Request) => {
  const user = await requireUser(req);
  await db.transaction(async (tx) => {
    if (user.teamId) await leaveTeam(tx, user);
    await tx.delete(schema.tasks).where(eq(schema.tasks.ownerId, user.id));
    await tx.delete(schema.events).where(eq(schema.events.ownerId, user.id));
    await tx.delete(schema.users).where(and(eq(schema.users.id, user.id)));
  });
  return json({ deleted: true });
});
