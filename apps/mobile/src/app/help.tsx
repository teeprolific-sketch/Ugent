import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Group } from '@/components/kit';
import { Button, Field, Header, Row, Screen, Section, Segmented, T, useToast } from '@/components/ui';
import { ApiError, apiConfigured, ensureSession, request } from '@/lib/api';
import { intlNumber } from '@/lib/actions';
import { useApp } from '@/store';
import { useColors } from '@/theme';

const FAQ: [string, string][] = [
  ['Does Ugent work without data?', 'Yes. Your plans, tasks, chat, reminders and focus mode all work offline. Ugent syncs and uses its smarter cloud answers when you are back online.'],
  ['Which languages can I use?', 'English, Pidgin, Yoruba, Igbo, Hausa and French. You can mix them in one message. Change the reply language in Settings, Language.'],
  ['Will Ugent send messages or call people by itself?', 'No. Ugent opens WhatsApp, SMS or the phone app with everything ready, and you press send or call. With "Ask before taking actions" on, it also asks before changing your plans.'],
  ['What happens when my plans change?', 'Tap "Plans changed?" on your schedule, or tell Ugent "I\'m stuck in traffic" or "Light don go". It moves flexible plans and never moves fixed ones.'],
  ['How do teams work?', 'On the Team plan you create a team and share the invite code. Plans and tasks you share show on everyone\'s team calendar and board. Personal items stay private.'],
  ['How do I cancel my plan?', 'Subscriptions are managed by the App Store or Google Play. Cancel in your store\'s subscriptions page; you keep your plan until the end of the month.'],
  ['How do I delete my data?', 'Settings, Privacy and memory, Delete my account and data. It is removed from your phone and from Ugent\'s servers.'],
];
const SUPPORT_WA = process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP ?? '';
const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '';

export default function Help() {
  const c = useColors();
  const toast = useToast();
  const [open, setOpen] = useState<number | null>(0);
  const [topic, setTopic] = useState<'question' | 'problem' | 'idea'>('problem');
  const [msg, setMsg] = useState('');
  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      await ensureSession(useApp.getState().profile);
      await request('POST', '/api/support', { topic, message: msg.trim(), contact: contact.trim() || undefined });
      setMsg(''); setContact('');
      toast('Sent. The Me AI team will get back to you.');
    } catch (e) {
      toast(e instanceof ApiError && e.status ? e.message : 'You are offline. Try again when connected.');
    } finally { setSending(false); }
  };

  return (
    <Screen>
      <Header back title="Help and support" />
      <Section title="Common questions">
        <View style={{ gap: 8 }}>
          {FAQ.map(([q, a], i) => (
            <Pressable key={q} onPress={() => setOpen(open === i ? null : i)} accessibilityRole="button" accessibilityState={{ expanded: open === i }}
              style={{ backgroundColor: c.surface, borderRadius: 14, padding: 16, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <T v="strong" style={{ flex: 1 }}>{q}</T>
                <View style={{ transform: [{ rotate: open === i ? '90deg' : '0deg' }] }}><Icon name="chevR" color={c.muted} size={18} /></View>
              </View>
              {open === i && <T v="small">{a}</T>}
            </Pressable>
          ))}
        </View>
      </Section>
      {(SUPPORT_WA || SUPPORT_EMAIL) && (
        <Group title="Talk to us">
          {SUPPORT_WA ? <Row icon="chat" title="Chat with support on WhatsApp" sub={SUPPORT_WA} chevron onPress={() => Linking.openURL(`https://wa.me/${intlNumber(SUPPORT_WA)}`)} /> : null}
          {SUPPORT_EMAIL ? <Row icon="send" title="Email" sub={SUPPORT_EMAIL} /> : null}
        </Group>
      )}
      {apiConfigured() && (
        <Section title="Report a problem or share an idea">
          <Segmented value={topic} onChange={setTopic} options={[['problem', 'Problem'], ['question', 'Question'], ['idea', 'Idea']]} />
          <Field value={msg} onChangeText={setMsg} placeholder="Tell us what happened or what you'd like" multiline style={{ minHeight: 110, textAlignVertical: 'top', paddingTop: 14 }} accessibilityLabel="Your message" />
          <Field value={contact} onChangeText={setContact} placeholder="Phone or email for a reply (optional)" accessibilityLabel="Contact" />
          <Button label={sending ? 'Sending…' : 'Send'} disabled={msg.trim().length < 5 || sending} onPress={() => void send()} />
        </Section>
      )}
    </Screen>
  );
}
