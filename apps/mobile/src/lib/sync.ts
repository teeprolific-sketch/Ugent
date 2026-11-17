/* Keeps the phone and the server in step. Safe to call often; it does nothing when offline.
 * Built for weak, costly connections: only changes go up (the profile only when it changed), changes come
 * down in pages so a slow first sync can't time out, and a failed sync retries on its own with growing gaps. */
import NetInfo from '@react-native-community/netinfo';
import type { SyncResponse } from '@ugent/core';
import { useApp } from '@/store';
import { apiConfigured, ensureSession, request } from './api';
import { saveData } from './data';

const PAGE = { normal: 1000, saving: 150 };
const MAX_PAGES = 20;
const RETRY_SECONDS = [10, 30, 120, 300, 900];

let running: Promise<boolean> | null = null;
let failures = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

/** Sync now. Resolves true when everything went through. */
export function syncNow(): Promise<boolean> {
  if (!apiConfigured()) return Promise.resolve(true);
  if (!running) running = doSync().finally(() => { running = null; });
  return running;
}

async function doSync(): Promise<boolean> {
  const net = await NetInfo.fetch().catch(() => null);
  if (net?.isConnected === false) return false;
  if (!useApp.getState().onboarded) return true;
  try {
    const me = await ensureSession(useApp.getState().profile);
    if (me) useApp.getState().setMe(me);
    for (let page = 0; page < MAX_PAGES; page++) {
      const pushedAt = Date.now();
      const state = useApp.getState();
      // Every page carries whatever is still waiting (usually nothing after the first). Sample items stay on the phone.
      const tasks = state.tasks.filter((t) => state.sync.dirtyTasks.includes(t.id) && !t.sample);
      const events = state.events.filter((e) => state.sync.dirtyEvents.includes(e.id) && !e.sample);
      const sentProfile = state.profile;
      const sendProfile = state.sync.profileDirty;
      const res = await request<SyncResponse>('POST', '/api/sync', {
        since: state.sync.cursor, tasks, events, limit: saveData() ? PAGE.saving : PAGE.normal,
        ...(sendProfile ? { profile: sentProfile } : {}),
      }, saveData() ? 30000 : 20000);
      useApp.getState().mergeFromServer(res.tasks, res.events, res.cursor, pushedAt);
      useApp.getState().setMe(res.me);
      // Edited again while this was in flight? Then it stays marked for the next sync.
      if (sendProfile && useApp.getState().profile === sentProfile) useApp.setState((s) => ({ sync: { ...s.sync, profileDirty: false } }));
      if (!res.more) break;
    }
    failures = 0;
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    return true;
  } catch {
    // Weak signal or server unavailable: changes stay queued on the phone. Try again on our own, waiting longer
    // each time, and straight away when the connection comes back (see the root layout).
    const wait = RETRY_SECONDS[Math.min(failures, RETRY_SECONDS.length - 1)];
    failures++;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => { retryTimer = null; void syncNow(); }, wait * 1000);
    return false;
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
/** Sync shortly after the last change, so bursts of edits go out together (longer while saving data). */
export function syncSoon(delay?: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { void syncNow(); }, delay ?? (saveData() ? 20000 : 3000));
}

/** Changes still waiting to reach the server. */
export const pendingChanges = () => {
  const s = useApp.getState().sync;
  return s.dirtyTasks.length + s.dirtyEvents.length + (s.profileDirty ? 1 : 0);
};
