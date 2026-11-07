import { requireUser } from '@/lib/auth';
import { accessToken, googleGet, localParts } from '@/lib/google';
import { handle, json } from '@/lib/http';

interface GEvent { id: string; summary?: string; location?: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string } }

/** The user's Google Calendar events for the next few days, in their time zone (timed events only). */
export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  const url = new URL(req.url);
  const tz = url.searchParams.get('tz') || 'Africa/Lagos';
  const days = Math.min(14, Math.max(1, Number(url.searchParams.get('days') ?? 7)));
  const token = await accessToken(user.id, 'googleCalendar');
  const q = new URLSearchParams({ timeMin: new Date(Date.now() - 6 * 3600000).toISOString(), timeMax: new Date(Date.now() + days * 86400000).toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '100', timeZone: tz });
  const data = await googleGet<{ items?: GEvent[] }>(token, `https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`);
  const events = (data.items ?? []).filter((e) => e.start.dateTime && e.end.dateTime).map((e) => {
    const s = localParts(e.start.dateTime!, tz);
    const dur = Math.max(5, Math.round((Date.parse(e.end.dateTime!) - Date.parse(e.start.dateTime!)) / 60000));
    return { id: `gcal-${e.id}`, title: e.summary || 'Busy', date: s.date, start: s.time, dur: Math.min(dur, 24 * 60), location: e.location ?? null };
  });
  return json({ events });
});
