import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, EmptyState, PlanBadge } from '@/components/kit';
import { Card, Header, LinkButton, Section, T } from '@/components/ui';
import { memberColor, refreshTeam } from '@/lib/team';
import { useApp } from '@/store';
import { radius, space, useColors } from '@/theme';

/** Team dashboard (Team plan): progress per person and the team's week at a glance. */
export default function TeamDashboard() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { team, teamStats, me } = useApp();
  const [loading, setLoading] = useState(false);
  const load = async () => { setLoading(true); await refreshTeam(); setLoading(false); };
  useEffect(() => { void load(); }, []);
  const max = Math.max(1, ...(teamStats?.members.map((m) => m.doneThisWeek) ?? [1]));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: space, paddingBottom: 32, gap: 24 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
      <Header back title="Team dashboard" sub={team?.name} right={team ? <PlanBadge plan="team" /> : undefined} />
      {!team ? (
        <EmptyState icon="users" title="No team yet" body="Create or join a team to see shared progress here." action={{ label: 'Set up a team', onPress: () => router.push('/team-admin') }} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[[teamStats?.totals.doneThisWeek ?? 0, 'Done this week'], [teamStats?.totals.open ?? 0, 'Open'], [teamStats?.totals.unassigned ?? 0, 'Unassigned']].map(([n, l]) => (
              <View key={String(l)} style={{ flex: 1, backgroundColor: c.surface, borderRadius: radius.md, padding: 14 }}>
                <T v="title" style={{ fontSize: 26 }}>{String(n)}</T>
                <T v="small" muted>{l}</T>
              </View>
            ))}
          </View>
          <Section title="Done this week, by person">
            {teamStats?.members.length ? (
              <View style={{ gap: 14 }}>
                {teamStats.members.map((m) => (
                  <View key={m.id} style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Avatar name={m.name} size={28} color={memberColor(m.id, team)} />
                      <T v="strong" style={{ flex: 1 }}>{m.id === me?.id ? `${m.name} (you)` : m.name}</T>
                      <T v="small" muted>{m.doing} doing · {m.open} open</T>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ flex: 1, height: 12, backgroundColor: c.surface, borderTopRightRadius: 4, borderBottomRightRadius: 4, overflow: 'hidden' }}>
                        <View style={{ width: `${(m.doneThisWeek / max) * 100}%`, height: '100%', backgroundColor: memberColor(m.id, team), borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
                      </View>
                      <T v="small" style={{ width: 28, textAlign: 'right', fontWeight: '600' }}>{m.doneThisWeek}</T>
                    </View>
                  </View>
                ))}
              </View>
            ) : <T muted>Assign team tasks and finish them to see progress here.</T>}
          </Section>
          <Card tint>
            <T v="small">Numbers count team tasks only. Personal tasks stay private to each person.</T>
          </Card>
          <View style={{ flexDirection: 'row', gap: 20 }}>
            <LinkButton label="Team tasks" onPress={() => { useApp.getState().setWorkspace('team'); router.navigate('/tasks'); }} />
            <LinkButton label={me?.teamRole === 'admin' ? 'Manage members' : 'Members'} onPress={() => router.push('/team-admin')} />
          </View>
        </>
      )}
    </ScrollView>
  );
}
