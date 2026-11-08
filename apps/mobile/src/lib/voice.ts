/* Talk to Ugent: speech-to-text for input, text-to-speech for replies. */
import type { Lang } from '@ugent/core';
import { langMeta } from '@ugent/core';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useRef, useState } from 'react';

export function speak(text: string, lang: Lang, onDone?: () => void) {
  Speech.stop();
  const done = () => onDone?.();
  Speech.speak(text, { language: langMeta(lang).speech, onDone: done, onStopped: undefined, onError: done });
}
export const stopSpeaking = () => { void Speech.stop(); };

interface VoiceOptions {
  /** Called when listening stops for any reason (after a result, silence or an error). */
  onEnd?: () => void;
}

/** Hook: start/stop listening; calls onFinal with the transcript. */
export function useVoiceInput(lang: Lang, onFinal: (text: string) => void, onError: (message: string) => void, opts: VoiceOptions = {}) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const listeningRef = useRef(false);

  useSpeechRecognitionEvent('start', () => { listeningRef.current = true; setListening(true); });
  useSpeechRecognitionEvent('end', () => { listeningRef.current = false; setListening(false); setPartial(''); opts.onEnd?.(); });
  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results[0]?.transcript ?? '';
    if (e.isFinal) { if (text.trim()) onFinal(text.trim()); } else setPartial(text);
  });
  useSpeechRecognitionEvent('error', (e) => {
    listeningRef.current = false;
    setListening(false);
    if (e.error === 'aborted' || e.error === 'no-speech' || e.error === 'speech-timeout') return;
    onError(e.error === 'language-not-supported'
      ? `Voice input in ${langMeta(lang).name} is not available on this phone yet. Try English, or type instead.`
      : e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Ugent needs microphone access to hear you. You can allow it in your settings.'
        : 'I could not hear you. Check your microphone, or type instead.');
  });

  const start = useCallback(async (): Promise<boolean> => {
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) { onError('Voice is not available on this device. You can type instead.'); return false; }
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) { onError('Ugent needs microphone access to hear you. You can allow it in your settings.'); return false; }
      ExpoSpeechRecognitionModule.start({ lang: langMeta(lang).speech, interimResults: true, addsPunctuation: true });
      return true;
    } catch {
      onError('Voice is not available here. You can type instead.');
      return false;
    }
  }, [lang, onError]);

  const stop = useCallback(() => { try { ExpoSpeechRecognitionModule.stop(); } catch { /* not running */ } }, []);
  const toggle = useCallback(async () => { if (listeningRef.current) stop(); else await start(); }, [start, stop]);

  return { listening, partial, toggle, start, stop };
}
