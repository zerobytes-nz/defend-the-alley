// Add-ons: the kit's "Extra" screen. Left: the loadout (4 slots; 2 open, 2 bought with gems). Right: every add-on,
// with your add-on AWIs first (free uses every level), then the 8 bought ones (25 gems each, hold up to 5).
import Phaser from 'phaser';
import { COLORS } from '../config.ts';
import { player } from '../save.ts';
import { RARITY_COLOR } from '../game/cats.ts';
import { ADDONS, ADDON_IDS, ADDON_MAX, ADDON_PRICE, AWI_ADDON_POWER, AWI_ADDON_USES, SLOTS_MAX, type AddonId } from '../game/addons.ts';
import { addonAwis, addonUnlocked, buyAddon, buySlot, slotPrice, stockOf, toggleLoadout } from '../game/progress.ts';
import { addonLevel } from '../game/unlocks.ts';
import { tappable, text } from '../ui.ts';
import { sfx } from '../systems/audio.ts';
import { ADDON_PANEL as P, SIDE_W, drawFrame, type Frame } from './menuFrame.ts';

const LIST = { x: P.x + 10, y: P.y + 10, w: P.w - 20, h: P.h - 20 };
const ROW_W = 340, ROW_H = 118, GAP = 10;

interface Item { key: string; id: AddonId; awi?: { name: string; rarity: keyof typeof AWI_ADDON_USES } }

export class AddonsScene extends Phaser.Scene {
  private frame!: Frame;
  private list!: Phaser.GameObjects.Container;
  private slots!: Phaser.GameObjects.Container;
  private dragged = false;
  private contentH = 0;

  constructor() { super('Addons'); }

