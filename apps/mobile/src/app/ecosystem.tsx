import type { Product, ScamResult } from '@ugent/core';
import { scamCheck } from '@ugent/core';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { Button, Card, Field, Header, Pill, Screen, Sheet, T, useToast } from '@/components/ui';
import { apiConfigured, ensureSession, request } from '@/lib/api';
import { useApp } from '@/store';
import { useColors } from '@/theme';

const PRODUCTS: { id: Product; name: string; line: string; body: string; icon: IconName }[] = [
  { id: 'sleek', name: 'Sleek', line: 'Verified artisans', icon: 'wrench', body: 'Describe the problem in your own words and Sleek matches you with a verified mechanic, plumber, electrician, cleaner or carpenter near you. Ugent will book them into your plan.' },
  { id: 'idd', name: "ID'd", line: 'Scam protection', icon: 'shield', body: "A personal AI that spots scams and social engineering in calls, SMS and WhatsApp before you lose money. Try the early check below." },
  { id: 'domestica', name: 'Domestica I', line: 'Home robot', icon: 'robot', body: 'A small home robot that sweeps, mops and maps your rooms. Ugent will schedule cleaning around your day and power supply.' },
  { id: 'afrika', name: 'Afrika I', line: 'Farm robot', icon: 'leaf', body: 'Patrols your farm by air and land for security and simple farm help. Ugent will show patrol alerts in your brief.' },
];

export default function Ecosystem() {
  const c = useColors();
  const toast = useToast();
  const waitlist = useApp((s) => s.waitlist);
  const setWaitlist = useApp((s) => s.setWaitlist);
  const [check, setCheck] = useState(false);
  const [text, setText] = useState('');
  const [result, setResult] = useState<ScamResult | null>(null);

  useEffect(() => {
    if (!apiConfigured()) return;
    ensureSession(useApp.getState().profile).then(() => request<{ joined: Product[] }>('GET', '/api/waitlist')).then((r) => setWaitlist(r.joined)).catch(() => {});
  }, [setWaitlist]);

  const join = async (p: Product) => {
    const next = [...new Set([...waitlist, p])];
    setWaitlist(next);
    try {
      if (apiConfigured()) { await ensureSession(useApp.getState().profile); setWaitlist((await request<{ joined: Product[] }>('POST', '/api/waitlist', { product: p })).joined); }
      toast("You're on the list. Ugent will tell you when it's ready.");
    } catch { toast("Saved. Ugent will add you to the list when you're online."); }
  };

  return (
    <Screen>
      <Header back title="Me AI ecosystem" sub="Ugent will connect to the rest of the Me AI family." />
      {PRODUCTS.map((p) => {
        const on = waitlist.includes(p.id);
        return (
          <Card key={p.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' }}><Icon name={p.icon} color={c.skyInk} /></View>
              <View style={{ flex: 1 }}><T v="h3">{p.name}</T><T v="small" muted>{p.line}</T></View>
              <Pill label={on ? 'On the list' : 'Coming soon'} tone={on ? 'good' : 'plain'} icon={on ? 'check' : undefined} />
            </View>
            <T v="small">{p.body}</T>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {!on && <Button compact label="Join the waitlist" style={{ flexGrow: 1 }} onPress={() => void join(p.id)} />}
              {p.id === 'idd' && <Button compact kind={on ? 'primary' : 'ghost'} icon="shield" label="Check a message" style={{ flexGrow: 1 }} onPress={() => { setResult(null); setText(''); setCheck(true); }} />}
            </View>
          </Card>
        );
      })}

      <Sheet visible={check} onClose={() => setCheck(false)} title="Is this a scam?">
        <T v="small" muted>Paste an SMS, WhatsApp or email you're unsure about. It's checked on your phone and not sent anywhere.</T>
        <Field value={text} onChangeText={(v) => { setText(v); setResult(null); }} placeholder="Paste the message here" multiline style={{ minHeight: 120, textAlignVertical: 'top', paddingTop: 14 }} accessibilityLabel="Message to check" />
        <Button label="Check it" disabled={text.trim().length < 10} onPress={() => setResult(scamCheck(text))} />
        {result && (
          <Card tint>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Icon name={result.level === 'low' ? 'check' : 'shield'} color={result.level === 'high' ? c.danger : result.level === 'medium' ? c.warn : c.good} />
              <T v="h3">{result.level === 'high' ? 'This looks like a scam' : result.level === 'medium' ? 'Be careful with this one' : 'No common scam signs found'}</T>
            </View>
            {result.reasons.map((r) => <T key={r} v="small">• {r}</T>)}
            <T v="small" muted>{result.level === 'low' ? 'Still, never share codes, PINs or your BVN.' : "Don't reply, click links or send money. Call the person or your bank on a number you already know."}</T>
          </Card>
        )}
      </Sheet>
    </Screen>
  );
}
