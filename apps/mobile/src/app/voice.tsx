import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionLines } from '@/components/blocks';
import { Icon } from '@/components/Icon';
import { Button, ButtonRow, IconButton, T, useToast } from '@/components/ui';
import { useLang, useT } from '@/hooks';
import { askUgent } from '@/lib/chat';
import { useRunActions } from '@/lib/useRunActions';
import { speak, useVoiceInput } from '@/lib/voice';
import type { ChatMessage } from '@/store';
import { useApp } from '@/store';
import { font, useColors } from '@/theme';

/** Hands-free conversation: tap the circle, speak, hear the answer. */
export default function VoiceMode() {
  const c = useColors();
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const run = useRunActions();
  const [heard, setHeard] = useState('');
  const [thinking, setThinking] = useState(false);
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  const ask = useCallback(async (text: string) => {
    setHeard(text);
    setThinking(true);
    const s = useApp.getState();
    const history = s.messages;
    s.pushMessage({ from: 'me', text });
    try {
      const r = await askUgent(text, history);
      const m = s.pushMessage({ from: 'ugent', text: r.text, actions: r.actions, draft: r.draft, source: r.source, status: r.actions.length ? 'pending' : undefined });
      setReply(m);
      speak(r.text, lang);
      if (r.actions.length && !useApp.getState().settings.askBeforeAction) { await run(m); setReply({ ...m, status: 'done' }); }
    } finally {
      setThinking(false);
    }
  }, [lang, run]);

  const voice = useVoiceInput(lang, (text) => { void ask(text); }, (err) => toast(err));

  useEffect(() => {
    if (!voice.listening) { pulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.12, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [voice.listening, pulse]);

  const status = voice.listening ? 'Listening…' : thinking ? 'Thinking…' : reply ? 'Tap to reply' : 'Tap to talk';
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T v="label">Voice mode</T>
        <IconButton icon="x" label="Close voice mode" onPress={() => router.back()} />
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        {heard || voice.partial ? <T v="h3" muted center style={{ maxWidth: 320 }}>"{voice.listening ? voice.partial || '…' : heard}"</T> : null}
        <Pressable onPress={voice.toggle} accessibilityRole="button" accessibilityLabel={voice.listening ? 'Stop listening' : 'Start talking'} disabled={thinking}>
          <Animated.View style={{ width: 168, height: 168, borderRadius: 84, backgroundColor: voice.listening ? c.sky : c.surface2, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pulse }] }}>
            <View style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: voice.listening ? '#FFFFFF' : c.sky, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="mic" color={voice.listening ? c.sky : '#FFFFFF'} size={44} strokeWidth={2} />
            </View>
          </Animated.View>
        </Pressable>
        <T v="h2" center>{status}</T>
        {reply && !thinking && (
          <View style={{ gap: 14, alignSelf: 'stretch' }}>
            <T center style={{ fontFamily: font.medium, fontSize: 19, lineHeight: 27 }}>{reply.text}</T>
            {!!reply.actions?.length && reply.status === 'pending' && (
              <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 14, gap: 12 }}>
                <ActionLines actions={reply.actions} />
                <ButtonRow>
                  <Button compact label="Yes, do it" style={{ flexGrow: 1 }} onPress={async () => { await run(reply); setReply({ ...reply, status: 'done' }); }} />
                  <Button compact kind="ghost" label="Not now" style={{ flexGrow: 1 }} onPress={() => { useApp.getState().updateMessage(reply.id, { status: 'cancelled' }); setReply({ ...reply, status: 'cancelled' }); }} />
                </ButtonRow>
              </View>
            )}
            {reply.status === 'done' && <T v="small" muted center>{t('done')}</T>}
          </View>
        )}
      </View>
      <T v="small" muted center>Speak in English, Pidgin, Yoruba, Igbo, Hausa or French. Ugent answers out loud.</T>
    </View>
  );
}
