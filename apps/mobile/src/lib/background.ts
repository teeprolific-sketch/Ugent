/* Work Ugent does while the app is closed, roughly every 30 minutes (the phone decides exactly when):
 * sync, refresh imported calendars and Gmail, and re-plan reminders and the morning brief. */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { useApp } from '@/store';
import { refreshCloud, refreshImports } from './connections';
import { scheduleReminders } from './notifications';
import { saveData, watchConnection } from './data';
import { syncNow } from './sync';

export const BACKGROUND_TASK = 'ugent-background-refresh';

const hydrated = () => new Promise<void>((resolve) => {
  if (useApp.persist.hasHydrated()) resolve();
  else useApp.persist.onFinishHydration(() => resolve());
});

// Must be defined at the top level of a module the app loads at start-up.
if (Platform.OS !== 'web') {
  TaskManager.defineTask(BACKGROUND_TASK, async () => {
    try {
      await hydrated();
      watchConnection();
      if (!useApp.getState().onboarded) return BackgroundTask.BackgroundTaskResult.Success;
      await syncNow();
      if (!saveData()) await refreshCloud();
      await refreshImports();
      await scheduleReminders();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerBackgroundWork() {
  if (Platform.OS === 'web') return;
  try {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (!(await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK))) {
      await BackgroundTask.registerTaskAsync(BACKGROUND_TASK, { minimumInterval: 30 });
    }
  } catch { /* background refresh is a bonus; the app works without it */ }
}
