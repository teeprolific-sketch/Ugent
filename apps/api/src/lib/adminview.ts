/* Shapes for the admin console: masked, content-free views of users and their data. */
import { maskEmail, maskPhone, redactText } from '@ugent/core';
import type { User } from './auth';

/** "Adaeze Okafor" → "Adaeze O." Staff never need a full name to help someone. */
export const maskName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'No name';
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0]}.`;
};

export const userRow = (u: User) => ({
  id: u.id, name: maskName(u.name), plan: u.plan, status: u.status, trustLevel: u.trustLevel, lang: u.lang, platform: u.platform,
  createdAt: u.createdAt, lastSeenAt: u.lastSeenAt,
});

/** Contact details on a support ticket: masked phone or email. */
export const maskContact = (c: string | null) => (!c ? null : c.includes('@') ? maskEmail(c) : maskPhone(c));

/** Ticket text with numbers, emails, OTPs and the user's own name removed. */
export const redactTicket = (text: string, userName: string) => redactText(text, userName.split(/\s+/).filter((n) => n.length > 1));

export const ACTIVE_DAYS = 7;
export const since = (days: number) => new Date(Date.now() - days * 86400000);
