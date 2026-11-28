import { desc, ilike, or } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { handle, json } from '@/lib/http';
import { userRow } from '@/lib/adminview';
import { requireStaff } from '@/lib/staff';

/** Find a user by ID or name. Results are masked. */
export const GET = handle(async (req: Request) => {
  await requireStaff(req, 'users.view');
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 60);
  const U = schema.users;
  const rows = await db.select().from(U)
    .where(q ? or(ilike(U.id, `${q}%`), ilike(U.name, `%${q.replace(/[%_]/g, '')}%`)) : undefined)
    .orderBy(desc(U.lastSeenAt), desc(U.createdAt)).limit(50);
  return json({ users: rows.map(userRow) });
});
