import { addDays, fmtDate, suggestSlot } from '@ugent/core';
import { useState } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/Icon';
import { TaskRow } from '@/components/blocks';
import { Button, Field, Header, List, Row, Screen, Segmented, Sheet, T, useToast } from '@/components/ui';
import { useLang } from '@/hooks';
import { dayWord, fmtTime } from '@/lib/format';
import { liveTasks, plannerState, useApp } from '@/store';
import { useColors } from '@/theme';

type Filter = 'today' | 'all' | 'done';

export default function Tasks() {
  const c = useColors();
  const lang = useLang();
  const toast = useToast();
  const state = useApp();
  const [filter, setFilter] = useState<Filter>('today');
  const [title, setTitle] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const d0 = fmtDate(new Date());
  const all = liveTasks(state);
  const sorted = (l: typeof all) => [...l].sort((a, b) => Number(b.important) - Number(a.important) || a.date.localeCompare(b.date) || b.createdAt - a.createdAt);
  const list = filter === 'today' ? sorted(all.filter((x) => !x.done && x.date <= d0))
    : filter === 'all' ? sorted(all.filter((x) => !x.done))
    : all.filter((x) => x.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  const openCount = all.filter((x) => !x.done).length;
  const menu = all.find((x) => x.id === menuId) ?? null;
  const empty = { today: 'Nothing due today.', all: 'No open tasks. Add one above.', done: 'Finished tasks will show here.' }[filter];

  const add = () => {
    if (!title.trim()) return;
    state.addTask(title);
    setTitle('');
  };

  return (
    <Screen>
      <Header title="Tasks" sub={`${openCount} open`} />
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Field value={title} onChangeText={setTitle} placeholder="Add a task" onSubmitEditing={add} returnKeyType="done" accessibilityLabel="New task" blurOnSubmit={false} />
        </View>
        <Button label="Add" icon="plus" onPress={add} style={{ paddingHorizontal: 16 }} />
      </View>
      <Segmented value={filter} onChange={setFilter} options={[['today', 'Today'], ['all', 'All'], ['done', 'Done']]} />
      {list.length ? <List>{list.map((x) => <TaskRow key={x.id} task={x} onMenu={() => setMenuId(x.id)} />)}</List> : (
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 32 }}><Icon name="tasks" color={c.muted} /><T muted>{empty}</T></View>
      )}

      <Sheet visible={!!menu} onClose={() => setMenuId(null)} title={menu?.title}>
        {menu && (
          <List>
            <Row icon="calendar" title="Find time for this" sub="Ugent puts it in your best free slot" onPress={() => {
              const kind = /finish|write|deck|report|study|prepare|design|budget/i.test(menu.title) ? 'deep' : 'personal';
              const dur = kind === 'deep' ? 90 : 30;
              const slot = suggestSlot(plannerState(state), kind, dur, new Date());
              state.snapshot();
              state.addEvent({ title: menu.title, date: slot.date, start: slot.start, dur, kind, fixed: false, needsPower: kind === 'deep' });
              setMenuId(null);
              toast(`Planned for ${dayWord(slot.date, lang)}, ${fmtTime(lang)(slot.start)}`, state.restore);
            }} />
            <Row icon="star" title={menu.important ? 'Not important' : 'Mark as important'} onPress={() => { state.updateTask(menu.id, { important: !menu.important }); setMenuId(null); }} />
            <Row icon="clock" title="Move to tomorrow" onPress={() => {
              state.snapshot(); state.updateTask(menu.id, { date: addDays(d0, 1) }); setMenuId(null); toast('Moved to tomorrow', state.restore);
            }} />
            <Row icon="trash" title="Delete" danger onPress={() => {
              state.snapshot(); state.deleteTask(menu.id); setMenuId(null); toast('Task deleted', state.restore);
            }} />
          </List>
        )}
      </Sheet>
    </Screen>
  );
}
