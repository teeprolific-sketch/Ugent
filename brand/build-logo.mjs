// Builds the Ugent logo from the Outfit typeface outlines and renders every app asset from it.
// Run from the repo root: node brand/build-logo.mjs
//
// Outputs
//   brand/ugent-wordmark.svg         sky letters + navy cursor bar (light backgrounds)
//   brand/ugent-wordmark-dark.svg    for dark backgrounds
//   brand/ugent-mark.svg             the "U" mark used for the app icon
//   apps/mobile/assets/*.png         iOS/Android icons, adaptive icon layers, splash, favicon
//   apps/mobile/src/brand/paths.ts   path data for the in-app <Wordmark /> and <Mark /> components
import opentype from 'opentype.js';
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKY = '#0EA5E9';
const SKY_ON_DARK = '#38BDF8';
const NAVY = '#0B3D91';
const WHITE = '#FFFFFF';

const ttf = readFileSync(join(root, 'node_modules/@expo-google-fonts/outfit/400Regular/Outfit_400Regular.ttf'));
const font = opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));
// The icon mark uses a heavier cut so the "U" holds up at home-screen size.
const ttfBold = readFileSync(join(root, 'node_modules/@expo-google-fonts/outfit/600SemiBold/Outfit_600SemiBold.ttf'));
const fontBold = opentype.parse(ttfBold.buffer.slice(ttfBold.byteOffset, ttfBold.byteOffset + ttfBold.byteLength));

const SIZE = 200; // font units -> px at this size
const BASE = 200; // baseline y
const fix = (n) => Math.round(n * 100) / 100;

// Wordmark letters. Laid out glyph by glyph (advance + kerning pairs) because opentype.js
// cannot run every shaping table in Outfit; plain Latin letters need none of them.
const scale = SIZE / font.unitsPerEm;
const glyphs = [...'Ugent'].map((c) => font.charToGlyph(c));
let x = 0;
const glyphPaths = glyphs.map((g, i) => {
  const p = g.getPath(x, BASE, SIZE);
  x += g.advanceWidth * scale + (glyphs[i + 1] ? font.getKerningValue(g, glyphs[i + 1]) * scale : 0);
  return p;
});
const letters = glyphPaths.map((p) => ({ d: p.toPathData(2), box: p.getBoundingBox() }));
const box = letters.reduce((b, l) => ({ x1: Math.min(b.x1, l.box.x1), y1: Math.min(b.y1, l.box.y1), x2: Math.max(b.x2, l.box.x2), y2: Math.max(b.y2, l.box.y2) }), { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity });
const t = letters[letters.length - 1].box;

// Cursor bar under the "t": same weight as the letter stroke, rounded ends, sitting at descender depth.
const stroke = SIZE * 0.072;
const bar = { x: t.x1 - SIZE * 0.01, w: t.x2 - t.x1 + SIZE * 0.02, y: BASE + SIZE * 0.2, h: stroke };

const pad = SIZE * 0.08;
const vb = { x: box.x1 - pad, y: box.y1 - pad, w: box.x2 - box.x1 + pad * 2, h: bar.y + bar.h - box.y1 + pad * 2 };
const vbStr = `${fix(vb.x)} ${fix(vb.y)} ${fix(vb.w)} ${fix(vb.h)}`;
const lettersD = letters.map((l) => l.d).join(' ');
const barRect = (fill) => `<rect x="${fix(bar.x)}" y="${fix(bar.y)}" width="${fix(bar.w)}" height="${fix(bar.h)}" rx="${fix(bar.h / 2)}" fill="${fill}"/>`;

const wordmark = (letterFill, barFill) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbStr}" role="img" aria-label="Ugent"><path d="${lettersD}" fill="${letterFill}"/>${barRect(barFill)}</svg>\n`;

