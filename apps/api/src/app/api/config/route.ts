import { requireUser } from '@/lib/auth';
import { handle, json } from '@/lib/http';
import { policyFor } from '@/lib/policy';

/** What this user's app is allowed to do right now: switched-off actions and integrations, trust level, status. */
export const GET = handle(async (req: Request) => json({ policy: await policyFor(await requireUser(req)) }));
