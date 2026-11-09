/* Sends a chat message to the cloud agent when online, or answers on the phone when not. */
import NetInfo from '@react-native-community/netinfo';
import type { AgentReply } from '@ugent/core';
import { addDays, detectRoutines, fmtDate, respond, weekdayName } from '@ugent/core';
import type { ChatMessage } from '@/store';
import { aboutMe, plannerState, useApp } from '@/store';
import { apiConfigured, ensureSession, request } from './api';
import { fmtTime, localNow } from './format';

export async function askUgent(text: string, history: ChatMessage[]): Promise<AgentReply & { remaining?: number }> {
  const s = useApp.getState();
  const state = plannerState(s);
  const d0 = fmtDate(new Date());
  const device = () => respond(text, state, { lang: s.profile.lang, now: new Date(), fmtTime: fmtTime(s.profile.lang) });

  if (!apiConfigured() || s.settings.lowData || !s.settings.cloudChat) return device();
  const net = await NetInfo.fetch();
  if (net.isConnected === false) return device();
  try {
    await ensureSession(s.profile);
    const res = await request<{ reply: AgentReply; remaining: number }>('POST', '/api/chat', {
      message: text,
      history: history.slice(-10).map((m) => ({ role: m.from === 'me' ? 'user' : 'assistant', text: m.text })),
      lang: s.profile.lang,
      localNow: localNow(),
      state: {
        name: state.name, peak: state.peak, learn: state.learn, focusMins: state.focusMins, hustle: s.profile.hustle, day: state.day,
        events: state.events.filter((e) => e.date >= d0 && e.date <= addDays(d0, 7)).slice(0, 300),
        tasks: state.tasks.filter((t) => !t.done).slice(0, 300),
        completions: state.log.completions.slice(-500).map((c) => ({ t: c.t })),
        about: aboutMe(s, s.settings.learn ? detectRoutines(s.events, new Date()).map((r) => `${r.title} on ${weekdayName(r.weekday)}s around ${fmtTime(s.profile.lang)(r.start)}`) : []),
      },
    }, 35000);
    return { ...res.reply, remaining: res.remaining };
  } catch {
    return device();
  }
}
