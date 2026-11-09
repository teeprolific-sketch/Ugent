import { langMeta, t as translate } from '@ugent/core';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { ActionLines, DraftBlock } from '@/components/blocks';
import { Button, ButtonRow, Chip, IconButton, Pill, T, useToast, webNoOutline } from '@/components/ui';
import { useLang, useOnline, useT } from '@/hooks';
import { askUgent } from '@/lib/chat';
import { parseCommand } from '@/lib/commands';
import { useRunActions } from '@/lib/useRunActions';
import { EmptyState } from '@/components/kit';
import { speak, useVoiceInput } from '@/lib/voice';
import type { ChatMessage } from '@/store';
import { useApp } from '@/store';
import { font, radius, size, space, useColors } from '@/theme';

const SUGGEST: Record<string, string[]> = {
  en: ["What's my day?", "I'm stuck in traffic", 'Remind me to call Mum at 6pm', 'Focus for 50 minutes'],
  pcm: ['Wetin dey my day?', 'Traffic don hold me', 'Remind me make I call Mama by 6pm', 'Light don go'],
  yo: ['Kí ló wà fún mi lónìí?', 'Iná ti lọ', 'Rán mi létí láti pe Màmá ní 6pm', 'Ó rẹ̀ mí'],
  ig: ['Gịnị dị taa?', 'Ọkụ anyụọla', 'Chetara m ịkpọ Mama na 6pm', 'Ike gwụrụ m'],
  ha: ['Me ke gare ni yau?', 'Babu wuta', 'Tunatar da ni in kira Mama da 6pm', 'Na gaji'],
  fr: ["Qu'est-ce que j'ai aujourd'hui ?", 'Je suis dans les embouteillages', "Rappelle-moi d'appeler Maman à 18h", 'Coupure de courant'],
};

