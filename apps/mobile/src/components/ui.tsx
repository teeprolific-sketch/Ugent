import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { StyleProp, TextInputProps, TextStyle, ViewStyle } from 'react-native';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, radius, size, space, useColors } from '@/theme';
import { Icon } from './Icon';
import type { IconName } from './Icon';

const tap = () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); };

/* ---------- Text ---------- */
type Variant = 'hero' | 'title' | 'h2' | 'h3' | 'body' | 'small' | 'label' | 'strong';
export function T({ v = 'body', muted, color, style, children, numberOfLines, center, selectable }: {
  v?: Variant; muted?: boolean; color?: string; style?: StyleProp<TextStyle>; children: ReactNode; numberOfLines?: number; center?: boolean; selectable?: boolean;
}) {
  const c = useColors();
  const base: Record<Variant, TextStyle> = {
    hero: { fontFamily: font.bold, fontSize: size.hero, color: c.heading, letterSpacing: -0.8, lineHeight: size.hero * 1.1 },
    title: { fontFamily: font.bold, fontSize: size.xl, color: c.heading, letterSpacing: -0.3, lineHeight: size.xl * 1.2 },
    h2: { fontFamily: font.semibold, fontSize: size.lg, color: c.heading, lineHeight: size.lg * 1.25 },
    h3: { fontFamily: font.semibold, fontSize: size.base, color: c.ink, lineHeight: size.base * 1.35 },
    body: { fontFamily: font.regular, fontSize: size.base, color: c.ink, lineHeight: size.base * 1.45 },
    strong: { fontFamily: font.semibold, fontSize: size.base, color: c.ink, lineHeight: size.base * 1.4 },
    small: { fontFamily: font.regular, fontSize: size.sm, color: c.ink, lineHeight: size.sm * 1.4 },
    label: { fontFamily: font.semibold, fontSize: 13, color: c.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
  };
  return (
    <Text selectable={selectable} numberOfLines={numberOfLines} style={[base[v], muted && { color: c.muted }, color ? { color } : null, center && { textAlign: 'center' }, style]}>
      {children}
    </Text>
  );
}

/* ---------- Layout ---------- */
export function Screen({ children, scroll = true, footer, padTop = true, contentStyle, scrollRef }: {
  children: ReactNode; scroll?: boolean; footer?: ReactNode; padTop?: boolean; contentStyle?: StyleProp<ViewStyle>; scrollRef?: React.RefObject<React.ComponentRef<typeof ScrollView> | null>;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const pad: ViewStyle = { paddingTop: padTop ? insets.top + 12 : 12, paddingHorizontal: space, paddingBottom: 32, gap: 24 };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {scroll ? (
        <ScrollView ref={scrollRef} contentContainerStyle={[pad, contentStyle]} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
      )}
      {footer}
    </View>
  );
}

export function Header({ title, sub, back, right }: { title: string; sub?: string; back?: boolean; right?: ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      {back && <BackLink />}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <T v="title">{title}</T>
          {sub ? <T muted>{sub}</T> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

function BackLink() {
  const c = useColors();
  return (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/more'))} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 6, alignSelf: 'flex-start' }}>
      <Icon name="chevL" color={c.skyInk} size={20} />
      <T v="strong" color={c.skyInk}>Back</T>
    </Pressable>
  );
}

export function Card({ children, tint, style, onPress, label }: { children: ReactNode; tint?: boolean; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string }) {
  const c = useColors();
  const s: ViewStyle = { backgroundColor: tint ? c.surface2 : c.surface, borderRadius: radius.lg, padding: 18, gap: 12 };
  if (onPress) return <Pressable onPress={() => { tap(); onPress(); }} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [s, pressed && { opacity: 0.85 }, style]}>{children}</Pressable>;
  return <View style={[s, style]}>{children}</View>;
}

export function Section({ title, action, children }: { title: string; action?: { label: string; onPress: () => void }; children: ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <T v="h2">{title}</T>
        {action && <LinkButton label={action.label} onPress={action.onPress} />}
      </View>
      {children}
    </View>
  );
}

export function Divider() {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line }} />;
}

/** A vertical list with hairlines between rows. */
export function List({ children }: { children: ReactNode[] | ReactNode }) {
  const items = (Array.isArray(children) ? children : [children]).flat().filter(Boolean);
  return <View>{items.map((ch, i) => <View key={i}>{i > 0 && <Divider />}{ch}</View>)}</View>;
}

export function Row({ icon, title, sub, right, onPress, danger, chevron }: {
  icon?: IconName; title: string; sub?: string; right?: ReactNode; onPress?: () => void; danger?: boolean; chevron?: boolean;
}) {
  const c = useColors();
  const color = danger ? c.danger : c.ink;
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, minHeight: 56 }}>
      {icon && <Icon name={icon} color={danger ? c.danger : c.heading} />}
      <View style={{ flex: 1, gap: 2 }}>
        <T v="strong" color={color}>{title}</T>
        {sub ? <T v="small" muted>{sub}</T> : null}
      </View>
      {right}
      {chevron && <Icon name="chevR" color={c.muted} size={20} />}
    </View>
  );
  if (!onPress) return body;
  return <Pressable onPress={() => { tap(); onPress(); }} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => pressed && { opacity: 0.6 }}>{body}</Pressable>;
}

