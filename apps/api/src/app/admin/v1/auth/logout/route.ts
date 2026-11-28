import { handle, json } from '@/lib/http';
import { requireStaff, signOut } from '@/lib/staff';

export const POST = handle(async (req: Request) => { await signOut(await requireStaff(req, null)); return json({ signedOut: true }); });
