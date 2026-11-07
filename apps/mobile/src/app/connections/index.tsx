import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Group } from '@/components/kit';
import { Button, ButtonRow, Header, Pill, Row, Screen, Sheet, T, useToast } from '@/components/ui';
import type { ConnInfo } from '@/lib/connections';
import { CONNECTIONS, connect, disconnect, importGoogleTasks, refreshCloud, statusOf } from '@/lib/connections';
import { effectivePlan, useApp } from '@/store';
import { useColors } from '@/theme';

const GROUPS: ConnInfo['group'][] = ['Messaging', 'Calendars and tasks', 'Places', 'Later'];

export default function Connections() {
  const c = useColors();
  const toast = useToast();
  // Subscribe to both so statuses refresh after connecting (separate selectors keep each value stable).
  useApp((s) => s.connections);
  useApp((s) => s.cloud);
  const plan = useApp((s) => effectivePlan(s));
  const params = useLocalSearchParams<{ connected?: string; error?: string }>();
  const [open, setOpen] = useState<ConnInfo | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void refreshCloud(); }, []);
  useEffect(() => { if (params.error) toast('Google sign-in was not completed.'); }, [params.error, toast]);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    try { toast(await fn()); } catch { toast('Something went wrong. Try again.'); } finally { setBusy(false); setOpen(null); }
  };

  const press = (x: ConnInfo) => (x.screen ? router.push(x.screen) : setOpen(x));
  return (
    <Screen>
      <Header back title="Connected apps" sub="Ugent works with the apps you already use. You choose what it can reach." />
      {GROUPS.map((g) => (
        <Group key={g} title={g}>
          {CONNECTIONS.filter((x) => x.group === g).map((x) => {
            const st = statusOf(x);
            return (
              <Row key={x.id} title={x.name} sub={st.label} onPress={x.kind === 'later' ? undefined : () => press(x)}
                right={st.on ? <Pill label="On" tone="good" icon="check" /> : x.kind === 'later' ? <Pill label="Later" /> : st.needsSetup ? <Pill label="Soon" /> : <T v="small" color={c.skyInk} style={{ fontWeight: '600' }}>Connect</T>} />
            );
          })}
        </Group>
      ))}
      <T v="small" muted>Ugent never sends a message, makes a call or books anything without showing you first. Google accounts are read-only.</T>

      <Sheet visible={!!open} onClose={() => setOpen(null)} title={open?.name}>
        {open && (() => {
          const st = statusOf(open);
          const needsPlan = open.kind === 'cloud' && plan === 'free';
          return (
            <>
              <T>{open.what}</T>
              <View style={{ flexDirection: 'row', gap: 8 }}><Pill label={st.label} tone={st.on ? 'good' : 'plain'} /></View>
              {needsPlan && !st.on && <T v="small" muted>Google connections are part of Pro and Team.</T>}
              {st.on ? (
                <ButtonRow>
                  {open.id === 'googleTasks' && <Button label="Import my tasks" style={{ flexGrow: 1 }} disabled={busy} onPress={() => run(async () => { const n = await importGoogleTasks(); return n ? `${n} task${n > 1 ? 's' : ''} added.` : 'Everything is already in Ugent.'; })} />}
                  <Button kind="danger" label="Disconnect" style={{ flexGrow: 1 }} disabled={busy} onPress={() => run(() => disconnect(open.id))} />
                </ButtonRow>
              ) : needsPlan ? (
                <Button label="See plans" onPress={() => { setOpen(null); router.push('/pricing'); }} />
              ) : st.needsSetup ? (
                <T v="small" muted>Me AI is still setting this up on the Ugent server. It will appear here when it's ready.</T>
              ) : (
                <Button label={busy ? 'Connecting…' : `Connect ${open.name}`} disabled={busy} onPress={() => run(() => connect(open.id))} />
              )}
            </>
          );
        })()}
      </Sheet>
    </Screen>
  );
}
