/* The app's state, kept on the phone (AsyncStorage) so Ugent works fully offline.
 * Every change to a task or plan is stamped with updatedAt and marked dirty for the next sync.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Action, EnergyLog, Lang, Logs, Me, Peak, Plan, PlanEvent, PlannerState, Reason, Task } from '@ugent/core';
import { addDays, applyMoves, fmtDate, sampleDay, uid } from '@ugent/core';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface ChatMessage {
  id: string;
  from: 'me' | 'ugent';
  text: string;
  actions?: Action[];
  draft?: string;
  status?: 'pending' | 'done' | 'cancelled';
  source?: 'device' | 'cloud';
}

export interface Settings {
  voiceReplies: boolean;
  learn: boolean;
  askBeforeAction: boolean;
  focusMins: number;
  reminders: boolean;
  lowData: boolean;
}

interface Snapshot { tasks: Task[]; events: PlanEvent[] }

export interface AppState {
  hydrated: boolean;
  onboarded: boolean;
  profile: { name: string; lang: Lang; peak: Peak };
  settings: Settings;
  me: Me | null;
  tasks: Task[];
  events: PlanEvent[];
  log: Logs;
  messages: ChatMessage[];
  focus: { until: number; mins: number; start: number } | null;
  sync: { cursor: number; lastAt: number | null; dirtyTasks: string[]; dirtyEvents: string[] };
  undo: Snapshot | null;

  finishOnboarding: (p: { name: string; lang: Lang; peak: Peak; sample: boolean }) => void;
  setProfile: (p: Partial<AppState['profile']>) => void;
  setSettings: (s: Partial<Settings>) => void;
  setMe: (me: Me | null) => void;

  addTask: (title: string, date?: string) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTask: (id: string) => boolean;
  deleteTask: (id: string) => void;
  addEvent: (e: Omit<PlanEvent, 'id' | 'updatedAt'>) => PlanEvent;
  updateEvent: (id: string, patch: Partial<PlanEvent>) => void;
  deleteEvent: (id: string) => void;
  applyReschedule: (reason: Reason, moves: Extract<Action, { type: 'reschedule' }>['moves']) => void;
  /** Runs agent actions. Returns minutes for a focus action, if any, so the caller can open focus mode. */
  runActions: (actions: Action[]) => { focusMins: number | null };

  logEnergy: (v: EnergyLog['v']) => void;
  clearSamples: () => void;

  pushMessage: (m: Omit<ChatMessage, 'id'>) => ChatMessage;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  clearChat: () => void;

  startFocus: (mins: number) => void;
  endFocus: () => number;

  snapshot: () => void;
  restore: () => void;

  mergeFromServer: (tasks: Task[], events: PlanEvent[], cursor: number, pushedAt: number) => void;
  resetAll: () => void;
}

const DEFAULTS = {
  onboarded: false,
  profile: { name: '', lang: 'en' as Lang, peak: 'morning' as Peak },
  settings: { voiceReplies: false, learn: true, askBeforeAction: true, focusMins: 50, reminders: true, lowData: false },
  me: null,
  tasks: [] as Task[],
  events: [] as PlanEvent[],
  log: { completions: [], focus: [], energy: [], reschedules: [] } as Logs,
  messages: [] as ChatMessage[],
  focus: null,
  sync: { cursor: 0, lastAt: null, dirtyTasks: [] as string[], dirtyEvents: [] as string[] },
  undo: null,
};

const addId = (list: string[], id: string) => (list.includes(id) ? list : [...list, id]);

