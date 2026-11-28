/* The Ugent admin console. Plain TypeScript and DOM, no framework.
 * Every screen asks the admin API for data and every button calls the admin API; the server decides what each role may do.
 * The console only hides buttons a role can't use, so people aren't offered things that would be refused. */
import type { Permission, StaffRole } from '@ugent/core/admin';
import { ROLE_INFO, STAFF_ROLES } from '@ugent/core/admin';
import { ApiError, type Session } from './api';

/* ---------- small helpers ---------- */
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const n = (v: number | null | undefined) => (v == null ? '–' : Number(v).toLocaleString('en-GB'));
const usd = (v: number | null | undefined) => (v == null ? 'Not set' : `$${v < 10 ? v.toFixed(2) : Math.round(v).toLocaleString('en-GB')}`);
const ngn = (v: number | null | undefined, rate: number | null) => (v == null || !rate ? '' : `₦${Math.round(v * rate).toLocaleString('en-GB')}`);
const when = (iso: string | null | undefined) => {
  if (!iso) return '–';
  const d = Date.now() - Date.parse(iso), m = Math.round(d / 60000);
  if (d < 0) { const h = Math.round(-d / 3600000); return h < 48 ? `in ${h} h` : `in ${Math.round(h / 24)} days`; }
  if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24); return days < 14 ? `${days} day${days > 1 ? 's' : ''} ago` : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const PILL: Record<string, string> = {
  active: 'good', executed: 'good', done: 'good', approved: 'good', resolved: 'good', closed: 'plain', on: 'good',
  open: 'warn', waiting: 'info', pending: 'warn', proposed: 'info', monitoring: 'info', investigating: 'crit', undone: 'plain',
  suspended: 'warn', banned: 'crit', failed: 'crit', blocked: 'crit', rejected: 'plain', expired: 'plain', off: 'crit',
  high: 'crit', medium: 'warn', low: 'plain', normal: 'plain', 'SEV-1': 'crit', 'SEV-2': 'warn', 'SEV-3': 'info',
};
const WORD: Record<string, string> = { executed: 'done', proposed: 'suggested', waAutoReply: 'auto-reply', consent_withdrawal: 'consent withdrawn' };
const pill = (s: string, label?: string) => `<span class="pill p-${PILL[s] ?? 'plain'}">${esc(label ?? WORD[s] ?? s)}</span>`;
const planName = (p: string) => ({ free: 'Free', pro: 'Pro', team: 'Team' })[p] ?? p;
const LANG: Record<string, string> = { en: 'English', pcm: 'Pidgin', yo: 'Yoruba', ha: 'Hausa', ig: 'Igbo', fr: 'French', sw: 'Swahili' };
const SERVICE: Record<string, string> = { googleCalendar: 'Google Calendar', gmail: 'Gmail', googleTasks: 'Google Tasks', googleMaps: 'Google Maps', whatsappBusiness: 'WhatsApp Business' };
const service = (c: string) => c.replace(/^\w+/, (k) => SERVICE[k] ?? k);
const plural = (v: number, one: string, many = `${one}s`) => `${n(v)} ${v === 1 ? one : many}`;
const PLATFORM: Record<string, string> = { android: 'Android', ios: 'iPhone', web: 'Web' };
const roleName = (r: string) => ROLE_INFO[r as StaffRole]?.name ?? r;
const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];

/* ---------- navigation ---------- */
interface Page { key: string; title: string; sub: string; perm: Permission; badge?: keyof Overview['open'] }
const PAGES: Page[] = [
  { key: 'home', title: 'Home', sub: 'What needs you today', perm: 'overview.view' },
  { key: 'users', title: 'Users', sub: 'Find someone, fix their account', perm: 'users.view' },
  { key: 'support', title: 'Support', sub: 'Tickets from the app', perm: 'support.view', badge: 'tickets' },
  { key: 'controls', title: 'Agent controls', sub: 'Pause what Ugent can do', perm: 'controls.view', badge: 'killSwitches' },
  { key: 'activity', title: 'Activity', sub: 'What Ugent did, without content', perm: 'activity.view' },
  { key: 'privacy', title: 'Privacy requests', sub: 'Exports and deletions', perm: 'privacy.view', badge: 'privacyRequests' },
  { key: 'incidents', title: 'Incidents', sub: 'Outages and how we handle them', perm: 'incidents.view', badge: 'incidents' },
  { key: 'approvals', title: 'Approvals', sub: 'Changes that need a second person', perm: 'approvals.view', badge: 'approvals' },
  { key: 'usage', title: 'AI usage & cost', sub: 'Requests, tokens, money', perm: 'usage.view' },
  { key: 'staff', title: 'Staff & access keys', sub: 'Who can sign in here', perm: 'staff.manage' },
  { key: 'audit', title: 'Audit log', sub: 'Every change, who and why', perm: 'audit.view' },
];

interface Me { staff: { id: string; name: string; roles: StaffRole[] }; permissions: Permission[] }
interface Overview {
  people: { total: number; activeToday: number; newThisWeek: number; byPlan: Record<string, number> };
  usage: { chatsToday: number; aiRequests24h: number; tokensIn24h: number; tokensOut24h: number; costUsd24h: number | null };
  actions: { last24h: Record<string, number>; successRate: number | null };
  open: { tickets: number; approvals: number; killSwitches: number; incidents: number; privacyRequests: number };
  attention: { level: string; title: string; detail: string; go: string }[];
}
type OkMsg = { ok: boolean; message: string; accessKey?: string; id?: string };

export interface AppOptions { session: Session; demo: boolean; demoKeys?: { name: string; role: StaffRole; key: string }[] }

