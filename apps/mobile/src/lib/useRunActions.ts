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
    // Tag the undo point with this message, so chat's Undo button only ever reverts this action.
    useApp.setState((st) => ({ undo: st.undo ? { ...st.undo, by: m.id } : null }));
    const onlyExternal = external.length === m.actions.length;
    if (!onlyExternal) toast(t('done'), () => { useApp.getState().restore(); useApp.getState().updateMessage(m.id, { status: 'undone' }); });
    for (const a of external) {
      const note = await perform(a as Extract<Action, { type: 'call' | 'message' | 'directions' }>).catch(() => 'Could not open the app on this phone.');
      if (note) toast(note);
    }
    if (focusMins) {
      useApp.getState().startFocus(focusMins, 'Focused work');
      void reportFocus(Date.now() + focusMins * 60000);
      setTimeout(() => router.push('/focus'), 400);
    }
  }, [t, toast]);
}
