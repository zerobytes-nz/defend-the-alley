// Bullets drawn in code (so they ship with the repo, no licensed art): one look per attack, a glowing trail
// that follows each shot, and a small burst where it lands.
//   Rapid: a white-hot tracer with a golden streak.   Blast: a spinning fire shell that sheds embers.
//   Venom: a wobbling green glob that drips.
import Phaser from 'phaser';
import type { Attack } from '../game/cats.ts';

/** Texture keys, drawn at 2× and shown at half scale so they stay crisp. */
export const SHOT_KEY: Record<Attack, string> = { rapid: 'shot.rapid', blast: 'shot.blast', venom: 'shot.venom' };
export const SHOT_SCALE = 0.5;
/** Extra size per attack (the slow Blast shell reads bigger). */
const SIZE: Record<Attack, number> = { rapid: 1, blast: 1.25, venom: 1.1 };
const SPARK = 'shot.spark';

type Ctx = CanvasRenderingContext2D;
function paint(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void): void {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h);
  if (!t) return;
  draw(t.getContext());
  t.refresh();
}

/** Make the bullet textures once (any scene can call it; later calls do nothing). */
export function ensureShotTextures(scene: Phaser.Scene): void {
  paint(scene, SHOT_KEY.rapid, 96, 32, (c) => {
    const streak = c.createLinearGradient(0, 0, 96, 0);
    streak.addColorStop(0, 'rgba(255,170,40,0)'); streak.addColorStop(0.55, 'rgba(255,190,50,0.55)'); streak.addColorStop(1, 'rgba(255,230,120,0.95)');
    c.fillStyle = streak; c.beginPath(); c.moveTo(0, 16); c.lineTo(70, 6); c.lineTo(70, 26); c.closePath(); c.fill();
    const glow = c.createRadialGradient(74, 16, 0, 74, 16, 16);
    glow.addColorStop(0, 'rgba(255,240,170,0.9)'); glow.addColorStop(1, 'rgba(255,200,60,0)');
    c.fillStyle = glow; c.fillRect(56, 0, 40, 32);
    c.fillStyle = '#ffd02a'; c.beginPath(); c.roundRect(56, 9, 36, 14, 7); c.fill();
    c.fillStyle = '#fffbe6'; c.beginPath(); c.roundRect(62, 12, 28, 8, 4); c.fill();
  });
  paint(scene, SHOT_KEY.blast, 64, 64, (c) => {
    const glow = c.createRadialGradient(32, 32, 8, 32, 32, 32);
    glow.addColorStop(0, 'rgba(255,140,40,0.7)'); glow.addColorStop(1, 'rgba(255,60,20,0)');
    c.fillStyle = glow; c.fillRect(0, 0, 64, 64);
    const ball = c.createRadialGradient(27, 26, 2, 32, 32, 17);
    ball.addColorStop(0, '#fff6c8'); ball.addColorStop(0.35, '#ffd040'); ball.addColorStop(0.75, '#ff6a1e'); ball.addColorStop(1, '#c8240e');
    c.fillStyle = ball; c.beginPath(); c.arc(32, 32, 17, 0, Math.PI * 2); c.fill();
    c.lineWidth = 3; c.strokeStyle = '#6a1608'; c.stroke();
    // Two flame licks so the spin shows.
    c.fillStyle = '#ffb030';
    for (const a of [0.6, 3.7]) {
      c.beginPath(); c.ellipse(32 + Math.cos(a) * 15, 32 + Math.sin(a) * 15, 7, 3.5, a + Math.PI / 2, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.ellipse(26, 24, 5, 3, -0.6, 0, Math.PI * 2); c.fill();
  });
  paint(scene, SHOT_KEY.venom, 64, 56, (c) => {
    const glow = c.createRadialGradient(30, 28, 6, 30, 28, 28);
    glow.addColorStop(0, 'rgba(140,255,80,0.6)'); glow.addColorStop(1, 'rgba(80,220,40,0)');
    c.fillStyle = glow; c.fillRect(0, 0, 64, 56);
    // A teardrop pointing back: round front, thin tail.
    const goo = c.createRadialGradient(36, 24, 2, 34, 28, 17);
    goo.addColorStop(0, '#e6ff9a'); goo.addColorStop(0.45, '#8cff4a'); goo.addColorStop(1, '#2f9a1c');
    c.fillStyle = goo;
    c.beginPath(); c.moveTo(6, 30); c.quadraticCurveTo(20, 14, 36, 13); c.arc(36, 28, 15, -Math.PI / 2, Math.PI / 2); c.quadraticCurveTo(20, 42, 6, 30); c.fill();
    c.lineWidth = 3; c.strokeStyle = '#1d5a12'; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(40, 22, 4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(33, 20, 2, 0, Math.PI * 2); c.fill();
  });
  paint(scene, SPARK, 24, 24, (c) => {
    const g = c.createRadialGradient(12, 12, 0, 12, 12, 12);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 24, 24);
  });
}

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;
const TRAIL: Record<Attack, Phaser.Types.GameObjects.Particles.ParticleEmitterConfig> = {
  rapid: { lifespan: 110, scale: { start: 0.45, end: 0 }, alpha: { start: 0.45, end: 0 }, tint: [0xffd02a, 0xffa020], blendMode: 'ADD' },
  blast: { lifespan: 260, speed: { min: 8, max: 30 }, scale: { start: 0.75, end: 0.1 }, alpha: { start: 0.55, end: 0 }, gravityY: -60, tint: [0xffb030, 0xff6a1e, 0xffe080], blendMode: 'ADD' },
  venom: { lifespan: 380, speedY: { min: 10, max: 40 }, scale: { start: 0.45, end: 0 }, alpha: { start: 0.8, end: 0 }, gravityY: 260, tint: [0x8cff4a, 0x5ed82e], blendMode: 'NORMAL' },
};
const BURST: Record<Attack, Phaser.Types.GameObjects.Particles.ParticleEmitterConfig> = {
  rapid: { lifespan: 220, speed: { min: 90, max: 220 }, angle: { min: 120, max: 240 }, scale: { start: 0.5, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xffffff, 0xffd02a], blendMode: 'ADD' },
  blast: { lifespan: 380, speed: { min: 60, max: 200 }, scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 }, gravityY: 200, tint: [0xffd040, 0xff6a1e], blendMode: 'ADD' },
  venom: { lifespan: 480, speed: { min: 60, max: 170 }, angle: { min: 150, max: 390 }, scale: { start: 0.7, end: 0.1 }, alpha: { start: 1, end: 0 }, gravityY: 420, tint: [0x8cff4a, 0xc8ff7a, 0x3fae22] },
};
/** One trail particle every this many px travelled. */
const GAP: Record<Attack, number> = { rapid: 5, blast: 7, venom: 12 };

interface Live { img: Phaser.GameObjects.Image; attack: Attack; born: number; seed: number; lastX: number }

/** One fight's bullets: their sprites, trails and hit bursts. */
export class Shots {
  private trail = {} as Record<Attack, Emitter>;
  private burst = {} as Record<Attack, Emitter>;
  private live = new Map<number, Live>();

  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, depth: number) {
    this.scene = scene;
    ensureShotTextures(scene);
    for (const a of Object.keys(SHOT_KEY) as Attack[]) {
      this.trail[a] = scene.add.particles(0, 0, SPARK, { ...TRAIL[a], emitting: false }).setDepth(depth - 1);
      this.burst[a] = scene.add.particles(0, 0, SPARK, { ...BURST[a], emitting: false }).setDepth(depth + 1);
    }
  }

  /** Fire every trail and burst once off-screen, so their first real use doesn't hitch (shaders, blend modes). */
  warmUp(): void {
    for (const a of Object.keys(SHOT_KEY) as Attack[]) {
      this.trail[a].emitParticleAt(-4000, -4000);
      this.burst[a].explode(1, -4000, -4000);
    }
  }

  add(id: number, attack: Attack, x: number, y: number, depth: number): Phaser.GameObjects.Image {
    const img = this.scene.add.image(x, y, SHOT_KEY[attack]).setScale(SHOT_SCALE * SIZE[attack]).setDepth(depth);
    if (attack === 'rapid') img.setOrigin(0.8, 0.5);
    this.live.set(id, { img, attack, born: this.scene.time.now, seed: Math.random() * 6, lastX: x });
    return img;
  }

  has(id: number): boolean { return this.live.has(id); }

  /** Move a bullet (called every frame) and leave its trail. */
  move(id: number, x: number): void {
    const s = this.live.get(id);
    if (!s) return;
    s.img.x = x;
    const t = (this.scene.time.now - s.born) / 1000;
    if (s.attack === 'blast') s.img.rotation = t * 14;
    if (s.attack === 'venom') { const w = Math.sin(t * 22 + s.seed), k = SHOT_SCALE * SIZE.venom; s.img.setScale(k * (1 + w * 0.08), k * (1 - w * 0.08)); }
    // Fill the whole stretch moved since last frame, so fast shots leave a solid trail, not dots.
    const back = s.attack === 'rapid' ? 18 : 10, gap = GAP[s.attack];
    const n = Math.min(10, Math.floor(Math.abs(x - s.lastX) / gap));
    for (let i = 1; i <= n; i++) this.trail[s.attack].emitParticleAt(s.lastX + ((x - s.lastX) * i) / n - back, s.img.y + (s.attack === 'venom' ? (Math.random() - 0.5) * 6 : 0));
    if (n > 0) s.lastX = x;
  }

  /** A shot landed: burst at the front of it. */
  hit(id: number): void {
    const s = this.live.get(id);
    if (s) this.burst[s.attack].explode(s.attack === 'blast' ? 10 : 7, s.img.x + 8, s.img.y);
  }

  remove(id: number): void {
    const s = this.live.get(id);
    if (!s) return;
    s.img.destroy();
    this.live.delete(id);
  }

  /** Bullets the sim no longer has. */
  prune(keep: Set<number>): void {
    for (const id of [...this.live.keys()]) if (!keep.has(id)) this.remove(id);
  }

  clear(): void { for (const id of [...this.live.keys()]) this.remove(id); }
}

/** A bullet as a small icon (cards, the Cats screen), about `w` px wide. */
export function shotIcon(scene: Phaser.Scene, x: number, y: number, attack: Attack, w: number): Phaser.GameObjects.Image {
  ensureShotTextures(scene);
  const img = scene.add.image(x, y, SHOT_KEY[attack]);
  return img.setScale(w / (attack === 'rapid' ? 72 : img.width * 0.7));
}
