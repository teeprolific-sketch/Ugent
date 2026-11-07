import { and, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { handle, HttpError, json } from '@/lib/http';
import { teamInfo } from '@/lib/team';

/** Admin control: remove someone from the team. */
export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { id } = await ctx.params;
  if (!user.teamId || user.teamRole !== 'admin') throw new HttpError(403, 'Only a team admin can remove people.', 'forbidden');
  if (id === user.id) throw new HttpError(400, 'Use "Leave team" to remove yourself.', 'invalid');
  const res = await db.update(schema.users).set({ teamId: null, teamRole: null })
    .where(and(eq(schema.users.id, id), eq(schema.users.teamId, user.teamId))).returning({ id: schema.users.id });
  if (!res.length) throw new HttpError(404, 'That person is not in your team.', 'not_found');
  return json({ team: await teamInfo(user.teamId) });
});
