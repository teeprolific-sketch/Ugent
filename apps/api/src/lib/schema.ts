import { bigint, boolean, index, integer, pgSequence, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** Bumped on every write so clients can pull "everything since my cursor". */
export const revSeq = pgSequence('ugent_rev');

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  deviceId: text('device_id').notNull().unique(),
  platform: text('platform').notNull(),
  name: text('name').notNull().default(''),
  lang: text('lang').notNull().default('en'),
  peak: text('peak').notNull().default('morning'),
  /** free | pro | team. Set by the RevenueCat webhook. */
  plan: text('plan').notNull().default('free'),
  planExpiresAt: timestamp('plan_expires_at', { withTimezone: true }),
  teamId: text('team_id'),
  teamRole: text('team_role'),
  chatDay: text('chat_day').notNull().default(''),
  chatCount: integer('chat_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const teams = pgTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  ownerId: text('owner_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

const syncColumns = {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  teamId: text('team_id'),
  title: text('title').notNull(),
  date: text('date').notNull(),
  /** Client clock (ms) of the last edit; last write wins. */
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
  deleted: boolean('deleted').notNull().default(false),
  sample: boolean('sample').notNull().default(false),
  rev: bigint('rev', { mode: 'number' }).notNull(),
};

export const tasks = pgTable('tasks', {
  ...syncColumns,
  important: boolean('important').notNull().default(false),
  done: boolean('done').notNull().default(false),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  doneAt: bigint('done_at', { mode: 'number' }),
}, (t) => [index('tasks_owner_rev').on(t.ownerId, t.rev), index('tasks_team_rev').on(t.teamId, t.rev)]);

export const events = pgTable('events', {
  ...syncColumns,
  start: text('start').notNull(),
  dur: integer('dur').notNull(),
  kind: text('kind').notNull(),
  fixed: boolean('fixed').notNull().default(false),
  needsPower: boolean('needs_power').notNull().default(false),
}, (t) => [index('events_owner_rev').on(t.ownerId, t.rev), index('events_team_rev').on(t.teamId, t.rev)]);
