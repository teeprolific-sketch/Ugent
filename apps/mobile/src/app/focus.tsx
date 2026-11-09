import { pad } from '@ugent/core';
import { router } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Button, T } from '@/components/ui';
import { reportFocus } from '@/lib/api';
import { useApp } from '@/store';
import { font, useColors } from '@/theme';

export default function Focus() {
  // Keep the screen on during focus (phones only; browsers handle this themselves).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    activateKeepAwakeAsync('focus').catch(() => {});
    return () => { void Promise.resolve(deactivateKeepAwake('focus')).catch(() => {}); };
  }, []);
  const c = useColors();
  const insets = useSafeAreaInsets();
  const focus = useApp((s) => s.focus);
  const endFocus = useApp((s) => s.endFocus);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  // When the session ends (timer or button), show the summary instead of going back.
  useEffect(() => { if (!focus) { void reportFocus(null); router.replace('/focus-summary'); } }, [focus]);
  const waBusiness = useApp((s) => s.cloud.find((x) => x.provider === 'whatsappBusiness')?.connected);

  const left = focus ? Math.max(0, focus.until - now) : 0;
  useEffect(() => {
    if (focus && left <= 0) endFocus();
  }, [focus, left, endFocus]);
  if (!focus) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  const sec = Math.ceil(left / 1000);
  const R = 46;
  const C = 2 * Math.PI * R;
  const progress = left / (focus.mins * 60000);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: 24, paddingHorizontal: 24, paddingTop: insets.top, paddingBottom: insets.bottom + 24 }}>
      <T v="label">Focus mode</T>
      <View style={{ width: 240, height: 240, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="timer" accessibilityLabel={`${Math.floor(sec / 60)} minutes left`}>
        <Svg width={240} height={240} viewBox="0 0 100 100" style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={50} cy={50} r={R} fill="none" stroke={c.line} strokeWidth={4} />
          <Circle cx={50} cy={50} r={R} fill="none" stroke={c.sky} strokeWidth={4} strokeLinecap="round" strokeDasharray={`${C}`} strokeDashoffset={C * (1 - progress)} />
        </Svg>
        <T v="hero" style={{ fontSize: 52, fontFamily: font.bold, fontVariant: ['tabular-nums'] }}>{`${Math.floor(sec / 60)}:${pad(sec % 60)}`}</T>
      </View>
      {focus.label ? <T v="h2" center style={{ maxWidth: 320 }}>{focus.label}</T> : null}
      <View style={{ alignSelf: 'stretch', backgroundColor: c.surface, borderRadius: 16, padding: 16, gap: 8, maxWidth: 420 }}>
        <T v="label">Ugent is holding</T>
        <T v="small">• Its reminders, until you finish</T>
        {waBusiness ? <T v="small">• WhatsApp Business: customers get your auto-reply</T> : null}
        <T v="small" muted>For full quiet, turn on your phone's Do Not Disturb. Calls from your favourites still come through.</T>
      </View>
      <Button kind="ghost" label="End focus" onPress={() => { endFocus(); }} />
    </View>
  );
}
