import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { useT } from '@/hooks';
import { font, useColors } from '@/theme';

const TABS: { name: string; key: string; icon: IconName }[] = [
  { name: 'index', key: 'nav.home', icon: 'home' },
  { name: 'chat', key: 'nav.chat', icon: 'chat' },
  { name: 'schedule', key: 'nav.schedule', icon: 'calendar' },
  { name: 'tasks', key: 'nav.tasks', icon: 'tasks' },
  { name: 'more', key: 'nav.more', icon: 'more' },
];

export default function TabsLayout() {
  const c = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.skyInk,
        tabBarInactiveTintColor: c.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.line, height: 64 + insets.bottom, paddingTop: 6, paddingBottom: Math.max(8, insets.bottom) },
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 12 },
      }}>
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{
          title: t(tab.key),
          tabBarIcon: ({ focused }) => <Icon name={tab.icon} color={focused ? c.sky : c.muted} size={24} />,
        }} />
      ))}
    </Tabs>
  );
}
