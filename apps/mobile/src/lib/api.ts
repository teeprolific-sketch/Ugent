/* Talks to the Ugent API (apps/api). With no EXPO_PUBLIC_API_URL the app runs fully offline. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthResponse, Me } from '@ugent/core';
import { uid } from '@ugent/core';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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

export async function request<T>(method: string, path: string, body?: unknown, timeoutMs = 20000): Promise<T> {
  if (!API_URL) throw new ApiError(0, 'Ugent is running offline.', 'offline');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError(0, 'No connection. Ugent will keep working offline.', 'network');
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.message ?? 'Something went wrong.', data?.error ?? 'error');
  return data as T;
}

/** Signs this install in (creating an account on first run). Returns null when offline. */
export async function ensureSession(profile: { name: string; lang: Me['lang'] }): Promise<Me | null> {
  if (!API_URL) return null;
  token = token ?? (await secure.get('ugent.token'));
  if (token) {
    try {
      return (await request<{ me: Me }>('GET', '/api/me')).me;
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e;
      token = null;
    }
  }
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
