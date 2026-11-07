import type { Kind } from '@ugent/core';
import { addDays, fmtDate, KINDS, suggestSlot } from '@ugent/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Group } from '@/components/kit';
import { TimeField } from '@/components/TimeField';
import { Button, ButtonRow, Card, Field, Header, Screen, Segmented, T, Toggle, useToast } from '@/components/ui';
import { useLang } from '@/hooks';
import { directionsUrl } from '@/lib/actions';
import { dayWord, fmtDur, fmtTime, KIND_LABEL } from '@/lib/format';
import { memberName } from '@/lib/team';
import { liveEvents, plannerState, useApp } from '@/store';
import { font, useColors } from '@/theme';

/** Add or edit a plan. Leave the time empty and Ugent picks the best free slot. */
export default function EventEditor() {
  const c = useColors();
  const lang = useLang();
  const toast = useToast();
  const params = useLocalSearchParams<{ id: string; date?: string; team?: string }>();
  const state = useApp();
  const existing = params.id === 'new' ? null : state.events.find((e) => e.id === params.id && !e.deleted) ?? null;
  const teamId = state.me?.teamId ?? null;
  const d0 = fmtDate(new Date());
  const [title, setTitle] = useState(existing?.title ?? '');
  const [day, setDay] = useState(existing?.date ?? params.date ?? d0);
  const [time, setTime] = useState(existing?.start ?? '');
  const [dur, setDur] = useState(existing?.dur ?? 60);
  const [kind, setKind] = useState<Kind>(existing?.kind ?? 'personal');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [fixed, setFixed] = useState(existing?.fixed ?? false);
  const [power, setPower] = useState(existing?.needsPower ?? false);
  const [shared, setShared] = useState(existing ? !!existing.teamId : params.team === '1');
  const days = Array.from({ length: 7 }, (_, i) => addDays(d0, i));
  const canEdit = !existing || (!existing.external && (!existing.ownerId || existing.ownerId === state.me?.id || existing.teamId === teamId));

  if (params.id !== 'new' && !existing) {
    return <Screen><Header back title="Plan not found" /><T muted>This plan was deleted or moved.</T></Screen>;
  }

  if (existing && !canEdit) {
    return (
      <Screen>
        <Header back title={existing.title} sub={`${dayWord(existing.date, lang)}, ${fmtTime(lang)(existing.start)} · ${fmtDur(existing.dur)}`} />
        <Card tint><T>{existing.external ? 'This plan comes from your phone or Google calendar. Change it there and Ugent will update.' : `Shared by ${memberName(existing.ownerId, state.team, state.me?.id)}.`}</T></Card>
        {existing.location && <Button label="Directions" icon="car" onPress={() => Linking.openURL(directionsUrl(existing.location!))} />}
      </Screen>
    );
  }

  const save = () => {
    if (!title.trim()) { toast('Give the plan a name first.'); return; }
    const valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
    const others = { ...plannerState(state), events: liveEvents(state).filter((e) => e.id !== existing?.id) };
    const slot = valid ? { date: day, start: time } : suggestSlot(others, kind, dur, new Date(), day);
    const data = { title: title.trim(), date: slot.date, start: slot.start, dur, kind, fixed, needsPower: power, location: location.trim() || null, teamId: shared && teamId ? teamId : null };
    if (existing) state.updateEvent(existing.id, data); else state.addEvent(data);
    router.back();
    toast(valid ? (existing ? 'Plan updated' : 'Plan saved') : `Ugent picked ${dayWord(slot.date, lang)}, ${fmtTime(lang)(slot.start)}`);
  };

  const toggle = (label: string, sub: string, value: boolean, onChange: (v: boolean) => void) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}>
      <View style={{ flex: 1 }}><T v="strong">{label}</T><T v="small" muted>{sub}</T></View>
      <Toggle value={value} onChange={onChange} label={label} />
    </View>
  );

  return (
    <Screen>
      <Header back title={existing ? 'Edit plan' : 'New plan'} />
      <Field label="What is it?" value={title} onChangeText={setTitle} placeholder="e.g. Meet supplier at Balogun" returnKeyType="done" />
      <View style={{ gap: 6 }}>
        <T v="small" style={{ fontFamily: font.semibold }}>Day</T>
        <Segmented value={days.slice(0, 4).includes(day) ? day : days[0]} onChange={setDay} options={days.slice(0, 4).map((d) => [d, dayWord(d, lang)] as [string, string])} />
        {!days.slice(0, 4).includes(day) && <T v="small" muted>{dayWord(day, lang)}</T>}
      </View>
      <TimeField label="Time" value={time} onChange={setTime} />
      <T v="small" muted>Leave the time empty and Ugent will pick the best free time.</T>
      <View style={{ gap: 6 }}>
        <T v="small" style={{ fontFamily: font.semibold }}>How long?</T>
        <Segmented value={dur} onChange={setDur} options={[[30, '30 min'], [60, '1 h'], [90, '1 h 30'], [120, '2 h']]} />
      </View>
      <View style={{ gap: 6 }}>
        <T v="small" style={{ fontFamily: font.semibold }}>Type</T>
        <Segmented value={kind} onChange={(k: Kind) => { setKind(k); if (!existing) setPower(k === 'deep' || k === 'meeting'); }} options={KINDS.map((k) => [k, KIND_LABEL[k].replace(' work', '')] as [Kind, string])} />
      </View>
      <View style={{ gap: 8 }}>
        <Field label="Where? (optional)" value={location} onChangeText={setLocation} placeholder="e.g. Balogun Market, Lagos" />
        {location.trim().length > 2 && (
          <Button compact kind="ghost" icon="car" label="Directions in Google Maps" onPress={() => Linking.openURL(directionsUrl(location.trim()))} />
        )}
      </View>
      <Group>
        {toggle('Fixed time', 'Ugent will never move it.', fixed, setFixed)}
        {toggle('Needs power', 'Moved first when there is a power cut.', power, setPower)}
        {teamId ? toggle('Share with my team', "It shows on everyone's team calendar.", shared, setShared) : null}
      </Group>
      <Button label={existing ? 'Save changes' : 'Save plan'} onPress={save} />
      {existing && (
        <ButtonRow>
          <Button kind="danger" label="Delete plan" icon="trash" style={{ flexGrow: 1 }} onPress={() => {
            state.snapshot(); state.deleteEvent(existing.id); router.back(); toast('Plan deleted', state.restore);
          }} />
        </ButtonRow>
      )}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Icon name="lock" color={c.muted} size={16} />
        <T v="small" muted>{shared ? 'Visible to your team.' : 'Only you can see this plan.'}</T>
      </View>
    </Screen>
  );
}
