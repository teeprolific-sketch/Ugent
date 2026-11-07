import { useState } from 'react';
import { View } from 'react-native';
import { Group, minutesToHHMM, TimeChips } from '@/components/kit';
import { Header, Row, Screen, Segmented, T, Toggle, useToast } from '@/components/ui';
import { askNotificationPermission } from '@/lib/notifications';
import { useApp } from '@/store';

export default function Notifications() {
  const toast = useToast();
  const state = useApp();
  const s = state.settings;
  const [briefOn, setBriefOn] = useState(!!s.briefTime);
  const brief = s.briefTime ? (() => { const [h, m] = s.briefTime.split(':').map(Number); return h * 60 + m; })() : 420;
  const ensure = async () => { const ok = await askNotificationPermission(); if (!ok) toast('Allow notifications for Ugent in your phone settings first.'); return ok; };

  return (
    <Screen>
      <Header back title="Notifications" sub="Ugent only notifies you when it matters." />
      <Group title="Plans">
        <Row title="Remind me before plans" right={<Toggle value={s.reminders} label="Remind me before plans" onChange={async (v) => { if (v && !(await ensure())) return; state.setSettings({ reminders: v }); }} />} />
        {s.reminders && (
          <View style={{ paddingBottom: 14, gap: 8 }}>
            <T v="small" muted>How early?</T>
            <Segmented value={s.leadMins} onChange={(m: number) => state.setSettings({ leadMins: m })} options={[[5, '5 min'], [10, '10 min'], [15, '15 min'], [30, '30 min']]} />
          </View>
        )}
      </Group>
      <Group title="Daily brief">
        <Row title="Morning brief" sub="Your plans and tasks for the day" right={<Toggle value={briefOn} label="Morning brief" onChange={async (v) => {
          if (v && !(await ensure())) return;
          setBriefOn(v); state.setSettings({ briefTime: v ? minutesToHHMM(brief) : '' });
        }} />} />
        {briefOn && <View style={{ paddingBottom: 14 }}><TimeChips value={brief} onChange={(m) => state.setSettings({ briefTime: minutesToHHMM(m) })} options={[330, 360, 390, 420, 480]} /></View>}
      </Group>
      <Group title="Quiet" note="Focus mode always holds Ugent's reminders until you finish.">
        <Row title="Quiet while I sleep" sub="No reminders between bedtime and wake-up" right={<Toggle value={s.quietHours} label="Quiet while I sleep" onChange={(v) => state.setSettings({ quietHours: v })} />} />
      </Group>
    </Screen>
  );
}
