import { PERMISSIONS, staffCan } from '@ugent/core';
import { handle, json } from '@/lib/http';
import { requireStaff } from '@/lib/staff';

/** Who is signed in and what they may do (the console uses this to show only the right screens). */
export const GET = handle(async (req: Request) => {
  const s = await requireStaff(req, null);
  return json({ staff: { id: s.id, name: s.name, roles: s.roles }, permissions: PERMISSIONS.filter((p) => staffCan(s.roles, p)) });
});
