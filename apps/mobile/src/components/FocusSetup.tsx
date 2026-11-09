import { fmtDate } from '@ugent/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { reportFocus } from '@/lib/api';
import { liveTasks, useApp } from '@/store';
import { Button, Chip, Field, Segmented, Sheet, T } from './ui';

/** Before a focus session: what you're working on, and for how long. */
export function FocusSetupSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const state = useApp();
  const [label, setLabel] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [mins, setMins] = useState(state.settings.focusMins);
  const d0 = fmtDate(new Date());
  const tasks = liveTasks(state).filter((t) => !t.done && t.date <= d0).sort((a, b) => Number(b.important) - Number(a.important)).slice(0, 4);

  const start = () => {
    state.startFocus(mins, label.trim() || 'Focused work', taskId);
    void reportFocus(Date.now() + mins * 60000);
    onClose();
    setLabel(''); setTaskId(null);
    router.push('/focus');
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Start a focus session">
      <T v="strong">What are you working on?</T>
      {tasks.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {tasks.map((t) => <Chip key={t.id} label={t.title} on={taskId === t.id} onPress={() => { setTaskId(t.id); setLabel(t.title); }} />)}
        </View>
      )}
      <Field value={label} onChangeText={(v) => { setLabel(v); setTaskId(null); }} placeholder="Or type it, e.g. Finish the budget" accessibilityLabel="What are you working on?" />
      <T v="strong">For how long?</T>
      <Segmented value={mins} onChange={setMins} options={[[25, '25 min'], [50, '50 min'], [90, '90 min']]} />
      <T v="small" muted>Ugent holds its reminders and, if you use WhatsApp Business, replies to customers for you until you finish.</T>
      <Button label="Start focus" icon="focus" onPress={start} />
    </Sheet>
  );
}
