import type { Reason } from '@ugent/core';
import { addDays, applyMoves, bestTime, computeReschedule, conflictFix, detectRoutines, findConflicts, fmtDate, headsUp, minOfDay, routineToSuggest, toMin, weekdayName } from '@ugent/core';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/Icon';
import { PlansChangedSheet, TaskRow } from '@/components/blocks';
import { Avatar, EmptyState, WorkspaceSwitcher } from '@/components/kit';
import { FocusSetupSheet } from '@/components/FocusSetup';
import { CaptureButton } from '@/components/QuickCapture';
import { perform } from '@/lib/actions';
import { TeamHome } from '@/components/TeamHome';
import { Button, ButtonRow, Card, Chip, IconButton, LinkButton, List, Pill, Screen, Section, Sheet, T, useToast } from '@/components/ui';
import { useLang, useNow, useT } from '@/hooks';
import { fmtDay, fmtDur, fmtTime, KIND_LABEL, timeParts } from '@/lib/format';
import { travelMinutes } from '@/lib/maps';
import { fromMin } from '@ugent/core';
import { liveEvents, liveTasks, plannerState, routineKey, teamMode, useApp } from '@/store';
import { font, useColors } from '@/theme';

export default function Home() {
  const c = useColors();
  const t = useT();
  const lang = useLang();
  const now = useNow();
  const toast = useToast();
  const state = useApp();
  const [plansSheet, setPlansSheet] = useState<Reason | null | false>(false);
  const [leave, setLeave] = useState<{ id: string; minutes: number; live: boolean } | null>(null);
  const [focusSetup, setFocusSetup] = useState(false);
  const [person, setPerson] = useState<{ name: string; phone: string | null } | null>(null);
  const [kept, setKept] = useState<string[]>([]);

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
  // Personal routine: something they usually do on this weekday that isn't planned yet.
  const suggested = state.settings.learn ? routineToSuggest(detectRoutines(state.events, now).sort((a, b) => Number(state.pinnedRoutines.includes(routineKey(b.title, b.weekday))) - Number(state.pinnedRoutines.includes(routineKey(a.title, a.weekday)))), liveEvents(state), now) : null;
  const routine = suggested && !state.routineSkips.includes(`${suggested.title.toLowerCase()}|${d0}`) ? suggested : null;
  // Evening wrap-up after 5 PM; morning brief before.
  const evening = hr >= 17;
  const doneToday = state.log.completions.filter((x) => fmtDate(new Date(x.t)) === d0).length;
  const focusToday = state.log.focus.filter((x) => fmtDate(new Date(x.t)) === d0).reduce((a, x) => a + x.mins, 0);
  const firstTomorrow = ps.events.filter((e) => e.date === addDays(d0, 1)).sort((a, b) => a.start.localeCompare(b.start))[0];
  // Gentle energy note: when this person is strongest, and the important thing to use it on.
  const peakNow = bestTime(ps, now);
  const importantTask = top.find((x) => x.important);
  const energyNote = importantTask && ((peakNow === 'morning' && hr < 12) || (peakNow === 'afternoon' && hr < 17))
    ? `Your strongest hours are this ${peakNow}. A good time for "${importantTask.title}".` : null;
  // Clashes today and tomorrow, with a one-tap fix.
  const clashes = [...findConflicts(ps.events, d0), ...findConflicts(ps.events, addDays(d0, 1))]
    .filter((x) => (x.first.date !== d0 || toMin(x.second.start) + x.second.dur > minOfDay(now)) && !kept.includes(`${x.first.id}|${x.second.id}`));
  const clashFix = clashes[0] ? conflictFix(ps, clashes[0], now) : null;
  // Pinned people for one-tap call or WhatsApp.
  const pinned = Object.values(state.memory.people).filter((p) => p.pinned).slice(0, 4);
  const gmail = state.gmail && state.gmail.count > 0
    ? `${state.gmail.count} important unread email${state.gmail.count > 1 ? 's' : ''}${state.gmail.top[0] ? `, latest from ${state.gmail.top[0].from}` : ''}.`
    : null;
  return (
    <Screen footer={team ? undefined : <CaptureButton />}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <T v="title">{t(hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : 'evening')}{name ? `, ${name}` : ''}</T>
          <T muted>{fmtDay(d0, lang, { weekday: 'long', day: 'numeric', month: 'long' })}</T>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <IconButton icon="search" label="Search" onPress={() => router.push('/search')} />
        </View>
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
        <T v="h2">{evening ? 'Your evening wrap-up' : t('home.brief')}</T>
        <View style={{ gap: 10 }}>
          {evening ? (
            <>
              <View style={{ flexDirection: 'row', gap: 12 }}><Icon name="check" color={c.skyInk} /><T style={{ flex: 1 }}>{doneToday ? `You finished ${doneToday} task${doneToday > 1 ? 's' : ''} today${focusToday ? ` and focused for ${focusToday} minutes` : ''}.` : 'A quiet day. Rest counts too.'}{open.length ? ` ${open.length} still open.` : ''}</T></View>
              <View style={{ flexDirection: 'row', gap: 12 }}><Icon name="moon" color={c.skyInk} /><T style={{ flex: 1 }}>{firstTomorrow ? `Tomorrow starts with ${firstTomorrow.title} at ${fmtTime(lang)(firstTomorrow.start)}.` : 'Nothing planned for tomorrow yet.'}</T></View>
            </>
          ) : (
            <View style={{ flexDirection: 'row', gap: 12 }}><Icon name="calendar" color={c.skyInk} /><T style={{ flex: 1 }}>{t('brief', { e: evs.length, t: open.length })}</T></View>
          )}
          {!evening && energyNote && <View style={{ flexDirection: 'row', gap: 12 }}><Icon name="bolt" color={c.skyInk} /><T style={{ flex: 1 }}>{energyNote}</T></View>}
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

      {clashes.length > 0 && (
        <Card>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Icon name="clock" color={c.warn} />
            <T style={{ flex: 1 }}><T style={{ fontFamily: font.semibold }}>{clashes[0].first.title}</T> and <T style={{ fontFamily: font.semibold }}>{clashes[0].second.title}</T> clash{clashes[0].first.date === d0 ? ' today' : ' tomorrow'} at {fmtTime(lang)(clashes[0].second.start)}.{clashFix ? ` Move ${clashFix.title} to ${fmtTime(lang)(clashFix.to)}?` : ' Both have fixed times, so pick one.'}</T>
          </View>
          <ButtonRow>
            {clashFix && <Button compact label="Fix it" style={{ flexGrow: 1 }} onPress={() => { state.snapshot(); useApp.setState((st) => ({ events: applyMoves(st.events, [clashFix], Date.now()), sync: { ...st.sync, dirtyEvents: [...new Set([...st.sync.dirtyEvents, clashFix.id])] } })); toast(`Moved ${clashFix.title} to ${fmtTime(lang)(clashFix.to)}`, state.restore); }} />}
            <Button compact kind="ghost" label="Keep both" style={{ flexGrow: 1 }} onPress={() => setKept([...kept, `${clashes[0].first.id}|${clashes[0].second.id}`])} />
          </ButtonRow>
        </Card>
      )}
      {pinned.length > 0 && (
        <View style={{ gap: 8 }}>
          <T v="label">Your people</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {pinned.map((p) => (
              <Card key={p.name} onPress={() => setPerson({ name: p.name, phone: p.phone })} label={`Contact ${p.name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingRight: 16 }}>
                <Avatar name={p.name} size={30} />
                <T v="strong">{p.name}</T>
              </Card>
            ))}
          </View>
        </View>
      )}
      {routine && (
        <Card>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Icon name="sync" color={c.skyInk} />
            <T style={{ flex: 1 }}>You usually do <T style={{ fontFamily: font.semibold }}>{routine.title}</T> on {weekdayName(routine.weekday)}s around {fmtTime(lang)(routine.start)}. Add it today?</T>
          </View>
          <ButtonRow>
            <Button compact label="Add it" style={{ flexGrow: 1 }} onPress={() => { state.addEvent({ title: routine.title, date: d0, start: routine.start, dur: 60, kind: 'personal', fixed: false, needsPower: false }); toast(`${routine.title} added for ${fmtTime(lang)(routine.start)}`); }} />
            <Button compact kind="ghost" label="Not today" style={{ flexGrow: 1 }} onPress={() => state.skipRoutine(`${routine.title.toLowerCase()}|${d0}`)} />
          </ButtonRow>
        </Card>
      )}
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
        <Button label={t('home.focus')} icon="focus" kind="ghost" style={{ flexGrow: 1, flexBasis: 150 }} onPress={() => setFocusSetup(true)} />
      </ButtonRow>

      </>}
      <PlansChangedSheet visible={plansSheet !== false} initial={plansSheet || null} onClose={() => setPlansSheet(false)} />
      <FocusSetupSheet visible={focusSetup} onClose={() => setFocusSetup(false)} />
      <Sheet visible={!!person} onClose={() => setPerson(null)} title={person?.name}>
        <ButtonRow>
          <Button label="Call" icon="chat" style={{ flexGrow: 1 }} onPress={async () => { const p = person!; setPerson(null); const note = await perform({ type: 'call', name: p.name, phone: p.phone }); if (note) toast(note); }} />
          <Button label="WhatsApp" icon="send" kind="ghost" style={{ flexGrow: 1 }} onPress={async () => { const p = person!; setPerson(null); const note = await perform({ type: 'message', channel: 'whatsapp', name: p.name, phone: p.phone, text: `Hi ${p.name}, ` }); if (note) toast(note); }} />
        </ButtonRow>
      </Sheet>
    </Screen>
  );
}
