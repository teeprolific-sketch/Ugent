import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { handle, json } from '@/lib/http';
import { toMe } from '@/lib/plan';
import { deleteUserData } from '@/lib/userdata';

export const GET = handle(async (req: Request) => json({ me: toMe(await requireUser(req)) }));

/** Deletes the account and everything it owns. Required by the App Store and Play Store. */
export const DELETE = handle(async (req: Request) => {
  const user = await requireUser(req);
  await db.transaction(async (tx) => { await deleteUserData(tx, user); });
  return json({ deleted: true });
});
