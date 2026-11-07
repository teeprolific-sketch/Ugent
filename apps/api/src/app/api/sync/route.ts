import { SyncRequest } from '@ugent/core';
import { and, eq, gt, isNotNull, or, sql } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { body, handle, json } from '@/lib/http';
import { toMe } from '@/lib/plan';
import { eventFromRow, taskFromRow } from '@/lib/rows';

const nextRev = sql`nextval('ugent_rev')`;

/**
 * Two-way sync. The phone sends what changed since its cursor and gets back everything newer.
 * Conflicts: last edit wins (by the editing device's clock). Team items are shared with the team.
 */
export const POST = handle(async (req: Request) => {
  let user = await requireUser(req);
  const input = await body(req, SyncRequest);
  const { tasks: T, events: E } = schema;
  const myTeam = user.teamId;
  const teamOf = (teamId?: string | null) => (teamId && teamId === myTeam ? teamId : null);

  await db.transaction(async (tx) => {
    if (input.profile) {
      [user] = await tx.update(schema.users).set(input.profile).where(eq(schema.users.id, user.id)).returning();
    }
    // A row may be overwritten only by its owner or a member of its team, and only by a newer edit.
    const mayWrite = (tbl: typeof T | typeof E) => and(
      sql`excluded.updated_at >= ${tbl.updatedAt}`,
      or(eq(tbl.ownerId, user.id), myTeam ? and(isNotNull(tbl.teamId), eq(tbl.teamId, myTeam)) : sql`false`),
    );
    for (const t of input.tasks) {
      const row = {
        id: t.id, ownerId: user.id, teamId: teamOf(t.teamId), title: t.title, date: t.date, updatedAt: t.updatedAt,
        deleted: !!t.deleted, sample: !!t.sample, important: t.important, done: t.done, createdAt: t.createdAt, doneAt: t.doneAt ?? null,
        assigneeId: t.teamId ? t.assigneeId ?? null : null, status: t.status ?? null, updatedBy: user.id,
      };
      const update = { teamId: row.teamId, title: row.title, date: row.date, updatedAt: row.updatedAt, deleted: row.deleted, sample: row.sample, important: row.important, done: row.done, createdAt: row.createdAt, doneAt: row.doneAt, assigneeId: row.assigneeId, status: row.status, updatedBy: row.updatedBy };
      await tx.insert(T).values({ ...row, rev: nextRev }).onConflictDoUpdate({ target: T.id, set: { ...update, rev: nextRev }, setWhere: mayWrite(T) });
    }
    // Events imported from the phone's own calendar stay on the phone.
    for (const e of input.events.filter((x) => !x.external)) {
      const row = {
        id: e.id, ownerId: user.id, teamId: teamOf(e.teamId), title: e.title, date: e.date, updatedAt: e.updatedAt,
        deleted: !!e.deleted, sample: !!e.sample, start: e.start, dur: e.dur, kind: e.kind, fixed: e.fixed, needsPower: e.needsPower,
        location: e.location ?? null, updatedBy: user.id,
      };
      const update = { teamId: row.teamId, title: row.title, date: row.date, updatedAt: row.updatedAt, deleted: row.deleted, sample: row.sample, start: row.start, dur: row.dur, kind: row.kind, fixed: row.fixed, needsPower: row.needsPower, location: row.location, updatedBy: row.updatedBy };
      await tx.insert(E).values({ ...row, rev: nextRev }).onConflictDoUpdate({ target: E.id, set: { ...update, rev: nextRev }, setWhere: mayWrite(E) });
    }
  });

  const visible = (tbl: typeof T | typeof E) => and(
    gt(tbl.rev, input.since),
    or(eq(tbl.ownerId, user.id), myTeam ? eq(tbl.teamId, myTeam) : sql`false`),
  );
  const [taskRows, eventRows] = await Promise.all([
    db.select().from(T).where(visible(T)).orderBy(T.rev).limit(2000),
    db.select().from(E).where(visible(E)).orderBy(E.rev).limit(2000),
  ]);
  const cursor = Math.max(input.since, ...taskRows.map((r) => r.rev), ...eventRows.map((r) => r.rev));
  return json({ cursor, tasks: taskRows.map(taskFromRow), events: eventRows.map(eventFromRow), me: toMe(user) });
});
