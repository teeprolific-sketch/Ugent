import type { Action, Move, Reason, Task } from '@ugent/core';
import { computeReschedule, fmtDate, lateMessage } from '@ugent/core';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { useLang } from '@/hooks';
import { dayWord, fmtDur, fmtTime } from '@/lib/format';
import { plannerState, useApp } from '@/store';
import { useColors } from '@/theme';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { Button, ButtonRow, Check, IconButton, List, Pill, Row, Sheet, T, useToast } from './ui';

export function TaskRow({ task, onMenu }: { task: Task; onMenu?: () => void }) {
  const c = useColors();
  const lang = useLang();
  const toggle = useApp((s) => s.toggleTask);
  const toast = useToast();
  const d0 = fmtDate(new Date());
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, minHeight: 56 }}>
      <Check on={task.done} label={`${task.done ? 'Mark not done' : 'Mark done'}: ${task.title}`}
        onPress={() => { const done = toggle(task.id); if (done) toast(`Done: ${task.title}`, () => toggle(task.id)); }} />
      <View style={{ flex: 1, gap: 6 }}>
        <T v="strong" style={task.done ? { textDecorationLine: 'line-through', color: c.muted } : undefined}>{task.title}</T>
        {(task.important || task.date !== d0) && (
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {task.important && <Pill label="Important" icon="star" tone="sky" />}
            {task.date !== d0 && <Pill label={task.date < d0 ? 'Overdue' : dayWord(task.date, lang)} />}
          </View>
        )}
      </View>
      {onMenu && <IconButton icon="dots" label={`Options for ${task.title}`} onPress={onMenu} />}
    </View>
  );
}

export function moveLine(m: Move, lang: ReturnType<typeof useLang>) {
  const f = fmtTime(lang);
  return `${f(m.from)} → ${m.toDate !== m.fromDate ? dayWord(m.toDate, lang) + ', ' : ''}${f(m.to)}`;
}

/** One line per proposed action, shown in chat before the user agrees. */
const ECO_NAME = { sleek: 'Sleek', domestica: 'Domestica I', afrika: 'Afrika I' } as const;

export function ActionLines({ actions }: { actions: Action[] }) {
  const c = useColors();
  const lang = useLang();
  const f = fmtTime(lang);
  const line = (icon: IconName, text: string, key: string) => (
    <View key={key} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={{ paddingTop: 1 }}><Icon name={icon} color={c.skyInk} size={18} /></View>
      <T v="small" style={{ flex: 1 }}>{text}</T>
    </View>
  );
  return (
    <View style={{ gap: 8 }}>
      {actions.flatMap((a, i) => {
        if (a.type === 'addTask') return [line('tasks', `New task: ${a.title}${a.date !== fmtDate(new Date()) ? ` · ${dayWord(a.date, lang)}` : ''}`, `${i}`)];
        if (a.type === 'addEvent') return [line('calendar', `${a.title} · ${dayWord(a.date, lang)}, ${f(a.start)} · ${fmtDur(a.dur)}`, `${i}`)];
        if (a.type === 'focus') return [line('focus', `Focus for ${a.mins} minutes`, `${i}`)];
        if (a.type === 'reschedule') return a.moves.map((m, j) => line('clock', `${m.title}: ${moveLine(m, lang)}`, `${i}-${j}`));
        if (a.type === 'moveEvent') return [line('clock', `${a.move.title}: ${moveLine(a.move, lang)}`, `${i}`)];
        if (a.type === 'completeTask') return [line('check', `Mark done: ${a.title}`, `${i}`)];
        if (a.type === 'call') return [line('chat', `Call ${a.name}${a.phone ? ` (${a.phone})` : ''}`, `${i}`)];
        if (a.type === 'message') return [line('send', `${a.channel === 'sms' ? 'SMS' : 'WhatsApp'} to ${a.name ?? 'someone'}: "${a.text}"`, `${i}`)];
        if (a.type === 'directions') return [line('car', `Directions to ${a.destination} in Google Maps`, `${i}`)];
        if (a.type === 'remember') return [line('info', `Remember: ${a.text}`, `${i}`)];
        if (a.type === 'ecosystem') return [line(a.product === 'sleek' ? 'wrench' : a.product === 'domestica' ? 'robot' : 'leaf',
          `${ECO_NAME[a.product]}: ${a.detail}${a.date ? ` · ${dayWord(a.date, lang)}${a.start ? `, ${f(a.start)}` : ''}` : ''}`, `${i}`)];
        return [];
      })}
    </View>
  );
}

