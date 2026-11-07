/* Ugent — planner. Learns the user's energy pattern, finds free time and reschedules when life happens. */
(function () {
  const { toMin, fromMin, today, addDays } = Store.date;
  const nowMin = () => Store.date.nowMin();
  const DAY_START = 7 * 60;
  const DAY_END = 21 * 60 + 30;
  const BUF = 10; // minutes between plans
  const PEAK_START = { morning: 9 * 60, afternoon: 13 * 60, evening: 18 * 60 };

  function periodOf(hour) {
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    return 'evening';
  }

  /* Counts finished tasks by time of day over the last 14 days. */
  function energyPattern(state) {
    const since = Date.now() - 14 * 86400000;
    const counts = { morning: 0, afternoon: 0, evening: 0 };
    for (const c of state.log.completions) if (c.t >= since) counts[periodOf(new Date(c.t).getHours())]++;
    return counts;
  }

  /* The learned peak when there is enough history and learning is on; otherwise what the user told us. */
  function peak(state) {
    if (state.settings.learn) {
      const c = energyPattern(state);
      const total = c.morning + c.afternoon + c.evening;
      if (total >= 8) return Object.keys(c).sort((a, b) => c[b] - c[a])[0];
    }
    return state.profile.peak || 'morning';
  }

  const roundUp = (m, step = 15) => Math.ceil(m / step) * step;

  function freeSlot(events, date, earliest, dur, ignore) {
    const busy = events
      .filter((e) => e.date === date && !(ignore && ignore.has(e.id)))
      .map((e) => [toMin(e.start), toMin(e.start) + e.dur])
      .sort((a, b) => a[0] - b[0]);
    let t = roundUp(Math.max(earliest, DAY_START));
    for (const [s, e] of busy) {
      if (t + dur + BUF <= s) break;
      if (e + BUF > t) t = roundUp(e + BUF);
    }
    return t + dur <= DAY_END ? t : null;
  }

  /* First free time on or after (date, earliest); rolls to the next day's peak if today is full. */
  function place(events, date, earliest, dur, ignore, state) {
    for (let i = 0; i < 7; i++) {
      const t = freeSlot(events, date, earliest, dur, ignore);
      if (t !== null) return { date, start: fromMin(t) };
      date = addDays(date, 1);
      earliest = PEAK_START[peak(state)];
    }
    return { date, start: fromMin(earliest) };
  }

  /* Best slot for a new plan: heavy work goes into the user's peak, everything else into the next gap. */
  function suggestSlot(state, kind, dur, date) {
    const d0 = today();
    date = date || d0;
    let earliest = date === d0 ? nowMin() + 15 : DAY_START + 60;
    if (kind === 'deep') {
      const ps = PEAK_START[peak(state)];
      if (date === d0 && nowMin() > ps + 120) { date = addDays(date, 1); earliest = ps; } else earliest = Math.max(earliest, ps);
    }
    return place(state.events, date, earliest, dur, null, state);
  }

  /* Works out what to move for a disruption. Returns new events and a list of moves; does not change state. */
  function computeReschedule(state, reason) {
    const d0 = today();
    const now = nowMin();
    const events = state.events.map((e) => Object.assign({}, e));
    const upcoming = events
      .filter((e) => e.date === d0 && toMin(e.start) >= now - 5)
      .sort((a, b) => toMin(a.start) - toMin(b.start));

    let pick = [];
    let target; // function(e) -> {date, earliest}
    const pk = PEAK_START[peak(state)];

    if (reason === 'traffic' || reason === 'late') {
      const shift = reason === 'traffic' ? 45 : 30;
      pick = upcoming.filter((e) => !e.fixed && toMin(e.start) < now + 180);
      target = (e) => ({ date: d0, earliest: toMin(e.start) + shift });
    } else if (reason === 'power') {
      pick = upcoming.filter((e) => !e.fixed && e.needsPower && toMin(e.start) < now + 180);
      target = () => ({ date: d0, earliest: now + 180 });
    } else if (reason === 'tired') {
      pick = upcoming.filter((e) => !e.fixed && e.kind === 'deep');
      target = () => ({ date: addDays(d0, 1), earliest: pk });
    } else if (reason === 'emergency') {
      pick = upcoming.filter((e) => !e.fixed);
      target = () => ({ date: addDays(d0, 1), earliest: DAY_START + 60 });
    }

    const ignore = new Set(pick.map((e) => e.id));
    const moves = [];
    for (const e of pick) {
      const tg = target(e);
      const slot = place(events, tg.date, tg.earliest, e.dur, ignore, state);
      moves.push({ id: e.id, title: e.title, fromDate: e.date, from: e.start, toDate: slot.date, to: slot.start });
      e.date = slot.date;
      e.start = slot.start;
      ignore.delete(e.id);
    }
    // Fixed plans that are coming up soon: the user may want to tell someone they are late.
    const fixedSoon = (reason === 'traffic' || reason === 'late')
      ? upcoming.find((e) => e.fixed && toMin(e.start) < now + 120) : null;
    return { events, moves, fixedSoon };
  }

  /* One useful heads-up for the daily brief. */
  function headsUp(state) {
    const d0 = today();
    const now = nowMin();
    const up = state.events.filter((e) => e.date === d0 && toMin(e.start) > now).sort((a, b) => toMin(a.start) - toMin(b.start));
    const rush = up.find((e) => e.fixed && e.kind !== 'meeting' && toMin(e.start) >= 16 * 60 && toMin(e.start) <= 20 * 60);
    if (rush) return { key: 'headsTraffic', ev: rush };
    const pw = up.find((e) => e.needsPower);
    if (pw) return { key: 'headsPower', ev: pw };
    return { key: 'headsPeak' };
  }

  window.Planner = { energyPattern, peak, periodOf, suggestSlot, computeReschedule, headsUp, PEAK_START };
})();
