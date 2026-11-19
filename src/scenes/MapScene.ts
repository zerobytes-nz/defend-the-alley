// Level select: the kit's winding road map, dragged sideways, with the 15 levels on it (and Full Alley after).
import Phaser from 'phaser';
import { COLORS } from '../config.ts';
import { player } from '../save.ts';
import { FULL_ALLEY, LEVEL_COUNT, MAP_MARKERS, levelDef } from '../game/levels.ts';
import { levelOpen, levelsCleared } from '../game/progress.ts';
import { AREAS } from '../game/waves.ts';
import { asset } from '../assets.ts';
import { button, text } from '../ui.ts';
import { PANEL, drawFrame, startFight, type Frame } from './menuFrame.ts';

/** The map image is the kit's LevelMap at 0.5: marker positions (kit px) × this. */
const MAP_SCALE = 0.5;

export class MapScene extends Phaser.Scene {
  private frame!: Frame;
  private map!: Phaser.GameObjects.Container;
  private selected = 0;
  private info!: Phaser.GameObjects.Text;
  private markers: Phaser.GameObjects.Image[] = [];

  constructor() { super('Map'); }

  create(): void {
    this.frame = drawFrame(this, 'Map', 'Level Select');
    const s = player.save;
    this.selected = Math.min(levelsCleared(s), LEVEL_COUNT - 1);
    this.markers = [];

    // The map, clipped to the panel.
    const mapW = asset('ui.levelmap').width, mapH = asset('ui.levelmap').height;
    const top = PANEL.y + (PANEL.h - mapH) / 2;
    this.map = this.add.container(PANEL.x, top);
    this.map.add(this.add.image(0, 0, 'ui.levelmap').setOrigin(0));
    const maskShape = this.make.graphics({}, false).fillRect(PANEL.x + 4, PANEL.y + 4, PANEL.w - 8, PANEL.h - 8);
    this.map.setMask(maskShape.createGeometryMask());

    for (let n = 0; n < LEVEL_COUNT; n++) {
      const [mx, my] = MAP_MARKERS[n];
      const x = mx * MAP_SCALE, y = my * MAP_SCALE;
      const open = levelOpen(s, n), done = s.stars[n] > 0, next = open && !done;
      const img = this.add.image(x, y - 26, done ? 'ui.lvl-done' : next ? 'ui.lvl-next' : 'ui.lvl-locked').setScale(0.7);
      this.markers.push(img);
      this.map.add(img);
      if (open) this.map.add(text(this, x, y - 34, String(n + 1), 34, '#ffffff', 6).setOrigin(0.5));
      if (done) this.map.add(text(this, x, y + 22, '★★★'.slice(0, s.stars[n]) + '☆☆☆'.slice(0, 3 - s.stars[n]), 24, '#ffd02a', 5).setOrigin(0.5));
      if (levelDef(n).waves.some((w) => w.bosses.length)) this.map.add(text(this, x, y - 72, 'BOSS', 18, '#ff6a5a', 4).setOrigin(0.5));
      img.setInteractive({ useHandCursor: open });
      img.on('pointerup', () => { if (!this.dragged) this.tapLevel(n); });
    }
    this.highlight();

    // Drag (or mouse wheel) to scroll; start centred on the selected level.
    const minX = PANEL.x + PANEL.w - mapW, maxX = PANEL.x;
    const clampX = (x: number) => Phaser.Math.Clamp(x, minX, maxX);
    this.map.x = clampX(PANEL.x + PANEL.w / 2 - MAP_MARKERS[this.selected][0] * MAP_SCALE);
    const zone = this.add.zone(PANEL.x, PANEL.y, PANEL.w, PANEL.h).setOrigin(0).setInteractive();
    this.children.sendToBack(zone);
    let startX = 0, startMap = 0, down = false;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!Phaser.Geom.Rectangle.Contains(zone.getBounds(), p.x, p.y)) return;
      down = true; this.dragged = false; startX = p.x; startMap = this.map.x;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!down || !p.isDown) return;
      if (Math.abs(p.x - startX) > 12) this.dragged = true;
      if (this.dragged) this.map.x = clampX(startMap + p.x - startX);
    });
    this.input.on('pointerup', () => { down = false; this.time.delayedCall(0, () => { this.dragged = false; }); });
    this.input.on('wheel', (_p: unknown, _o: unknown, dx: number, dy: number) => { this.map.x = clampX(this.map.x - (dx || dy)); });

    // Below the panel: what's selected, PLAY, and Full Alley.
    this.info = text(this, PANEL.x, 656, '', 26, COLORS.text, 5).setOrigin(0, 0.5);
    button(this, PANEL.x + PANEL.w - 300, 656, 'PLAY', () => startFight(this, this.selected), 'ui.btn-green', 0.52, 50);
    const alleyOpen = levelOpen(s, FULL_ALLEY);
    const alley = button(this, PANEL.x + PANEL.w - 70, 656, alleyOpen ? 'Full Alley' : '🔒 Alley', () => {
      if (alleyOpen) startFight(this, FULL_ALLEY); else this.frame.flash('Full Alley opens after level 15');
    }, 'ui.btn-orange', 0.5, 40);
    if (!alleyOpen) alley.setAlpha(0.7);
    const best = s.alley;
    text(this, PANEL.x + PANEL.w + 60, 656, best ? (best.won ? `Best: won in ${Math.round(best.time)} s` : `Best: wave ${best.wave}/15`) : 'All 5 areas\nin one run', 20, COLORS.dim, 4).setOrigin(0, 0.5);
    this.showInfo();
    this.input.keyboard?.on('keydown-SPACE', () => startFight(this, this.selected));
  }

  private dragged = false;

  private tapLevel(n: number): void {
    if (!levelOpen(player.save, n)) { this.frame.flash(`Clear level ${n} first`); return; }
    if (n === this.selected) { startFight(this, n); return; }
    this.selected = n;
    this.highlight();
    this.showInfo();
  }

  private highlight(): void {
    this.markers.forEach((m, i) => { this.tweens.killTweensOf(m); m.setScale(0.7); if (i === this.selected) this.tweens.add({ targets: m, scale: 0.8, yoyo: true, repeat: -1, duration: 500 }); });
  }

  private showInfo(): void {
    const d = levelDef(this.selected);
    const stars = player.save.stars[this.selected];
    this.info.setText(`Level ${this.selected + 1} · ${AREAS[d.area].name} · ${d.waves.length} waves${stars ? `  ${'★'.repeat(stars)}` : ''}`);
  }
}

