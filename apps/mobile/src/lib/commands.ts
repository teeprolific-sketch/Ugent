/* App commands by voice or text, handled on the phone before anything goes to the AI:
 * open a screen, change a setting, sync, or say what Ugent remembers. */
import { norm } from '@ugent/core';
import type { Href } from 'expo-router';
import { effectivePlan, useApp } from '@/store';
import type { ThemeId } from '@/themes';
import { THEMES } from '@/themes';
import { syncNow } from './sync';

export interface Command { say: string; run?: () => void | Promise<void>; href?: Href }

const SCREENS: [RegExp, Href, string][] = [
  [/\b(tasks?|to ?dos?|work list)\b/, '/tasks', 'your tasks'],
  [/\b(schedule|plan|calendar|my day|agenda)\b/, '/schedule', 'your schedule'],
  [/\b(week|analytics|stats|statistics|progress|insights)\b/, '/analytics', 'your week'],
  [/\b(appearance|themes?)\b/, '/appearance', 'appearance'],
  [/\b(privacy|memory)\b/, '/privacy', 'privacy and memory'],
  [/\b(notifications?|reminders settings)\b/, '/notifications', 'notifications'],
  [/\b(connected apps|connections|integrations)\b/, '/connections', 'connected apps'],
  [/\b(whatsapp)\b/, '/connections/whatsapp', 'WhatsApp'],
  [/\b(maps?|location)\b/, '/connections/maps', 'maps'],
  [/\b(team dashboard|dashboard)\b/, '/team', 'the team dashboard'],
  [/\b(members|team admin)\b/, '/team-admin', 'team members'],
  [/\b(ecosystem|sleek|domestica|afrika|id'?d)\b/, '/ecosystem', 'the Me AI ecosystem'],
  [/\b(pricing|plans|subscription|upgrade)\b/, '/pricing', 'plans'],
  [/\b(profile)\b/, '/profile', 'your profile'],
  [/\b(help|support)\b/, '/help', 'help'],
  [/\b(settings)\b/, '/settings', 'settings'],
  [/\b(home|brief)\b/, '/', 'home'],
];

const OPEN = /^(?:please\s+)?(?:open|show(?:\s+me)?|go\s+to|take\s+me\s+to|launch|carry\s+me\s+go|show\s+me|ouvre|montre(?:-moi)?|va\s+(?:a|sur))\s+(?:my\s+|the\s+|mes\s+|mon\s+|ma\s+|le\s+|la\s+)?(.+)$/;
const ON = /\b(on|enable|start|activate|active|allume)\b/;
const OFF = /\b(off|disable|stop|deactivate|desactive|eteins)\b/;

export function parseCommand(text: string): Command | null {
  const n = norm(text).replace(/[.!?]+$/, '').trim();
  const s = useApp.getState();

  // Themes: "switch to black theme", "dark mode", "use the sunset theme".
  const th = n.match(/\b(black|dark|white|light|midnight|ocean|sunset|forest|royal|custom)\s*(?:theme|mode)\b|\b(?:theme|mode)\s+(black|dark|white|light|midnight|ocean|sunset|forest|royal|custom)\b/);
  if (th) {
    const word = th[1] ?? th[2];
    const id = (word === 'dark' ? 'black' : word === 'light' ? 'white' : word) as ThemeId;
    const def = THEMES.find((t) => t.id === id);
    const name = def?.name ?? 'Custom';
    if ((def?.pro || id === 'custom') && effectivePlan(s) === 'free') return { say: `The ${name} theme comes with Pro or Team. White and Black are free.`, href: '/appearance' };
    return { say: `Done. Ugent is now in the ${name} theme.`, run: () => s.setSettings({ theme: id }) };
  }

  // Settings switches.
  const toggle = (what: RegExp, key: 'lowData' | 'reminders' | 'voiceReplies' | 'askBeforeAction' | 'learn' | 'cloudChat', label: string): Command | null => {
    if (!what.test(n)) return null;
    const on = ON.test(n) ? true : OFF.test(n) ? false : null;
    if (on === null) return null;
    return { say: `${label} is ${on ? 'on' : 'off'}.`, run: () => s.setSettings({ [key]: on }) };
  };
  const t = toggle(/\blow data\b/, 'lowData', 'Low data mode')
    ?? toggle(/\breminders?\b/, 'reminders', 'Reminders')
    ?? toggle(/\b(speak|read) (my |the )?(replies|answers)|voice replies\b/, 'voiceReplies', 'Speaking replies out loud')
    ?? toggle(/\bask (me )?before\b/, 'askBeforeAction', 'Asking before actions')
    ?? toggle(/\blearning\b|\blearn from me\b/, 'learn', 'Learning from your habits');
  if (t) return t;

  // Background work.
  if (/^(sync|sync now|back ?up|backup now|save (it )?(online|to the cloud))$/.test(n)) {
    return { say: 'Syncing your plans and tasks now.', run: () => { void syncNow(); } };
  }

  // Memory.
  if (/\bwhat (do|did) you (know|remember)\b|\bwhat have you learn(ed|t)\b|\bwetin you (know|remember)\b/.test(n)) {
    const notes = s.memory.notes.slice(0, 3).map((x) => x.text);
    const people = Object.values(s.memory.people).sort((a, b) => b.count - a.count).slice(0, 3).map((p) => p.name);
    const bits = [
      notes.length ? `You asked me to remember: ${notes.join('; ')}.` : 'You have not asked me to remember anything yet. Say "remember that…" any time.',
      people.length ? `You often talk to ${people.join(', ')}.` : '',
    ].filter(Boolean);
    return { say: `${bits.join(' ')} You can see and delete everything in Privacy and memory.` };
  }

  // Open a screen.
  const open = n.match(OPEN);
  if (open) {
    const target = open[1];
    for (const [re, href, label] of SCREENS) if (re.test(target)) return { say: `Opening ${label}.`, href };
  }
  return null;
}
