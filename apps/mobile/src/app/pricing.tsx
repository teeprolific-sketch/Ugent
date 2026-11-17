import type { Plan } from '@ugent/core';
import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { Icon } from '@/components/Icon';
import { Button, Header, LinkButton, Pill, Screen, Sheet, T, useToast } from '@/components/ui';
import { API_URL } from '@/lib/api';
import { buy, getPackages, purchasesAvailable, restore } from '@/lib/purchases';
import { syncNow } from '@/lib/sync';
import { effectivePlan, useApp } from '@/store';
import { useColors } from '@/theme';

const FREE = ['Works fully offline: tasks, plans, reminders, focus and your brief', 'Low data mode, plus automatic data saving on 2G and 3G', 'On-phone assistant in 6 languages, by text or voice', 'Backup and sync of your tasks and plans', '10 smarter online chats a day', 'White and Black themes'];
const PRO = ['Everything in Free', '300 smarter online chats a day', 'Smart scheduling and automatic rescheduling', 'Personal analytics', 'Connected apps: Google Calendar, Gmail, WhatsApp Business and more', 'Me AI ecosystem: Sleek, Domestica I, Afrika I, ID\'d', 'Ugent Blue, more themes and your own custom theme'];
const TEAM = ['Everything in Pro', 'Team home with shared updates', 'Shared team calendar', 'Team tasks board', 'Admin panel: members and roles', 'Advanced team analytics', 'Syncing across everyone on the team', 'Personal and Team workspaces'];

export default function Pricing() {
  const c = useColors();
  const toast = useToast();
  const state = useApp();
  const plan = effectivePlan(state);
  const [pkgs, setPkgs] = useState<Partial<Record<'pro' | 'team', PurchasesPackage>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notReady, setNotReady] = useState(false);

  useEffect(() => { getPackages().then(setPkgs).catch(() => {}); }, []);

  const onPlan = (p: Plan) => state.me && state.setMe({ ...state.me, plan: p });

  const choose = async (which: 'pro' | 'team') => {
    const pkg = pkgs[which];
    if (!purchasesAvailable() || !pkg) { setNotReady(true); return; }
    setBusy(which);
    try {
      const p = await buy(pkg);
      onPlan(p);
      void syncNow();
      toast(p === which ? `Welcome to ${which === 'pro' ? 'Pro' : 'Team'}` : 'Purchase complete');
    } catch (e: unknown) {
      if (!(e as { userCancelled?: boolean })?.userCancelled) toast('The purchase did not go through. You have not been charged.');
    } finally {
      setBusy(null);
    }
  };

  const card = (id: 'pro' | 'team', name: string, tag: string, price: string, items: string[], featured: boolean) => {
    const current = plan === id;
    const storePrice = pkgs[id]?.product.priceString;
    return (
      <View style={{ borderWidth: 1.5, borderColor: featured ? c.sky : c.line, borderRadius: 18, padding: 22, gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T v="h2">{name}</T>
          <Pill label={tag} tone={featured ? 'sky' : 'plain'} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <T v="hero">{storePrice ?? price}</T>
          <T muted>/ month</T>
        </View>
        <View style={{ gap: 10 }}>
          {items.map((x) => <View key={x} style={{ flexDirection: 'row', gap: 10 }}><Icon name="check" color={c.sky} size={20} /><T style={{ flex: 1 }}>{x}</T></View>)}
        </View>
        <Button label={current ? 'Your plan' : busy === id ? 'Opening…' : `Choose ${name}`} kind={featured ? 'primary' : 'ghost'} disabled={current || !!busy} onPress={() => void choose(id)} />
      </View>
    );
  };

  const store = Platform.OS === 'ios' ? 'App Store' : 'Google Play';
  return (
    <Screen>
      <Header back title="Plans" sub="Simple prices. Cancel any time." />
      <View style={{ borderWidth: 1.5, borderColor: c.line, borderRadius: 18, padding: 22, gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T v="h2">Free</T>
          <Pill label={plan === 'free' ? 'Your plan' : 'Always included'} tone={plan === 'free' ? 'good' : 'plain'} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <T v="hero">$0</T>
          <T muted>forever</T>
        </View>
        <View style={{ gap: 10 }}>
          {FREE.map((x) => <View key={x} style={{ flexDirection: 'row', gap: 10 }}><Icon name="check" color={c.sky} size={20} /><T style={{ flex: 1 }}>{x}</T></View>)}
        </View>
      </View>
      {card('pro', 'Pro', 'For you', '$2', PRO, true)}
      {card('team', 'Team', 'Teams and companies', '$21', TEAM, false)}
      <View style={{ gap: 10 }}>
        <T v="small" muted>
          The Free plan never expires: offline use, low data mode and backup are included on every plan, with up to 10 smarter online chats a day.
          Subscriptions renew every month until you cancel. Payment is charged to your {store} account. Manage or cancel in your {store} subscriptions.
        </T>
        <View style={{ flexDirection: 'row', gap: 20, flexWrap: 'wrap' }}>
          <LinkButton label="Restore purchases" onPress={async () => {
            if (!purchasesAvailable()) { setNotReady(true); return; }
            try { const p = await restore(); onPlan(p); toast(p === 'free' ? 'No purchases found for this account.' : 'Purchases restored'); } catch { toast('Could not reach the store. Try again.'); }
          }} />
          {plan !== 'free' && Platform.OS !== 'web' ? <LinkButton label="Manage subscription" onPress={() => Linking.openURL(Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions?package=ai.meai.ugent')} /> : null}
          {API_URL ? <LinkButton label="Privacy policy" onPress={() => Linking.openURL(`${API_URL}/privacy`)} /> : null}
        </View>
      </View>
      <Sheet visible={notReady} onClose={() => setNotReady(false)} title="Payments are not set up yet">
        <T muted>This build is not connected to the {Platform.OS === 'web' ? 'app stores' : store} yet, so nothing can be bought or charged. Plans will be available in the store release.</T>
        <Button kind="ghost" label="Close" onPress={() => setNotReady(false)} />
      </Sheet>
    </Screen>
  );
}
