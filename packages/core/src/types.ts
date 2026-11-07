import { z } from 'zod';

export const LANGS = ['en', 'pcm', 'yo', 'ig', 'ha', 'fr'] as const;
export type Lang = (typeof LANGS)[number];

export const PEAKS = ['morning', 'afternoon', 'evening'] as const;
export type Peak = (typeof PEAKS)[number];

export const KINDS = ['meeting', 'deep', 'errand', 'personal'] as const;
export type Kind = (typeof KINDS)[number];

export const REASONS = ['traffic', 'late', 'power', 'tired', 'emergency'] as const;
export type Reason = (typeof REASONS)[number];

export const PLANS = ['free', 'pro', 'team'] as const;
export type Plan = (typeof PLANS)[number];

/** YYYY-MM-DD in the user's local time. */
export type DateStr = string;
/** HH:MM, 24-hour, local time. */
export type TimeStr = string;

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeStr = z.string().regex(/^\d{2}:\d{2}$/);

export const TaskSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(300),
  important: z.boolean(),
  done: z.boolean(),
  date: dateStr,
  createdAt: z.number(),
  doneAt: z.number().nullable().optional(),
  updatedAt: z.number(),
  deleted: z.boolean().optional(),
  sample: z.boolean().optional(),
  teamId: z.string().nullable().optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export const EventSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(300),
  date: dateStr,
  start: timeStr,
  dur: z.number().int().min(5).max(24 * 60),
  kind: z.enum(KINDS),
  fixed: z.boolean(),
  needsPower: z.boolean(),
  updatedAt: z.number(),
  deleted: z.boolean().optional(),
  sample: z.boolean().optional(),
  teamId: z.string().nullable().optional(),
});
export type PlanEvent = z.infer<typeof EventSchema>;

export interface Completion { t: number; id?: string; sample?: boolean }
export interface FocusLog { t: number; mins: number; sample?: boolean }
export interface EnergyLog { t: number; v: 'low' | 'ok' | 'high' }
export interface RescheduleLog { t: number; reason: Reason; n: number; sample?: boolean }
export interface Logs {
  completions: Completion[];
  focus: FocusLog[];
  energy: EnergyLog[];
  reschedules: RescheduleLog[];
}

/** The slice of app state the planner and agent need. */
export interface PlannerState {
  events: PlanEvent[];
  tasks: Task[];
  log: Pick<Logs, 'completions'>;
  peak: Peak;
  learn: boolean;
  focusMins: number;
  name: string;
}

export interface Move { id: string; title: string; fromDate: DateStr; from: TimeStr; toDate: DateStr; to: TimeStr }

/** Something Ugent proposes to do. The app shows it and runs it once the user agrees. */
export const ActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('addTask'), title: z.string().min(1).max(300), date: dateStr }),
  z.object({ type: z.literal('addEvent'), title: z.string().min(1).max(300), date: dateStr, start: timeStr, dur: z.number().int().min(5).max(600), kind: z.enum(KINDS) }),
  z.object({ type: z.literal('reschedule'), reason: z.enum(REASONS), moves: z.array(z.object({ id: z.string(), title: z.string(), fromDate: dateStr, from: timeStr, toDate: dateStr, to: timeStr })) }),
  z.object({ type: z.literal('focus'), mins: z.number().int().min(5).max(240) }),
  z.object({ type: z.literal('moveEvent'), move: z.object({ id: z.string(), title: z.string(), fromDate: dateStr, from: timeStr, toDate: dateStr, to: timeStr }) }),
  z.object({ type: z.literal('completeTask'), id: z.string(), title: z.string() }),
]);
export type Action = z.infer<typeof ActionSchema>;

export interface AgentReply {
  text: string;
  actions: Action[];
  /** A message the user can send to someone else, e.g. "running late". */
  draft?: string;
  /** Which brain answered: the on-device agent or the cloud model. */
  source: 'device' | 'cloud';
}
