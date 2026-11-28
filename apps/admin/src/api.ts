/* How the console talks to the admin API. The real console uses HTTP; the demo uses an in-browser
 * pretend server (demo.ts) that answers the same paths with the same rules. */

export class ApiError extends Error {
  constructor(public status: number, message: string, public code: string) { super(message); }
}

export interface Transport {
  request<T>(method: 'GET' | 'POST', path: string, body?: unknown, token?: string | null): Promise<T>;
}

export function httpTransport(baseUrl: string): Transport {
  const base = baseUrl.replace(/\/$/, '');
  return {
    async request<T>(method: 'GET' | 'POST', path: string, body?: unknown, token?: string | null): Promise<T> {
      let res: Response;
      try {
        res = await fetch(base + path, {
          method,
          headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch {
        throw new ApiError(0, 'Can\'t reach the admin API. Check your connection or VPN.', 'network');
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(res.status, data?.message ?? 'Something went wrong.', data?.error ?? 'error');
      return data as T;
    },
  };
}

/** The signed-in session, kept only for this browser tab. */
export class Session {
  token: string | null = null;
  constructor(private t: Transport) {
    try { this.token = sessionStorage.getItem('ugent-admin-token'); } catch { /* storage blocked */ }
  }
  set(token: string | null) {
    this.token = token;
    try { token ? sessionStorage.setItem('ugent-admin-token', token) : sessionStorage.removeItem('ugent-admin-token'); } catch { /* storage blocked */ }
  }
  get<T>(path: string) { return this.t.request<T>('GET', path, undefined, this.token); }
  post<T>(path: string, body: unknown) { return this.t.request<T>('POST', path, body, this.token); }
}
