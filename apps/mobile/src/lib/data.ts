/* Data saving. Ugent works fully offline on every plan, free included; this decides when it should also hold
 * back on data while online: when the person turns on Low data mode, or (if they allow it) on a slow
 * connection: 2G or 3G, or measured as slow. Everything that uses the network checks `saveData()` first. */
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { useApp } from '@/store';

export type Connection = { online: boolean; slow: boolean; label: string };
let lastType: string | null = null;

let current: Connection = { online: true, slow: false, label: 'unknown' };
const listeners = new Set<(c: Connection) => void>();

// Measured speed. Android 11+ hides 2G/3G from apps without the "phone calls" permission, which Ugent doesn't
// ask for, so it also times its own sync requests: a typical round trip above 2.5 seconds counts as slow.
let rtt: number | null = null;
let samples = 0;
let generationSlow = false;
const measuredSlow = () => samples >= 2 && rtt !== null && rtt > 2500;

/** Called by the API client after each sync request. */
export function reportTiming(ms: number, bytes: number) {
  if (bytes > 20000) return; // big downloads measure bandwidth, not responsiveness
  rtt = rtt === null ? ms : rtt * 0.7 + ms * 0.3;
  samples++;
  const slow = generationSlow || measuredSlow();
  if (slow !== current.slow) { current = { ...current, slow }; listeners.forEach((l) => l(current)); }
}

function read(s: NetInfoState): Connection {
  const gen = s.type === 'cellular' ? s.details?.cellularGeneration ?? null : null;
  // A different network starts a fresh measurement.
  if (s.type !== lastType) { rtt = null; samples = 0; lastType = s.type; }
  generationSlow = gen === '2g' || gen === '3g';
  const slow = generationSlow || measuredSlow();
  const label = s.type === 'cellular' ? (gen ? `mobile data (${gen.toUpperCase()})` : 'mobile data') : s.type === 'wifi' ? 'Wi-Fi' : s.type;
  return { online: s.isConnected !== false, slow, label };
}

let started = false;
/** Start watching the connection. Safe to call more than once. */
export function watchConnection() {
  if (started) return;
  started = true;
  NetInfo.addEventListener((s) => { current = read(s); listeners.forEach((l) => l(current)); });
  void NetInfo.fetch().then((s) => { current = read(s); listeners.forEach((l) => l(current)); }).catch(() => {});
}

export const connection = () => current;

/** Why Ugent is saving data right now, or null when it isn't. */
export function dataSaverReason(): 'manual' | 'slow' | null {
  const s = useApp.getState().settings;
  if (s.lowData) return 'manual';
  if (s.autoLowData && current.slow) return 'slow';
  return null;
}

export const saveData = () => dataSaverReason() !== null;

/** Live connection info and the data-saver state, for screens. */
export function useDataSaver() {
  const [conn, setConn] = useState(current);
  const lowData = useApp((s) => s.settings.lowData);
  const auto = useApp((s) => s.settings.autoLowData);
  useEffect(() => { watchConnection(); listeners.add(setConn); setConn(current); return () => { listeners.delete(setConn); }; }, []);
  const reason: 'manual' | 'slow' | null = lowData ? 'manual' : auto && conn.slow ? 'slow' : null;
  return { ...conn, saving: reason !== null, reason };
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
