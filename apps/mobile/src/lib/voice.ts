/* Talk to Ugent: speech-to-text for input, text-to-speech for replies. */
import type { Lang } from '@ugent/core';
import { langMeta } from '@ugent/core';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useState } from 'react';

export function speak(text: string, lang: Lang) {
  Speech.stop();
  Speech.speak(text, { language: langMeta(lang).speech });
}

/** Hook: start/stop listening; calls onFinal with the transcript. */
export function useVoiceInput(lang: Lang, onFinal: (text: string) => void, onError: (message: string) => void) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => { setListening(false); setPartial(''); });
  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results[0]?.transcript ?? '';
    if (e.isFinal) { if (text.trim()) onFinal(text.trim()); } else setPartial(text);
  });
  useSpeechRecognitionEvent('error', (e) => {
    setListening(false);
    if (e.error === 'aborted' || e.error === 'no-speech') return;
    onError(e.error === 'language-not-supported'
      ? `Voice input in ${langMeta(lang).name} is not available on this phone yet. Try English, or type instead.`
      : 'I could not hear you. Check microphone access in Settings, or type instead.');
  });

  const toggle = useCallback(async () => {
    if (listening) { ExpoSpeechRecognitionModule.stop(); return; }
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) { onError('Voice input is not available on this phone. You can type instead.'); return; }
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) { onError('Ugent needs microphone access to hear you. You can allow it in Settings.'); return; }
      ExpoSpeechRecognitionModule.start({ lang: langMeta(lang).speech, interimResults: true, addsPunctuation: true });
    } catch {
      onError('Voice input is not available here. You can type instead.');
    }
  }, [listening, lang, onError]);

  return { listening, partial, toggle };
}
