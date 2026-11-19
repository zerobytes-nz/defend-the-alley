// Original placeholder art (MIT), drawn from code so a fresh clone runs without the CraftPix kit.
// One drawer per manifest key: draw(ctx, w, h, frame, frames) in the frame's own coordinates.
// Same sizes, frame counts and anchor points (feet on the bottom edge) as the real art, so swapping is seamless.
// No text: fonts differ between machines, and CI checks that this output is byte-for-byte reproducible.

import { MAP_PATH } from '../src/game/levels.ts';

const TAU = Math.PI * 2;
const ell = (c, x, y, rx, ry, fill) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fillStyle = fill; c.fill(); };
const rr = (c, x, y, w, h, r, fill, stroke, lw = 3) => {
  c.beginPath(); c.roundRect(x, y, w, h, r);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
};
const OUT = '#2b1d14';

// ── Cats ────────────────────────────────────────────────────────────────────────────────────────────
// C1–5 orange tabbies with a bazooka, C6–10 grey cats with a blaster, C11–15 white cats with a rifle.
const FUR = ['#f4a95a', '#8f8f99', '#e9e6ef'];
const GUN = ['#3d7bd9', '#f06a2a', '#c98a3a'];
const HAT = ['#00000000', '#4a4a52', '#2bb3a0', '#e8559b', '#f07b22', '#00000000', '#9a5a2c', '#3a8de0', '#e0a020', '#d03a2a', '#00000000', '#8a3ab8', '#2a6fd8', '#e8b51c', '#b8282e'];

function cat(n, mode) {
  const fam = Math.floor((n - 1) / 5);
  return (c, w, h, i, frames) => {
    const t = i / frames;
    const bob = mode === 'idle' ? Math.sin(t * TAU) * 2 : 0;
    const kick = mode === 'shoot' ? Math.max(0, 1 - i / 4) * -6 : 0; // recoil
    const cx = w * 0.42 + kick, base = h - 10;
    ell(c, cx, base, w * 0.24, 7, 'rgba(0,0,0,0.3)');
    // tail
    c.lineCap = 'round'; c.lineWidth = 8; c.strokeStyle = OUT;
    c.beginPath(); c.moveTo(cx - 20, base - 22); c.quadraticCurveTo(cx - 42, base - 40 + bob, cx - 34, base - 58); c.stroke();
    c.lineWidth = 5; c.strokeStyle = FUR[fam]; c.stroke();
    // body + legs
    rr(c, cx - 22, base - 46 + bob, 44, 40, 16, FUR[fam], OUT);
    rr(c, cx - 18, base - 12, 12, 10, 5, FUR[fam], OUT, 2.5); rr(c, cx + 6, base - 12, 12, 10, 5, FUR[fam], OUT, 2.5);
    // head
    const hy = base - 70 + bob;
    for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(cx + s * 30, hy - 8); c.lineTo(cx + s * 26, hy - 36); c.lineTo(cx + s * 8, hy - 20); c.closePath();
      c.fillStyle = FUR[fam]; c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke();
    }
    ell(c, cx, hy, 32, 26, OUT); ell(c, cx, hy, 29, 23, FUR[fam]);
    if (HAT[n - 1] !== '#00000000') { c.beginPath(); c.ellipse(cx, hy - 12, 30, 14, 0, Math.PI, TAU); c.fillStyle = HAT[n - 1]; c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke(); }
    ell(c, cx - 11, hy + 2, 5, 6, OUT); ell(c, cx + 11, hy + 2, 5, 6, OUT);
    ell(c, cx - 10, hy, 1.8, 2, '#fff'); ell(c, cx + 12, hy, 1.8, 2, '#fff');
    ell(c, cx, hy + 10, 3, 2, '#e86a7a');
    // stripes for the tabbies
    if (fam === 0) { c.strokeStyle = '#c86f2a'; c.lineWidth = 3; for (const dx of [-8, 0, 8]) { c.beginPath(); c.moveTo(cx + dx, hy - 22); c.lineTo(cx + dx, hy - 14); c.stroke(); } }
    // gun, pointing right
    const gy = base - 34 + bob, gl = [46, 52, 60][fam], gh = [18, 14, 10][fam];
    rr(c, cx + 2, gy - gh / 2, gl, gh, gh / 2, GUN[fam], OUT);
    rr(c, cx + 2 + gl - 10, gy - gh / 2 - 3, 12, gh + 6, 4, '#3a3a44', OUT, 2);
    if (mode === 'shoot' && i < 3) ell(c, cx + gl + 18, gy, 12 - i * 3, 8 - i * 2, '#ffe36a');
  };
}