/** A message the user can send on WhatsApp or copy. Ugent never sends it by itself. */
export function DraftBlock({ text, intro }: { text: string; intro?: string }) {
  const c = useColors();
  const toast = useToast();
  return (
    <View style={{ gap: 10 }}>
      {intro ? <T v="small" muted>{intro}</T> : null}
      <View style={{ backgroundColor: c.surface, borderRadius: 12, padding: 12 }}><T v="small" selectable>{text}</T></View>
      <ButtonRow>
        <Button compact label="WhatsApp" icon="send" style={{ flexGrow: 1 }}
          onPress={() => Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`).catch(() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`))} />
        <Button compact kind="ghost" label="Copy" icon="copy" style={{ flexGrow: 1 }}
          onPress={async () => { await Clipboard.setStringAsync(text); toast('Copied'); }} />
      </ButtonRow>
    </View>
  );
}

export const REASONS: [Reason, string, string, IconName][] = [
  ['traffic', 'Stuck in traffic', 'Push the next few hours back 45 minutes', 'car'],
  ['power', 'Power is out', 'Move work that needs power to later', 'bolt'],
  ['late', 'Running late', 'Push the next few hours back 30 minutes', 'clock'],
  ['tired', 'Feeling tired', 'Move heavy work to your best time tomorrow', 'moon'],
  ['emergency', 'Family emergency', 'Move the rest of today to tomorrow', 'heart'],
];

/** "Plans changed?": pick what happened, see the new plan, confirm. */
export function PlansChangedSheet({ visible, onClose, initial }: { visible: boolean; onClose: () => void; initial?: Reason | null }) {
  const lang = useLang();
  const toast = useToast();
  const state = useApp();
  const [reason, setReason] = useStateSync(initial ?? null, visible);
  const preview = reason ? computeReschedule(plannerState(state), reason, new Date()) : null;
  const label = reason ? REASONS.find((r) => r[0] === reason)![1] : 'What happened?';

  return (
    <Sheet visible={visible} onClose={onClose} title={label}>
      {!reason && (
        <>
          <T v="small" muted>Fixed-time plans stay where they are. Ugent moves the rest.</T>
          <List>{REASONS.map(([v, l, d, ic]) => <Row key={v} icon={ic} title={l} sub={d} chevron onPress={() => setReason(v)} />)}</List>
        </>
      )}
      {reason && preview && (
        preview.moves.length === 0 && !preview.fixedSoon ? (
          <>
            <T muted>There is nothing left to move today.</T>
            <Button kind="ghost" label="Close" onPress={onClose} />
          </>
        ) : (
          <>
            {preview.moves.length > 0 && (
              <>
                <T muted>Here is the new plan:</T>
                <List>{preview.moves.map((m) => <Row key={m.id} title={m.title} sub={moveLine(m, lang)} />)}</List>
              </>
            )}
            {preview.fixedSoon && <DraftBlock intro={`"${preview.fixedSoon.title}" has a fixed time. Let them know:`} text={lateMessage(reason, preview.fixedSoon)} />}
            <ButtonRow>
              {preview.moves.length > 0 && (
                <Button label={`Move ${preview.moves.length} plan${preview.moves.length > 1 ? 's' : ''}`} style={{ flexGrow: 1 }} onPress={() => {
                  state.snapshot();
                  state.applyReschedule(reason, preview.moves);
                  onClose();
                  toast(`Moved ${preview.moves.length} plan${preview.moves.length > 1 ? 's' : ''}`, state.restore);
                }} />
              )}
              <Button kind="ghost" label="Cancel" style={{ flexGrow: 1 }} onPress={onClose} />
            </ButtonRow>
          </>
        )
      )}
    </Sheet>
  );
}

/** State that resets to `initial` each time the sheet opens. */
function useStateSync<V>(initial: V, visible: boolean): [V, (v: V) => void] {
  const [v, setV] = useState(initial);
  useEffect(() => { if (visible) setV(initial); }, [visible, initial]);
  return [v, setV];
}
