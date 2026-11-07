import { DeviceAuthRequest, uid } from '@ugent/core';
import { eq } from 'drizzle-orm';
import { signToken } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { body, handle, json } from '@/lib/http';
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
  return json({ token: await signToken(user.id), me: toMe(user) }, existing ? 200 : 201);
});
