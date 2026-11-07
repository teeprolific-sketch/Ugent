import type { Kind, PlanEvent } from '@ugent/core';
import { addDays, fmtDate, KINDS, minOfDay, parseDate, suggestSlot, toMin } from '@ugent/core';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { PlansChangedSheet } from '@/components/blocks';
import { TimeField } from '@/components/TimeField';
import { Button, ButtonRow, Field, Header, List, Pill, Row, Screen, Segmented, Sheet, T, Toggle, useToast } from '@/components/ui';
import { useLang, useNow } from '@/hooks';
import { dayWord, fmtDay, fmtDur, fmtTime, KIND_LABEL } from '@/lib/format';
import { liveEvents, plannerState, useApp } from '@/store';
import { font, radius, useColors } from '@/theme';

export default function Schedule() {
  const c = useColors();
  const lang = useLang();
  const now = useNow();
  const toast = useToast();
  const state = useApp();
  const d0 = fmtDate(now);
  const [day, setDay] = useState(d0);
  const [plans, setPlans] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const shown = day < d0 ? d0 : day;
  const days = Array.from({ length: 7 }, (_, i) => addDays(d0, i));
  const evs = useMemo(() => liveEvents(state).filter((e) => e.date === shown).sort((a, b) => a.start.localeCompare(b.start)), [state, shown]);
  const nowM = minOfDay(now);
  const f = fmtTime(lang);
  const open = evs.find((e) => e.id === openId) ?? null;

  const nowLine = (key: string) => (
    <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessibilityLabel="Now">
      <T v="small" color={c.skyInk} style={{ width: 76, fontFamily: font.bold }}>Now</T>
      <View style={{ flex: 1, height: 2, borderRadius: 2, backgroundColor: c.sky }} />
    </View>
  );
  const items: React.ReactNode[] = [];
  let nowShown = shown !== d0;
  for (const e of evs) {
    if (!nowShown && toMin(e.start) > nowM) { items.push(nowLine('now')); nowShown = true; }
    const past = shown === d0 && toMin(e.start) + e.dur <= nowM;
    items.push(
      <View key={e.id} style={{ flexDirection: 'row', gap: 12, opacity: past ? 0.55 : 1 }}>
        <T v="small" muted style={{ width: 76, paddingTop: 14, fontFamily: font.semibold }}>{f(e.start)}</T>
        <Pressable onPress={() => setOpenId(e.id)} accessibilityRole="button" accessibilityLabel={`${e.title} at ${f(e.start)}`}
          style={{ flex: 1, backgroundColor: c.surface, borderRadius: radius.md, padding: 14, gap: 8 }}>
          <T v="strong">{e.title}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <T v="small" muted>{fmtDur(e.dur)}</T>
            <Pill label={KIND_LABEL[e.kind]} tone="onCard" />
            {e.fixed && <Pill label="Fixed" icon="lock" tone="onCard" />}
            {e.needsPower && <Pill label="Needs power" icon="bolt" tone="onCard" />}
            {e.teamId && <Pill label="Team" icon="users" tone="onCard" />}
          </View>
        </Pressable>
      </View>,
    );
  }
  if (!nowShown && evs.length) items.push(nowLine('now-end'));

  return (
    <Screen>
      <Header title="Schedule" sub={fmtDay(shown, lang, { weekday: 'long', day: 'numeric', month: 'long' })} />
      <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="tablist">
        {days.map((d) => {
          const on = d === shown;
          return (
            <Pressable key={d} onPress={() => setDay(d)} accessibilityRole="tab" accessibilityState={{ selected: on }}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, backgroundColor: on ? c.sky : 'transparent', minHeight: 60, justifyContent: 'center' }}>
              <T v="small" style={{ fontSize: 12, fontFamily: font.semibold, color: on ? '#FFFFFF' : c.muted, textTransform: 'uppercase' }}>{fmtDay(d, lang, { weekday: 'short' })}</T>
              <T v="h2" style={{ color: on ? '#FFFFFF' : c.ink }}>{parseDate(d).getDate()}</T>
            </Pressable>
          );
        })}
      </View>
      <ButtonRow>
        {shown === d0 && <Button label="Plans changed?" style={{ flexGrow: 1, flexBasis: 150 }} onPress={() => setPlans(true)} />}
        <Button label="Add plan" icon="plus" kind="ghost" style={{ flexGrow: 1, flexBasis: 150 }} onPress={() => setAdding(true)} />
      </ButtonRow>
      {evs.length ? <View style={{ gap: 10 }}>{items}</View> : (
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 32 }}>
          <Icon name="calendar" color={c.muted} />
          <T muted>Nothing planned for this day.</T>
        </View>
      )}

      <PlansChangedSheet visible={plans} onClose={() => setPlans(false)} />
      <AddPlanSheet visible={adding} date={shown} onClose={() => setAdding(false)} onSaved={(d) => setDay(d)} />
      <Sheet visible={!!open} onClose={() => setOpenId(null)} title={open?.title}>
        {open && (
          <>
            <T muted>{dayWord(open.date, lang)}, {f(open.start)} · {fmtDur(open.dur)} · {KIND_LABEL[open.kind]}</T>
            <List>
              <Row icon="calendar" title="Move to tomorrow" onPress={() => {
                state.snapshot();
                const others = { ...plannerState(state), events: liveEvents(state).filter((x) => x.id !== open.id) };
                const slot = suggestSlot(others, open.kind, open.dur, now, addDays(open.date, 1));
                state.updateEvent(open.id, slot);
                setOpenId(null);
                toast(`Moved to ${dayWord(slot.date, lang)}, ${f(slot.start)}`, state.restore);
              }} />
              <Row icon="lock" title={open.fixed ? 'Let Ugent move it' : 'Make it a fixed time'} sub={open.fixed ? undefined : 'Ugent will never move it'}
                onPress={() => { state.updateEvent(open.id, { fixed: !open.fixed }); setOpenId(null); }} />
              {state.me?.teamId && (
                <Row icon="users" title={open.teamId ? 'Stop sharing with my team' : 'Share with my team'}
                  onPress={() => { state.updateEvent(open.id, { teamId: open.teamId ? null : state.me!.teamId }); setOpenId(null); }} />
              )}
              <Row icon="trash" title="Delete" danger onPress={() => {
                state.snapshot(); state.deleteEvent(open.id); setOpenId(null); toast('Plan deleted', state.restore);
              }} />
            </List>
          </>
        )}
      </Sheet>
    </Screen>
  );
}

