/* Creates a staff member and prints their personal access key once. The only way to create the first Super Admin.
 *   npm run admin:create-staff -w @ugent/api -- --name "Ope" --role super
 * Needs DATABASE_URL. Later staff can be added from the console by a Super Admin. */
import { STAFF_ROLES, type StaffRole, uid } from '@ugent/core';
import { db, schema } from '../src/lib/db';
import { issueAccessKey } from '../src/lib/staff';

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const name = arg('name') ?? '';
const role = (arg('role') ?? 'super') as StaffRole;
if (!name || !STAFF_ROLES.includes(role)) {
  console.error(`Usage: --name "Full name" --role ${STAFF_ROLES.join('|')}`);
  process.exit(1);
}
async function main() {
const id = 'st_' + uid();
await db.insert(schema.staffUsers).values({ id, name, createdBy: 'bootstrap' });
await db.insert(schema.staffRoles).values({ staffId: id, role, grantedBy: 'bootstrap' });
const { key } = await issueAccessKey(id, 'bootstrap', 'Created from the command line', 90);
await db.insert(schema.auditLog).values({ id: 'au_' + uid(), staffId: 'bootstrap', role: 'system', action: 'staff.create', targetType: 'staff', targetId: id, reason: 'Created from the command line', after: { name, role } });
console.log(`\n${name} (${role}) can now sign in to the Ugent admin console with this access key.`);
console.log('It is shown only once. Give it to them privately.\n');
console.log(`  ${key}\n`);
process.exit(0);
}
main().catch((e) => { console.error('Could not create the staff member:', e instanceof Error ? e.message : e); process.exit(1); });
