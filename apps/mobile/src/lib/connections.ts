/* Connecting Ugent to other apps.
 * Device connections (contacts, SMS, WhatsApp, maps, phone calendar) need only a permission on the phone.
 * Cloud connections (Google Calendar, Gmail, Google Tasks, WhatsApp Business) go through the Ugent API,
 * which keeps the tokens; the phone never sees a Google password or token.
 */
import type { CloudIntegration, IntegrationStatus, PlanEvent } from '@ugent/core';
import { addDays, fmtDate, pad, uid } from '@ugent/core';
import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';
import type { DeviceConn } from '@/store';
import { useApp } from '@/store';
import { apiConfigured, ApiError, ensureSession, request } from './api';
import { saveData } from './data';

export interface ConnInfo {
  id: DeviceConn | CloudIntegration | 'notion';
  name: string;
  group: 'Messaging' | 'Calendars and tasks' | 'Places' | 'Later';
  what: string;
  kind: 'device' | 'cloud' | 'later';
  screen?: '/connections/whatsapp' | '/connections/maps';
}

export const CONNECTIONS: ConnInfo[] = [
  { id: 'whatsapp', name: 'WhatsApp', group: 'Messaging', kind: 'device', screen: '/connections/whatsapp', what: 'Send running-late messages, share your plan, and message people from chat.' },
  { id: 'whatsappBusiness', name: 'WhatsApp Business', group: 'Messaging', kind: 'cloud', screen: '/connections/whatsapp', what: 'Auto-reply to customers while you focus, and see who wrote.' },
  { id: 'sms', name: 'SMS', group: 'Messaging', kind: 'device', what: 'Send texts to people without data or WhatsApp.' },
  { id: 'phone', name: 'Phone and contacts', group: 'Messaging', kind: 'device', what: 'Call people by name: "Call Mum".' },
  { id: 'googleCalendar', name: 'Google Calendar', group: 'Calendars and tasks', kind: 'cloud', what: 'See your Google Calendar events in your plan, so Ugent never double-books you.' },
  { id: 'deviceCalendar', name: Platform.OS === 'ios' ? 'Apple Calendar' : 'Phone calendar', group: 'Calendars and tasks', kind: 'device', what: Platform.OS === 'ios' ? 'Bring in events from Apple Calendar and any accounts on this iPhone.' : 'Bring in events from the calendars on this phone, including Google.' },
  { id: 'googleTasks', name: 'Google Tasks', group: 'Calendars and tasks', kind: 'cloud', what: 'Bring your open Google Tasks into Ugent.' },
  { id: 'gmail', name: 'Gmail', group: 'Calendars and tasks', kind: 'cloud', what: 'Mention important unread emails in your daily brief. Ugent reads only senders and subjects.' },
  { id: 'googleMaps', name: 'Google Maps', group: 'Places', kind: 'device', screen: '/connections/maps', what: 'Directions, travel times and when to leave for each plan.' },
  { id: 'notion', name: 'Notion', group: 'Later', kind: 'later', what: 'Bring in pages and to-dos from Notion. Coming later.' },
];

export type ConnStatus = { on: boolean; label: string; needsSetup?: boolean };

export function statusOf(c: ConnInfo): ConnStatus {
  const s = useApp.getState();
  if (c.kind === 'later') return { on: false, label: 'Coming later' };
  if (c.kind === 'device') {
    const st = s.connections[c.id as DeviceConn];
    return st?.on ? { on: true, label: st.detail ? `Connected · ${st.detail}` : 'Connected' } : { on: false, label: 'Not connected' };
  }
  const cl = s.cloud.find((x) => x.provider === c.id);
  if (!apiConfigured()) return { on: false, label: 'Needs the Ugent server', needsSetup: true };
  if (!cl) return { on: false, label: 'Not connected' };
  if (cl.connected) return { on: true, label: cl.account ? `Connected · ${cl.account}` : 'Connected' };
  if (!cl.available) return { on: false, label: 'Being set up by Me AI', needsSetup: true };
  return { on: false, label: 'Not connected' };
}