// ── Zombies ─────────────────────────────────────────────────────────────────────────────────────────
const ZHAT = ['#00000000', '#8a8f98', '#d8d8dd', '#c8282e', '#e04a3a', '#f08a1a', '#f07b22', '#e8e8f0'];
const BOSS = ['#7a5a8a', '#a8a8b0', '#3c6fb8', '#b06a2a', '#5a7a3a'];

function zombie(hat, mode, big = 1) {
  return (c, w, h, i, frames) => {
    const t = i / frames;
    const s = big;
    let cx = w * 0.5, base = h - 10, lean = 0, alpha = 1, step = 0;
    if (mode === 'walk') { step = Math.sin(t * TAU) * 5; }
    if (mode === 'attack') { const p = Math.sin(t * TAU); cx -= Math.max(0, p) * 12 * s; lean = -Math.max(0, p) * 0.25; }
    if (mode === 'dead') { lean = Math.min(1, t * 1.6) * 1.4; alpha = 1 - Math.max(0, (t - 0.6) / 0.4); }
    c.globalAlpha = Math.max(0, alpha);
    ell(c, cx, base, 38 * s, 8 * s, 'rgba(0,0,0,0.3)');
    c.save(); c.translate(cx, base); c.rotate(lean);
    const body = '#6fae8a', dark = '#3f6f55';
    // legs
    rr(c, -18 * s, -18 * s + Math.max(0, step), 12 * s, 18 * s, 4, dark, OUT, 2.5);
    rr(c, 6 * s, -18 * s + Math.max(0, -step), 12 * s, 18 * s, 4, dark, OUT, 2.5);
    // body
    rr(c, -24 * s, -62 * s, 48 * s, 48 * s, 16 * s, body, OUT);
    rr(c, -24 * s, -36 * s, 48 * s, 12 * s, 4, '#5a3a2a', OUT, 2);
    // arm reaching left
    rr(c, -48 * s, -50 * s + step * 0.5, 30 * s, 10 * s, 5 * s, body, OUT, 2.5);
    // head (snout to the left)
    ell(c, -14 * s, -78 * s, 26 * s, 20 * s, OUT); ell(c, -14 * s, -78 * s, 23 * s, 17 * s, body);
    ell(c, -36 * s, -72 * s, 12 * s, 9 * s, body);
    ell(c, -8 * s, -84 * s, 8 * s, 9 * s, '#fff'); ell(c, -10 * s, -84 * s, 3 * s, 3 * s, OUT);
    if (hat !== '#00000000') { c.beginPath(); c.ellipse(-12 * s, -92 * s, 24 * s, 12 * s, 0, Math.PI, TAU); c.fillStyle = hat; c.fill(); c.lineWidth = 3; c.strokeStyle = OUT; c.stroke(); }
    if (big > 1) { rr(c, 14 * s, -58 * s, 18 * s, 34 * s, 6, '#8a8f98', OUT, 2.5); }
    c.restore();
    c.globalAlpha = 1;
  };
}

