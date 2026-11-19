// Original placeholder art (MIT), drawn from code so a fresh clone runs without the CraftPix kit.
// One drawer per manifest key: draw(ctx, w, h, frame, frames) in the frame's own coordinates.
// Same sizes, frame counts and anchor points (feet on the bottom edge) as the real art, so swapping is seamless.
// No text: fonts differ between machines, and CI checks that this output is byte-for-byte reproducible.

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
const area = (k) => (c, w, h) => {
  const [road, line] = AREA[k];
  c.fillStyle = '#3a3440'; c.fillRect(0, 0, w, h);
  rr(c, -4, 60, w + 8, 120, 0, '#6a6070'); // top sidewalk
  c.fillStyle = road; c.fillRect(0, 186, w, 626);
  c.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = 186; y < 812; y += 124) c.fillRect(0, y, w, 2);
  c.fillStyle = line; for (let x = 10; x < w; x += 120) c.fillRect(x, 494, 70, 10);
  rr(c, -4, 812, w + 8, 110, 0, '#6a6070'); // bottom sidewalk
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 922, w, h - 922);
};
const menu = (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2d2540'); g.addColorStop(1, '#4a5a6a'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let k = 0; k < 14; k++) { // paw prints
    const x = (k * 157) % w, y = 120 + k * 83;
    ell(c, x, y, 16, 13, 'rgba(255,255,255,0.07)');
    for (let j = 0; j < 4; j++) ell(c, x - 15 + j * 10, y - 18 - (j % 3 === 0 ? 0 : 5), 5, 6, 'rgba(255,255,255,0.07)');
  }
  c.save(); c.translate(-40, 260); c.scale(2.4, 2.4); cat(1, 'idle')(c, 140, 126, 0, 20); c.restore();
  c.save(); c.translate(200, 620); c.scale(2.2, 2.2); cat(8, 'idle')(c, 140, 126, 0, 20); c.restore();
  c.save(); c.translate(-20, 860); c.scale(2.3, 2.3); cat(13, 'idle')(c, 140, 126, 0, 20); c.restore();
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
