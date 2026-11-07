/* Local reminders for upcoming plans. Focus mode holds them: they arrive silently in the list instead. */
import { toMin } from '@ugent/core';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { liveEvents, useApp } from '@/store';
import { fmtTime } from './format';

const LEAD_MIN = 10;

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
    if (!s.settings.reminders || !(await Notifications.getPermissionsAsync()).granted) return;
    const now = Date.now();
    const fmt = fmtTime(s.profile.lang);
    const upcoming = liveEvents(s)
      .map((e) => {
        const [y, m, d] = e.date.split('-').map(Number);
        const start = new Date(y, m - 1, d, 0, toMin(e.start));
        return { e, at: new Date(start.getTime() - LEAD_MIN * 60000) };
      })
      .filter(({ at }) => at.getTime() > now && at.getTime() < now + 48 * 3600000)
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .slice(0, 30);
    for (const { e, at } of upcoming) {
      await Notifications.scheduleNotificationAsync({
        content: { title: e.title, body: `Starts at ${fmt(e.start)}${e.fixed ? '' : '. Plans changed? Open Ugent to move it.'}` },
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
