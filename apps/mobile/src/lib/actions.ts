/* Real-world actions: call, message (WhatsApp or SMS) and directions. Ugent opens the app with
 * everything filled in; the user presses Call or Send themselves. Nothing is sent silently. */
import type { Action } from '@ugent/core';
import { Linking, Platform } from 'react-native';
import { useApp } from '@/store';

type Ext = Extract<Action, { type: 'call' | 'message' | 'directions' }>;

/** Nigerian numbers to international form for WhatsApp: 0803 123 4567 -> 2348031234567. */
export function intlNumber(phone: string): string {
  const d = phone.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) return d.slice(1);
  if (d.startsWith('0') && d.length === 11) return '234' + d.slice(1);
  return d;
}

/** Looks a name up in the phone's contacts (only if the user connected Phone & contacts). */
export async function findNumber(name: string): Promise<string | null> {
  if (Platform.OS === 'web' || !useApp.getState().connections.phone?.on) return null;
  try {
    const Contacts = await import('expo-contacts/legacy');
    const { data } = await Contacts.getContactsAsync({ name, fields: [Contacts.Fields.PhoneNumbers], pageSize: 5 });
    const hit = data.find((c) => c.phoneNumbers?.length);
    return hit?.phoneNumbers?.[0]?.number ?? null;
  } catch {
    return null;
  }
}

export const directionsUrl = (destination: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;

/** Runs one action. Returns a sentence for the user if something needs their attention. */
export async function perform(a: Ext): Promise<string | null> {
  const s = useApp.getState();
  if (a.type === 'directions') {
    s.notePlace(a.destination);
    await Linking.openURL(directionsUrl(a.destination));
    return null;
  }
  // Ugent remembers numbers it has found before, so "Call Mum" works even without contacts access next time.
  const known = a.name ? s.memory.people[a.name.trim().toLowerCase()]?.phone ?? null : null;
  const phone = a.phone ?? known ?? (a.name ? await findNumber(a.name) : null);
  if (a.name) s.notePerson(a.name, phone);
  if (a.type === 'call') {
    if (!phone) {
      await Linking.openURL('tel:').catch(() => {});
      return `I could not find a number for ${a.name}. Connect Phone & contacts, or dial it yourself.`;
    }
    await Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
    return null;
  }
  if (a.channel === 'sms') {
    if (Platform.OS !== 'web') {
      try {
        const SMS = await import('expo-sms');
        if (await SMS.isAvailableAsync()) { await SMS.sendSMSAsync(phone ? [phone] : [], a.text); return null; }
      } catch { /* fall back to the sms: link */ }
    }
    await Linking.openURL(`sms:${phone ?? ''}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(a.text)}`);
    return null;
  }
  const text = encodeURIComponent(a.text);
  const app = phone ? `whatsapp://send?phone=${intlNumber(phone)}&text=${text}` : `whatsapp://send?text=${text}`;
  const web = phone ? `https://wa.me/${intlNumber(phone)}?text=${text}` : `https://wa.me/?text=${text}`;
  await Linking.openURL(app).catch(() => Linking.openURL(web));
  return phone ? null : `Pick ${a.name ?? 'the person'} in WhatsApp, then press send.`;
}
