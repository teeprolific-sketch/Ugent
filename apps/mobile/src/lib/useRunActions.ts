import type { Action } from '@ugent/core';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { useToast } from '@/components/ui';
import { useT } from '@/hooks';
import type { ChatMessage } from '@/store';
import { useApp } from '@/store';
import { perform } from './actions';
import { reportFocus } from './api';
import { blockedMessage, checkActions, flushTelemetry, reportActions, reportBlocked } from './policy';

/** Runs a message's proposed actions: data changes in the store, then any app to open (call, WhatsApp, Maps). */
export function useRunActions() {
  const t = useT();
  const toast = useToast();
  return useCallback(async (m: ChatMessage) => {
    const s = useApp.getState();
    if (!m.actions?.length) return;
    // Staff may have paused an action type for everyone, or this account may be paused: say so and run the rest.
    const { allowed, blocked } = checkActions(m.actions);
    if (blocked.length) { reportBlocked(blocked); toast(blockedMessage(blocked)); }
    if (!allowed.length) { s.updateMessage(m.id, { status: 'undone' }); void flushTelemetry(); return; }
    const { focusMins, external } = s.runActions(allowed);
    s.updateMessage(m.id, { status: 'done' });
    const types = allowed.map((a) => a.type);
    // Tag the undo point with this message, so chat's Undo button only ever reverts this action.
    useApp.setState((st) => ({ undo: st.undo ? { ...st.undo, by: m.id } : null }));
    const onlyExternal = external.length === allowed.length;
    if (!onlyExternal) toast(t('done'), () => { useApp.getState().restore(); useApp.getState().updateMessage(m.id, { status: 'undone' }); reportActions(types.filter((x) => !external.some((e) => e.type === x)), 'undone'); void flushTelemetry(); });
    for (const a of external) {
      let failed = false;
      const note = await perform(a as Extract<Action, { type: 'call' | 'message' | 'directions' }>).catch(() => { failed = true; return 'Could not open the app on this phone.'; });
      reportActions([a.type], failed ? 'failed' : 'executed', failed ? 'APP_NOT_INSTALLED' : null);
      if (note) toast(note);
    }
    reportActions(types.filter((x) => !external.some((e) => e.type === x)), 'executed');
    void flushTelemetry();
    if (focusMins) {
      useApp.getState().startFocus(focusMins, 'Focused work');
      void reportFocus(Date.now() + focusMins * 60000);
      setTimeout(() => router.push('/focus'), 400);
    }
  }, [t, toast]);
}
