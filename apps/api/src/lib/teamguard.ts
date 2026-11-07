import type { User } from './auth';
import { HttpError } from './http';

export function requireTeam(user: User): string {
  if (!user.teamId) throw new HttpError(409, 'You are not in a team.', 'not_in_team');
  return user.teamId;
}
export function requireAdmin(user: User): string {
  const id = requireTeam(user);
  if (user.teamRole !== 'admin') throw new HttpError(403, 'Only a team admin can do this.', 'forbidden');
  return id;
}
