// Renders the Ugent brand film frame by frame and encodes it with the music.
//   python3 music.py timeline.json music.wav   (timeline.json is written by this script with --timeline)
//   node render.js out.mp4 [fps]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const here = __dirname;
const root = path.resolve(here, '../..');
const scene = path.join(here, 'scene', 'index.html');
// The scene uses the app's fonts and the brand wordmark; copy them next to it.
fs.mkdirSync(path.join(here, 'scene', 'fonts'), { recursive: true });
for (const w of ['400Regular', '500Medium', '600SemiBold', '700Bold']) {
  fs.copyFileSync(path.join(root, 'node_modules/@expo-google-fonts/outfit', w, `Outfit_${w}.ttf`), path.join(here, 'scene', 'fonts', `Outfit_${w}.ttf`));
}
for (const f of ['ugent-wordmark.svg', 'ugent-wordmark-dark.svg']) fs.copyFileSync(path.join(root, 'brand', f), path.join(here, 'scene', f));

const args = process.argv.slice(2);
const timelineOnly = args.includes('--timeline');
const out = args.find((a) => a.endsWith('.mp4')) || path.join(here, 'ugent-brand-film.mp4');
const music = path.join(here, 'music.wav');
const FPS = Number(args.find((a) => /^\d+$/.test(a)) || 30);
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
  await p.goto('file://' + scene);
  const total = await p.evaluate(() => window.ready);
  if (timelineOnly) {
    fs.writeFileSync(path.join(here, 'timeline.json'), JSON.stringify(await p.evaluate(() => ({ total: window.TOTAL, segs: window.SEGMENTS }))));
    console.log('wrote timeline.json'); await b.close(); return;
  }
  const frames = Math.round(total * FPS);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', music,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const started = Date.now();
  for (let i = 0; i < frames; i++) {
    await p.evaluate((t) => window.setTime(t), i / FPS);
    const jpg = await p.screenshot({ type: 'jpeg', quality: 94 });
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 300 === 0) console.log(`frame ${i}/${frames}  ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await b.close();
  console.log('done', out, frames, 'frames in', ((Date.now() - started) / 1000).toFixed(0), 's');
})().catch((e) => { console.error(e); process.exit(1); });