export default function Chat() {
  const c = useColors();
  const t = useT();
  const lang = useLang();
  const online = useOnline();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const messages = useApp((s) => s.messages);
  // Undo stays available on the latest action Ugent took that changed tasks or plans.
  const undoBy = useApp((s) => s.undo?.by);
  const UNDOABLE = ['addTask', 'addEvent', 'reschedule', 'moveEvent', 'completeTask'];
  const lastActed = [...messages].reverse().find((m) => m.actions?.length && m.status && m.status !== 'pending' && m.status !== 'cancelled');
  const undoId = lastActed?.status === 'done' && lastActed.actions!.some((a) => UNDOABLE.includes(a.type)) ? lastActed.id : null;
  const profile = useApp((s) => s.profile);
  const settings = useApp((s) => s.settings);
  const { pushMessage, updateMessage, clearChat } = useApp.getState();
  const runMessage = useRunActions();
  const [text, setText] = useState('');
  const [thinking, setThinking] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    if (!useApp.getState().messages.length) {
      pushMessage({ from: 'ugent', text: `${translate(lang, 'greet', { name: profile.name })} ${translate(lang, 'help')}` });
    }
  }, [lang, profile.name, pushMessage]);

  const run = useCallback((m: ChatMessage) => { void runMessage(m); }, [runMessage]);

  const send = useCallback(async (raw: string) => {
    const msg = raw.trim();
    if (!msg || thinking) return;
    setText('');
    const history = useApp.getState().messages;
    pushMessage({ from: 'me', text: msg });
    // App commands ("open my tasks", "switch to black theme") run on the phone straight away.
    const cmd = parseCommand(msg);
    if (cmd) {
      pushMessage({ from: 'ugent', text: cmd.say });
      await cmd.run?.();
      if (useApp.getState().settings.voiceReplies) speak(cmd.say, lang);
      if (cmd.href) setTimeout(() => router.push(cmd.href!), 300);
      return;
    }
    setThinking(true);
    try {
      const reply = await askUgent(msg, history);
      const m = pushMessage({ from: 'ugent', text: reply.text, actions: reply.actions, draft: reply.draft, source: reply.source, status: reply.actions.length ? 'pending' : undefined });
      if (reply.actions.length && !useApp.getState().settings.askBeforeAction) run(m);
      if (useApp.getState().settings.voiceReplies) speak(reply.text, lang);
    } finally {
      setThinking(false);
    }
  }, [thinking, pushMessage, run, lang]);

  const voice = useVoiceInput(lang, (spoken) => { void send(spoken); }, (err) => toast(err));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: space, paddingBottom: 8, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ gap: 2 }}>
          <T v="title">Ugent</T>
          <T v="small" muted>{online && !settings.lowData ? 'Online' : 'Offline, still working'} · {langMeta(lang).native}</T>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Pressable onPress={() => router.push('/live')} accessibilityRole="button" accessibilityLabel="Talk live with Ugent"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 40, borderRadius: 20, backgroundColor: c.sky, marginRight: 4 }}>
            <Icon name="wave" color={c.onSky} size={18} strokeWidth={2.2} />
            <T v="strong" color={c.onSky}>Live</T>
          </Pressable>
          <IconButton icon="trash" label="Clear chat" onPress={() => { clearChat(); }} />
        </View>
      </View>

      <ScrollView ref={scroll} contentContainerStyle={{ padding: space, gap: 14 }} keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
        {messages.length <= 1 && (
          <EmptyState icon="chat" title="Ask Ugent anything about your day" body="Plan, reschedule, set reminders, call or message someone, or get directions. Type, or tap Live to talk with Ugent out loud." action={{ label: 'Talk live', onPress: () => router.push('/live') }} />
        )}
        {messages.map((m) => m.from === 'me' ? (
          <View key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '86%', backgroundColor: c.surface2, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 18, borderBottomRightRadius: 4 }}>
            <T>{m.text}</T>
          </View>
        ) : (
          <View key={m.id} style={{ alignSelf: 'flex-start', maxWidth: '90%', gap: 4 }}>
            <T v="small" color={c.skyInk} style={{ fontFamily: font.bold }}>Ugent</T>
            <T>{m.text}</T>
            {!!m.actions?.length && (
              <View style={{ marginTop: 8, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, padding: 14, gap: 12 }}>
                <ActionLines actions={m.actions} />
                {m.status === 'pending' && (
                  <>
                    <T v="small" muted>{t('confirm')}</T>
                    <ButtonRow>
                      <Button compact label="Yes, do it" style={{ flexGrow: 1, flexBasis: 110 }} onPress={() => run(m)} />
                      <Button compact kind="ghost" label="Not now" style={{ flexGrow: 1, flexBasis: 110 }} onPress={() => updateMessage(m.id, { status: 'cancelled' })} />
                    </ButtonRow>
                  </>
                )}
                {m.status === 'done' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Pill label={t('done')} icon="check" tone="good" />
                    {m.id === undoId && undoBy === m.id && <Button compact kind="ghost" label="Undo" onPress={() => { useApp.getState().restore(); updateMessage(m.id, { status: 'undone' }); }} />}
                  </View>
                )}
                {m.status === 'undone' && <Pill label="Undone" />}
                {m.status === 'cancelled' && <Pill label={t('cancelled')} />}
              </View>
            )}
            {m.draft && (
              <View style={{ marginTop: 8, borderWidth: 1, borderColor: c.line, borderRadius: radius.md, padding: 14 }}>
                <DraftBlock text={m.draft} intro={m.actions?.length ? 'Message for the people waiting on you:' : undefined} />
              </View>
            )}
          </View>
        ))}
        {thinking && <T v="small" muted>Ugent is thinking…</T>}
        {messages.length < 4 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {(SUGGEST[lang] ?? SUGGEST.en).map((s) => <Chip key={s} label={s} onPress={() => void send(s)} />)}
          </View>
        )}
      </ScrollView>

      <View style={{ borderTopWidth: 1, borderTopColor: c.line, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: c.bg }}>
        <Pressable onPress={voice.toggle} accessibilityRole="button" accessibilityLabel={voice.listening ? 'Stop listening' : 'Speak'}
          style={{ width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: voice.listening ? c.danger : c.surface }}>
          <Icon name="mic" color={voice.listening ? '#FFFFFF' : c.heading} />
        </Pressable>
        <TextInput
          value={voice.listening ? voice.partial : text} onChangeText={setText} placeholder={voice.listening ? 'Listening…' : t('chat.placeholder')}
          placeholderTextColor={c.muted} onSubmitEditing={() => void send(text)} returnKeyType="send" accessibilityLabel="Message"
          style={[{ flex: 1, minWidth: 0, minHeight: 50, borderRadius: 25, paddingHorizontal: 18, backgroundColor: c.surface, color: c.ink, fontFamily: font.regular, fontSize: size.base }, webNoOutline]} />
        <Pressable onPress={() => void send(text)} accessibilityRole="button" accessibilityLabel="Send"
          style={{ width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: c.sky, opacity: text.trim() ? 1 : 0.6 }}>
          <Icon name="send" color="#FFFFFF" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
