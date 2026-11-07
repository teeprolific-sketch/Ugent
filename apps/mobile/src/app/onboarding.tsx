import type { Lang, Peak } from '@ugent/core';
import { LANG_META } from '@ugent/core';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Wordmark } from '@/brand/Logo';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { Button, Field, Screen, T, Toggle } from '@/components/ui';
import { askNotificationPermission } from '@/lib/notifications';
import { useApp } from '@/store';
import { font, radius, useColors } from '@/theme';

export default function Onboarding() {
  const c = useColors();
  const finish = useApp((s) => s.finishOnboarding);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [lang, setLang] = useState<Lang>('en');
  const [peak, setPeak] = useState<Peak>('morning');
  const [sample, setSample] = useState(true);

  const steps = (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Step ${step + 1} of 3`}>
      {[0, 1, 2].map((i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 4, backgroundColor: i <= step ? c.sky : c.line }} />)}
    </View>
  );

  const choice = (on: boolean, onPress: () => void, children: React.ReactNode, key: string) => (
    <Pressable key={key} onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 1.5, borderColor: on ? c.sky : c.line, backgroundColor: on ? c.surface2 : c.bg, borderRadius: radius.md, paddingHorizontal: 18, minHeight: 58, paddingVertical: 10 }}>
      <View style={{ flex: 1 }}>{children}</View>
      {on && <Icon name="check" color={c.sky} />}
    </Pressable>
  );

  if (step === 0) {
    const features: [IconName, string][] = [
      ['chat', 'Talk or type in 6 languages'],
      ['calendar', 'Reschedules when your day changes'],
      ['wifiOff', 'Works offline and on low data'],
      ['lock', 'You stay in control of your data'],
    ];
    return (
      <Screen contentStyle={{ flexGrow: 1 }}>
        {steps}
        <View style={{ gap: 18, paddingTop: 48 }}>
          <Wordmark width={150} />
          <T v="hero">Your day, handled.</T>
          <T v="h3" muted style={{ fontFamily: font.regular, fontSize: 19, lineHeight: 27 }}>
            Ugent plans around traffic, power cuts, family and work that changes. It speaks your language and works offline.
          </T>
        </View>
        <View style={{ gap: 14 }}>
          {features.map(([ic, l]) => (
            <View key={l} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><Icon name={ic} color={c.sky} /><T>{l}</T></View>
          ))}
        </View>
        <View style={{ flex: 1 }} />
        <Button label="Get started" onPress={() => setStep(1)} />
      </Screen>
    );
  }

  if (step === 1) {
    return (
      <Screen>
        {steps}
        <T v="title">What should I call you?</T>
        <Field label="Your first name" value={name} onChangeText={setName} placeholder="e.g. Tobi" autoComplete="given-name" textContentType="givenName" returnKeyType="done" />
        <View style={{ gap: 10 }}>
          <T v="h2">Which language do you prefer?</T>
          <T v="small" muted>You can mix languages in chat. Ugent will understand.</T>
          {LANG_META.map((l) => choice(lang === l.code, () => setLang(l.code), (
            <T v="strong">{l.native}{l.native !== l.name ? <T v="small" muted>{`  ${l.name}`}</T> : null}</T>
          ), l.code))}
        </View>
        <Button label="Continue" onPress={() => setStep(2)} />
      </Screen>
    );
  }

  const peaks: [Peak, string, string, IconName][] = [
    ['morning', 'Morning', 'Before 12 noon', 'sun'],
    ['afternoon', 'Afternoon', '12 noon to 5 PM', 'clock'],
    ['evening', 'Evening', 'After 5 PM', 'moon'],
  ];
  return (
    <Screen>
      {steps}
      <T v="title">When do you have the most energy?</T>
      <T muted>Ugent keeps that time for your most important work, and learns from your days over time.</T>
      <View style={{ gap: 10 }}>
        {peaks.map(([v, l, d, ic]) => choice(peak === v, () => setPeak(v), (
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Icon name={ic} color={c.heading} />
            <View><T v="strong">{l}</T><T v="small" muted>{d}</T></View>
          </View>
        ), v))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ flex: 1 }}>
          <T v="strong">Show me a sample day</T>
          <T v="small" muted>See how Ugent works. You can clear it any time.</T>
        </View>
        <Toggle value={sample} onChange={setSample} label="Show me a sample day" />
      </View>
      <Button label="Start using Ugent" onPress={async () => {
        finish({ name: name.trim(), lang, peak, sample });
        await askNotificationPermission().catch(() => false);
      }} />
    </Screen>
  );
}
