import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { Group } from '@/components/kit';
import { Button, Card, Header, Row, Screen, T, Toggle, useToast } from '@/components/ui';
import { apiConfigured } from '@/lib/api';
import { syncNow } from '@/lib/sync';
import { useApp } from '@/store';
import { useColors } from '@/theme';

const WORKS: [IconName, string][] = [
  ['chat', 'Chat in all 6 languages (on-device assistant)'],
  ['calendar', 'Schedule, rescheduling and smart planning'],
  ['tasks', 'Tasks, focus mode and reminders'],
  ['chart', 'Your week and daily brief'],
];
const NEEDS: [IconName, string][] = [
  ['cloud', 'Smarter cloud answers'],
  ['sync', 'Backup and team sync'],
  ['link', 'Google Calendar, Gmail and live traffic'],
];

export default function Offline() {
  const c = useColors();
  const toast = useToast();
  const state = useApp();
  const [net, setNet] = useState<{ connected: boolean; type: string }>({ connected: true, type: 'unknown' });
  useEffect(() => NetInfo.addEventListener((s) => setNet({ connected: s.isConnected !== false, type: s.type })), []);
  const pending = state.sync.dirtyTasks.length + state.sync.dirtyEvents.length;
  const mode = !net.connected ? 'Offline' : state.settings.lowData ? 'Low data mode' : 'Online';
  const color = !net.connected ? c.warn : c.good;

  return (
    <Screen>
      <Header back title="Offline mode" />
      <Card tint>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
          <T v="h2">{mode}</T>
        </View>
        <T>{!net.connected ? 'No connection. Ugent keeps working and saves your changes on the phone.' : state.settings.lowData ? 'Ugent uses almost no data: chat runs on your phone and nothing is downloaded.' : `Connected${net.type !== 'unknown' ? ` by ${net.type}` : ''}.`}</T>
        {apiConfigured() && <T v="small" muted>{pending ? `${pending} change${pending > 1 ? 's' : ''} waiting to sync.` : 'Everything is synced.'}{state.sync.lastAt ? ` Last sync ${new Date(state.sync.lastAt).toLocaleString()}.` : ''}</T>}
        {apiConfigured() && net.connected && <Button compact kind="ghost" icon="sync" label="Sync now" onPress={async () => { await syncNow(); toast(useApp.getState().sync.dirtyTasks.length + useApp.getState().sync.dirtyEvents.length ? 'Some changes are still waiting.' : 'All synced'); }} />}
      </Card>
      <Group>
        <Row title="Low data mode" sub="Keep chat on the phone and skip downloads, even when online" right={<Toggle value={state.settings.lowData} onChange={(v) => state.setSettings({ lowData: v })} label="Low data mode" />} />
      </Group>
      <View style={{ gap: 10 }}>
        <T v="label">Works with no connection</T>
        {WORKS.map(([ic, l]) => <View key={l} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><Icon name={ic} color={c.good} /><T style={{ flex: 1 }}>{l}</T></View>)}
      </View>
      <View style={{ gap: 10 }}>
        <T v="label">Waits for a connection</T>
        {NEEDS.map(([ic, l]) => <View key={l} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><Icon name={ic} color={c.muted} /><T muted style={{ flex: 1 }}>{l}</T></View>)}
      </View>
    </Screen>
  );
}
