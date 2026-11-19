#!/usr/bin/env node
// Draws the PWA / home-screen icons from the game's own art: the hoodie tabby (cat 5), no background.
//   npm run pwa:icons             → public/icons/ from committable art only (cc0/, then placeholder/), safe to commit
//   npm run pwa:icons:licensed    → public/assets/licensed/pwa-icons/ from the kit art (gitignored). `vite build`
//                                   ships these in place of public/icons/ when they exist; deploy runs this first.
// Also writes store-icon-1024.png next to the licensed icons (for TheoSwap and stores). With --licensed the cat
// comes from pwa-icons/hero.png when `npm run pwa:hero` made it (sharp, from the kit's vector art).
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
async function draw(c, key, n, x, y, h, opts) {
  const { img, a } = await art(key);
  const fw = a.frameWidth ?? a.width, fh = a.frameHeight ?? a.height;
  const cols = a.columns ?? a.frameCount ?? 1;
  drawTrimmed(c, img, (n % cols) * fw, Math.floor(n / cols) * fh, fw, fh, x, y, h, opts);
}

/** The (sx,sy,fw,fh) part of `img`, trimmed to its visible pixels: `h` px tall, bottom-centre at (x,y). */
function drawTrimmed(c, img, sx, sy, fw, fh, x, y, h, { flip = false } = {}) {
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

/**
 * The hoodie tabby (cat 5) on its own, 1024 px. `bg` fills behind it (maskable / Apple icons can't be
 * transparent: the OS would show black); `k` < 1 shrinks it into the maskable safe zone.
 */
async function hero(k = 1, bg = null) {
  const S = 1024, cv = createCanvas(S, S), c = cv.getContext('2d');
  if (bg) { c.fillStyle = bg; c.fillRect(0, 0, S, S); }
  c.save();
  c.translate(512 * (1 - k), 512 * (1 - k)); c.scale(k, k);
  // The sharp version built from the kit's vector parts (npm run pwa:hero), else the game sprite.
  const big = path.join(OUT, 'hero.png');
  if (LICENSED && fs.existsSync(big)) {
    const img = await loadImage(fs.readFileSync(big));
    drawTrimmed(c, img, 0, 0, img.width, img.height, 512, 990, 960);
  } else await draw(c, 'cat.c5.idle', 0, 512, 990, 960);
  c.restore();
  return cv;
}

function save(src, size, name) {
  const cv = createCanvas(size, size), c = cv.getContext('2d');
  c.imageSmoothingQuality = 'high';
  c.drawImage(src, 0, 0, size, size);
  fs.writeFileSync(path.join(OUT, name), cv.toBuffer('image/png'));
}

fs.mkdirSync(OUT, { recursive: true });
const BG = '#f4b35a'; // warm orange from the hoodie, for the icons that must be opaque
const full = await hero(1);
const safe = await hero(0.74, BG); // maskable: keep the cat inside the centre 80%
save(full, 512, 'icon-512.png');
save(full, 192, 'icon-192.png');
save(safe, 512, 'maskable-512.png');
save(await hero(0.9, BG), 180, 'apple-touch-icon.png');
save(full, 64, 'favicon-64.png');
if (LICENSED) save(full, 1024, 'store-icon-1024.png');
console.log(`✔ PWA icons → ${path.relative(ROOT, OUT)}/: ${fs.readdirSync(OUT).join(', ')}`);