  create(): void {
    this.frame = drawFrame(this, 'Addons', 'Extra', 'bg.screen-addon');
    this.slots = this.add.container(0, 0);
    this.list = this.add.container(LIST.x, LIST.y);
    this.list.setMask(this.make.graphics({}, false).fillRect(LIST.x, LIST.y, LIST.w, LIST.h).createGeometryMask());
    this.redraw();

    let startY = 0, startList = 0, down = false;
    const clampY = (y: number) => Phaser.Math.Clamp(y, Math.min(LIST.y, LIST.y + LIST.h - this.contentH), LIST.y);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.x < LIST.x || p.x > LIST.x + LIST.w || p.y < LIST.y || p.y > LIST.y + LIST.h) return;
      down = true; this.dragged = false; startY = p.y; startList = this.list.y;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!down || !p.isDown) return;
      if (Math.abs(p.y - startY) > 12) this.dragged = true;
      if (this.dragged) this.list.y = clampY(startList + p.y - startY);
    });
    this.input.on('pointerup', () => { down = false; this.time.delayedCall(0, () => { this.dragged = false; }); });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => { this.list.y = clampY(this.list.y - dy); });
  }

  private items(): Item[] {
    return [
      ...addonAwis(player.awis).map((a): Item => ({ key: a.uid, id: a.addon, awi: { name: a.name, rarity: a.rarity } })),
      ...ADDON_IDS.map((id): Item => ({ key: id, id })),
    ];
  }

  private redraw(): void {
    const y = this.list.y;
    this.drawSlots();
    this.drawList();
    this.list.y = y;
    this.frame.refreshGems();
  }

  /** The loadout column between the side menu and the panel. */
  private drawSlots(): void {
    this.slots.removeAll(true);
    const s = player.save, x = (SIDE_W + P.x) / 2 + 4, items = this.items();
    this.slots.add(text(this, x, P.y - 2, 'Take in', 22, COLORS.text, 4).setOrigin(0.5));
    for (let i = 0; i < SLOTS_MAX; i++) {
      const y = P.y + 66 + i * 108;
      if (i >= s.slots) {
        const lockImg = this.add.image(x, y, 'ui.slot-locked').setScale(0.62);
        const price = slotPrice(s);
        this.slots.add(lockImg);
        if (i === s.slots && price !== null) {
          this.slots.add([this.add.image(x - 22, y + 30, 'ui.gem').setScale(0.5), text(this, x - 6, y + 30, String(price), 22).setOrigin(0, 0.5)]);
          tappable(lockImg, () => {
            if (!buySlot(s)) { this.frame.flash(`Need ${price} gems to open this slot`); return; }
            player.persist(); sfx.buff(); this.redraw();
          });
        } else lockImg.setAlpha(0.6);
        continue;
      }
      const box = this.add.image(x, y, 'ui.addon-slot').setScale(0.62);
      this.slots.add(box);
      const key = s.loadout[i], item = items.find((it) => it.key === key);
      if (!item) { this.slots.add(text(this, x, y, 'Empty', 20, '#8a6a1a', 0).setOrigin(0.5)); continue; }
      this.slots.add([
        this.add.image(x, y - 6, `ui.addon-${item.id}`).setScale(0.6),
        text(this, x + 30, y + 32, item.awi ? `×${AWI_ADDON_USES[item.awi.rarity]}` : `${stockOf(s, item.id)}/${ADDON_MAX}`, 22).setOrigin(0.5),
      ]);
      if (item.awi) this.slots.add(this.add.rectangle(x, y - 40, 60, 6, RARITY_COLOR[item.awi.rarity]));
      tappable(box, () => { toggleLoadout(s, key); player.persist(); this.redraw(); });
    }
  }

  private drawList(): void {
    this.list.removeAll(true);
    const items = this.items();
    let y = 0;
    items.forEach((it, i) => {
      const x = (i % 2) * (ROW_W + GAP);
      if (i % 2 === 0 && i) y += ROW_H + GAP;
      this.list.add(this.row(it, x, y));
    });
    this.contentH = y + ROW_H + 6;
  }

  private row(it: Item, x: number, y: number): Phaser.GameObjects.Container {
    const s = player.save, def = ADDONS[it.id];
    const c = this.add.container(x, y);
    const on = s.loadout.includes(it.key);
    const bg = this.add.image(0, 0, 'ui.addon-row').setOrigin(0).setDisplaySize(ROW_W, ROW_H);
    c.add(bg);
    if (on) c.add(this.add.image(-4, -4, 'ui.addon-sel').setOrigin(0).setDisplaySize(ROW_W + 8, ROW_H + 8));
    c.add(this.add.image(58, 54, `ui.addon-${it.id}`).setScale(0.66));
    const name = text(this, 114, 24, it.awi ? it.awi.name : def.name, 24).setOrigin(0, 0.5);
    if (name.width > 210) name.setScale(210 / name.width);
    c.add(name);
    const blurb = this.add.text(114, 42, def.blurb, { fontFamily: '"Passion One", sans-serif', fontSize: '17px', color: COLORS.dim, wordWrap: { width: 210 } });
    c.add(blurb);
    if (it.awi) {
      const r = it.awi.rarity;
      c.add([
        this.add.rectangle(4, 6, 7, ROW_H - 12, RARITY_COLOR[r]).setOrigin(0),
        this.add.rectangle(140, 94, 52, 24, 0x2b1d14), text(this, 140, 93, 'AWI', 18, '#ffd02a', 0).setOrigin(0.5),
        text(this, 172, 94, `${r} · ${AWI_ADDON_USES[r]} free a level · ×${AWI_ADDON_POWER[r]}`, 15, COLORS.text, 3).setOrigin(0, 0.5),
      ]);
    } else if (!addonUnlocked(s, player.awis, it.id)) {
      c.setAlpha(0.6);
      c.add(text(this, 114, 94, `Clear level ${addonLevel(it.id)} to unlock`, 20, '#ffd02a', 4).setOrigin(0, 0.5));
    } else {
      const n = stockOf(s, it.id);
      c.add([this.add.image(150, 94, 'ui.addon-count').setScale(0.6), text(this, 150, 92, `${n} / ${ADDON_MAX}`, 22).setOrigin(0.5)]);
      const full = n >= ADDON_MAX, ok = !full && s.gems >= ADDON_PRICE;
      const btn = this.add.image(276, 88, 'ui.btn-yellow').setScale(0.55).setAlpha(full ? 0.5 : 1);
      c.add([btn, this.add.image(258, 84, 'ui.gem').setScale(0.48), text(this, 290, 84, full ? 'MAX' : String(ADDON_PRICE), 22, ok || full ? '#ffffff' : '#ff9a8a').setOrigin(0.5)]);
      tappable(btn, () => {
        if (this.dragged) return;
        if (full) { this.frame.flash(`You can hold ${ADDON_MAX} of each`); return; }
        if (!buyAddon(s, it.id)) { this.frame.flash(`Need ${ADDON_PRICE} gems`); return; }
        if (!s.loadout.includes(it.id) && s.loadout.length < s.slots) s.loadout.push(it.id); // first buy: equip it if there's room
        player.persist(); sfx.coin(); this.redraw();
      });
    }
    bg.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      if (this.dragged) return;
      if (!on && !it.awi && !addonUnlocked(s, player.awis, it.id)) { this.frame.flash(`Clear level ${addonLevel(it.id)} to unlock ${def.name}`); return; }
      if (!on && !it.awi && stockOf(s, it.id) === 0) { this.frame.flash('Buy one first (25 gems)'); return; }
      if (!toggleLoadout(s, it.key)) { this.frame.flash(`All ${s.slots} slots are full: tap one on the left to empty it`); return; }
      player.persist(); sfx.tap(); this.redraw();
    });
    return c;
  }
}
