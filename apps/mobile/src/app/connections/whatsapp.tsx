import { fmtDate } from '@ugent/core';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { Group } from '@/components/kit';
import { Button, Card, Field, Header, List, Pill, Row, Screen, Section, T, Toggle, useToast } from '@/components/ui';
import { useLang } from '@/hooks';
import { ApiError, apiConfigured, ensureSession, request } from '@/lib/api';
import { connect, disconnect, refreshCloud } from '@/lib/connections';
import { fmtTime } from '@/lib/format';
import { effectivePlan, plannerState, useApp } from '@/store';

interface Biz { available: boolean; canSend: boolean; settings: { phoneNumberId: string; displayNumber: string; autoReplyOn: boolean; autoReply: string } | null; inbox: { id: string; from: string; text: string; autoReplied: boolean; at: number }[] }

export default function WhatsApp() {
  const toast = useToast();
  const lang = useLang();
  const state = useApp();
  const plan = effectivePlan(state);
  const on = !!state.connections.whatsapp?.on;
  const [biz, setBiz] = useState<Biz | null>(null);
  const [form, setForm] = useState({ phoneNumberId: '', displayNumber: '', autoReplyOn: true, autoReply: "Thanks for your message. I'm focused on work right now and will reply soon." });
  const [tpl, setTpl] = useState(state.settings.lateTemplate);

  const load = useCallback(async () => {
    if (!apiConfigured()) return;
    try {
      await ensureSession(useApp.getState().profile);
      const b = await request<Biz>('GET', '/api/integrations/whatsapp-business');
      setBiz(b);
      if (b.settings) setForm(b.settings);
    } catch { /* offline */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const shareDay = () => {
    const d0 = fmtDate(new Date());
    const f = fmtTime(lang);
    const evs = plannerState(state).events.filter((e) => e.date === d0).sort((a, b) => a.start.localeCompare(b.start));
    const text = evs.length ? `My plan for today:\n${evs.map((e) => `${f(e.start)} ${e.title}`).join('\n')}` : 'My day is free today.';
    void Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`).catch(() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`));
  };

  const saveBiz = async () => {
    try {
      await request('PUT', '/api/integrations/whatsapp-business', form);
      await refreshCloud(); await load();
      toast('WhatsApp Business connected');
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Could not save. Try again when online.'); }
  };

  return (
    <Screen>
      <Header back title="WhatsApp" sub="Message people from Ugent. You always press send yourself." />
      <Section title="WhatsApp">
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T v="h3">Personal WhatsApp</T>
            <Pill label={on ? 'Connected' : 'Not connected'} tone={on ? 'good' : 'plain'} />
          </View>
          <T v="small">Ugent opens WhatsApp with your message ready: running-late notes, plans you share, and messages you ask for in chat, like "Tell Kemi I'm on my way".</T>
          {on ? <Button kind="ghost" label="Disconnect" onPress={async () => toast(await disconnect('whatsapp'))} /> : <Button label="Connect WhatsApp" onPress={async () => toast(await connect('whatsapp'))} />}
        </Card>
        {on && (
          <Group>
            <Row icon="send" title="Share today's plan" sub="Send your schedule to family or your team" onPress={shareDay} />
          </Group>
        )}
        <Field label="Running-late message" value={tpl} onChangeText={setTpl} onBlur={() => state.setSettings({ lateTemplate: tpl })} multiline style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 14 }} />
        <T v="small" muted>{'{mins}'} and {'{reason}'} are filled in for you.</T>
      </Section>

      <Section title="WhatsApp Business">
        {plan === 'free' ? (
          <Card><T>Auto-replies for your customers come with Pro and Team.</T><Button label="See plans" onPress={() => router.push('/pricing')} /></Card>
        ) : !apiConfigured() || (biz && !biz.available) ? (
          <Card><T>Me AI is setting up WhatsApp Business on the Ugent server. It will appear here when it's ready.</T></Card>
        ) : (
          <>
            <T v="small" muted>While you are in Focus mode, Ugent replies to customers who write to your business number, so no one feels ignored.</T>
            <Field label="Business number" value={form.displayNumber} onChangeText={(v) => setForm({ ...form, displayNumber: v })} placeholder="+234 801 234 5678" keyboardType="phone-pad" />
            <Field label="Phone number ID (from Me AI onboarding)" value={form.phoneNumberId} onChangeText={(v) => setForm({ ...form, phoneNumberId: v.trim() })} placeholder="e.g. 109876543210987" keyboardType="number-pad" />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ flex: 1 }}><T v="strong">Auto-reply while I focus</T><T v="small" muted>Sent once per customer message.</T></View>
              <Toggle value={form.autoReplyOn} onChange={(v) => setForm({ ...form, autoReplyOn: v })} label="Auto-reply while I focus" />
            </View>
            <Field label="Auto-reply" value={form.autoReply} onChangeText={(v) => setForm({ ...form, autoReply: v })} multiline style={{ minHeight: 90, textAlignVertical: 'top', paddingTop: 14 }} />
            <Button label={biz?.settings ? 'Save' : 'Connect business number'} disabled={form.phoneNumberId.length < 5} onPress={() => void saveBiz()} />
            {biz?.settings && (
              <>
                <T v="label">Recent customer messages</T>
                {biz.inbox.length ? (
                  <List>{biz.inbox.slice(0, 8).map((m) => <Row key={m.id} title={`+${m.from}`} sub={m.text} right={m.autoReplied ? <Pill label="Replied" tone="good" /> : undefined} />)}</List>
                ) : <T muted>No customer messages yet.</T>}
                <Button kind="danger" label="Disconnect business number" onPress={async () => { toast(await disconnect('whatsappBusiness')); setBiz(null); void load(); }} />
              </>
            )}
          </>
        )}
      </Section>
    </Screen>
  );
}