export async function refreshCloud(): Promise<IntegrationStatus[]> {
  if (!apiConfigured()) return [];
  try {
    await ensureSession(useApp.getState().profile);
    const { items } = await request<{ items: IntegrationStatus[] }>('GET', '/api/integrations');
    useApp.getState().setCloud(items);
    return items;
  } catch { return useApp.getState().cloud; }
}

/** Connect. Returns a message for the user. */
export async function connect(id: ConnInfo['id']): Promise<string> {
  const s = useApp.getState();
  if (Platform.OS === 'web' && ['phone', 'sms', 'deviceCalendar'].includes(id)) return 'This works in the phone app. Install Ugent on your phone to connect it.';
  switch (id) {
    case 'phone': {
      const C = await import('expo-contacts/legacy');
      const { granted } = await C.requestPermissionsAsync();
      if (!granted) return 'Ugent needs access to contacts. You can allow it in your phone settings.';
      s.setConnection('phone', true);
      return 'Phone and contacts connected. Try "Call Mum".';
    }
    case 'sms': {
      const SMS = await import('expo-sms');
      if (!(await SMS.isAvailableAsync())) return 'This device cannot send SMS.';
      s.setConnection('sms', true);
      return 'SMS connected.';
    }
    case 'whatsapp': {
      const ok = Platform.OS === 'web' || (await Linking.canOpenURL('whatsapp://send').catch(() => false));
      if (!ok) return 'WhatsApp is not installed on this phone.';
      s.setConnection('whatsapp', true);
      return 'WhatsApp connected. Ugent opens WhatsApp with your message ready; you press send.';
    }
    case 'googleMaps': {
      if (Platform.OS !== 'web') {
        const L = await import('expo-location');
        const { granted } = await L.requestForegroundPermissionsAsync();
        if (!granted) return 'Ugent needs your location for travel times. You can allow it in your phone settings.';
      }
      s.setConnection('googleMaps', true);
      return 'Google Maps connected.';
    }
    case 'deviceCalendar': {
      const n = await importDeviceCalendar(true);
      return n < 0 ? 'Ugent needs access to your calendar. You can allow it in your phone settings.' : `Calendar connected. ${n} event${n === 1 ? '' : 's'} added to your plan for the next 7 days.`;
    }
    case 'googleCalendar': case 'gmail': case 'googleTasks':
      return connectGoogle(id);
    default:
      return 'This connection is not available yet.';
  }
}

async function connectGoogle(provider: 'googleCalendar' | 'gmail' | 'googleTasks'): Promise<string> {
  if (!apiConfigured()) return 'Google needs the Ugent server, which this build is not set up with.';
  try {
    await ensureSession(useApp.getState().profile);
    const { url } = await request<{ url: string }>('POST', '/api/integrations/google/start', { provider });
    const res = await WebBrowser.openAuthSessionAsync(url, 'ugent://connections');
    if (res.type !== 'success' || !res.url.includes(`connected=${provider}`)) return 'Google sign-in was not completed.';
    await refreshCloud();
    if (provider === 'googleCalendar') { const n = await importGoogleCalendar(); return `Google Calendar connected. ${n} event${n === 1 ? '' : 's'} added for the next 7 days.`; }
    if (provider === 'gmail') { await refreshGmail(); return 'Gmail connected. Important emails will show in your brief.'; }
    return 'Google Tasks connected. Import your tasks from the Connected apps screen.';
  } catch (e) {
    return e instanceof ApiError ? e.message : 'Could not reach Google. Check your connection and try again.';
  }
}

export async function disconnect(id: ConnInfo['id']): Promise<string> {
  const s = useApp.getState();
  if (id === 'deviceCalendar') s.setExternalEvents('dev-', []);
  if (id === 'googleCalendar') s.setExternalEvents('gcal-', []);
  if (id === 'gmail') s.setGmail(null);
  if (['phone', 'sms', 'whatsapp', 'googleMaps', 'deviceCalendar'].includes(id)) {
    s.setConnection(id as DeviceConn, false);
    return 'Disconnected. To remove the permission fully, turn it off in your phone settings.';
  }
  try {
    await request('DELETE', `/api/integrations/${id}`);
    await refreshCloud();
    return 'Disconnected. Ugent deleted its access.';
  } catch (e) {
    return e instanceof ApiError ? e.message : 'Could not reach the server. Try again when online.';
  }
}

