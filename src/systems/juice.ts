// Fight "juice", all drawn in code (no licensed art): coins that fly from a kill to the HUD, a dust puff when a
// zombie drops, confetti on a win, and a red pulse round the screen while the wall is low.
import Phaser from 'phaser';

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;
const PUFF = 'juice.puff', VIGNETTE = 'juice.vignette';
const CONFETTI_COLORS = [0xffd02a, 0xff6a5a, 0x8cff4a, 0x5ec8ff, 0xd78bff, 0xffffff];

function paint(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h);
  if (!t) return;
  draw(t.getContext());
  t.refresh();
}

function textures(scene: Phaser.Scene): void {
  paint(scene, PUFF, 32, 32, (c) => {
    const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.6, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 32, 32);
  });
  // Clear in the middle, red at the edges; stretched over the whole screen.
  paint(scene, VIGNETTE, 256, 128, (c) => {
    const g = c.createRadialGradient(128, 64, 40, 128, 64, 150);
    g.addColorStop(0, 'rgba(255,30,20,0)'); g.addColorStop(0.6, 'rgba(255,30,20,0.15)'); g.addColorStop(1, 'rgba(200,0,0,0.75)');
    c.fillStyle = g; c.fillRect(0, 0, 256, 128);
  });
}

export class Juice {
  private scene: Phaser.Scene;
  private puffs: Emitter;
  private top: number;
  private vignette: Phaser.GameObjects.Image;
  private pulse: Phaser.Tweens.Tween | null = null;
  private danger = false;

  constructor(scene: Phaser.Scene, depth: number) {
    this.scene = scene;
    textures(scene);
    this.puffs = scene.add.particles(0, 0, PUFF, {
      emitting: false, lifespan: 420, speed: { min: 30, max: 110 }, angle: { min: 200, max: 340 }, gravityY: -40,
      scale: { start: 0.9, end: 1.8 }, alpha: { start: 0.55, end: 0 }, tint: [0xd8d2c4, 0xbab2a2, 0xeee8da],
    }).setDepth(depth);
    this.top = depth + 1200;
    // Fixed to the screen (not the design area), so it also covers the wide-phone margins.
    this.vignette = scene.add.image(0, 0, VIGNETTE).setOrigin(0).setScrollFactor(0).setDepth(depth + 50).setAlpha(0);
    this.fitVignette();
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.fitVignette, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off(Phaser.Scale.Events.RESIZE, this.fitVignette, this));
  }

  private fitVignette(): void { this.vignette.setDisplaySize(this.scene.scale.width, this.scene.scale.height); }

  /** Draw everything once off-screen at the start of a fight, so the first kill doesn't hitch. */
  warmUp(): void {
    this.puffs.explode(1, -4000, -4000);
    this.scene.add.image(-4000, -4000, 'ui.coin').setScale(0.32).setDepth(this.puffs.depth + 300).setAlpha(0.01);
  }

  /** Dust where a zombie falls (bigger for a boss). */
  puff(x: number, y: number, big = false): void { this.puffs.explode(big ? 22 : 8, x, y); }

  /**
   * `n` coins pop out at (x,y), hop, then fly to (tx,ty). `arrive` runs as each one lands (pulse the counter).
   */
  coins(x: number, y: number, n: number, tx: number, ty: number, arrive: () => void): void {
    for (let i = 0; i < n; i++) {
      const c = this.scene.add.image(x, y, 'ui.coin').setScale(0.32).setDepth(this.puffs.depth + 300);
      const hopX = x + Phaser.Math.Between(-40, 40), hopY = y - Phaser.Math.Between(30, 70);
      this.scene.tweens.chain({
        targets: c,
        tweens: [
          { x: hopX, y: hopY, duration: 220, ease: 'Quad.Out' },
          { x: tx, y: ty, scale: 0.5, duration: 420 + i * 60, ease: 'Cubic.In', onComplete: () => { c.destroy(); arrive(); } },
        ],
      });
    }
  }

  /**
   * Confetti thrown up from the bottom of the design area (`w` wide), over the end screen. Plain rectangles with their
   * own little physics: an idle particle emitter at this depth made some HUD textures draw black on WebGL.
   */
  confetti(w: number): void {
    const throwFrom = (x0: number, n: number, delay: number) => {
      for (let i = 0; i < n; i++) {
        const r = this.scene.add.rectangle(x0, 760, Phaser.Math.Between(8, 14), Phaser.Math.Between(12, 20), Phaser.Utils.Array.GetRandom(CONFETTI_COLORS)).setDepth(this.top);
        const vx = Phaser.Math.Between(-280, 280), vy = -Phaser.Math.Between(420, 760), spin = Phaser.Math.FloatBetween(-12, 12);
        const life = 2.2;
        this.scene.tweens.addCounter({
          from: 0, to: life, duration: life * 1000, delay,
          onUpdate: (tw) => {
            const t = tw.getValue() ?? 0;
            r.setPosition(x0 + vx * t, 760 + vy * t + 0.5 * 620 * t * t).setRotation(spin * t).setScale(Math.cos(t * 9), 1).setAlpha(t > life - 0.5 ? (life - t) / 0.5 : 1);
          },
          onComplete: () => r.destroy(),
        });
      }
    };
    throwFrom(w * 0.2, 55, 0);
    throwFrom(w * 0.8, 55, 0);
    throwFrom(w * 0.5, 45, 350);
  }

  /** Wall health 0–1: below 30% the screen edges pulse red. */
  wall(frac: number): void {
    const on = frac > 0 && frac < 0.3;
    if (on === this.danger) return;
    this.danger = on;
    this.pulse?.stop();
    this.pulse = null;
    if (on) this.pulse = this.scene.tweens.add({ targets: this.vignette, alpha: { from: 0.25, to: 0.7 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    else this.scene.tweens.add({ targets: this.vignette, alpha: 0, duration: 300 });
  }

  /** The fight is over: stop the warning. */
  calm(): void { this.danger = true; this.wall(1); }
}
