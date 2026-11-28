import { ACTION_TYPES } from '@ugent/core';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { body, handle, json } from '@/lib/http';
import { recordActionEvents } from '@/lib/policy';

/* The phone reports what happened to actions it ran. Deliberately no free text: only the action type,
 * a fixed status, an error code from a short list and timings, so no message content can arrive here. */
const Telemetry = z.object({
  events: z.array(z.object({
    type: z.enum(ACTION_TYPES.map((a) => a.key) as [string, ...string[]]),
    status: z.enum(['confirmed_by_user', 'executed', 'failed', 'undone', 'declined', 'blocked']),
    errorCode: z.enum(['APP_NOT_INSTALLED', 'PERMISSION_DENIED', 'CONTACT_NOT_FOUND', 'OFFLINE', 'ACTION_DISABLED', 'TRUST_LEVEL', 'ACCOUNT_SUSPENDED', 'UNKNOWN']).nullish(),
    latencyMs: z.number().int().min(0).max(600000).nullish(),
  }).strict()).max(50),
}).strict();

export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const { events } = await body(req, Telemetry);
  await recordActionEvents(user.id, events.map((e) => ({ type: e.type, status: e.status, source: 'device' as const, errorCode: e.errorCode ?? null, latencyMs: e.latencyMs ?? null })));
  return json({ received: events.length });
});