// ── Effects, bullets ────────────────────────────────────────────────────────────────────────────────
const explosion = (c, w, h, i, frames) => {
  const t = i / (frames - 1), r = w * (0.12 + 0.3 * Math.sin(Math.min(1, t * 1.3) * Math.PI / 2));
  c.globalAlpha = 1 - t * 0.9;
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * TAU + t, d = r * 0.55;
    ell(c, w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, r * 0.5, r * 0.5, t < 0.3 ? '#ffd24a' : '#f0f0f0');
  }
  ell(c, w / 2, h / 2, r * 0.6, r * 0.6, t < 0.25 ? '#fff6c0' : '#ffffff');
  c.globalAlpha = 1;
};
const muzzle = (c, w, h, i, frames) => {
  const t = i / (frames - 1);
  c.globalAlpha = 1 - t;
  ell(c, w * 0.2, h / 2, 8 + t * 6, 20 - t * 10, '#ffb020');
  ell(c, w * 0.45, h / 2, 26 * (1 - t) + 4, 8 * (1 - t) + 2, '#ffe36a');
  c.globalAlpha = 1;
};
const bullet = (color, glow) => (c, w, h) => {
  rr(c, w * 0.12, h * 0.3, w * 0.76, h * 0.4, h * 0.2, glow);
  rr(c, w * 0.2, h * 0.38, w * 0.6, h * 0.24, h * 0.12, color);
};

// ── Backgrounds ─────────────────────────────────────────────────────────────────────────────────────
const AREA = [['#56687a', '#c9a24a'], ['#8a7058', '#e0b060'], ['#5a4660', '#c8c0d0'], ['#5e6266', '#d0a040'], ['#4f6a5e', '#c8b050']];
// Same layout as the kit's Area art (see src/game/layout.ts): measured in kit pixels, drawn at 720/1062.
const K = 720 / 1062;
const area = (n) => (c, w, h) => {
  const [road, line] = AREA[n];
  c.save(); c.scale(K, K);
  const W = w / K;
  c.fillStyle = '#3a3440'; c.fillRect(0, 0, W, 1062);
  c.fillStyle = '#6a6070'; c.fillRect(0, 90, W, 105);              // top sidewalk
  c.fillStyle = road; c.fillRect(0, 195, W, 685);                  // road
  c.fillStyle = line; for (let x = 820; x < W; x += 180) c.fillRect(x, 512, 110, 14);
  c.fillStyle = 'rgba(255,255,255,0.18)'; for (let y = 230; y < 860; y += 70) c.fillRect(760, y, 160, 34); // crossing
  c.fillStyle = '#6a6070'; c.fillRect(0, 880, W, 90);              // bottom sidewalk
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 970, W, 92);
  for (let r = 0; r < 5; r++) for (const x of [225, 363]) rr(c, x, 253 + r * 115, 95, 94, 6, 'rgba(255,255,255,0.12)'); // cat grid
  for (let r = 0; r < 5; r++) { // crate wall
    const y = 215 + r * 119;
    rr(c, 520 + (r % 2) * 8, y, 118, 112, 6, '#c68a52', '#5a3418', 4);
    c.strokeStyle = '#8a5a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(560 + (r % 2) * 8, y + 6); c.lineTo(560 + (r % 2) * 8, y + 106); c.stroke();
  }
  rr(c, 652, 250, 66, 455, 30, '#c8c8d0', OUT, 4);                 // wall bar housing
  rr(c, 670, 268, 22, 410, 10, '#2a3436');                         // bar channel (the game draws the fill)
  c.restore();
};
const menu = (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2d2540'); g.addColorStop(1, '#4a5a6a'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let k = 0; k < 18; k++) { // paw prints
    const x = (k * 233) % w, y = 60 + ((k * 137) % (h - 80));
    ell(c, x, y, 16, 13, 'rgba(255,255,255,0.07)');
    for (let j = 0; j < 4; j++) ell(c, x - 15 + j * 10, y - 18 - (j % 3 === 0 ? 0 : 5), 5, 6, 'rgba(255,255,255,0.07)');
  }
  c.save(); c.translate(40, 300); c.scale(2.2, 2.2); cat(1, 'idle')(c, 140, 126, 0, 20); c.restore();
  c.save(); c.translate(160, 420); c.scale(2.0, 2.0); cat(8, 'idle')(c, 140, 126, 0, 20); c.restore();
  c.save(); c.translate(1000, 300); c.scale(2.2, 2.2); zombie('#c8282e', 'walk')(c, 176, 130, 0, 14); c.restore();
  c.save(); c.translate(1120, 430); c.scale(2.0, 2.0); zombie('#f07b22', 'walk')(c, 176, 130, 3, 14); c.restore();
};

