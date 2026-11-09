/* Local reminders for upcoming plans. Focus mode holds them: they arrive silently in the list instead. */
import type { PlanEvent } from '@ugent/core';
import { fmtDate, t, toMin } from '@ugent/core';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { liveEvents, useApp } from '@/store';
import { fmtTime } from './format';

/** True when a time falls in the user's sleep window (quiet hours). */
function asleep(d: Date, wake: number, sleep: number): boolean {
  const m = d.getHours() * 60 + d.getMinutes();
  return sleep > wake ? m >= sleep || m < wake : m >= sleep && m < wake;
}

export function initNotifications() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const f = useApp.getState().focus;
      const focusing = !!f && f.until > Date.now();
      return { shouldShowBanner: !focusing, shouldShowList: true, shouldPlaySound: !focusing, shouldSetBadge: false };
    },
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('reminders', { name: 'Reminders', importance: Notifications.AndroidImportance.HIGH }).catch(() => {});
  }
}

export async function askNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Re-plans reminders for the next 48 hours. Cheap enough to call after any change to plans. */
export async function scheduleReminders() {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const s = useApp.getState();
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    const now = Date.now();
    const lead = s.settings.leadMins;
    const quiet = (d: Date) => s.settings.quietHours && asleep(d, s.profile.wake, s.profile.sleep);
    const fmt = fmtTime(s.profile.lang);
    const mode = s.settings.notifMode;
    // Urgent: only things that can't move (fixed plans, meetings, places to be). Smart: your own plans
    // (your calendar app already reminds you of imported events) plus leave-by alerts. All: everything.
    const wanted = (e: PlanEvent) => mode === 'all' || (mode === 'smart' ? !e.external : e.fixed || e.kind === 'meeting' || !!e.location);
    const startOf = (e: PlanEvent) => { const [y, m, d] = e.date.split('-').map(Number); return new Date(y, m - 1, d, 0, toMin(e.start)); };
    const mine = (s.settings.reminders ? liveEvents(s) : []).filter((e) => (!e.teamId || !e.ownerId || e.ownerId === s.me?.id) && wanted(e));
    const alerts: { e: PlanEvent; at: Date; leave: boolean }[] = [];
    for (const e of mine) {
      const start = startOf(e);
      // Somewhere to go: one "leave by" alert (travel buffer + 10 min) replaces the usual reminder.
      const leave = mode !== 'urgent' && !!e.location && !e.external;
      alerts.push({ e, at: new Date(start.getTime() - (leave ? s.settings.travelBuffer + 10 : lead) * 60000), leave });
    }
    const upcoming = alerts
      .filter(({ at }) => at.getTime() > now && at.getTime() < now + 48 * 3600000 && !quiet(at))
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .slice(0, 30);
    for (const { e, at, leave } of upcoming) {
      await Notifications.scheduleNotificationAsync({
        content: leave
          ? { title: `Leave soon for ${e.title}`, body: `It starts at ${fmt(e.start)} at ${e.location}. About ${s.settings.travelBuffer} min to get there.` }
          : { title: e.title, body: `Starts at ${fmt(e.start)}${e.location ? ` at ${e.location}` : ''}${e.fixed ? '' : '. Plans changed? Open Ugent to move it.'}` },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'reminders' },
      });
    }
    // Morning brief: the next one, with that day's numbers.
    if (s.settings.briefTime && mode !== 'urgent') {
      const [h, m] = s.settings.briefTime.split(':').map(Number);
      const at = new Date(); at.setHours(h, m, 0, 0);
      if (at.getTime() <= now) at.setDate(at.getDate() + 1);
      const day = fmtDate(at);
      const evs = liveEvents(s).filter((e) => e.date === day).length;
      const open = s.tasks.filter((x) => !x.deleted && !x.done && x.date <= day).length;
      await Notifications.scheduleNotificationAsync({
        content: { title: t(s.profile.lang, 'home.brief'), body: t(s.profile.lang, 'brief', { e: evs, t: open }) },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'reminders' },
      });
    }
    if (s.focus && s.focus.until > now) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Focus time is up', body: `Well done. ${s.focus.mins} minutes of focus.` },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(s.focus.until), channelId: 'reminders' },
      });
    }
  } catch {
    // Reminders are a convenience; never block the app on them.
  }
}
