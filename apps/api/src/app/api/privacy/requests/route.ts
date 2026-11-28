import { uid } from '@ugent/core';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { body, handle, json } from '@/lib/http';
import { PRIVACY_DEADLINE_DAYS } from '@/lib/userdata';

/** A user asks for their data, a correction, deletion, or to withdraw consent. Staff see it in Privacy requests. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const { type } = await body(req, z.object({ type: z.enum(['export', 'deletion', 'correction', 'consent_withdrawal']) }));
  const id = 'dr_' + uid();
  await db.insert(schema.dataRequests).values({ id, userId: user.id, type, source: 'app', dueAt: new Date(Date.now() + PRIVACY_DEADLINE_DAYS * 86400000) });
  return json({ id, dueInDays: PRIVACY_DEADLINE_DAYS }, 201);
});
