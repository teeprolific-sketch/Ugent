/* The contract between the mobile app and the API. Both sides validate with these schemas. */
import { z } from 'zod';
import { EventSchema, HUSTLES, LANGS, PEAKS, PLANS, TaskSchema } from './types';

export const DeviceAuthRequest = z.object({
  deviceId: z.string().min(8).max(128),
  platform: z.enum(['ios', 'android', 'web']),
  name: z.string().max(80).optional(),
  lang: z.enum(LANGS).optional(),
});
export type DeviceAuthRequest = z.infer<typeof DeviceAuthRequest>;

export const Me = z.object({
  id: z.string(),
  name: z.string(),
  lang: z.enum(LANGS),
  plan: z.enum(PLANS),
  teamId: z.string().nullable(),
  teamRole: z.enum(['admin', 'member']).nullable(),
});
export type Me = z.infer<typeof Me>;

export const AuthResponse = z.object({ token: z.string(), me: Me });
export type AuthResponse = z.infer<typeof AuthResponse>;

export const ChatRequest = z.object({
  message: z.string().min(1).max(2000),
  /** Recent turns for context, oldest first. Text only. */
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(4000) })).max(20),
  lang: z.enum(LANGS),
  /** The phone's local wall-clock time, "YYYY-MM-DDTHH:MM". */
  localNow: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  state: z.object({
    name: z.string().max(80),
    peak: z.enum(PEAKS),
    learn: z.boolean(),
    focusMins: z.number().int().min(5).max(240),
    hustle: z.enum(HUSTLES).nullable().optional(),
    day: z.object({ start: z.number().int().min(0).max(1439), end: z.number().int().min(0).max(1439) }).optional(),
    events: z.array(EventSchema).max(300),
    tasks: z.array(TaskSchema).max(300),
    completions: z.array(z.object({ t: z.number() })).max(500),
    /** What Ugent has learned about this person, so replies can be personal. */
    about: z.object({
      notes: z.array(z.string().max(300)).max(50),
      people: z.array(z.string().max(80)).max(30),
      places: z.array(z.string().max(200)).max(20),
      routines: z.array(z.string().max(200)).max(20),
    }).optional(),
  }),
});
export type ChatRequest = z.infer<typeof ChatRequest>;

export const SyncRequest = z.object({
  /** Server cursor from the last sync; 0 on first sync. */
  since: z.number().int().min(0),
  tasks: z.array(TaskSchema).max(1000),
  events: z.array(EventSchema).max(1000),
  /** Most rows to send back per table. Phones on slow or costly connections ask for small pages. */
  limit: z.number().int().min(20).max(2000).optional(),
  profile: z.object({
    name: z.string().max(80), lang: z.enum(LANGS), peak: z.enum(PEAKS),
    hustle: z.enum(HUSTLES).nullable().optional(),
    wake: z.number().int().min(0).max(1439).optional(),
    sleep: z.number().int().min(0).max(1439).optional(),
  }).optional(),
});
export type SyncRequest = z.infer<typeof SyncRequest>;

export const SyncResponse = z.object({
  cursor: z.number().int(),
  tasks: z.array(TaskSchema),
  events: z.array(EventSchema),
  me: Me,
  /** True when more changes are waiting: sync again from `cursor`. */
  more: z.boolean().optional(),
});
export type SyncResponse = z.infer<typeof SyncResponse>;

export const TeamRoleRequest = z.object({ role: z.enum(['admin', 'member']) });

export const TeamFeedItem = z.object({
  kind: z.enum(['task', 'event']), id: z.string(), title: z.string(), by: z.string(), at: z.number(),
  what: z.enum(['added', 'updated', 'done', 'deleted']),
});
export type TeamFeedItem = z.infer<typeof TeamFeedItem>;

export const TeamMemberStats = z.object({
  id: z.string(), name: z.string(), doneThisWeek: z.number(), open: z.number(), doing: z.number(), plansThisWeek: z.number(),
});
export type TeamMemberStats = z.infer<typeof TeamMemberStats>;

export const PRODUCTS = ['sleek', 'domestica', 'afrika', 'idd'] as const;
export type Product = (typeof PRODUCTS)[number];
export const WaitlistRequest = z.object({ product: z.enum(PRODUCTS) });

export const SupportRequest = z.object({
  topic: z.enum(['question', 'problem', 'billing', 'idea', 'privacy']),
  message: z.string().min(5).max(4000),
  contact: z.string().max(120).optional(),
});

export const INTEGRATIONS = ['googleCalendar', 'gmail', 'googleTasks', 'whatsappBusiness', 'googleMaps'] as const;
export type CloudIntegration = (typeof INTEGRATIONS)[number];
export const IntegrationStatus = z.object({
  provider: z.enum(INTEGRATIONS),
  /** Me AI has set this service up on the server. */
  available: z.boolean(),
  connected: z.boolean(),
  account: z.string().nullable(),
});
export type IntegrationStatus = z.infer<typeof IntegrationStatus>;

export const WaBusinessSettings = z.object({
  phoneNumberId: z.string().min(5).max(40),
  displayNumber: z.string().max(40),
  autoReplyOn: z.boolean(),
  autoReply: z.string().min(1).max(600),
});

export const EtaRequest = z.object({
  origin: z.union([z.string().min(2).max(200), z.object({ lat: z.number(), lng: z.number() })]),
  destination: z.string().min(2).max(200),
});

export const TeamCreateRequest = z.object({ name: z.string().min(1).max(80) });
export const TeamJoinRequest = z.object({ code: z.string().min(4).max(16) });
export const TeamInfo = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  members: z.array(z.object({ id: z.string(), name: z.string(), role: z.enum(['admin', 'member']) })),
});
export type TeamInfo = z.infer<typeof TeamInfo>;

/** "YYYY-MM-DDTHH:MM" -> a Date carrying those wall-clock values (timezone-free arithmetic). */
export function wallClock(localNow: string): Date {
  const [d, tm] = localNow.split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = tm.split(':').map(Number);
  return new Date(y, mo - 1, da, h, mi);
}
