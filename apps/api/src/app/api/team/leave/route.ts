import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { handle, HttpError, json } from '@/lib/http';
import { leaveTeam } from '@/lib/team';

export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  if (!user.teamId) throw new HttpError(409, 'You are not in a team.', 'not_in_team');
  await db.transaction((tx) => leaveTeam(tx, user));
  return json({ team: null });
});
