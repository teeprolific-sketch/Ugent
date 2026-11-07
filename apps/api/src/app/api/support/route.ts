import { SupportRequest, uid } from '@ugent/core';
import { requireUser } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { body, handle, json } from '@/lib/http';

/** "Report a problem" and other support requests from the Help screen. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const input = await body(req, SupportRequest);
  const id = 's_' + uid();
  await db.insert(schema.supportRequests).values({ id, userId: user.id, ...input, contact: input.contact ?? null });
  return json({ id, received: true }, 201);
});
