import { langMeta } from '@ugent/core';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Avatar, Group, PlanBadge } from '@/components/kit';
import { View } from 'react-native';
import { Header, Row, Screen, Segmented, T, Toggle } from '@/components/ui';
import { useOnline } from '@/hooks';
import { effectivePlan, useApp } from '@/store';
import { useTheme } from '@/theme';
import { THEMES } from '@/themes';

export default function Settings() {
  const state = useApp();
  const online = useOnline();
  const plan = effectivePlan(state);
  const pending = state.sync.dirtyTasks.length + state.sync.dirtyEvents.length;
  const theme = useTheme();
  const themeLabel = state.settings.theme === 'auto' ? `Match my phone (${theme.base === 'dark' ? 'Black' : 'White'})` : theme.id === 'custom' ? 'Custom' : THEMES.find((t) => t.id === theme.id)?.name ?? 'White';
  return (
    <Screen>
      <Header back title="Settings" />
      <Group>
        <Row title={state.profile.name || 'Your profile'} sub="Name, hustle, daily rhythm" chevron onPress={() => router.push('/profile')}
          right={<><PlanBadge plan={plan} /><Avatar name={state.profile.name || 'You'} size={34} /></>} />
      </Group>
      <Group>
        <Row icon="bell" title="Notifications" sub={state.settings.reminders ? `Reminders ${state.settings.leadMins} min before` : 'Reminders off'} chevron onPress={() => router.push('/notifications')} />
        <Row icon="sun" title="Appearance" sub={themeLabel} chevron onPress={() => router.push('/appearance')} />
        <Row icon="chat" title="Language" sub={langMeta(state.profile.lang).native} chevron onPress={() => router.push('/language')} />
        <Row icon="heart" title="Memory and preferences" sub="What Ugent has learned. Edit or delete it" chevron onPress={() => router.push('/memory')} />
        <Row icon="lock" title="Privacy and data" sub="What Ugent may do, clear or delete data" chevron onPress={() => router.push('/privacy')} />
        <Row icon="link" title="Connected apps" chevron onPress={() => router.push('/connections')} />
        <Row icon="wifiOff" title="Offline mode" sub={online ? (pending ? `${pending} change${pending > 1 ? 's' : ''} waiting to sync` : 'Online, all synced') : 'Offline, still working'} chevron onPress={() => router.push('/offline')} />
      </Group>
      <Group>
        <Row icon="mic" title="Speak replies out loud" right={<Toggle value={state.settings.voiceReplies} onChange={(v) => state.setSettings({ voiceReplies: v })} label="Speak replies out loud" />} />
      </Group>
      <View style={{ gap: 8 }}>
        <T v="label">Focus length</T>
        <Segmented value={state.settings.focusMins} onChange={(m: number) => state.setSettings({ focusMins: m })} options={[[25, '25 min'], [50, '50 min'], [90, '90 min']]} />
      </View>
      <Group>
        <Row icon="tag" title="Plans and pricing" chevron onPress={() => router.push('/pricing')} />
        <Row icon="info" title="Help and support" chevron onPress={() => router.push('/help')} />
      </Group>
      <T v="small" muted center>Ugent by Me AI · Version {Constants.expoConfig?.version ?? '1.0.0'}</T>
    </Screen>
  );
}
