import { STAFF_ROLES } from '@ugent/core';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { body, handle, HttpError, json } from '@/lib/http';
import { audit, issueAccessKey, needReason, requireStaff } from '@/lib/staff';

const Act = z.discriminatedUnion('action', [
  z.object({ action: z.literal('issue_key'), expiresInDays: z.number().int().min(1).max(365).default(90), reason: z.string().max(500) }),
  z.object({ action: z.literal('revoke_key'), keyId: z.string().max(60), reason: z.string().max(500) }),
  z.object({ action: z.literal('set_roles'), roles: z.array(z.enum(STAFF_ROLES)).min(1).max(8), reason: z.string().max(500) }),
  z.object({ action: z.literal('disable'), reason: z.string().max(500) }),
  z.object({ action: z.literal('enable'), reason: z.string().max(500) }),
]);

/** Issue or revoke access keys, change roles, disable or re-enable a staff member. Super Admin only. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireStaff(req, 'staff.manage');
  const input = await body(req, Act);
  const reason = needReason(input.reason);
  const { id } = await ctx.params;
  const [target] = await db.select().from(schema.staffUsers).where(eq(schema.staffUsers.id, id)).limit(1);
  if (!target) throw new HttpError(404, 'No such staff member.', 'not_found');
  const supers = async () => (await db.select({ id: schema.staffRoles.staffId }).from(schema.staffRoles).innerJoin(schema.staffUsers, eq(schema.staffUsers.id, schema.staffRoles.staffId))
    .where(and(eq(schema.staffRoles.role, 'super'), isNull(schema.staffUsers.disabledAt)))).map((r) => r.id);

  let accessKey: string | undefined;
  let message = '';
  await db.transaction(async (tx) => {
    if (input.action === 'issue_key') {
      const k = await issueAccessKey(id, actor.id, 'Issued in console', input.expiresInDays, tx as unknown as typeof db);
      accessKey = k.key; message = 'New key issued. Copy it now: it will not be shown again.';
      await audit(tx, actor, { action: 'staff.issue_key', targetType: 'staff', targetId: id, reason, after: { keyPrefix: k.prefix } });
    } else if (input.action === 'revoke_key') {
      const res = await tx.update(schema.staffAccessKeys).set({ revokedAt: new Date() })
        .where(and(eq(schema.staffAccessKeys.id, input.keyId), eq(schema.staffAccessKeys.staffId, id), isNull(schema.staffAccessKeys.revokedAt))).returning({ prefix: schema.staffAccessKeys.prefix });
      if (!res.length) throw new HttpError(404, 'That key is not active.', 'not_found');
      message = 'Key revoked. Anyone signed in with it is signed out on their next click.';
      await audit(tx, actor, { action: 'staff.revoke_key', targetType: 'staff', targetId: id, reason, after: { keyPrefix: res[0].prefix } });
    } else if (input.action === 'set_roles') {
      const before = (await tx.select().from(schema.staffRoles).where(eq(schema.staffRoles.staffId, id))).map((r) => r.role);
      if (before.includes('super') && !input.roles.includes('super') && (await supers()).length <= 1) throw new HttpError(409, 'Ugent needs at least one Super Admin. Make someone else a Super Admin first.', 'last_super');
      await tx.delete(schema.staffRoles).where(eq(schema.staffRoles.staffId, id));
      await tx.insert(schema.staffRoles).values([...new Set(input.roles)].map((role) => ({ staffId: id, role, grantedBy: actor.id })));
      message = 'Roles updated.';
      await audit(tx, actor, { action: 'staff.set_roles', targetType: 'staff', targetId: id, reason, before: { roles: before }, after: { roles: input.roles } });
    } else if (input.action === 'disable') {
      if (id === actor.id) throw new HttpError(400, 'You can\'t disable your own account.', 'invalid');
      const s = await supers();
      if (s.includes(id) && s.length <= 1) throw new HttpError(409, 'Ugent needs at least one Super Admin.', 'last_super');
      await tx.update(schema.staffUsers).set({ disabledAt: new Date() }).where(eq(schema.staffUsers.id, id));
      await tx.update(schema.staffSessions).set({ revokedAt: new Date() }).where(and(eq(schema.staffSessions.staffId, id), isNull(schema.staffSessions.revokedAt)));
      message = 'Staff member disabled and signed out.';
      await audit(tx, actor, { action: 'staff.disable', targetType: 'staff', targetId: id, reason });
    } else {
      await tx.update(schema.staffUsers).set({ disabledAt: null }).where(eq(schema.staffUsers.id, id));
      message = 'Staff member re-enabled. They need an active key to sign in.';
      await audit(tx, actor, { action: 'staff.enable', targetType: 'staff', targetId: id, reason });
    }
  });
  return json({ ok: true, message, ...(accessKey ? { accessKey } : {}) });
});
