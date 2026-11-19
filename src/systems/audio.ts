// Sound effects and music, synthesized with Web Audio: no audio files to license or download.
// The AudioContext starts on the first tap/key (browsers block audio before a user gesture).
// Mute is remembered in localStorage; M toggles it on a keyboard.

type Wave = OscillatorType;
const MUTE_KEY = 'defend-the-alley.muted.v1';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = readMuted();
const listeners = new Set<(m: boolean) => void>();

function readMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = settings.sound ? 0.55 : 0; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = settings.music ? 0.22 : 0; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

/** Call once at start-up: unlocks audio on the first user gesture and binds the M key. */
export function initAudio(): void {
  const unlock = () => { const c = ensure(); if (c?.state === 'suspended') void c.resume(); };
  for (const ev of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(ev, unlock, { capture: true });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') { if (!(e.target instanceof HTMLInputElement)) toggleMute(); }
  });
  // Pause sound when the tab is hidden (phones: app switch, lock screen).
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend(); else void ctx.resume();
  });
}

export const isMuted = () => muted;

// The pause screen's toggles (the kit's music / sound / vibration buttons). Mute (M, 🔊) silences everything.
const SET_KEY = 'defend-the-alley.audio.v1';
const settings = (() => { try { return { music: true, sound: true, vibra: true, ...JSON.parse(localStorage.getItem(SET_KEY) ?? '{}') }; } catch { return { music: true, sound: true, vibra: true }; } })();
const keep = () => { try { localStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch { /* private mode */ } };
export const musicOn = () => settings.music as boolean;
export const soundOn = () => settings.sound as boolean;
export const vibraOn = () => settings.vibra as boolean;
export function toggleMusic(): void {
  settings.music = !settings.music; keep();
  if (ctx && musicBus) musicBus.gain.setTargetAtTime(settings.music ? 0.22 : 0, ctx.currentTime, 0.02);
}
export function toggleSound(): void {
  settings.sound = !settings.sound; keep();
  if (ctx && sfxBus) sfxBus.gain.setTargetAtTime(settings.sound ? 0.55 : 0, ctx.currentTime, 0.02);
}
export function toggleVibra(): void { settings.vibra = !settings.vibra; keep(); }
let lastBuzz = 0;
/** A short buzz on phones that support it (Android), at most every 250 ms. */
export function buzz(ms = 30): void {
  const now = performance.now();
  if (!settings.vibra || now - lastBuzz < 250 || navigator.userActivation?.hasBeenActive === false) return; // browsers refuse before the first tap
  lastBuzz = now;
  try { navigator.vibrate?.(ms); } catch { /* not allowed */ }
}
export function onMuteChange(fn: (m: boolean) => void): () => void { listeners.add(fn); return () => listeners.delete(fn); }
export function toggleMute(): void {
  muted = !muted;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* private mode */ }
  if (ctx && master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.02);
  listeners.forEach((fn) => fn(muted));
}

// ───────────────────────────── Building blocks ─────────────────────────────

interface Tone { f: number; f2?: number; dur: number; type?: Wave; vol?: number; at?: number; attack?: number; bus?: GainNode | null }

function tone({ f, f2, dur, type = 'square', vol = 0.3, at = 0, attack = 0.005, bus = sfxBus }: Tone): void {
  if (!ctx || !bus || muted) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.3, from = 2000, to = 400, at = 0, q = 1): void {
  if (!ctx || !sfxBus || !noiseBuf || muted) return;
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
  bp.frequency.setValueAtTime(from, t); bp.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(bp).connect(g).connect(sfxBus);
  s.start(t); s.stop(t + dur + 0.02);
}

// ───────────────────────────── Effects ─────────────────────────────

let coinStreak = 0, lastCoinAt = 0, lastPewAt = 0, lastThudAt = 0;
const COIN_STEPS = [0, 2, 4, 7, 9, 12, 14, 16]; // pentatonic climb for quick pickups

