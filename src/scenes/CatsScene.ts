// Cats: the kit's upgrade screen. One row per cat with a 5-step bar and a + button (gems); your AWIs first.
// Tap a row to put that cat in the deck (up to 5) or take it out. Wall and Income rows at the end.
import Phaser from 'phaser';
import { COLORS } from '../config.ts';
import { player } from '../save.ts';
import { ATTACKS, CAT_STEPS, RARITY_COLOR, catName, guestCat, upgraded, type Defender } from '../game/cats.ts';
import { buyCatStep, buyIncome, buyWall, cards, catStepCost, catUnlocked, deckOf, fightBonus, rowStepCost, toggleDeck, DECK_MAX, WALL_PER_STEP, START_PER_STEP, INCOME_PER_STEP } from '../game/progress.ts';
import { ensureLoaded, release } from '../assets.ts';
import { CAT_ORDER, catLevel } from '../game/unlocks.ts';
import { tappable, text } from '../ui.ts';
import { sfx } from '../systems/audio.ts';
import { PANEL, drawFrame, type Frame } from './menuFrame.ts';

const LIST = { x: PANEL.x + 10, y: PANEL.y + 96, w: PANEL.w - 20, h: PANEL.h - 104 };
const ROW_W = 436, ROW_H = 92, GAP = 12;

interface Row { kind: 'awi' | 'cat' | 'wall' | 'income'; def?: Defender; cat?: number }

export class CatsScene extends Phaser.Scene {
  private frame!: Frame;
  private list!: Phaser.GameObjects.Container;
  private deckBar!: Phaser.GameObjects.Container;
  private dragged = false;

  constructor() { super('Cats'); }

