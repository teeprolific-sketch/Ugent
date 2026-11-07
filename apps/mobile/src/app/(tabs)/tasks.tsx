import type { Task, TaskStatus } from '@ugent/core';
import { addDays, fmtDate, suggestSlot } from '@ugent/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { TaskRow } from '@/components/blocks';
import { Avatar, EmptyState, WorkspaceSwitcher } from '@/components/kit';
import { Button, Field, Header, List, Pill, Row, Screen, Segmented, Sheet, T, useToast } from '@/components/ui';
import { useLang } from '@/hooks';
import { dayWord, fmtTime } from '@/lib/format';
import { memberColor, memberName } from '@/lib/team';
import { liveTasks, plannerState, teamMode, useApp } from '@/store';
import { radius, useColors } from '@/theme';

type Filter = 'today' | 'all' | 'done';

export default function Tasks() {
  const state = useApp();
  return teamMode(state) ? <TeamBoard /> : <PersonalTasks />;
}

function PersonalTasks() {
  const lang = useLang();
  const toast = useToast();
  const state = useApp();
  const [filter, setFilter] = useState<Filter>('today');
  const [title, setTitle] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const d0 = fmtDate(new Date());
  const all = liveTasks(state).filter((x) => !x.teamId || x.assigneeId === state.me?.id);
  const sorted = (l: Task[]) => [...l].sort((a, b) => Number(b.important) - Number(a.important) || a.date.localeCompare(b.date) || b.createdAt - a.createdAt);
  const list = filter === 'today' ? sorted(all.filter((x) => !x.done && x.date <= d0))
    : filter === 'all' ? sorted(all.filter((x) => !x.done))
    : all.filter((x) => x.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  const menu = all.find((x) => x.id === menuId) ?? null;
  const add = () => { if (title.trim()) { state.addTask(title); setTitle(''); } };

  return (
    <Screen>
      <Header title="Tasks" sub={`${all.filter((x) => !x.done).length} open`} />
      <WorkspaceSwitcher />
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}><Field value={title} onChangeText={setTitle} placeholder="Add a task" onSubmitEditing={add} returnKeyType="done" accessibilityLabel="New task" blurOnSubmit={false} /></View>
        <Button label="Add" icon="plus" onPress={add} style={{ paddingHorizontal: 16 }} />
      </View>
      <Segmented value={filter} onChange={setFilter} options={[['today', 'Today'], ['all', 'All'], ['done', 'Done']]} />
      {list.length ? <List>{list.map((x) => <TaskRow key={x.id} task={x} onMenu={() => setMenuId(x.id)} />)}</List> : (
        filter === 'done'
          ? <EmptyState icon="check" title="Nothing finished yet" body="Tick a task when you're done. Ugent learns your best time of day from it." />
          : all.length === 0
            ? <EmptyState icon="tasks" title="No tasks yet" body="Add one above, or tell Ugent: &quot;Remind me to pay the NEPA bill.&quot;" action={{ label: 'Talk to Ugent', onPress: () => router.navigate('/chat') }} />
            : <EmptyState icon="sun" title="Nothing due today" body="Enjoy the breathing room. See everything under All." />
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
            <Row icon="clock" title="Move to tomorrow" onPress={() => { state.snapshot(); state.updateTask(menu.id, { date: addDays(d0, 1) }); setMenuId(null); toast('Moved to tomorrow', state.restore); }} />
            <Row icon="trash" title="Delete" danger onPress={() => { state.snapshot(); state.deleteTask(menu.id); setMenuId(null); toast('Task deleted', state.restore); }} />
          </List>
        )}
      </Sheet>
    </Screen>
  );
}

const COLS: [TaskStatus, string][] = [['todo', 'To do'], ['doing', 'Doing'], ['done', 'Done']];