// ── UI ──────────────────────────────────────────────────────────────────────────────────────────────
const coin = (c, w, h) => { ell(c, w / 2, h / 2, w / 2 - 2, h / 2 - 2, OUT); ell(c, w / 2, h / 2, w / 2 - 5, h / 2 - 5, '#ffd02a'); ell(c, w / 2, h / 2, w / 2 - 14, h / 2 - 14, '#f0a818'); };
const bar = (fill, edge) => (c, w, h) => rr(c, 3, 3, w - 6, h - 6, h * 0.25, fill, edge, 4);
const wavebar = (c, w, h) => { bar('#6e5048', '#c88a6a')(c, w, h); ell(c, 34, h / 2, 22, 22, '#f0f0f0'); ell(c, 27, h / 2 - 3, 5, 6, OUT); ell(c, 41, h / 2 - 3, 5, 6, OUT); };
const button = (top, bottom) => (c, w, h) => { rr(c, 4, 8, w - 8, h - 12, 18, bottom, OUT, 4); rr(c, 4, 4, w - 8, h - 22, 18, top, OUT, 4); };
const settings = (c, w, h) => {
  rr(c, 4, 4, w - 8, h - 8, 16, '#5a7a9a', OUT, 4);
  c.save(); c.translate(w / 2, h / 2); for (let k = 0; k < 8; k++) { c.rotate(TAU / 8); rr(c, -6, -28, 12, 14, 3, '#e8e8f0'); } c.restore();
  ell(c, w / 2, h / 2, 20, 20, '#e8e8f0'); ell(c, w / 2, h / 2, 9, 9, '#5a7a9a');
};
const wall = (c, w, h) => { rr(c, 30, 10, 40, h - 20, 6, '#a09aa8', OUT, 3); rr(c, 8, 40, 32, 36, 8, '#f0a020', OUT, 3); };
const ribbon = (c, w, h) => {
  c.fillStyle = '#7a1a1a'; c.beginPath(); c.moveTo(0, 50); c.lineTo(60, 40); c.lineTo(60, h - 20); c.lineTo(0, h - 10); c.lineTo(24, 80); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(w, 50); c.lineTo(w - 60, 40); c.lineTo(w - 60, h - 20); c.lineTo(w, h - 10); c.lineTo(w - 24, 80); c.closePath(); c.fill();
  rr(c, 40, 20, w - 80, h - 50, 10, '#b02a2a', OUT, 4);
};
const banner = (fill, star) => (c, w, h) => {
  rr(c, w * 0.12, h * 0.2, w * 0.76, h * 0.6, 24, fill, OUT, 5);
  for (const s of [-1, 0, 1]) {
    const x = w / 2 + s * 90, y = h * 0.5 - (s === 0 ? 20 : 0), r = s === 0 ? 46 : 36;
    c.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rad = k % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
    c.closePath(); c.fillStyle = star; c.fill(); c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
  }
};
const up = (n) => (c, w) => {
  for (let k = 0; k < 3; k++) {
    const y = 14 + k * 15;
    c.beginPath(); c.moveTo(6, y + 12); c.lineTo(w / 2, y); c.lineTo(w - 6, y + 12);
    c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 12; c.strokeStyle = OUT; c.stroke();
    c.lineWidth = 7; c.strokeStyle = k >= 3 - n ? '#f39a1c' : '#ffffff'; c.stroke();
  }
};