export function startApp(root: HTMLElement, layer: HTMLElement, opt: AppOptions) {
  const S = opt.session;
  let me: Me | null = null;
  let counts: Overview['open'] | null = null;
  const can = (p: Permission) => !!me?.permissions.includes(p);
  const demoBar = opt.demo ? '<div class="demo-bar"><b>Demo console.</b> Everything here is made up and resets when you reload. The real console signs in to the real admin API.</div>' : '';

  /* ---------- toast and dialogs ---------- */
  let toastTimer = 0;
  function toast(msg: string, err = false) {
    $$('.toast').forEach((t) => t.remove());
    const t = document.createElement('div');
    t.className = `toast${err ? ' err' : ''}`; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.append(t);
    clearTimeout(toastTimer); toastTimer = window.setTimeout(() => t.remove(), 4200);
  }

  interface Field { name: string; label: string; type?: 'text' | 'textarea' | 'select' | 'number' | 'checks'; options?: [string, string][]; value?: string; placeholder?: string; hint?: string }
  interface Ask { title: string; intro?: string; blast?: string; fields?: Field[]; reason?: boolean; reasonHint?: string; confirm: string; danger?: boolean; run: (v: Record<string, string>) => Promise<OkMsg | void> }
  /** Opens a dialog. A reason is asked for every sensitive change; it goes in the audit log. */
  function ask(a: Ask) {
    const fields = [...(a.fields ?? []), ...(a.reason === false ? [] : [{ name: 'reason', label: 'Reason', type: 'textarea' as const, placeholder: a.reasonHint ?? 'Why are you doing this? Saved in the audit log.' }])];
    const fieldHtml = (f: Field) => {
      const id = `f_${f.name}`;
      const control = f.type === 'textarea' ? `<textarea id="${id}" name="${f.name}" placeholder="${esc(f.placeholder)}">${esc(f.value)}</textarea>`
        : f.type === 'select' ? `<select id="${id}" name="${f.name}">${f.options!.map(([v, l]) => `<option value="${esc(v)}"${v === f.value ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`
        : f.type === 'checks' ? `<div class="stack" style="gap:6px">${f.options!.map(([v, l]) => `<label class="small"><input type="checkbox" name="${f.name}" value="${esc(v)}"${(f.value ?? '').split(',').includes(v) ? ' checked' : ''}> ${esc(l)}</label>`).join('')}</div>`
        : `<input id="${id}" name="${f.name}" type="${f.type ?? 'text'}" value="${esc(f.value)}" placeholder="${esc(f.placeholder)}">`;
      return `<div class="field"><label for="${id}">${esc(f.label)}</label>${control}${f.hint ? `<div class="small muted">${esc(f.hint)}</div>` : ''}</div>`;
    };
    layer.innerHTML = `<div class="scrim"><form class="modal" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
      <h2 id="dlg-t">${esc(a.title)}</h2>${a.intro ? `<p class="muted" style="margin:8px 0 0">${a.intro}</p>` : ''}
      ${a.blast ? `<div class="blast">${esc(a.blast)}</div>` : ''}
      ${fields.map(fieldHtml).join('')}
      <div class="error" hidden></div>
      <div class="actions"><button type="button" class="btn" data-x>Cancel</button><button type="submit" class="btn ${a.danger ? 'danger solid' : 'primary'}">${esc(a.confirm)}</button></div>
    </form></div>`;
    const form = $<HTMLFormElement>('form', layer);
    const close = () => { layer.innerHTML = ''; document.removeEventListener('keydown', onKey); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    $('[data-x]', layer).onclick = close;
    $('.scrim', layer).addEventListener('mousedown', (e) => { if (e.target === e.currentTarget) close(); });
    ($('textarea, input, select', form) as HTMLElement | null)?.focus();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const v: Record<string, string> = {};
      for (const f of fields) v[f.name] = f.type === 'checks' ? $$<HTMLInputElement>(`[name="${f.name}"]:checked`, form).map((c) => c.value).join(',') : (form.elements.namedItem(f.name) as HTMLInputElement).value;
      const err = $('.error', form);
      if (a.reason !== false && v.reason.trim().length < 5) { err.hidden = false; err.textContent = 'Write a short reason (at least 5 characters). It is saved in the audit log.'; return; }
      const btn = $<HTMLButtonElement>('[type=submit]', form); btn.disabled = true;
      try {
        const r = await a.run(v);
        close();
        if (r?.accessKey) showKey(r.accessKey, r.message);
        else if (r?.message) toast(r.message);
        await render();
      } catch (x) {
        btn.disabled = false; err.hidden = false; err.textContent = x instanceof ApiError ? x.message : 'Something went wrong.';
        if (x instanceof ApiError && x.status === 401) { close(); signedOut(x.message); }
      }
    };
  }
  function showKey(key: string, message: string) {
    layer.innerHTML = `<div class="scrim"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="k-t">
      <h2 id="k-t">Copy this access key now</h2><p class="muted">${esc(message)}</p>
      <div class="key-reveal" id="newkey">${esc(key)}</div>
      <div class="note" style="margin-top:12px">Give it to the person privately, never in a group chat or email thread. It works only for them, and only until it is revoked or expires. Ugent stores only a fingerprint of it, so nobody can look it up later.</div>
      <div class="actions"><button class="btn" data-copy>Copy key</button><button class="btn primary" data-x>I've copied it</button></div></div></div>`;
    $('[data-copy]', layer).onclick = () => navigator.clipboard?.writeText(key).then(() => toast('Copied.'), () => toast('Select the key and copy it.', true));
    $('[data-x]', layer).onclick = () => { layer.innerHTML = ''; };
  }

  /* ---------- sign in ---------- */
  function signedOut(message?: string) {
    S.set(null); me = null;
    root.innerHTML = `${demoBar}<main class="signin"><div class="signin-card">
      <div class="wordmark">Ugent<span>Admin</span></div>
      <h1 style="margin-top:18px">Sign in</h1>
      <p class="muted" style="margin:6px 0 0">Enter your personal access key. A Super Admin gives each staff member their own key; it decides what you can see and do here.</p>
      <form id="signin"><div class="field"><label for="key">Access key</label>
        <input id="key" class="key-input" type="password" autocomplete="off" spellcheck="false" placeholder="ugk_xxxxxxxx_…"></div>
        <div class="error" ${message ? '' : 'hidden'}>${esc(message)}</div>
        <div class="btns" style="margin-top:16px"><button class="btn primary" type="submit">Sign in</button><label class="small muted"><input type="checkbox" id="show"> Show key</label></div>
      </form>
      <p class="small muted" style="margin-top:16px">Never share your key. If you think someone else has it, tell a Super Admin so they can revoke it. Sessions end after 12 hours, or 30 minutes without use.</p>
      ${opt.demoKeys ? `<div class="demo-keys"><h3>Demo keys, one per person</h3><p class="small muted" style="margin:4px 0 8px">Try a few: each role sees different screens and buttons.</p>
        ${opt.demoKeys.map((k) => `<div class="demo-key"><div class="who"><b>${esc(k.name)}</b> · ${esc(roleName(k.role))}<div class="small muted">${esc(ROLE_INFO[k.role].does)}</div></div><button class="btn small" data-key="${esc(k.key)}">Use</button></div>`).join('')}</div>` : ''}
    </div></main>`;
    const input = $<HTMLInputElement>('#key');
    $<HTMLInputElement>('#show').onchange = (e) => { input.type = (e.target as HTMLInputElement).checked ? 'text' : 'password'; };
    $$('[data-key]').forEach((b) => (b.onclick = () => { input.value = b.dataset.key!; input.type = 'text'; $<HTMLInputElement>('#show').checked = true; input.focus(); }));
    $<HTMLFormElement>('#signin').onsubmit = async (e) => {
      e.preventDefault();
      const err = $('.error');
      try {
        const r = await S.post<{ token: string }>('/admin/v1/auth/login', { accessKey: input.value.trim() });
        S.set(r.token); input.value = '';
        if (!location.hash || location.hash === '#') location.hash = '#home';
        await boot();
      } catch (x) { err.hidden = false; err.textContent = x instanceof ApiError ? x.message : 'Something went wrong.'; }
    };
    input.focus();
  }

  /* ---------- shell ---------- */
  async function boot() {
    if (!S.token) return signedOut();
    try { me = await S.get<Me>('/admin/v1/me'); } catch (x) { return signedOut(x instanceof ApiError && x.status !== 401 ? x.message : undefined); }
    window.onhashchange = () => render();
    await render();
  }
  const route = () => { const [page = 'home', ...rest] = location.hash.replace(/^#/, '').split('/'); return { page, id: rest.join('/') || null }; };

  async function render() {
    if (!me) return;
    const { page, id } = route();
    const allowed = PAGES.filter((p) => can(p.perm));
    const current = allowed.find((p) => p.key === page) ?? allowed[0];
    if (can('overview.view')) S.get<Overview>('/admin/v1/overview').then((o) => { counts = o.open; paintBadges(); }).catch(() => {});
    if (!$('.shell', root)) {
      root.innerHTML = `${demoBar}<div class="shell"><aside class="side"><div class="wordmark">Ugent<span>Admin</span></div>
        <nav class="nav" aria-label="Sections"></nav>
        <div class="me"><div><div class="name">${esc(me.staff.name)}</div><div class="small muted">${me.staff.roles.map(roleName).map(esc).join(', ')}</div></div>
        <button class="btn small" id="out">Sign out</button></div></aside><main class="main" id="main"></main></div>`;
      $('#out').onclick = async () => { await S.post('/admin/v1/auth/logout', {}).catch(() => {}); location.hash = ''; signedOut(); };
    }
    $('.nav', root).innerHTML = allowed.map((p) => `<a href="#${p.key}" class="${p === current ? 'on' : ''}" ${p === current ? 'aria-current="page"' : ''} data-page="${p.key}"><b>${esc(p.title)}<i class="badge" hidden></i></b><span>${esc(p.sub)}</span></a>`).join('');
    paintBadges();
    const main = $('#main', root);
    try { await SCREENS[current.key](main, id); }
    catch (x) {
      if (x instanceof ApiError && x.status === 401) return signedOut(x.message);
      main.innerHTML = `<div class="panel"><h2>That didn't load</h2><p class="muted">${esc(x instanceof ApiError ? x.message : 'Something went wrong.')}</p><button class="btn" id="retry">Try again</button></div>`;
      $('#retry').onclick = () => render();
    }
  }
  function paintBadges() {
    if (!counts) return;
    for (const p of PAGES) {
      const b = $(`[data-page="${p.key}"] .badge`, root) as HTMLElement | null;
      if (!b || !p.badge) continue;
      const v = counts[p.badge]; b.hidden = !v; b.textContent = String(v);
    }
  }
  const head = (title: string, intro: string, actions = '') => `<div class="head"><div><h1>${esc(title)}</h1><p>${intro}</p></div>${actions ? `<div class="btns">${actions}</div>` : ''}</div>`;
  const post = (path: string, body: unknown) => S.post<OkMsg>(`/admin/v1${path}`, body);

  /* ---------- screens ---------- */
  const SCREENS: Record<string, (el: HTMLElement, id: string | null) => Promise<void>> = {
    async home(el) {
      const o = await S.get<Overview>('/admin/v1/overview');
      counts = o.open; paintBadges();
      const need = o.attention.filter((a) => PAGES.some((p) => p.key === a.go && can(p.perm)));
      const hour = new Date().getHours();
      const hello = `${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}, ${me!.staff.name.split(' ')[0]}`;
      const done = o.actions.last24h.executed ?? 0, failed = o.actions.last24h.failed ?? 0, blocked = o.actions.last24h.blocked ?? 0;
      const plans = Object.entries(o.people.byPlan).map(([p, v]) => `${n(v)} ${planName(p)}`).join(' · ');
      const quick: [Permission, string, string][] = [
        ['users.view', '#users', 'Find a user'], ['support.view', '#support', 'Answer tickets'], ['controls.kill_action', '#controls', 'Pause something Ugent does'],
        ['controls.kill_integration', '#controls', 'Pause an integration'], ['incidents.manage', '#incidents', 'Open an incident'], ['privacy.process', '#privacy', 'Handle a privacy request'],
        ['usage.view', '#usage', 'See AI cost'], ['staff.manage', '#staff', 'Add a staff member'], ['audit.view', '#audit', 'Check the audit log'],
      ];
      const seen = new Set<string>();
      const quickHtml = quick.filter(([p, href]) => can(p) && !seen.has(href) && seen.add(href)).map(([, href, label]) => `<a class="btn" href="${href}">${esc(label)}</a>`).join('');
      el.innerHTML = `${head(hello, `You're signed in as <b>${me!.staff.roles.map(roleName).map(esc).join(', ')}</b>. ${esc(ROLE_INFO[me!.staff.roles[0]].does)}`)}
      <div class="stack">
        <div class="status-line ${need.length ? 'attention' : 'ok'}"><span class="dot"></span><div><b>${need.length ? `${need.length} thing${need.length > 1 ? 's' : ''} need${need.length > 1 ? '' : 's'} you` : 'Everything is running normally'}</b>
          <div class="small">${need.length ? 'Start with the top one. Each item opens the screen where you can deal with it.' : 'No open incidents, nothing paused and nobody waiting on you.'}</div></div></div>
        ${need.length ? `<section class="panel"><div class="panel-head"><h2>Needs you</h2></div>${need.map((a) => `<div class="todo">${pill(a.level === 'critical' ? 'high' : a.level === 'warning' ? 'medium' : 'waiting', a.level === 'critical' ? 'urgent' : a.level === 'warning' ? 'soon' : 'when you can')}
          <div class="txt"><b>${esc(a.title)}</b><span class="small muted">${esc(a.detail)}</span></div><a class="btn small" href="#${esc(a.go)}">Open</a></div>`).join('')}</section>` : ''}
        <section><h2 style="margin-bottom:10px">Ugent today</h2><div class="numbers">
          <div class="number"><div class="v">${n(o.people.activeToday)}</div><div class="l">People used Ugent today</div><div class="e">Out of ${n(o.people.total)} accounts: ${esc(plans)}</div></div>
          <div class="number"><div class="v">${n(o.people.newThisWeek)}</div><div class="l">New this week</div><div class="e">Accounts created in the last 7 days</div></div>
          <div class="number"><div class="v">${n(o.usage.chatsToday)}</div><div class="l">Chats today</div><div class="e">Messages people sent to Ugent. ${n(o.usage.aiRequests24h)} went to the cloud AI; the rest were answered on the phone.</div></div>
          <div class="number"><div class="v">${o.actions.successRate == null ? '–' : `${Math.round(o.actions.successRate * 100)}%`}</div><div class="l">Actions that worked</div><div class="e">${n(done)} done, ${n(failed)} failed, ${n(blocked)} stopped by a rule (last 24 h)</div></div>
          ${can('usage.view') ? `<div class="number"><div class="v">${usd(o.usage.costUsd24h)}</div><div class="l">AI cost, last 24 h</div><div class="e">${o.usage.costUsd24h == null ? 'Set model prices in AI usage & cost to see this.' : `${n(o.usage.tokensIn24h + o.usage.tokensOut24h)} tokens`}</div></div>` : ''}
        </div></section>
        ${quickHtml ? `<section class="panel"><div class="panel-head"><h2>Shortcuts for your role</h2></div><div class="btns">${quickHtml}</div></section>` : ''}
        <div class="note plain small">What you can't see here, by design: people's chats, memory, notes and habits. They live only on their phones. Names, numbers and emails are masked.</div>
      </div>`;
    },

    async users(el, id) {
      if (id) return userDetail(el, id);
      const q = new URLSearchParams(location.search).get('q') ?? (el.dataset.q ?? '');
      const { users } = await S.get<{ users: any[] }>(`/admin/v1/users${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      el.innerHTML = `${head('Users', 'Search by name or user ID. Names are shortened and phone numbers hidden; open someone to see what you can do for them.')}
      <section class="panel"><form id="uq" class="btns" style="margin-bottom:12px"><input type="search" id="q" value="${esc(q)}" placeholder="Name or user ID" style="max-width:340px"><button class="btn">Search</button></form>
      ${users.length ? `<div class="tbl"><table><thead><tr><th>Person</th><th>Plan</th><th>Account</th><th>Trust</th><th>Language</th><th>Last seen</th></tr></thead><tbody>
      ${users.map((u) => `<tr class="click ${u.status === 'banned' ? 'stripe-crit' : u.status === 'suspended' ? 'stripe-warn' : ''}" data-go="#users/${esc(u.id)}"><td><b>${esc(u.name)}</b><div class="mono muted">${esc(u.id)}</div></td><td>${esc(planName(u.plan))}</td><td>${pill(u.status)}</td><td>Level ${u.trustLevel}</td><td>${esc(LANG[u.lang] ?? u.lang)}</td><td>${when(u.lastSeenAt)}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">Nobody matches that search.</div>'}</section>`;
      $<HTMLFormElement>('#uq').onsubmit = (e) => { e.preventDefault(); el.dataset.q = $<HTMLInputElement>('#q').value.trim(); SCREENS.users(el, null); };
      bindRows(el);
    },

    async support(el, id) {
      if (id) return ticketDetail(el, id);
      const { tickets } = await S.get<{ tickets: any[] }>('/admin/v1/tickets');
      const filter = el.dataset.f ?? 'open';
      const list = tickets.filter((t) => filter === 'all' || t.status === filter);
      el.innerHTML = `${head('Support', 'Tickets people sent from the app. Phone numbers, emails, card numbers and codes are removed before you see them.')}
      <section class="panel"><div class="chips" style="margin-bottom:12px">${['open', 'waiting', 'closed', 'all'].map((f) => `<button class="chip ${f === filter ? 'on' : ''}" data-f="${f}">${f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)} (${f === 'all' ? tickets.length : tickets.filter((t) => t.status === f).length})</button>`).join('')}</div>
      ${list.length ? `<div class="tbl"><table><thead><tr><th>Ticket</th><th>From</th><th>Priority</th><th>Status</th><th>Received</th></tr></thead><tbody>
      ${list.map((t) => `<tr class="click ${t.priority === 'high' ? 'stripe-crit' : ''}" data-go="#support/${esc(t.id)}"><td><b>${esc(t.topic[0].toUpperCase() + t.topic.slice(1))}</b><div class="small muted">${esc(t.preview)}</div></td><td>${esc(t.userName)}<div class="small muted">${esc(planName(t.plan ?? ''))}</div></td><td>${pill(t.priority)}</td><td>${pill(t.status)}${t.assignedTo ? `<div class="small muted">${t.assignedTo === me!.staff.id ? 'yours' : 'taken'}</div>` : ''}</td><td>${when(t.createdAt)}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">No tickets here. Nice.</div>'}</section>`;
      $$('[data-f]', el).forEach((b) => (b.onclick = () => { el.dataset.f = b.dataset.f!; SCREENS.support(el, null); }));
      bindRows(el);
    },

    async controls(el) {
      const c = await S.get<{ actions: any[]; integrations: any[]; channels: any[]; history: any[] }>('/admin/v1/controls');
      const canAct = can('controls.kill_action'), canInt = can('controls.kill_integration');
      const sw = (type: string, t: any, allowed: boolean) => {
        const off = !!t.killSwitch;
        if (!allowed) return off ? pill('off', 'paused') : pill('on', 'on');
        return off ? `<button class="btn small" data-clear="${esc(t.killSwitch.id)}" data-name="${esc(t.name)}">Turn back on</button>` : `<button class="btn small danger" data-kill="${type}:${esc(t.key)}" data-name="${esc(t.name)}" data-aff="${t.affectedUsers}">Pause</button>`;
      };
      const row = (type: string, t: any, allowed: boolean, extra = '') => `<tr class="${t.killSwitch ? 'stripe-crit' : ''}"><td><b>${esc(t.name)}</b>${t.killSwitch ? `<div class="small" style="color:var(--crit)">Paused ${when(t.killSwitch.createdAt)}: ${esc(t.killSwitch.reason)}</div>` : ''}${t.note ? `<div class="small muted">${esc(t.note)}</div>` : ''}</td>${extra}<td class="num">${n(t.affectedUsers)}</td><td>${sw(type, t, allowed)}</td></tr>`;
      const live = c.actions.filter((a) => a.live), money = c.actions.filter((a) => !a.live);
      el.innerHTML = `${head('Agent controls', 'Pause something Ugent does, for everyone, within a minute. Use it when something is going wrong; you can turn it back on at any time. People see a plain message that it is paused.')}
      <div class="stack">
      <section class="panel"><div class="panel-head"><h2>Things Ugent can do</h2><span class="small muted">"People" = used it in the last 7 days</span></div><div class="tbl"><table><thead><tr><th>Action</th><th>Risk</th><th>Asks first</th><th>Limit</th><th>People</th><th></th></tr></thead><tbody>
        ${live.map((a) => row('action', a, canAct, `<td>${pill(a.risk)}</td><td>${a.confirm ? 'Yes' : 'No'}</td><td class="small">${esc(a.limit)}</td>`)).join('')}</tbody></table></div></section>
      <section class="panel"><div class="panel-head"><h2>Integrations</h2></div><div class="tbl"><table><thead><tr><th>Service</th><th>People</th><th></th></tr></thead><tbody>
        ${c.integrations.map((t) => row('integration', t, canInt)).join('')}${c.channels.map((t) => row('channel', t, canInt)).join('')}</tbody></table></div></section>
      <section class="panel"><div class="panel-head"><h2>Money actions</h2>${pill('off', 'off until approved')}</div>
        <p class="muted small" style="margin-top:0">These move money, so they stay off until a Super Admin asks and a <b>different</b> Super Admin approves. Even then, people must confirm every payment on their phone; nobody here can remove that.</p>
        <div class="tbl"><table><thead><tr><th>Action</th><th>Limit</th><th>Status</th><th></th></tr></thead><tbody>
        ${money.map((a) => `<tr><td><b>${esc(a.name)}</b></td><td class="small">${esc(a.limit)}</td><td>${a.enabled ? pill('on', 'approved, on') : pill('off', 'off')}</td><td>${!a.enabled && can('controls.request_high_risk') ? `<button class="btn small" data-req="${esc(a.key)}" data-name="${esc(a.name)}">Ask to switch on</button>` : ''}</td></tr>`).join('')}</tbody></table></div></section>
      <section class="panel"><div class="panel-head"><h2>Recent pauses</h2></div>${c.history.length ? `<ul class="timeline">${c.history.slice(0, 12).map((h) => `<li><b>${esc(nameOfTarget(c, h.targetType, h.targetKey))}</b> ${h.clearedAt ? `paused for ${dur(h.createdAt, h.clearedAt)}, back on ${when(h.clearedAt)}` : `paused ${when(h.createdAt)}, still off`}<div class="small muted">${esc(h.reason)}</div></li>`).join('')}</ul>` : '<div class="empty">Nothing has been paused yet.</div>'}</section>
      </div>`;
      $$('[data-kill]', el).forEach((b) => (b.onclick = () => {
        const [targetType, targetKey] = b.dataset.kill!.split(':');
        ask({ title: `Pause "${b.dataset.name}"?`, intro: 'Ugent stops doing this for everyone within a minute. The app tells people it is paused, and nothing else changes.',
          blast: `This affects about ${n(Number(b.dataset.aff))} people who used it this week.`, confirm: 'Pause it now', danger: true,
          reasonHint: 'What is going wrong? e.g. "Messages sent to wrong contacts, INC-8"',
          run: (v) => post('/controls', { op: 'kill', targetType, targetKey, reason: v.reason }) });
      }));
      $$('[data-clear]', el).forEach((b) => (b.onclick = () => ask({ title: `Turn "${b.dataset.name}" back on?`, intro: 'Phones and the server start using it again within a minute.', confirm: 'Turn back on',
        reasonHint: 'Why is it safe now?', run: (v) => post('/controls', { op: 'clear', id: b.dataset.clear, reason: v.reason }) })));
      $$('[data-req]', el).forEach((b) => (b.onclick = () => ask({ title: `Ask to switch on "${b.dataset.name}"`, intro: 'Another Super Admin has 48 hours to approve or reject this. You can\'t approve your own request.', confirm: 'Send for approval',
        reasonHint: 'Who is it for and why now?', run: (v) => post('/controls', { op: 'request_enable', key: b.dataset.req, reason: v.reason }) })));
    },

    async activity(el) {
      const f = el.dataset.f ?? '';
      const { events } = await S.get<{ events: any[] }>(`/admin/v1/activity${f ? `?status=${f}` : ''}`);
      el.innerHTML = `${head('Activity', 'What Ugent suggested and did, newest first. You see the type of action and its outcome, never what anyone wrote.')}
      <section class="panel"><div class="chips" style="margin-bottom:12px">${[['', 'Everything'], ['executed', 'Done'], ['proposed', 'Suggested'], ['failed', 'Failed'], ['blocked', 'Stopped by a rule'], ['undone', 'Undone']].map(([k, l]) => `<button class="chip ${k === f ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
      ${events.length ? `<div class="tbl"><table><thead><tr><th>When</th><th>What</th><th>Outcome</th><th>Where</th><th>User</th></tr></thead><tbody>
      ${events.map((e) => `<tr class="${e.status === 'failed' || e.status === 'blocked' ? 'stripe-crit' : ''}"><td class="small">${when(e.at)}</td><td><b>${esc(e.summary)}</b><div class="small muted">${pill(e.risk, `${e.risk} risk`)}</div></td><td>${pill(e.status)}${e.errorCode ? `<div class="small muted">${esc(explain(e.errorCode))}</div>` : ''}</td><td class="small">${esc(e.source === 'cloud' ? 'Cloud AI' : e.source === 'device' ? 'On the phone' : 'Server')}${e.latencyMs ? `<div class="muted">${(e.latencyMs / 1000).toFixed(1)} s</div>` : ''}</td><td>${can('users.view') ? `<a class="mono" href="#users/${esc(e.userId)}">${esc(e.userId)}</a>` : `<span class="mono">${esc(e.userId)}</span>`}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">Nothing matches.</div>'}</section>`;
      $$('[data-f]', el).forEach((b) => (b.onclick = () => { el.dataset.f = b.dataset.f!; SCREENS.activity(el, null); }));
    },

    async privacy(el) {
      const { requests } = await S.get<{ requests: any[] }>('/admin/v1/privacy');
      const canDo = can('privacy.process');
      const TYPE: Record<string, string> = { export: 'Copy of their data', deletion: 'Delete their account', correction: 'Correct their data', consent_withdrawal: 'Withdraw consent' };
      el.innerHTML = `${head('Privacy requests', 'People asking for a copy of their data, or for it to be deleted. We answer within 30 days (Nigeria Data Protection Act). Requests made in the app arrive here automatically.', canDo ? '<button class="btn primary" id="newreq">Log a request</button>' : '')}
      <section class="panel">${requests.length ? `<div class="tbl"><table><thead><tr><th>Request</th><th>Person</th><th>Status</th><th>Due</th><th></th></tr></thead><tbody>
      ${requests.map((r) => { const late = r.status === 'open' && Date.parse(r.dueAt) < Date.now() + 5 * 86400000;
        return `<tr class="${late ? 'stripe-warn' : ''}"><td><b>${esc(TYPE[r.type] ?? r.type)}</b><div class="small muted">From ${r.source === 'app' ? 'the app' : 'staff'} · ${when(r.createdAt)}</div></td><td>${esc(r.userName)}<div class="mono muted">${esc(r.userId)}</div></td><td>${pill(r.status)}</td><td>${r.status === 'open' ? `<b${late ? ' style="color:var(--warn)"' : ''}>${when(r.dueAt)}</b>` : `<span class="small muted">Closed ${when(r.completedAt)}</span>`}</td>
        <td>${canDo && r.status === 'open' ? `<div class="btns">${r.type === 'deletion' ? `<button class="btn small danger" data-del="${esc(r.id)}">Run deletion</button>` : `<button class="btn small" data-done="${esc(r.id)}">Mark done</button>`}<button class="btn small" data-rej="${esc(r.id)}">Reject</button></div>` : ''}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<div class="empty">No privacy requests.</div>'}</section>
      <div class="note plain small" style="margin-top:16px">A copy of their data is downloaded by the person in the app (Settings, Privacy), so we never send files by email. Deletion removes their account and everything on our servers; activity counts are kept without their ID.</div>`;
      $('#newreq', el)?.addEventListener('click', () => ask({ title: 'Log a privacy request', intro: 'For requests that reach us outside the app, e.g. by email to privacy@.', confirm: 'Log it',
        fields: [{ name: 'userId', label: 'User ID', placeholder: 'u_…' }, { name: 'type', label: 'They want', type: 'select', options: Object.entries(TYPE) }],
        run: (v) => post('/privacy', { userId: v.userId.trim(), type: v.type, reason: v.reason }) }));
      $$('[data-del]', el).forEach((b) => (b.onclick = () => ask({ title: 'Delete this account for good?', blast: 'This can\'t be undone. Their account, plans, tasks, connections and tickets are deleted from our servers.', confirm: 'Delete everything', danger: true,
        reasonHint: 'e.g. "Requested in app, identity confirmed by their signed-in device"', run: (v) => post(`/privacy/${b.dataset.del}`, { action: 'run_deletion', reason: v.reason }) })));
      $$('[data-done]', el).forEach((b) => (b.onclick = () => ask({ title: 'Mark this request as done?', confirm: 'Mark done', run: (v) => post(`/privacy/${b.dataset.done}`, { action: 'complete', reason: v.reason }) })));
      $$('[data-rej]', el).forEach((b) => (b.onclick = () => ask({ title: 'Reject this request?', intro: 'Only when we can\'t confirm who is asking, or the law lets us refuse. Say which.', confirm: 'Reject', danger: true, run: (v) => post(`/privacy/${b.dataset.rej}`, { action: 'reject', reason: v.reason }) })));
    },

    async incidents(el) {
      const { incidents } = await S.get<{ incidents: any[] }>('/admin/v1/incidents');
      const canDo = can('incidents.manage');
      const open = incidents.filter((i) => !i.resolvedAt), past = incidents.filter((i) => i.resolvedAt);
      const card = (i: any) => `<section class="panel"><div class="panel-head"><div><h2>${esc(i.id)} · ${esc(i.title)}</h2><div class="small muted">${esc(i.components)} · owner ${esc(i.ownerName ?? '–')} · started ${when(i.startedAt)}${i.resolvedAt ? `, resolved after ${dur(i.startedAt, i.resolvedAt)}` : ''}</div></div><div class="btns">${pill(i.severity)}${pill(i.status)}</div></div>
        <dl class="kv" style="margin-bottom:12px"><dt>What users were told</dt><dd>${esc(i.userComms ?? 'Not yet')}</dd></dl>
        <ul class="timeline">${i.updates.map((u: any) => `<li>${esc(u.body)}<div class="small muted">${when(u.at)} · ${esc(u.by ?? '')}</div></li>`).join('')}</ul>
        ${canDo && !i.resolvedAt ? `<div class="btns" style="margin-top:8px"><button class="btn small" data-upd="${esc(i.id)}">Add update</button><button class="btn small" data-comms="${esc(i.id)}">Tell users</button><button class="btn small primary" data-res="${esc(i.id)}">Resolve</button></div>` : ''}</section>`;
      el.innerHTML = `${head('Incidents', 'When something is broken for many people. Open one, keep a timeline, tell users what is happening, then resolve it. SEV-1 = Ugent is down or unsafe; SEV-2 = a main feature is broken; SEV-3 = degraded.', canDo ? '<button class="btn primary" id="newinc">Open an incident</button>' : '')}
      <div class="stack">${open.length ? open.map(card).join('') : '<div class="status-line ok"><span class="dot"></span><b>No open incidents</b></div>'}
      ${past.length ? `<h2>Resolved</h2>${past.map(card).join('')}` : ''}</div>`;
      $('#newinc', el)?.addEventListener('click', () => ask({ title: 'Open an incident', confirm: 'Open incident', reasonHint: 'What are people seeing? e.g. "Chat replies taking over 20 s"',
        fields: [{ name: 'title', label: 'Short title', placeholder: 'e.g. Google Calendar not syncing' },
          { name: 'severity', label: 'How bad?', type: 'select', value: 'SEV-2', options: [['SEV-1', 'SEV-1: Ugent is down or unsafe'], ['SEV-2', 'SEV-2: a main feature is broken'], ['SEV-3', 'SEV-3: slower or partly broken']] },
          { name: 'components', label: 'What is affected', placeholder: 'e.g. Cloud chat, Google Calendar' }],
        run: (v) => post('/incidents', { title: v.title, severity: v.severity, components: v.components, reason: v.reason }) }));
      const upd = (sel: string, action: string, title: string, label: string, confirm: string) => $$(`[${sel}]`, el).forEach((b) => (b.onclick = () => ask({ title, confirm, reason: false,
        fields: [{ name: 'body', label, type: 'textarea' }], run: (v) => post(`/incidents/${b.getAttribute(sel)}`, { action, body: v.body }) })));
      upd('data-upd', 'update', 'Add an update', 'What changed?', 'Add update');
      upd('data-comms', 'comms', 'What are we telling users?', 'Message shown to users (in-app banner, status page)', 'Save');
      upd('data-res', 'resolve', 'Resolve this incident', 'What fixed it?', 'Resolve');
    },

    async approvals(el) {
      const { approvals } = await S.get<{ approvals: any[] }>('/admin/v1/approvals');
      const canDecide = can('approvals.decide');
      el.innerHTML = `${head('Approvals', 'Risky changes need two people: one asks, a different Super Admin approves. Requests expire after 48 hours.')}
      <section class="panel">${approvals.length ? `<div class="tbl"><table><thead><tr><th>Change</th><th>Asked by</th><th>Status</th><th></th></tr></thead><tbody>
      ${approvals.map((a) => `<tr><td><b>${esc(a.summary)}</b><div class="small muted">Reason: ${esc(a.reason)}</div>${a.decisionReason ? `<div class="small muted">Decision: ${esc(a.decisionReason)} (${esc(a.decidedByName ?? '')})</div>` : ''}</td>
        <td>${esc(a.requestedByName ?? '')}${a.mine ? ' <span class="small muted">(you)</span>' : ''}<div class="small muted">${when(a.createdAt)}</div></td><td>${pill(a.status)}${a.status === 'pending' ? `<div class="small muted">expires ${when(a.expiresAt)}</div>` : ''}</td>
        <td>${a.status === 'pending' && canDecide ? (a.mine ? '<span class="small muted">Someone else must decide</span>' : `<div class="btns"><button class="btn small primary" data-yes="${esc(a.id)}">Approve</button><button class="btn small" data-no="${esc(a.id)}">Reject</button></div>`) : ''}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">No approval requests.</div>'}</section>`;
      $$('[data-yes]', el).forEach((b) => (b.onclick = () => ask({ title: 'Approve this change?', intro: 'It goes live straight away. People will still have to confirm each payment on their phone.', confirm: 'Approve', danger: true,
        run: (v) => post(`/approvals/${b.dataset.yes}`, { decision: 'approve', reason: v.reason }) })));
      $$('[data-no]', el).forEach((b) => (b.onclick = () => ask({ title: 'Reject this change?', confirm: 'Reject', run: (v) => post(`/approvals/${b.dataset.no}`, { decision: 'reject', reason: v.reason }) })));
    },

    async usage(el) {
      const u = await S.get<{ daily: any[]; byModel: any[]; prices: Record<string, { inPerMTok: number; outPerMTok: number }>; ngnPerUsd: number | null }>('/admin/v1/usage');
      const max = Math.max(1, ...u.daily.map((d) => d.requests));
      const total = u.daily.reduce((a, d) => a + (d.costUsd ?? 0), 0), priced = u.daily.some((d) => d.costUsd != null);
      const today = u.daily[u.daily.length - 1];
      const models = [...new Set([...u.byModel.map((m) => m.model), ...Object.keys(u.prices), 'claude-opus-5-5'])].filter((m) => m !== 'on-device');
      el.innerHTML = `${head('AI usage & cost', 'How much Ugent uses the cloud AI and what it costs. Messages answered on the phone are free and not counted here.', can('usage.configure') ? '<button class="btn primary" id="setp">Set prices</button>' : '')}
      <div class="stack">
        <div class="numbers">
          <div class="number"><div class="v">${n(today?.requests ?? 0)}</div><div class="l">Cloud AI requests today</div><div class="e">From ${n(today?.users ?? 0)} people</div></div>
          <div class="number"><div class="v">${priced ? usd(today?.costUsd) : 'Not set'}</div><div class="l">Cost today</div><div class="e">${priced ? ngn(today?.costUsd, u.ngnPerUsd) : 'Set model prices to see cost'}</div></div>
          <div class="number"><div class="v">${priced ? usd(total) : 'Not set'}</div><div class="l">Cost, last 14 days</div><div class="e">${priced ? ngn(total, u.ngnPerUsd) : ''}</div></div>
          <div class="number"><div class="v">${u.ngnPerUsd ? `₦${n(u.ngnPerUsd)}` : 'Not set'}</div><div class="l">Naira per dollar</div><div class="e">Used to show costs in naira</div></div>
        </div>
        <section class="panel"><div class="panel-head"><h2>Cloud AI requests per day</h2><span class="small muted">Last 14 days</span></div>
          ${u.daily.length ? `<div class="bars" role="img" aria-label="Requests per day">${u.daily.map((d, i) => `<div class="${i === u.daily.length - 1 ? 'last' : ''}" style="height:${Math.max(2, (d.requests / max) * 100)}%" title="${esc(d.day)}: ${n(d.requests)} requests${d.costUsd != null ? `, ${usd(d.costUsd)}` : ''}"></div>`).join('')}</div>
          <div class="bar-labels"><span>${esc(u.daily[0].day)}</span><span>${esc(u.daily[u.daily.length - 1].day)}</span></div>` : '<div class="empty">No cloud AI requests yet.</div>'}</section>
        <section class="panel"><div class="panel-head"><h2>By model, last 30 days</h2></div><div class="tbl"><table><thead><tr><th>Model</th><th>Requests</th><th>Tokens in</th><th>Tokens out</th><th>Avg reply</th><th>Cost</th></tr></thead><tbody>
          ${u.byModel.length ? u.byModel.map((m) => `<tr><td class="mono">${esc(m.model)}</td><td class="num">${n(m.requests)}</td><td class="num">${n(m.tokensIn)}</td><td class="num">${n(m.tokensOut)}</td><td class="num">${(m.avgMs / 1000).toFixed(1)} s</td><td class="num">${usd(m.costUsd)}<div class="small muted">${ngn(m.costUsd, u.ngnPerUsd)}</div></td></tr>`).join('') : '<tr><td colspan="6" class="empty">No data yet.</td></tr>'}</tbody></table></div>
          <p class="small muted">Prices: ${models.map((m) => u.prices[m] ? `${esc(m)} $${u.prices[m].inPerMTok / 1e6} in / $${u.prices[m].outPerMTok / 1e6} out per million tokens` : `${esc(m)} not set`).join(' · ')}</p></section>
      </div>`;
      $('#setp', el)?.addEventListener('click', () => {
        const m = models[0];
        ask({ title: 'Set AI prices', intro: 'Prices are saved as a new version; old ones are kept. New usage is costed with these prices from now on.', confirm: 'Save prices',
          fields: [{ name: 'model', label: 'Model', type: 'select', value: m, options: models.map((x) => [x, x]) },
            { name: 'in', label: 'USD per million input tokens', type: 'number', value: u.prices[m] ? String(u.prices[m].inPerMTok / 1e6) : '' },
            { name: 'out', label: 'USD per million output tokens', type: 'number', value: u.prices[m] ? String(u.prices[m].outPerMTok / 1e6) : '' },
            { name: 'fx', label: 'Naira per US dollar', type: 'number', value: u.ngnPerUsd ? String(u.ngnPerUsd) : '' }],
          reasonHint: 'e.g. "Provider price list, 1 Nov"',
          run: (v) => post('/usage', { ...(v.in && v.out ? { prices: { [v.model]: { inUsdPerMTok: Number(v.in), outUsdPerMTok: Number(v.out) } } } : {}), ...(v.fx ? { ngnPerUsd: Number(v.fx) } : {}), reason: v.reason }) });
      });
    },

    async staff(el) {
      const { staff } = await S.get<{ staff: any[] }>('/admin/v1/staff');
      const roleOpts = STAFF_ROLES.map((r) => [r, `${ROLE_INFO[r].name}: ${ROLE_INFO[r].does}`] as [string, string]);
      el.innerHTML = `${head('Staff & access keys', 'Everyone who can sign in to this console. Each person has their own access key; their role decides what they can see and do. Revoke a key the moment it may have leaked.', '<button class="btn primary" id="add">Add staff member</button>')}
      <div class="stack">${staff.map((s) => `<section class="panel"><div class="panel-head"><div><h2>${esc(s.name)}${s.id === me!.staff.id ? ' <span class="small muted">(you)</span>' : ''}</h2><div class="small muted">${s.roles.map((r: string) => esc(roleName(r))).join(', ')}${s.email ? ` · ${esc(s.email)}` : ''} · added ${when(s.createdAt)}</div></div>
        <div class="btns">${s.disabledAt ? pill('suspended', 'disabled') : pill('active')}<button class="btn small" data-roles="${esc(s.id)}" data-cur="${esc(s.roles.join(','))}">Change role</button><button class="btn small" data-issue="${esc(s.id)}">New key</button>
        ${s.id !== me!.staff.id ? (s.disabledAt ? `<button class="btn small" data-en="${esc(s.id)}">Re-enable</button>` : `<button class="btn small danger" data-dis="${esc(s.id)}">Disable</button>`) : ''}</div></div>
        <div class="tbl"><table><thead><tr><th>Key</th><th>Label</th><th>Last used</th><th>Expires</th><th>Status</th><th></th></tr></thead><tbody>
        ${s.keys.map((k: any) => { const expired = k.expiresAt && Date.parse(k.expiresAt) < Date.now();
          return `<tr><td class="mono">${esc(k.hint)}</td><td>${esc(k.label)}</td><td>${when(k.lastUsedAt)}</td><td>${k.expiresAt ? when(k.expiresAt) : 'Never'}</td><td>${k.revokedAt ? pill('rejected', 'revoked') : expired ? pill('expired') : pill('active')}</td><td>${!k.revokedAt && !expired ? `<button class="btn small danger" data-rev="${esc(s.id)}:${esc(k.id)}" data-hint="${esc(k.hint)}">Revoke</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="6" class="muted">No keys yet.</td></tr>'}
        </tbody></table></div></section>`).join('')}</div>`;
      const days: [string, string][] = [['30', '30 days'], ['90', '90 days (recommended)'], ['180', '180 days'], ['365', '1 year']];
      $('#add', el).onclick = () => ask({ title: 'Add a staff member', intro: 'They get their own access key, shown once on the next screen. Give the smallest role that lets them do their job.', confirm: 'Add and create key',
        fields: [{ name: 'name', label: 'Full name' }, { name: 'email', label: 'Work email (optional)', placeholder: 'name@meai.africa' },
          { name: 'role', label: 'Role', type: 'select', value: 'support', options: roleOpts }, { name: 'days', label: 'Key expires after', type: 'select', value: '90', options: days }],
        reasonHint: 'e.g. "New support hire, starts Monday"',
        run: (v) => post('/staff', { name: v.name, email: v.email.trim() || undefined, role: v.role, expiresInDays: Number(v.days), reason: v.reason }) });
      $$('[data-issue]', el).forEach((b) => (b.onclick = () => ask({ title: 'Issue a new access key', intro: 'Their existing keys keep working until you revoke them.', confirm: 'Create key',
        fields: [{ name: 'days', label: 'Expires after', type: 'select', value: '90', options: days }], reasonHint: 'e.g. "Lost laptop, replacing key"',
        run: (v) => post(`/staff/${b.dataset.issue}`, { action: 'issue_key', expiresInDays: Number(v.days), reason: v.reason }) })));
      $$('[data-rev]', el).forEach((b) => { const [sid, keyId] = b.dataset.rev!.split(':'); b.onclick = () => ask({ title: `Revoke ${b.dataset.hint}?`, intro: 'Anyone using this key is signed out straight away and can\'t sign in with it again.', confirm: 'Revoke key', danger: true,
        run: (v) => post(`/staff/${sid}`, { action: 'revoke_key', keyId, reason: v.reason }) }); });
      $$('[data-roles]', el).forEach((b) => (b.onclick = () => ask({ title: 'Change role', intro: 'Takes effect on their next click.', confirm: 'Save roles',
        fields: [{ name: 'roles', label: 'Roles', type: 'checks', value: b.dataset.cur, options: roleOpts }],
        run: (v) => post(`/staff/${b.dataset.roles}`, { action: 'set_roles', roles: v.roles.split(',').filter(Boolean), reason: v.reason }) })));
      $$('[data-dis]', el).forEach((b) => (b.onclick = () => ask({ title: 'Disable this staff member?', intro: 'They are signed out and none of their keys work until re-enabled.', confirm: 'Disable', danger: true,
        run: (v) => post(`/staff/${b.dataset.dis}`, { action: 'disable', reason: v.reason }) })));
      $$('[data-en]', el).forEach((b) => (b.onclick = () => ask({ title: 'Re-enable this staff member?', confirm: 'Re-enable', run: (v) => post(`/staff/${b.dataset.en}`, { action: 'enable', reason: v.reason }) })));
    },

    async audit(el) {
      const view = el.dataset.v ?? '';
      const { entries } = await S.get<{ entries: any[] }>(`/admin/v1/audit${view ? `?view=${view}` : ''}`);
      el.innerHTML = `${head('Audit log', 'Every change made in this console: who, when, why, and what it was before and after. Entries can\'t be edited or deleted, by anyone.')}
      <section class="panel"><div class="chips" style="margin-bottom:12px">${[['', 'Everything'], ['users', 'User accounts'], ['controls', 'Controls & approvals'], ['staff', 'Staff & keys'], ['money', 'Prices & money']].map(([k, l]) => `<button class="chip ${k === view ? 'on' : ''}" data-v="${k}">${l}</button>`).join('')}</div>
      ${entries.length ? `<div class="tbl"><table><thead><tr><th>When</th><th>Who</th><th>Did</th><th>Reason</th><th>Change</th></tr></thead><tbody>
      ${entries.map((a) => `<tr><td class="small">${when(a.at)}<div class="muted">${esc(new Date(a.at).toLocaleString('en-GB'))}</div></td><td>${esc(a.staffName)}<div class="small muted">${esc(roleName(a.role))}</div></td><td><b>${esc(a.action)}</b><div class="mono muted">${esc(a.targetType)} ${esc(a.targetId)}</div></td><td>${esc(a.reason)}</td><td class="mono small">${a.before || a.after ? `${esc(JSON.stringify(a.before))} → ${esc(JSON.stringify(a.after))}` : '–'}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="empty">Nothing yet.</div>'}</section>`;
      $$('[data-v]', el).forEach((b) => (b.onclick = () => { el.dataset.v = b.dataset.v!; SCREENS.audit(el, null); }));
    },
  };

  async function userDetail(el: HTMLElement, id: string) {
    const d = await S.get<any>(`/admin/v1/users/${encodeURIComponent(id)}`);
    const u = d.user;
    const btn = (perm: Permission, action: string, label: string, danger = false, show = true) => (can(perm) && show ? `<button class="btn ${danger ? 'danger' : ''}" data-act="${action}">${esc(label)}</button>` : '');
    const lvl = d.trust.levels.find((l: any) => l.level === u.trustLevel);
    el.innerHTML = `<p><a href="#users">← All users</a></p>
      ${head(u.name, `<span class="mono">${esc(u.id)}</span> · ${esc(planName(u.plan))} plan · joined ${when(u.createdAt)} · last seen ${when(u.lastSeenAt)}`, pill(u.status))}
      <div class="row2"><div class="stack">
        <section class="panel"><div class="panel-head"><h2>Account</h2></div><dl class="kv">
          <dt>Status</dt><dd>${pill(u.status)} ${u.status === 'suspended' ? '<span class="small muted">Can\'t use the cloud or do actions until restored.</span>' : u.status === 'banned' ? '<span class="small muted">Can\'t sign in.</span>' : ''}</dd>
          <dt>Trust level</dt><dd><b>${u.trustLevel}: ${esc(lvl?.name ?? '')}</b><div class="small muted">${esc(lvl?.does ?? '')}</div></dd>
          <dt>Language</dt><dd>${esc(LANG[u.lang] ?? u.lang)}</dd><dt>Phone</dt><dd>${esc(PLATFORM[u.platform] ?? u.platform ?? '–')}</dd>
          <dt>On our servers</dt><dd>${plural(d.counts.tasks, 'task')} · ${plural(d.counts.plans, 'plan')} · ${plural(d.counts.tickets, 'ticket')} · ${plural(u.chatsToday ?? 0, 'chat')} today</dd>
          <dt>Connected</dt><dd>${d.connected.length ? d.connected.map((c: string) => `<span class="pill p-info">${esc(service(c))}</span>`).join(' ') : '<span class="muted">Nothing</span>'}</dd>
        </dl><div class="note plain small" style="margin-top:14px">${esc(d.onPhoneOnly)}</div></section>
        <section class="panel"><div class="panel-head"><h2>Recent activity</h2></div>${d.activity.length ? `<ul class="timeline">${d.activity.map((e: any) => `<li>${esc(e.summary)} ${pill(e.status)}${e.errorCode ? ` <span class="small muted">${esc(explain(e.errorCode))}</span>` : ''}<div class="small muted">${when(e.at)}</div></li>`).join('')}</ul>` : '<div class="empty">No activity recorded.</div>'}</section>
      </div><div class="stack">
        <section class="panel"><div class="panel-head"><h2>What you can do</h2></div>
          <div class="stack" style="gap:8px">
          ${btn('users.logout', 'logout', 'Sign out on all devices')}
          ${btn('users.disconnect', 'disconnect', 'Disconnect Google and WhatsApp', false, d.connected.length > 0)}
          ${btn('users.trust_lower', 'trust_lower', 'Lower trust level', false, u.trustLevel > 0)}
          ${btn('users.suspend', 'suspend', 'Suspend account', true, u.status === 'active')}
          ${btn('users.suspend', 'restore', 'Restore account', false, u.status !== 'active')}
          ${btn('users.ban', 'ban', 'Ban account', true, u.status !== 'banned')}
          ${btn('users.note', 'note', 'Add a staff note')}
          ${can('privacy.process') ? '<button class="btn" data-priv>Log a privacy request</button>' : ''}
          </div>
          <p class="small muted">Nobody here can raise a trust level or skip the confirmations people see on their phone.</p></section>
        <section class="panel"><div class="panel-head"><h2>Staff notes</h2></div>${d.notes.length ? d.notes.map((x: any) => `<div class="todo"><div class="txt">${esc(x.note)}<div class="small muted">${when(x.createdAt)}</div></div></div>`).join('') : '<div class="empty">No notes.</div>'}</section>
        ${d.privacyRequests.length ? `<section class="panel"><div class="panel-head"><h2>Privacy requests</h2></div>${d.privacyRequests.map((r: any) => `<div class="todo"><div class="txt"><b>${esc(r.type)}</b><span class="small muted">due ${when(r.dueAt)}</span></div>${pill(r.status)}</div>`).join('')}</section>` : ''}
      </div></div>`;
    const ACT: Record<string, Partial<Ask>> = {
      logout: { title: 'Sign them out everywhere?', intro: 'The app signs them in again quietly next time they open it. Use this if a phone was lost or stolen.', confirm: 'Sign out' },
      disconnect: { title: 'Disconnect their services?', intro: 'Google and WhatsApp Business are unlinked. They can reconnect in the app.', confirm: 'Disconnect' },
      trust_lower: { title: 'Lower their trust level?', intro: `From ${u.trustLevel} to ${u.trustLevel - 1}. Ugent will do less on its own for them. Only they can raise it again, from the app.`, confirm: 'Lower trust' },
      suspend: { title: 'Suspend this account?', intro: 'They are signed out, the cloud AI and all actions stop for them, and WhatsApp auto-replies pause. Their data stays.', confirm: 'Suspend', danger: true, reasonHint: 'e.g. "Mass messaging, 290 contacts in 2 days"' },
      restore: { title: 'Restore this account?', confirm: 'Restore' },
      ban: { title: 'Ban this account?', intro: 'They can\'t sign in again on any device. Use for serious or repeated abuse.', blast: 'Banning is for serious abuse. Write down the evidence in the reason.', confirm: 'Ban', danger: true },
      note: { title: 'Add a staff note', intro: 'Only staff see notes. Don\'t paste anything the user wrote.', confirm: 'Add note', fields: [{ name: 'note', label: 'Note', type: 'textarea' }] },
    };
    $$('[data-act]', el).forEach((b) => (b.onclick = () => {
      const action = b.dataset.act!;
      ask({ confirm: 'Confirm', ...ACT[action], title: ACT[action].title!, run: (v) => post(`/users/${encodeURIComponent(u.id)}`, { action, reason: v.reason, ...(v.note ? { note: v.note } : {}) }) } as Ask);
    }));
    $('[data-priv]', el)?.addEventListener('click', () => ask({ title: 'Log a privacy request', confirm: 'Log it',
      fields: [{ name: 'type', label: 'They want', type: 'select', options: [['export', 'Copy of their data'], ['deletion', 'Delete their account'], ['correction', 'Correct their data'], ['consent_withdrawal', 'Withdraw consent']] }],
      run: (v) => post('/privacy', { userId: u.id, type: v.type, reason: v.reason }) }));
  }

  async function ticketDetail(el: HTMLElement, id: string) {
    const d = await S.get<any>(`/admin/v1/tickets/${encodeURIComponent(id)}`);
    const t = d.ticket, canReply = can('support.reply');
    el.innerHTML = `<p><a href="#support">← All tickets</a></p>
      ${head(`${t.topic[0].toUpperCase()}${t.topic.slice(1)} from ${d.user?.name ?? 'a deleted user'}`, `<span class="mono">${esc(t.id)}</span> · received ${when(t.createdAt)} · ${t.assignedTo ? (t.assignedTo === me!.staff.id ? 'assigned to you' : 'assigned to a teammate') : 'not assigned'}`, `${pill(t.priority)}${pill(t.status)}`)}
      <div class="row2"><div class="stack">
        <section class="panel"><div class="panel-head"><h2>Their message</h2><span class="small muted">Personal details removed</span></div><p style="margin:0;white-space:pre-wrap">${esc(t.message)}</p>
          ${t.contact ? `<p class="small muted">Contact: ${esc(t.contact)}</p>` : ''}</section>
        <section class="panel"><div class="panel-head"><h2>Replies</h2></div>${d.replies.length ? `<ul class="timeline">${d.replies.map((r: any) => `<li style="white-space:pre-wrap">${esc(r.body)}<div class="small muted">${when(r.createdAt)}</div></li>`).join('')}</ul>` : '<div class="empty">No replies yet.</div>'}
          ${canReply ? `<form id="rep" class="field"><label for="rb">Reply to them</label><textarea id="rb" placeholder="Plain words. Never ask for codes, PINs or passwords."></textarea><div class="btns" style="margin-top:8px"><button class="btn primary">Send reply</button></div></form>` : ''}</section>
      </div><div class="stack">
        ${d.user ? `<section class="panel"><div class="panel-head"><h2>Person</h2>${can('users.view') ? `<a class="btn small" href="#users/${esc(d.user.id)}">Open account</a>` : ''}</div><dl class="kv"><dt>Name</dt><dd>${esc(d.user.name)}</dd><dt>Plan</dt><dd>${esc(planName(d.user.plan))}</dd><dt>Account</dt><dd>${pill(d.user.status)}</dd><dt>Language</dt><dd>${esc(LANG[d.user.lang] ?? d.user.lang)}</dd></dl></section>` : ''}
        ${canReply ? `<section class="panel"><div class="panel-head"><h2>Ticket</h2></div><div class="stack" style="gap:8px">
          ${t.assignedTo !== me!.staff.id ? '<button class="btn" data-mine>Take this ticket</button>' : ''}
          <button class="btn" data-status>Change status</button><button class="btn" data-prio>Change priority</button></div></section>` : ''}
        <section class="panel"><div class="panel-head"><h2>Their recent activity</h2></div>${d.activity.length ? `<ul class="timeline">${d.activity.map((e: any) => `<li>${esc(e.summary)} ${pill(e.status)}<div class="small muted">${when(e.at)}</div></li>`).join('')}</ul>` : '<div class="empty">None.</div>'}</section>
      </div></div>`;
    const p = (body: unknown) => post(`/tickets/${encodeURIComponent(t.id)}`, body);
    $('#rep', el)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = $<HTMLTextAreaElement>('#rb', el).value.trim();
      if (!text) return toast('Write the reply first.', true);
      try { const r = await p({ action: 'reply', body: text }); toast(r.message); await render(); } catch (x) { toast(x instanceof ApiError ? x.message : 'Something went wrong.', true); }
    });
    $('[data-mine]', el)?.addEventListener('click', async () => { try { const r = await p({ action: 'assign_me' }); toast(r.message); await render(); } catch (x) { toast(x instanceof ApiError ? x.message : 'Something went wrong.', true); } });
    $('[data-status]', el)?.addEventListener('click', () => ask({ title: 'Change status', confirm: 'Save', fields: [{ name: 'status', label: 'Status', type: 'select', value: t.status, options: [['open', 'Open: we owe them a reply'], ['waiting', 'Waiting: on the user'], ['closed', 'Closed']] }],
      run: (v) => p({ action: 'status', status: v.status, reason: v.reason }) }));
    $('[data-prio]', el)?.addEventListener('click', () => ask({ title: 'Change priority', confirm: 'Save', fields: [{ name: 'priority', label: 'Priority', type: 'select', value: t.priority, options: [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']] }],
      run: (v) => p({ action: 'priority', priority: v.priority, reason: v.reason }) }));
  }

  function bindRows(el: HTMLElement) {
    $$('tr[data-go]', el).forEach((r) => { r.tabIndex = 0; r.onclick = () => { location.hash = r.dataset.go!; }; r.onkeydown = (e) => { if (e.key === 'Enter') location.hash = r.dataset.go!; }; });
  }
  function nameOfTarget(c: { actions: any[]; integrations: any[]; channels: any[] }, type: string, key: string) {
    const list = type === 'action' ? c.actions : type === 'integration' ? c.integrations : c.channels;
    return list.find((x) => x.key === key)?.name ?? key;
  }
  const dur = (a: string, b: string) => { const m = Math.round((Date.parse(b) - Date.parse(a)) / 60000); return m < 60 ? `${m} min` : m < 2880 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} days`; };
  const explain = (code: string) => ({ ACTION_DISABLED: 'paused or not switched on', TRUST_LEVEL: 'needs a higher trust level', ACCOUNT_SUSPENDED: 'account suspended', CONTACT_NOT_FOUND: 'contact not found' } as Record<string, string>)[code] ?? code.toLowerCase().replace(/_/g, ' ');

  boot();
}
