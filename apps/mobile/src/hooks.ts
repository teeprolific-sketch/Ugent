import NetInfo from '@react-native-community/netinfo';
import type { Lang } from '@ugent/core';
import { t as translate } from '@ugent/core';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useApp } from '@/store';

/** Current time, refreshed every 30 seconds so "Next up" and the "Now" line stay true. */
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), intervalMs); return () => clearInterval(id); }, [intervalMs]);
  return now;
}

export function useLang(): Lang { return useApp((s) => s.profile.lang); }

/** Translator bound to the user's language. */
export function useT() {
  const lang = useLang();
  return (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
}

export function useOnline() {
  const [online, setOnline] = useState(() => (Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.onLine !== false : true));
  useEffect(() => {
    const off = NetInfo.addEventListener((s) => setOnline(s.isConnected !== false));
    if (Platform.OS !== 'web' || typeof window === 'undefined') return off;
    // On Chrome, NetInfo only watches navigator.connection, which misses plain online/offline switches.
    const sync = () => setOnline(navigator.onLine !== false);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => { off(); window.removeEventListener('online', sync); window.removeEventListener('offline', sync); };
  }, []);
  return online;
}
