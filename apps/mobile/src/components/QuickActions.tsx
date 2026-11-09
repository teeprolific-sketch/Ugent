import * as QuickActions from 'expo-quick-actions';
import { useQuickActionRouting } from 'expo-quick-actions/router';
import { useEffect } from 'react';

/* Long-press the Ugent icon on the home screen: talk live, add a task, or say plans changed,
 * without going through the app first. */
export function QuickActionsBridge() {
  useQuickActionRouting();
  useEffect(() => {
    QuickActions.setItems([
      { id: 'live', title: 'Talk to Ugent', subtitle: 'Start a live conversation', icon: 'symbol:waveform', params: { href: '/live' } },
      { id: 'plans', title: 'Plans changed?', subtitle: 'Traffic, power cut, running late', icon: 'symbol:calendar.badge.exclamationmark', params: { href: '/schedule' } },
      { id: 'task', title: 'Add a task', icon: 'symbol:checklist', params: { href: '/tasks' } },
    ]).catch(() => {});
  }, []);
  return null;
}
