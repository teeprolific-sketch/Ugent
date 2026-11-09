import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionLines } from '@/components/blocks';
import { Icon } from '@/components/Icon';
import { Button, ButtonRow, T, useToast } from '@/components/ui';
import { useLang, useT } from '@/hooks';
import { askUgent } from '@/lib/chat';
import { parseCommand } from '@/lib/commands';
import { isGoodbye, isNo, isYes } from '@/lib/live';
import { useRunActions } from '@/lib/useRunActions';
import { speak, stopSpeaking, useVoiceInput } from '@/lib/voice';
import type { ChatMessage } from '@/store';
import { useApp } from '@/store';
import { font, radius, space, useColors } from '@/theme';

type Phase = 'listening' | 'thinking' | 'speaking' | 'paused' | 'unavailable';
interface Turn { id: string; from: 'me' | 'ugent'; text: string }

/** Live conversation: Ugent listens, answers out loud, and listens again, until you end it. */
export default function Live() {
  const c = useColors();
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const run = useRunActions();
  const [phase, setPhase] = useState<Phase>('listening');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState<ChatMessage | null>(null);
  const active = useRef(true);
  const gotFinal = useRef(false);
  const phaseRef = useRef<Phase>('listening');
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const setP = (p: Phase) => { phaseRef.current = p; setPhase(p); };
  const addTurn = (from: Turn['from'], text: string) => setTurns((x) => [...x, { id: `${Date.now()}-${x.length}`, from, text }].slice(-12));

  const handlerRef = useRef<(text: string) => void>(() => {});
  const voice = useVoiceInput(lang, (text) => handlerRef.current(text), (msg) => { setP('unavailable'); toast(msg); }, {
    // Silence or a pause: keep the conversation going.
    onEnd: () => { if (active.current && !gotFinal.current && phaseRef.current === 'listening') setTimeout(() => listen(), 350); },
  });

  const listen = useCallback(() => {
    if (!active.current) return;
    gotFinal.current = false;
    setP('listening');
    void voice.start().then((ok) => { if (!ok) setP('unavailable'); });
  }, [voice]);

  const say = useCallback((text: string, then: () => void = listen) => {
    addTurn('ugent', text);
    setP('speaking');
    speak(text, lang, () => { if (active.current) then(); });
  }, [lang, listen]);

  const end = useCallback(() => {
    active.current = false;
    voice.stop();
    stopSpeaking();
    router.back();
  }, [voice]);

  handlerRef.current = async (text: string) => {
    gotFinal.current = true;
    addTurn('me', text);
    if (isGoodbye(text)) { say(t('done'), end); return; }
    if (pending && isYes(text)) { await run(pending); setPending(null); say(t('done')); return; }
    if (pending && isNo(text)) { useApp.getState().updateMessage(pending.id, { status: 'cancelled' }); setPending(null); say(t('cancelled')); return; }
    const s = useApp.getState();
    // App commands run straight away: settings change while Live keeps listening; "open …" closes Live and goes there.
    const cmd = parseCommand(text);
    if (cmd) {
      s.pushMessage({ from: 'me', text });
      s.pushMessage({ from: 'ugent', text: cmd.say });
      await cmd.run?.();
      if (cmd.href) {
        const href = cmd.href;
        say(cmd.say, () => { end(); setTimeout(() => router.push(href), 350); });
      } else say(cmd.say);
      return;
    }
    setP('thinking');
    const history = s.messages;
    s.pushMessage({ from: 'me', text });
    try {
      const r = await askUgent(text, history);
      const m = s.pushMessage({ from: 'ugent', text: r.text, actions: r.actions, draft: r.draft, source: r.source, status: r.actions.length ? 'pending' : undefined });
      if (r.actions.length && useApp.getState().settings.askBeforeAction) setPending(m);
      else if (r.actions.length) await run(m);
      if (active.current) say(r.text);
    } catch {
      if (active.current) say('Sorry, I missed that. Please say it again.');
    }
  };

  // Start listening when Live opens; stop everything when it closes.
  useEffect(() => {
    listen();
    return () => { active.current = false; voice.stop(); stopSpeaking(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'listening' && phase !== 'speaking') { pulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: phase === 'listening' ? 1.14 : 1.06, duration: phase === 'listening' ? 750 : 380, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(pulse, { toValue: 1, duration: phase === 'listening' ? 750 : 380, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [phase, pulse]);

  const label = { listening: 'Listening…', thinking: 'Thinking…', speaking: 'Ugent is speaking', paused: 'Paused', unavailable: 'Microphone not available' }[phase];
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: phase === 'paused' || phase === 'unavailable' ? c.muted : c.danger }} />
          <T v="h2">Live with Ugent</T>
        </View>
        <Pressable onPress={end} accessibilityRole="button" accessibilityLabel="End live conversation"
          style={{ paddingHorizontal: 14, minHeight: 40, borderRadius: 20, backgroundColor: c.danger, justifyContent: 'center' }}>
          <T v="strong" color="#FFFFFF">End</T>
        </Pressable>
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: space, gap: 12, flexGrow: 1, justifyContent: 'flex-end' }}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        {!turns.length && <T muted center>Speak naturally, in any of your languages. Ugent answers out loud and keeps listening. Say "bye" when you're done.</T>}
        {turns.map((x) => (
          <View key={x.id} style={x.from === 'me'
            ? { alignSelf: 'flex-end', maxWidth: '86%', backgroundColor: c.surface2, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 18, borderBottomRightRadius: 4 }
            : { alignSelf: 'flex-start', maxWidth: '90%' }}>
            {x.from === 'ugent' && <T v="small" color={c.skyInk} style={{ fontFamily: font.bold }}>Ugent</T>}
            <T style={x.from === 'ugent' ? { fontFamily: font.medium, fontSize: 19, lineHeight: 27 } : undefined}>{x.text}</T>
          </View>
        ))}
        {phase === 'listening' && !!voice.partial && <T muted style={{ alignSelf: 'flex-end' }}>{voice.partial}…</T>}
        {pending && (
          <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: radius.md, padding: 14, gap: 12 }}>
            <ActionLines actions={pending.actions ?? []} />
            <T v="small" muted>Say "yes" or "no", or tap.</T>
            <ButtonRow>
              <Button compact label="Yes, do it" style={{ flexGrow: 1 }} onPress={async () => { const p = pending; setPending(null); await run(p); say(t('done')); }} />
              <Button compact kind="ghost" label="Not now" style={{ flexGrow: 1 }} onPress={() => { useApp.getState().updateMessage(pending.id, { status: 'cancelled' }); setPending(null); say(t('cancelled')); }} />
            </ButtonRow>
          </View>
        )}
      </ScrollView>

      <View style={{ alignItems: 'center', gap: 14, paddingHorizontal: space }}>
        <Animated.View style={{ width: 132, height: 132, borderRadius: 66, alignItems: 'center', justifyContent: 'center', backgroundColor: phase === 'listening' ? c.surface2 : c.surface, transform: [{ scale: pulse }] }}>
          <View style={{ width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: phase === 'paused' || phase === 'unavailable' ? c.muted : c.sky }}>
            <Icon name={phase === 'speaking' ? 'wave' : phase === 'thinking' ? 'dots' : 'mic'} color={c.onSky} size={38} strokeWidth={2.2} />
          </View>
        </Animated.View>
        <T v="strong" center accessibilityLiveRegion="polite">{label}</T>
        {phase === 'unavailable' ? (
          <T v="small" muted center>Live needs the microphone. On a phone, allow microphone access for Ugent, then try again.</T>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {phase === 'paused' || phase === 'unavailable' ? (
            <Button compact label={phase === 'paused' ? 'Resume' : 'Try again'} icon="mic" onPress={() => { active.current = true; listen(); }} />
          ) : (
            <Button compact kind="ghost" label="Pause" onPress={() => { active.current = false; voice.stop(); stopSpeaking(); setP('paused'); }} />
          )}
        </View>
      </View>
    </View>
  );
}