/** Team tasks board: one column at a time on a phone, with counts. */
function TeamBoard() {
  const c = useColors();
  const toast = useToast();
  const state = useApp();
  const { team, me } = state;
  const [col, setCol] = useState<TaskStatus>('todo');
  const [title, setTitle] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const tasks = liveTasks(state).filter((t) => t.teamId && t.teamId === me?.teamId);
  const statusOf = (t: Task): TaskStatus => (t.done ? 'done' : t.status === 'doing' ? 'doing' : 'todo');
  const inCol = tasks.filter((t) => statusOf(t) === col).sort((a, b) => b.updatedAt - a.updatedAt);
  const open = tasks.find((t) => t.id === openId) ?? null;
  const move = (t: Task, s: TaskStatus) => state.updateTask(t.id, { status: s, done: s === 'done', doneAt: s === 'done' ? Date.now() : null });

  return (
    <Screen>
      <Header title="Team tasks" sub={team?.name} />
      <WorkspaceSwitcher />
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}><Field value={title} onChangeText={setTitle} placeholder="Add a team task" accessibilityLabel="New team task"
          onSubmitEditing={() => { if (title.trim()) { state.addTeamTask(title.trim(), null); setTitle(''); } }} returnKeyType="done" blurOnSubmit={false} /></View>
        <Button label="Add" icon="plus" style={{ paddingHorizontal: 16 }} onPress={() => { if (title.trim()) { state.addTeamTask(title.trim(), null); setTitle(''); } }} />
      </View>
      <Segmented value={col} onChange={setCol} options={COLS.map(([v, l]) => [v, `${l} ${tasks.filter((t) => statusOf(t) === v).length}`] as [TaskStatus, string])} />
      {inCol.length ? (
        <View style={{ gap: 10 }}>
          {inCol.map((t) => (
            <Pressable key={t.id} onPress={() => setOpenId(t.id)} accessibilityRole="button" accessibilityLabel={`${t.title}, ${memberName(t.assigneeId, team, me?.id)}`}
              style={{ backgroundColor: c.surface, borderRadius: radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <T v="strong" style={t.done ? { textDecorationLine: 'line-through', color: c.muted } : undefined}>{t.title}</T>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Pill label={memberName(t.assigneeId, team, me?.id)} tone="onCard" />
                  {t.date !== fmtDate(new Date()) && <Pill label={t.date < fmtDate(new Date()) ? 'Overdue' : 'Later'} tone="onCard" />}
                </View>
              </View>
              {t.assigneeId ? <Avatar size={32} name={memberName(t.assigneeId, team)} color={memberColor(t.assigneeId, team)} /> : null}
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState icon="tasks" title={col === 'done' ? 'Nothing finished this week' : col === 'doing' ? 'No one is working on a task' : 'No team tasks to do'}
          body={col === 'todo' ? 'Add a task above and assign it to someone on the team.' : 'Move a task here from its menu.'} />
      )}

      <Sheet visible={!!open} onClose={() => setOpenId(null)} title={open?.title}>
        {open && (
          <>
            <T v="label">Move to</T>
            <Segmented value={statusOf(open)} onChange={(s: TaskStatus) => { move(open, s); toast(`Moved to ${COLS.find((x) => x[0] === s)![1]}`); }} options={COLS} />
            <T v="label">Assigned to</T>
            <List>
              {[{ id: null as string | null, name: 'No one yet' }, ...(team?.members ?? [])].map((m) => (
                <Row key={m.id ?? 'none'} title={m.id === me?.id ? `${m.name} (you)` : m.name}
                  right={open.assigneeId === m.id ? <Pill label="Assigned" tone="sky" /> : undefined}
                  onPress={() => { state.updateTask(open.id, { assigneeId: m.id }); toast(m.id ? `Assigned to ${m.name}` : 'Unassigned'); }} />
              ))}
            </List>
            <Button kind="danger" label="Delete task" icon="trash" onPress={() => { state.snapshot(); state.deleteTask(open.id); setOpenId(null); toast('Task deleted', state.restore); }} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}
