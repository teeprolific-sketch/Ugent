import type { Action } from '@ugent/core';
import { extractTitle, fmtDate, kindOf, norm, parseTime, respond, fromMin, addDays, suggestSlot } from '@ugent/core';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLang } from '@/hooks';
import { dayWord, fmtDur, fmtTime } from '@/lib/format';
import { useVoiceInput } from '@/lib/voice';
import { plannerState, useApp } from '@/store';
import { useColors } from '@/theme';
import { Icon } from './Icon';
import { Button, Field, Segmented, Sheet, T, useToast } from './ui';

type Kind = 'auto' | 'task' | 'plan' | 'note';
type Draft = { kind: 'task'; title: string; date: string } | { kind: 'plan'; action: Extract<Action, { type: 'addEvent' }> } | { kind: 'note'; text: string };

const TOMORROW = /\b(tomorrow|tmrw|tmr|demain|lola|echi|gobe)\b/;

/** Works out what the person meant: a task, a timed plan, or just a note. */
function understand(text: string, kind: Kind): Draft | null {
  const raw = text.trim();
  if (!raw) return null;
  const s = useApp.getState();
  const now = new Date();
  const n = norm(raw);
  if (kind === 'note') return { kind: 'note', text: raw };
  if (kind === 'auto') {
    const r = respond(raw, plannerState(s), { lang: s.profile.lang, now, fmtTime: fmtTime(s.profile.lang) });
    const a = r.actions[0];
    if (a?.type === 'addEvent') return { kind: 'plan', action: a };
    if (a?.type === 'addTask') return { kind: 'task', title: a.title, date: a.date };
    // A short line with no verb of doing is most likely a note.
    return /\b(remind|call|buy|pay|send|book|meet|finish|fix|collect|pick|visit|go|check|write|clean|order|renew)\b/.test(n)
      ? { kind: 'task', title: extractTitle(raw) || raw, date: TOMORROW.test(n) ? addDays(fmtDate(now), 1) : fmtDate(now) }
      : { kind: 'note', text: raw };
  }
  const title = extractTitle(raw) || raw;
  const date = TOMORROW.test(n) ? addDays(fmtDate(now), 1) : fmtDate(now);
  if (kind === 'task') return { kind: 'task', title, date };
  const k = kindOf(n);
  const dur = k === 'meeting' ? 60 : k === 'deep' ? 90 : 30;
  const tm = parseTime(n);
  const slot = tm !== null ? { date, start: fromMin(tm) } : suggestSlot(plannerState(s), k, dur, now, date);
  return { kind: 'plan', action: { type: 'addEvent', title, date: slot.date, start: slot.start, dur, kind: k } };
}

/** Very fast capture: type or speak, see what Ugent understood, save with one tap. */
export function QuickCaptureSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const lang = useLang();
  const toast = useToast();
  const [text, setText] = useState('');
  const [kind, setKind] = useState<Kind>('auto');
  const voice = useVoiceInput(lang, (t) => setText((x) => (x ? `${x} ${t}` : t)), (msg) => toast(msg));
  const draft = understand(voice.listening && voice.partial ? voice.partial : text, kind);
  const f = fmtTime(lang);

  const save = () => {
    if (!draft) return;
    const s = useApp.getState();
    s.snapshot();
    if (draft.kind === 'task') { s.addTask(draft.title, draft.date); toast(`Task added: ${draft.title}`, s.restore); }
    else if (draft.kind === 'plan') { const a = draft.action; s.addEvent({ title: a.title, date: a.date, start: a.start, dur: a.dur, kind: a.kind, fixed: false, needsPower: a.kind === 'deep' || a.kind === 'meeting' }); toast(`Planned: ${a.title}, ${dayWord(a.date, lang)} ${f(a.start)}`, s.restore); }
    else { s.addNote(draft.text); toast('Note saved'); }
    setText('');
    onClose();
  };

  const preview = !draft ? null
    : draft.kind === 'task' ? { icon: 'tasks' as const, line: `New task: ${draft.title}`, sub: dayWord(draft.date, lang) }
    : draft.kind === 'plan' ? { icon: 'calendar' as const, line: `New plan: ${draft.action.title}`, sub: `${dayWord(draft.action.date, lang)}, ${f(draft.action.start)} · ${fmtDur(draft.action.dur)}` }
    : { icon: 'info' as const, line: 'Note', sub: draft.text };

  return (
    <Sheet visible={visible} onClose={onClose} title="Quick capture">
      <Segmented value={kind} onChange={setKind} options={[['auto', 'Auto'], ['task', 'Task'], ['plan', 'Plan'], ['note', 'Note']]} />
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Field value={voice.listening ? voice.partial || text : text} onChangeText={setText} autoFocus multiline
            placeholder={'e.g. "Remind me to call the landlord tomorrow"'} accessibilityLabel="What do you want to capture?"
            style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 14 }} />
        </View>
        <Pressable onPress={() => void voice.toggle()} accessibilityRole="button" accessibilityLabel={voice.listening ? 'Stop listening' : 'Speak instead'}
          style={{ width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: voice.listening ? c.danger : c.surface }}>
          <Icon name="mic" color={voice.listening ? '#FFFFFF' : c.heading} />
        </Pressable>
      </View>
      {preview && (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: c.surface2, borderRadius: 14, padding: 14 }}>
          <Icon name={preview.icon} color={c.skyInk} />
          <View style={{ flex: 1 }}>
            <T v="strong">{preview.line}</T>
            <T v="small" muted numberOfLines={2}>{preview.sub}</T>
          </View>
        </View>
      )}
      <Button label="Save" disabled={!draft || voice.listening} onPress={save} />
    </Sheet>
  );
}

/** The round "+" button above the tab bar. */
export function CaptureButton() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Quick capture: add a task, plan or note"
        style={({ pressed }) => ({ position: 'absolute', right: 20 + insets.right, bottom: 20, width: 58, height: 58, borderRadius: 29, backgroundColor: c.sky, alignItems: 'center', justifyContent: 'center',
          shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
        <Icon name="plus" color={c.onSky} size={28} strokeWidth={2.4} />
      </Pressable>
      <QuickCaptureSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
