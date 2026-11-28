import { NotoSans_400Regular, NotoSans_500Medium, NotoSans_600SemiBold, NotoSans_700Bold } from '@expo-google-fonts/noto-sans';
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, useFonts } from '@expo-google-fonts/outfit';
import NetInfo from '@react-native-community/netinfo';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Button, T, ToastProvider } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Wordmark } from '@/brand/Logo';
import { initNotifications, scheduleReminders } from '@/lib/notifications';
import { initPurchases } from '@/lib/purchases';
import { syncNow, syncSoon } from '@/lib/sync';
import { refreshPolicy } from '@/lib/policy';
import { refreshCloud, refreshImports } from '@/lib/connections';
import { refreshTeam } from '@/lib/team';
import { registerBackgroundWork } from '@/lib/background';
import { saveData, watchConnection } from '@/lib/data';
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
    watchConnection();
    // Syncing is small and always runs. While saving data, skip the extras (Google, Gmail, team refresh) until asked.
    const refreshAll = () => { void syncNow().then(() => {
      void refreshPolicy(); // tiny; runs even while saving data, so paused actions stop quickly
      if (saveData()) { void refreshImports(); return; }
      void refreshCloud().then(refreshImports);
      if (useApp.getState().me?.teamId) void refreshTeam();
    }); };
    refreshAll();
    void registerBackgroundWork();
    const appSub = AppState.addEventListener('change', (st) => { if (st === 'active') refreshAll(); });
    // Back online after being offline: send what was saved meanwhile. (The listener also fires once at start; skip that.)
    let wasOnline: boolean | null = null;
    const netSub = NetInfo.addEventListener((st) => {
      const online = st.isConnected !== false;
      if (online && wasOnline === false) syncSoon(500);
      wasOnline = online;
    });
    const storeSub = useApp.subscribe((s, prev) => {
      // Sync when something new is waiting to go up (not when a sync itself just brought changes down).
      const waiting = (x: typeof s) => x.sync.dirtyTasks.length + x.sync.dirtyEvents.length + (x.sync.profileDirty ? 1 : 0);
      if ((s.sync.dirtyTasks !== prev.sync.dirtyTasks || s.sync.dirtyEvents !== prev.sync.dirtyEvents || s.sync.profileDirty !== prev.sync.profileDirty) && waiting(s) > 0) syncSoon();
      if (s.events !== prev.events || s.focus !== prev.focus || s.settings !== prev.settings) void scheduleReminders();
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
            <Stack.Screen name="focus-summary" options={{ presentation: 'fullScreenModal' }} />
            {['analytics', 'pricing', 'settings', 'team', 'team-admin', 'ecosystem', 'connections/index', 'connections/whatsapp', 'connections/maps',
              'profile', 'privacy', 'notifications', 'language', 'offline', 'help', 'appearance', 'memory', 'search'].map((n) => <Stack.Screen key={n} name={n} />)}
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

/** Friendly crash screen: nothing is lost (data is saved on the phone), one tap to try again. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const c = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="wrench" color={c.skyInk} size={32} />
      </View>
      <T v="title" center>Something went wrong</T>
      <T muted center>Your tasks, plans and notes are safe on this phone. Try again, and if it keeps happening, tell us in Help.</T>
      <Button label="Try again" onPress={() => void retry()} style={{ alignSelf: 'stretch' }} />
      {__DEV__ ? <T v="small" muted center selectable>{error.message}</T> : null}
    </View>
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