export const drawers = {
  'fx.explosion': explosion, 'fx.muzzle': muzzle,
  'bullet.blast': bullet('#ff3030', 'rgba(255,40,40,0.35)'),
  'bullet.venom': bullet('#30e040', 'rgba(40,220,60,0.35)'),
  'bullet.rapid': bullet('#ffe020', 'rgba(255,220,30,0.35)'),
  'bg.menu': menu,
  'ui.coin': coin, 'ui.coinbar': bar('#3a4450', '#5a6a80'), 'ui.wavebar': wavebar,
  'ui.cardbox': (c, w, h) => { rr(c, 6, 6, w - 12, h - 12, 16, '#ffef00', '#f8c890', 8); },
  'ui.btn-green': button('#8cc63f', '#3a8a2a'), 'ui.btn-orange': button('#f8a848', '#c86a20'),
  'ui.settings': settings, 'ui.wall': wall, 'ui.ribbon': ribbon,
  'ui.win': banner('#c89a5a', '#ffd02a'), 'ui.lose': banner('#6a3a3a', '#7a7a80'),
};
/** Draw at a design size, scaled to the frame (the figures were designed at the first frame sizes). */
const fitTo = (dw, dh, draw) => (c, w, h, i, n) => { c.save(); c.scale(w / dw, h / dh); draw(c, dw, dh, i, n); c.restore(); };
for (let n = 1; n <= 15; n++) { drawers[`cat.c${n}.idle`] = fitTo(140, 126, cat(n, 'idle')); drawers[`cat.c${n}.shoot`] = fitTo(140, 126, cat(n, 'shoot')); }
for (let e = 1; e <= 8; e++) for (const m of ['walk', 'attack', 'dead']) drawers[`enemy.reg${e}.${m}`] = fitTo(176, 130, zombie(ZHAT[e - 1], m));
for (let b = 1; b <= 5; b++) for (const m of ['walk', 'attack', 'dead']) drawers[`enemy.boss${b}.${m}`] = fitTo(204, 172, zombie(BOSS[b - 1], m, 1.45));
for (let a = 1; a <= 5; a++) drawers[`bg.area${a}`] = area(a - 1);
for (let n = 1; n <= 3; n++) drawers[`ui.up${n}`] = up(n);

// ── Milestone 2: bosses 6–7, add-on cats, menu screens and their UI ────────────────────────────────────
for (const [b, col] of [[6, '#6a6a78'], [7, '#8a3a3a']]) for (const m of ['walk', 'attack', 'dead']) drawers[`enemy.boss${b}.${m}`] = fitTo(204, 172, zombie(col, m, 1.45));
// Cat Guardian (helmet + shield) and Boxer Cat (red gloves): the cat figure with a twist, same anchor (feet at the bottom).
const melee = (n, extra) => (mode) => (c, w, h, i, frames) => {
  c.save(); c.translate(w * 0.2, h * 0.28); c.scale(0.75, 0.72); cat(n, 'idle')(c, 140, 126, mode === 'attack' ? 0 : i, frames); c.restore();
  extra(c, w, h, mode === 'attack' ? Math.sin((i / frames) * TAU) : 0);
};
const guard = melee(12, (c, w, h, p) => { rr(c, w * 0.55 + p * 10, h * 0.45, 30, 46, 10, '#9aa0aa', OUT, 3); ell(c, w * 0.36, h * 0.3, 26, 16, '#b8bcc6'); });
const boxer = melee(1, (c, w, h, p) => { ell(c, w * 0.58 + Math.max(0, p) * 22, h * 0.6, 13, 12, '#e03030'); ell(c, w * 0.5, h * 0.66, 12, 11, '#c02020'); });
for (const m of ['idle', 'attack']) { drawers[`addon.guard.${m}`] = guard(m); drawers[`addon.boxer.${m}`] = boxer(m); }

