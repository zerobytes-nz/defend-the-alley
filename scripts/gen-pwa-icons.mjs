#!/usr/bin/env node
// Draws the PWA / home-screen icons from the game's own art: the Bazooka Tabby holding the barricade while
// zombies and a boss come down the alley.
//   npm run pwa:icons             → public/icons/ from committable art only (cc0/, then placeholder/), safe to commit
//   npm run pwa:icons:licensed    → public/assets/licensed/pwa-icons/ from the kit art (gitignored). `vite build`
//                                   ships these in place of public/icons/ when they exist; deploy runs this first.
// Also writes store-icon-1024.png next to the licensed icons (for TheoSwap and stores).
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { ROOT, loadManifest, isCc0 } from './lib/assets.mjs';

const LICENSED = process.argv.includes('--licensed');
const m = loadManifest();
const A = Object.fromEntries(m.assets.map((a) => [a.key, a]));
const OUT = path.join(ROOT, 'public', LICENSED ? `${m.roots.licensed}/pwa-icons` : 'icons');

async function art(key) {
  const a = A[key];
  if (!a) throw new Error(`No manifest asset ${key}`);
  const roots = LICENSED ? [m.roots.licensed, m.roots.cc0, m.roots.placeholder]
    : isCc0(m, a) ? [m.roots.cc0, m.roots.placeholder] : [m.roots.placeholder];
  for (const root of roots) {
    const f = path.join(ROOT, 'public', root, a.path);
    if (fs.existsSync(f)) return { img: await loadImage(fs.readFileSync(f)), a, licensed: root === m.roots.licensed };
  }
  throw new Error(`No usable file for ${key}`);
}

if (LICENSED && !(await art('cat.c1.shoot')).licensed) {
  console.error('✘ The kit art is not imported (see README → Art). Nothing written.');
  process.exit(1);
}

/** Frame `n` of a sheet, trimmed to its visible pixels: `h` px tall, bottom-centre at (x,y). */
async function draw(c, key, n, x, y, h, { flip = false } = {}) {
  const { img, a } = await art(key);
  const fw = a.frameWidth ?? a.width, fh = a.frameHeight ?? a.height;
  const cols = a.columns ?? a.frameCount ?? 1;
  const sx = (n % cols) * fw, sy = Math.floor(n / cols) * fh;
  const t = createCanvas(fw, fh), tc = t.getContext('2d');
  tc.drawImage(img, sx, sy, fw, fh, 0, 0, fw, fh);
  const d = tc.getImageData(0, 0, fw, fh).data;
  let x0 = fw, y0 = fh, x1 = -1, y1 = -1;
  for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) if (d[(j * fw + i) * 4 + 3] > 24) {
    if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j;
  }
  const w = x1 - x0 + 1, hh = y1 - y0 + 1, s = h / hh, dw = w * s;
  c.save();
  c.translate(x, y);
  if (flip) c.scale(-1, 1);
  c.drawImage(t, x0, y0, w, hh, -dw / 2, -h, dw, h);
  c.restore();
}

/** The scene on a 1024 canvas. `k` < 1 shrinks it into the centre (maskable safe zone), with the road behind. */
async function scene(k = 1) {
  const S = 1024, cv = createCanvas(S, S), c = cv.getContext('2d');
  const { img: bg } = await art('bg.area1');
  // A close-up of the road past the barricade: crossing stripes and the yellow line running to the right.
  c.drawImage(bg, 470, 150, 420, 420, 0, 0, S, S);
  c.fillStyle = 'rgba(24,20,36,0.28)'; c.fillRect(0, 0, S, S);
  c.save();
  c.translate(512 * (1 - k), 512 * (1 - k)); c.scale(k, k);

  // The boss looms at the back, a zombie charges in front, all walking toward the wall on the left.
  await draw(c, 'enemy.boss1.walk', 3, 850, 590, 470);
  await draw(c, 'enemy.reg2.walk', 2, 800, 960, 400);
  await draw(c, 'fx.explosion', 1, 650, 810, 150);

  // Warm light from the shot, then the hero in front.
  const glow = c.createRadialGradient(400, 720, 0, 400, 720, 460);
  glow.addColorStop(0, 'rgba(255,190,80,0.45)'); glow.addColorStop(1, 'rgba(255,190,80,0)');
  c.fillStyle = glow; c.fillRect(0, 0, S, S);
  await draw(c, 'cat.c1.shoot', 4, 330, 1000, 600);
  await draw(c, 'fx.muzzle', 3, 610, 760, 110);
  c.restore();

  // Vignette so the edges fall away and the cat pops.
  const v = c.createRadialGradient(470, 600, 300, 512, 560, 820);
  v.addColorStop(0, 'rgba(18,14,28,0)'); v.addColorStop(1, 'rgba(18,14,28,0.7)');
  c.fillStyle = v; c.fillRect(0, 0, S, S);
  return cv;
}

function save(src, size, name) {
  const cv = createCanvas(size, size), c = cv.getContext('2d');
  c.imageSmoothingQuality = 'high';
  c.drawImage(src, 0, 0, size, size);
  fs.writeFileSync(path.join(OUT, name), cv.toBuffer('image/png'));
}

fs.mkdirSync(OUT, { recursive: true });
const full = await scene(1);
const safe = await scene(0.78); // maskable: keep the cat inside the centre 80%
save(full, 512, 'icon-512.png');
save(full, 192, 'icon-192.png');
save(safe, 512, 'maskable-512.png');
save(safe, 180, 'apple-touch-icon.png');
save(full, 64, 'favicon-64.png');
if (LICENSED) save(full, 1024, 'store-icon-1024.png');
console.log(`✔ PWA icons → ${path.relative(ROOT, OUT)}/: ${fs.readdirSync(OUT).join(', ')}`);
