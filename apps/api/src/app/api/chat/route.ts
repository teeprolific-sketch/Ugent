import type { AgentReply, PlannerState, TimeStr } from '@ugent/core';
import { actionInfo, ChatRequest, respond, wallClock } from '@ugent/core';
import { eq, sql } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { CloudChatUnavailable, cloudChat } from '@/lib/claude';
import { db, schema } from '@/lib/db';
import { body, handle, json } from '@/lib/http';
import { CHAT_LIMIT, effectivePlan } from '@/lib/plan';
import { filterActions, policyFor, recordActionEvents, recordUsage } from '@/lib/policy';

const fmtTime = (lang: string) => (hhmm: TimeStr) => {
  const [h, m] = hhmm.split(':').map(Number);
  return lang === 'fr' ? `${h} h ${String(m).padStart(2, '0')}` : `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/**
 * Chat with Ugent. Uses Claude when available, allowed and within the plan's daily allowance;
 * otherwise answers with the same on-device agent the phone runs offline, so chat never fails.
 * Proposed actions pass through the user's policy (kill switches, trust level) before they reach the phone,
 * and the server records what was proposed or blocked, without any message content.
 */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const input = await body(req, ChatRequest);
  const policy = await policyFor(user);
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

  const device = () => respond(input.message, state, { lang: input.lang, now: wallClock(input.localNow), fmtTime: fmtTime(input.lang) });
  let reply: AgentReply;
  let limited = false;
  let model: string | null = 'on-device';
  const started = Date.now();
  if (count > limit) {
    limited = true;
    reply = device();
  } else if (!policy.cloudChat) {
    reply = device();
  } else {
    try {
      const r = await cloudChat(input, state);
      reply = r.reply; model = r.model;
      await recordUsage({ userId: user.id, model: r.model, taskType: 'chat', tokensIn: r.tokensIn, tokensOut: r.tokensOut, latencyMs: Date.now() - started, fallback: false });
    } catch (e) {
      if (!(e instanceof CloudChatUnavailable)) throw e;
      reply = device();
    }
  }
  const latencyMs = Date.now() - started;
  const { allowed, blocked } = filterActions(policy, reply.actions);
  await recordActionEvents(user.id, [
    ...allowed.map((a) => ({ type: a.type, status: 'proposed', source: reply.source, model, latencyMs, action: a as unknown as Record<string, unknown> })),
    ...blocked.map((b) => ({ type: b.action.type, status: 'blocked', source: 'server' as const, model, latencyMs, errorCode: b.reason.toUpperCase(), action: b.action as unknown as Record<string, unknown> })),
  ]);
  if (blocked.length) {
    // Say plainly what didn't happen, instead of the agent's "Done" wording.
    const names = [...new Set(blocked.map((b) => actionInfo(b.action.type)?.name ?? b.action.type))].join(', ');
    const why = blocked.some((b) => b.reason === 'trust_level') ? 'needs more trust on this account first' : 'is paused right now';
    const text = allowed.length ? `${reply.text} (${names} ${why}, so I left that out.)` : `I can't do that at the moment: ${names.toLowerCase()} ${why}. Please try again later.`;
    reply = { ...reply, actions: allowed, draft: allowed.length ? reply.draft : undefined, text };
  }
  return json({ reply, remaining: Math.max(0, limit - count), limited });
});
