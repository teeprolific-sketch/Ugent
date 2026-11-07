import type { Me, Plan } from '@ugent/core';
import { LANGS } from '@ugent/core';
import type { User } from './auth';

/** The plan in force right now: a lapsed subscription falls back to free. */
export function effectivePlan(u: Pick<User, 'plan' | 'planExpiresAt'>, now = new Date()): Plan {
  if (u.plan === 'free') return 'free';
  if (u.planExpiresAt && u.planExpiresAt.getTime() < now.getTime()) return 'free';
  return u.plan === 'team' ? 'team' : 'pro';
}

/** Cloud chat messages per day. The on-device agent is always unlimited. */
export const CHAT_LIMIT: Record<Plan, number> = { free: 10, pro: 300, team: 300 };

export function toMe(u: User): Me {
  const lang = (LANGS as readonly string[]).includes(u.lang) ? (u.lang as Me['lang']) : 'en';
  return {
    id: u.id,
    name: u.name,
    lang,
    plan: effectivePlan(u),
    teamId: u.teamId,
    teamRole: u.teamRole === 'admin' || u.teamRole === 'member' ? u.teamRole : null,
  };
}
