import type { PlanEvent, Task } from '@ugent/core';
import { KINDS } from '@ugent/core';
import { schema } from './db';

type TaskRow = typeof schema.tasks.$inferSelect;
type EventRow = typeof schema.events.$inferSelect;

export const taskFromRow = (r: TaskRow): Task => ({
  id: r.id, title: r.title, important: r.important, done: r.done, date: r.date, createdAt: r.createdAt,
  doneAt: r.doneAt, updatedAt: r.updatedAt, deleted: r.deleted, sample: r.sample, teamId: r.teamId,
  assigneeId: r.assigneeId, status: r.status === 'todo' || r.status === 'doing' || r.status === 'done' ? r.status : undefined,
  ownerId: r.ownerId, updatedBy: r.updatedBy,
});

export const eventFromRow = (r: EventRow): PlanEvent => ({
  id: r.id, title: r.title, date: r.date, start: r.start, dur: r.dur,
  kind: (KINDS as readonly string[]).includes(r.kind) ? (r.kind as PlanEvent['kind']) : 'personal',
  fixed: r.fixed, needsPower: r.needsPower, updatedAt: r.updatedAt, deleted: r.deleted, sample: r.sample, teamId: r.teamId,
  location: r.location, ownerId: r.ownerId, updatedBy: r.updatedBy,
});
