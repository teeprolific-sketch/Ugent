import { DeviceAuthRequest, uid } from '@ugent/core';
import { eq } from 'drizzle-orm';
import { signToken } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { body, handle, HttpError, json } from '@/lib/http';
import { toMe } from '@/lib/plan';

/** Registers an install (or signs it back in) and returns a session token. */
export const POST = handle(async (req: Request) => {
  const input = await body(req, DeviceAuthRequest);
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.deviceId, input.deviceId)).limit(1);
  const user = existing ?? (await db.insert(schema.users).values({
    id: 'u_' + uid(),
    deviceId: input.deviceId,
    platform: input.platform,
    name: input.name ?? '',
    lang: input.lang ?? 'en',
  }).returning())[0];
  if (user.status === 'banned') throw new HttpError(403, 'This account has been closed. Contact Ugent support if you think this is a mistake.', 'account_banned');
  return json({ token: await signToken(user.id, user.sessionVersion), me: toMe(user) }, existing ? 200 : 201);
});
