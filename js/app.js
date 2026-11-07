/* Ugent — screens, navigation and actions. */
(function () {
  const { today, addDays, toMin, fromMin, nowMin, parseDate, fmtDate, pad } = Store.date;
  const S = () => Store.state;
  const t = (k, v) => I18n.t(k, v);
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const save = () => Store.save();

  /* ---------- Icons ---------- */
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
    tasks: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="m8 12 3 3 5-6"/>',
    more: '<rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    send: '<path d="M5 12h13M12 5l7 7-7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevR: '<path d="m9 6 6 6-6 6"/>',
    chevL: '<path d="m15 6-6 6 6 6"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z"/>',
    focus: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.8v.1"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>',
    dots: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    chart: '<path d="M4 20h16M7 16v-5M12 16V7M17 16v-8"/>',
    tag: '<path d="M3.5 12.5V5A1.5 1.5 0 0 1 5 3.5h7.5L21 12l-8.5 8.5-9-8Z"/><circle cx="8" cy="8" r="1.4"/>',
    shield: '<path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6L12 3Z"/>',
    wifiOff: '<path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M14.5 10.4A10 10 0 0 1 19 13M2 9.5a15 15 0 0 1 4.3-2.6M10.5 5.6A15 15 0 0 1 22 9.5M12 20h.01"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5Z"/>',
    star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    car: '<path d="M5 16.5V12l2-5h10l2 5v4.5M3.5 12h17M7 16.5v2M17 16.5v2"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    heart: '<path d="M12 20s-7.5-4.5-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.5-7.5 10-7.5 10Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  };
  const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  /* ---------- Formatting ---------- */
  const is24h = () => I18n.lang === 'fr';
  function timeParts(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    if (is24h()) return [`${h}:${pad(m)}`, ''];
    return [`${h % 12 || 12}:${pad(m)}`, h < 12 ? 'AM' : 'PM'];
  }
  const fmtTime = (hhmm) => timeParts(hhmm).join(' ').trim();
  function fmtDay(dateStr, opts) {
    const d = parseDate(dateStr);
    try { return new Intl.DateTimeFormat(I18n.meta().locale, opts).format(d); } catch (e) { return d.toDateString(); }
  }
  const fmtDur = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : `${m} min`);
  const dayWord = (date) => (date === today() ? 'Today' : date === addDays(today(), 1) ? 'Tomorrow' : fmtDay(date, { weekday: 'short', day: 'numeric', month: 'short' }));
  const KIND = { meeting: 'Meeting', deep: 'Deep work', errand: 'Errand', personal: 'Personal' };

  /* ---------- Shell ---------- */
  const view = $('#view');
  const tabs = $('#tabs');
  const composer = $('#composer');
  let current = 'home';
  let undoSnap = null;

  const TABS = [
    { id: 'home', icon: 'home' }, { id: 'chat', icon: 'chat' }, { id: 'schedule', icon: 'calendar' },
    { id: 'tasks', icon: 'tasks' }, { id: 'more', icon: 'more' },
  ];
  const UNDER_MORE = ['more', 'analytics', 'pricing', 'privacy'];

  function renderTabs() {
    const active = UNDER_MORE.includes(current) ? 'more' : current;
    tabs.innerHTML = '<ul>' + TABS.map((x) => `<li><a href="#${x.id}" ${x.id === active ? 'aria-current="page"' : ''}>${icon(x.icon)}<span>${esc(t('nav.' + x.id))}</span></a></li>`).join('') + '</ul>';
  }

  const SCREENS = {};
  const AFTER = {};

  function render() {
    let name = location.hash.slice(1) || 'home';
    if (!S().onboarded) name = 'welcome';
    else if (name === 'welcome') name = 'home';
    if (!SCREENS[name]) name = 'home';
    if (S().focus && S().focus.until > Date.now() && name !== 'focus') name = 'focus';
    const changed = name !== current;
    current = name;
    const noTabs = name === 'welcome' || name === 'focus';
    view.className = 'view' + (noTabs ? ' no-tabs' : '') + (name === 'chat' ? ' chat-view' : '');
    view.innerHTML = SCREENS[name]();
    tabs.hidden = noTabs;
    composer.hidden = name !== 'chat';
    if (!noTabs) renderTabs();
    if (AFTER[name]) AFTER[name]();
    if (changed && name !== 'chat') window.scrollTo(0, 0);
  }
  const go = (name) => { if (location.hash !== '#' + name) location.hash = name; else render(); };

  /* ---------- Sheet & toast ---------- */
  function sheet(html, label) {
    closeSheet();
    const b = document.createElement('div');
    b.className = 'backdrop';
    b.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label || 'Options')}"><div class="grab"></div>${html}</div>`;
    b.addEventListener('click', (e) => { if (e.target === b) closeSheet(); });
    document.body.appendChild(b);
    const f = b.querySelector('input, select, button:not(.grab)');
    if (f) f.focus({ preventScroll: true });
  }
  function closeSheet() { const b = $('.backdrop'); if (b) b.remove(); }

  let toastTimer;
  function toast(msg, undo) {
    const old = $('.toast'); if (old) old.remove();
    clearTimeout(toastTimer);
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button">Undo</button>' : ''}`;
    if (undo) el.querySelector('button').onclick = () => { undo(); el.remove(); };
    document.body.appendChild(el);
    toastTimer = setTimeout(() => el.remove(), 4500);
  }

  function snapshot() { undoSnap = JSON.stringify({ tasks: S().tasks, events: S().events }); }
  function restore() {
    if (!undoSnap) return;
    const s = JSON.parse(undoSnap);
    S().tasks = s.tasks; S().events = s.events; undoSnap = null; save(); render();
  }

  /* ---------- Shared bits ---------- */
  const online = () => navigator.onLine !== false;
  function statusPill() {
    if (online() && !S().settings.lowData) return '';
    const off = !online();
    return `<span class="status-pill ${off ? 'off' : ''}"><span class="dot"></span>${off ? 'Offline, still working' : 'Low data'}</span>`;
  }
  function header(title, sub, backTo) {
    return `<header class="screen-head"><div>${backTo ? `<a class="back" href="#${backTo}">${icon('chevL', 'i-sm')}Back</a>` : ''}<h1>${esc(title)}</h1>${sub ? `<p class="sub muted">${sub}</p>` : ''}</div></header>`;
  }
  const openTasks = () => S().tasks.filter((x) => !x.done);
  const sortTasks = (list) => list.slice().sort((a, b) => (b.important - a.important) || a.date.localeCompare(b.date) || b.created - a.created);
  function taskRow(tk, withMenu) {
    const meta = [];
    if (tk.important) meta.push(`<span class="pill sky">${icon('star', 'i-sm')}Important</span>`);
    if (tk.date !== today()) meta.push(`<span class="pill">${esc(tk.date < today() ? 'Overdue' : dayWord(tk.date))}</span>`);
    return `<li class="${tk.done ? 'done' : ''}"><div class="row">
      <button class="check" role="checkbox" aria-checked="${tk.done}" data-act="task-toggle" data-id="${tk.id}" aria-label="${tk.done ? 'Mark not done' : 'Mark done'}: ${esc(tk.title)}">${icon('check', 'i-sm')}</button>
      <div class="grow"><p class="row-title">${esc(tk.title)}</p>${meta.length ? `<div class="chips" style="margin-top:6px">${meta.join('')}</div>` : ''}</div>
      ${withMenu ? `<button class="icon-btn" data-act="task-menu" data-id="${tk.id}" aria-label="Options for ${esc(tk.title)}">${icon('dots')}</button>` : ''}
    </div></li>`;
  }
  function sampleNotice() {
    if (!Store.hasSamples()) return '';
    return `<div class="notice"><span>You're seeing a sample day.</span><button class="btn-text" data-act="clear-samples">Clear it</button></div>`;
  }

  /* ---------- Onboarding ---------- */
  const onb = { step: 0, name: '', lang: 'en', peak: 'morning', sample: true };
  SCREENS.welcome = () => {
    const steps = `<div class="steps" aria-hidden="true">${[0, 1, 2].map((i) => `<i class="${i <= onb.step ? 'on' : ''}"></i>`).join('')}</div>`;
    if (onb.step === 0) {
      return `<div class="onb">${steps}
        <div class="hero"><div class="wordmark">Ugent<i>.</i></div><h1>Your day, handled.</h1>
        <p>Ugent plans around traffic, power cuts, family and work that changes. It speaks your language and works offline.</p></div>
        <ul class="feature-list">
          <li>${icon('chat')}<span>Talk or type in 6 languages</span></li>
          <li>${icon('calendar')}<span>Reschedules when your day changes</span></li>
          <li>${icon('wifiOff')}<span>Works offline and on low data</span></li>
          <li>${icon('lock')}<span>Your data stays on your phone</span></li>
        </ul>
        <div class="grow"></div>
        <button class="btn btn-primary btn-block" data-act="onb-next">Get started</button></div>`;
    }
    if (onb.step === 1) {
      return `<div class="onb">${steps}
        <h1>What should I call you?</h1>
        <div class="field"><label for="onb-name">Your first name</label><input class="input" id="onb-name" autocomplete="given-name" value="${esc(onb.name)}" placeholder="e.g. Tobi"></div>
        <div class="section"><h2>Which language do you prefer?</h2><p class="muted small">You can mix languages in chat. Ugent will understand.</p>
        <div class="choice-list" role="group" aria-label="Language">${I18n.LANGS.map((l) => `<button class="choice" data-act="onb-lang" data-v="${l.code}" aria-pressed="${onb.lang === l.code}"><span><b>${esc(l.native)}</b>${l.native !== l.name ? ` <span class="muted small">${esc(l.name)}</span>` : ''}</span>${icon('check', 'tick')}</button>`).join('')}</div></div>
        <button class="btn btn-primary btn-block" data-act="onb-next">Continue</button></div>`;
    }
    const P = [['morning', 'Morning', 'Before 12 noon', 'sun'], ['afternoon', 'Afternoon', '12 noon to 5 PM', 'clock'], ['evening', 'Evening', 'After 5 PM', 'moon']];
    return `<div class="onb">${steps}
      <h1>When do you have the most energy?</h1>
      <p class="muted">Ugent keeps that time for your most important work, and learns from your days over time.</p>
      <div class="choice-list" role="group" aria-label="Best time of day">${P.map(([v, l, d, ic]) => `<button class="choice" data-act="onb-peak" data-v="${v}" aria-pressed="${onb.peak === v}"><span style="display:flex;gap:12px;align-items:center">${icon(ic)}<span><b>${l}</b><br><span class="muted small">${d}</span></span></span>${icon('check', 'tick')}</button>`).join('')}</div>
      <div class="row"><div class="grow"><p class="row-title">Show me a sample day</p><p class="small muted">See how Ugent works. You can clear it any time.</p></div>
      <label class="switch"><input type="checkbox" id="onb-sample" ${onb.sample ? 'checked' : ''} aria-label="Show me a sample day"><span></span></label></div>
      <div class="grow"></div>
      <button class="btn btn-primary btn-block" data-act="onb-finish">Start using Ugent</button></div>`;
  };

  /* ---------- Home ---------- */
  SCREENS.home = () => {
    const s = S();
    const d0 = today();
    const hr = new Date().getHours();
    const greet = t(hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : 'evening') + (s.profile.name ? ', ' + esc(s.profile.name) : '');
    const evs = s.events.filter((e) => e.date === d0).sort((a, b) => a.start.localeCompare(b.start));
    const next = evs.find((e) => toMin(e.start) + e.dur > nowMin());
    const open = openTasks().filter((x) => x.date <= d0);
    const top = sortTasks(open).slice(0, 3);
    const hu = Planner.headsUp(s);
    const heads = t(hu.key, hu.ev ? { title: hu.ev.title, time: fmtTime(hu.ev.start) } : { peak: t('peak.' + Planner.peak(s)) });
    const answered = s.log.energy.some((e) => fmtDate(new Date(e.t)) === d0);
    const [tm, ap] = next ? timeParts(next.start) : ['', ''];
    return `
      <header class="screen-head greet"><div><h1>${greet}</h1><p class="date">${esc(fmtDay(d0, { weekday: 'long', day: 'numeric', month: 'long' }))}</p></div>${statusPill()}</header>
      ${sampleNotice()}
      <section class="card brief" aria-labelledby="brief-h">
        <h2 id="brief-h">${esc(t('home.brief'))}</h2>
        <ul class="brief-lines">
          <li>${icon('calendar')}<span>${esc(t('brief', { e: evs.length, t: open.length }))}</span></li>
          <li>${icon(hu.key === 'headsTraffic' ? 'car' : hu.key === 'headsPower' ? 'bolt' : 'sun')}<span>${esc(heads)}</span></li>
        </ul>
        ${answered ? '' : `<div class="section" style="gap:8px"><p class="small muted">${esc(t('home.energy'))}</p><div class="chips">${['low', 'ok', 'high'].map((v) => `<button class="chip" data-act="energy" data-v="${v}">${esc(t('energy.' + v))}</button>`).join('')}</div></div>`}
      </section>
      <section class="section" aria-labelledby="next-h">
        <div class="section-head"><h2 id="next-h">${esc(t('home.next'))}</h2><a class="btn-text" href="#schedule">See plan</a></div>
        ${next ? `<a class="card next-card" href="#schedule" style="flex-direction:row;text-decoration:none;color:inherit">
          <div class="time-block"><b class="num">${tm}</b><small>${ap}</small></div>
          <div class="grow" style="min-width:0"><p class="row-title">${esc(next.title)}</p><p class="small muted">${fmtDur(next.dur)} · ${KIND[next.kind]}${next.fixed ? ' · Fixed time' : ''}</p></div>${icon('chevR', 'chev')}</a>`
          : `<div class="card"><p class="muted">${esc(t('nonext'))}</p></div>`}
      </section>
      <section class="section" aria-labelledby="tasks-h">
        <div class="section-head"><h2 id="tasks-h">${esc(t('home.tasks'))}</h2><a class="btn-text" href="#tasks">See all</a></div>
        ${top.length ? `<ul class="list">${top.map((x) => taskRow(x, false)).join('')}</ul>` : '<p class="muted">Nothing due today. Enjoy the breathing room.</p>'}
      </section>
      <div class="btn-row">
        <a class="btn btn-primary" href="#chat">${icon('chat')}${esc(t('home.talk'))}</a>
        <button class="btn btn-ghost" data-act="focus-start">${icon('focus')}${esc(t('home.focus'))}</button>
      </div>`;
  };

  /* ---------- Chat ---------- */
  function actionLine(a) {
    if (a.type === 'addTask') return `${icon('tasks', 'i-sm')} New task: <b>${esc(a.title)}</b>${a.date !== today() ? ' · ' + esc(dayWord(a.date)) : ''}`;
    if (a.type === 'addEvent') return `${icon('calendar', 'i-sm')} <b>${esc(a.title)}</b> · ${esc(dayWord(a.date))}, ${fmtTime(a.start)} · ${fmtDur(a.dur)}`;
    if (a.type === 'focus') return `${icon('focus', 'i-sm')} Focus for ${a.mins} minutes`;
    if (a.type === 'reschedule') return a.moves.map((m) => `${esc(m.title)}: ${fmtTime(m.from)} → ${m.toDate !== m.fromDate ? esc(dayWord(m.toDate)) + ', ' : ''}${fmtTime(m.to)}`).join('</li><li>');
    return '';
  }
  function draftBlock(text) {
    return `<div class="draft-text" id="draft-${Math.abs(hash(text))}">${esc(text)}</div>
      <div class="btn-row"><a class="btn btn-primary" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">${icon('send')}Open in WhatsApp</a>
      <button class="btn btn-ghost" data-act="copy" data-text="${esc(text)}">${icon('copy')}Copy</button></div>`;
  }
  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };

  function msgHtml(m) {
    if (m.from === 'me') return `<div class="msg me">${esc(m.text)}</div>`;
    let card = '';
    if (m.actions && m.actions.length) {
      const lines = m.actions.map((a) => `<li>${actionLine(a)}</li>`).join('');
      let foot = '';
      if (m.status === 'pending') {
        foot = `<p class="small muted">${esc(t('confirm'))}</p><div class="btn-row"><button class="btn btn-primary" data-act="chat-yes" data-id="${m.id}">Yes, do it</button><button class="btn btn-ghost" data-act="chat-no" data-id="${m.id}">Not now</button></div>`;
      } else if (m.status === 'done') foot = `<span class="pill good">${icon('check', 'i-sm')}${esc(t('done'))}</span>`;
      else if (m.status === 'cancelled') foot = `<span class="pill">${esc(t('cancelled'))}</span>`;
      card = `<div class="action-card"><ul class="moves">${lines}</ul>${foot}</div>`;
    }
    if (m.extra && m.extra.type === 'draft') card += `<div class="action-card">${m.actions && m.actions.length ? '<p class="small muted">Message for the people waiting on you:</p>' : ''}${draftBlock(m.extra.text)}</div>`;
    return `<div class="msg ugent"><p class="who">Ugent</p><p>${esc(m.text)}</p>${card}</div>`;
  }

  const SUGGEST = {
    en: ["What's my day?", "I'm stuck in traffic", 'Remind me to call Mum at 6pm', 'Focus for 50 minutes', 'No light'],
    pcm: ['Wetin dey my day?', 'Traffic don hold me', 'Remind me make I call Mama by 6pm', 'Light don go'],
    yo: ['Kí ló wà fún mi lónìí?', 'Iná ti lọ', 'Rán mi létí láti pe Màmá ní 6pm', 'Ó rẹ̀ mí'],
    ig: ['Gịnị dị taa?', 'Ọkụ anyụọla', 'Chetara m ịkpọ Mama na 6pm', 'Ike gwụrụ m'],
    ha: ['Me ke gare ni yau?', 'Babu wuta', 'Tunatar da ni in kira Mama da 6pm', 'Na gaji'],
    fr: ["Qu'est-ce que j'ai aujourd'hui ?", 'Je suis dans les embouteillages', "Rappelle-moi d'appeler Maman à 18h", 'Coupure de courant'],
  };

  SCREENS.chat = () => {
    const s = S();
    if (!s.messages.length) {
      s.messages.push({ id: Store.uid(), from: 'ugent', text: t('greet', { name: s.profile.name || '' }) + ' ' + t('help') });
    }
    const lang = I18n.meta(s.profile.lang);
    return `${`<header class="screen-head"><div><h1>Ugent</h1><p class="sub small muted">${online() ? 'Online' : 'Offline, still working'} · ${esc(lang.native)}</p></div>
      <button class="icon-btn" data-act="chat-clear" aria-label="Clear chat">${icon('trash')}</button></header>`}
      <div class="msgs" id="msgs" aria-live="polite">${s.messages.map(msgHtml).join('')}</div>
      ${s.messages.length < 4 ? `<div class="suggest" role="group" aria-label="Suggestions">${(SUGGEST[s.profile.lang] || SUGGEST.en).map((x) => `<button class="chip" data-act="suggest" data-text="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''}`;
  };
  AFTER.chat = () => {
    const inp = $('#chat-input');
    inp.placeholder = t('chat.placeholder');
    requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight));
  };

  function sendChat(text) {
    text = text.trim();
    if (!text) return;
    const s = S();
    s.messages.push({ id: Store.uid(), from: 'me', text });
    const r = Agent.respond(text, s, { fmtTime });
    const actions = r.actions.map((a) => (a.type === 'reschedule' ? { type: 'reschedule', reason: a.reason, moves: a.result.moves } : a));
    const m = { id: Store.uid(), from: 'ugent', text: r.text, actions, extra: r.extra || null, status: actions.length ? 'pending' : null };
    s.messages.push(m);
    if (s.messages.length > 80) s.messages = s.messages.slice(-80);
    if (actions.length && !s.settings.askBeforeAction) { runActions(actions); m.status = 'done'; toast(t('done'), restore); }
    save();
    speak(r.text);
    render();
  }

  function speak(text) {
    if (!S().settings.voiceReplies || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = I18n.meta().speech;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { /* voice not available */ }
  }

  let rec = null;
  function toggleMic(btn) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (rec) { rec.stop(); return; }
    if (!SR) { toast('Voice input is not available on this browser. You can type instead.'); return; }
    try {
      rec = new SR();
      rec.lang = I18n.meta().speech;
      rec.interimResults = false;
      rec.onresult = (e) => { const txt = e.results[0][0].transcript; sendChat(txt); };
      rec.onerror = () => toast('I could not hear you. Check microphone access, or type instead.');
      rec.onend = () => { rec = null; btn.classList.remove('on'); btn.setAttribute('aria-label', 'Speak'); };
      rec.start();
      btn.classList.add('on'); btn.setAttribute('aria-label', 'Stop listening');
    } catch (e) { rec = null; toast('Voice input is not available here. You can type instead.'); }
  }

  /* ---------- Actions (shared by chat, schedule, tasks) ---------- */
  function runActions(actions) {
    const s = S();
    snapshot();
    for (const a of actions) {
      if (a.type === 'addTask') s.tasks.unshift({ id: Store.uid(), title: a.title, important: false, done: false, date: a.date, created: Date.now() });
      if (a.type === 'addEvent') s.events.push({ id: Store.uid(), title: a.title, date: a.date, start: a.start, dur: a.dur, kind: a.kind, fixed: false, needsPower: !!a.needsPower });
      if (a.type === 'reschedule') applyMoves(a.reason, a.moves);
      if (a.type === 'focus') setTimeout(() => startFocus(a.mins), 600);
    }
    save();
  }
  function applyMoves(reason, moves) {
    const s = S();
    for (const mv of moves) {
      const ev = s.events.find((e) => e.id === mv.id);
      if (ev) { ev.date = mv.toDate; ev.start = mv.to; }
    }
    s.log.reschedules.push({ t: Date.now(), reason, n: moves.length });
  }

  /* ---------- Schedule ---------- */
  let schedDate = null;
  SCREENS.schedule = () => {
    const s = S();
    const d0 = today();
    if (!schedDate || schedDate < d0) schedDate = d0;
    const days = Array.from({ length: 7 }, (_, i) => addDays(d0, i));
    const evs = s.events.filter((e) => e.date === schedDate).sort((a, b) => a.start.localeCompare(b.start));
    const now = nowMin();
    let nowShown = schedDate !== d0;
    const items = [];
    for (const e of evs) {
      if (!nowShown && toMin(e.start) > now) { items.push(`<li class="now-line"><span>Now</span></li>`); nowShown = true; }
      const past = schedDate === d0 && toMin(e.start) + e.dur <= now;
      items.push(`<li class="slot ${past ? 'past' : ''}"><span class="t num">${fmtTime(e.start)}</span>
        <button class="ev" data-act="event-menu" data-id="${e.id}"><span class="row-title">${esc(e.title)}</span>
        <span class="meta"><span class="small muted">${fmtDur(e.dur)}</span><span class="pill">${KIND[e.kind]}</span>${e.fixed ? `<span class="pill">${icon('lock', 'i-sm')}Fixed</span>` : ''}${e.needsPower ? `<span class="pill">${icon('bolt', 'i-sm')}Needs power</span>` : ''}</span></button></li>`);
    }
    if (!nowShown && evs.length) items.push(`<li class="now-line"><span>Now</span></li>`);
    return `${header('Schedule', esc(fmtDay(schedDate, { weekday: 'long', day: 'numeric', month: 'long' })))}
      <div class="days" role="group" aria-label="Choose a day">${days.map((d) => `<button class="day" data-act="day" data-v="${d}" aria-pressed="${d === schedDate}"><small>${esc(fmtDay(d, { weekday: 'short' }))}</small><b class="num">${parseDate(d).getDate()}</b></button>`).join('')}</div>
      <div class="btn-row">
        ${schedDate === d0 ? `<button class="btn btn-primary" data-act="plans-changed">Plans changed?</button>` : ''}
        <button class="btn btn-ghost" data-act="event-add">${icon('plus')}Add plan</button>
      </div>
      ${evs.length ? `<ol class="timeline">${items.join('')}</ol>` : `<div class="empty">${icon('calendar')}<p>Nothing planned for this day.</p></div>`}`;
  };

  const REASONS = [
    ['traffic', 'Stuck in traffic', 'Push the next few hours back 45 minutes', 'car'],
    ['power', 'Power is out', 'Move work that needs power to later', 'bolt'],
    ['late', 'Running late', 'Push the next few hours back 30 minutes', 'clock'],
    ['tired', 'Feeling tired', 'Move heavy work to your best time tomorrow', 'moon'],
    ['emergency', 'Family emergency', 'Move the rest of today to tomorrow', 'heart'],
  ];
  function plansChangedSheet() {
    sheet(`<h2>What happened?</h2><p class="muted small">Fixed-time plans stay where they are. Ugent moves the rest.</p>
      <ul class="list">${REASONS.map(([v, l, d, ic]) => `<li><button class="row" style="width:100%;background:none;border:0;text-align:left" data-act="reason" data-v="${v}">${icon(ic)}<span class="grow"><span class="row-title">${l}</span><br><span class="small muted">${d}</span></span>${icon('chevR', 'chev')}</button></li>`).join('')}</ul>`, 'Plans changed');
  }
  function reasonPreview(reason) {
    const res = Planner.computeReschedule(S(), reason);
    if (!res.moves.length) {
      sheet(`<h2>Nothing to move</h2><p class="muted">${esc(t('nothing'))}</p><button class="btn btn-ghost btn-block" data-act="sheet-close">Close</button>`);
      return;
    }
    const label = REASONS.find((r) => r[0] === reason)[1];
    const draft = res.fixedSoon ? `<div class="section"><p class="small muted">"${esc(res.fixedSoon.title)}" has a fixed time. Let them know:</p>${draftBlock(`Hi, I'm running about ${reason === 'traffic' ? 45 : 30} minutes late for "${res.fixedSoon.title}" because of ${reason === 'traffic' ? 'traffic' : 'a delay'}. Sorry, I'm on my way.`)}</div>` : '';
    pendingMoves = { reason, moves: res.moves };
    sheet(`<h2>${esc(label)}</h2><p class="muted">Here is the new plan:</p>
      <ul class="list">${res.moves.map((m) => `<li class="row"><span class="grow"><span class="row-title">${esc(m.title)}</span><br><span class="small muted num">${fmtTime(m.from)} → ${m.toDate !== m.fromDate ? esc(dayWord(m.toDate)) + ', ' : ''}${fmtTime(m.to)}</span></span></li>`).join('')}</ul>
      ${draft}
      <div class="btn-row"><button class="btn btn-primary" data-act="apply-moves">Move ${res.moves.length} plan${res.moves.length > 1 ? 's' : ''}</button><button class="btn btn-ghost" data-act="sheet-close">Cancel</button></div>`, label);
  }
  let pendingMoves = null;

  function eventForm(date) {
    const opts = Array.from({ length: 7 }, (_, i) => addDays(today(), i));
    return `<h2>Add a plan</h2>
      <form data-form="event" class="section">
        <div class="field"><label for="ev-title">What is it?</label><input class="input" id="ev-title" required placeholder="e.g. Meet supplier at Balogun"></div>
        <div class="grid-2">
          <div class="field"><label for="ev-date">Day</label><select class="input" id="ev-date">${opts.map((d) => `<option value="${d}" ${d === date ? 'selected' : ''}>${esc(dayWord(d))}</option>`).join('')}</select></div>
          <div class="field"><label for="ev-time">Time</label><input class="input" id="ev-time" type="time"></div>
        </div>
        <p class="small muted">Leave time empty and Ugent will pick the best free time.</p>
        <div class="grid-2">
          <div class="field"><label for="ev-dur">How long?</label><select class="input" id="ev-dur">${[15, 30, 45, 60, 90, 120].map((m) => `<option value="${m}" ${m === 60 ? 'selected' : ''}>${fmtDur(m)}</option>`).join('')}</select></div>
          <div class="field"><label for="ev-kind">Type</label><select class="input" id="ev-kind">${Object.entries(KIND).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        </div>
        <div class="row"><div class="grow"><p class="row-title">Fixed time</p><p class="small muted">Ugent will never move it.</p></div><label class="switch"><input type="checkbox" id="ev-fixed" aria-label="Fixed time"><span></span></label></div>
        <button class="btn btn-primary btn-block" type="submit">Save plan</button>
      </form>`;
  }

  function eventMenu(id) {
    const e = S().events.find((x) => x.id === id);
    if (!e) return;
    sheet(`<h2>${esc(e.title)}</h2><p class="muted">${esc(dayWord(e.date))}, ${fmtTime(e.start)} · ${fmtDur(e.dur)} · ${KIND[e.kind]}</p>
      <ul class="list">
        <li><button class="row" style="width:100%;background:none;border:0;text-align:left" data-act="ev-tomorrow" data-id="${id}">${icon('calendar')}<span class="grow row-title">Move to tomorrow</span></button></li>
        <li><button class="row" style="width:100%;background:none;border:0;text-align:left" data-act="ev-fixed" data-id="${id}">${icon('lock')}<span class="grow row-title">${e.fixed ? 'Let Ugent move it' : 'Make it a fixed time'}</span></button></li>
        <li><button class="row" style="width:100%;background:none;border:0;text-align:left;color:var(--danger)" data-act="ev-delete" data-id="${id}">${icon('trash')}<span class="grow row-title">Delete</span></button></li>
      </ul>`, e.title);
  }

  /* ---------- Tasks ---------- */
  let taskFilter = 'today';
  SCREENS.tasks = () => {
    const s = S();
    const d0 = today();
    let list;
    if (taskFilter === 'today') list = sortTasks(s.tasks.filter((x) => !x.done && x.date <= d0));
    else if (taskFilter === 'all') list = sortTasks(s.tasks.filter((x) => !x.done));
    else list = s.tasks.filter((x) => x.done);
    const empty = { today: 'Nothing due today.', all: 'No open tasks. Add one above.', done: 'Finished tasks will show here.' }[taskFilter];
    return `${header('Tasks', `${openTasks().length} open`)}
      <form class="inline-add" data-form="task"><input class="input" id="task-new" placeholder="Add a task" aria-label="New task" autocomplete="off"><button class="btn btn-primary" type="submit" aria-label="Add task">${icon('plus')}</button></form>
      <div class="seg" role="group" aria-label="Filter tasks">${[['today', 'Today'], ['all', 'All'], ['done', 'Done']].map(([v, l]) => `<button data-act="task-filter" data-v="${v}" aria-pressed="${taskFilter === v}">${l}</button>`).join('')}</div>
      ${list.length ? `<ul class="list">${list.map((x) => taskRow(x, true)).join('')}</ul>` : `<div class="empty">${icon('tasks')}<p>${empty}</p></div>`}`;
  };

  function taskMenu(id) {
    const x = S().tasks.find((k) => k.id === id);
    if (!x) return;
    const btn = (act, ic, label, danger) => `<li><button class="row" style="width:100%;background:none;border:0;text-align:left${danger ? ';color:var(--danger)' : ''}" data-act="${act}" data-id="${id}">${icon(ic)}<span class="grow row-title">${label}</span></button></li>`;
    sheet(`<h2>${esc(x.title)}</h2><ul class="list">
      ${btn('tk-plan', 'calendar', 'Find time for this')}
      ${btn('tk-star', 'star', x.important ? 'Not important' : 'Mark as important')}
      ${btn('tk-tomorrow', 'clock', 'Move to tomorrow')}
      ${btn('tk-delete', 'trash', 'Delete', true)}</ul>`, x.title);
  }

  function toggleTask(id) {
    const s = S();
    const x = s.tasks.find((k) => k.id === id);
    if (!x) return;
    x.done = !x.done;
    if (x.done) { x.doneAt = Date.now(); if (s.settings.learn) s.log.completions.push({ t: Date.now(), id }); }
    else s.log.completions = s.log.completions.filter((c) => c.id !== id);
    save();
    render();
    if (x.done) toast('Done: ' + x.title, () => toggleTask(id));
  }

  /* ---------- More ---------- */
  SCREENS.more = () => {
    const row = (href, ic, title, sub) => `<li><a class="row" href="#${href}">${icon(ic)}<span class="grow"><span class="row-title">${title}</span><br><span class="small muted">${sub}</span></span>${icon('chevR', 'chev')}</a></li>`;
    const soon = (name, sub) => `<li class="row"><span class="grow"><span class="row-title">${name}</span><br><span class="small muted">${sub}</span></span><span class="pill">Coming soon</span></li>`;
    const planName = { free: 'Free preview', pro: 'Pro', team: 'Team' }[S().plan];
    return `${header('More')}
      <ul class="list">
        ${row('analytics', 'chart', 'Your week', 'Simple numbers about your time')}
        ${row('pricing', 'tag', 'Plans and pricing', `You're on ${planName}`)}
        ${row('privacy', 'shield', 'Settings and privacy', 'Language, voice, data and control')}
      </ul>
      <section class="section"><h2>Connect your Me AI devices</h2><p class="muted small">Ugent will work with the rest of the Me AI family.</p>
        <ul class="list">
          ${soon('Sleek', 'Find verified mechanics, cleaners and carpenters')}
          ${soon('Domestica I', 'Your home robot that sweeps, mops and maps rooms')}
          ${soon('Afrika I', 'Farm patrol by air and land')}
        </ul></section>
      <p class="small muted" style="text-align:center">Ugent by Me AI · Version 0.1</p>`;
  };

  /* ---------- Analytics ---------- */
  SCREENS.analytics = () => {
    const s = S();
    const d0 = today();
    const days = Array.from({ length: 7 }, (_, i) => addDays(d0, i - 6));
    const counts = days.map((d) => s.log.completions.filter((c) => fmtDate(new Date(c.t)) === d).length);
    const total = counts.reduce((a, b) => a + b, 0);
    const since = parseDate(days[0]).getTime();
    const focusMins = s.log.focus.filter((f) => f.t >= since).reduce((a, f) => a + f.mins, 0);
    const moved = s.log.reschedules.filter((r) => r.t >= since).reduce((a, r) => a + r.n, 0);
    const max = Math.max(4, ...counts);
    const pat = Planner.energyPattern(s);
    const pmax = Math.max(1, pat.morning, pat.afternoon, pat.evening);
    const peak = Planner.peak(s);
    const best = days[counts.indexOf(Math.max(...counts))];
    const sample = Store.hasSamples() ? '<span class="pill">Sample data</span>' : '';
    const PER = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
    const focusLabel = focusMins >= 60 ? (focusMins / 60).toFixed(1).replace('.0', '') + ' h' : focusMins + ' min';
    return `${header('Your week', 'The last 7 days, in plain numbers.', 'more')}
      ${sample}
      <div class="stats">
        <div class="stat"><b>${total}</b><span>Tasks done</span></div>
        <div class="stat"><b>${focusLabel}</b><span>Focus time</span></div>
        <div class="stat"><b>${moved}</b><span>Plans moved</span></div>
      </div>
      <section class="section" aria-labelledby="bars-h">
        <h2 id="bars-h">Tasks done each day</h2>
        <div>
          <div class="bars">${counts.map((c, i) => `<button class="col ${i === 6 ? 'today' : ''}" aria-label="${esc(fmtDay(days[i], { weekday: 'long' }))}: ${c} task${c === 1 ? '' : 's'} done"><span class="val">${c}</span><span class="bar" style="height:${(c / max) * 100}%"></span></button>`).join('')}</div>
          <div class="bars-axis" aria-hidden="true">${days.map((d, i) => `<span>${i === 6 ? 'Today' : esc(fmtDay(d, { weekday: 'narrow' }))}</span>`).join('')}</div>
        </div>
        ${total ? `<p class="muted small">Your best day was ${esc(fmtDay(best, { weekday: 'long' }))}. Tap a bar to see its number.</p>` : ''}
      </section>
      <section class="section" aria-labelledby="energy-h">
        <h2 id="energy-h">When you get things done</h2>
        <div class="hbars">${['morning', 'afternoon', 'evening'].map((p) => `<div class="hbar ${p === peak ? 'top' : ''}"><span>${PER[p]}</span><span class="track"><span class="fill" style="display:block;width:${(pat[p] / pmax) * 100}%"></span></span><b>${pat[p]}</b></div>`).join('')}</div>
        <div class="card brief"><p>${s.settings.learn
          ? `You finish most tasks in the <b>${PER[peak].toLowerCase()}</b>. Ugent keeps that time free for your most important work.`
          : 'Learning is off, so Ugent uses the best time you chose. Turn learning on in Settings to let Ugent adjust.'}</p></div>
      </section>`;
  };

  /* ---------- Pricing ---------- */
  SCREENS.pricing = () => {
    const plan = S().plan;
    const ticks = (list) => `<ul class="ticks">${list.map((x) => `<li>${icon('check')}<span>${x}</span></li>`).join('')}</ul>`;
    return `${header('Plans', 'Simple prices. Cancel any time.', 'more')}
      <section class="plan featured" aria-labelledby="pro-h">
        <div class="section-head"><h2 id="pro-h">Pro</h2><span class="pill sky">For you</span></div>
        <div class="price"><b class="num">$2</b><span class="muted">/ month</span></div>
        ${ticks(['Chat and voice in 6 languages', 'Smart scheduling that adjusts when plans change', 'Works offline and on low data', 'Daily brief and simple analytics', 'Focus protection', 'Ugent takes actions for you'])}
        <button class="btn btn-primary btn-block" data-act="choose-plan" data-v="pro" ${plan === 'pro' ? 'disabled' : ''}>${plan === 'pro' ? 'Your plan' : 'Choose Pro'}</button>
      </section>
      <section class="plan" aria-labelledby="team-h">
        <div class="section-head"><h2 id="team-h">Team</h2><span class="pill">Families and small teams</span></div>
        <div class="price"><b class="num">$21</b><span class="muted">/ month</span></div>
        ${ticks(['Everything in Pro', 'Shared calendars', 'Admin controls', 'Assign tasks to people on your team', 'Team analytics'])}
        <button class="btn btn-ghost btn-block" data-act="choose-plan" data-v="team" ${plan === 'team' ? 'disabled' : ''}>${plan === 'team' ? 'Your plan' : 'Choose Team'}</button>
      </section>
      ${plan !== 'free' ? '<button class="btn btn-text" data-act="choose-plan" data-v="free">Go back to the free preview</button>' : ''}`;
  };

  /* ---------- Settings & privacy ---------- */
  SCREENS.privacy = () => {
    const s = S();
    const sw = (id, label, sub, on) => `<li class="row"><div class="grow"><p class="row-title">${label}</p><p class="small muted">${sub}</p></div><label class="switch"><input type="checkbox" id="${id}" data-set="${id}" ${on ? 'checked' : ''} aria-label="${esc(label)}"><span></span></label></li>`;
    const seg = (key, opts, val) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button data-act="set-seg" data-k="${key}" data-v="${v}" aria-pressed="${String(val) === String(v)}">${l}</button>`).join('')}</div>`;
    const link = (act, ic, label, danger) => `<li><button class="row" style="width:100%;background:none;border:0;text-align:left${danger ? ';color:var(--danger)' : ''}" data-act="${act}">${icon(ic)}<span class="grow row-title">${label}</span>${danger ? '' : icon('chevR', 'chev')}</button></li>`;
    return `${header('Settings and privacy', '', 'more')}
      <section class="section"><h2>You</h2>
        <div class="field"><label for="set-name">Name</label><input class="input" id="set-name" value="${esc(s.profile.name)}" autocomplete="given-name"></div>
        <div class="field"><label for="set-lang">Language</label><select class="input" id="set-lang">${I18n.LANGS.map((l) => `<option value="${l.code}" ${l.code === s.profile.lang ? 'selected' : ''}>${esc(l.native)}${l.native !== l.name ? ' (' + l.name + ')' : ''}</option>`).join('')}</select></div>
        <div class="field"><label>Best time of day</label>${seg('peak', [['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening']], s.profile.peak)}</div>
      </section>
      <section class="section"><h2>Ugent</h2><ul class="list">
        ${sw('voiceReplies', 'Speak replies out loud', 'Ugent reads its answers to you.', s.settings.voiceReplies)}
        ${sw('lowData', 'Low data mode', 'Text only and smaller updates.', s.settings.lowData)}
      </ul>
        <div class="field"><label>Focus length</label>${seg('focusMins', [[25, '25 min'], [50, '50 min'], [90, '90 min']], s.settings.focusMins)}</div>
      </section>
      <section class="section"><h2>Privacy</h2>
        <div class="card brief" style="flex-direction:row;align-items:center">${icon('lock')}<p class="small"><b>Your data stays on this phone.</b> Ugent works without sending your plans, tasks or chats anywhere.</p></div>
        <ul class="list">
          ${sw('learn', 'Learn from my habits', 'Ugent notes when you finish tasks to find your best time.', s.settings.learn)}
          ${sw('askBeforeAction', 'Ask before taking actions', 'Ugent shows what it will do and waits for your OK.', s.settings.askBeforeAction)}
          ${link('see-data', 'eye', 'See what Ugent knows about me')}
          ${link('copy-data', 'copy', 'Copy all my data')}
          ${Store.hasSamples() ? link('clear-samples', 'trash', 'Clear the sample day') : ''}
          ${link('delete-all', 'trash', 'Delete all my data', true)}
        </ul>
      </section>`;
  };
  AFTER.privacy = () => {
    const name = $('#set-name');
    name.addEventListener('change', () => { S().profile.name = name.value.trim(); save(); toast('Name saved'); });
    $('#set-lang').addEventListener('change', (e) => { S().profile.lang = e.target.value; I18n.set(e.target.value); save(); render(); toast('Language: ' + I18n.meta().native); });
  };

  /* ---------- Focus ---------- */
  let focusTimer = null;
  let wakeLock = null;
  function startFocus(mins) {
    S().focus = { until: Date.now() + mins * 60000, mins, start: Date.now() };
    save();
    try { navigator.wakeLock && navigator.wakeLock.request('screen').then((w) => { wakeLock = w; }).catch(() => {}); } catch (e) { /* optional */ }
    go('focus');
  }
  function endFocus(early) {
    const s = S();
    const f = s.focus;
    clearInterval(focusTimer);
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
    if (!f) return;
    const mins = Math.round((Math.min(Date.now(), f.until) - f.start) / 60000);
    if (mins >= 1) s.log.focus.push({ t: f.start, mins });
    s.focus = null;
    save();
    toast(early ? (mins >= 1 ? `Focus ended. ${mins} min logged.` : 'Focus ended.') : `Well done. ${mins} minutes of focus.`);
    go('home');
  }
  SCREENS.focus = () => {
    const f = S().focus;
    if (!f) { setTimeout(() => go('home')); return ''; }
    return `<div class="focus">
      <p class="label">Focus mode</p>
      <div class="ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="none" stroke="var(--line)" stroke-width="4"/><circle id="ring" cx="50" cy="50" r="46" fill="none" stroke="var(--sky)" stroke-width="4" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="0"/></svg><div class="clock" id="clock" role="timer" aria-live="off">--:--</div></div>
      <h2>Ugent is holding your reminders</h2>
      <p class="muted" style="max-width:30ch">Put your phone face down. Ugent will tell you when the ${f.mins} minutes are up.</p>
      <button class="btn btn-ghost" data-act="focus-end">End focus</button></div>`;
  };
  AFTER.focus = () => {
    clearInterval(focusTimer);
    const tick = () => {
      const f = S().focus;
      if (!f) return;
      const left = Math.max(0, f.until - Date.now());
      const c = $('#clock'); const r = $('#ring');
      if (!c) { clearInterval(focusTimer); return; }
      const sec = Math.ceil(left / 1000);
      c.textContent = `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
      r.setAttribute('stroke-dashoffset', String(100 - (left / (f.mins * 60000)) * 100));
      if (left <= 0) { endFocus(false); speakDone(); }
    };
    tick();
    focusTimer = setInterval(tick, 1000);
  };
  function speakDone() { try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { /* optional */ } }

  /* ---------- Event delegation ---------- */
  const ACT = {
    'onb-next': () => {
      if (onb.step === 1) { const n = $('#onb-name'); onb.name = n ? n.value.trim() : onb.name; }
      onb.step++; render();
    },
    'onb-lang': (el) => { const n = $('#onb-name'); if (n) onb.name = n.value.trim(); onb.lang = el.dataset.v; I18n.set(onb.lang); render(); },
    'onb-peak': (el) => { const c = $('#onb-sample'); if (c) onb.sample = c.checked; onb.peak = el.dataset.v; render(); },
    'onb-finish': () => {
      const s = S();
      const c = $('#onb-sample'); if (c) onb.sample = c.checked;
      s.profile.name = onb.name; s.profile.lang = onb.lang; s.profile.peak = onb.peak;
      if (onb.sample) Store.seedSamples();
      s.onboarded = true; save(); go('home');
    },
    energy: (el) => {
      const s = S();
      s.log.energy.push({ t: Date.now(), v: el.dataset.v });
      save();
      if (el.dataset.v === 'low') {
        const res = Planner.computeReschedule(s, 'tired');
        if (res.moves.length) { render(); reasonPreview('tired'); return; }
      }
      toast(el.dataset.v === 'high' ? 'Great. A good time for your hardest task.' : 'Thanks. Noted for today.');
      render();
    },
    'clear-samples': () => { Store.clearSamples(); toast('Sample day cleared'); render(); },
    'focus-start': () => startFocus(S().settings.focusMins),
    'focus-end': () => endFocus(true),
    suggest: (el) => sendChat(el.dataset.text),
    'chat-clear': () => { S().messages = []; save(); render(); },
    'chat-yes': (el) => {
      const m = S().messages.find((x) => x.id === el.dataset.id);
      if (!m || m.status !== 'pending') return;
      runActions(m.actions); m.status = 'done'; save(); render();
      toast(t('done'), () => { restore(); m.status = 'cancelled'; save(); render(); });
    },
    'chat-no': (el) => { const m = S().messages.find((x) => x.id === el.dataset.id); if (m) { m.status = 'cancelled'; save(); render(); } },
    mic: (el) => toggleMic(el),
    copy: (el) => copyText(el.dataset.text),
    day: (el) => { schedDate = el.dataset.v; render(); },
    'plans-changed': plansChangedSheet,
    reason: (el) => reasonPreview(el.dataset.v),
    'apply-moves': () => {
      if (!pendingMoves) return;
      snapshot(); applyMoves(pendingMoves.reason, pendingMoves.moves); save();
      const n = pendingMoves.moves.length; pendingMoves = null;
      closeSheet(); render(); toast(`Moved ${n} plan${n > 1 ? 's' : ''}`, restore);
    },
    'sheet-close': closeSheet,
    'event-add': () => sheet(eventForm(schedDate || today()), 'Add a plan'),
    'event-menu': (el) => eventMenu(el.dataset.id),
    'ev-tomorrow': (el) => {
      const s = S(); const e = s.events.find((x) => x.id === el.dataset.id); if (!e) return;
      snapshot();
      const slot = Planner.suggestSlot({ ...s, events: s.events.filter((x) => x.id !== e.id) }, e.kind, e.dur, addDays(e.date, 1));
      e.date = slot.date; e.start = slot.start; save(); closeSheet(); render();
      toast(`Moved to ${dayWord(e.date)}, ${fmtTime(e.start)}`, restore);
    },
    'ev-fixed': (el) => { const e = S().events.find((x) => x.id === el.dataset.id); if (e) { e.fixed = !e.fixed; save(); closeSheet(); render(); } },
    'ev-delete': (el) => { snapshot(); S().events = S().events.filter((x) => x.id !== el.dataset.id); save(); closeSheet(); render(); toast('Plan deleted', restore); },
    'task-toggle': (el) => toggleTask(el.dataset.id),
    'task-filter': (el) => { taskFilter = el.dataset.v; render(); },
    'task-menu': (el) => taskMenu(el.dataset.id),
    'tk-plan': (el) => {
      const s = S(); const x = s.tasks.find((k) => k.id === el.dataset.id); if (!x) return;
      const kind = /finish|write|deck|report|study|prepare|design/i.test(x.title) ? 'deep' : 'personal';
      const dur = kind === 'deep' ? 90 : 30;
      const slot = Planner.suggestSlot(s, kind, dur);
      snapshot();
      s.events.push({ id: Store.uid(), title: x.title, date: slot.date, start: slot.start, dur, kind, fixed: false, needsPower: kind === 'deep', fromTask: x.id });
      save(); closeSheet(); render();
      toast(`Planned for ${dayWord(slot.date)}, ${fmtTime(slot.start)}`, restore);
    },
    'tk-star': (el) => { const x = S().tasks.find((k) => k.id === el.dataset.id); if (x) { x.important = !x.important; save(); closeSheet(); render(); } },
    'tk-tomorrow': (el) => { const x = S().tasks.find((k) => k.id === el.dataset.id); if (x) { snapshot(); x.date = addDays(today(), 1); save(); closeSheet(); render(); toast('Moved to tomorrow', restore); } },
    'tk-delete': (el) => { snapshot(); S().tasks = S().tasks.filter((k) => k.id !== el.dataset.id); save(); closeSheet(); render(); toast('Task deleted', restore); },
    'choose-plan': (el) => {
      const v = el.dataset.v;
      if (v === 'free') { S().plan = 'free'; save(); render(); return; }
      const price = v === 'pro' ? '$2' : '$21';
      const name = v === 'pro' ? 'Pro' : 'Team';
      sheet(`<h2>Switch to ${name}?</h2><p>${price} a month.</p>
        <p class="muted small">Payments are not connected in this preview, so you will not be charged. You can try ${name} now.</p>
        <div class="btn-row"><button class="btn btn-primary" data-act="confirm-plan" data-v="${v}">Try ${name}</button><button class="btn btn-ghost" data-act="sheet-close">Cancel</button></div>`, 'Choose plan');
    },
    'confirm-plan': (el) => { S().plan = el.dataset.v; save(); closeSheet(); render(); toast(`You're on ${el.dataset.v === 'pro' ? 'Pro' : 'Team'}`); },
    'set-seg': (el) => {
      const k = el.dataset.k; const v = el.dataset.v;
      if (k === 'peak') S().profile.peak = v; else S().settings[k] = Number(v);
      save(); render();
    },
    'see-data': () => {
      const s = S();
      const learned = Planner.peak(s);
      const li = (a, b) => `<li class="row"><span class="grow muted">${a}</span><b>${esc(b)}</b></li>`;
      sheet(`<h2>What Ugent knows</h2><p class="muted small">All of this is stored on this phone only.</p><ul class="list">
        ${li('Name', s.profile.name || 'Not set')}${li('Language', I18n.meta(s.profile.lang).native)}
        ${li('Best time you chose', s.profile.peak)}${li('Best time Ugent learned', s.settings.learn ? learned : 'Learning is off')}
        ${li('Tasks', s.tasks.length)}${li('Plans', s.events.length)}${li('Chat messages', s.messages.length)}
        ${li('Finished-task times noted', s.log.completions.length)}${li('Energy check-ins', s.log.energy.length)}</ul>
        <button class="btn btn-ghost btn-block" data-act="sheet-close">Close</button>`, 'What Ugent knows');
    },
    'copy-data': () => copyText(JSON.stringify(S(), null, 2), 'All your data is copied'),
    'delete-all': () => sheet(`<h2>Delete all your data?</h2><p class="muted">This removes your tasks, plans, chats and habits from this phone. You can't undo it.</p>
      <div class="btn-row"><button class="btn btn-danger" data-act="confirm-delete">Delete everything</button><button class="btn btn-ghost" data-act="sheet-close">Keep my data</button></div>`, 'Delete data'),
    'confirm-delete': () => { Store.reset(); closeSheet(); onb.step = 0; I18n.set('en'); go('welcome'); toast('All data deleted'); },
  };

  function copyText(text, done) {
    const ok = () => toast(done || 'Copied');
    try {
      navigator.clipboard.writeText(text).then(ok).catch(() => fallbackCopy(text, ok));
    } catch (e) { fallbackCopy(text, ok); }
  }
  function fallbackCopy(text, ok) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (e) { /* ignore */ }
    ta.remove();
    copied ? ok() : toast('Copy is blocked here. Press and hold the text to copy it.');
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !ACT[el.dataset.act]) return;
    e.preventDefault();
    ACT[el.dataset.act](el, e);
  });
  document.addEventListener('change', (e) => {
    const k = e.target.dataset && e.target.dataset.set;
    if (!k) return;
    S().settings[k] = e.target.checked;
    save();
    if (k === 'lowData') document.documentElement.dataset.lowData = e.target.checked ? '1' : '';
    toast(e.target.checked ? 'Turned on' : 'Turned off');
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.dataset.form;
    if (!f) return;
    e.preventDefault();
    if (f === 'chat') { const i = $('#chat-input'); const v = i.value; i.value = ''; sendChat(v); }
    if (f === 'task') {
      const i = $('#task-new'); const v = i.value.trim(); if (!v) return;
      S().tasks.unshift({ id: Store.uid(), title: v, important: false, done: false, date: today(), created: Date.now() });
      save(); render(); $('#task-new').focus();
    }
    if (f === 'event') {
      const s = S();
      const title = $('#ev-title').value.trim(); if (!title) return;
      const date = $('#ev-date').value; const time = $('#ev-time').value;
      const dur = Number($('#ev-dur').value); const kind = $('#ev-kind').value; const fixed = $('#ev-fixed').checked;
      const slot = time ? { date, start: time } : Planner.suggestSlot(s, kind, dur, date);
      s.events.push({ id: Store.uid(), title, date: slot.date, start: slot.start, dur, kind, fixed, needsPower: kind === 'deep' || kind === 'meeting' });
      schedDate = slot.date;
      save(); closeSheet(); render();
      toast(time ? 'Plan saved' : `Ugent picked ${dayWord(slot.date)}, ${fmtTime(slot.start)}`);
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  window.addEventListener('hashchange', () => { closeSheet(); render(); });
  window.addEventListener('online', render);
  window.addEventListener('offline', render);

  /* ---------- Boot ---------- */
  Store.load();
  I18n.set(S().profile.lang);
  if (S().focus && S().focus.until <= Date.now()) { const f = S().focus; S().log.focus.push({ t: f.start, mins: f.mins }); S().focus = null; save(); }
  composer.innerHTML = `<form data-form="chat" aria-label="Message Ugent">
    <button type="button" class="round mic" data-act="mic" aria-label="Speak">${icon('mic')}</button>
    <input class="input" id="chat-input" autocomplete="off" aria-label="Message">
    <button type="submit" class="round send" aria-label="Send">${icon('send')}</button></form>`;
  render();

  const splash = $('#splash');
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(() => { splash.classList.add('hide'); setTimeout(() => splash.remove(), 400); }, reduce ? 300 : 1100);

  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* offline cache unavailable here */ }
  }
})();
