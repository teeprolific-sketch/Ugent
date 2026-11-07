/* The contract between the mobile app and the API. Both sides validate with these schemas. */
import { z } from 'zod';
import { EventSchema, LANGS, PEAKS, PLANS, TaskSchema } from './types';

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
    events: z.array(EventSchema).max(300),
    tasks: z.array(TaskSchema).max(300),
    completions: z.array(z.object({ t: z.number() })).max(500),
  }),
});
export type ChatRequest = z.infer<typeof ChatRequest>;

export const SyncRequest = z.object({
  /** Server cursor from the last sync; 0 on first sync. */
  since: z.number().int().min(0),
  tasks: z.array(TaskSchema).max(1000),
  events: z.array(EventSchema).max(1000),
  profile: z.object({ name: z.string().max(80), lang: z.enum(LANGS), peak: z.enum(PEAKS) }).optional(),
});
export type SyncRequest = z.infer<typeof SyncRequest>;

export const SyncResponse = z.object({
  cursor: z.number().int(),
  tasks: z.array(TaskSchema),
  events: z.array(EventSchema),
  me: Me,
});
export type SyncResponse = z.infer<typeof SyncResponse>;

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
