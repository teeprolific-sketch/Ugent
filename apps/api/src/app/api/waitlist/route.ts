import { WaitlistRequest } from '@ugent/core';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { body, handle, json } from '@/lib/http';

export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  const rows = await db.select().from(schema.waitlist).where(eq(schema.waitlist.userId, user.id));
  return json({ joined: rows.map((r) => r.product) });
});

/** Join the waitlist for Sleek, Domestica I, Afrika I or ID'd. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const { product } = await body(req, WaitlistRequest);
  await db.insert(schema.waitlist).values({ userId: user.id, product }).onConflictDoNothing();
  const rows = await db.select().from(schema.waitlist).where(eq(schema.waitlist.userId, user.id));
  return json({ joined: rows.map((r) => r.product) }, 201);
});
