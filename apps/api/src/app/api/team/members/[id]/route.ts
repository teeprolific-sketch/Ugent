import { TeamRoleRequest } from '@ugent/core';
import { and, eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { body, handle, HttpError, json } from '@/lib/http';
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

/** Admin control: make someone an admin or a member. A team always keeps at least one admin. */
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser(req);
  const { id } = await ctx.params;
  if (!user.teamId || user.teamRole !== 'admin') throw new HttpError(403, 'Only a team admin can change roles.', 'forbidden');
  const { role } = await body(req, TeamRoleRequest);
  const teamId = user.teamId;
  if (role === 'member') {
    const admins = await db.select({ id: schema.users.id }).from(schema.users).where(and(eq(schema.users.teamId, teamId), eq(schema.users.teamRole, 'admin')));
    if (admins.length <= 1 && admins[0]?.id === id) throw new HttpError(409, 'A team needs at least one admin. Make someone else an admin first.', 'last_admin');
  }
  const res = await db.update(schema.users).set({ teamRole: role })
    .where(and(eq(schema.users.id, id), eq(schema.users.teamId, teamId))).returning({ id: schema.users.id });
  if (!res.length) throw new HttpError(404, 'That person is not in your team.', 'not_found');
  return json({ team: await teamInfo(teamId) });
});
