/* The app's state, kept on the phone (AsyncStorage) so Ugent works fully offline.
 * Every change to a task or plan is stamped with updatedAt and marked dirty for the next sync.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Action, EnergyLog, Hustle, IntegrationStatus, Lang, Logs, Me, Peak, Plan, PlanEvent, PlannerState, Product, Reason, Task, TaskStatus, TeamFeedItem, TeamInfo, TeamMemberStats } from '@ugent/core';
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
  /** Use the cloud AI (Claude via the Ugent API) when online. Off: everything runs on the phone. */
  cloudChat: boolean;
  /** Keep chat history on the phone. Off: chats are cleared when Ugent closes. */
  rememberChats: boolean;
  /** Minutes before a plan to remind. */
  leadMins: number;
  /** Morning brief notification, "HH:MM" or '' for off. */
  briefTime: string;
  /** No reminders between sleep and wake time. */
  quietHours: boolean;
  /** Travel time to assume when live traffic is not available. */
  travelBuffer: number;
  /** Message used for "running late" drafts. */
  lateTemplate: string;
}

/** Apps connected on the phone itself (no Ugent account needed). */
export type DeviceConn = 'phone' | 'sms' | 'whatsapp' | 'googleMaps' | 'deviceCalendar';
export interface ConnState { on: boolean; at: number; detail?: string }

export type Workspace = 'personal' | 'team';

interface Snapshot { tasks: Task[]; events: PlanEvent[] }

export interface AppState {
  hydrated: boolean;
  onboarded: boolean;
  profile: { name: string; lang: Lang; peak: Peak; hustle: Hustle | null; wake: number; sleep: number };
  settings: Settings;
  workspace: Workspace;
  team: TeamInfo | null;
  teamFeed: TeamFeedItem[];
  teamStats: { members: TeamMemberStats[]; totals: { doneThisWeek: number; open: number; unassigned: number } } | null;
  connections: Partial<Record<DeviceConn, ConnState>>;
  cloud: IntegrationStatus[];
  places: { home: string; work: string };
  gmail: { count: number; top: { from: string; subject: string }[]; at: number } | null;
  waitlist: Product[];
  me: Me | null;
  tasks: Task[];
  events: PlanEvent[];
  log: Logs;
  messages: ChatMessage[];
  focus: { until: number; mins: number; start: number } | null;
  sync: { cursor: number; lastAt: number | null; dirtyTasks: string[]; dirtyEvents: string[] };
  undo: Snapshot | null;

