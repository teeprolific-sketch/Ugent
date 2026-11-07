/* Team workspace data: members, shared updates and team analytics. Cached on the phone for offline use. */
import type { TeamFeedItem, TeamInfo, TeamMemberStats } from '@ugent/core';
import { useApp } from '@/store';
import { apiConfigured, ensureSession, request } from './api';
import { syncNow } from './sync';

export async function refreshTeam(): Promise<TeamInfo | null> {
  if (!apiConfigured()) return useApp.getState().team;
  try {
    await ensureSession(useApp.getState().profile);
    // Push local team changes first, so the numbers include what this person just did.
    await syncNow();
    const { team } = await request<{ team: TeamInfo | null }>('GET', '/api/team');
    useApp.getState().setTeam(team);
    if (team) {
      const [feed, stats] = await Promise.all([
        request<{ items: TeamFeedItem[] }>('GET', '/api/team/feed'),
        request<{ members: TeamMemberStats[]; totals: { doneThisWeek: number; open: number; unassigned: number } }>('GET', '/api/team/stats'),
      ]);
      useApp.getState().setTeamData({ teamFeed: feed.items, teamStats: stats });
    }
    return team;
  } catch {
    return useApp.getState().team;
  }
}

const COLORS = ['#0EA5E9', '#0B3D91', '#15803D', '#B45309', '#7C3AED', '#BE185D', '#0F766E', '#9A3412'];
/** A stable colour per member, used on the shared calendar and board. */
export function memberColor(id: string | null | undefined, team: TeamInfo | null): string {
  const i = team?.members.findIndex((m) => m.id === id) ?? -1;
  return i >= 0 ? COLORS[i % COLORS.length] : '#5A6B85';
}
export const memberName = (id: string | null | undefined, team: TeamInfo | null, meId?: string) =>
  !id ? 'Unassigned' : id === meId ? 'You' : team?.members.find((m) => m.id === id)?.name ?? 'Someone';
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || 'U';