export const sfx = {
  // Defend the Alley: cats firing, hits and the wall. Shots are throttled so a full street doesn't clip.
  pew: (kind: 'blast' | 'rapid' | 'venom') => {
    const now = performance.now();
    if (now - lastPewAt < 45) return;
    lastPewAt = now;
    if (kind === 'blast') { tone({ f: 220, f2: 90, dur: 0.12, type: 'square', vol: 0.09 }); noise(0.08, 0.1, 1500, 400, 0, 0.8); }
    else if (kind === 'rapid') tone({ f: 1300, f2: 700, dur: 0.05, type: 'square', vol: 0.05 });
    else tone({ f: 520, f2: 260, dur: 0.09, type: 'sine', vol: 0.09 });
  },
  boom: () => { noise(0.25, 0.3, 1200, 150, 0, 0.7); tone({ f: 120, f2: 45, dur: 0.22, type: 'sine', vol: 0.3 }); },
  thud: () => { const now = performance.now(); if (now - lastThudAt < 180) return; lastThudAt = now; tone({ f: 120, f2: 70, dur: 0.1, type: 'sine', vol: 0.18 }); noise(0.06, 0.08, 500, 200); },
  place: () => { tone({ f: 440, f2: 660, dur: 0.08, type: 'triangle', vol: 0.16 }); tone({ f: 880, dur: 0.1, type: 'sine', vol: 0.08, at: 0.06 }); },
  bossIn: () => [196, 185, 175, 165].forEach((f, i) => tone({ f, dur: 0.3, type: 'sawtooth', vol: 0.1, at: i * 0.22 })),
  tap: () => tone({ f: 660, f2: 880, dur: 0.06, type: 'triangle', vol: 0.18 }),
  jump: () => tone({ f: 260, f2: 620, dur: 0.14, type: 'square', vol: 0.14 }),
  airJump: () => { tone({ f: 520, f2: 1040, dur: 0.12, type: 'triangle', vol: 0.18 }); tone({ f: 780, f2: 1400, dur: 0.1, type: 'sine', vol: 0.1, at: 0.03 }); },
  slide: () => noise(0.18, 0.14, 900, 300, 0, 0.8),
  slash: () => { noise(0.12, 0.22, 5000, 1200, 0, 2); tone({ f: 900, f2: 300, dur: 0.08, type: 'sawtooth', vol: 0.05 }); },
  coin: () => {
    const now = performance.now();
    coinStreak = now - lastCoinAt < 350 ? Math.min(coinStreak + 1, COIN_STEPS.length - 1) : 0;
    lastCoinAt = now;
    const f = 988 * 2 ** (COIN_STEPS[coinStreak] / 12);
    tone({ f, dur: 0.05, type: 'square', vol: 0.09 });
    tone({ f: f * 1.5, dur: 0.12, type: 'square', vol: 0.08, at: 0.05 });
  },
  smash: () => { noise(0.22, 0.4, 1800, 200, 0, 0.7); tone({ f: 180, f2: 60, dur: 0.18, type: 'square', vol: 0.18 }); },
  squish: () => { tone({ f: 420, f2: 90, dur: 0.16, type: 'sine', vol: 0.3 }); noise(0.08, 0.12, 700, 300); },
  hurt: () => { tone({ f: 300, f2: 90, dur: 0.28, type: 'sawtooth', vol: 0.2 }); noise(0.15, 0.2, 1200, 300); },
  shield: () => { tone({ f: 1200, f2: 600, dur: 0.25, type: 'sine', vol: 0.22 }); tone({ f: 1800, f2: 900, dur: 0.2, type: 'sine', vol: 0.1, at: 0.02 }); },
  die: () => [392, 330, 262, 196].forEach((f, i) => tone({ f, dur: 0.22, type: 'triangle', vol: 0.22, at: i * 0.13 })),
  finish: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone({ f, dur: i === 5 ? 0.5 : 0.14, type: 'square', vol: 0.13, at: i * 0.1 })),
  clang: () => { tone({ f: 1400, f2: 900, dur: 0.12, type: 'square', vol: 0.12 }); tone({ f: 2100, dur: 0.18, type: 'sine', vol: 0.08 }); noise(0.06, 0.15, 6000, 3000, 0, 3); },
  throw: () => noise(0.1, 0.18, 2500, 6000, 0, 2),
  whistle: () => tone({ f: 1500, f2: 400, dur: 0.6, type: 'sine', vol: 0.07 }),
  crash: () => { noise(0.3, 0.45, 900, 120, 0, 0.6); tone({ f: 110, f2: 40, dur: 0.3, type: 'sine', vol: 0.35 }); },
  stomp: () => { tone({ f: 140, f2: 45, dur: 0.22, type: 'sine', vol: 0.45 }); noise(0.18, 0.25, 600, 120, 0, 0.7); },
  pitFall: () => tone({ f: 600, f2: 80, dur: 0.5, type: 'triangle', vol: 0.22 }),
  meterFull: () => [784, 988, 1175, 1568].forEach((f, i) => tone({ f, dur: 0.1, type: 'square', vol: 0.09, at: i * 0.05 })),
  nearMiss: () => { noise(0.18, 0.12, 3000, 8000, 0, 1.5); tone({ f: 1200, f2: 1800, dur: 0.12, type: 'sine', vol: 0.08 }); },
  combo: (n: number) => tone({ f: 523 * 2 ** (Math.min(n, 10) / 12), dur: 0.14, type: 'triangle', vol: 0.16 }),
  zap: () => { noise(0.25, 0.3, 8000, 1500, 0, 1); tone({ f: 90, dur: 0.25, type: 'sawtooth', vol: 0.12 }); },
  power: (el: 'Fire' | 'Ice' | 'Storm' | 'Shadow') => {
    if (el === 'Fire') { noise(0.7, 0.35, 400, 3000, 0, 0.8); tone({ f: 110, f2: 330, dur: 0.6, type: 'sawtooth', vol: 0.14 }); }
    else if (el === 'Ice') { [2093, 2637, 3136, 2349].forEach((f, i) => tone({ f, dur: 0.4, type: 'sine', vol: 0.09, at: i * 0.06 })); noise(0.5, 0.12, 9000, 5000, 0, 3); }
    else if (el === 'Storm') { noise(0.6, 0.45, 5000, 300, 0, 0.5); tone({ f: 60, dur: 0.5, type: 'sawtooth', vol: 0.18 }); }
    else { tone({ f: 220, f2: 110, dur: 0.8, type: 'triangle', vol: 0.18 }); tone({ f: 233, f2: 117, dur: 0.8, type: 'sine', vol: 0.12 }); }
    [523, 659, 784, 1047].forEach((f, i) => tone({ f, dur: 0.16, type: 'square', vol: 0.08, at: 0.05 + i * 0.06 }));
  },
  heal: () => [784, 988, 1319].forEach((f, i) => tone({ f, dur: 0.16, type: 'sine', vol: 0.12, at: i * 0.05 })),
  buff: () => { tone({ f: 330, f2: 660, dur: 0.25, type: 'square', vol: 0.08 }); tone({ f: 495, f2: 990, dur: 0.25, type: 'triangle', vol: 0.08, at: 0.04 }); },
  cast: () => { tone({ f: 600, f2: 1200, dur: 0.18, type: 'triangle', vol: 0.12 }); noise(0.2, 0.08, 3000, 8000, 0, 2); },
  fight: () => { [392, 523, 659].forEach((f, i) => tone({ f, dur: 0.12, type: 'square', vol: 0.12, at: i * 0.08 })); noise(0.3, 0.15, 800, 3000, 0.24, 1); },
  count: () => tone({ f: 440, dur: 0.09, type: 'square', vol: 0.1 }),
  /** Reveal card: bigger fanfare for rarer AWIs (tier 0 = Common … 3 = Legendary). */
  reveal: (tier: number) => {
    const notes = [[523, 659], [523, 659, 784], [523, 659, 784, 1047], [523, 659, 784, 1047, 1319, 1568]][Math.max(0, Math.min(3, tier))];
    notes.forEach((f, i) => tone({ f, dur: 0.18 + (i === notes.length - 1 ? 0.3 : 0), type: 'triangle', vol: 0.16, at: i * 0.07 }));
    if (tier >= 2) noise(0.5, 0.06, 6000, 3000, 0.1, 4);
  },
};