// Menu screens: dark diamond side menu, grey wall, darker panel (same places as the kit's, see src/scenes/menuFrame.ts).
const screen = (panel) => (c, w, h) => {
  c.fillStyle = '#7a857a'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#2c3438'; c.fillRect(0, 0, 281, h);
  c.fillStyle = '#353e43'; for (let y = -26; y < h; y += 52) for (let x = (y / 52) % 2 ? 26 : 0; x < 281; x += 52) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 20, y + 26); c.lineTo(x, y + 52); c.lineTo(x - 20, y + 26); c.closePath(); c.fill(); }
  rr(c, panel[0], panel[1], panel[2] - panel[0], panel[3] - panel[1], 6, '#626a60');
};
drawers['bg.screen'] = screen([370, 174, 1274, 619]);
drawers['bg.screen-addon'] = screen([555, 181, 1274, 626]);
// The level map: a winding road on grass, along the same path as the kit's (src/game/levels.ts MAP_PATH, ×0.5).
drawers['ui.levelmap'] = (c, w, h) => {
  c.fillStyle = '#4a514a'; c.fillRect(0, 30, w, h - 60);
  c.fillStyle = '#7cc04a'; c.fillRect(10, 45, w - 20, h - 90);
  const road = (lw, col) => { c.beginPath(); MAP_PATH.forEach(([x, y], i) => (i ? c.lineTo(x / 2, y / 2) : c.moveTo(x / 2, y / 2))); c.lineWidth = lw; c.strokeStyle = col; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); };
  road(44, '#e8dcb0'); road(36, '#46525e'); road(2, '#b08850');
  for (let x = 120; x < w; x += 260) { rr(c, x, 120, 60, 50, 4, '#8a6a5a', OUT, 2); ell(c, x + 120, 300, 20, 20, '#3c9a3c'); }
};
const shield = (fill, edge = OUT) => (c, w, h) => {
  c.beginPath(); c.moveTo(6, 6); c.lineTo(w - 6, 6); c.lineTo(w - 6, h * 0.62); c.lineTo(w / 2, h - 6); c.lineTo(6, h * 0.62); c.closePath();
  c.fillStyle = fill; c.fill(); c.lineWidth = Math.max(2, w / 18); c.strokeStyle = edge; c.stroke();
};
const lock = (c, w, h) => { c.lineWidth = w / 12; c.strokeStyle = OUT; c.beginPath(); c.arc(w / 2, h * 0.42, w * 0.13, Math.PI, TAU); c.stroke(); rr(c, w * 0.32, h * 0.42, w * 0.36, h * 0.26, 4, '#d8d8dc', OUT, 2); };
const withLock = (base) => (c, w, h) => { base(c, w, h); lock(c, w, h); };
Object.assign(drawers, {
  'ui.lvl-done': shield('#f6a12a'), 'ui.lvl-next': shield('#46b84a'), 'ui.lvl-locked': withLock(shield('#6c6f72')),
  'ui.tab': (c, w, h) => rr(c, 2, 4, w - 2, h - 10, 14, '#00a99d', '#007a72', 4),
  'ui.tab-on': (c, w, h) => rr(c, 2, 4, w - 2, h - 10, 14, '#7a857a'),
  'ui.icon-home': (c, w, h) => { c.beginPath(); c.moveTo(w / 2, 10); c.lineTo(w - 10, h / 2); c.lineTo(10, h / 2); c.closePath(); c.fillStyle = '#f28c1c'; c.fill(); rr(c, w * 0.25, h / 2, w * 0.5, h * 0.38, 3, '#f6c04a', OUT, 3); },
  'ui.icon-cat': (c, w, h) => { ell(c, w / 2, h / 2 + 6, w * 0.4, h * 0.3, '#f4a95a'); for (const s of [-1, 1]) { c.beginPath(); c.moveTo(w / 2 + s * 30, h / 2); c.lineTo(w / 2 + s * 34, 14); c.lineTo(w / 2 + s * 10, h / 2 - 16); c.closePath(); c.fillStyle = '#f4a95a'; c.fill(); } },
  'ui.icon-addon': (c, w, h) => { rr(c, w * 0.2, h * 0.35, w * 0.6, h * 0.5, 6, '#c8402a', OUT, 3); c.fillStyle = '#3cb83c'; c.fillRect(w * 0.55, 8, 14, 30); },
  'ui.gem': (c, w, h) => { c.beginPath(); c.moveTo(w * 0.2, 6); c.lineTo(w * 0.8, 6); c.lineTo(w - 4, h * 0.4); c.lineTo(w / 2, h - 4); c.lineTo(4, h * 0.4); c.closePath(); c.fillStyle = '#5ac83a'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#2a6a2a'; c.stroke(); },
  'ui.gembar': bar('#2c3438', '#4a5a5a'),
  'ui.daily': (c, w, h) => { rr(c, w * 0.18, h * 0.3, w * 0.6, h * 0.5, 8, '#f0a020', OUT, 4); c.fillStyle = '#d0302a'; c.fillRect(w * 0.44, h * 0.3, 12, h * 0.5); ell(c, w * 0.78, h * 0.22, 22, 22, '#d0302a'); },
  'ui.winbonus': bar('#6a3a3a', '#8a5a4a'),
  'ui.add': (c, w, h) => { rr(c, 4, 4, w - 8, h - 8, 12, '#ffd02a', '#f08a1a', 5); c.fillStyle = '#fff'; c.fillRect(w / 2 - 8, 22, 16, h - 44); c.fillRect(22, h / 2 - 8, w - 44, 16); },
  'ui.add-off': (c, w, h) => { rr(c, 4, 4, w - 8, h - 8, 12, '#8a6a1a', '#5a4a1a', 5); c.fillStyle = '#9a8a5a'; c.fillRect(w / 2 - 8, 22, 16, h - 44); c.fillRect(22, h / 2 - 8, w - 44, 16); },
  'ui.up0': up(0),
  'ui.addon-row': (c, w, h) => rr(c, 4, 4, w - 8, h - 8, 14, '#4a524c', '#626a60', 5),
  'ui.addon-count': bar('#262c2c', '#3a4040'),
  'ui.btn-yellow': button('#ffd02a', '#f08a1a'),
  'ui.addon-slot': (c, w, h) => rr(c, 5, 5, w - 10, h - 10, 18, '#ffee00', '#f8c890', 8),
  'ui.addon-sel': (c, w, h) => rr(c, 4, 4, w - 8, h - 8, 16, null, '#ffee00', 5),
  'ui.slot-locked': withLock((c, w, h) => rr(c, 5, 5, w - 10, h - 10, 18, '#b8b8bc', '#e8e8ec', 8)),
  'ui.pausebar': (c, w, h) => rr(c, 4, 10, w - 8, h - 20, 20, '#7a3a3a'),
});
for (let n = 0; n <= 5; n++) drawers[`ui.bar${n}`] = (c, w, h) => { for (let k = 0; k < 5; k++) rr(c, 4 + k * 28, 6, 22, h - 12, 6, k < n ? '#2aa8e0' : '#6a756a', OUT, 2); };
const BADGE = ['#b8ff3c', '#4a8ad8', '#4ab8a8', '#8a5a2a', '#f0e0c8', '#e05a5a', '#f8b048', '#3cb84a', '#20f0f0', '#e02028', '#0070c0', '#a08a7a', '#ff8a8a', '#ffe020', '#f05a20'];
for (let n = 1; n <= 15; n++) drawers[`ui.badge${n}`] = shield(BADGE[n - 1], '#4a1a1a');
const ICON = {
  rocket: (c, w, h) => { rr(c, w * 0.15, h * 0.4, w * 0.6, h * 0.22, 10, '#c8ccd8', OUT, 3); c.beginPath(); c.moveTo(w * 0.75, h * 0.4); c.lineTo(w * 0.92, h * 0.51); c.lineTo(w * 0.75, h * 0.62); c.fillStyle = '#e04030'; c.fill(); },
  coins: (c, w, h) => { for (const [x, y] of [[0.35, 0.55], [0.45, 0.4]]) { ell(c, w * x, h * y, 22, 15, OUT); ell(c, w * x, h * y, 19, 12, '#ffd02a'); } c.fillStyle = '#e04030'; c.fillRect(w * 0.65, h * 0.5, 22, 22); },
  bomb: (c, w, h) => { c.beginPath(); for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU, r = k % 2 ? 22 : 40; c.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); } c.closePath(); c.fillStyle = '#f04a20'; c.fill(); ell(c, w / 2, h / 2, 16, 16, '#ffd02a'); },
  timebomb: (c, w, h) => { ell(c, w / 2, h / 2, 34, 30, '#5a646e'); ell(c, w / 2, h / 2, 22, 20, '#c83020'); ell(c, w / 2, h / 2, 10, 10, '#f0f0f0'); },
  guard: (c, w, h) => { ell(c, w / 2, h * 0.4, 26, 24, '#b8bcc6'); rr(c, w * 0.35, h * 0.55, w * 0.3, h * 0.35, 8, '#9aa0aa', OUT, 3); },
  tnt: (c, w, h) => { rr(c, w * 0.25, h * 0.3, w * 0.5, h * 0.6, 4, '#a0703a', OUT, 3); ell(c, w * 0.55, h * 0.3, 18, 18, '#e04020'); },
  boxer: (c, w, h) => { ell(c, w / 2, h * 0.45, 30, 26, '#f4a95a'); ell(c, w * 0.3, h * 0.72, 14, 12, '#e03030'); ell(c, w * 0.7, h * 0.72, 14, 12, '#e03030'); },
  spikes: (c, w, h) => { rr(c, w * 0.2, h * 0.15, w * 0.6, h * 0.7, 6, '#6a6e72', OUT, 3); for (let k = 0; k < 5; k++) ell(c, w * (0.32 + (k % 3) * 0.18), h * (0.32 + Math.floor(k / 3) * 0.3), 7, 11, '#e8e8ec'); },
};
for (const [k, f] of Object.entries(ICON)) drawers[`ui.addon-${k}`] = (c, w, h) => { rr(c, 8, 4, w - 16, h - 8, 10, '#5a6a68'); f(c, w, h); };
const roundBtn = (on, glyph) => (c, w, h) => { ell(c, w / 2, h / 2, w / 2 - 3, h / 2 - 3, '#7a3a3a'); ell(c, w / 2, h / 2, w / 2 - 12, h / 2 - 12, on ? '#f8a838' : '#b8b8bc'); glyph(c, w, h); if (!on) { ell(c, w * 0.66, h * 0.64, 13, 13, '#7a3a3a'); } };
const note = (c, w, h) => { c.fillStyle = OUT; c.fillRect(w * 0.55, h * 0.28, 7, h * 0.36); ell(c, w * 0.48, h * 0.66, 11, 9, OUT); };
const spk = (c, w, h) => { c.fillStyle = OUT; c.beginPath(); c.moveTo(w * 0.3, h * 0.42); c.lineTo(w * 0.42, h * 0.42); c.lineTo(w * 0.56, h * 0.3); c.lineTo(w * 0.56, h * 0.7); c.lineTo(w * 0.42, h * 0.58); c.lineTo(w * 0.3, h * 0.58); c.closePath(); c.fill(); };
const phone = (c, w, h) => rr(c, w * 0.38, h * 0.28, w * 0.24, h * 0.44, 5, null, OUT, 5);
Object.assign(drawers, { 'ui.music': roundBtn(true, note), 'ui.music-off': roundBtn(false, note), 'ui.sound': roundBtn(true, spk), 'ui.sound-off': roundBtn(false, spk), 'ui.vibra': roundBtn(true, phone), 'ui.vibra-off': roundBtn(false, phone) });
