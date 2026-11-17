/* Talks to the Ugent API (apps/api). With no EXPO_PUBLIC_API_URL the app runs fully offline. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthResponse, Me } from '@ugent/core';
import { uid } from '@ugent/core';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { useApp } from '@/store';
import { reportTiming } from './data';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
export const apiConfigured = () => !!API_URL;

// Secure storage on phones; AsyncStorage on web, where SecureStore is unavailable.
const secure = {
  get: (k: string) => (Platform.OS === 'web' ? AsyncStorage.getItem(k) : SecureStore.getItemAsync(k)),
  set: (k: string, v: string) => (Platform.OS === 'web' ? AsyncStorage.setItem(k, v) : SecureStore.setItemAsync(k, v)),
  del: (k: string) => (Platform.OS === 'web' ? AsyncStorage.removeItem(k) : SecureStore.deleteItemAsync(k)),
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public code: string) { super(message); }
}

let token: string | null = null;

async function deviceId(): Promise<string> {
  let id = await secure.get('ugent.device');
  if (!id) { id = `${uid()}${uid()}${uid()}`; await secure.set('ugent.device', id); }
  return id;
}

// Roughly what HTTP headers cost per call, so the data counter is honest about small requests.
const HEADER_BYTES = 450;
let lastProfile: { name: string; lang: Me['lang'] } | null = null;

export async function request<T>(method: string, path: string, body?: unknown, timeoutMs = 20000, retried = false): Promise<T> {
  if (!API_URL) throw new ApiError(0, 'Ugent is running offline.', 'offline');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const payload = body === undefined ? undefined : JSON.stringify(body);
  let res: Response;
  let text = '';
  const started = Date.now();
  try {
    res = await fetch(API_URL + path, {
      method,
      // Responses come back gzip-compressed; the phone's network stack asks for that and unpacks it.
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: payload,
      signal: ctrl.signal,
    });
    text = await res.text();
    // Only sync is timed: it's a quick database call, while chat and maps wait on other services.
    if (path === '/api/sync') reportTiming(Date.now() - started, text.length);
  } catch {
    throw new ApiError(0, 'No connection. Ugent will keep working offline.', 'network');
  } finally {
    clearTimeout(timer);
    countData(HEADER_BYTES + (payload?.length ?? 0) + text.length);
  }
  // The saved sign-in stopped working (for example, the server was reset): sign in again once and retry.
  if (res.status === 401 && token && !retried && lastProfile && path !== '/api/auth/device') {
    token = null;
    await secure.del('ugent.token');
    await ensureSession(lastProfile);
    return request<T>(method, path, body, timeoutMs, true);
  }
  let data: { message?: string; error?: string } | null = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) throw new ApiError(res.status, data?.message ?? 'Something went wrong.', data?.error ?? 'error');
  return data as T;
}

/** Bytes are counted as sent and received (compressed bodies are counted uncompressed, so this overestimates). */
function countData(bytes: number) {
  try { useApp.getState().addDataUsage(bytes); } catch { /* the counter is only informational */ }
}

/**
 * Signs this install in (creating an account on first run). With a saved sign-in it makes no network call:
 * the next request proves it, and is retried after signing in again if the server has forgotten it.
 * Returns the account only when it had to sign in; null otherwise or when offline.
 */
let signingIn: Promise<Me | null> | null = null;
export function ensureSession(profile: { name: string; lang: Me['lang'] }): Promise<Me | null> {
  if (!API_URL) return Promise.resolve(null);
  lastProfile = { name: profile.name, lang: profile.lang };
  // Sync, chat and connected apps often start together on app open: they share one sign-in.
  if (!signingIn) signingIn = signIn(lastProfile).finally(() => { signingIn = null; });
  return signingIn;
}

async function signIn(profile: { name: string; lang: Me['lang'] }): Promise<Me | null> {
  token = token ?? (await secure.get('ugent.token'));
  if (token) return null;
  const res = await request<AuthResponse>('POST', '/api/auth/device', {
    deviceId: await deviceId(), platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web', name: profile.name, lang: profile.lang,
  });
  token = res.token;
  await secure.set('ugent.token', token);
  return res.me;
}

export const hasSession = () => !!token;

/** Forget this install's account on the phone (after deleting it on the server). */
export async function forgetSession() {
  token = null;
  await secure.del('ugent.token');
  await secure.del('ugent.device');
}

/** Tell the server about focus mode (for WhatsApp Business auto-replies). Best effort. */
export async function reportFocus(until: number | null) {
  if (!API_URL || !token) return;
  try { await request('POST', '/api/focus', { until }, 8000); } catch { /* offline: auto-replies stay off */ }
}
