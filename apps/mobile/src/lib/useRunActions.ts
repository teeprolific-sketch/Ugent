import type { Action } from '@ugent/core';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { useToast } from '@/components/ui';
import { useT } from '@/hooks';
import type { ChatMessage } from '@/store';
import { useApp } from '@/store';
import { perform } from './actions';
import { reportFocus } from './api';

/** Runs a message's proposed actions: data changes in the store, then any app to open (call, WhatsApp, Maps). */
export function useRunActions() {
  const t = useT();
  const toast = useToast();
  return useCallback(async (m: ChatMessage) => {
    const s = useApp.getState();
    if (!m.actions?.length) return;
    const { focusMins, external } = s.runActions(m.actions);
    s.updateMessage(m.id, { status: 'done' });
    const onlyExternal = external.length === m.actions.length;
    if (!onlyExternal) toast(t('done'), () => { useApp.getState().restore(); useApp.getState().updateMessage(m.id, { status: 'cancelled' }); });
    for (const a of external) {
      const note = await perform(a as Extract<Action, { type: 'call' | 'message' | 'directions' }>).catch(() => 'Could not open the app on this phone.');
      if (note) toast(note);
    }
    if (focusMins) {
      useApp.getState().startFocus(focusMins);
      void reportFocus(Date.now() + focusMins * 60000);
      setTimeout(() => router.push('/focus'), 400);
    }
  }, [t, toast]);
}
