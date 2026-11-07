/* Travel times for plans with a place. Live traffic from the Ugent API when it is set up,
 * otherwise the travel buffer the user chose (Lagos traffic is rarely under 45 minutes). */
import { toMin } from '@ugent/core';
import { Platform } from 'react-native';
import type { PlanEvent } from '@ugent/core';
import { useApp } from '@/store';
import { apiConfigured, request } from './api';

export async function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  if (Platform.OS === 'web' || !useApp.getState().connections.googleMaps?.on) return null;
  try {
    const L = await import('expo-location');
    const p = (await L.getLastKnownPositionAsync()) ?? (await L.getCurrentPositionAsync({ accuracy: L.Accuracy.Balanced }));
    return p ? { lat: p.coords.latitude, lng: p.coords.longitude } : null;
  } catch { return null; }
}

/** Minutes to get to `destination`, and whether that is live traffic or the user's buffer. */
export async function travelMinutes(destination: string): Promise<{ minutes: number; live: boolean }> {
  const s = useApp.getState();
  const fallback = { minutes: s.settings.travelBuffer, live: false };
  if (!apiConfigured() || !s.cloud.find((c) => c.provider === 'googleMaps')?.available) return fallback;
  const origin = (await currentPosition()) ?? (s.places.home || null);
  if (!origin) return fallback;
  try {
    const r = await request<{ minutes: number }>('POST', '/api/maps/eta', { origin, destination }, 12000);
    return { minutes: r.minutes, live: true };
  } catch { return fallback; }
}

/** "Leave by" time for an event, as minutes after midnight. */
export const leaveBy = (e: PlanEvent, minutes: number) => toMin(e.start) - minutes - 10;
