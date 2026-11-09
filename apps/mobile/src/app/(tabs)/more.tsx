import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Avatar, Group, PlanBadge } from '@/components/kit';
import { Header, Row, Screen, T } from '@/components/ui';
import { CONNECTIONS, statusOf } from '@/lib/connections';
import { effectivePlan, inTeam, useApp } from '@/store';
import { radius, useColors } from '@/theme';

export default function More() {
  const c = useColors();
  const state = useApp();
  const plan = effectivePlan(state);
  const connected = CONNECTIONS.filter((x) => statusOf(x).on).length;
  return (
    <Screen>
      <Header title="More" />
      <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel="Your profile"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.surface, borderRadius: radius.lg, padding: 16 }}>
        <Avatar name={state.profile.name || 'You'} size={52} />
        <View style={{ flex: 1, gap: 4 }}>
          <T v="h3">{state.profile.name || 'Your profile'}</T>
          <PlanBadge plan={plan} />
        </View>
        <Icon name="chevR" color={c.muted} size={20} />
      </Pressable>
      <Group>
        <Row icon="more" title="Me AI ecosystem" sub="Sleek, Domestica I, Afrika I, ID'd" chevron onPress={() => router.push('/ecosystem')} />
        <Row icon="link" title="Connected apps" sub={connected ? `${connected} connected` : 'WhatsApp, Maps, Calendar and more'} chevron onPress={() => router.push('/connections')} />
        <Row icon="chart" title="Your week" sub="Simple numbers about your time" chevron onPress={() => router.push('/analytics')} />
        <Row icon="heart" title="Memory and preferences" sub="What Ugent knows about you" chevron onPress={() => router.push('/memory')} />
      </Group>
      {inTeam(state) && (
        <Group title="Team">
          <Row icon="chart" title="Team dashboard" sub="Progress and shared updates" chevron onPress={() => router.push('/team')} />
          <Row icon="users" title={state.me?.teamRole === 'admin' ? 'Members and roles' : 'Members'} chevron onPress={() => router.push('/team-admin')} />
        </Group>
      )}
      <Group>
        <Row icon="tag" title="Plans and pricing" sub={plan === 'free' ? 'Pro $2 · Team $21' : `You're on ${plan === 'pro' ? 'Pro' : 'Team'}`} chevron onPress={() => router.push('/pricing')} />
        <Row icon="shield" title="Settings" sub="Notifications, language, privacy" chevron onPress={() => router.push('/settings')} />
        <Row icon="info" title="Help and support" chevron onPress={() => router.push('/help')} />
      </Group>
      <T v="small" muted center>Ugent by Me AI · Version {Constants.expoConfig?.version ?? '1.0.0'}</T>
    </Screen>
  );
}
