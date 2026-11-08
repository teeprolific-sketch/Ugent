import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Group } from '@/components/kit';
import { Button, Header, Row, Screen, Section, Segmented, Sheet, T, Toggle } from '@/components/ui';
import { effectivePlan, useApp } from '@/store';
import { font, radius, useColors, useTheme } from '@/theme';
import type { Base, Colors, ThemeId } from '@/themes';
import { ACCENTS, buildTheme, THEMES } from '@/themes';

/** A tiny picture of the theme: page, a card, and a primary button. */
function Preview({ colors, height = 92 }: { colors: Colors; height?: number }) {
  return (
    <View style={{ height, borderRadius: 12, backgroundColor: colors.bg, padding: 10, gap: 6, borderWidth: 1, borderColor: colors.line }}>
      <View style={{ height: 8, width: '55%', borderRadius: 4, backgroundColor: colors.heading }} />
      <View style={{ flex: 1, borderRadius: 8, backgroundColor: colors.surface2, padding: 6, gap: 4 }}>
        <View style={{ height: 5, width: '80%', borderRadius: 3, backgroundColor: colors.muted }} />
        <View style={{ height: 5, width: '60%', borderRadius: 3, backgroundColor: colors.muted }} />
      </View>
      <View style={{ height: 14, width: '50%', borderRadius: 7, backgroundColor: colors.sky }} />
    </View>
  );
}

export default function Appearance() {
  const c = useColors();
  const current = useTheme();
  const state = useApp();
  const plan = effectivePlan(state);
  const pro = plan !== 'free';
  const chosen = state.settings.theme;
  const custom = state.settings.customTheme;
  const [upsell, setUpsell] = useState(false);
  const pick = (id: ThemeId, needsPro: boolean) => (needsPro && !pro ? setUpsell(true) : state.setSettings({ theme: id }));

  const card = (id: ThemeId, name: string, note: string, colors: Colors, needsPro: boolean) => {
    const on = current.id === id && chosen !== 'auto';
    const locked = needsPro && !pro;
    return (
      <Pressable key={id} onPress={() => pick(id, needsPro)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${name} theme${locked ? ', needs Pro' : ''}`}
        style={{ flexBasis: '47%', flexGrow: 1, borderRadius: radius.lg, padding: 10, gap: 8, borderWidth: 2, borderColor: on ? c.sky : c.line, backgroundColor: c.bg }}>
        <View style={{ opacity: locked ? 0.55 : 1 }}><Preview colors={colors} /></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ flex: 1 }}>
            <T v="strong">{name}</T>
            <T v="small" muted numberOfLines={1}>{note}</T>
          </View>
          {on ? <Icon name="check" color={c.sky} /> : locked ? <Icon name="lock" color={c.muted} size={18} /> : null}
        </View>
      </Pressable>
    );
  };

  const free = THEMES.filter((t) => !t.pro);
  const paid = THEMES.filter((t) => t.pro);
  const customColors = buildTheme(custom.base, custom.accent);
  return (
    <Screen>
      <Header back title="Appearance" sub="Choose how Ugent looks." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {free.map((t) => card(t.id, t.name, t.note, t.colors, false))}
      </View>
      <Group>
        <Row title="Match my phone" sub="White by day, Black when your phone is in dark mode"
          right={<Toggle value={chosen === 'auto'} label="Match my phone" onChange={(v) => state.setSettings({ theme: v ? 'auto' : current.id })} />} />
      </Group>

      <Section title="More themes">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: c.sky }}>
            <Text style={{ fontFamily: font.bold, fontSize: 12, color: c.onSky }}>PRO + TEAM</Text>
          </View>
          <T v="small" muted>{pro ? 'Included in your plan.' : 'Unlock with Pro or Team.'}</T>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {paid.map((t) => card(t.id, t.name, t.note, t.colors, true))}
          {card('custom', 'Custom', 'Your own colour', customColors, true)}
        </View>
      </Section>

      {pro && chosen === 'custom' && (
        <Section title="Your custom theme">
          <Segmented value={custom.base} onChange={(b: Base) => state.setSettings({ customTheme: { ...custom, base: b } })} options={[['light', 'Light'], ['dark', 'Dark']]} />
          <T v="small" muted>Accent colour, used for buttons and highlights</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {ACCENTS.map((a) => {
              const on = a === custom.accent;
              return (
                <Pressable key={a} onPress={() => state.setSettings({ customTheme: { ...custom, accent: a } })} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`Accent ${a}`}
                  style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: a, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 3 : 0, borderColor: c.heading }}>
                  {on && <Icon name="check" color={customColors.onSky} size={20} strokeWidth={2.4} />}
                </Pressable>
              );
            })}
          </View>
          <Preview colors={customColors} height={120} />
        </Section>
      )}

      <Sheet visible={upsell} onClose={() => setUpsell(false)} title="More themes come with Pro">
        <T muted>Pro ($2 a month) and Team ($21 a month) include Midnight, Ocean, Sunset, Forest, Royal and your own custom theme. White and Black are free for everyone.</T>
        <Button label="See plans" onPress={() => { setUpsell(false); router.push('/pricing'); }} />
      </Sheet>
    </Screen>
  );
}
