/* Ugent — on-device store. Everything lives in localStorage on the phone; nothing is sent anywhere. */
(function () {
  const KEY = 'ugent.v1';

  const pad = (n) => String(n).padStart(2, '0');
  const fmtDate = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return fmtDate(d); };
  const today = () => fmtDate(new Date());
  const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const fromMin = (m) => { m = Math.max(0, Math.min(23 * 60 + 59, Math.round(m))); return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const uid = () => Math.random().toString(36).slice(2, 10);

  const defaults = () => ({
    onboarded: false,
    profile: { name: '', lang: 'en', peak: 'morning' },
    plan: 'free',
    settings: {
      voiceReplies: false,
      lowData: false,
      learn: true,
      askBeforeAction: true,
      localOnly: true,
      focusMins: 50,
    },
    tasks: [],
    events: [],
    messages: [],
    log: { completions: [], focus: [], energy: [], reschedules: [] },
  });

  let state = defaults();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const base = defaults();
        state = Object.assign(base, saved, {
          profile: Object.assign(base.profile, saved.profile),
          settings: Object.assign(base.settings, saved.settings),
          log: Object.assign(base.log, saved.log),
        });
      }
    } catch (e) { state = defaults(); }
    return state;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage blocked: app keeps working in memory */ }
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    state = defaults();
  }

  /* Sample plan so a new user sees how Ugent works. Every sample item carries sample:true and can be cleared. */
  function seedSamples() {
    const d0 = today();
    const d1 = addDays(d0, 1);
    const ev = (title, date, start, dur, kind, fixed, needsPower) =>
      ({ id: uid(), title, date, start, dur, kind, fixed: !!fixed, needsPower: !!needsPower, sample: true });
    state.events = [
      ev('Team stand-up', d0, '09:00', 30, 'meeting', true, true),
      ev('Deep work: pitch deck', d0, '11:00', 90, 'deep', false, true),
      ev('Client call with Kemi', d0, '14:00', 45, 'meeting', true, true),
      ev('Buy diesel for the generator', d0, '16:00', 40, 'errand', false, false),
      ev('Pick up the kids from school', d0, '17:30', 30, 'personal', true, false),
      ev('Gym', d0, '19:00', 60, 'personal', false, false),
      ev('Bank visit: update BVN details', d1, '10:00', 60, 'errand', true, false),
    ];
    const tk = (title, important, done, date) =>
      ({ id: uid(), title, important: !!important, done: !!done, date: date || d0, created: Date.now(), sample: true });
    state.tasks = [
      tk('Send invoice to Mrs. Adeyemi', true),
      tk('Finish pitch deck slides', true),
      tk('Call Mum', false),
      tk('Renew car papers', false, false, d1),
      tk('Buy prepaid electricity units', false, true),
    ];
    // A week of sample history so Analytics is not empty on day one.
    const perDay = [3, 5, 2, 6, 4, 1, 3];
    const hours = [8, 9, 10, 10, 11, 15, 16, 20];
    const completions = [];
    const focus = [];
    for (let i = 6; i >= 1; i--) {
      const base = parseDate(addDays(d0, -i));
      for (let j = 0; j < perDay[6 - i]; j++) {
        const t = new Date(base); t.setHours(hours[(i + j) % hours.length], 15 + j * 7);
        completions.push({ t: t.getTime(), sample: true });
      }
      const f = new Date(base); f.setHours(10);
      focus.push({ t: f.getTime(), mins: [50, 0, 75, 50, 25, 100][6 - i] || 0, sample: true });
    }
    state.log.completions = completions;
    state.log.focus = focus.filter((x) => x.mins > 0);
    state.log.reschedules = [{ t: Date.now() - 86400000 * 2, reason: 'traffic', n: 2, sample: true }];
  }

  function clearSamples() {
    state.events = state.events.filter((e) => !e.sample);
    state.tasks = state.tasks.filter((t) => !t.sample);
    for (const k of Object.keys(state.log)) state.log[k] = state.log[k].filter((x) => !x.sample);
    save();
  }

  const hasSamples = () =>
    state.events.some((e) => e.sample) || state.tasks.some((t) => t.sample) || state.log.completions.some((c) => c.sample);

  window.Store = {
    get state() { return state; },
    load, save, reset, seedSamples, clearSamples, hasSamples, uid,
    date: { fmtDate, parseDate, addDays, today, toMin, fromMin, nowMin, pad },
  };
})();
