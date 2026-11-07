import type { Reason } from '@ugent/core';
import { bestTime, computeReschedule, fmtDate, headsUp, minOfDay, toMin } from '@ugent/core';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/Icon';
import { PlansChangedSheet, TaskRow } from '@/components/blocks';
import { EmptyState, WorkspaceSwitcher } from '@/components/kit';
import { TeamHome } from '@/components/TeamHome';
import { Button, ButtonRow, Card, Chip, LinkButton, List, Pill, Screen, Section, T, useToast } from '@/components/ui';
import { useLang, useNow, useOnline, useT } from '@/hooks';
import { fmtDay, fmtDur, fmtTime, KIND_LABEL, timeParts } from '@/lib/format';
import { travelMinutes } from '@/lib/maps';
import { reportFocus } from '@/lib/api';
import { fromMin } from '@ugent/core';
import { liveEvents, liveTasks, plannerState, teamMode, useApp } from '@/store';
import { font, useColors } from '@/theme';

export default function Home() {
  const c = useColors();
  const t = useT();
  const lang = useLang();
  const now = useNow();
  const online = useOnline();
  const toast = useToast();
  const state = useApp();
  const [plansSheet, setPlansSheet] = useState<Reason | null | false>(false);
  const [leave, setLeave] = useState<{ id: string; minutes: number; live: boolean } | null>(null);

  const d0 = fmtDate(now);
  const hr = now.getHours();
  const name = state.profile.name;
  const ps0 = plannerState(state);
  const evs = useMemo(() => ps0.events.filter((e) => e.date === d0).sort((a, b) => a.start.localeCompare(b.start)), [ps0.events, d0]);
  const next = evs.find((e) => toMin(e.start) + e.dur > minOfDay(now));
  const open = liveTasks(state).filter((x) => !x.done && x.date <= d0);
  const top = [...open].sort((a, b) => Number(b.important) - Number(a.important) || b.createdAt - a.createdAt).slice(0, 3);
  const ps = ps0;
  const hu = headsUp(ps, now);
  // Leave-by time for the next plan that has a place (live traffic when available).
  const withPlace = evs.find((e) => e.location && toMin(e.start) > minOfDay(now));
  useEffect(() => {
    if (!withPlace?.location) { setLeave(null); return; }
    let alive = true;
    travelMinutes(withPlace.location).then((r) => { if (alive) setLeave({ id: withPlace.id, ...r }); });
    return () => { alive = false; };
  }, [withPlace?.id, withPlace?.location]);
  const heads = 'ev' in hu ? t(hu.key, { title: hu.ev.title, time: fmtTime(lang)(hu.ev.start) }) : t(hu.key, { peak: t('peak.' + bestTime(ps, now)) });
  const answered = state.log.energy.some((e) => fmtDate(new Date(e.t)) === d0);
  const hasSamples = state.tasks.some((x) => x.sample) || state.events.some((e) => e.sample);

  const energy = (v: 'low' | 'ok' | 'high') => {
    state.logEnergy(v);
    if (v === 'low' && computeReschedule(ps, 'tired', now).moves.length) { setPlansSheet('tired'); return; }
    toast(v === 'high' ? 'Great. A good time for your hardest task.' : 'Thanks. Noted for today.');
  };

  const [tm, ap] = next ? timeParts(next.start, lang) : ['', ''];
  const team = teamMode(state);
  const empty = !hasSamples && evs.length === 0 && liveTasks(state).length === 0;
  const leaveLine = leave && withPlace && leave.id === withPlace.id
    ? `Leave by ${fmtTime(lang)(fromMin(toMin(withPlace.start) - leave.minutes - 10))} for ${withPlace.title} (${leave.minutes} min${leave.live ? ' with traffic now' : ', your usual buffer'}).`
    : null;
  const gmail = state.gmail && state.gmail.count > 0
    ? `${state.gmail.count} important unread email${state.gmail.count > 1 ? 's' : ''}${state.gmail.top[0] ? `, latest from ${state.gmail.top[0].from}` : ''}.`
    : null;
  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <T v="title">{t(hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : 'evening')}{name ? `, ${name}` : ''}</T>
          <T muted>{fmtDay(d0, lang, { weekday: 'long', day: 'numeric', month: 'long' })}</T>
        </View>
        {!online && <Pill label="Offline, still working" icon="wifiOff" />}
      </View>
      <WorkspaceSwitcher />
      {team ? <TeamHome /> : <>

      {hasSamples && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderStyle: 'dashed', borderColor: c.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
          <T v="small" muted>You're seeing a sample day.</T>
          <LinkButton label="Clear it" onPress={() => { state.clearSamples(); toast('Sample day cleared'); }} />
        </View>
      )}

      <Card tint>
        <T v="h2">{t('home.brief')}</T>
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}><Icon name="calendar" color={c.skyInk} /><T style={{ flex: 1 }}>{t('brief', { e: evs.length, t: open.length })}</T></View>
          {leaveLine
            ? <View style={{ flexDirection: 'row', gap: 12 }}><Icon name="car" color={c.skyInk} /><T style={{ flex: 1 }}>{leaveLine}</T></View>
            : <View style={{ flexDirection: 'row', gap: 12 }}><Icon name={hu.key === 'headsTraffic' ? 'car' : hu.key === 'headsPower' ? 'bolt' : 'sun'} color={c.skyInk} /><T style={{ flex: 1 }}>{heads}</T></View>}
          {gmail && <View style={{ flexDirection: 'row', gap: 12 }}><Icon name="chat" color={c.skyInk} /><T style={{ flex: 1 }}>{gmail}</T></View>}
        </View>
        {!answered && (
          <View style={{ gap: 8 }}>
            <T v="small" muted>{t('home.energy')}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(['low', 'ok', 'high'] as const).map((v) => <Chip key={v} label={t('energy.' + v)} onPress={() => energy(v)} />)}
            </View>
          </View>
        )}
      </Card>

      {empty ? (
        <EmptyState icon="calendar" title="Your day is clear" body="Add your first plan or task, or just tell Ugent what you need to do today."
          action={{ label: 'Talk to Ugent', onPress: () => router.navigate('/chat') }} secondary={{ label: 'Add a plan', onPress: () => router.push('/event/new') }} />
      ) : <>
      <Section title={t('home.next')} action={{ label: 'See plan', onPress: () => router.navigate('/schedule') }}>
        {next ? (
          <Card onPress={() => router.navigate('/schedule')} label={`Next: ${next.title}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ minWidth: 68, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, borderRadius: 12, backgroundColor: c.bg }}>
              <T v="h2">{tm}</T>
              {ap ? <T v="small" muted style={{ fontFamily: font.semibold }}>{ap}</T> : null}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="strong">{next.title}</T>
              <T v="small" muted>{fmtDur(next.dur)} · {KIND_LABEL[next.kind]}{next.fixed ? ' · Fixed time' : ''}</T>
            </View>
            <Icon name="chevR" color={c.muted} size={20} />
          </Card>
        ) : (
          <Card><T muted>{t('nonext')}</T></Card>
        )}
      </Section>

      <Section title={t('home.tasks')} action={{ label: 'See all', onPress: () => router.navigate('/tasks') }}>
        {top.length ? <List>{top.map((x) => <TaskRow key={x.id} task={x} />)}</List> : <T muted>Nothing due today. Enjoy the breathing room.</T>}
      </Section>
      </>}

      <ButtonRow>
        <Button label={t('home.talk')} icon="chat" style={{ flexGrow: 1, flexBasis: 150 }} onPress={() => router.navigate('/chat')} />
        <Button label={t('home.focus')} icon="focus" kind="ghost" style={{ flexGrow: 1, flexBasis: 150 }} onPress={() => { state.startFocus(state.settings.focusMins); void reportFocus(Date.now() + state.settings.focusMins * 60000); router.push('/focus'); }} />
      </ButtonRow>

      </>}
      <PlansChangedSheet visible={plansSheet !== false} initial={plansSheet || null} onClose={() => setPlansSheet(false)} />
    </Screen>
  );
}
