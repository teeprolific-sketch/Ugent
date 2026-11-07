import type { Lang, Plan } from '@ugent/core';
import { pad, searchLangs } from '@ugent/core';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { inTeam, useApp } from '@/store';
import { font, radius, size, useColors } from '@/theme';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { Button, Field, Segmented, T } from './ui';

/** Friendly first-run state: what will appear here, and the one thing to do next. */
export function EmptyState({ icon, title, body, action, secondary }: {
  icon: IconName; title: string; body: string; action?: { label: string; onPress: () => void }; secondary?: { label: string; onPress: () => void };
}) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 28, paddingHorizontal: 12 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} color={c.skyInk} size={28} />
      </View>
      <T v="h3" center>{title}</T>
      <T v="small" muted center style={{ maxWidth: 300 }}>{body}</T>
      {(action || secondary) && (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {action && <Button compact label={action.label} onPress={action.onPress} />}
          {secondary && <Button compact kind="ghost" label={secondary.label} onPress={secondary.onPress} />}
        </View>
      )}
    </View>
  );
}

export function Avatar({ name, color, size: s = 36 }: { name: string; color?: string; size?: number }) {
  const c = useColors();
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || 'U';
  return (
    <View accessibilityLabel={name} style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: color ?? c.sky, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#FFFFFF', fontFamily: font.bold, fontSize: s * 0.4 }}>{letters}</Text>
    </View>
  );
}

/** Small plan label: "Pro" in sky, "Team" in deep blue, nothing loud for free. */
export function PlanBadge({ plan }: { plan: Plan }) {
  const c = useColors();
  if (plan === 'free') return <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: c.surface }}><Text style={{ fontFamily: font.semibold, fontSize: 12, color: c.muted }}>Free</Text></View>;
  const bg = plan === 'team' ? '#0B3D91' : c.sky;
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: bg }}>
      <Text style={{ fontFamily: font.bold, fontSize: 12, color: '#FFFFFF', letterSpacing: 0.3 }}>{plan === 'team' ? 'TEAM' : 'PRO'}</Text>
    </View>
  );
}

/** Personal / Team switcher. Shown only to people in a team. */
export function WorkspaceSwitcher() {
  const me = useApp((s) => s.me);
  const ws = useApp((s) => s.workspace);
  const setWs = useApp((s) => s.setWorkspace);
  if (!inTeam({ me })) return null;
  return <Segmented value={ws} onChange={setWs} options={[['personal', 'Personal'], ['team', 'Team']]} />;
}

/** Search box plus a clean list; the selected language is filled sky blue. */
export function LanguageList({ value, onChange }: { value: Lang; onChange: (l: Lang) => void }) {
  const c = useColors();
  const [q, setQ] = useState('');
  const list = searchLangs(q);
  return (
    <View style={{ gap: 12 }}>
      <Field value={q} onChangeText={setQ} placeholder="Search languages, e.g. Pidgin" accessibilityLabel="Search languages" autoCorrect={false} returnKeyType="search" />
      <View style={{ gap: 8 }}>
        {list.map((l) => {
          const on = l.code === value;
          return (
            <Pressable key={l.code} onPress={() => onChange(l.code)} accessibilityRole="radio" accessibilityState={{ selected: on }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingHorizontal: 18, borderRadius: radius.md, backgroundColor: on ? c.sky : c.surface }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.semibold, fontSize: size.base, color: on ? '#FFFFFF' : c.ink }}>{l.native}</Text>
                {l.native !== l.name && <Text style={{ fontFamily: font.regular, fontSize: size.sm, color: on ? '#E0F2FE' : c.muted }}>{l.name}</Text>}
              </View>
              {on && <Icon name="check" color="#FFFFFF" />}
            </Pressable>
          );
        })}
        {!list.length && <T muted center>No language matches "{q}". More languages are coming.</T>}
      </View>
      <T v="small" muted>More African languages are on the way.</T>
    </View>
  );
}

/** A list of options with a title and a line of explanation; the chosen one is outlined in sky blue. */
export function ChoiceList<V extends string>({ value, options, onChange }: { value: V | null; options: { v: V; title: string; sub?: string; icon?: IconName }[]; onChange: (v: V) => void }) {
  const c = useColors();
  return (
    <View style={{ gap: 10 }}>
      {options.map((o) => {
        const on = o.v === value;
        return (
          <Pressable key={o.v} onPress={() => onChange(o.v)} accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: on ? c.sky : c.line, backgroundColor: on ? c.surface2 : c.bg, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 12, minHeight: 58 }}>
            {o.icon && <Icon name={o.icon} color={on ? c.skyInk : c.heading} />}
            <View style={{ flex: 1 }}>
              <T v="strong">{o.title}</T>
              {o.sub ? <T v="small" muted>{o.sub}</T> : null}
            </View>
            {on && <Icon name="check" color={c.sky} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const hhmm = (m: number) => `${pad(Math.floor((m % 1440) / 60))}:${pad(m % 60)}`;
const label12 = (m: number) => { const h = Math.floor((m % 1440) / 60); return `${h % 12 || 12}:${pad(m % 60)} ${h < 12 ? 'AM' : 'PM'}`; };

/** Quick time choice as chips (wake-up, bedtime, brief time). Value in minutes after midnight. */
export function TimeChips({ value, options, onChange }: { value: number; options: number[]; onChange: (m: number) => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((m) => {
        const on = m === value;
        return (
          <Pressable key={m} onPress={() => onChange(m)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label12(m)}
            style={{ borderWidth: 1, borderColor: on ? c.sky : c.line, backgroundColor: on ? c.sky : c.bg, borderRadius: 999, paddingHorizontal: 14, minHeight: 42, justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.semibold, fontSize: size.sm, color: on ? '#FFFFFF' : c.ink }}>{label12(m)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
export const minutesToHHMM = hhmm;
export const minutesLabel = label12;

/** A titled block of settings rows with a soft background. */
export function Group({ title, children, note }: { title?: string; children: ReactNode; note?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 8 }}>
      {title ? <T v="label">{title}</T> : null}
      <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, paddingHorizontal: 16 }}>{children}</View>
      {note ? <T v="small" muted>{note}</T> : null}
    </View>
  );
}