/* ---------- Controls ---------- */
export function Button({ label, onPress, kind = 'primary', icon, disabled, style, compact }: {
  label: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; icon?: IconName; disabled?: boolean; style?: StyleProp<ViewStyle>; compact?: boolean;
}) {
  const c = useColors();
  const bg = kind === 'primary' ? c.sky : kind === 'ghost' ? c.surface : 'transparent';
  const fg = kind === 'primary' ? c.onSky : kind === 'ghost' ? c.heading : c.danger;
  return (
    <Pressable
      onPress={() => { tap(); onPress(); }} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
      style={({ pressed }) => [{
        minHeight: compact ? 46 : 54, borderRadius: radius.md, backgroundColor: bg, paddingHorizontal: 20,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        borderWidth: kind === 'danger' ? 1 : 0, borderColor: c.line, opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      }, style]}>
      {icon && <Icon name={icon} color={fg} size={22} />}
      <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: size.base, color: fg }}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, color }: { icon: IconName; label: string; onPress: () => void; color?: string }) {
  const c = useColors();
  return (
    <Pressable onPress={() => { tap(); onPress(); }} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.surface : 'transparent' })}>
      <Icon name={icon} color={color ?? c.muted} />
    </Pressable>
  );
}

export function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={() => { tap(); onPress(); }} hitSlop={10} accessibilityRole="button">
      <T v="strong" color={c.skyInk}>{label}</T>
    </Pressable>
  );
}

export function ButtonRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{children}</View>;
}

export function Pill({ label, icon, tone = 'plain' }: { label: string; icon?: IconName; tone?: 'plain' | 'sky' | 'good' | 'onCard' }) {
  const c = useColors();
  const bg = tone === 'sky' ? c.surface2 : tone === 'onCard' ? c.bg : c.surface;
  const fg = tone === 'sky' ? c.skyInk : tone === 'good' ? c.good : c.muted;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: bg, alignSelf: 'flex-start' }}>
      {icon && <Icon name={icon} color={fg} size={14} strokeWidth={2} />}
      <Text style={{ fontFamily: font.semibold, fontSize: 13, color: fg }}>{label}</Text>
    </View>
  );
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={() => { tap(); onPress(); }} accessibilityRole="button" accessibilityState={{ selected: !!on }}
      style={{ borderWidth: 1, borderColor: on ? c.sky : c.line, backgroundColor: on ? c.sky : c.bg, borderRadius: 999, paddingHorizontal: 16, minHeight: 42, justifyContent: 'center' }}>
      <Text style={{ fontFamily: font.semibold, fontSize: size.sm, color: on ? c.onSky : c.ink }}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<V extends string | number>({ value, options, onChange }: { value: V; options: [V, string][]; onChange: (v: V) => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.surface, borderRadius: radius.md, padding: 4, gap: 4 }}>
      {options.map(([v, l]) => {
        const on = v === value;
        return (
          <Pressable key={String(v)} onPress={() => { tap(); onChange(v); }} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={{ flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.bg : 'transparent' }}>
            <Text style={{ fontFamily: font.semibold, fontSize: size.sm, color: on ? c.heading : c.muted }}>{l}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const c = useColors();
  // react-native-web reads its own colour props; phones use trackColor/thumbColor.
  const web = Platform.OS === 'web' ? ({ activeThumbColor: '#FFFFFF', activeTrackColor: c.sky } as object) : {};
  return <Switch value={value} onValueChange={(v) => { tap(); onChange(v); }} accessibilityLabel={label} trackColor={{ true: c.sky, false: c.line }} thumbColor="#FFFFFF" ios_backgroundColor={c.line} {...web} />;
}

export function Check({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  const c = useColors();
  return (
    <Pressable onPress={() => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); onPress(); }}
      hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label}
      style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: on ? c.sky : c.muted, backgroundColor: on ? c.sky : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {on && <Icon name="check" color={c.onSky} size={16} strokeWidth={2.4} />}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label?: string }) {
  const c = useColors();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? <T v="small" style={{ fontFamily: font.semibold }}>{label}</T> : null}
      <TextInput
        placeholderTextColor={c.muted}
        {...props}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        style={[{ minHeight: 54, borderRadius: radius.md, borderWidth: 1.5, borderColor: focus ? c.sky : c.line, paddingHorizontal: 16, fontFamily: font.regular, fontSize: size.base, color: c.ink, backgroundColor: c.bg }, props.style]}
      />
    </View>
  );
}

/* ---------- Bottom sheet ---------- */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="Close" />
        <View style={{ backgroundColor: c.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '88%' }}>
          <ScrollView contentContainerStyle={{ padding: space, paddingTop: 10, paddingBottom: insets.bottom + 24, gap: 18 }} keyboardShouldPersistTaps="handled">
            <View style={{ width: 40, height: 5, borderRadius: 5, backgroundColor: c.line, alignSelf: 'center' }} />
            {title ? <T v="h2">{title}</T> : null}
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---------- Toast ---------- */
type ToastFn = (message: string, undo?: () => void) => void;
const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<{ text: string; undo?: () => void } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<ToastFn>((text, undo) => {
    if (timer.current) clearTimeout(timer.current);
    setMsg({ text, undo });
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: Platform.OS !== 'web' }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start(() => setMsg(null));
    }, 4500);
  }, [opacity]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const value = useMemo(() => show, [show]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      {msg && (
        <Animated.View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 84, alignItems: 'center', opacity }}>
          <View accessibilityLiveRegion="polite" style={{ backgroundColor: c.toast, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 16, maxWidth: 440 }}>
            <Text style={{ color: '#FFFFFF', fontFamily: font.semibold, fontSize: size.sm, flexShrink: 1 }}>{msg.text}</Text>
            {msg.undo && (
              <Pressable onPress={() => { msg.undo?.(); setMsg(null); }} hitSlop={10} accessibilityRole="button">
                <Text style={{ color: '#7DD3FC', fontFamily: font.bold, fontSize: size.sm }}>Undo</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}
    </ToastCtx.Provider>
  );
}
