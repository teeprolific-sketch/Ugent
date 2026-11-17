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

  const shotClean = async (name) => { await p.waitForTimeout(6500); await shot(name); };
  const go = async (path) => { await p.goto('http://localhost:8090' + path); await p.waitForTimeout(2200); };
  await p.goto('http://localhost:8090/'); await p.waitForTimeout(2200);
  await tap('Get started');
  await step('lang', async () => { await p.getByPlaceholder('Search for your language').fill('yo'); await p.waitForTimeout(400); await shot('f02-languages'); await p.getByPlaceholder('Search for your language').fill(''); await p.keyboard.press('Escape'); });
  await tap('Continue');
  await p.getByPlaceholder('e.g. Tobi').fill('Ada'); await tap('Continue');
  await tap('Business owner or trader'); await tap('Continue'); await tap('Continue');
  await tap('Start using Ugent'); await p.waitForTimeout(2500);
  await step('capture', async () => {
    await label('Quick capture: add a task, plan or note').click(); await p.waitForTimeout(500);
    await label('What do you want to capture?').fill('Meet Chidi at the shop at 4pm'); await tap('Save'); await p.waitForTimeout(500);
  });
  await step('plan', async () => { await tap('Plan'); await shotClean('f06-plan'); await tap('Week'); await shot('f06b-week'); await tap('Day'); });
  await step('tasks', async () => { await tap('Tasks'); await shot('f07-tasks'); });
  await step('memory', async () => {
    await go('/memory'); await tap('Remember something'); await p.waitForTimeout(300);
    await label('What should Ugent remember?').fill('My shop opens at 8am on weekdays'); await tap('Save'); await shotClean('f09-memory');
  });
  await step('offline strip', async () => { await go('/'); await tap('Tasks'); await p.waitForTimeout(800); await ctx.setOffline(true); await p.waitForTimeout(500);
    const box = p.getByPlaceholder('Add a task').locator('visible=true').first(); await box.fill('Buy diesel for the generator'); await p.keyboard.press('Enter'); await shotClean('f14-offline-tasks'); await ctx.setOffline(false); await p.waitForTimeout(1500); });
  await step('focus', async () => { await go('/'); await tap('Chat'); await p.waitForTimeout(500); await chat('Focus for 25 minutes'); await p.getByText('Yes, do it', { exact: true }).locator('visible=true').last().click(); await p.waitForTimeout(6500); await shot('f15-focus'); await p.getByText(/End focus|End now/).locator('visible=true').first().click(); await p.waitForTimeout(1500); await shot('f16-focus-summary'); await tap('Done'); });

  const token = await p.evaluate(() => localStorage.getItem('ugent.token'));
  const me = await (await fetch(`${API}/api/sync`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ since: 0, tasks: [], events: [] }) })).json();
  const upgrade = (ent) => fetch(`${API}/api/webhooks/revenuecat`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: HOOK }, body: JSON.stringify({ event: { type: 'INITIAL_PURCHASE', app_user_id: me.me.id, entitlement_ids: [ent], expiration_at_ms: Date.now() + 30 * 86400000 } }) });
  console.log('pro upgrade', (await upgrade('pro')).status);
  await go('/'); await p.waitForTimeout(1500);
  await step('midnight', async () => { await go('/appearance'); await tap('Midnight'); await p.waitForTimeout(400); await go('/'); await shot('p03-home-midnight'); await tap('Chat'); await p.waitForTimeout(600); await shot('p03b-chat-midnight'); await go('/appearance'); await tap('White'); });
  await step('insights', async () => { await go('/analytics'); await shot('p04-insights'); });
  await step('connections', async () => { await go('/connections'); await p.waitForTimeout(800); await shot('p05-connections'); });
  await step('whatsapp', async () => { await go('/connections/whatsapp'); await p.waitForTimeout(800); await shot('p06-whatsapp'); });
  await step('ecosystem', async () => {
    await go('/'); await tap('Chat'); await p.waitForTimeout(500);
    await chat('Find me a plumber tomorrow at 10am'); await p.getByText('Yes, do it', { exact: true }).locator('visible=true').last().click(); await p.waitForTimeout(800);
    await chat('Domestica, mop the kitchen'); await p.getByText('Yes, do it', { exact: true }).locator('visible=true').last().click();
    await shotClean('p08-sleek-chat');
    await go('/ecosystem'); await p.waitForTimeout(800); await shot('p09-ecosystem');
  });
  await step('pricing pro', async () => { await go('/pricing'); await p.mouse.wheel(0, 900); await p.waitForTimeout(600); await shot('p11-pricing-pro'); });
  console.log(errs.length ? 'page errors:\n' + [...new Set(errs)].join('\n') : 'no page errors');
  await b.close();
})().catch((e) => { console.error('FAILED', e.message.split('\n').slice(0, 3).join('\n')); process.exit(1); });
