import { useState } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { Group } from '@/components/kit';
import { Button, Card, Header, Row, Screen, T, Toggle, useToast } from '@/components/ui';
import { apiConfigured } from '@/lib/api';
import { fmtBytes, useDataSaver } from '@/lib/data';
import { syncNow } from '@/lib/sync';
import { useApp } from '@/store';
import { useColors } from '@/theme';

const WORKS: [IconName, string][] = [
  ['chat', 'Chat and voice in all 6 languages (on-phone assistant)'],
  ['calendar', 'Schedule, rescheduling and smart planning'],
  ['tasks', 'Tasks, focus mode and reminders'],
  ['chart', 'Your week, daily brief, notes and search'],
  ['bell', 'Reminders and leave-by alerts, even with the app closed'],
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
  const net = useDataSaver();
  const [busy, setBusy] = useState(false);
  const pending = state.sync.dirtyTasks.length + state.sync.dirtyEvents.length;
  const month = new Date().toISOString().slice(0, 7);
  const used = state.dataUsage.month === month ? state.dataUsage.bytes : 0;
  const mode = !net.online ? 'Offline' : net.reason === 'manual' ? 'Low data mode' : net.reason === 'slow' ? 'Saving data' : 'Online';
  const line = !net.online
    ? 'No connection. Ugent keeps working and saves your changes on the phone. They go up by themselves when you are back online.'
    : net.reason === 'manual'
      ? 'Ugent uses almost no data: chat runs on your phone, and only your own changes sync, in small pieces. Google Calendar, Gmail, team updates and live traffic wait until you turn this off.'
      : net.reason === 'slow'
        ? `Your connection${net.label !== 'unknown' ? ` (${net.label})` : ''} is slow right now, so Ugent syncs in small pieces and skips Google, Gmail, team refreshes and live traffic for now.`
        : `Connected by ${net.label}.`;

  return (
    <Screen>
      <Header back title="Offline and data" sub="Free on every plan." />
      <Card tint>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: !net.online ? c.warn : c.good }} />
          <T v="h2">{mode}</T>
        </View>
        <T>{line}</T>
        {apiConfigured() && (
          <T v="small" muted>{pending ? `${pending} change${pending > 1 ? 's' : ''} waiting to sync.` : 'Everything is synced.'}{state.sync.lastAt ? ` Last sync ${new Date(state.sync.lastAt).toLocaleString()}.` : ''}</T>
        )}
        {apiConfigured() && net.online && <Button compact kind="ghost" icon="sync" label={busy ? 'Syncing…' : 'Sync now'} disabled={busy} onPress={async () => {
          setBusy(true);
          const ok = await syncNow();
          setBusy(false);
          toast(ok ? 'All synced' : 'The connection is weak. Ugent will keep trying by itself.');
        }} />}
      </Card>
      <Group note="Data saving never turns anything off for good: it only waits for a better connection.">
        <Row title="Low data mode" sub="Keep chat on the phone and hold back downloads, even on Wi-Fi" right={<Toggle value={state.settings.lowData} onChange={(v) => state.setSettings({ lowData: v })} label="Low data mode" />} />
        <Row title="Save data on slow connections" sub="On 2G and 3G, sync in small pieces and skip extras" right={<Toggle value={state.settings.autoLowData} onChange={(v) => state.setSettings({ autoLowData: v })} label="Save data on slow connections" />} />
      </Group>
      {apiConfigured() && (
        <Group title="Data used by Ugent">
          <Row icon="chart" title={fmtBytes(used)} sub="This month, for sync, online chat and connected apps. Your phone's own count may differ slightly." />
        </Group>
      )}
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
