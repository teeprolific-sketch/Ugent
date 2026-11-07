import type { PlanEvent } from '@ugent/core';
import { addDays, fmtDate, minOfDay, parseDate, toMin } from '@ugent/core';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { PlansChangedSheet } from '@/components/blocks';
import { Icon } from '@/components/Icon';
import { EmptyState, WorkspaceSwitcher } from '@/components/kit';
import { Button, ButtonRow, Chip, Header, Pill, Screen, Segmented, T } from '@/components/ui';
import { useLang, useNow } from '@/hooks';
import { fmtDay, fmtDur, fmtTime, KIND_LABEL } from '@/lib/format';
import { memberColor, memberName } from '@/lib/team';
import { liveEvents, plannerState, teamMode, useApp } from '@/store';
import { font, radius, useColors } from '@/theme';

type View_ = 'day' | 'week';

export default function Schedule() {
  const c = useColors();
  const lang = useLang();
  const now = useNow();
  const state = useApp();
  const team = teamMode(state);
  const d0 = fmtDate(now);
  const [day, setDay] = useState(d0);
  const [mode, setMode] = useState<View_>('day');
  const [plans, setPlans] = useState(false);
  const [who, setWho] = useState<string | null>(null);
  const shown = day < d0 ? d0 : day;
  const days = Array.from({ length: 7 }, (_, i) => addDays(d0, i));
  const f = fmtTime(lang);

  // Personal: my own plans plus imported calendars. Team: plans shared with the team, from everyone.
  const source = useMemo(() => {
    if (team) return liveEvents(state).filter((e) => e.teamId === state.me?.teamId && (!who || e.ownerId === who));
    return plannerState(state).events;
  }, [state, team, who]);
  const onDay = (d: string) => source.filter((e) => e.date === d).sort((a, b) => a.start.localeCompare(b.start));
  const evs = onDay(shown);
  const nowM = minOfDay(now);

  const card = (e: PlanEvent) => (
    <Pressable onPress={() => router.push(`/event/${e.id}`)} accessibilityRole="button" accessibilityLabel={`${e.title} at ${f(e.start)}`}
      style={{ flex: 1, backgroundColor: c.surface, borderRadius: radius.md, padding: 14, gap: 8, borderLeftWidth: team ? 4 : 0, borderLeftColor: memberColor(e.ownerId, state.team) }}>
      <T v="strong">{e.title}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <T v="small" muted>{fmtDur(e.dur)}</T>
        {team && <Pill label={memberName(e.ownerId, state.team, state.me?.id)} tone="onCard" />}
        {e.external ? <Pill label="From your calendar" icon="calendar" tone="onCard" /> : <Pill label={KIND_LABEL[e.kind]} tone="onCard" />}
        {e.fixed && !e.external && <Pill label="Fixed" icon="lock" tone="onCard" />}
        {e.location && <Pill label={e.location} icon="car" tone="onCard" />}
        {!team && e.teamId && <Pill label="Team" icon="users" tone="onCard" />}
      </View>
    </Pressable>
  );

  const nowLine = (key: string) => (
    <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessibilityLabel="Now">
      <T v="small" color={c.skyInk} style={{ width: 76, fontFamily: font.bold }}>Now</T>
      <View style={{ flex: 1, height: 2, borderRadius: 2, backgroundColor: c.sky }} />
    </View>
  );
  const timeline: React.ReactNode[] = [];
  let nowShown = shown !== d0;
  for (const e of evs) {
    if (!nowShown && toMin(e.start) > nowM) { timeline.push(nowLine('now')); nowShown = true; }
    const past = shown === d0 && toMin(e.start) + e.dur <= nowM;
    timeline.push(
      <View key={e.id} style={{ flexDirection: 'row', gap: 12, opacity: past ? 0.55 : 1 }}>
        <T v="small" muted style={{ width: 76, paddingTop: 14, fontFamily: font.semibold }}>{f(e.start)}</T>
        {card(e)}
      </View>,
    );
  }
  if (!nowShown && evs.length) timeline.push(nowLine('now-end'));

  return (
    <Screen>
      <Header title={team ? 'Team calendar' : 'Schedule'} sub={mode === 'day' ? fmtDay(shown, lang, { weekday: 'long', day: 'numeric', month: 'long' }) : 'This week'} />
      <WorkspaceSwitcher />
      <Segmented value={mode} onChange={setMode} options={[['day', 'Day'], ['week', 'Week']]} />
      {team && state.team && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Everyone" on={!who} onPress={() => setWho(null)} />
          {state.team.members.map((m) => <Chip key={m.id} label={m.id === state.me?.id ? 'You' : m.name} on={who === m.id} onPress={() => setWho(m.id)} />)}
        </View>
      )}

      {mode === 'day' ? (
        <>
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
            {shown === d0 && !team && <Button label="Plans changed?" style={{ flexGrow: 1, flexBasis: 150 }} onPress={() => setPlans(true)} />}
            <Button label={team ? 'Add team plan' : 'Add plan'} icon="plus" kind={shown === d0 && !team ? 'ghost' : 'primary'} style={{ flexGrow: 1, flexBasis: 150 }}
              onPress={() => router.push({ pathname: '/event/[id]', params: { id: 'new', date: shown, team: team ? '1' : '' } })} />
          </ButtonRow>
          {evs.length ? <View style={{ gap: 10 }}>{timeline}</View> : (
            <EmptyState icon="calendar" title={team ? 'No shared plans this day' : 'Nothing planned this day'}
              body={team ? 'Plans shared with the team show here, coloured by person.' : 'Add a plan, or tell Ugent in chat and it will find the best time.'} />
          )}
        </>
      ) : (
        <View style={{ gap: 10 }}>
          {days.map((d) => {
            const list = onDay(d);
            return (
              <Pressable key={d} onPress={() => { setDay(d); setMode('day'); }} accessibilityRole="button" accessibilityLabel={`${fmtDay(d, lang, { weekday: 'long' })}: ${list.length} plans`}
                style={{ backgroundColor: c.surface, borderRadius: radius.md, padding: 14, gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <T v="strong">{d === d0 ? 'Today' : fmtDay(d, lang, { weekday: 'long', day: 'numeric', month: 'short' })}</T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <T v="small" muted>{list.length ? `${list.length} plan${list.length > 1 ? 's' : ''}` : 'Free'}</T>
                    <Icon name="chevR" color={c.muted} size={18} />
                  </View>
                </View>
                {list.slice(0, 3).map((e) => (
                  <View key={e.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: team ? memberColor(e.ownerId, state.team) : e.external ? c.muted : c.sky }} />
                    <T v="small" muted style={{ width: 70 }}>{f(e.start)}</T>
                    <T v="small" style={{ flex: 1 }} numberOfLines={1}>{e.title}</T>
                  </View>
                ))}
                {list.length > 3 && <T v="small" muted>and {list.length - 3} more</T>}
              </Pressable>
            );
          })}
        </View>
      )}
      <PlansChangedSheet visible={plans} onClose={() => setPlans(false)} />
    </Screen>
  );
}
