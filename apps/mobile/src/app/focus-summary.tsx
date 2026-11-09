import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FocusSetupSheet } from '@/components/FocusSetup';
import { Icon } from '@/components/Icon';
import { Button, ButtonRow, Field, T, useToast } from '@/components/ui';
import { fmtDur } from '@/lib/format';
import { useApp } from '@/store';
import { useColors } from '@/theme';

/** After a focus session: how it went, tick the task, and jot what got done. */
export default function FocusSummary() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const state = useApp();
  const f = state.lastFocus;
  const task = f?.taskId ? state.tasks.find((t) => t.id === f.taskId && !t.deleted) : null;
  const [note, setNote] = useState('');
  const [again, setAgain] = useState(false);
  const weekMins = state.log.focus.filter((x) => x.t >= Date.now() - 7 * 86400000).reduce((a, x) => a + x.mins, 0);

  const close = () => {
    if (note.trim()) { state.addNote(`Focus${f?.label ? ` on ${f.label}` : ''}: ${note.trim()}`); toast('Saved to your notes'); }
    router.replace('/');
  };

  if (!f) { setTimeout(() => router.replace('/')); return <View style={{ flex: 1, backgroundColor: c.bg }} />; }
  const full = f.mins >= f.planned - 1;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24, paddingHorizontal: 24, gap: 22 }}>
      <View style={{ alignItems: 'center', gap: 12 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={full ? 'check' : 'focus'} color={c.skyInk} size={34} strokeWidth={2.2} />
        </View>
        <T v="title" center>{f.mins < 1 ? 'Session ended' : full ? 'Well done' : 'Good effort'}</T>
        <T muted center>{f.mins < 1 ? 'No time logged.' : `${fmtDur(f.mins)} of focus${f.label ? ` on ${f.label}` : ''}.`} {weekMins ? `${fmtDur(weekMins)} this week.` : ''}</T>
      </View>
      {task && !task.done && (
        <View style={{ backgroundColor: c.surface, borderRadius: 16, padding: 16, gap: 12 }}>
          <T v="strong">Did you finish "{task.title}"?</T>
          <ButtonRow>
            <Button compact label="Yes, mark it done" style={{ flexGrow: 1 }} onPress={() => { state.toggleTask(task.id); toast(`Done: ${task.title}`); }} />
            <Button compact kind="ghost" label="Not yet" style={{ flexGrow: 1 }} onPress={() => toast('No problem. It stays on your list.')} />
          </ButtonRow>
        </View>
      )}
      {task?.done && <T center color={c.good}>"{task.title}" is done.</T>}
      <Field label="What did you get done? (optional)" value={note} onChangeText={setNote} placeholder="e.g. Drafted slides 1 to 6" multiline style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 14 }} />
      <View style={{ flex: 1 }} />
      <ButtonRow>
        <Button label="Done" style={{ flexGrow: 1 }} onPress={close} />
        <Button kind="ghost" label="Another session" style={{ flexGrow: 1 }} onPress={() => setAgain(true)} />
      </ButtonRow>
      <FocusSetupSheet visible={again} onClose={() => setAgain(false)} />
    </View>
  );
}
