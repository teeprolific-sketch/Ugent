import Constants from 'expo-constants';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Header, List, Pill, Row, Screen, Section, T } from '@/components/ui';
import { effectivePlan, useApp } from '@/store';

const PLAN_NAME = { free: 'the free plan', pro: 'Pro', team: 'Team' } as const;

export default function More() {
  const state = useApp();
  const plan = effectivePlan(state);
  return (
    <Screen>
      <Header title="More" />
      <List>
        <Row icon="chart" title="Your week" sub="Simple numbers about your time" chevron onPress={() => router.push('/analytics')} />
        <Row icon="tag" title="Plans and pricing" sub={`You're on ${PLAN_NAME[plan]}`} chevron onPress={() => router.push('/pricing')} />
        {(plan === 'team' || state.me?.teamId) && <Row icon="users" title="Your team" sub="Shared calendar and members" chevron onPress={() => router.push('/team')} />}
        <Row icon="shield" title="Settings and privacy" sub="Language, voice, data and control" chevron onPress={() => router.push('/settings')} />
      </List>
      <Section title="Connect your Me AI devices">
        <T v="small" muted>Ugent will work with the rest of the Me AI family.</T>
        <List>
          <Row title="Sleek" sub="Find verified mechanics, cleaners and carpenters" right={<Pill label="Coming soon" />} />
          <Row title="Domestica I" sub="Your home robot that sweeps, mops and maps rooms" right={<Pill label="Coming soon" />} />
          <Row title="Afrika I" sub="Farm patrol by air and land" right={<Pill label="Coming soon" />} />
        </List>
      </Section>
      <View><T v="small" muted center>Ugent by Me AI · Version {Constants.expoConfig?.version ?? '1.0.0'}</T></View>
    </Screen>
  );
}
