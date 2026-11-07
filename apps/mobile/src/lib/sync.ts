/* Keeps the phone and the server in step. Safe to call often; it does nothing when offline. */
import NetInfo from '@react-native-community/netinfo';
import type { SyncResponse } from '@ugent/core';
import { useApp } from '@/store';
import { apiConfigured, ensureSession, request } from './api';

let running: Promise<void> | null = null;

export function syncNow(): Promise<void> {
  if (!apiConfigured()) return Promise.resolve();
  if (!running) running = doSync().finally(() => { running = null; });
  return running;
}

async function doSync() {
  const net = await NetInfo.fetch();
  if (net.isConnected === false) return;
  const s = useApp.getState();
  if (!s.onboarded) return;
  try {
    const me = await ensureSession(s.profile);
    if (me) useApp.getState().setMe(me);
    const pushedAt = Date.now();
    const state = useApp.getState();
    // Sample items stay on the phone; they are only there to show how Ugent works.
    const tasks = state.tasks.filter((t) => state.sync.dirtyTasks.includes(t.id) && !t.sample);
    const events = state.events.filter((e) => state.sync.dirtyEvents.includes(e.id) && !e.sample);
    const res = await request<SyncResponse>('POST', '/api/sync', { since: state.sync.cursor, tasks, events, profile: state.profile });
    useApp.getState().mergeFromServer(res.tasks, res.events, res.cursor, pushedAt);
    useApp.getState().setMe(res.me);
  } catch {
    // Offline or server unavailable: changes stay queued and go out on the next sync.
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
/** Sync a few seconds after the last change, so bursts of edits go out together. */
export function syncSoon(delay = 3000) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { void syncNow(); }, delay);
}