function AddPlanSheet({ visible, date, onClose, onSaved }: { visible: boolean; date: string; onClose: () => void; onSaved: (date: string) => void }) {
  const lang = useLang();
  const toast = useToast();
  const state = useApp();
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(date);
  const [time, setTime] = useState('');
  const [dur, setDur] = useState(60);
  const [kind, setKind] = useState<Kind>('personal');
  const [fixed, setFixed] = useState(false);
  const [shared, setShared] = useState(false);
  const teamId = state.me?.teamId ?? null;
  const days = Array.from({ length: 4 }, (_, i) => addDays(fmtDate(new Date()), i));

  const save = () => {
    if (!title.trim()) { toast('Give the plan a name first.'); return; }
    const valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
    const slot = valid ? { date: day, start: time } : suggestSlot(plannerState(state), kind, dur, new Date(), day);
    const ev: Omit<PlanEvent, 'id' | 'updatedAt'> = { title: title.trim(), date: slot.date, start: slot.start, dur, kind, fixed, needsPower: kind === 'deep' || kind === 'meeting', teamId: shared && teamId ? teamId : null };
    state.addEvent(ev);
    onSaved(slot.date);
    onClose();
    setTitle(''); setTime(''); setFixed(false); setShared(false);
    toast(valid ? 'Plan saved' : `Ugent picked ${dayWord(slot.date, lang)}, ${fmtTime(lang)(slot.start)}`);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Add a plan">
      <Field label="What is it?" value={title} onChangeText={setTitle} placeholder="e.g. Meet supplier at Balogun" returnKeyType="done" />
      <View style={{ gap: 6 }}>
        <T v="small" style={{ fontFamily: font.semibold }}>Day</T>
        <Segmented value={days.includes(day) ? day : days[0]} onChange={setDay} options={days.map((d) => [d, dayWord(d, lang)] as [string, string])} />
      </View>
      <TimeField label="Time" value={time} onChange={setTime} />
      <T v="small" muted>Leave the time empty and Ugent will pick the best free time.</T>
      <View style={{ gap: 6 }}>
        <T v="small" style={{ fontFamily: font.semibold }}>How long?</T>
        <Segmented value={dur} onChange={setDur} options={[[30, '30 min'], [60, '1 h'], [90, '1 h 30'], [120, '2 h']]} />
      </View>
      <View style={{ gap: 6 }}>
        <T v="small" style={{ fontFamily: font.semibold }}>Type</T>
        <Segmented value={kind} onChange={setKind} options={KINDS.map((k) => [k, KIND_LABEL[k].replace(' work', '')] as [Kind, string])} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ flex: 1 }}><T v="strong">Fixed time</T><T v="small" muted>Ugent will never move it.</T></View>
        <Toggle value={fixed} onChange={setFixed} label="Fixed time" />
      </View>
      {teamId && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ flex: 1 }}><T v="strong">Share with my team</T><T v="small" muted>It shows on everyone's schedule.</T></View>
          <Toggle value={shared} onChange={setShared} label="Share with my team" />
        </View>
      )}
      <Button label="Save plan" onPress={save} />
    </Sheet>
  );
}
