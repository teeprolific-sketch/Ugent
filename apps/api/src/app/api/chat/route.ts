import type { AgentReply, PlannerState, TimeStr } from '@ugent/core';
import { ChatRequest, respond, wallClock } from '@ugent/core';
import { eq, sql } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { CloudChatUnavailable, cloudChat } from '@/lib/claude';
import { db, schema } from '@/lib/db';
import { body, handle, json } from '@/lib/http';
import { CHAT_LIMIT, effectivePlan } from '@/lib/plan';

const fmtTime = (lang: string) => (hhmm: TimeStr) => {
  const [h, m] = hhmm.split(':').map(Number);
  return lang === 'fr' ? `${h} h ${String(m).padStart(2, '0')}` : `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/**
 * Chat with Ugent. Uses Claude when available and within the plan's daily allowance;
 * otherwise answers with the same on-device agent the phone runs offline, so chat never fails.
 */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const input = await body(req, ChatRequest);
  const state: PlannerState = {
    events: input.state.events, tasks: input.state.tasks, log: { completions: input.state.completions },
    peak: input.state.peak, learn: input.state.learn, focusMins: input.state.focusMins, name: input.state.name, day: input.state.day,
  };
  const day = input.localNow.slice(0, 10);
  const limit = CHAT_LIMIT[effectivePlan(user)];

  // Count this message against today's allowance atomically.
  const [{ count }] = await db.update(schema.users).set({
    chatCount: sql`case when ${schema.users.chatDay} = ${day} then ${schema.users.chatCount} + 1 else 1 end`,
    chatDay: day,
  }).where(eq(schema.users.id, user.id)).returning({ count: schema.users.chatCount });

  let reply: AgentReply;
  let limited = false;
  if (count > limit) {
    limited = true;
    reply = respond(input.message, state, { lang: input.lang, now: wallClock(input.localNow), fmtTime: fmtTime(input.lang) });
  } else {
    try {
      reply = await cloudChat(input, state);
    } catch (e) {
      if (!(e instanceof CloudChatUnavailable)) throw e;
      reply = respond(input.message, state, { lang: input.lang, now: wallClock(input.localNow), fmtTime: fmtTime(input.lang) });
    }
  }
  return json({ reply, remaining: Math.max(0, limit - count), limited });
});
