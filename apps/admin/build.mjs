// Builds the admin console into dist/ (a static site: index.html, app.js, styles.css).
//   node build.mjs           → the real console. Set ADMIN_API_URL to the admin API's address.
//   node build.mjs --demo    → dist-demo/ugent-admin-demo.html: one self-contained file with a pretend server
//                              and demo access keys, for showing the console without real data.
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const demo = process.argv.includes('--demo');
const result = await build({
  entryPoints: ['src/main.ts'],
  bundle: true, minify: true, format: 'iife', target: 'es2020', write: false,
  define: { __DEMO__: String(demo), __API_URL__: JSON.stringify(process.env.ADMIN_API_URL ?? '') },
});
const js = result.outputFiles[0].text;
const css = readFileSync('src/styles.css', 'utf8');
const html = readFileSync('src/index.html', 'utf8');
if (demo) {
  // Two files: index.html is a normal page (for any static host); ugent-admin-demo.html is the same page
  // without the document wrapper, for hosts that add their own (like a shared preview).
  mkdirSync('dist-demo', { recursive: true });
  const page = html
    .replace('<link rel="stylesheet" href="styles.css">', () => `<style>${css}</style>`)
    .replace('<script src="app.js" defer></script>', '')
    .replace('</body>', () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>\n</body>`);
  writeFileSync('dist-demo/index.html', page);
  const inner = (tag) => page.slice(page.indexOf('>', page.indexOf(`<${tag}`)) + 1, page.indexOf(`</${tag}>`));
  const headInner = inner('head').replace(/<meta charset[^>]*>\s*/, '').replace(/<meta name="viewport"[^>]*>\s*/, '');
  const title = headInner.match(/<title>.*?<\/title>/)[0];
  writeFileSync('dist-demo/ugent-admin-demo.html', `${title}\n${headInner.replace(title, '').trim()}\n${inner('body').trim()}\n`);
  console.log('Built dist-demo/index.html and dist-demo/ugent-admin-demo.html');
} else {
  mkdirSync('dist', { recursive: true });
  writeFileSync('dist/app.js', js); writeFileSync('dist/styles.css', css); writeFileSync('dist/index.html', html);
  console.log('Built dist/ (set ADMIN_API_URL at build time to point at the admin API)');
}
