import { TeamJoinRequest } from '@ugent/core';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { body, handle, HttpError, json } from '@/lib/http';
import { effectivePlan } from '@/lib/plan';
import { teamInfo } from '@/lib/team';

/** Join with an invite code. Members are covered by the owner's Team plan. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const { code } = await body(req, TeamJoinRequest);
  if (user.teamId) throw new HttpError(409, 'You are already in a team. Leave it first.', 'already_in_team');
  const [team] = await db.select().from(schema.teams).where(eq(schema.teams.code, code.trim().toUpperCase())).limit(1);
  if (!team) throw new HttpError(404, 'No team has that code. Check it with your team admin.', 'not_found');
  const [owner] = await db.select().from(schema.users).where(eq(schema.users.id, team.ownerId)).limit(1);
  if (!owner || effectivePlan(owner) !== 'team') throw new HttpError(402, "This team's plan has ended. Ask your admin to renew it.", 'plan_required');
  await db.update(schema.users).set({ teamId: team.id, teamRole: 'member' }).where(eq(schema.users.id, user.id));
  return json({ team: await teamInfo(team.id) });
});
