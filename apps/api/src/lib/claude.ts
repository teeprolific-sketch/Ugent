/* Cloud chat: Claude reads the user's day and replies with text plus proposed actions as structured JSON.
 * The phone shows the actions and runs them only after the user agrees. Times and reschedules are
 * computed by the shared planner, so Claude decides *what* to do and the planner decides *when*.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { Action, AgentReply, ChatRequest, PlannerState, Reason } from '@ugent/core';
import { addDays, computeReschedule, fmtDate, KINDS, langMeta, lateMessage, REASONS, suggestSlot, wallClock } from '@ugent/core';
import { z } from 'zod';

const MODEL = 'claude-opus-5-5';

let client: Anthropic | null = null;
export const cloudChatEnabled = () => !!process.env.ANTHROPIC_API_KEY;
const getClient = () => (client ??= new Anthropic());

// Stable system prompt (no dates or user data here, so it stays cacheable).
const SYSTEM = `You are Ugent, a personal assistant made by Me AI for people living and working in Africa, mainly Nigeria.
You help one person run their day: plans, tasks, focus time, and the disruptions of daily life such as traffic ("go-slow"), power cuts ("NEPA", "light don go"), family needs and irregular work.

Write like a calm, practical friend. Keep replies short: one to three sentences that fit on a phone screen. No markdown, no lists, no emoji.
Reply in the user's chosen language (given in each message): English, Nigerian Pidgin, Yoruba, Igbo, Hausa or French. The user may mix languages; understand them, and answer in their chosen language.

You can propose actions. The app shows each one to the user, who confirms it before anything changes, so propose an action whenever the user asks for something you can do, and describe it plainly in your reply.
- add_task: something to do without a set time. Needs title and date.
- add_event: something at a time. Needs title, date, kind, and duration_minutes. Set start only if the user gave a time; leave it null and the app will pick the best free time.
- reschedule: the user's day was disrupted. Set reason to traffic, late, power, tired or emergency. The app works out which plans move.
- move_event: move one existing plan. Needs event_id from the list you are given, plus the new date and start.
- complete_task: the user finished a task. Needs task_id from the list you are given.
- focus: start a focus session. Needs minutes.
Fill every field that an action does not use with null. Only use event and task ids that appear in the user's data. Never invent plans the user did not ask for.
If the user asks for something you cannot do (calls, payments, bookings with other people), say so briefly and suggest what you can do instead, such as adding a reminder.
If the user wants to tell someone they are late or busy, put a short message they can send in draft; otherwise draft is null.
Sleek (verified artisans), Domestica I (home robot) and Afrika I (farm robot) are Me AI products that are coming soon; if asked, say they are not available yet.`;

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] });

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'draft', 'actions'],
  properties: {
    reply: { type: 'string' },
    draft: nullable({ type: 'string' }),
    actions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'title', 'date', 'start', 'duration_minutes', 'kind', 'reason', 'minutes', 'event_id', 'task_id'],
        properties: {
          type: { type: 'string', enum: ['add_task', 'add_event', 'reschedule', 'move_event', 'complete_task', 'focus'] },
          title: nullable({ type: 'string' }),
          date: nullable({ type: 'string', description: 'YYYY-MM-DD' }),
          start: nullable({ type: 'string', description: 'HH:MM, 24-hour' }),
          duration_minutes: nullable({ type: 'integer' }),
          kind: nullable({ type: 'string', enum: [...KINDS] }),
          reason: nullable({ type: 'string', enum: [...REASONS] }),
          minutes: nullable({ type: 'integer' }),
          event_id: nullable({ type: 'string' }),
          task_id: nullable({ type: 'string' }),
        },
      },
    },
  },
} as const;

const Output = z.object({
  reply: z.string(),
  draft: z.string().nullable(),
  actions: z.array(z.object({
    type: z.enum(['add_task', 'add_event', 'reschedule', 'move_event', 'complete_task', 'focus']),
    title: z.string().nullable(),
    date: z.string().nullable(),
    start: z.string().nullable(),
    duration_minutes: z.number().int().nullable(),
    kind: z.enum(KINDS).nullable(),
    reason: z.enum(REASONS).nullable(),
    minutes: z.number().int().nullable(),
    event_id: z.string().nullable(),
    task_id: z.string().nullable(),
  })),
});
type Output = z.infer<typeof Output>;

const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = (s: string | null): s is string => !!s && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** The user's data for this turn. Goes in the user message, after the stable prefix. */
function contextBlock(req: ChatRequest, state: PlannerState, now: Date): string {
  const d0 = fmtDate(now);
  const d1 = addDays(d0, 1);
  const weekday = now.toLocaleDateString('en-GB', { weekday: 'long' });
  const evs = state.events
    .filter((e) => !e.deleted && (e.date === d0 || e.date === d1))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .map((e) => `- [${e.id}] ${e.date === d0 ? 'today' : 'tomorrow'} ${e.start} (${e.dur} min, ${e.kind}${e.fixed ? ', fixed time' : ''}): ${e.title}`);
  const tks = state.tasks
    .filter((x) => !x.deleted && !x.done)
    .slice(0, 40)
    .map((x) => `- [${x.id}] ${x.title}${x.important ? ' (important)' : ''}${x.date !== d0 ? ` (due ${x.date})` : ''}`);
  return [
    `<user_data>`,
    `Now: ${weekday} ${d0}, ${req.localNow.slice(11)}. Tomorrow is ${d1}.`,
    `Language for your reply: ${langMeta(req.lang).name}.`,
    `Name: ${state.name || 'not given'}. Best time of day for hard work: ${state.peak}.`,
    `Plans today and tomorrow:`,
    evs.length ? evs.join('\n') : '- none',
    `Open tasks:`,
    tks.length ? tks.join('\n') : '- none',
    `</user_data>`,
  ].join('\n');
}

