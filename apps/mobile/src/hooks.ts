import NetInfo from '@react-native-community/netinfo';
import type { Lang } from '@ugent/core';
import { t as translate } from '@ugent/core';
import { useEffect, useState } from 'react';
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
  const [online, setOnline] = useState(true);
  useEffect(() => NetInfo.addEventListener((s) => setOnline(s.isConnected !== false)), []);
  return online;
}
