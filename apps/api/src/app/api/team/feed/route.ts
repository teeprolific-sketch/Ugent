import type { TeamFeedItem } from '@ugent/core';
import { desc, eq, inArray } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { handle, json } from '@/lib/http';
import { requireTeam } from '@/lib/teamguard';

/** Shared updates: the latest changes to the team's tasks and calendar, newest first. */
export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  const teamId = requireTeam(user);
  const [tasks, events] = await Promise.all([
    db.select().from(schema.tasks).where(eq(schema.tasks.teamId, teamId)).orderBy(desc(schema.tasks.rev)).limit(20),
    db.select().from(schema.events).where(eq(schema.events.teamId, teamId)).orderBy(desc(schema.events.rev)).limit(20),
  ]);
  const ids = [...new Set([...tasks, ...events].map((r) => r.updatedBy ?? r.ownerId))];
  const people = ids.length ? await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, ids)) : [];
  const name = (id: string) => people.find((p) => p.id === id)?.name || 'Someone';
  const items: TeamFeedItem[] = [
    ...tasks.map((r) => ({ kind: 'task' as const, id: r.id, title: r.title, by: name(r.updatedBy ?? r.ownerId), at: r.updatedAt,
      what: r.deleted ? 'deleted' as const : r.done ? 'done' as const : r.createdAt === r.updatedAt ? 'added' as const : 'updated' as const })),
    ...events.map((r) => ({ kind: 'event' as const, id: r.id, title: r.title, by: name(r.updatedBy ?? r.ownerId), at: r.updatedAt,
      what: r.deleted ? 'deleted' as const : 'updated' as const })),
  ].sort((a, b) => b.at - a.at).slice(0, 20);
  return json({ items });
});
