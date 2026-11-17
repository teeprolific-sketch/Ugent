// Captures real Ugent screens for the brand video: Free, Pro and Team.
const { chromium } = require('playwright');
const OUT = process.argv[2];
const API = 'http://localhost:3000';
const HOOK = process.env.REVENUECAT_WEBHOOK_AUTH;
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'Africa/Lagos', permissions: ['microphone'] });
  await ctx.addInitScript(() => {
    const T = new Date(); T.setHours(9, 10, 0, 0); const Real = Date; const off = T - Real.now();
    globalThis.Date = class extends Real { constructor(...a) { super(...(a.length ? a : [Real.now() + off])); } static now() { return Real.now() + off; } };
    // A pretend microphone that hears "What's my day today" and keeps listening, so Live can be filmed.
    class FakeRecognition extends EventTarget {
      constructor() { super(); this.lang = 'en-US'; this.interimResults = true; this.continuous = false; }
      fire(type, extra = {}) { const e = new Event(type); Object.assign(e, extra); this.dispatchEvent(e); if (typeof this['on' + type] === 'function') this['on' + type](e); }
      start() {
        setTimeout(() => { this.fire('start'); this.fire('audiostart'); this.fire('speechstart'); }, 100);
        const words = "What's my day looking like".split(' ');
        words.forEach((_, i) => setTimeout(() => {
          const text = words.slice(0, i + 1).join(' ');
          const alt = { transcript: text, confidence: 0.9 };
          const res = Object.assign([alt], { isFinal: false, length: 1, item: () => alt });
          const results = Object.assign([res], { length: 1, item: () => res });
          this.fire('result', { resultIndex: 0, results });
        }, 500 + i * 350));
      }
      stop() {} abort() {}
    }
    window.SpeechRecognition = FakeRecognition; window.webkitSpeechRecognition = FakeRecognition;
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const shot = async (name) => { await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/${name}.png` }); console.log('  shot', name); };
  const tap = (t) => p.getByText(t, { exact: true }).locator('visible=true').first().click({ timeout: 8000 });
  const label = (l) => p.getByLabel(l, { exact: true }).locator('visible=true').first();
  const step = async (name, fn) => { try { await fn(); } catch (e) { console.log('  SKIPPED', name, '-', e.message.split('\n')[0]); } };
  const home = async () => { await p.goto('http://localhost:8090/'); await p.waitForTimeout(2200); };
  const chat = async (text) => { const box = p.getByPlaceholder('Message Ugent').locator('visible=true').first(); await box.fill(text); await p.keyboard.press('Enter'); await p.waitForTimeout(900); };
  const setTheme = async (name) => { await tap('More'); await tap('Settings'); await tap('Appearance'); await p.waitForTimeout(400); await tap(name); await p.waitForTimeout(400); };

  // ---------- FREE ----------
  await p.goto('http://localhost:8090/'); await p.waitForTimeout(2200);
  await shot('f01-welcome');
  await tap('Get started');
  await step('lang', async () => { await p.getByPlaceholder('Search languages, e.g. Pidgin').fill('yo'); await shot('f02-languages'); await p.getByPlaceholder('Search languages, e.g. Pidgin').fill(''); });
  await tap('Continue');
  await p.getByPlaceholder('e.g. Tobi').fill('Ada'); await tap('Continue');
  await tap('Business owner or trader'); await tap('Continue'); await tap('Continue');
  await tap('Start using Ugent'); await p.waitForTimeout(2500);
  await shot('f03-home');
  await step('chat', async () => {
    await tap('Chat'); await p.waitForTimeout(600);
    await chat("What's my day?");
    await chat('Remind me to pay the NEPA bill tomorrow');
    await shot('f04-chat');
  });
  await step('capture', async () => {
    await tap('Home'); await p.waitForTimeout(500);
    await label('Quick capture: add a task, plan or note').click(); await p.waitForTimeout(500);
    await label('What do you want to capture?').fill('Meet Chidi at the shop at 4pm');
    await shot('f05-capture');
    await tap('Save'); await p.waitForTimeout(500);
  });
  await step('plan', async () => { await tap('Plan'); await p.waitForTimeout(700); await shot('f06-plan'); await tap('Week'); await shot('f06b-week'); await tap('Day'); });
  await step('tasks', async () => { await tap('Tasks'); await p.waitForTimeout(600); await shot('f07-tasks'); });
  await step('search', async () => { await tap('Home'); await p.waitForTimeout(400); await label('Search').click(); await p.waitForTimeout(500); await label('Search').fill('invoice'); await shot('f08-search'); await tap('Back'); });
  await step('memory', async () => {
    await tap('More'); await tap('Memory and preferences'); await p.waitForTimeout(400);
    await tap('Remember something'); await p.waitForTimeout(300);
    await label('What should Ugent remember?').fill('My shop opens at 8am on weekdays'); await tap('Save'); await p.waitForTimeout(1600);
    await shot('f09-memory'); await tap('Back');
  });
  await step('offline', async () => { await tap('Settings'); await tap('Offline and data'); await p.waitForTimeout(500); await shot('f10-offline'); await tap('Back'); await tap('Back'); });
  await step('pricing', async () => { await tap('Plans and pricing'); await p.waitForTimeout(600); await shot('f11-pricing'); await tap('Back'); });
  await step('appearance', async () => { await tap('Settings'); await tap('Appearance'); await p.waitForTimeout(500); await shot('f12-appearance'); await tap('Black'); await p.waitForTimeout(400); await tap('Back'); await tap('Back'); await tap('Home'); await p.waitForTimeout(800); await shot('f13-home-black'); });
  await step('back to white', async () => { await setTheme('White'); await home(); });
  await step('offline strip', async () => { await tap('Tasks'); await p.waitForTimeout(600); await ctx.setOffline(true); await p.waitForTimeout(400);
    const box = p.getByPlaceholder('Add a task').locator('visible=true').first(); await box.fill('Buy diesel for the generator'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
    await shot('f14-offline-tasks'); await ctx.setOffline(false); await p.waitForTimeout(1500); });
  await step('focus', async () => { await tap('Chat'); await p.waitForTimeout(500); await chat('Focus for 25 minutes'); await p.getByText('Yes, do it', { exact: true }).locator('visible=true').last().click(); await p.waitForTimeout(3500); await shot('f15-focus'); await p.getByText(/End focus|End now/).locator('visible=true').first().click(); await p.waitForTimeout(1000); await tap('Done'); });

  // ---------- PRO ----------
  const token = await p.evaluate(() => localStorage.getItem('ugent.token'));
  const me = await (await fetch(`${API}/api/sync`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ since: 0, tasks: [], events: [] }) })).json();
  const upgrade = (ent) => fetch(`${API}/api/webhooks/revenuecat`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: HOOK }, body: JSON.stringify({ event: { type: 'INITIAL_PURCHASE', app_user_id: me.me.id, entitlement_ids: [ent], expiration_at_ms: Date.now() + 30 * 86400000 } }) });
  console.log('pro upgrade', (await upgrade('pro')).status);
  await home(); await p.waitForTimeout(1500);
  await step('pro themes', async () => {
    await tap('More'); await tap('Settings'); await tap('Appearance'); await p.waitForTimeout(600);
    await tap('Ugent Blue'); await p.waitForTimeout(500); await shot('p01-appearance');
    await tap('Back'); await tap('Back'); await tap('Home'); await p.waitForTimeout(800); await shot('p02-home-blue');
    await setTheme('Midnight'); await tap('Back'); await tap('Back'); await tap('Home'); await p.waitForTimeout(800); await shot('p03-home-midnight');
    await setTheme('White'); await home();
  });
  await step('insights', async () => { await tap('More'); await tap('Your week'); await p.waitForTimeout(800); await shot('p04-insights'); await tap('Back'); });
  await step('connections', async () => { await tap('Connected apps'); await p.waitForTimeout(800); await shot('p05-connections'); await tap('WhatsApp Business'); await p.waitForTimeout(800); await shot('p06-whatsapp'); await tap('Back'); await tap('Back'); });
  await step('reschedule', async () => { await tap('Chat'); await p.waitForTimeout(500); await chat("I'm stuck in traffic"); await shot('p07-reschedule'); });
  await step('ecosystem', async () => {
    await chat('Find me a plumber tomorrow at 10am'); await p.getByText('Yes, do it', { exact: true }).locator('visible=true').last().click(); await p.waitForTimeout(800);
    await shot('p08-sleek-chat');
    await tap('More'); await tap('Me AI ecosystem'); await p.waitForTimeout(700); await shot('p09-ecosystem'); await tap('Back');
  });
  await step('live', async () => { await tap('Chat'); await p.waitForTimeout(500); await tap('Live'); await p.waitForTimeout(3200); await shot('p10-live'); await tap('End').catch(() => p.keyboard.press('Escape')); await p.waitForTimeout(800); });

  // ---------- TEAM ----------
  console.log('team upgrade', (await upgrade('team')).status);
  await home(); await p.waitForTimeout(1500);
  await p.goto('http://localhost:8090/team-admin'); await p.waitForTimeout(2200);
  await step('create team', async () => { await p.getByPlaceholder('e.g. Adeyemi Foods').locator('visible=true').first().fill('Ada Foods'); await tap('Create team'); await p.waitForTimeout(2000); });
  const team = await (await fetch(`${API}/api/team`, { headers: { authorization: `Bearer ${token}` } })).json();
  const d0 = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date());
  const members = [['Bayo', [['Count rice bags', 'doing'], ['Restock palm oil', 'todo']], [['Delivery to Ikeja shop', '15:00', 'errand']]],
    ['Chioma', [['Send supplier invoices', 'todo'], ['Update price list', 'done']], [['Supplier call: Kano beans', '11:00', 'meeting']]],
    ['Musa', [['Fix the shop generator', 'doing']], [['Market run: Mile 12', '13:00', 'errand']]]];
  for (const [name, tasks, events] of members) {
    const m = await (await fetch(`${API}/api/auth/device`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceId: `${name}-${Date.now()}-device`, platform: 'android', name }) })).json();
    const h = { 'content-type': 'application/json', authorization: `Bearer ${m.token}` };
    await fetch(`${API}/api/team/join`, { method: 'POST', headers: h, body: JSON.stringify({ code: team.team.code }) });
    const now = Date.now();
    await fetch(`${API}/api/sync`, { method: 'POST', headers: h, body: JSON.stringify({ since: 0,
      tasks: tasks.map(([title, status], i) => ({ id: `${name}-t${i}-${now}`, title, important: false, done: status === 'done', doneAt: status === 'done' ? now : null, date: d0, createdAt: now, updatedAt: now, teamId: team.team.id, assigneeId: m.me.id, status })),
      events: events.map(([title, start, kind], i) => ({ id: `${name}-e${i}-${now}`, title, date: d0, start, dur: 60, kind, fixed: true, needsPower: false, updatedAt: now, teamId: team.team.id })) }) });
  }
  await home(); await p.waitForTimeout(2500);
  await step('team home', async () => { await tap('Team'); await p.waitForTimeout(2200); await shot('t01-team-home'); });
  await step('team calendar', async () => { await tap('Plan'); await p.waitForTimeout(900); await shot('t02-team-calendar'); });
  await step('team board', async () => { await tap('Tasks'); await p.waitForTimeout(700); await tap('Doing 2').catch(() => {}); await shot('t03-team-board'); });
  await step('team dashboard', async () => { await tap('More'); await tap('Team dashboard'); await p.waitForTimeout(1600); await shot('t04-team-dashboard'); await tap('Back'); });
  await step('team admin', async () => { await tap('Members and roles'); await p.waitForTimeout(900); await shot('t05-team-admin'); await tap('Back'); });
  await step('team analytics', async () => { await tap('Your week'); await p.waitForTimeout(600); await tap('Team').catch(() => {}); await p.waitForTimeout(1200); await shot('t06-team-analytics'); });
  console.log(errs.length ? 'page errors:\n' + [...new Set(errs)].join('\n') : 'no page errors');
  await b.close();
})().catch((e) => { console.error('FAILED', e.message.split('\n').slice(0, 3).join('\n')); process.exit(1); });
