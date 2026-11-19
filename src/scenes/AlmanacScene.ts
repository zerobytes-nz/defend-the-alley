// Almanac: every cat, add-on, zombie and boss. Unlocked cats and add-ons, and zombies already met, show their
// picture and what they do; the rest are dark until then.
import Phaser from 'phaser';
import { COLORS } from '../config.ts';
import { player } from '../save.ts';
import { ATTACKS, ROLE, catName, family, guestCat, roleOf } from '../game/cats.ts';
import { ADDONS, ADDON_IDS } from '../game/addons.ts';
import { ABILITIES, BOSSES, ENEMIES, ENEMY_NAMES } from '../game/waves.ts';
import { addonUnlocked, catUnlocked } from '../game/progress.ts';
import { CAT_ORDER, addonLevel, catLevel } from '../game/unlocks.ts';
import { asset, ensureLoaded, release } from '../assets.ts';
import { text } from '../ui.ts';
import { PANEL, drawFrame } from './menuFrame.ts';

const LIST = { x: PANEL.x + 10, y: PANEL.y + 10, w: PANEL.w - 20, h: PANEL.h - 20 };
const TILE_W = 212, TILE_H = 176, GAP = 10, PER_ROW = 4;

interface Entry { key: string; known: boolean; name: string; blurb: string; pic: string; scale: number; hint: string }

export class AlmanacScene extends Phaser.Scene {
  private list!: Phaser.GameObjects.Container;
  private contentH = 0;

  constructor() { super('Almanac'); }

  create(): void {
    drawFrame(this, 'Almanac', 'Almanac');
    const loading = text(this, PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h / 2, 'Loading…', 32).setOrigin(0.5);
    // Cat portraits and boss sheets aren't always loaded; the ones loaded here are freed when leaving.
    const before = new Set(Object.keys(this.textures.list));
    const keys = [...Array.from({ length: 15 }, (_, i) => `cat.c${i + 1}.idle`), ...Object.values(BOSSES).map((b) => `enemy.${b.key}.walk`)];
    void ensureLoaded(this, keys).then(() => { loading.destroy(); this.build(); });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      const keep = new Set(player.deck().map((d) => `cat.c${d.cat}.idle`));
      release(this, keys.filter((k) => !before.has(k) && !keep.has(k)));
    });
  }

  private entries(): (Entry | string)[] {
    const s = player.save, awis = player.awis, seen = new Set(s.seen);
    const cats = CAT_ORDER.map((c): Entry => {
      const d = guestCat(c), r = ROLE[roleOf(c)];
      return { key: `cat${c}`, known: catUnlocked(s, awis, c), name: catName(c), blurb: `${family(c).name} · ${ATTACKS[d.attack].name}: ${ATTACKS[d.attack].blurb.toLowerCase()}. ${r.name}: ${r.blurb}.`, pic: `cat.c${c}.idle`, scale: 0.62, hint: `Clear level ${catLevel(c)}` };
    });
    const addons = ADDON_IDS.map((id): Entry => ({ key: id, known: addonUnlocked(s, awis, id), name: ADDONS[id].name, blurb: ADDONS[id].blurb, pic: `ui.addon-${id}`, scale: 0.62, hint: `Clear level ${addonLevel(id)}` }));
    const zombie = (key: string, boss: boolean): Entry => {
      const t = boss ? BOSSES[Number(key.slice(4))] : ENEMIES[key];
      return { key, known: seen.has(key) || key === 'reg1', name: ENEMY_NAMES[key], blurb: t.ability ? ABILITIES[t.ability] : 'Just walks up and hits the wall.', pic: `enemy.${key}.walk`, scale: boss ? 0.34 : 0.62, hint: 'Not met yet' };
    };
    return [
      'Cats', ...cats,
      'Add-ons', ...addons,
      'Zombies', ...Object.keys(ENEMIES).map((k) => zombie(k, false)),
      'Bosses', ...Object.values(BOSSES).map((b) => zombie(b.key, true)),
    ];
  }

  private build(): void {
    this.list = this.add.container(LIST.x, LIST.y);
    this.list.setMask(this.make.graphics({}, false).fillRect(LIST.x, LIST.y, LIST.w, LIST.h).createGeometryMask());
    let y = 0, col = 0;
    for (const e of this.entries()) {
      if (typeof e === 'string') {
        if (col) { y += TILE_H + GAP; col = 0; }
        this.list.add(text(this, 6, y + 18, e, 28, '#ffd02a', 5).setOrigin(0, 0.5));
        y += 42;
        continue;
      }
      this.list.add(this.tile(e, col * (TILE_W + GAP), y));
      if (++col === PER_ROW) { col = 0; y += TILE_H + GAP; }
    }
    this.contentH = y + (col ? TILE_H : 0) + 8;

    let startY = 0, startList = 0, down = false;
    const clampY = (v: number) => Phaser.Math.Clamp(v, Math.min(LIST.y, LIST.y + LIST.h - this.contentH), LIST.y);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.x < LIST.x || p.x > LIST.x + LIST.w || p.y < LIST.y || p.y > LIST.y + LIST.h) return;
      down = true; startY = p.y; startList = this.list.y;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (down && p.isDown) this.list.y = clampY(startList + p.y - startY); });
    this.input.on('pointerup', () => { down = false; });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => { this.list.y = clampY(this.list.y - dy); });
  }

  private tile(e: Entry, x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    c.add(this.add.rectangle(0, 0, TILE_W, TILE_H, e.known ? 0xf4e3c3 : 0x3a403c).setOrigin(0).setStrokeStyle(3, e.known ? 0x5a3a2a : 0x2a302c));
    const isUi = e.pic.startsWith('ui.');
    const pic = this.add.image(TILE_W / 2, isUi ? 46 : 84, e.pic, isUi ? undefined : 0).setOrigin(0.5, isUi ? 0.5 : 1);
    pic.setScale(isUi ? e.scale : asset(e.pic).displayScale * (e.scale / 0.62) * 1.25);
    if (pic.displayHeight > 84) pic.setScale(pic.scale * (84 / pic.displayHeight));
    if (!e.known) pic.setTintFill(0x22282a);
    c.add(pic);
    const name = text(this, TILE_W / 2, 100, e.known ? e.name : '???', 22, e.known ? '#3a2a1c' : '#c9c0d8', 0).setOrigin(0.5);
    if (name.width > TILE_W - 12) name.setScale((TILE_W - 12) / name.width);
    c.add(name);
    c.add(this.add.text(TILE_W / 2, 114, e.known ? e.blurb : e.hint, { fontFamily: '"Passion One", sans-serif', fontSize: '15px', color: e.known ? '#5a4a3a' : COLORS.dim, align: 'center', wordWrap: { width: TILE_W - 14 } }).setOrigin(0.5, 0));
    return c;
  }
}
