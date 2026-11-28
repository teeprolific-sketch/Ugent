import { bigint, boolean, index, integer, jsonb, pgSequence, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

/** Bumped on every write so clients can pull "everything since my cursor". */
export const revSeq = pgSequence('ugent_rev');

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  deviceId: text('device_id').notNull().unique(),
  platform: text('platform').notNull(),
  name: text('name').notNull().default(''),
  lang: text('lang').notNull().default('en'),
  peak: text('peak').notNull().default('morning'),
  hustle: text('hustle'),
  /** Daily rhythm, minutes after midnight. */
  wake: integer('wake'),
  sleep: integer('sleep'),
  /** While set and in the future, WhatsApp Business auto-replies on the user's behalf. */
  focusUntil: timestamp('focus_until', { withTimezone: true }),
  /** free | pro | team. Set by the RevenueCat webhook. */
  plan: text('plan').notNull().default('free'),
  planExpiresAt: timestamp('plan_expires_at', { withTimezone: true }),
  teamId: text('team_id'),
  teamRole: text('team_role'),
  chatDay: text('chat_day').notNull().default(''),
  chatCount: integer('chat_count').notNull().default(0),
  /** active | suspended | banned. Set by staff; checked on every request. */
  status: text('status').notNull().default('active'),
  /** Bumped to sign the user out everywhere (tokens carry the version they were issued with). */
  sessionVersion: integer('session_version').notNull().default(0),
  /** 0 drafts only, 1 low-risk automatic, 2 medium risk with confirmation. Staff can only lower it. */
  trustLevel: integer('trust_level').notNull().default(2),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
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
  updatedBy: text('updated_by'),
};

export const tasks = pgTable('tasks', {
  ...syncColumns,
  important: boolean('important').notNull().default(false),
  done: boolean('done').notNull().default(false),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  doneAt: bigint('done_at', { mode: 'number' }),
  assigneeId: text('assignee_id'),
  status: text('status'),
}, (t) => [index('tasks_owner_rev').on(t.ownerId, t.rev), index('tasks_team_rev').on(t.teamId, t.rev)]);

export const events = pgTable('events', {
  ...syncColumns,
  start: text('start').notNull(),
  dur: integer('dur').notNull(),
  kind: text('kind').notNull(),
  fixed: boolean('fixed').notNull().default(false),
  needsPower: boolean('needs_power').notNull().default(false),
  location: text('location'),
}, (t) => [index('events_owner_rev').on(t.ownerId, t.rev), index('events_team_rev').on(t.teamId, t.rev)]);

/** Third-party accounts a user has connected (Google Calendar, Gmail, Google Tasks). Tokens never leave the server. */
export const connections = pgTable('connections', {
  userId: text('user_id').notNull(),
  provider: text('provider').notNull(),
  account: text('account'),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  scopes: text('scopes').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.provider] })]);

/** A WhatsApp Business number managed through Ugent (Meta Cloud API). */
export const waBusiness = pgTable('wa_business', {
  userId: text('user_id').primaryKey(),
  phoneNumberId: text('phone_number_id').notNull().unique(),
  displayNumber: text('display_number').notNull().default(''),
  autoReplyOn: boolean('auto_reply_on').notNull().default(true),
  autoReply: text('auto_reply').notNull().default("Thanks for your message. I'm focused on work right now and will reply soon."),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Customer messages that arrived on a connected WhatsApp Business number. */
export const waInbox = pgTable('wa_inbox', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  from: text('from_number').notNull(),
  text: text('text').notNull().default(''),
  autoReplied: boolean('auto_replied').notNull().default(false),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('wa_inbox_user_at').on(t.userId, t.at)]);

/** Waitlists for Me AI products that are not out yet (Sleek, Domestica I, Afrika I, ID'd). */
export const waitlist = pgTable('waitlist', {
  userId: text('user_id').notNull(),
  product: text('product').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.product] })]);

