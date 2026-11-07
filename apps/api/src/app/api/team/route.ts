import { TeamCreateRequest, uid } from '@ugent/core';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { body, handle, HttpError, json } from '@/lib/http';
import { effectivePlan } from '@/lib/plan';
import { inviteCode, teamInfo } from '@/lib/team';

export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  return json({ team: user.teamId ? await teamInfo(user.teamId) : null });
});

/** Create a team. Needs the Team plan; the creator becomes its admin. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const { name } = await body(req, TeamCreateRequest);
  if (effectivePlan(user) !== 'team') throw new HttpError(402, 'Creating a team needs the Team plan.', 'plan_required');
  if (user.teamId) throw new HttpError(409, 'You are already in a team. Leave it first.', 'already_in_team');
  const id = 't_' + uid();
  await db.transaction(async (tx) => {
    await tx.insert(schema.teams).values({ id, name, code: inviteCode(), ownerId: user.id });
    await tx.update(schema.users).set({ teamId: id, teamRole: 'admin' }).where(eq(schema.users.id, user.id));
  });
  return json({ team: await teamInfo(id) }, 201);
});