// The "U" mark with the cursor bar under it, for the app icon.
const uPath = fontBold.charToGlyph('U').getPath(0, BASE, SIZE);
const ub = uPath.getBoundingBox();
const uW = ub.x2 - ub.x1;
const markBar = { x: ub.x1 + uW * 0.16, w: uW * 0.68, y: BASE + SIZE * 0.14, h: SIZE * 0.1 };
const markBox = { x1: ub.x1, y1: ub.y1, x2: ub.x2, y2: markBar.y + markBar.h };
const markSvg = (size, bg, letterFill, barFill, scale) => {
  // Fit the mark into `scale` of the canvas, centred.
  const mw = markBox.x2 - markBox.x1;
  const mh = markBox.y2 - markBox.y1;
  const k = (size * scale) / Math.max(mw, mh);
  const tx = (size - mw * k) / 2 - markBox.x1 * k;
  const ty = (size - mh * k) / 2 - markBox.y1 * k;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}<g transform="translate(${fix(tx)} ${fix(ty)}) scale(${fix(k * 1000) / 1000})"><path d="${uPath.toPathData(2)}" fill="${letterFill}"/><rect x="${fix(markBar.x)}" y="${fix(markBar.y)}" width="${fix(markBar.w)}" height="${fix(markBar.h)}" rx="${fix(markBar.h / 2)}" fill="${barFill}"/></g></svg>`;
};

// Splash: full wordmark centred on a transparent square (expo-splash-screen paints the background).
const splashSvg = (size, letterFill, barFill) => {
  const k = (size * 0.8) / vb.w;
  const tx = (size - vb.w * k) / 2 - vb.x * k;
  const ty = (size - vb.h * k) / 2 - vb.y * k;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g transform="translate(${fix(tx)} ${fix(ty)}) scale(${fix(k * 1000) / 1000})"><path d="${lettersD}" fill="${letterFill}"/>${barRect(barFill)}</g></svg>`;
};

const out = (p, s) => { mkdirSync(dirname(join(root, p)), { recursive: true }); writeFileSync(join(root, p), s); };
const png = async (p, svg) => { mkdirSync(dirname(join(root, p)), { recursive: true }); await sharp(Buffer.from(svg)).png().toFile(join(root, p)); };

out('brand/ugent-wordmark.svg', wordmark(SKY, NAVY));
out('brand/ugent-wordmark-dark.svg', wordmark(SKY_ON_DARK, WHITE));
out('brand/ugent-mark.svg', markSvg(1024, WHITE, SKY, NAVY, 0.56));

const A = 'apps/mobile/assets/';
await png(A + 'icon.png', markSvg(1024, WHITE, SKY, NAVY, 0.56)); // iOS + store icon, no transparency
await png(A + 'android-icon-foreground.png', markSvg(1024, null, SKY, NAVY, 0.42)); // inside the 66% safe zone
await png(A + 'android-icon-background.png', `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${WHITE}"/></svg>`);
await png(A + 'android-icon-monochrome.png', markSvg(1024, null, '#000000', '#000000', 0.42));
await png(A + 'splash-icon.png', splashSvg(1024, SKY, NAVY));
await png(A + 'splash-icon-dark.png', splashSvg(1024, SKY_ON_DARK, WHITE));
await png(A + 'notification-icon.png', markSvg(96, null, WHITE, WHITE, 0.8));
await png(A + 'favicon.png', markSvg(64, WHITE, SKY, NAVY, 0.7));
await png('brand/ugent-wordmark.png', wordmark(SKY, NAVY).replace('<svg ', `<svg width="${Math.round(vb.w * 4)}" height="${Math.round(vb.h * 4)}" `));

out('apps/mobile/src/brand/paths.ts', `// Generated by brand/build-logo.mjs from the Outfit typeface. Do not edit by hand.
export const WORDMARK = {
  viewBox: '${vbStr}',
  width: ${fix(vb.w)},
  height: ${fix(vb.h)},
  letters: '${lettersD}',
  bar: { x: ${fix(bar.x)}, y: ${fix(bar.y)}, width: ${fix(bar.w)}, height: ${fix(bar.h)} },
} as const;

export const MARK = {
  viewBox: '${fix(markBox.x1 - 4)} ${fix(markBox.y1 - 4)} ${fix(markBox.x2 - markBox.x1 + 8)} ${fix(markBox.y2 - markBox.y1 + 8)}',
  width: ${fix(markBox.x2 - markBox.x1 + 8)},
  height: ${fix(markBox.y2 - markBox.y1 + 8)},
  letter: '${uPath.toPathData(2)}',
  bar: { x: ${fix(markBar.x)}, y: ${fix(markBar.y)}, width: ${fix(markBar.w)}, height: ${fix(markBar.h)} },
} as const;
`);
console.log('Logo built:', vbStr);
