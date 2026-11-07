import DateTimePicker from '@react-native-community/datetimepicker';
import { pad } from '@ugent/core';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useLang } from '@/hooks';
import { fmtTime } from '@/lib/format';
import { font, radius, size, useColors } from '@/theme';
import { Field, LinkButton, T } from './ui';

/** Optional time of day ("HH:MM" or ''), using the phone's own time picker. */
export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const c = useColors();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  if (Platform.OS === 'web') {
    return <Field label={label} value={value} onChangeText={(v) => onChange(v.replace(/[^\d:]/g, '').slice(0, 5))} placeholder="HH:MM" />;
  }
  const base = new Date();
  if (value) { const [h, m] = value.split(':').map(Number); base.setHours(h, m, 0, 0); }
  return (
    <View style={{ gap: 6 }}>
      <T v="small" style={{ fontFamily: font.semibold }}>{label}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label}: ${value || 'not set'}`}
          style={{ flex: 1, minHeight: 54, borderRadius: radius.md, borderWidth: 1.5, borderColor: c.line, paddingHorizontal: 16, justifyContent: 'center' }}>
          <T style={{ fontSize: size.base, color: value ? c.ink : c.muted }}>{value ? fmtTime(lang)(value) : 'Pick a time'}</T>
        </Pressable>
        {value ? <LinkButton label="Clear" onPress={() => onChange('')} /> : null}
      </View>
      {open && (
        <DateTimePicker value={base} mode="time" is24Hour={lang === 'fr'} display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(e, d) => {
            if (Platform.OS === 'android') setOpen(false);
            if (e.type === 'set' && d) onChange(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
            if (e.type === 'dismissed') setOpen(false);
          }} />
      )}
      {open && Platform.OS === 'ios' && <LinkButton label="Done" onPress={() => setOpen(false)} />}
    </View>
  );
}
