import { norm } from '@ugent/core';
import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import type { IconName } from '@/components/Icon';
import { EmptyState, Group } from '@/components/kit';
import { Chip, Field, Header, Row, Screen, T } from '@/components/ui';
import { useLang } from '@/hooks';
import { dayWord, fmtStamp, fmtTime } from '@/lib/format';
import { liveEvents, liveTasks, useApp } from '@/store';

type Scope = 'all' | 'tasks' | 'plans' | 'notes' | 'chat';
type Kind = Exclude<Scope, 'all'> | 'settings';
type Hit = { key: string; scope: Kind; icon: IconName; title: string; sub: string; go: () => void };

/** Screens people look for by name ("dark mode", "language", "delete account"). */
const SCREENS: [string, string, IconName, Href][] = [
  ['Appearance and themes', 'dark mode black white colour', 'sun', '/appearance'],
  ['Language', 'pidgin yoruba igbo hausa french english', 'chat', '/language'],
  ['Notifications', 'reminders alerts quiet', 'bell', '/notifications'],
  ['Memory and preferences', 'remember learned people routines', 'heart', '/memory'],
  ['Privacy and data', 'delete account clear history export', 'lock', '/privacy'],
  ['Connected apps', 'whatsapp google calendar gmail maps contacts sms notion', 'link', '/connections'],
  ['Plans and pricing', 'pro team upgrade subscription cancel', 'tag', '/pricing'],
  ['Your week', 'analytics insights stats', 'chart', '/analytics'],
  ['Offline mode', 'sync data network', 'wifiOff', '/offline'],
  ['Me AI ecosystem', 'sleek domestica afrika idd', 'more', '/ecosystem'],
  ['Help and support', 'contact faq problem', 'info', '/help'],
];

const snippet = (text: string, q: string) => {
  const i = norm(text).indexOf(q);
  if (i < 0 || text.length <= 90) return text.slice(0, 90);
  const from = Math.max(0, i - 30);
  return `${from ? '…' : ''}${text.slice(from, from + 90)}…`;
};

/** One search box for tasks, plans, notes, memory, chat and settings. Works offline. */
export default function Search() {
  const lang = useLang();
  const state = useApp();
  const [text, setText] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const q = norm(text.trim());
  const f = fmtTime(lang);

  const hits = useMemo<Hit[]>(() => {
    if (q.length < 2) return [];
    const has = (...parts: (string | null | undefined)[]) => parts.some((p) => p && norm(p).includes(q));
    const out: Hit[] = [];
    for (const t of liveTasks(state)) if (has(t.title)) out.push({ key: `t${t.id}`, scope: 'tasks', icon: 'tasks', title: t.title, sub: `${t.done ? 'Done' : 'Task'} · ${dayWord(t.date, lang)}`, go: () => router.navigate('/tasks') });
    for (const e of liveEvents(state)) if (has(e.title, e.location)) out.push({ key: `e${e.id}`, scope: 'plans', icon: 'calendar', title: e.title, sub: `${dayWord(e.date, lang)}, ${f(e.start)}${e.location ? ` · ${e.location}` : ''}`, go: () => router.push(`/event/${e.id}`) });
    for (const n of state.notes) if (has(n.text)) out.push({ key: `n${n.id}`, scope: 'notes', icon: 'info', title: snippet(n.text, q), sub: `Note · ${fmtStamp(n.at, lang)}`, go: () => router.navigate({ pathname: '/tasks', params: { tab: 'notes' } }) });
    for (const n of state.memory.notes) if (has(n.text)) out.push({ key: `m${n.id}`, scope: 'notes', icon: 'heart', title: snippet(n.text, q), sub: 'Ugent remembers this', go: () => router.push('/memory') });
    for (const [k, p] of Object.entries(state.memory.people)) if (has(p.name)) out.push({ key: `p${k}`, scope: 'notes', icon: 'user', title: p.name, sub: `Person · ${p.count} contact${p.count > 1 ? 's' : ''}`, go: () => router.push('/memory') });
    for (const m of [...state.messages].reverse()) if (has(m.text)) out.push({ key: `c${m.id}`, scope: 'chat', icon: 'chat', title: snippet(m.text, q), sub: m.from === 'me' ? 'You said' : 'Ugent said', go: () => router.navigate('/chat') });
    for (const [title, words, icon, href] of SCREENS) if (has(title, words)) out.push({ key: `s${title}`, scope: 'settings', icon, title, sub: 'Setting', go: () => router.push(href) });
    return out;
  }, [q, state, lang, f]);

  const shown = scope === 'all' ? hits : hits.filter((h) => h.scope === scope);
  const count = (s: Kind) => hits.filter((h) => h.scope === s).length;
  const groups: [string, Hit[]][] = scope === 'all'
    ? ([['Tasks', 'tasks'], ['Plans', 'plans'], ['Notes and memory', 'notes'], ['Chat', 'chat'], ['Settings', 'settings']] as [string, Kind][]).map(([l, s]) => [l, hits.filter((h) => h.scope === s)])
    : [['', shown]];

  return (
    <Screen>
      <Header back title="Search" />
      <Field value={text} onChangeText={setText} autoFocus placeholder="Tasks, plans, notes, people, chats" accessibilityLabel="Search" returnKeyType="search" />
      {q.length >= 2 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label={`All ${hits.length}`} on={scope === 'all'} onPress={() => setScope('all')} />
          {([['tasks', 'Tasks'], ['plans', 'Plans'], ['notes', 'Notes'], ['chat', 'Chat']] as [Exclude<Scope, 'all'>, string][]).map(([s, l]) =>
            <Chip key={s} label={`${l} ${count(s)}`} on={scope === s} onPress={() => setScope(s)} />)}
        </View>
      )}
      {q.length < 2 ? (
        <EmptyState icon="search" title="Find anything" body="Search your tasks, plans, notes, the people Ugent knows, past chats and settings. It works offline." />
      ) : shown.length === 0 ? (
        <EmptyState icon="search" title={`Nothing for "${text.trim()}"`} body="Try a shorter word, or ask Ugent in chat." action={{ label: 'Ask Ugent', onPress: () => router.navigate('/chat') }} />
      ) : (
        groups.filter(([, l]) => l.length).map(([label, list]) => (
          <Group key={label || 'results'} title={label || undefined}>
            {list.slice(0, 20).map((h) => <Row key={h.key} icon={h.icon} title={h.title} sub={h.sub} chevron onPress={h.go} />)}
            {list.length > 20 && <T v="small" muted>and {list.length - 20} more</T>}
          </Group>
        ))
      )}
    </Screen>
  );
}