export const supportRequests = pgTable('support_requests', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  topic: text('topic').notNull(),
  message: text('message').notNull(),
  contact: text('contact'),
  /** Ticket workflow: open | waiting | closed. */
  status: text('status').notNull().default('open'),
  priority: text('priority').notNull().default('normal'),
  assignedTo: text('assigned_to'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ---------- Admin console ---------- */

/** Me AI staff who can use the Ugent admin console. */
export const staffUsers = pgTable('staff_users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  createdBy: text('created_by'),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const staffRoles = pgTable('staff_roles', {
  staffId: text('staff_id').notNull(),
  role: text('role').notNull(),
  grantedBy: text('granted_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.staffId, t.role] })]);

/** Personal access keys. Only a hash is stored; the key itself is shown once, when it is issued. */
export const staffAccessKeys = pgTable('staff_access_keys', {
  id: text('id').primaryKey(),
  staffId: text('staff_id').notNull(),
  prefix: text('prefix').notNull().unique(),
  keyHash: text('key_hash').notNull(),
  label: text('label').notNull().default(''),
  createdBy: text('created_by'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const staffSessions = pgTable('staff_sessions', {
  id: text('id').primaryKey(),
  staffId: text('staff_id').notNull(),
  keyId: text('key_id').notNull(),
  ip: text('ip'),
  userAgent: text('user_agent'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Append-only. The database refuses UPDATE and DELETE on this table (see migration). Shared Me AI format. */
export const auditLog = pgTable('audit_log', {
  id: text('id').primaryKey(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  staffId: text('staff_id').notNull(),
  product: text('product').notNull().default('ugent'),
  role: text('role').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  reason: text('reason').notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
  ip: text('ip'),
  userAgent: text('user_agent'),
}, (t) => [index('audit_at').on(t.at), index('audit_target').on(t.targetType, t.targetId)]);

/** Maker-checker: a second person approves before the change happens. */
export const approvalRequests = pgTable('approval_requests', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  payload: jsonb('payload').notNull(),
  summary: text('summary').notNull(),
  reason: text('reason').notNull(),
  requestedBy: text('requested_by').notNull(),
  decidedBy: text('decided_by'),
  status: text('status').notNull().default('pending'),
  decisionReason: text('decision_reason'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Switched-off action types, integrations and channels. A row is active until cleared; history is kept. */
export const killSwitches = pgTable('kill_switches', {
  id: text('id').primaryKey(),
  targetType: text('target_type').notNull(),
  targetKey: text('target_key').notNull(),
  reason: text('reason').notNull(),
  setBy: text('set_by').notNull(),
  clearedBy: text('cleared_by'),
  clearedAt: timestamp('cleared_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('kill_active').on(t.targetType, t.targetKey)]);

/** Action types that need approval to switch on (money actions). Rows here mean "enabled". */
export const enabledActionTypes = pgTable('enabled_action_types', {
  key: text('key').primaryKey(),
  enabledBy: text('enabled_by').notNull(),
  approvalId: text('approval_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** What the agent proposed or did. No content: the summary comes from a template. */
export const actionEvents = pgTable('action_events', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  actionType: text('action_type').notNull(),
  risk: text('risk').notNull(),
  status: text('status').notNull(),
  source: text('source').notNull(),
  model: text('model'),
  latencyMs: integer('latency_ms'),
  errorCode: text('error_code'),
  summary: text('summary').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('action_events_at').on(t.at), index('action_events_user').on(t.userId, t.at)]);

/** One row per cloud model call. Cost is in US dollar micro-units (1 = $0.000001) once prices are set. */
export const usageRecords = pgTable('usage_records', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  model: text('model').notNull(),
  taskType: text('task_type').notNull(),
  tokensIn: integer('tokens_in').notNull(),
  tokensOut: integer('tokens_out').notNull(),
  costUsdMicro: bigint('cost_usd_micro', { mode: 'number' }),
  latencyMs: integer('latency_ms').notNull(),
  fallback: boolean('fallback').notNull().default(false),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('usage_at').on(t.at)]);

export const userNotes = pgTable('user_notes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  staffId: text('staff_id').notNull(),
  note: text('note').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ticketMessages = pgTable('ticket_messages', {
  id: text('id').primaryKey(),
  ticketId: text('ticket_id').notNull(),
  staffId: text('staff_id'),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Export, deletion, correction and consent-withdrawal requests, with legal deadlines. */
export const dataRequests = pgTable('data_requests', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  type: text('type').notNull(),
  status: text('status').notNull().default('open'),
  source: text('source').notNull().default('app'),
  dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const incidents = pgTable('incidents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  severity: text('severity').notNull(),
  status: text('status').notNull().default('investigating'),
  components: text('components').notNull().default(''),
  ownerId: text('owner_id').notNull(),
  userComms: text('user_comms').notNull().default('Not yet'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

export const incidentUpdates = pgTable('incident_updates', {
  id: text('id').primaryKey(),
  incidentId: text('incident_id').notNull(),
  staffId: text('staff_id').notNull(),
  body: text('body').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

/** Versioned settings edited from the console (e.g. model prices). Newest row per key wins; nothing is overwritten. */
export const configVersions = pgTable('config_versions', {
  id: text('id').primaryKey(),
  key: text('key').notNull(),
  version: integer('version').notNull(),
  value: jsonb('value').notNull(),
  createdBy: text('created_by').notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('config_key_version').on(t.key, t.version)]);
