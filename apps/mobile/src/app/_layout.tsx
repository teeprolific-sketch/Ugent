import { NotoSans_400Regular, NotoSans_500Medium, NotoSans_600SemiBold, NotoSans_700Bold } from '@expo-google-fonts/noto-sans';
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, useFonts } from '@expo-google-fonts/outfit';
import NetInfo from '@react-native-community/netinfo';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { T, ToastProvider } from '@/components/ui';
import { Wordmark } from '@/brand/Logo';
import { initNotifications, scheduleReminders } from '@/lib/notifications';
import { initPurchases } from '@/lib/purchases';
import { syncNow, syncSoon } from '@/lib/sync';
import { refreshCloud, refreshImports } from '@/lib/connections';
import { refreshTeam } from '@/lib/team';
import { useApp } from '@/store';
import { setFontLanguage, useColors, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
initNotifications();
// On web, skip NetInfo's reachability ping (it fetches the site root); Ugent only needs "connected or not".
if (Platform.OS === 'web') NetInfo.configure({ reachabilityShouldRun: () => false });

export default function RootLayout() {
  const c = useColors();
  const themeBase = useTheme().base;
  const [fontsLoaded] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, NotoSans_400Regular, NotoSans_500Medium, NotoSans_600SemiBold, NotoSans_700Bold });
  const lang = useApp((s) => s.profile.lang);
  setFontLanguage(lang);
  const hydrated = useApp((s) => s.hydrated);
  const onboarded = useApp((s) => s.onboarded);
  const ready = fontsLoaded && hydrated;

  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);

  // Background work: sync when the app opens, comes back online or changes; keep reminders current.
  useEffect(() => {
    if (!ready || !onboarded) return;
    const refreshAll = () => { void syncNow().then(() => { void refreshCloud().then(refreshImports); if (useApp.getState().me?.teamId) void refreshTeam(); }); };
    refreshAll();
    const appSub = AppState.addEventListener('change', (st) => { if (st === 'active') refreshAll(); });
    const netSub = NetInfo.addEventListener((st) => { if (st.isConnected) syncSoon(500); });
    const storeSub = useApp.subscribe((s, prev) => {
      if (s.tasks !== prev.tasks || s.events !== prev.events) syncSoon();
      if (s.events !== prev.events || s.focus !== prev.focus || s.settings.reminders !== prev.settings.reminders) void scheduleReminders();
      if (s.me?.id && s.me.id !== prev.me?.id) void initPurchases(s.me.id).catch(() => {});
    });
    return () => { appSub.remove(); netSub(); storeSub(); };
  }, [ready, onboarded]);

  if (!ready) return null;
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <StatusBar style={themeBase === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: Platform.OS === 'android' ? 'fade_from_bottom' : 'default' }}>
          <Stack.Protected guard={onboarded}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="live" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
            <Stack.Screen name="event/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="focus" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
            {['analytics', 'pricing', 'settings', 'team', 'team-admin', 'ecosystem', 'connections/index', 'connections/whatsapp', 'connections/maps',
              'profile', 'privacy', 'notifications', 'language', 'offline', 'help', 'appearance'].map((n) => <Stack.Screen key={n} name={n} />)}
          </Stack.Protected>
          <Stack.Protected guard={!onboarded}>
            <Stack.Screen name="onboarding" />
          </Stack.Protected>
        </Stack>
        <BrandSplash />
      </ToastProvider>
    </SafeAreaProvider>
  );
}

/** A short branded hand-off from the native splash: the wordmark, "by Me AI", then a fade. */
function BrandSplash() {
  const c = useColors();
  const opacity = useRef(new Animated.Value(1)).current;
  const [done, setDone] = useState(false);
  useEffect(() => {
    Animated.timing(opacity, { toValue: 0, duration: 350, delay: 900, useNativeDriver: Platform.OS !== 'web' }).start(() => setDone(true));
  }, [opacity]);
  if (done) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', opacity }]}>
      <View style={{ alignItems: 'center', gap: 14 }}>
        <Wordmark width={200} />
        <T v="small" muted style={{ fontFamily: 'Outfit_500Medium', letterSpacing: 0.4 }}>by Me AI</T>
      </View>
    </Animated.View>
  );
}
