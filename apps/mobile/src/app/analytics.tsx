import { addDays, bestTime, energyPattern, fmtDate, parseDate } from '@ugent/core';
import type { Peak } from '@ugent/core';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Card, Header, Pill, Screen, Section, Segmented, T } from '@/components/ui';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Avatar, EmptyState } from '@/components/kit';
import { memberColor, refreshTeam } from '@/lib/team';
import { inTeam } from '@/store';
import { useLang } from '@/hooks';
import { fmtDay } from '@/lib/format';
import { plannerState, useApp } from '@/store';
import { font, radius, useColors } from '@/theme';

const PER: Record<Peak, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };

export default function Analytics() {
  const c = useColors();
  const lang = useLang();
  const state = useApp();
  const [picked, setPicked] = useState<number | null>(null);
  const [who, setWho] = useState<'me' | 'team'>('me');
  const showTeam = inTeam(state) && who === 'team';
  useEffect(() => { if (showTeam) void refreshTeam(); }, [showTeam]);
  const now = new Date();
  const d0 = fmtDate(now);
  const days = Array.from({ length: 7 }, (_, i) => addDays(d0, i - 6));
  const counts = days.map((d) => state.log.completions.filter((x) => fmtDate(new Date(x.t)) === d).length);
  const total = counts.reduce((a, b) => a + b, 0);
  const since = parseDate(days[0]).getTime();
  const focusMins = state.log.focus.filter((f) => f.t >= since).reduce((a, f) => a + f.mins, 0);
  const moved = state.log.reschedules.filter((r) => r.t >= since).reduce((a, r) => a + r.n, 0);
  const max = Math.max(4, ...counts);
  const pat = energyPattern(state, now);
  const pmax = Math.max(1, pat.morning, pat.afternoon, pat.evening);
  const peak = bestTime(plannerState(state), now);
  const best = days[counts.indexOf(Math.max(...counts))];
  const sample = state.log.completions.some((x) => x.sample);
  const focusLabel = focusMins >= 60 ? `${(focusMins / 60).toFixed(1).replace('.0', '')} h` : `${focusMins} min`;
  const show = picked ?? 6;

  const stat = (value: string, label: string) => (
    <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: radius.md, padding: 14, gap: 2 }}>
      <T v="title" style={{ fontSize: 26 }}>{value}</T>
      <T v="small" muted style={{ fontFamily: font.semibold, fontSize: 13 }}>{label}</T>
    </View>
  );

  return (
    <Screen>
      <Header back title="Your week" sub="The last 7 days, in plain numbers." />
      {inTeam(state) && <Segmented value={who} onChange={setWho} options={[['me', 'Me'], ['team', 'Team']]} />}
      {showTeam ? <TeamWeek /> : total === 0 && focusMins === 0 && !sample ? (
        <EmptyState icon="chart" title="Your week will appear here" body="Finish a few tasks and try a focus session. Ugent turns them into simple numbers and learns your best time of day."
          action={{ label: 'Go to tasks', onPress: () => router.navigate('/tasks') }} />
      ) : <>
      {sample && <Pill label="Sample data" />}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {stat(String(total), 'Tasks done')}
        {stat(focusLabel, 'Focus time')}
        {stat(String(moved), 'Plans moved')}
      </View>

      <Section title="Tasks done each day">
        <View accessibilityLabel={`Tasks done each day: ${days.map((d, i) => `${fmtDay(d, lang, { weekday: 'long' })} ${counts[i]}`).join(', ')}`}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 170, paddingTop: 24 }}>
            {counts.map((n, i) => (
              <Pressable key={days[i]} onPress={() => setPicked(i)} accessibilityRole="button" accessibilityLabel={`${fmtDay(days[i], lang, { weekday: 'long' })}: ${n} done`}
                style={{ flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                {i === show && <T v="small" style={{ fontFamily: font.bold }}>{n}</T>}
                <View style={{ width: '100%', maxWidth: 28, height: `${Math.max(2, (n / max) * 100)}%`, minHeight: 2, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: i === show ? c.bar : c.barSoft }} />
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 6 }}>
            {days.map((d, i) => <T key={d} v="small" muted center style={{ flex: 1, fontSize: 13, fontFamily: font.semibold }}>{i === 6 ? 'Today' : fmtDay(d, lang, { weekday: 'narrow' })}</T>)}
          </View>
        </View>
        {total > 0 && <T v="small" muted>Your best day was {fmtDay(best, lang, { weekday: 'long' })}. Tap a bar to see its number.</T>}
      </Section>

      <Section title="When you get things done">
        <View style={{ gap: 12 }}>
          {(['morning', 'afternoon', 'evening'] as Peak[]).map((p) => (
            <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <T v="small" style={{ width: 90 }}>{PER[p]}</T>
              <View style={{ flex: 1, height: 12, backgroundColor: c.surface, borderTopRightRadius: 4, borderBottomRightRadius: 4, overflow: 'hidden' }}>
                <View style={{ width: `${(pat[p] / pmax) * 100}%`, height: '100%', backgroundColor: p === peak ? c.bar : c.barSoft, borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
              </View>
              <T v="small" style={{ width: 32, textAlign: 'right', fontFamily: font.semibold }}>{pat[p]}</T>
            </View>
          ))}
        </View>
        <Card tint>
          <T>{state.settings.learn
            ? `You finish most tasks in the ${PER[peak].toLowerCase()}. Ugent keeps that time free for your most important work.`
            : 'Learning is off, so Ugent uses the best time you chose. Turn learning on in Settings to let Ugent adjust.'}</T>
        </Card>
      </Section>
      </>}
    </Screen>
  );
}

/** Advanced analytics for the Team plan. */
function TeamWeek() {
  const c = useColors();
  const { team, teamStats } = useApp();
  if (!team || !teamStats) return <T muted>Loading team numbers… Connect to the internet if this takes long.</T>;
  const max = Math.max(1, ...teamStats.members.map((m) => m.doneThisWeek));
  return (
    <>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[[teamStats.totals.doneThisWeek, 'Team tasks done'], [teamStats.totals.open, 'Open'], [teamStats.totals.unassigned, 'Unassigned']].map(([n, l]) => (
          <View key={String(l)} style={{ flex: 1, backgroundColor: c.surface, borderRadius: radius.md, padding: 14, gap: 2 }}>
            <T v="title" style={{ fontSize: 26 }}>{String(n)}</T>
            <T v="small" muted style={{ fontFamily: font.semibold, fontSize: 13 }}>{l}</T>
          </View>
        ))}
      </View>
      <Section title="Done this week, by person">
        <View style={{ gap: 12 }}>
          {teamStats.members.map((m) => (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar name={m.name} size={28} color={memberColor(m.id, team)} />
              <T v="small" style={{ width: 80 }} numberOfLines={1}>{m.name}</T>
              <View style={{ flex: 1, height: 12, backgroundColor: c.surface, borderTopRightRadius: 4, borderBottomRightRadius: 4, overflow: 'hidden' }}>
                <View style={{ width: `${(m.doneThisWeek / max) * 100}%`, height: '100%', backgroundColor: memberColor(m.id, team), borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
              </View>
              <T v="small" style={{ width: 28, textAlign: 'right', fontFamily: font.semibold }}>{m.doneThisWeek}</T>
            </View>
          ))}
        </View>
      </Section>
      <Card tint><T v="small">Team numbers count shared team tasks only. Personal tasks stay private.</T></Card>
    </>
  );
}
