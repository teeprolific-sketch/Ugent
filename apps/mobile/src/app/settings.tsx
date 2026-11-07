import type { Lang, Peak } from '@ugent/core';
import { bestTime, LANG_META, langMeta } from '@ugent/core';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Button, ButtonRow, Card, Field, Header, List, Row, Screen, Section, Segmented, Sheet, T, Toggle, useToast } from '@/components/ui';
import { apiConfigured, forgetSession, hasSession, request } from '@/lib/api';
import { askNotificationPermission } from '@/lib/notifications';
import { syncNow } from '@/lib/sync';
import { plannerState, useApp } from '@/store';
import { font, useColors } from '@/theme';

export default function Settings() {
  const c = useColors();
  const toast = useToast();
  const state = useApp();
  const { profile, settings } = state;
  const [name, setName] = useState(profile.name);
  const [langOpen, setLangOpen] = useState(false);
  const [known, setKnown] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const hasSamples = state.tasks.some((x) => x.sample) || state.events.some((e) => e.sample);

  const toggle = (label: string, sub: string, value: boolean, onChange: (v: boolean) => void) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}>
      <View style={{ flex: 1, gap: 2 }}><T v="strong">{label}</T><T v="small" muted>{sub}</T></View>
      <Toggle value={value} onChange={onChange} label={label} />
    </View>
  );

  const deleteEverything = async () => {
    setDeleting(true);
    try {
      if (apiConfigured() && hasSession()) await request('DELETE', '/api/me');
      await forgetSession();
      state.resetAll();
      toast('All your data is deleted');
    } catch {
      toast('Could not reach the server to delete your account. Connect to the internet and try again.');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const lastSync = state.sync.lastAt ? new Date(state.sync.lastAt).toLocaleString() : null;
  return (
    <Screen>
      <Header back title="Settings and privacy" />

      <Section title="You">
        <Field label="Name" value={name} onChangeText={setName} onBlur={() => { state.setProfile({ name: name.trim() }); }} autoComplete="given-name" />
        <View style={{ gap: 6 }}>
          <T v="small" style={{ fontFamily: font.semibold }}>Language</T>
          <Row title={langMeta(profile.lang).native} sub={langMeta(profile.lang).name} chevron onPress={() => setLangOpen(true)} />
        </View>
        <View style={{ gap: 6 }}>
          <T v="small" style={{ fontFamily: font.semibold }}>Best time of day</T>
          <Segmented value={profile.peak} onChange={(p: Peak) => state.setProfile({ peak: p })} options={[['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening']]} />
        </View>
      </Section>

      <Section title="Ugent">
        <List>
          {toggle('Speak replies out loud', 'Ugent reads its answers to you.', settings.voiceReplies, (v) => state.setSettings({ voiceReplies: v }))}
          {toggle('Reminders', 'A notification 10 minutes before each plan.', settings.reminders, async (v) => {
            if (v && !(await askNotificationPermission())) { toast('Allow notifications for Ugent in your phone settings first.'); return; }
            state.setSettings({ reminders: v });
          })}
          {toggle('Low data mode', 'Chat runs on your phone only. Nothing is downloaded.', settings.lowData, (v) => state.setSettings({ lowData: v }))}
        </List>
        <View style={{ gap: 6 }}>
          <T v="small" style={{ fontFamily: font.semibold }}>Focus length</T>
          <Segmented value={settings.focusMins} onChange={(m: number) => state.setSettings({ focusMins: m })} options={[[25, '25 min'], [50, '50 min'], [90, '90 min']]} />
        </View>
      </Section>

      <Section title="Privacy">
        <Card tint style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="lock" color={c.skyInk} />
          <T v="small" style={{ flex: 1 }}>
            Your data lives on this phone and works offline. {apiConfigured() ? 'When online, your plans are backed up to your Ugent account, and chat messages are sent to Ugent\'s AI to reply. Ugent never sells your data or uses it for ads.' : 'Nothing is sent anywhere.'}
          </T>
        </Card>
        <List>
          {toggle('Learn from my habits', 'Ugent notes when you finish tasks to find your best time.', settings.learn, (v) => state.setSettings({ learn: v }))}
          {toggle('Ask before taking actions', 'Ugent shows what it will do and waits for your OK.', settings.askBeforeAction, (v) => state.setSettings({ askBeforeAction: v }))}
          <Row icon="eye" title="See what Ugent knows about me" chevron onPress={() => setKnown(true)} />
          <Row icon="copy" title="Copy all my data" chevron onPress={async () => {
            const { profile: p, settings: s, tasks, events, log, messages } = useApp.getState();
            await Clipboard.setStringAsync(JSON.stringify({ profile: p, settings: s, tasks, events, log, messages }, null, 2));
            toast('All your data is copied');
          }} />
          {hasSamples && <Row icon="trash" title="Clear the sample day" onPress={() => { state.clearSamples(); toast('Sample day cleared'); }} />}
          <Row icon="trash" title="Delete my account and data" danger onPress={() => setConfirmDelete(true)} />
        </List>
      </Section>

      {apiConfigured() && (
        <Section title="Backup">
          <Row icon="sync" title="Sync now" sub={lastSync ? `Last synced ${lastSync}` : 'Not synced yet'} onPress={async () => { await syncNow(); toast(useApp.getState().sync.lastAt ? 'Synced' : 'Could not reach the server. Your changes are saved on this phone.'); }} />
        </Section>
      )}

      <Sheet visible={langOpen} onClose={() => setLangOpen(false)} title="Language">
        <List>
          {LANG_META.map((l) => (
            <Row key={l.code} title={l.native} sub={l.native !== l.name ? l.name : undefined}
              right={l.code === profile.lang ? <Icon name="check" color={c.sky} /> : undefined}
              onPress={() => { state.setProfile({ lang: l.code as Lang }); setLangOpen(false); toast(`Language: ${l.native}`); }} />
          ))}
        </List>
        <T v="small" muted>Voice input for Yoruba, Igbo and Hausa depends on your phone's speech support.</T>
      </Sheet>

      <Sheet visible={known} onClose={() => setKnown(false)} title="What Ugent knows">
        <T v="small" muted>All of this is stored on your phone{apiConfigured() ? ', and your tasks and plans are backed up to your account' : ''}.</T>
        <List>
          {[
            ['Name', profile.name || 'Not set'],
            ['Language', langMeta(profile.lang).native],
            ['Best time you chose', profile.peak],
            ['Best time Ugent learned', settings.learn ? bestTime(plannerState(state), new Date()) : 'Learning is off'],
            ['Tasks', String(state.tasks.filter((x) => !x.deleted).length)],
            ['Plans', String(state.events.filter((e) => !e.deleted).length)],
            ['Chat messages', String(state.messages.length)],
            ['Finished-task times noted', String(state.log.completions.length)],
            ['Energy check-ins', String(state.log.energy.length)],
          ].map(([k, v]) => <Row key={k} title={k} right={<T v="strong">{v}</T>} />)}
        </List>
        <Button kind="ghost" label="Close" onPress={() => setKnown(false)} />
      </Sheet>

      <Sheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete your account and data?">
        <T muted>This removes your tasks, plans, chats and habits from this phone{apiConfigured() ? ' and from Ugent\'s servers' : ''}. You cannot undo it. An active subscription is not cancelled; manage it in your app store.</T>
        <ButtonRow>
          <Button kind="danger" label={deleting ? 'Deleting…' : 'Delete everything'} disabled={deleting} style={{ flexGrow: 1 }} onPress={() => void deleteEverything()} />
          <Button kind="ghost" label="Keep my data" style={{ flexGrow: 1 }} onPress={() => setConfirmDelete(false)} />
        </ButtonRow>
      </Sheet>
    </Screen>
  );
}
