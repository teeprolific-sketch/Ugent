import type { z } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = 'error') { super(message); }
}

export const json = (data: unknown, status = 200, headers?: HeadersInit) => Response.json(data, { status, headers });

/** Parse and validate a JSON body; throws a 400 with a readable message on bad input. */
export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try { raw = await req.json(); } catch { throw new HttpError(400, 'Send a JSON body.', 'bad_json'); }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new HttpError(400, `${first.path.join('.') || 'body'}: ${first.message}`, 'invalid');
  }
  return parsed.data;
}

/** Wraps a handler so thrown HttpErrors become JSON responses and anything else is a logged 500. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, message: e.message }, e.status);
      console.error(e);
      return json({ error: 'server_error', message: 'Something went wrong on our side. Try again.' }, 500);
    }
  };
}