/** Turns Claude's proposals into checked app actions. Anything malformed is dropped, not guessed. */
function toActions(out: Output, state: PlannerState, now: Date): { actions: Action[]; draft?: string } {
  const actions: Action[] = [];
  let draft = out.draft ?? undefined;
  for (const a of out.actions) {
    if (a.type === 'add_task' && a.title) {
      actions.push({ type: 'addTask', title: a.title.slice(0, 300), date: isDate(a.date) ? a.date : fmtDate(now) });
    } else if (a.type === 'add_event' && a.title) {
      const kind = a.kind ?? 'personal';
      const dur = Math.min(600, Math.max(5, a.duration_minutes ?? (kind === 'deep' ? 90 : kind === 'meeting' ? 60 : 30)));
      const date = isDate(a.date) ? a.date : fmtDate(now);
      const slot = isTime(a.start) ? { date, start: a.start } : suggestSlot(state, kind, dur, now, date);
      actions.push({ type: 'addEvent', title: a.title.slice(0, 300), date: slot.date, start: slot.start, dur, kind });
    } else if (a.type === 'reschedule' && a.reason) {
      const { moves, fixedSoon } = computeReschedule(state, a.reason as Reason, now);
      if (moves.length) actions.push({ type: 'reschedule', reason: a.reason, moves });
      if (fixedSoon && !draft) draft = lateMessage(a.reason, fixedSoon);
    } else if (a.type === 'move_event' && a.event_id && isDate(a.date) && isTime(a.start)) {
      const ev = state.events.find((e) => e.id === a.event_id && !e.deleted);
      if (ev) actions.push({ type: 'moveEvent', move: { id: ev.id, title: ev.title, fromDate: ev.date, from: ev.start, toDate: a.date, to: a.start } });
    } else if (a.type === 'complete_task' && a.task_id) {
      const tk = state.tasks.find((x) => x.id === a.task_id && !x.deleted && !x.done);
      if (tk) actions.push({ type: 'completeTask', id: tk.id, title: tk.title });
    } else if (a.type === 'focus') {
      actions.push({ type: 'focus', mins: Math.min(240, Math.max(5, a.minutes ?? state.focusMins)) });
    }
  }
  return { actions, draft };
}

export class CloudChatUnavailable extends Error {}

/** Ask Claude. Throws CloudChatUnavailable when the cloud cannot answer, so the caller can fall back. */
export async function cloudChat(req: ChatRequest, state: PlannerState): Promise<AgentReply> {
  if (!cloudChatEnabled()) throw new CloudChatUnavailable('no_key');
  const now = wallClock(req.localNow);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...req.history.map((h) => ({ role: h.role, content: h.text })),
    { role: 'user', content: `${contextBlock(req, state, now)}\n\n${req.message}` },
  ];
  // History must start with a user turn and alternate; drop a leading assistant greeting if present.
  while (messages.length && messages[0].role !== 'user') messages.shift();

  let res: Anthropic.Beta.BetaMessage;
  try {
    res = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      messages,
      // Chat is short and latency-sensitive; low effort keeps replies quick.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      // If a safety classifier declines, Anthropic re-runs the request on its recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    }, { timeout: 30_000 });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) console.warn('Claude rate limited');
    else if (e instanceof Anthropic.APIError) console.error(`Claude API error ${e.status}: ${e.message}`);
    else console.error('Claude request failed', e);
    throw new CloudChatUnavailable('api_error');
  }

  if (res.stop_reason === 'refusal') throw new CloudChatUnavailable('refusal');
  if (res.stop_reason === 'max_tokens') throw new CloudChatUnavailable('truncated');
  const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  let out: Output;
  try {
    out = Output.parse(JSON.parse(text));
  } catch {
    console.error('Claude returned output that does not match the schema');
    throw new CloudChatUnavailable('bad_output');
  }
  const { actions, draft } = toActions(out, state, now);
  return { text: out.reply.trim(), actions, draft, source: 'cloud' };
}
