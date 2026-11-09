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

/** How the user earns a living; shapes Ugent's defaults and suggestions. */
export const HUSTLES = ['office', 'business', 'freelance', 'shift', 'student', 'farmer', 'home'] as const;
export type Hustle = (typeof HUSTLES)[number];
export const HUSTLE_LABEL: Record<Hustle, { title: string; sub: string }> = {
  office: { title: '9 to 5', sub: 'Office or salaried job' },
  business: { title: 'Business owner or trader', sub: 'Shop, market or my own company' },
  freelance: { title: 'Freelance or gig work', sub: 'Clients, rides, deliveries, creative work' },
  shift: { title: 'Shift work', sub: 'Hospital, security, factory, call centre' },
  student: { title: 'Student', sub: 'School, university or exams' },
  farmer: { title: 'Farmer', sub: 'Crops, livestock or agribusiness' },
  home: { title: 'Home and family', sub: 'Running the home, caring for others' },
};

export const TASK_STATUS = ['todo', 'doing', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUS)[number];

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
  /** Team tasks: who it is assigned to and where it sits on the board. */
  assigneeId: z.string().nullable().optional(),
  status: z.enum(TASK_STATUS).optional(),
  /** Set by the server: who owns and who last changed the item. */
  ownerId: z.string().optional(),
  updatedBy: z.string().nullable().optional(),
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
  /** Free-text place, e.g. "Balogun Market, Lagos". Used for directions and leave-by times. */
  location: z.string().max(200).nullable().optional(),
  /** Imported from the phone's calendar; shown but never moved or synced. */
  external: z.boolean().optional(),
  ownerId: z.string().optional(),
  updatedBy: z.string().nullable().optional(),
});
export type PlanEvent = z.infer<typeof EventSchema>;

export interface Completion { t: number; id?: string; sample?: boolean }
export interface FocusLog { t: number; mins: number; sample?: boolean }
export interface EnergyLog { t: number; v: 'low' | 'ok' | 'high' }
export interface RescheduleLog { t: number; reason: Reason; n: number; sample?: boolean; /** How many of the moved plans started at 5 PM or later. */ evening?: number }
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
  /** Waking day in minutes after midnight. Defaults to 07:00 to 21:30. */
  day?: { start: number; end: number };
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
  /** Real-world actions through connected apps. The phone opens the app; the user presses send or call. */
  z.object({ type: z.literal('call'), name: z.string().min(1).max(80), phone: z.string().max(40).nullable() }),
  z.object({ type: z.literal('message'), channel: z.enum(['whatsapp', 'sms']), name: z.string().max(80).nullable(), phone: z.string().max(40).nullable(), text: z.string().min(1).max(1000) }),
  z.object({ type: z.literal('directions'), destination: z.string().min(1).max(200) }),
  /** A request to a Me AI product: book a Sleek artisan, or a command for Domestica I or Afrika I. */
  z.object({ type: z.literal('ecosystem'), product: z.enum(['sleek', 'domestica', 'afrika']), command: z.string().min(2).max(60), detail: z.string().max(300), date: dateStr.nullable(), start: timeStr.nullable() }),
  /** Something the user asked Ugent to remember about them ("my mum's name is Ngozi"). */
  z.object({ type: z.literal('remember'), text: z.string().min(2).max(300) }),
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
