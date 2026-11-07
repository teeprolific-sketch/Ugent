import { eq } from 'drizzle-orm';
import type { TeamInfo } from '@ugent/core';
import type { User } from './auth';
import { db, schema } from './db';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Leave the team. When the owner leaves, the team is closed and shared items become private. */
export async function leaveTeam(tx: Tx, user: User) {
  if (!user.teamId) return;
  const [team] = await tx.select().from(schema.teams).where(eq(schema.teams.id, user.teamId)).limit(1);
  if (team && team.ownerId === user.id) {
    await tx.update(schema.users).set({ teamId: null, teamRole: null }).where(eq(schema.users.teamId, team.id));
    await tx.update(schema.tasks).set({ teamId: null }).where(eq(schema.tasks.teamId, team.id));
    await tx.update(schema.events).set({ teamId: null }).where(eq(schema.events.teamId, team.id));
    await tx.delete(schema.teams).where(eq(schema.teams.id, team.id));
  } else {
    await tx.update(schema.users).set({ teamId: null, teamRole: null }).where(eq(schema.users.id, user.id));
  }
}

export async function teamInfo(teamId: string): Promise<TeamInfo | null> {
  const [team] = await db.select().from(schema.teams).where(eq(schema.teams.id, teamId)).limit(1);
  if (!team) return null;
  const members = await db.select({ id: schema.users.id, name: schema.users.name, role: schema.users.teamRole })
    .from(schema.users).where(eq(schema.users.teamId, teamId));
  return {
    id: team.id, name: team.name, code: team.code,
    members: members.map((m) => ({ id: m.id, name: m.name || 'Unnamed', role: m.role === 'admin' ? 'admin' : 'member' })),
  };
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I
export const inviteCode = () => Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
