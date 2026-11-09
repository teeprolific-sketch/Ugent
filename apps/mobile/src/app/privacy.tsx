import { bestTime, detectRoutines, langMeta, weekdayName } from '@ugent/core';
import { fmtTime } from '@/lib/format';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Group } from '@/components/kit';
import { Button, ButtonRow, Card, Header, Row, Screen, Sheet, T, Toggle, useToast } from '@/components/ui';
import { apiConfigured, forgetSession, hasSession, request } from '@/lib/api';
import { plannerState, useApp } from '@/store';
import { useColors } from '@/theme';

/** Privacy and memory: what Ugent remembers, what it may do, and how to remove it. */
export default function Privacy() {
  const c = useColors();
  const toast = useToast();
  const state = useApp();
  const s = state.settings;
  const [known, setKnown] = useState(false);
  const [forget, setForget] = useState<null | 'chats' | 'habits' | 'places'>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const hasSamples = state.tasks.some((x) => x.sample) || state.events.some((e) => e.sample);
  const routines = s.learn ? detectRoutines(state.events, new Date()) : [];

  const sw = (title: string, sub: string, value: boolean, onChange: (v: boolean) => void) =>
    <Row title={title} sub={sub} right={<Toggle value={value} onChange={onChange} label={title} />} />;

  const deleteEverything = async () => {
    setDeleting(true);
    try {
      if (apiConfigured() && hasSession()) await request('DELETE', '/api/me');
      await forgetSession();
      state.resetAll();
      toast('All your data is deleted');
    } catch {
      toast('Could not reach the server to delete your account. Connect to the internet and try again.');
    } finally { setDeleting(false); setConfirmDelete(false); }
  };

  return (
    <Screen>
      <Header back title="Privacy and memory" />
      <Card tint style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Icon name="lock" color={c.skyInk} />
        <T v="small" style={{ flex: 1 }}>Your data lives on this phone. {apiConfigured() ? "When online, plans are backed up to your account and chat can use Ugent's AI. Ugent never sells your data, shows ads or trains AI on it." : 'Nothing is sent anywhere.'}</T>
      </Card>

      <Group title="What Ugent remembers">
        <Row icon="chat" title="Chat history" sub={`${state.messages.length} messages`} right={<T v="small" color={c.danger}>Clear</T>} onPress={() => setForget('chats')} />
        <Row icon="chart" title="Habits" sub={`${state.log.completions.length} finished-task times, ${state.log.energy.length} energy check-ins, people and places`} right={<T v="small" color={c.danger}>Clear</T>} onPress={() => setForget('habits')} />
        <Row icon="pin" title="Places" sub={state.places.home || state.places.work ? [state.places.home && 'Home', state.places.work && 'Work'].filter(Boolean).join(', ') : 'None saved'} right={<T v="small" color={c.danger}>Clear</T>} onPress={() => setForget('places')} />
        <Row icon="eye" title="See everything Ugent knows" chevron onPress={() => setKnown(true)} />
        <Row icon="heart" title="Edit memory and preferences" sub="Notes, people, routines, reply style" chevron onPress={() => router.push('/memory')} />
      </Group>

      <Group title="What Ugent has learned about you" note="Ugent uses these to make answers personal. Tap any item to delete it.">
        {state.memory.notes.length === 0 && Object.keys(state.memory.people).length === 0 && Object.keys(state.memory.places).length === 0 && routines.length === 0 ? (
          <Row title="Nothing yet" sub='Say "Remember that…" in chat or Live, and Ugent learns as you call, message and plan.' />
        ) : null}
        {state.memory.notes.map((n) => <Row key={n.id} icon="info" title={n.text} sub="You asked Ugent to remember this" right={<Icon name="x" color={c.muted} size={18} />} onPress={() => { state.forgetNote(n.id); toast('Forgotten'); }} />)}
        {Object.entries(state.memory.people).sort((a, b) => b[1].count - a[1].count).slice(0, 10).map(([k, p]) => (
          <Row key={k} icon="user" title={p.name} sub={`Called or messaged ${p.count} time${p.count > 1 ? 's' : ''}${p.phone ? ' · number saved' : ''}`} right={<Icon name="x" color={c.muted} size={18} />} onPress={() => { state.forgetPerson(k); toast('Forgotten'); }} />
        ))}
        {Object.entries(state.memory.places).sort((a, b) => b[1].count - a[1].count).slice(0, 8).map(([k, p]) => (
          <Row key={k} icon="pin" title={p.name} sub={`Visited ${p.count} time${p.count > 1 ? 's' : ''}`} right={<Icon name="x" color={c.muted} size={18} />} onPress={() => { state.forgetPlace(k); toast('Forgotten'); }} />
        ))}
        {routines.map((r) => <Row key={`${r.title}-${r.weekday}`} icon="sync" title={r.title} sub={`Usually ${weekdayName(r.weekday)}s around ${fmtTime(state.profile.lang)(r.start)} · learned from your plans`} />)}
      </Group>

      <Group title="Memory">
        {sw('Learn from me', 'Your best time, routines, the people you contact and places you go.', s.learn, (v) => state.setSettings({ learn: v }))}
        {sw('Remember my chats', 'Off: chats are cleared each time Ugent closes.', s.rememberChats, (v) => state.setSettings({ rememberChats: v }))}
      </Group>

      <Group title="Control">
        {sw('Ask before taking actions', 'Shows what it will do and waits for your OK.', s.askBeforeAction, (v) => state.setSettings({ askBeforeAction: v }))}
        {apiConfigured() ? sw('Smarter answers when online', "Sends your message and today's plan to Ugent's AI. Off: chat stays on the phone.", s.cloudChat, (v) => state.setSettings({ cloudChat: v })) : null}
      </Group>

      <Group title="Your data">
        <Row icon="copy" title="Copy all my data" chevron onPress={async () => {
          const { profile, settings, tasks, events, log, messages, places } = useApp.getState();
          await Clipboard.setStringAsync(JSON.stringify({ profile, settings, tasks, events, log, messages, places }, null, 2));
          toast('All your data is copied');
        }} />
        {hasSamples && <Row icon="trash" title="Clear the sample day" onPress={() => { state.clearSamples(); toast('Sample day cleared'); }} />}
        <Row icon="trash" title="Delete my account and data" danger onPress={() => setConfirmDelete(true)} />
      </Group>

      <Sheet visible={!!forget} onClose={() => setForget(null)} title={forget === 'chats' ? 'Clear chat history?' : forget === 'habits' ? 'Clear habits?' : 'Clear places?'}>
        <T muted>{forget === 'habits' ? 'Ugent will go back to the best time you chose until it learns again.' : 'This cannot be undone.'}</T>
        <ButtonRow>
          <Button kind="danger" label="Clear" style={{ flexGrow: 1 }} onPress={() => {
            if (forget === 'chats') state.forgetChats(); else if (forget === 'habits') state.forgetHabits(); else state.setPlaces({ home: '', work: '' });
            setForget(null); toast('Cleared');
          }} />
          <Button kind="ghost" label="Keep" style={{ flexGrow: 1 }} onPress={() => setForget(null)} />
        </ButtonRow>
      </Sheet>

      <Sheet visible={known} onClose={() => setKnown(false)} title="What Ugent knows">
        <Group>
          {[
            ['Name', state.profile.name || 'Not set'],
            ['Language', langMeta(state.profile.lang).native],
            ['Best time you chose', state.profile.peak],
            ['Best time Ugent learned', s.learn ? bestTime(plannerState(state), new Date()) : 'Learning is off'],
            ['Tasks', String(state.tasks.filter((x) => !x.deleted).length)],
            ['Plans', String(state.events.filter((e) => !e.deleted && !e.external).length)],
            ['Imported calendar events', String(state.events.filter((e) => e.external).length)],
            ['Chat messages', String(state.messages.length)],
            ['Connected apps', String(Object.values(state.connections).filter((x) => x?.on).length + state.cloud.filter((x) => x.connected).length)],
          ].map(([k, v]) => <Row key={k} title={k} right={<T v="strong">{v}</T>} />)}
        </Group>
        <Button kind="ghost" label="Close" onPress={() => setKnown(false)} />
      </Sheet>

      <Sheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete your account and data?">
        <T muted>This removes your tasks, plans, chats, habits and connections from this phone{apiConfigured() ? " and from Ugent's servers" : ''}. You cannot undo it. An active subscription is not cancelled; manage it in your app store.</T>
        <ButtonRow>
          <Button kind="danger" label={deleting ? 'Deleting…' : 'Delete everything'} disabled={deleting} style={{ flexGrow: 1 }} onPress={() => void deleteEverything()} />
          <Button kind="ghost" label="Keep my data" style={{ flexGrow: 1 }} onPress={() => setConfirmDelete(false)} />
        </ButtonRow>
      </Sheet>
      <View />
    </Screen>
  );
}