const toPlan = (prefix: string, e: { id: string; title: string; date: string; start: string; dur: number; location?: string | null }): PlanEvent => ({
  id: `${prefix}${e.id}`, title: e.title, date: e.date, start: e.start, dur: e.dur, kind: 'meeting', fixed: true, needsPower: false,
  updatedAt: Date.now(), external: true, location: e.location ?? null,
});

/** Reads the next 7 days from the phone's calendars. Returns the count, or -1 without permission. */
export async function importDeviceCalendar(ask = false): Promise<number> {
  if (Platform.OS === 'web') return 0;
  const Cal = await import('expo-calendar/legacy');
  const perm = ask ? await Cal.requestCalendarPermissionsAsync() : await Cal.getCalendarPermissionsAsync();
  if (!perm.granted) return -1;
  const cals = await Cal.getCalendarsAsync(Cal.EntityTypes.EVENT);
  const from = new Date(); from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 7 * 86400000);
  const evs = await Cal.getEventsAsync(cals.map((c) => c.id), from, to);
  const list = evs.filter((e) => !e.allDay).map((e) => {
    const st = new Date(e.startDate); const en = new Date(e.endDate);
    return toPlan('dev-', { id: e.id, title: e.title || 'Busy', date: fmtDate(st), start: `${pad(st.getHours())}:${pad(st.getMinutes())}`, dur: Math.max(5, Math.round((en.getTime() - st.getTime()) / 60000)), location: e.location || null });
  });
  useApp.getState().setExternalEvents('dev-', list);
  useApp.getState().setConnection('deviceCalendar', true, `${cals.length} calendar${cals.length === 1 ? '' : 's'}`);
  return list.length;
}

export async function importGoogleCalendar(): Promise<number> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Lagos';
  const { events } = await request<{ events: { id: string; title: string; date: string; start: string; dur: number; location: string | null }[] }>('GET', `/api/integrations/google/calendar?days=7&tz=${encodeURIComponent(tz)}`);
  // Google ids already carry their "gcal-" prefix from the server.
  useApp.getState().setExternalEvents('gcal-', events.map((e) => ({ ...toPlan('', e), id: e.id })));
  return events.length;
}

/** Adds open Google Tasks that are not already in Ugent. Returns how many were added. */
export async function importGoogleTasks(): Promise<number> {
  const { tasks } = await request<{ tasks: { id: string; title: string; due: string | null }[] }>('GET', '/api/integrations/google/tasks');
  const s = useApp.getState();
  const have = new Set(s.tasks.filter((t) => !t.deleted).map((t) => t.title.toLowerCase()));
  let n = 0;
  for (const t of tasks) if (!have.has(t.title.toLowerCase())) { s.addTask(t.title, t.due && t.due >= fmtDate(new Date()) ? t.due : undefined); n++; }
  return n;
}

export async function refreshGmail() {
  try {
    const r = await request<{ unreadImportant: number; top: { from: string; subject: string }[] }>('GET', '/api/integrations/google/gmail');
    useApp.getState().setGmail({ count: r.unreadImportant, top: r.top, at: Date.now() });
  } catch { /* keep the last known summary */ }
}

/** Keep imported calendars fresh (called when the app opens). */
export async function refreshImports() {
  const s = useApp.getState();
  if (s.connections.deviceCalendar?.on) await importDeviceCalendar().catch(() => 0);
  // The phone's own calendar costs no data; Google Calendar and Gmail wait while Ugent is saving data.
  if (saveData()) return;
  if (s.cloud.find((c) => c.provider === 'googleCalendar')?.connected) await importGoogleCalendar().catch(() => 0);
  if (s.cloud.find((c) => c.provider === 'gmail')?.connected) await refreshGmail();
}

export const localId = () => uid();
export const weekAhead = () => addDays(fmtDate(new Date()), 7);
