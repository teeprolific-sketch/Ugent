import { bestTime, detectRoutines, insights, weekdayName } from '@ugent/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/Icon';
import { EmptyState, Group } from '@/components/kit';
import { Button, ButtonRow, Field, Header, IconButton, Row, Screen, Segmented, Sheet, T, Toggle, useToast } from '@/components/ui';
import { useLang } from '@/hooks';
import { fmtStamp, fmtTime } from '@/lib/format';
import { plannerState, routineKey, useApp } from '@/store';
import { useColors } from '@/theme';

/** Memory and preferences: everything Ugent has learned, editable and deletable in one place. */
export default function Memory() {
  const c = useColors();
  const lang = useLang();
  const toast = useToast();
  const state = useApp();
  const s = state.settings;
  const now = new Date();
  const [edit, setEdit] = useState<{ id: string | null; text: string } | null>(null);
  const routines = s.learn ? detectRoutines(state.events, now) : [];
  const patterns = s.learn ? insights({ completions: state.log.completions, events: state.events, reschedules: state.log.reschedules, focus: state.log.focus }, now) : [];
  const learned = s.learn ? bestTime(plannerState(state), now) : null;
  const people = Object.entries(state.memory.people).sort((a, b) => Number(!!b[1].pinned) - Number(!!a[1].pinned) || b[1].count - a[1].count).slice(0, 20);
  const places = Object.entries(state.memory.places).sort((a, b) => b[1].count - a[1].count).slice(0, 12);
  const f = fmtTime(lang);
  const star = (on: boolean, label: string, onPress: () => void) => <IconButton icon="star" label={label} color={on ? c.sky : c.muted} onPress={onPress} />;

  const saveNote = () => {
    if (!edit || !edit.text.trim()) return;
    if (edit.id) { state.editMemoryNote(edit.id, edit.text); toast('Updated'); }
    else { state.remember(edit.text); toast('Ugent will remember that'); }
    setEdit(null);
  };

  return (
    <Screen>
      <Header back title="Memory and preferences" sub="What Ugent knows about you. Change or delete anything." />

      <Group title="How you like Ugent">
        <T v="label">Replies</T>
        <Segmented value={s.replyStyle} onChange={(v) => state.setSettings({ replyStyle: v })} options={[['short', 'Short and simple'], ['detailed', 'Step by step']]} />
        <T v="label">Your best time</T>
        <Segmented value={state.profile.peak} onChange={(p) => state.setProfile({ peak: p })} options={[['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening']]} />
        {learned && learned !== state.profile.peak ? <T v="small" muted>From what you finish, your {learned} looks strongest. Ugent plans heavy work there.</T> : null}
        <Row title="Learn from me" sub="Best time, routines, people and places" right={<Toggle value={s.learn} onChange={(v) => state.setSettings({ learn: v })} label="Learn from me" />} />
      </Group>

      {patterns.length > 0 && (
        <Group title="Your work patterns">
          <View style={{ gap: 10, paddingVertical: 12 }}>
            {patterns.map((p) => (
              <View key={p} style={{ flexDirection: 'row', gap: 10 }}>
                <Icon name="leaf" color={c.skyInk} size={20} />
                <T style={{ flex: 1 }}>{p}</T>
              </View>
            ))}
          </View>
        </Group>
      )}

      <Group title="Things you told Ugent" note='Say "Remember that…" in chat or Live, or add one here.'>
        {state.memory.notes.map((n) => (
          <Row key={n.id} icon="info" title={n.text} sub={fmtStamp(n.at, lang)} onPress={() => setEdit({ id: n.id, text: n.text })}
            right={<IconButton icon="trash" label={`Forget: ${n.text}`} onPress={() => { state.forgetNote(n.id); toast('Forgotten'); }} />} />
        ))}
        <Row icon="plus" title="Remember something" onPress={() => setEdit({ id: null, text: '' })} />
      </Group>

      <Group title="People" note="Starred people show first on Home and in suggestions.">
        {people.length ? people.map(([k, p]) => (
          <Row key={k} icon="user" title={p.name} sub={`${p.count} call${p.count > 1 ? 's' : ''} or message${p.count > 1 ? 's' : ''}${p.phone ? ' · number saved' : ''}`}
            right={<View style={{ flexDirection: 'row', gap: 4 }}>
              {star(!!p.pinned, p.pinned ? `Unstar ${p.name}` : `Star ${p.name}`, () => state.pinPerson(k, !p.pinned))}
              <IconButton icon="trash" label={`Forget ${p.name}`} onPress={() => { state.forgetPerson(k); toast('Forgotten'); }} />
            </View>} />
        )) : <Row title="No one yet" sub='Ask Ugent to "call" or "message" someone and they appear here.' />}
      </Group>

      <Group title="Routines" note="Starred routines are suggested first when they're not planned yet.">
        {routines.length ? routines.map((r) => {
          const k = routineKey(r.title, r.weekday);
          const on = state.pinnedRoutines.includes(k);
          return (
            <Row key={k} icon="sync" title={r.title} sub={`${weekdayName(r.weekday)}s around ${f(r.start)} · seen ${r.times} times`}
              right={star(on, on ? `Unstar ${r.title}` : `Star ${r.title}`, () => state.pinRoutine(k, !on))} />
          );
        }) : <Row title={s.learn ? 'None found yet' : 'Learning is off'} sub={s.learn ? 'Plans you repeat on the same weekday show up here after a few weeks.' : 'Turn on "Learn from me" above.'} />}
      </Group>

      <Group title="Places">
        {[state.places.home && ['home', 'Home', state.places.home], state.places.work && ['work', 'Work', state.places.work]].filter(Boolean).map((x) => {
          const [k, t, v] = x as string[];
          return <Row key={k} icon="pin" title={t} sub={v} chevron onPress={() => router.push('/profile')} />;
        })}
        {places.map(([k, p]) => (
          <Row key={k} icon="pin" title={p.name} sub={`Visited ${p.count} time${p.count > 1 ? 's' : ''}`}
            right={<IconButton icon="trash" label={`Forget ${p.name}`} onPress={() => { state.forgetPlace(k); toast('Forgotten'); }} />} />
        ))}
        {!places.length && !state.places.home && !state.places.work ? <Row title="No places yet" sub="Add home and work in your profile for better leave-by times." chevron onPress={() => router.push('/profile')} /> : null}
      </Group>

      {!s.learn && state.memory.notes.length === 0 && people.length === 0 ? (
        <EmptyState icon="lock" title="Ugent isn't learning" body="Turn on Learn from me to get answers and plans shaped around you." />
      ) : null}

      <Row icon="lock" title="Privacy controls" sub="Clear chats, habits, or delete everything" chevron onPress={() => router.push('/privacy')} />

      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit what Ugent remembers' : 'Remember something'}>
        <Field value={edit?.text ?? ''} onChangeText={(t) => setEdit((e) => (e ? { ...e, text: t } : e))} autoFocus multiline accessibilityLabel="What should Ugent remember?"
          placeholder="e.g. My mum's birthday is 12 March" style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 14 }} />
        <ButtonRow>
          <Button label="Save" disabled={!edit?.text.trim()} style={{ flexGrow: 1 }} onPress={saveNote} />
          <Button kind="ghost" label="Cancel" style={{ flexGrow: 1 }} onPress={() => setEdit(null)} />
        </ButtonRow>
      </Sheet>
    </Screen>
  );
}
