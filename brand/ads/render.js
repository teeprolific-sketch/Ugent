// Renders the ad to PNG: node brand/ads/render.js [scale]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const scale = Number(process.argv[2] || 2);
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: scale })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('requestfailed', (r) => errs.push('failed: ' + r.url()));
  await p.goto('file://' + path.join(__dirname, 'ugent-ad.html'));
  await p.evaluate(() => window.ready);
  const out = path.join(__dirname, `ugent-ad-${1080 * scale}x${1350 * scale}.png`);
  await p.locator('#ad').screenshot({ path: out });
  console.log(errs.length ? errs.join('\n') : 'ok', out);
  await b.close();
})();
