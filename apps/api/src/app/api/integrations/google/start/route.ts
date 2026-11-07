import { z } from 'zod';
import { requireUser, signState } from '@/lib/auth';
import { authUrl, googleConfigured, isGoogleProvider } from '@/lib/google';
import { body, handle, HttpError, json } from '@/lib/http';

/** Returns the Google sign-in URL for the app to open in a browser sheet. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const { provider } = await body(req, z.object({ provider: z.string() }));
  if (!isGoogleProvider(provider)) throw new HttpError(400, 'Unknown Google service.', 'invalid');
  if (!googleConfigured()) throw new HttpError(503, 'Google sign-in is not set up on this server yet.', 'not_configured');
  return json({ url: authUrl(provider, await signState(user.id, provider)) });
});
