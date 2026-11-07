import { fmtDate, minOfDay, toMin } from '@ugent/core';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLang, useNow } from '@/hooks';
import { fmtTime } from '@/lib/format';
import { memberColor, memberName, refreshTeam } from '@/lib/team';
import { liveEvents, liveTasks, useApp } from '@/store';
import { useColors } from '@/theme';
import { Avatar, EmptyState, PlanBadge } from './kit';
import { Button, ButtonRow, Card, List, Row, Section, T } from './ui';

const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

/** Team workspace home: shared updates and the team's day, kept simple. */
export function TeamHome() {
  const c = useColors();
  const lang = useLang();
  const now = useNow();
  const state = useApp();
  const { team, teamFeed, teamStats, me } = state;
  const [loading, setLoading] = useState(!team);
  useEffect(() => { refreshTeam().finally(() => setLoading(false)); }, []);

  if (!team) {
    return loading ? <T muted>Loading your team…</T> : (
      <EmptyState icon="users" title="No team yet" body="Create a team to share a calendar and tasks, or join one with an invite code."
        action={{ label: 'Set up a team', onPress: () => router.push('/team-admin') }} />
    );
  }
  const d0 = fmtDate(now);
  const shared = liveEvents(state).filter((e) => e.teamId === team.id && e.date === d0).sort((a, b) => a.start.localeCompare(b.start));
  const upcoming = shared.filter((e) => toMin(e.start) + e.dur > minOfDay(now));
  const tasks = liveTasks(state).filter((t) => t.teamId === team.id && !t.done);
  const mine = tasks.filter((t) => t.assigneeId === me?.id).length;
  const f = fmtTime(lang);
  const stat = (n: number | string, l: string) => (
    <View style={{ flex: 1, backgroundColor: c.bg, borderRadius: 12, padding: 12, gap: 2 }}>
      <T v="title" style={{ fontSize: 24 }}>{String(n)}</T>
      <T v="small" muted>{l}</T>
    </View>
  );

  return (
    <View style={{ gap: 24 }}>
      <Card tint>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T v="h2">{team.name}</T>
          <PlanBadge plan="team" />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {stat(upcoming.length, 'Shared plans left today')}
          {stat(tasks.length, 'Open team tasks')}
          {stat(mine, 'Assigned to you')}
        </View>
        {teamStats && teamStats.totals.unassigned > 0 && <T v="small">{teamStats.totals.unassigned} team task{teamStats.totals.unassigned > 1 ? 's have' : ' has'} no one assigned yet.</T>}
      </Card>

      <Section title="Team schedule today" action={{ label: 'Team calendar', onPress: () => router.navigate('/schedule') }}>
        {shared.length ? (
          <List>
            {shared.slice(0, 5).map((e) => (
              <View key={e.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12 }}>
                <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: memberColor(e.ownerId, team) }} />
                <T v="small" muted style={{ width: 70 }}>{f(e.start)}</T>
                <View style={{ flex: 1 }}><T v="strong">{e.title}</T><T v="small" muted>{memberName(e.ownerId, team, me?.id)}</T></View>
              </View>
            ))}
          </List>
        ) : <T muted>No shared plans today.</T>}
      </Section>

      <Section title="Shared updates">
        {teamFeed.length ? (
          <List>
            {teamFeed.slice(0, 6).map((i) => (
              <View key={`${i.kind}-${i.id}-${i.at}`} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12 }}>
                <Avatar name={i.by} size={32} color={memberColor(team.members.find((m) => m.name === i.by)?.id, team)} />
                <View style={{ flex: 1 }}>
                  <T v="small"><T v="small" style={{ fontWeight: '600' }}>{i.by}</T> {i.what} {i.kind === 'task' ? 'task' : 'plan'} "{i.title}"</T>
                  <T v="small" muted>{ago(i.at)}</T>
                </View>
              </View>
            ))}
          </List>
        ) : <T muted>Changes to shared plans and tasks will show here.</T>}
      </Section>

      <ButtonRow>
        <Button label="Team tasks" icon="tasks" style={{ flexGrow: 1, flexBasis: 140 }} onPress={() => router.navigate('/tasks')} />
        <Button label="Dashboard" icon="chart" kind="ghost" style={{ flexGrow: 1, flexBasis: 140 }} onPress={() => router.push('/team')} />
      </ButtonRow>
      {me?.teamRole === 'admin' && <Row icon="users" title="Manage members" sub="Invite, roles and removal" chevron onPress={() => router.push('/team-admin')} />}
    </View>
  );
}
