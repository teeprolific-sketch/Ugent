// Bundles the app into one self-contained HTML file (dist/ugent-preview.html) for sharing as a web preview.
// Usage: node scripts/build-preview.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const html = read('index.html');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace(/<script src="([^"]+)"><\/script>/g, (_, src) => `<script>\n${read(src).replace(/<\/script/gi, '<\\/script')}\n</script>`);

const out = `<title>Ugent</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Ugent by Me AI: a personal AI agent that plans around real African life.">
<style>
${read('css/app.css')}
</style>
${body.trim()}
`;
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/ugent-preview.html'), out);
console.log('Wrote dist/ugent-preview.html (' + Math.round(out.length / 1024) + ' KB)');
