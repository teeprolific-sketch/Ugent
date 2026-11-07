import type { Hustle, Lang, Peak } from '@ugent/core';
import { HUSTLE_LABEL, HUSTLES } from '@ugent/core';
import { useState } from 'react';
import { View } from 'react-native';
import { Wordmark } from '@/brand/Logo';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { ChoiceList, Group, LanguageList, TimeChips } from '@/components/kit';
import { Button, Field, LinkButton, Screen, Segmented, T, Toggle } from '@/components/ui';
import { apiConfigured } from '@/lib/api';
import { askNotificationPermission } from '@/lib/notifications';
import { useApp } from '@/store';
import { font, setFontLanguage, useColors } from '@/theme';

const STEPS = 6;
const HUSTLE_ICON: Record<Hustle, IconName> = { office: 'tasks', business: 'tag', freelance: 'car', shift: 'clock', student: 'chart', farmer: 'sun', home: 'heart' };

export default function Onboarding() {
  const c = useColors();
  const finish = useApp((s) => s.finishOnboarding);
  const [step, setStep] = useState(0);
  const [lang, setLang] = useState<Lang>('en');
  const [name, setName] = useState('');
  const [wake, setWake] = useState(6 * 60);
  const [sleep, setSleep] = useState(22 * 60 + 30);
  const [peak, setPeak] = useState<Peak>('morning');
  const [hustle, setHustle] = useState<Hustle | null>(null);
  const [learn, setLearn] = useState(true);
  const [ask, setAsk] = useState(true);
  const [cloud, setCloud] = useState(true);
  const [sample, setSample] = useState(true);

  const progress = (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Step ${step + 1} of ${STEPS}`}>
        {Array.from({ length: STEPS }, (_, i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 4, backgroundColor: i <= step ? c.sky : c.line }} />)}
      </View>
      {step > 0 && <LinkButton label="Back" onPress={() => setStep(step - 1)} />}
    </View>
  );
  const next = (label = 'Continue', disabled = false) => <Button label={label} disabled={disabled} onPress={() => setStep(step + 1)} />;

  if (step === 0) {
    const features: [IconName, string][] = [
      ['chat', 'Talk or type in 6 languages'],
      ['calendar', 'Reschedules when your day changes'],
      ['wifiOff', 'Works offline and on low data'],
      ['lock', 'You stay in control of your data'],
    ];
    return (
      <Screen contentStyle={{ flexGrow: 1 }}>
        {progress}
        <View style={{ gap: 18, paddingTop: 40 }}>
          <Wordmark width={150} />
          <T v="hero">Your day, handled.</T>
          <T v="h3" muted style={{ fontFamily: font.regular, fontSize: 19, lineHeight: 27 }}>
            Ugent plans around traffic, power cuts, family and work that changes. It speaks your language and takes action for you.
          </T>
        </View>
        <View style={{ gap: 14 }}>
          {features.map(([ic, l]) => <View key={l} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><Icon name={ic} color={c.sky} /><T>{l}</T></View>)}
        </View>
        <View style={{ flex: 1 }} />
        {next('Get started')}
      </Screen>
    );
  }

  if (step === 1) {
    return (
      <Screen>
        {progress}
        <View style={{ gap: 6 }}>
          <T v="title">Choose your language</T>
          <T muted>You can mix languages when you talk to Ugent. Change it any time in Settings.</T>
        </View>
        <LanguageList value={lang} onChange={(l) => { setLang(l); setFontLanguage(l); }} />
        {next()}
      </Screen>
    );
  }

  if (step === 2) {
    return (
      <Screen>
        {progress}
        <T v="title">Your daily rhythm</T>
        <Field label="What should I call you?" value={name} onChangeText={setName} placeholder="e.g. Tobi" autoComplete="given-name" textContentType="givenName" />
        <View style={{ gap: 8 }}>
          <T v="strong">When do you usually wake up?</T>
          <TimeChips value={wake} onChange={setWake} options={[300, 330, 360, 390, 420, 480]} />
        </View>
        <View style={{ gap: 8 }}>
          <T v="strong">And go to bed?</T>
          <TimeChips value={sleep} onChange={setSleep} options={[1260, 1320, 1350, 1380, 1410]} />
        </View>
        <View style={{ gap: 8 }}>
          <T v="strong">When do you have the most energy?</T>
          <Segmented value={peak} onChange={setPeak} options={[['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening']]} />
          <T v="small" muted>Ugent keeps that time for important work, and learns your real pattern over time.</T>
        </View>
        {next()}
      </Screen>
    );
  }

  if (step === 3) {
    return (
      <Screen>
        {progress}
        <View style={{ gap: 6 }}>
          <T v="title">What's your hustle?</T>
          <T muted>Ugent plans differently for a trader, a student or a nurse on night shift.</T>
        </View>
        <ChoiceList value={hustle} onChange={setHustle} options={HUSTLES.map((h) => ({ v: h, title: HUSTLE_LABEL[h].title, sub: HUSTLE_LABEL[h].sub, icon: HUSTLE_ICON[h] }))} />
        {next(hustle ? 'Continue' : 'Skip for now')}
      </Screen>
    );
  }

  if (step === 4) {
    const row = (title: string, sub: string, value: boolean, onChange: (v: boolean) => void) => (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}>
        <View style={{ flex: 1, gap: 2 }}><T v="strong">{title}</T><T v="small" muted>{sub}</T></View>
        <Toggle value={value} onChange={onChange} label={title} />
      </View>
    );
    return (
      <Screen>
        {progress}
        <View style={{ gap: 6 }}>
          <T v="title">You're in control</T>
          <T muted>Your plans, tasks and chats live on your phone. Choose what Ugent may do.</T>
        </View>
        <Group>
          {row('Learn from my habits', 'Notes when you finish tasks to find your best time.', learn, setLearn)}
          {row('Ask before taking actions', 'Shows what it will do and waits for your OK.', ask, setAsk)}
          {apiConfigured() && row('Smarter answers when online', 'Sends your message and today\'s plan to Ugent\'s AI. Off: everything stays on the phone.', cloud, setCloud)}
        </Group>
        <T v="small" muted>You can change these, see what Ugent knows, or delete everything in Settings at any time.</T>
        {next()}
      </Screen>
    );
  }

  return (
    <Screen contentStyle={{ flexGrow: 1 }}>
      {progress}
      <View style={{ gap: 10, paddingTop: 24 }}>
        <T v="title">{name ? `All set, ${name}.` : 'All set.'}</T>
        <T muted>Start with a sample day to see how Ugent works, or with an empty plan.</T>
      </View>
      <Group>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}>
          <View style={{ flex: 1, gap: 2 }}><T v="strong">Show me a sample day</T><T v="small" muted>You can clear it any time.</T></View>
          <Toggle value={sample} onChange={setSample} label="Show me a sample day" />
        </View>
      </Group>
      <View style={{ flex: 1 }} />
      <Button label="Start using Ugent" onPress={async () => {
        finish({ name: name.trim(), lang, peak, hustle, wake, sleep, sample, settings: { learn, askBeforeAction: ask, cloudChat: cloud } });
        await askNotificationPermission().catch(() => false);
      }} />
    </Screen>
  );
}
