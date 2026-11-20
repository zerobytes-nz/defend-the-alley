// Level select: the kit's winding road map, dragged sideways, with the 15 levels on it (and Full Alley after).
import Phaser from 'phaser';
import { COLORS, GAME_W } from '../config.ts';
import { centreCamera } from '../systems/wide.ts';
import { player } from '../save.ts';
import { DAILY, ENDLESS, FULL_ALLEY, GOALS, HARD_BASE, LEVEL_COUNT, MAP_MARKERS, RULES, levelDef } from '../game/levels.ts';
import { challengeToday, featureUnlocked, levelOpen, levelsCleared, starsAt } from '../game/progress.ts';
import { featureLevel } from '../game/unlocks.ts';
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
  private sub!: Phaser.GameObjects.Text;
  /** Daily or Endless picked instead of a map level (PLAY starts it). */
  private special: number | null = null;
  private specialBtns: Phaser.GameObjects.Container[] = [];
  /** Showing Hard mode (kept while the game runs). */
  private static hard = false;
  /** Level number for map position n in the current mode. */
  private id(n: number): number { return MapScene.hard ? HARD_BASE + n : n; }

  constructor() { super('Map'); }

  create(): void {
    centreCamera(this);
    const s = player.save;
    if (!featureUnlocked(s, player.awis, 'hard')) MapScene.hard = false;
    this.frame = drawFrame(this, 'Map', MapScene.hard ? 'Hard Mode' : 'Level Select');
    let firstOpen = 0;
    while (firstOpen < LEVEL_COUNT - 1 && starsAt(s, this.id(firstOpen)) > 0) firstOpen++;
    this.selected = MapScene.hard ? firstOpen : Math.min(levelsCleared(s), LEVEL_COUNT - 1);
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
      const id = this.id(n), open = levelOpen(s, id), stars = starsAt(s, id), done = stars > 0, next = open && !done;
      const img = this.add.image(x, y - 26, done ? 'ui.lvl-done' : next ? 'ui.lvl-next' : 'ui.lvl-locked').setScale(0.7);
      this.markers.push(img);
      this.map.add(img);
      if (open) this.map.add(text(this, x, y - 34, String(n + 1), 34, '#ffffff', 6).setOrigin(0.5));
      if (done) this.map.add(text(this, x, y + 22, '★★★'.slice(0, stars) + '☆☆☆'.slice(0, 3 - stars), 24, '#ffd02a', 5).setOrigin(0.5));
      const d = levelDef(id), tag = d.waves.some((w) => w.bosses.length) ? 'BOSS' : d.rule ? RULES[d.rule].name.toUpperCase() : '';
      if (tag) this.map.add(text(this, x, y - 72, tag, 18, tag === 'BOSS' ? '#ff6a5a' : '#9fd8ff', 4).setOrigin(0.5));
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
      if (!Phaser.Geom.Rectangle.Contains(zone.getBounds(), p.worldX, p.worldY)) return;
      down = true; this.dragged = false; startX = p.worldX; startMap = this.map.x;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!down || !p.isDown) return;
      if (Math.abs(p.worldX - startX) > 12) this.dragged = true;
      if (this.dragged) this.map.x = clampX(startMap + p.worldX - startX);
    });
    this.input.on('pointerup', () => { down = false; this.time.delayedCall(0, () => { this.dragged = false; }); });
    this.input.on('wheel', (_p: unknown, _o: unknown, dx: number, dy: number) => { this.map.x = clampX(this.map.x - (dx || dy)); });

    // Below the panel: what's selected, PLAY, and Full Alley.
    this.info = text(this, PANEL.x, 644, '', 26, COLORS.text, 5).setOrigin(0, 0.5);
    this.sub = text(this, PANEL.x, 676, '', 19, COLORS.dim, 4).setOrigin(0, 0.5);
    button(this, PANEL.x + PANEL.w - 300, 656, 'PLAY', () => startFight(this, this.playing()), 'ui.btn-green', 0.52, 50);
    this.special = null;
    this.specialBtns = [];
    this.modeButton(DAILY, 250, 'Daily', 'ui.btn-green', () => {
      const c = challengeToday(s, new Date());
      return c.stars ? `Today: ${'★'.repeat(c.stars)}${'☆'.repeat(3 - c.stars)}` : c.tries ? `Tries today: ${c.tries}` : 'New today, the same\nfor everyone';
    });
    this.modeButton(ENDLESS, 400, 'Endless', 'ui.btn-orange', () => (s.endless ? `Best: ${s.endless} waves` : 'How long can\nyou hold?'));
    if (featureUnlocked(s, player.awis, 'hard')) {
      const t = button(this, GAME_W - 330, 44, MapScene.hard ? 'Normal' : 'Hard mode', () => { MapScene.hard = !MapScene.hard; this.scene.restart(); }, MapScene.hard ? 'ui.btn-green' : 'ui.btn-orange', 0.42, 64);
      t.setDepth(10);
    }
    const alleyOpen = levelOpen(s, FULL_ALLEY);
    const alley = button(this, PANEL.x + PANEL.w - 70, 656, alleyOpen ? 'Full Alley' : '🔒 Alley', () => {
      if (alleyOpen) startFight(this, FULL_ALLEY); else this.frame.flash('Full Alley opens after level 15');
    }, 'ui.btn-orange', 0.5, 40);
    if (!alleyOpen) alley.setAlpha(0.7);
    const best = s.alley;
    text(this, PANEL.x + PANEL.w + 60, 656, best ? (best.won ? `Best: won in ${Math.round(best.time)} s` : `Best: wave ${best.wave}/15`) : 'All 5 areas\nin one run', 20, COLORS.dim, 4).setOrigin(0, 0.5);
    this.showInfo();
    this.input.keyboard?.on('keydown-SPACE', () => startFight(this, this.playing()));
  }

  /** The level PLAY starts. */
  private playing(): number { return this.special ?? this.id(this.selected); }

  /** Daily / Endless, in the column right of the map. */
  private modeButton(n: number, y: number, label: string, key: string, caption: () => string): void {
    const s = player.save, open = levelOpen(s, n), x = (PANEL.x + PANEL.w + GAME_W) / 2 + 4;
    const b = button(this, x, y, open ? label : `🔒 ${label}`, () => {
      if (!open) { this.frame.flash(`${label} opens after level ${featureLevel(n === DAILY ? 'daily' : 'endless')}`); return; }
      if (this.special === n) { startFight(this, n); return; }
      this.special = n;
      this.highlight();
      this.showInfo();
    }, key, 0.42, 56);
    if (!open) b.setAlpha(0.7);
    this.specialBtns.push(b);
    b.setData('mode', n);
    text(this, x, y + 34, open ? caption() : '', 19, COLORS.dim, 4).setOrigin(0.5, 0).setAlign('center');
  }

  private dragged = false;

  private tapLevel(n: number): void {
    if (!levelOpen(player.save, this.id(n))) { this.frame.flash(`Clear ${MapScene.hard ? 'Hard ' : 'level '}${n} first`); return; }
    if (n === this.selected && this.special === null) { startFight(this, this.id(n)); return; }
    this.selected = n;
    this.special = null;
    this.highlight();
    this.showInfo();
  }

  private highlight(): void {
    this.markers.forEach((m, i) => { this.tweens.killTweensOf(m); m.setScale(0.7); if (i === this.selected && this.special === null) this.tweens.add({ targets: m, scale: 0.8, yoyo: true, repeat: -1, duration: 500 }); });
    this.specialBtns.forEach((b) => { this.tweens.killTweensOf(b); b.setScale(0.42); if (b.getData('mode') === this.special) this.tweens.add({ targets: b, scale: 0.47, yoyo: true, repeat: -1, duration: 500 }); });
  }

  private showInfo(): void {
    const d = levelDef(this.playing());
    if (d.n === ENDLESS) {
      this.info.setText('Endless · all 5 areas, then Park Lane');
      this.sub.setText(`Waves keep coming until the wall falls · Best: ${player.save.endless} waves`);
    } else {
      const stars = d.n === DAILY ? challengeToday(player.save, new Date()).stars : starsAt(player.save, d.n);
      this.info.setText(`${d.title} · ${AREAS[d.area].name} · ${d.waves.length} waves${stars ? `  ${'★'.repeat(stars)}` : ''}`);
      this.sub.setText(`${d.rule ? `${RULES[d.rule].name}: ${RULES[d.rule].blurb} · ` : ''}★3: ${GOALS[d.goal]}`);
    }
    this.info.setScale(this.info.width > 510 ? 510 / this.info.width : 1);
    this.sub.setScale(this.sub.width > 510 ? 510 / this.sub.width : 1);
  }
}