// ───────────────────────────── Music ─────────────────────────────
// A short chiptune loop: bass + arpeggio + hi-hat, scheduled ahead with a look-ahead timer.

const BPM = 132;
const STEP = 60 / BPM / 4; // 16th notes
// Am – F – C – G, one bar each.
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);
let timer: number | null = null;
let nextAt = 0, step = 0;

function scheduleStep(at: number, s: number): void {
  const chord = CHORDS[Math.floor(s / 16) % CHORDS.length];
  const i = s % 16;
  const rel = at - (ctx?.currentTime ?? 0);
  if (i % 4 === 0) tone({ f: midi(chord[0] - 24), dur: STEP * 3.2, type: 'triangle', vol: 0.5, at: rel, bus: musicBus });
  if (i % 2 === 0) tone({ f: midi(chord[(i / 2) % 3] + 12), dur: STEP * 1.6, type: 'square', vol: 0.09, at: rel, bus: musicBus });
  if (i % 4 === 2) hat(rel);
}

function hat(at: number): void {
  if (!ctx || !musicBus || !noiseBuf || muted) return;
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  s.connect(hp).connect(g).connect(musicBus);
  s.start(t); s.stop(t + 0.06);
}

export function startMusic(): void {
  const c = ensure();
  if (!c || timer !== null) return;
  nextAt = c.currentTime + 0.1; step = 0;
  timer = window.setInterval(() => {
    if (!ctx) return;
    while (nextAt < ctx.currentTime + 0.2) { scheduleStep(nextAt, step++); nextAt += STEP; }
  }, 50);
}

export function stopMusic(): void {
  if (timer !== null) { clearInterval(timer); timer = null; }
}
