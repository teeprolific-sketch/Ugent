import { pad } from '@ugent/core';
import { router } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Button, T, useToast } from '@/components/ui';
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
  const toast = useToast();
  const focus = useApp((s) => s.focus);
  const endFocus = useApp((s) => s.endFocus);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { if (!focus) router.back(); }, [focus]);

  const left = focus ? Math.max(0, focus.until - now) : 0;
  useEffect(() => {
    if (focus && left <= 0) { const mins = endFocus(); toast(`Well done. ${mins} minutes of focus.`); }
  }, [focus, left, endFocus, toast]);
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
      <T v="h2" center>Ugent is holding your reminders</T>
      <T muted center style={{ maxWidth: 300 }}>Put your phone face down. Reminders will wait quietly until the {focus.mins} minutes are up.</T>
      <Button kind="ghost" label="End focus" onPress={() => { const mins = endFocus(); toast(mins >= 1 ? `Focus ended. ${mins} min logged.` : 'Focus ended.'); }} />
    </View>
  );
}
