#!/usr/bin/env node
// Builds a sharp, large picture of the hoodie tabby (cat 5) for the app icons, from the kit's vector parts:
// renders Eps/Cats/Char5 Parts.eps with Ghostscript, cuts out each loose part (head, tail, body, gun, shadow)
// and puts them together in the Spine setup pose from Json Atlas/Cat Characters/Cat5.
// The kit folder is only read. Output (gitignored, licensed): public/assets/licensed/pwa-icons/hero.png, 2048².
//   npm run pwa:hero -- "<kit folder that contains Png/>"   (needs `gs`), then npm run pwa:icons:licensed
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { ROOT, loadManifest } from './lib/assets.mjs';

const kit = process.argv[2];
const eps = kit && path.join(kit, 'Eps/Cats/Char5 Parts.eps');
const rig = kit && path.join(kit, 'Json Atlas/Cat Characters/Cat5');
if (!eps || !fs.existsSync(eps) || !fs.existsSync(path.join(rig, 'Character5.json'))) {
  console.error('Usage: npm run pwa:hero -- "<kit folder that contains Png/, Eps/ and Json Atlas/>"');
  process.exit(1);
}

// 1. The EPS at 1200 dpi (about 5300×3900): the loose parts sit to the right of an assembled preview.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alley-hero-'));
const png = path.join(tmp, 'parts.png');
const gs = spawnSync('gs', ['-q', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dEPSCrop', '-sDEVICE=pngalpha',
  '-dTextAlphaBits=4', '-dGraphicsAlphaBits=4', '-r1200', `-sOutputFile=${png}`, eps], { stdio: 'inherit' });
if (gs.status !== 0) { console.error('✘ Ghostscript (gs) failed or is not installed.'); process.exit(1); }
const img = await loadImage(fs.readFileSync(png));
fs.rmSync(tmp, { recursive: true, force: true });
const W = img.width, H = img.height, f = W / 900;
const src = createCanvas(W, H), sc = src.getContext('2d');
sc.drawImage(img, 0, 0);
const px = sc.getImageData(0, 0, W, H).data;

// 2. Each loose part: a rough box (in 900-px-wide layout units, clear of the preview's level badge),
//    trimmed to its visible pixels.
const BOX = { Head: [465, 0, 775, 262], Tails: [400, 355, 515, 450], Body: [560, 340, 685, 475], Gun: [530, 555, 695, 665], Shade: [745, 385, 900, 448] };
const parts = {};
for (const [name, b] of Object.entries(BOX)) {
  const [bx0, by0, bx1, by1] = b.map((v) => Math.round(v * f));
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = by0; y < Math.min(by1, H); y++) for (let x = bx0; x < Math.min(bx1, W); x++) {
    if (px[(y * W + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  if (x1 < 0) { console.error(`✘ ${name} not found in the EPS: the kit layout differs from the one this script expects.`); process.exit(1); }
  parts[name] = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// 3. The rig: bones (Spine, y up), attachments, and the atlas trim of each region.
const d = JSON.parse(fs.readFileSync(path.join(rig, 'Character5.json'), 'utf8'));
const atlas = {};
let cur = null;
for (const line of fs.readFileSync(path.join(rig, 'Character5.atlas'), 'utf8').split('\n')) {
  const t = line.trim();
  if (t && !t.includes(':') && !t.endsWith('.png')) { cur = atlas[t] = {}; continue; }
  if (!cur) continue;
  const [key, v] = t.split(':');
  if (key === 'bounds') { const n = v.split(',').map(Number); cur.w = n[2]; cur.h = n[3]; }
  if (key === 'offsets') { const n = v.split(',').map(Number); cur.l = n[0]; cur.b = n[1]; }
}
const bones = {};
for (const b of d.bones) {
  const p = b.parent ? bones[b.parent] : { a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 };
  const r = ((b.rotation ?? 0) * Math.PI) / 180, sx = b.scaleX ?? 1, sy = b.scaleY ?? 1;
  const la = Math.cos(r) * sx, lb = -Math.sin(r) * sy, lc = Math.sin(r) * sx, ld = Math.cos(r) * sy;
  const x = b.x ?? 0, y = b.y ?? 0;
  bones[b.name] = { a: p.a * la + p.b * lc, b: p.a * lb + p.b * ld, c: p.c * la + p.d * lc, d: p.c * lb + p.d * ld, x: p.a * x + p.b * y + p.x, y: p.c * x + p.d * y + p.y };
}

// 4. Draw every slot in order, each EPS part fitted to its trimmed region.
const S = 2048, out = createCanvas(S, S), c = out.getContext('2d');
const sk = d.skeleton, unit = (S * 0.94) / Math.max(sk.width, sk.height);
const ox = S / 2 - (sk.x + sk.width / 2) * unit, oy = S / 2 + (sk.y + sk.height / 2) * unit;
const att = d.skins[0].attachments;
for (const slot of d.slots) {
  const a = att[slot.attachment][slot.attachment], bn = bones[slot.bone], p = parts[slot.attachment], t = atlas[slot.attachment];
  const r = ((a.rotation ?? 0) * Math.PI) / 180;
  const ax = bn.a * a.x + bn.b * a.y + bn.x, ay = bn.c * a.x + bn.d * a.y + bn.y;
  const ang = Math.atan2(bn.c * Math.cos(r) + bn.d * Math.sin(r), bn.a * Math.cos(r) + bn.b * Math.sin(r));
  c.save();
  c.translate(ox + ax * unit, oy - ay * unit);
  c.rotate(-ang);
  c.drawImage(src, p.x, p.y, p.w, p.h, (-a.width / 2 + t.l) * unit, -(-a.height / 2 + t.b + t.h) * unit, t.w * unit, t.h * unit);
  c.restore();
}
const dir = path.join(ROOT, 'public', loadManifest().roots.licensed, 'pwa-icons');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'hero.png'), out.toBuffer('image/png'));
console.log(`✔ ${path.relative(ROOT, path.join(dir, 'hero.png'))} (${S}×${S}). Now run: npm run pwa:icons:licensed`);