  finishOnboarding: (p: { name: string; lang: Lang; peak: Peak; hustle: Hustle | null; wake: number; sleep: number; sample: boolean; settings: Partial<Settings> }) => void;
  setWorkspace: (w: Workspace) => void;
  setTeam: (team: TeamInfo | null) => void;
  setTeamData: (d: Partial<Pick<AppState, 'teamFeed' | 'teamStats'>>) => void;
  setConnection: (id: DeviceConn, on: boolean, detail?: string) => void;
  setCloud: (items: IntegrationStatus[]) => void;
  setPlaces: (p: Partial<AppState['places']>) => void;
  setGmail: (g: AppState['gmail']) => void;
  setWaitlist: (w: Product[]) => void;
  /** Replace the events imported from one outside source (phone calendar, Google Calendar). */
  setExternalEvents: (prefix: string, events: PlanEvent[]) => void;
  addTeamTask: (title: string, assigneeId: string | null) => Task;
  forgetChats: () => void;
  forgetHabits: () => void;
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
  /** Runs agent actions on the data. Returns what the screen must do itself: open focus, or open another app. */
  runActions: (actions: Action[]) => { focusMins: number | null; external: Action[] };

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

const DEFAULT_SETTINGS: Settings = {
  voiceReplies: false, learn: true, askBeforeAction: true, focusMins: 50, reminders: true, lowData: false,
  cloudChat: true, rememberChats: true, leadMins: 10, briefTime: '07:00', quietHours: true, travelBuffer: 45,
  lateTemplate: "Hi, I'm running about {mins} minutes late because of {reason}. Sorry, I'm on my way.",
};

const DEFAULTS = {
  onboarded: false,
  profile: { name: '', lang: 'en' as Lang, peak: 'morning' as Peak, hustle: null as Hustle | null, wake: 6 * 60, sleep: 22 * 60 + 30 },
  settings: DEFAULT_SETTINGS,
  workspace: 'personal' as Workspace,
  team: null as TeamInfo | null,
  teamFeed: [] as TeamFeedItem[],
  teamStats: null as AppState['teamStats'],
  connections: {} as AppState['connections'],
  cloud: [] as IntegrationStatus[],
  places: { home: '', work: '' },
  gmail: null as AppState['gmail'],
  waitlist: [] as Product[],
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
export { DEFAULT_SETTINGS };

export const useApp = create<AppState>()(
  persist(
    (set, get) => {
      const markTask = (id: string) => set((s) => ({ sync: { ...s.sync, dirtyTasks: addId(s.sync.dirtyTasks, id) } }));
      const markEvent = (id: string) => set((s) => ({ sync: { ...s.sync, dirtyEvents: addId(s.sync.dirtyEvents, id) } }));

      return {
        hydrated: false,
        ...DEFAULTS,

        finishOnboarding: ({ name, lang, peak, hustle, wake, sleep, sample, settings }) => {
          const extra = sample ? sampleDay(new Date()) : null;
          set((s) => ({
            onboarded: true,
            profile: { name, lang, peak, hustle, wake, sleep },
            settings: { ...s.settings, ...settings },
            tasks: extra ? extra.tasks : s.tasks,
            events: extra ? extra.events : s.events,
            log: extra ? { ...s.log, completions: extra.completions, focus: extra.focus, reschedules: extra.reschedules } : s.log,
          }));
        },
        setProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
        setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
        setMe: (me) => set((s) => ({ me, workspace: me?.teamId || me?.plan === 'team' ? s.workspace : 'personal' })),
        setWorkspace: (workspace) => set({ workspace }),
        setTeam: (team) => set({ team }),
        setTeamData: (d) => set(d),
        setConnection: (id, on, detail) => set((s) => ({ connections: { ...s.connections, [id]: { on, at: Date.now(), detail } } })),
        setCloud: (cloud) => set({ cloud }),
        setPlaces: (p) => set((s) => ({ places: { ...s.places, ...p } })),
        setGmail: (gmail) => set({ gmail }),
        setWaitlist: (waitlist) => set({ waitlist }),
        setExternalEvents: (prefix, list) => set((s) => ({
          events: [...s.events.filter((e) => !(e.external && e.id.startsWith(prefix))), ...list.map((e) => ({ ...e, external: true, fixed: true }))],
        })),
        addTeamTask: (title, assigneeId) => {
          const t = get().addTask(title);
          get().updateTask(t.id, { teamId: get().me?.teamId ?? null, assigneeId, status: 'todo' });
          return get().tasks.find((x) => x.id === t.id)!;
        },
        forgetChats: () => set({ messages: [] }),
        forgetHabits: () => set((s) => ({ log: { ...s.log, completions: [], energy: [] } })),

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
          get().updateTask(id, { done, doneAt: done ? now : null, ...(t.teamId ? { status: (done ? 'done' : 'todo') as TaskStatus } : {}) });
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
          const external: Action[] = [];
          for (const a of actions) {
            if (a.type === 'addTask') s.addTask(a.title, a.date);
            else if (a.type === 'addEvent') s.addEvent({ title: a.title, date: a.date, start: a.start, dur: a.dur, kind: a.kind, fixed: false, needsPower: a.kind === 'deep' || a.kind === 'meeting' });
            else if (a.type === 'reschedule') s.applyReschedule(a.reason, a.moves);
            else if (a.type === 'moveEvent') s.updateEvent(a.move.id, { date: a.move.toDate, start: a.move.to });
            else if (a.type === 'completeTask') { const t = get().tasks.find((x) => x.id === a.id); if (t && !t.done) s.toggleTask(a.id); }
            else if (a.type === 'focus') focusMins = a.mins;
            else external.push(a); // call, message, directions: the screen opens the right app
          }
          return { focusMins, external };
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
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hydrated: _h, undo: _u, ...rest }) =>
        (rest.settings.rememberChats ? rest : { ...rest, messages: [] }) as unknown as AppState,
      // Older saves lack newer fields: fill them from the defaults instead of dropping them.
      migrate: (saved) => saved as AppState,
      merge: (saved, current) => {
        const p = (saved ?? {}) as Partial<AppState>;
        return {
          ...current, ...p,
          profile: { ...current.profile, ...p.profile },
          settings: { ...current.settings, ...p.settings },
          places: { ...current.places, ...p.places },
          sync: { ...current.sync, ...p.sync },
          log: { ...current.log, ...p.log },
        };
      },
      onRehydrateStorage: () => () => useApp.setState({ hydrated: true }),
    },
  ),
);

/** Live (not deleted) items. */
export const liveTasks = (s: Pick<AppState, 'tasks'>) => s.tasks.filter((t) => !t.deleted);
export const liveEvents = (s: Pick<AppState, 'events'>) => s.events.filter((e) => !e.deleted);

/** The planner's view of the state. */
export const plannerState = (s: AppState): PlannerState => ({
  // Team-only plans from other people are not on this user's own day.
  events: liveEvents(s).filter((e) => !e.teamId || !e.ownerId || e.ownerId === s.me?.id),
  tasks: liveTasks(s),
  log: { completions: s.log.completions },
  peak: s.profile.peak,
  learn: s.settings.learn,
  focusMins: s.settings.focusMins,
  name: s.profile.name,
  day: { start: s.profile.wake + 30, end: Math.max(s.profile.wake + 8 * 60, (s.profile.sleep < s.profile.wake ? s.profile.sleep + 1440 : s.profile.sleep) - 60) },
});

export const inTeam = (s: Pick<AppState, 'me'>) => !!s.me?.teamId;
export const teamMode = (s: Pick<AppState, 'me' | 'workspace'>) => inTeam(s) && s.workspace === 'team';

export const effectivePlan = (s: AppState): Plan => s.me?.plan ?? 'free';
export const tomorrow = () => addDays(fmtDate(new Date()), 1);