  create(): void {
    this.frame = drawFrame(this, 'Cats', 'Cats');
    const loading = text(this, PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h / 2, 'Loading cats…', 32).setOrigin(0.5);
    // Portraits need every cat's idle sheet; the ones not in the deck are freed again when leaving.
    const all = Array.from({ length: 15 }, (_, i) => `cat.c${i + 1}.idle`);
    void ensureLoaded(this, all).then(() => { loading.destroy(); this.build(); });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      const keep = new Set(player.deck().map((d) => `cat.c${d.cat}.idle`));
      release(this, all.filter((k) => !keep.has(k)));
    });
  }

  private build(): void {
    this.deckBar = this.add.container(0, 0);
    this.drawDeck();

    this.list = this.add.container(LIST.x, LIST.y);
    const mask = this.make.graphics({}, false).fillRect(LIST.x, LIST.y, LIST.w, LIST.h);
    this.list.setMask(mask.createGeometryMask());
    this.drawList();

    // Drag / wheel to scroll.
    let startY = 0, startList = 0, down = false;
    const minY = () => Math.min(LIST.y, LIST.y + LIST.h - this.contentH);
    const clampY = (y: number) => Phaser.Math.Clamp(y, minY(), LIST.y);
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

  private contentH = 0;

  /** The deck: 5 slots along the top of the panel. Tap one to take that cat out. */
  private drawDeck(): void {
    this.deckBar.removeAll(true);
    const deck = player.deck();
    const y = PANEL.y + 48;
    this.deckBar.add(text(this, PANEL.x + 24, y, 'Deck', 30).setOrigin(0, 0.5));
    for (let i = 0; i < DECK_MAX; i++) {
      const x = PANEL.x + 150 + i * 82, d = deck[i];
      const box = this.add.image(x, y, 'ui.cardbox').setScale(0.46).setAlpha(d ? 1 : 0.35);
      this.deckBar.add(box);
      if (!d) continue;
      this.deckBar.add([
        this.add.rectangle(x, y - 28, 52, 5, RARITY_COLOR[d.rarity]),
        this.add.image(x - 2, y + 30, `cat.c${d.cat}.idle`, 0).setOrigin(0.5, 1).setScale(0.38),
        this.add.image(x + 22, y - 18, `bullet.${d.attack}`).setScale(0.36),
      ]);
      tappable(box, () => { if (toggleDeck(player.save, player.awis, d.uid)) { player.persist(); this.redraw(); } else this.frame.flash('The deck needs at least one cat'); });
    }
    const b = fightBonus(player.save);
    this.deckBar.add(text(this, PANEL.x + 580, y - 14, 'Tap a cat to add it to the deck', 20, COLORS.dim, 4).setOrigin(0, 0.5));
    this.deckBar.add(text(this, PANEL.x + 580, y + 14, `Wall ${b.wallMax} · start ${b.startCoins} coins · ${b.income}/s`, 20, COLORS.dim, 4).setOrigin(0, 0.5));
  }

  private redraw(): void {
    const y = this.list.y;
    this.drawDeck();
    this.drawList();
    this.list.y = y;
    this.frame.refreshGems();
  }

  private drawList(): void {
    this.list.removeAll(true);
    const s = player.save, awis = player.awis;
    const rows: (Row | string)[] = [];
    const nft = cards(s, awis).filter((d) => d.source === 'nft');
    if (nft.length) { rows.push('Your AWIs (Altered World Items)'); rows.push(...nft.map((def): Row => ({ kind: 'awi', def, cat: def.cat }))); }
    rows.push('Free cats');
    rows.push(...CAT_ORDER.map((c): Row => ({ kind: 'cat', cat: c })));
    rows.push('Street');
    rows.push({ kind: 'wall' }, { kind: 'income' });

    let y = 0, col = 0;
    for (const r of rows) {
      if (typeof r === 'string') {
        if (col) { y += ROW_H + GAP; col = 0; }
        this.list.add(text(this, 6, y + 18, r, 26, '#ffd02a', 5).setOrigin(0, 0.5));
        y += 42;
        continue;
      }
      this.list.add(this.row(r, col * (ROW_W + GAP), y));
      if (++col === 2) { col = 0; y += ROW_H + GAP; }
    }
    this.contentH = y + (col ? ROW_H : 0) + 8;
  }

  private row(r: Row, x: number, y: number): Phaser.GameObjects.Container {
    const s = player.save, awis = player.awis;
    const c = this.add.container(x, y);
    const deck = deckOf(s, awis).map((d) => d.uid);
    let def: Defender | undefined = r.def, steps = 0, cost: number | null = null, title = '', sub = '';
    let locked = false, buy: () => boolean = () => false;
    if (r.kind === 'awi' || r.kind === 'cat') {
      const cat = r.cat!;
      def ??= upgraded(guestCat(cat), s.cat[cat - 1]);
      locked = r.kind === 'cat' && !catUnlocked(s, awis, cat);
      steps = s.cat[cat - 1]; cost = catStepCost(s, cat); buy = () => buyCatStep(s, cat);
      title = r.kind === 'awi' ? def.name : catName(cat);
      sub = locked ? `Clear level ${catLevel(cat)} to unlock` : `${def.rarity} · ${ATTACKS[def.attack].name} · ${def.dmg} dmg · ${def.rate}/s`;
    } else if (r.kind === 'wall') {
      steps = s.wall; cost = rowStepCost(s.wall); buy = () => buyWall(s);
      title = 'Wall'; sub = `+${WALL_PER_STEP} health a step · now ${fightBonus(s).wallMax}`;
    } else {
      steps = s.income; cost = rowStepCost(s.income); buy = () => buyIncome(s);
      title = 'Income'; sub = `+${START_PER_STEP} start coins, +${INCOME_PER_STEP}/s a step`;
    }
    const inDeck = !!def && deck.includes(def.uid);
    const bg = this.add.rectangle(0, 0, ROW_W, ROW_H, locked ? 0x4a524c : 0xf4e3c3).setOrigin(0).setStrokeStyle(inDeck ? 5 : 3, inDeck ? 0xffee00 : 0x5a3a2a);
    c.add(bg);
    if (def) {
      c.add(this.add.rectangle(3, 3, 7, ROW_H - 6, RARITY_COLOR[def.rarity]).setOrigin(0));
      const face = this.add.image(54, ROW_H - 4, `cat.c${def.cat}.idle`, 0).setOrigin(0.5, 1).setScale(0.56);
      if (locked) face.setTintFill(0x22282a);
      c.add([face, this.add.image(20, 20, `ui.badge${def.cat}`).setScale(0.62)]);
      if (!locked) c.add(this.add.image(92, 24, `bullet.${def.attack}`).setScale(0.4));
    } else c.add(this.add.image(54, ROW_H / 2, r.kind === 'wall' ? 'ui.wall' : 'ui.coin').setScale(r.kind === 'wall' ? 0.8 : 1));
    const dark = locked ? '#c9c0d8' : '#3a2a1c';
    const t = text(this, 106, 26, title, 26, locked ? '#ffffff' : '#3a2a1c', 0).setOrigin(0, 0.5);
    if (t.width > 185) t.setScale(185 / t.width);
    c.add(t);
    if (r.kind === 'awi') c.add([this.add.rectangle(106 + Math.min(185, t.width) + 26, 26, 44, 22, 0x2b1d14), text(this, 106 + Math.min(185, t.width) + 26, 25, 'AWI', 18, '#ffd02a', 0).setOrigin(0.5)]);
    const st = text(this, 106, 58, sub, 17, dark, 0).setOrigin(0, 0.5);
    if (st.width > 220) st.setScale(220 / st.width);
    c.add(st);
    if (inDeck) c.add(text(this, 106, 80, '✓ In deck', 16, '#2a8a2a', 0).setOrigin(0, 0.5));

    // Upgrade bar and + button (locked cats can be upgraded once unlocked).
    if (!locked) {
      c.add(this.add.image(336, 36, `ui.bar${Math.min(CAT_STEPS, steps)}`).setScale(0.62));
      const ok = cost !== null && s.gems >= cost;
      const plus = this.add.image(408, 34, ok ? 'ui.add' : 'ui.add-off').setScale(0.5);
      c.add(plus);
      if (cost === null) c.add(text(this, 372, 74, 'MAX', 20, '#2a8a2a', 0).setOrigin(0.5));
      else c.add([this.add.image(388, 74, 'ui.gem').setScale(0.42), text(this, 402, 74, String(cost), 20, ok ? '#3a2a1c' : '#b04a3a', 0).setOrigin(0, 0.5)]);
      tappable(plus, () => {
        if (this.dragged) return;
        if (cost === null) { this.frame.flash('Fully upgraded'); return; }
        if (!buy()) { this.frame.flash(`Need ${cost} gems: clear levels or open the daily gift`); return; }
        player.persist(); sfx.buff(); this.redraw();
      });
    }
    // Tap the row: add to / take out of the deck.
    if (def) {
      bg.setInteractive({ useHandCursor: !locked }).on('pointerup', () => {
        if (this.dragged) return;
        if (locked) { this.frame.flash(`Clear level ${catLevel(def.cat)} to unlock ${catName(def.cat)}`); return; }
        if (!toggleDeck(player.save, player.awis, def.uid)) { this.frame.flash(inDeck ? 'The deck needs at least one cat' : 'The deck is full (5): tap a cat in it to take it out'); return; }
        player.persist(); sfx.tap(); this.redraw();
      });
    }
    return c;
  }
}
