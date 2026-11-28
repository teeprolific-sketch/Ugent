import { STAFF_ROLES, uid } from '@ugent/core';
import { desc } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { body, handle, json } from '@/lib/http';
import { audit, issueAccessKey, needReason, requireStaff } from '@/lib/staff';

/** Staff, their roles and their access keys (never the keys themselves: only the first characters). */
export const GET = handle(async (req: Request) => {
  await requireStaff(req, 'staff.manage');
  const [staff, roles, keys] = await Promise.all([
    db.select().from(schema.staffUsers).orderBy(desc(schema.staffUsers.createdAt)),
    db.select().from(schema.staffRoles),
    db.select().from(schema.staffAccessKeys).orderBy(desc(schema.staffAccessKeys.createdAt)),
  ]);
  return json({ staff: staff.map((s) => ({
    ...s,
    roles: roles.filter((r) => r.staffId === s.id).map((r) => r.role),
    keys: keys.filter((k) => k.staffId === s.id).map(({ keyHash: _hash, ...k }) => ({ ...k, hint: `ugk_${k.prefix}_…` })),
  })) });
});

/** Add a staff member with a role. Their personal access key is returned once, here, and never again. */
export const POST = handle(async (req: Request) => {
  const actor = await requireStaff(req, 'staff.manage');
  const input = await body(req, z.object({ name: z.string().min(2).max(80), email: z.string().email().max(120).optional(), role: z.enum(STAFF_ROLES), expiresInDays: z.number().int().min(1).max(365).default(90), reason: z.string().max(500) }));
  const reason = needReason(input.reason);
  const id = 'st_' + uid();
  const result = await db.transaction(async (tx) => {
    await tx.insert(schema.staffUsers).values({ id, name: input.name.trim(), email: input.email ?? null, createdBy: actor.id });
    await tx.insert(schema.staffRoles).values({ staffId: id, role: input.role, grantedBy: actor.id });
    const key = await issueAccessKey(id, actor.id, 'First key', input.expiresInDays, tx as unknown as typeof db);
    await audit(tx, actor, { action: 'staff.create', targetType: 'staff', targetId: id, reason, after: { name: input.name, role: input.role, keyPrefix: key.prefix } });
    return key;
  });
  return json({ ok: true, id, accessKey: result.key, message: 'Staff member added. Copy the access key now and give it to them privately: it will not be shown again.' }, 201);
});