export const useApp = create<AppState>()(
  persist(
    (set, get) => {
      const markTask = (id: string) => set((s) => ({ sync: { ...s.sync, dirtyTasks: addId(s.sync.dirtyTasks, id) } }));
      const markEvent = (id: string) => set((s) => ({ sync: { ...s.sync, dirtyEvents: addId(s.sync.dirtyEvents, id) } }));

      return {
        hydrated: false,
        ...DEFAULTS,

        finishOnboarding: ({ name, lang, peak, sample }) => {
          const extra = sample ? sampleDay(new Date()) : null;
          set((s) => ({
            onboarded: true,
            profile: { name, lang, peak },
            tasks: extra ? extra.tasks : s.tasks,
            events: extra ? extra.events : s.events,
            log: extra ? { ...s.log, completions: extra.completions, focus: extra.focus, reschedules: extra.reschedules } : s.log,
          }));
        },
        setProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
        setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
        setMe: (me) => set({ me }),

        addTask: (title, date) => {
          const now = Date.now();
          const task: Task = { id: uid(), title: title.trim(), important: false, done: false, date: date ?? fmtDate(new Date()), createdAt: now, updatedAt: now };
          set((s) => ({ tasks: [task, ...s.tasks] }));
          markTask(task.id);
          return task;
        },
        updateTask: (id, patch) => {
          set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t)) }));
          markTask(id);
        },
        toggleTask: (id) => {
          const t = get().tasks.find((x) => x.id === id);
          if (!t) return false;
          const done = !t.done;
          const now = Date.now();
          get().updateTask(id, { done, doneAt: done ? now : null });
          set((s) => ({
            log: {
              ...s.log,
              completions: done
                ? (s.settings.learn ? [...s.log.completions, { t: now, id }] : s.log.completions)
                : s.log.completions.filter((c) => c.id !== id),
            },
          }));
          return done;
        },
        deleteTask: (id) => get().updateTask(id, { deleted: true }),

        addEvent: (e) => {
          const ev: PlanEvent = { ...e, id: uid(), updatedAt: Date.now() };
          set((s) => ({ events: [...s.events, ev] }));
          markEvent(ev.id);
          return ev;
        },
        updateEvent: (id, patch) => {
          set((s) => ({ events: s.events.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e)) }));
          markEvent(id);
        },
        deleteEvent: (id) => get().updateEvent(id, { deleted: true }),
        applyReschedule: (reason, moves) => {
          const now = Date.now();
          set((s) => ({
            events: applyMoves(s.events, moves, now),
            log: { ...s.log, reschedules: [...s.log.reschedules, { t: now, reason, n: moves.length }] },
          }));
          moves.forEach((m) => markEvent(m.id));
        },

        runActions: (actions) => {
          const s = get();
          s.snapshot();
          let focusMins: number | null = null;
          for (const a of actions) {
            if (a.type === 'addTask') s.addTask(a.title, a.date);
            else if (a.type === 'addEvent') s.addEvent({ title: a.title, date: a.date, start: a.start, dur: a.dur, kind: a.kind, fixed: false, needsPower: a.kind === 'deep' || a.kind === 'meeting' });
            else if (a.type === 'reschedule') s.applyReschedule(a.reason, a.moves);
            else if (a.type === 'moveEvent') s.updateEvent(a.move.id, { date: a.move.toDate, start: a.move.to });
            else if (a.type === 'completeTask') { const t = get().tasks.find((x) => x.id === a.id); if (t && !t.done) s.toggleTask(a.id); }
            else if (a.type === 'focus') focusMins = a.mins;
          }
          return { focusMins };
        },

        logEnergy: (v) => set((s) => ({ log: { ...s.log, energy: [...s.log.energy, { t: Date.now(), v }] } })),
        clearSamples: () => set((s) => ({
          tasks: s.tasks.filter((t) => !t.sample),
          events: s.events.filter((e) => !e.sample),
          log: {
            completions: s.log.completions.filter((c) => !c.sample),
            focus: s.log.focus.filter((f) => !f.sample),
            energy: s.log.energy,
            reschedules: s.log.reschedules.filter((r) => !r.sample),
          },
        })),

        pushMessage: (m) => {
          const msg = { ...m, id: uid() };
          set((s) => ({ messages: [...s.messages, msg].slice(-80) }));
          return msg;
        },
        updateMessage: (id, patch) => set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
        clearChat: () => set({ messages: [] }),

        startFocus: (mins) => { const now = Date.now(); set({ focus: { start: now, mins, until: now + mins * 60000 } }); },
        endFocus: () => {
          const f = get().focus;
          if (!f) return 0;
          const mins = Math.round((Math.min(Date.now(), f.until) - f.start) / 60000);
          set((s) => ({ focus: null, log: { ...s.log, focus: mins >= 1 ? [...s.log.focus, { t: f.start, mins }] : s.log.focus } }));
          return mins;
        },

        snapshot: () => set((s) => ({ undo: { tasks: s.tasks, events: s.events } })),
        restore: () => {
          const u = get().undo;
          if (!u) return;
          const now = Date.now();
          set((s) => {
            // Restored items count as new edits so the server gets them too. Anything created after the
            // snapshot becomes a deletion, so it does not come back from the server on the next sync.
            const keepT = new Set(u.tasks.map((t) => t.id));
            const keepE = new Set(u.events.map((e) => e.id));
            const tasks = [...u.tasks, ...s.tasks.filter((t) => !keepT.has(t.id)).map((t) => ({ ...t, deleted: true }))].map((t) => ({ ...t, updatedAt: now }));
            const events = [...u.events, ...s.events.filter((e) => !keepE.has(e.id)).map((e) => ({ ...e, deleted: true }))].map((e) => ({ ...e, updatedAt: now }));
            return {
              tasks, events, undo: null,
              sync: { ...s.sync, dirtyTasks: [...new Set([...s.sync.dirtyTasks, ...tasks.map((t) => t.id)])], dirtyEvents: [...new Set([...s.sync.dirtyEvents, ...events.map((e) => e.id)])] },
            };
          });
        },

        mergeFromServer: (tasks, events, cursor, pushedAt) => set((s) => {
          const mergeList = <X extends { id: string; updatedAt: number }>(local: X[], incoming: X[]) => {
            const map = new Map(local.map((x) => [x.id, x]));
            for (const r of incoming) {
              const mine = map.get(r.id);
              if (!mine || r.updatedAt >= mine.updatedAt) map.set(r.id, r);
            }
            return [...map.values()];
          };
          // Items edited while the sync was in flight stay dirty for the next round.
          const stillDirty = <X extends { id: string; updatedAt: number }>(ids: string[], list: X[]) =>
            ids.filter((id) => (list.find((x) => x.id === id)?.updatedAt ?? 0) > pushedAt);
          return {
            tasks: mergeList(s.tasks, tasks),
            events: mergeList(s.events, events),
            sync: { cursor, lastAt: Date.now(), dirtyTasks: stillDirty(s.sync.dirtyTasks, s.tasks), dirtyEvents: stillDirty(s.sync.dirtyEvents, s.events) },
          };
        }),

        resetAll: () => set({ ...DEFAULTS, hydrated: true }),
      };
    },
    {
      name: 'ugent-v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hydrated: _h, undo: _u, ...rest }) => rest as unknown as AppState,
      onRehydrateStorage: () => () => useApp.setState({ hydrated: true }),
    },
  ),
);

/** Live (not deleted) items. */
export const liveTasks = (s: Pick<AppState, 'tasks'>) => s.tasks.filter((t) => !t.deleted);
export const liveEvents = (s: Pick<AppState, 'events'>) => s.events.filter((e) => !e.deleted);

/** The planner's view of the state. */
export const plannerState = (s: AppState): PlannerState => ({
  events: liveEvents(s),
  tasks: liveTasks(s),
  log: { completions: s.log.completions },
  peak: s.profile.peak,
  learn: s.settings.learn,
  focusMins: s.settings.focusMins,
  name: s.profile.name,
});

export const effectivePlan = (s: AppState): Plan => s.me?.plan ?? 'free';
export const tomorrow = () => addDays(fmtDate(new Date()), 1);
