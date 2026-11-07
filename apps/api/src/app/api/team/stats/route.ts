import type { TeamMemberStats } from '@ugent/core';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { handle, json } from '@/lib/http';
import { requireTeam } from '@/lib/teamguard';

/** Advanced analytics for the Team plan: per-person progress on team work over the last 7 days. */
export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  const teamId = requireTeam(user);
  const since = Date.now() - 7 * 86400000;
  const [members, tasks, events] = await Promise.all([
    db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(eq(schema.users.teamId, teamId)),
    db.select().from(schema.tasks).where(eq(schema.tasks.teamId, teamId)),
    db.select().from(schema.events).where(eq(schema.events.teamId, teamId)),
  ]);
  const live = tasks.filter((t) => !t.deleted);
  const stats: TeamMemberStats[] = members.map((m) => ({
    id: m.id,
    name: m.name || 'Unnamed',
    doneThisWeek: live.filter((t) => (t.assigneeId ?? t.ownerId) === m.id && t.done && (t.doneAt ?? 0) >= since).length,
    open: live.filter((t) => (t.assigneeId ?? t.ownerId) === m.id && !t.done).length,
    doing: live.filter((t) => (t.assigneeId ?? t.ownerId) === m.id && !t.done && t.status === 'doing').length,
    plansThisWeek: events.filter((e) => !e.deleted && e.ownerId === m.id && e.updatedAt >= since).length,
  }));
  const done = live.filter((t) => t.done && (t.doneAt ?? 0) >= since).length;
  return json({ members: stats, totals: { doneThisWeek: done, open: live.filter((t) => !t.done).length, unassigned: live.filter((t) => !t.done && !t.assigneeId).length } });
});
