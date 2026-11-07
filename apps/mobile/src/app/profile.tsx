import type { Hustle } from '@ugent/core';
import { HUSTLE_LABEL, HUSTLES, langMeta } from '@ugent/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Avatar, ChoiceList, Group, minutesLabel, PlanBadge, TimeChips } from '@/components/kit';
import { Button, Field, Header, Row, Screen, Segmented, Sheet, T, useToast } from '@/components/ui';
import { effectivePlan, useApp } from '@/store';

export default function Profile() {
  const toast = useToast();
  const state = useApp();
  const { profile } = state;
  const plan = effectivePlan(state);
  const [name, setName] = useState(profile.name);
  const [sheet, setSheet] = useState<'hustle' | 'rhythm' | null>(null);

  return (
    <Screen>
      <Header back title="Profile" />
      <View style={{ alignItems: 'center', gap: 10 }}>
        <Avatar name={profile.name || 'You'} size={84} />
        <T v="h2">{profile.name || 'Add your name'}</T>
        <PlanBadge plan={plan} />
        {state.me?.teamId && state.team && <T v="small" muted>{state.me.teamRole === 'admin' ? 'Admin' : 'Member'} of {state.team.name}</T>}
      </View>
      <Field label="Name" value={name} onChangeText={setName} onBlur={() => { if (name.trim() !== profile.name) { state.setProfile({ name: name.trim() }); toast('Name saved'); } }} autoComplete="given-name" />
      <Group>
        <Row icon="tasks" title="Hustle" sub={profile.hustle ? HUSTLE_LABEL[profile.hustle].title : 'Not set'} chevron onPress={() => setSheet('hustle')} />
        <Row icon="sun" title="Daily rhythm" sub={`Up at ${minutesLabel(profile.wake)}, bed at ${minutesLabel(profile.sleep)} · best in the ${profile.peak}`} chevron onPress={() => setSheet('rhythm')} />
        <Row icon="chat" title="Language" sub={langMeta(profile.lang).native} chevron onPress={() => router.push('/language')} />
      </Group>
      <Group>
        <Row icon="tag" title="Plan" sub={plan === 'free' ? 'Free. Upgrade to Pro for $2 a month' : plan === 'pro' ? 'Pro, $2 a month' : 'Team, $21 a month'} chevron onPress={() => router.push('/pricing')} />
        {state.me?.teamId && <Row icon="users" title="Team" sub={state.team?.name} chevron onPress={() => router.push('/team-admin')} />}
      </Group>

      <Sheet visible={sheet === 'hustle'} onClose={() => setSheet(null)} title="What's your hustle?">
        <ChoiceList value={profile.hustle} onChange={(h: Hustle) => { state.setProfile({ hustle: h }); setSheet(null); toast('Saved'); }}
          options={HUSTLES.map((h) => ({ v: h, title: HUSTLE_LABEL[h].title, sub: HUSTLE_LABEL[h].sub }))} />
      </Sheet>
      <Sheet visible={sheet === 'rhythm'} onClose={() => setSheet(null)} title="Daily rhythm">
        <T v="strong">Wake up</T>
        <TimeChips value={profile.wake} onChange={(m) => state.setProfile({ wake: m })} options={[300, 330, 360, 390, 420, 480]} />
        <T v="strong">Bedtime</T>
        <TimeChips value={profile.sleep} onChange={(m) => state.setProfile({ sleep: m })} options={[1260, 1320, 1350, 1380, 1410]} />
        <T v="strong">Most energy</T>
        <Segmented value={profile.peak} onChange={(p) => state.setProfile({ peak: p })} options={[['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening']]} />
        <T v="small" muted>Ugent never plans before you wake or after bedtime, and keeps quiet while you sleep.</T>
        <Button label="Done" onPress={() => setSheet(null)} />
      </Sheet>
    </Screen>
  );
}
