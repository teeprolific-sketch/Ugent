import { requireUser } from '@/lib/auth';
import { handle, json } from '@/lib/http';
import { exportUserData } from '@/lib/userdata';

/** The user's own data export (Nigeria Data Protection Act: right of access). */
export const GET = handle(async (req: Request) => json(await exportUserData(await requireUser(req))));
