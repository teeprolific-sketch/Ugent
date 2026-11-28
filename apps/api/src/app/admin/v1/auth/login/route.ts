import { z } from 'zod';
import { body, handle, json } from '@/lib/http';
import { signIn } from '@/lib/staff';

/** Sign in with a personal access key. Returns a staff session token (12 hours, ends after 30 minutes idle). */
export const POST = handle(async (req: Request) => {
  const { accessKey } = await body(req, z.object({ accessKey: z.string().min(10).max(100) }));
  return json(await signIn(accessKey, req));
});
