// A fight: draws the simulation (src/game/sim.ts) and turns taps into its commands.
// The sim steps at a fixed 60 Hz; this scene only creates/destroys sprites from sim events and moves them.
import Phaser from 'phaser';
import { COLORS, DEBUG, GAME_H, GAME_W, SEED, TRAY_Y } from '../config.ts';
import { addonArt, areaArt, asset, ensureLoaded, isAreaArt, release } from '../assets.ts';
import { player } from '../save.ts';
import { ATTACKS, MAX_LEVEL, RARITY_COLOR, ROLE, catName, family, guestCat, muzzleOffset, roleOf, type Defender } from '../game/cats.ts';
import { COLS, LANES, SLOT_SIZE, SLOT_X, SPAWN_X, STOP_X, WALL_BAR, WALL_X0, WALL_X1, LANE_H, LANE_TOP, laneCenter, laneFeet, slotIndex, slotLane } from '../game/layout.ts';
import { Defense, STEP, type Bullet, type Enemy, type Placed, type SimEvent, type Trap, type Unit } from '../game/sim.ts';
import { ABILITIES, AREAS, ENEMY_NAMES } from '../game/waves.ts';
import { DAILY, ENDLESS, FULL_ALLEY, GOALS, HARD_BASE, LEVEL_COUNT, RULES, dayKey, daySeed, isHard, starGoals, type LevelDef } from '../game/levels.ts';
import { addTotals, checkAchievements } from '../game/achievements.ts';
import { ADDONS, type Equipped } from '../game/addons.ts';
import { alleyGems, challengeToday, lossGems, withGemBoost, clearLevel, endlessGems, finishDaily, levelGems, spendAddons } from '../game/progress.ts';
import { FEATURES, type Feature, type Unlock } from '../game/unlocks.ts';
import { think } from '../game/bot.ts';
import { button, tappable, text } from '../ui.ts';
import { Shots, shotIcon } from '../systems/shots.ts';
import { buzz, isMuted, musicOn, sfx, soundOn, toggleMusic, toggleMute, toggleSound, toggleVibra, vibraOn } from '../systems/audio.ts';

const BOT = new URLSearchParams(location.search).has('bot');
/** Fog rule: zombies fade out beyond this x. */
const FOG_X = 860;
const FEATURE_ICON: Record<Feature, string> = { repair: 'ui.wall', cats: 'ui.icon-cat', addons: 'ui.icon-addon', merge: 'ui.up1', alley: 'ui.icon-home', hard: 'ui.up3', daily: 'ui.daily', endless: 'ui.wavebar' };
const D = { bg: 0, slot: 10, wall: 20, actors: 100, fx: 900, hud: 1000, tray: 1100, bubble: 1200, overlay: 2000 };

interface EnemyView {
  spr: Phaser.GameObjects.Sprite; bar: Phaser.GameObjects.Rectangle; barBg: Phaser.GameObjects.Rectangle; state: Enemy['state']; flashUntil: number;
  /** Bars sit this far above the feet; `lift` is a jump in progress; `shield` is drawn in front of shield zombies. */
  top: number; lift: number; lane: number; shield: Phaser.GameObjects.Ellipse | null;
}
interface CatView { spr: Phaser.GameObjects.Sprite; badge: Phaser.GameObjects.Image | null }
interface CardView { def: Defender; c: Phaser.GameObjects.Container; cost: Phaser.GameObjects.Text; glow: Phaser.GameObjects.Rectangle; afford: boolean | null }
interface UnitView { spr: Phaser.GameObjects.Sprite; bar: Phaser.GameObjects.Rectangle; fighting: boolean }
interface AddonButton { c: Phaser.GameObjects.Container; count: Phaser.GameObjects.Text; glow: Phaser.GameObjects.Rectangle; shown: number }

export class DefenseScene extends Phaser.Scene {
  private sim!: Defense;
  private acc = 0;
  private speed = 1;
  private paused = false;
  private ended = false;
  private botTimer = 0;
  /** True while the current area's art is still downloading: the sim waits. */
  private loadingArea = false;

  private bg!: Phaser.GameObjects.Image;
  private enemies = new Map<number, EnemyView>();
  private cats = new Map<number, CatView>(); // by slot
  private shots!: Shots;
  private fxPool: Phaser.GameObjects.Sprite[] = [];
  private cards: CardView[] = [];
  private selected: Defender | null = null;
  private slotTiles: Phaser.GameObjects.Rectangle[] = [];
  private wallFlash!: Phaser.GameObjects.Rectangle;
  private bubble: Phaser.GameObjects.Container | null = null;

  private coinText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private areaText!: Phaser.GameObjects.Text;
  private wallBar!: Phaser.GameObjects.Rectangle;
  private wallText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private fpsText: Phaser.GameObjects.Text | null = null;
  private shown = { coins: -1, wall: -1 };

  private levelN = 0;
  private def!: LevelDef;
  /** The add-ons as they were at the start (to take used ones off the stock afterwards). */
  private startAddons: Equipped[] = [];
  private units = new Map<number, UnitView>();
  private traps = new Map<number, Phaser.GameObjects.Image[]>();
  private addonBtns: AddonButton[] = [];
  /** An add-on waiting for a lane tap. */
  private armed = -1;
  private laneZones: Phaser.GameObjects.Rectangle[] = [];
  private repairBtn: { c: Phaser.GameObjects.Container; cost: Phaser.GameObjects.Text; shown: string } | null = null;
  private coinsX2!: Phaser.GameObjects.Text;
  /** A finger down on a square: a tap, or a drag of the cat on it (move / merge). */
  /** A card (new zombie) is up: the fight waits for it. */
  private modal = false;
  private press: { slot: number; x: number; y: number; drag: boolean } | null = null;
  /** Level 1's guided steps (null on other levels or once done). */
  private tut: { step: number; hand: Phaser.GameObjects.Text; box: Phaser.GameObjects.Container; msg: Phaser.GameObjects.Text } | null = null;

  constructor() { super('Defense'); }

  init(data: { level?: number }): void { this.levelN = data?.level ?? 0; }

  create(): void {
    const f = player.fight(this.levelN);
    this.def = f.level;
    this.startAddons = f.addons.map((a) => ({ ...a }));
    this.sim = new Defense({ ...f, seed: this.def.n === DAILY ? daySeed(dayKey(new Date())) : SEED || Math.floor(Math.random() * 1e9) });
    this.acc = 0; this.speed = 1; this.paused = false; this.ended = false; this.armed = -1;
    this.tut = null; this.press = null; this.modal = false;
    this.enemies.clear(); this.cats.clear(); this.units.clear(); this.traps.clear();
    this.fxPool = []; this.cards = []; this.slotTiles = []; this.addonBtns = []; this.laneZones = []; this.bubble = null;
    this.shown = { coins: -1, wall: -1 };
    this.shots = new Shots(this, D.fx);
    this.loadingArea = false;
    const area = this.sim.area;
    if (this.def.waves.some((w) => w.area > area)) void ensureLoaded(this, areaArt(this.def, area + 1));

    this.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.bg).setOrigin(0).setDepth(-1);
    this.bg = this.add.image(0, 0, AREAS[area].bg).setOrigin(0).setDepth(D.bg);
    if (this.def.rule === 'fog') for (let i = 0; i < 12; i++) this.add.rectangle(FOG_X - 140 + i * 30, LANE_TOP - 30, 30, GAME_H, 0xd8dde4, Math.min(0.9, 0.08 * i)).setOrigin(0).setDepth(D.fx + 4);
    this.drawSlots();
    this.drawLaneZones();
    this.drawWall();
    this.drawHud();
    this.drawTray(f.deck);
    this.drawAddons();
    if (this.def.tutorial) this.startTutorial(); else { this.selectCard(f.deck[0]); this.showTips(); }
    const rule = this.def.rule ? RULES[this.def.rule] : null;
    this.banner(this.def.n === FULL_ALLEY ? `Area 1 · ${AREAS[0].name}` : `${this.def.title} · ${AREAS[area].name}`, rule ? `${rule.name}: ${rule.blurb}` : 'Place your cats!');

    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => { if (!over.length) this.closeBubble(); });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.dragMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.dragEnd(p));
    this.input.keyboard?.on('keydown-P', () => this.togglePause());
    this.input.keyboard?.on('keydown-ESC', () => this.togglePause());
    if (DEBUG) {
      this.fpsText = text(this, 12, 108, '', 20, '#9fffa0', 4).setOrigin(0, 0.5).setDepth(D.overlay);
      (window as unknown as { __sim: Defense }).__sim = this.sim;
    }
  }

  // ── Frame ────────────────────────────────────────────────────────────────────────────────────────
  update(_time: number, delta: number): void {
    if (this.fpsText && this.game.loop.frame % 30 === 0) this.fpsText.setText(`${this.game.loop.actualFps.toFixed(0)} fps · ${this.sim.enemies.length} zombies`);
    if (this.paused || this.ended || this.loadingArea) return;
    this.acc += (Math.min(delta, 100) / 1000) * this.speed;
    while (this.acc >= STEP) {
      this.acc -= STEP;
      if (BOT && (this.botTimer = (this.botTimer + 1) % 30) === 0) think(this.sim);
      this.sim.step();
    }
    for (const e of this.sim.events) this.onEvent(e);
    this.sim.events.length = 0;
    this.sync();
  }

  private onEvent(e: SimEvent): void {
    switch (e.t) {
      case 'spawn': return this.spawnEnemy(e.enemy);
      case 'place': this.hideHint(); this.showCat(e.cat, true); return this.tutStep('place');
      case 'upgrade': this.showCat(e.cat, false); return this.tutStep('upgrade');
      case 'merge': return this.onMerge(e.from, e.cat);
      case 'move': return this.onMove(e.from, e.cat);
      case 'sell': return this.onSell(e.slot, e.coins);
      case 'switch': return this.popText(e.enemy, '⇅', '#ffd02a');
      case 'jump': { const v = this.enemies.get(e.enemy.id); if (v) this.tweens.add({ targets: v, lift: 70, yoyo: true, duration: 260, ease: 'Sine.Out' }); return; }
      case 'heal': return this.healFx(e.enemy);
      case 'ability': return this.onAbility(e.enemy, e.what);
      case 'shoot': return this.shoot(e.slot, e.bullet);
      case 'hit': return this.onHit(e.enemy, e.bullet?.id ?? -1, e.bullet?.attack ?? null, e.splash);
      case 'kill': return this.onKill(e.enemy, e.coins);
      case 'wall': return this.onWallHit(e.enemy);
      case 'wave':
        this.waveText.setText(this.def.n === ENDLESS ? `Wave ${e.wave + 1}` : `Wave ${e.wave + 1}/${e.total}`);
        if (e.boss) { this.banner('BOSS!', `${AREAS[e.area].name} boss incoming`); sfx.bossIn(); this.cameras.main.shake(300, 0.004); }
        return;
      case 'area': return this.changeArea(e.area);
      case 'end': return this.endRun(e.won);
      case 'repair': return this.onRepair();
      case 'addon': return this.onAddon(e.id);
      case 'blast': return this.onBlast(e.lane, e.x, e.r);
      case 'coins': this.coinsX2.setVisible(true); return;
      case 'unit': return this.showUnit(e.unit);
      case 'unitGone': return this.dropUnit(e.unit);
      case 'trap': return this.showTrap(e.trap);
      case 'trapGone': return this.dropTrap(e.trap);
    }
  }

  /** Move sprites to the sim's positions. */
  private sync(): void {
    const now = this.sim.time;
    for (const e of this.sim.enemies) {
      const v = this.enemies.get(e.id);
      if (!v) continue;
      v.spr.x = e.x;
      // Lane switches glide; jumps lift the sprite.
      const base = laneFeet(e.lane) + 4;
      if (v.lane !== e.lane) { v.lane = e.lane; v.spr.setDepth(D.actors + base); }
      const y = Math.abs(v.spr.y + v.lift - base) < 2 ? base : v.spr.y + v.lift + (base - v.spr.y - v.lift) * 0.15;
      v.spr.y = y - v.lift;
      if (e.state !== v.state) { v.state = e.state; v.spr.play(`enemy.${e.type.key}.${e.state}`); }
      if (now < v.flashUntil) v.spr.setTintFill(0xffffff);
      else if (now < e.slowUntil) v.spr.setTint(0x9dff8a);
      else if (e.rage > 1 || e.speedMul > 1) v.spr.setTint(0xff8a7a);
      else v.spr.clearTint();
      if (this.def.rule === 'fog') { const a = Phaser.Math.Clamp((FOG_X - e.x) / 140, 0, 1); v.spr.setAlpha(a); v.bar.setAlpha(a); v.barBg.setAlpha(a); v.shield?.setAlpha(a); }
      if (v.shield) { if (e.shield > 0) v.shield.setPosition(e.x - 30, v.spr.y - 44); else { v.shield.destroy(); v.shield = null; } }
      const show = e.hp < e.maxHp;
      v.bar.setVisible(show); v.barBg.setVisible(show);
      if (show) { v.barBg.setPosition(e.x, v.spr.y - v.top); v.bar.setPosition(e.x - v.barBg.width / 2 + 2, v.spr.y - v.top); v.bar.width = Math.max(0, (v.barBg.width - 4) * (e.hp / e.maxHp)); }
    }
    const live = new Set(this.sim.bullets.map((b) => b.id));
    for (const b of this.sim.bullets) this.shots.move(b.id, b.x);
    this.shots.prune(live);

    if (this.sim.coins !== this.shown.coins) {
      this.shown.coins = this.sim.coins;
      this.coinText.setText(String(this.sim.coins));
      for (const c of this.cards) {
        const cost = this.sim.placeCost(c.def), ok = this.sim.coins >= cost;
        c.cost.setText(String(cost));
        if (ok !== c.afford) { c.afford = ok; c.c.setAlpha(ok ? 1 : 0.55); c.cost.setColor(ok ? '#ffffff' : '#ff8a7a'); }
      }
    }
    for (const u of this.sim.units) {
      const v = this.units.get(u.id);
      if (!v) continue;
      if (u.fighting !== v.fighting) { v.fighting = u.fighting; v.spr.play(`addon.${u.kind}.${u.fighting ? 'attack' : 'idle'}`); }
      v.bar.width = 56 * Math.max(0, u.hp / u.maxHp);
    }
    if (this.tut) this.tutTick();
    if (this.coinsX2.visible && now >= this.sim.coinsUntil) this.coinsX2.setVisible(false);
    this.addonBtns.forEach((b, i) => {
      const n = this.sim.addons[i].uses;
      if (n !== b.shown) { b.shown = n; b.count.setText(String(n)); b.c.setAlpha(n > 0 ? 1 : 0.4); }
    });
    const rb = this.repairBtn, rc = this.sim.repairCost();
    const rs = rc === null ? 'full' : `${rc}`;
    if (rb && (rs !== rb.shown || (rc !== null && (this.sim.coins >= rc) !== (rb.c.alpha === 1)))) {
      rb.shown = rs;
      rb.cost.setText(rc === null ? 'Full' : String(rc));
      rb.c.setAlpha(rc !== null && this.sim.coins >= rc ? 1 : 0.5);
    }
    if (this.sim.wallHp !== this.shown.wall) {
      this.shown.wall = this.sim.wallHp;
      const f = this.sim.wallHp / this.sim.wallMax;
      this.wallBar.height = (WALL_BAR.h - 4) * f; // the bar empties from the top, like the kit's
      this.wallBar.setFillStyle(f > 0.5 ? COLORS.good : f > 0.25 ? COLORS.gold : COLORS.bad);
      this.wallText.setText(`${this.sim.wallHp}`);
    }
  }

  // ── Street ───────────────────────────────────────────────────────────────────────────────────────
  /** Tap zones on the kit's grid squares (the squares themselves are part of the street art). */
  private drawSlots(): void {
    for (let l = 0; l < LANES; l++) if (!this.sim.laneOpen(l)) {
      this.add.rectangle(0, laneCenter(l), GAME_W, LANE_H, 0x10141a, 0.62).setOrigin(0, 0.5).setDepth(D.slot - 1);
    }
    for (let l = 0; l < LANES; l++) for (let c = 0; c < COLS; c++) {
      if (!this.sim.laneOpen(l)) continue;
      const s = slotIndex(l, c);
      const tile = this.add.rectangle(SLOT_X[c], laneCenter(l), SLOT_SIZE + 10, LANE_H - 4, 0xffffff, 0)
        .setStrokeStyle(3, 0xffffff, 0).setDepth(D.slot).setInteractive({ useHandCursor: true });
      tile.on('pointerdown', (p: Phaser.Input.Pointer) => { this.press = { slot: s, x: p.x, y: p.y, drag: false }; });
      tile.setData('slot', s);
      this.slotTiles.push(tile);
    }
  }

  /** The crate wall is in the art; the game draws its health into the bar beside it and flashes it when hit. */
  private drawWall(): void {
    const b = WALL_BAR;
    this.add.rectangle(b.x, b.y, b.w, b.h, 0x1d2628).setOrigin(0).setDepth(D.wall); // covers the art's own (static) fill
    this.wallBar = this.add.rectangle(b.x + 2, b.y + b.h - 2, b.w - 4, b.h - 4, COLORS.good).setOrigin(0, 1).setDepth(D.wall + 1);
    this.wallText = text(this, b.x + b.w / 2, b.y + b.h + 34, String(this.sim.wallMax), 22).setOrigin(0.5).setDepth(D.wall + 2);
    this.wallFlash = this.add.rectangle(WALL_X0, LANE_TOP - 20, WALL_X1 - WALL_X0, LANE_H * LANES + 40, 0xff3020, 0).setOrigin(0).setDepth(D.wall + 3);
  }

  private changeArea(a: number): void {
    const art = areaArt(this.def, a);
    const loaded = art.every((k) => this.textures.exists(k));
    if (!loaded) { // slow connection: hold the run until this area's art is in
      this.loadingArea = true;
      void ensureLoaded(this, art).then(() => { this.loadingArea = false; this.changeArea(a); });
      return;
    }
    if (this.def.waves.some((w) => w.area > a)) void ensureLoaded(this, areaArt(this.def, a + 1));
    const next = this.add.image(0, 0, AREAS[a].bg).setOrigin(0).setDepth(D.bg + 1).setAlpha(0);
    const old = this.bg;
    // Free the previous area's street and bosses once its street is off screen (area 1's street stays for the next run).
    this.tweens.add({ targets: next, alpha: 1, duration: 700, onComplete: () => { old.destroy(); next.setDepth(D.bg); release(this, areaArt(this.def, a - 1).filter((k) => k !== 'bg.area1')); } });
    this.bg = next;
    this.areaText.setText(`${this.def.n === FULL_ALLEY ? 'Full Alley' : this.def.title} · ${AREAS[a].name}`);
    this.banner(`Area ${a + 1} · ${AREAS[a].name}`, 'Here they come');
    sfx.finish();
  }

  // ── Cats ─────────────────────────────────────────────────────────────────────────────────────────
  private showCat(p: Placed, isNew: boolean): void {
    const lane = slotLane(p.slot), key = `cat.c${p.def.cat}`;
    let v = this.cats.get(p.slot);
    if (!v) {
      const spr = this.add.sprite(SLOT_X[p.slot % COLS], laneFeet(lane), `${key}.idle`).setOrigin(0.5, 1)
        .setDepth(D.actors + laneFeet(lane) - 1).play(`${key}.idle`);
      spr.anims.setProgress(Math.random());
      const s = asset(`${key}.idle`).displayScale;
      spr.setScale(s * 0.3);
      this.tweens.add({ targets: spr, scale: s, duration: 260, ease: 'Back.Out' });
      v = { spr, badge: null };
      this.cats.set(p.slot, v);
    }
    if (p.level > 1) {
      v.badge?.destroy();
      v.badge = this.add.image(v.spr.x - 30, v.spr.y - 62, `ui.up${Math.min(3, p.level - 1)}`).setScale(0.42).setDepth(D.actors + 900);
      const s = asset(`${key}.idle`).displayScale;
      this.tweens.killTweensOf(v.spr);
      v.spr.setScale(s);
      this.tweens.add({ targets: v.spr, scaleY: s * 1.12, yoyo: true, duration: 120 });
      this.fx(v.spr.x, v.spr.y - 34, 0.35);
      sfx.buff();
    } else if (isNew) sfx.place();
  }

  private shoot(slot: number, bullet: Bullet): void {
    const p = this.sim.slots[slot], v = this.cats.get(slot);
    if (!p || !v) return;
    const key = `cat.c${p.def.cat}`, attack = bullet.attack, bulletId = bullet.id;
    const cross = bullet.lane !== slotLane(slot);
    if (!cross) v.spr.play(`${key}.shoot`).chain(`${key}.idle`);
    const [mx, my] = muzzleOffset(p.def.cat);
    const x = v.spr.x + mx, y = v.spr.y + my;
    const flash = this.fx(x, y, asset('fx.muzzle').displayScale, 'fx.muzzle');
    flash.setOrigin(0.1, 0.5);
    const b = this.shots.add(bulletId, attack, x + 10, y, D.fx);
    if (cross) { flash.setVisible(false); this.tweens.add({ targets: b, y: y + (laneFeet(bullet.lane) - laneFeet(slotLane(slot))), duration: 140 }); } // a Blaster's second shot
    if (!cross) sfx.pew(attack);
  }

  // ── Dragging cats: move to a free square, or drop on the same cat to merge ────────────────────────
  private dragMove(p: Phaser.Input.Pointer): void {
    const pr = this.press;
    if (!pr || !p.isDown || this.ended || this.paused) return;
    const v = this.cats.get(pr.slot);
    if (!v) return;
    if (!pr.drag && Math.hypot(p.x - pr.x, p.y - pr.y) > 18) { pr.drag = true; this.closeBubble(); v.spr.setAlpha(0.75).setDepth(D.bubble - 1); this.markDrops(pr.slot); }
    if (pr.drag) { v.spr.setPosition(p.x, p.y + 40); v.badge?.setPosition(p.x - 30, p.y - 22); }
  }

  private dragEnd(p: Phaser.Input.Pointer): void {
    const pr = this.press;
    this.press = null;
    if (!pr) return;
    if (!pr.drag) { this.tapSlot(pr.slot); return; }
    this.markDrops(-1);
    const to = this.slotTiles.find((t) => t.getBounds().contains(p.x, p.y))?.getData('slot') as number | undefined;
    const ok = to !== undefined && (this.sim.canMergeInto(pr.slot, to) ? this.sim.merge(pr.slot, to) : this.sim.move(pr.slot, to));
    if (!ok) {
      if (to !== undefined && to !== pr.slot) {
        const a = this.sim.slots[pr.slot], b = this.sim.slots[to];
        if (b && a && b.def.uid === a.def.uid && !this.sim.canMerge) this.flashHint('Merging unlocks after level 6');
        else if (b && a && b.def.uid === a.def.uid && b.level !== a.level) this.flashHint('Only cats of the same level merge');
        else if (b) this.flashHint('Drop on a free square, or on the same cat to merge');
        else if (a && this.sim.time < a.moveAt) this.flashHint('Just moved: wait a moment');
      }
      this.placeCatSprite(pr.slot); // back where it was
    }
  }

  /** Light up where the dragged cat can go: free squares (white), the same cat to merge with (yellow). */
  private markDrops(from: number): void {
    for (const t of this.slotTiles) {
      const s = t.getData('slot') as number;
      const merge = from >= 0 && this.sim.canMergeInto(from, s), free = from >= 0 && !this.sim.slots[s];
      t.setStrokeStyle(4, merge ? 0xffee00 : 0xffffff, merge ? 0.95 : free ? 0.45 : 0);
    }
  }

  /** Put a cat's sprite (and badge) on its square. */
  private placeCatSprite(slot: number): void {
    const v = this.cats.get(slot);
    if (!v) return;
    const lane = slotLane(slot);
    this.tweens.killTweensOf(v.spr);
    v.spr.setScale(asset(`cat.c${this.sim.slots[slot]?.def.cat ?? 1}.idle`).displayScale);
    v.spr.setAlpha(1).setPosition(SLOT_X[slot % COLS], laneFeet(lane)).setDepth(D.actors + laneFeet(lane) - 1);
    v.badge?.setPosition(v.spr.x - 30, v.spr.y - 62);
  }

  private onMove(from: number, p: Placed): void {
    const v = this.cats.get(from);
    if (!v) return;
    this.cats.delete(from);
    this.cats.set(p.slot, v);
    this.placeCatSprite(p.slot);
    sfx.place();
  }

  private onMerge(from: number, p: Placed): void {
    const v = this.cats.get(from);
    this.cats.delete(from);
    if (v) { v.badge?.destroy(); v.spr.destroy(); }
    this.placeCatSprite(p.slot);
    this.showCat(p, false); // level badge, pop and sound
    const t = text(this, SLOT_X[p.slot % COLS], laneFeet(slotLane(p.slot)) - 110, 'Merged!', 26, '#ffee00', 5).setOrigin(0.5).setDepth(D.fx + 5);
    this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  private onSell(slot: number, coins: number): void {
    const v = this.cats.get(slot);
    if (!v) return;
    this.cats.delete(slot);
    v.badge?.destroy();
    this.tweens.add({ targets: v.spr, alpha: 0, scale: v.spr.scale * 0.4, duration: 220, onComplete: () => v.spr.destroy() });
    const t = text(this, v.spr.x, v.spr.y - 84, `+${coins}`, 26, '#ffd02a', 5).setOrigin(0.5).setDepth(D.fx + 5);
    this.tweens.add({ targets: t, y: t.y - 50, alpha: 0, duration: 700, onComplete: () => t.destroy() });
    sfx.coin();
  }

  // ── Enemies ──────────────────────────────────────────────────────────────────────────────────────
  private spawnEnemy(e: Enemy): void {
    const key = `enemy.${e.type.key}`;
    const y = laneFeet(e.lane);
    const spr = this.add.sprite(e.x, y + 4, `${key}.walk`).setOrigin(0.5, 1).setScale(asset(`${key}.walk`).displayScale)
      .setDepth(D.actors + y + (e.type.boss ? 0.5 : 0)).play(`${key}.walk`);
    spr.anims.setProgress(Math.random());
    if (e.child) spr.setScale(spr.scale * 0.72);
    const w = e.type.boss ? 90 : 48, dy = e.type.boss ? 150 : e.child ? 70 : 92, top = y - dy;
    const barBg = this.add.rectangle(e.x, top, w, e.type.boss ? 12 : 8, 0x000000, 0.65).setDepth(D.fx + 1).setVisible(false);
    const bar = this.add.rectangle(e.x, top, w - 4, e.type.boss ? 8 : 4, e.type.boss ? 0xff5040 : 0x8cff6a).setOrigin(0, 0.5).setDepth(D.fx + 2).setVisible(false);
    const shield = e.shield > 0 ? this.add.ellipse(e.x - 30, y - 40, 16, 64, 0x6ad0ff, 0.45).setStrokeStyle(2, 0xbfeaff, 0.9).setDepth(D.fx) : null;
    this.enemies.set(e.id, { spr, bar, barBg, state: 'walk', flashUntil: 0, top: dy, lift: 0, lane: e.lane, shield });
    if (e.type.boss || e.x < SPAWN_X - 10) { spr.setAlpha(0); this.tweens.add({ targets: spr, alpha: 1, duration: 400 }); } // bosses, summoned and split zombies fade in
    this.meet(e);
  }

  /** A short word or symbol rising from a zombie. */
  private popText(e: Enemy, s: string, color: string, size = 26): void {
    const v = this.enemies.get(e.id);
    const t = text(this, e.x, (v?.spr.y ?? laneFeet(e.lane)) - (v?.top ?? 92) - 20, s, size, color, 5).setOrigin(0.5).setDepth(D.fx + 6);
    this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  private healFx(e: Enemy): void {
    const v = this.enemies.get(e.id);
    const ring = this.add.circle(e.x, (v?.spr.y ?? laneFeet(e.lane)) - 40, 20, 0x6aff6a, 0.25).setStrokeStyle(3, 0x8cff6a, 0.8).setDepth(D.fx);
    this.tweens.add({ targets: ring, radius: 190, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
  }

  private onAbility(e: Enemy, what: 'summon' | 'charge' | 'enrage' | 'shieldBreak'): void {
    if (what === 'shieldBreak') { this.popText(e, 'Shield broken!', '#9fdcff', 22); sfx.thud(); return; }
    this.popText(e, what === 'summon' ? 'Help me!' : what === 'charge' ? 'CHARGE!' : 'ENRAGED!', '#ff6a5a', 32);
    if (what !== 'summon') this.cameras.main.shake(200, 0.004);
    sfx.bossIn();
  }

  /** The first time a zombie or boss type shows up: a card explaining it (plain zombies just count as seen). */
  private meet(e: Enemy): void {
    const s = player.save, key = e.type.key;
    if (e.child || s.seen.includes(key)) return;
    s.seen.push(key);
    player.persist();
    if (key === 'reg1' || this.ended) return;
    this.paused = true; this.modal = true;
    this.anims.pauseAll();
    const cx = GAME_W / 2, cy = 360;
    const shade = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0).setInteractive();
    const card = this.add.rectangle(cx, cy, 560, 380, 0xf4e3c3).setStrokeStyle(5, e.type.boss ? 0xff5040 : 0x8cff6a);
    const head = text(this, cx, cy - 214, e.type.boss ? 'NEW BOSS!' : 'NEW ZOMBIE!', 40, e.type.boss ? '#ff6a5a' : '#8cff6a', 7).setOrigin(0.5);
    const pic = this.add.image(cx, cy + 20, `enemy.${key}.walk`, 0).setOrigin(0.5, 1).setScale(asset(`enemy.${key}.walk`).displayScale * (e.type.boss ? 1.3 : 2.4));
    const name = text(this, cx, cy + 56, ENEMY_NAMES[key] ?? key, 34, '#3a2a1c', 0).setOrigin(0.5);
    const blurb = this.add.text(cx, cy + 86, e.type.ability ? ABILITIES[e.type.ability] : '', { fontFamily: '"Passion One", sans-serif', fontSize: '23px', color: '#5a4a3a', align: 'center', wordWrap: { width: 500 } }).setOrigin(0.5, 0);
    const box = this.add.container(0, 0, [shade, card, head, pic, name, blurb]).setDepth(D.overlay + 4);
    const close = () => { box.destroy(); this.paused = false; this.modal = false; this.anims.resumeAll(); };
    box.add(button(this, cx, cy + 228, 'Got it', close, 'ui.btn-green', 0.55, 38));
    if (BOT) this.time.delayedCall(800, close);
  }

  private onHit(e: Enemy, bulletId: number, attack: Defender['attack'] | null, splash: boolean): void {
    const v = this.enemies.get(e.id);
    if (v) v.flashUntil = this.sim.time + 0.06;
    if (splash) return;
    this.shots.hit(bulletId);
    if (this.shots.has(bulletId) && !this.sim.bullets.some((x) => x.id === bulletId)) this.shots.remove(bulletId);
    if (attack === 'blast') { this.fx(e.x - 8, laneFeet(e.lane) - 34, 0.45); sfx.boom(); }
  }

  private onKill(e: Enemy, coins: number): void {
    const v = this.enemies.get(e.id);
    if (!v) return;
    this.enemies.delete(e.id);
    v.bar.destroy(); v.barBg.destroy(); v.shield?.destroy();
    v.spr.clearTint().play(`enemy.${e.type.key}.dead`);
    v.spr.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.tweens.add({ targets: v.spr, alpha: 0, duration: 250, onComplete: () => v.spr.destroy() }));
    const t = text(this, e.x, laneFeet(e.lane) - 84, `+${coins}`, e.type.boss ? 38 : 26, '#ffd02a', 5).setOrigin(0.5).setDepth(D.fx + 5);
    this.tweens.add({ targets: t, y: t.y - 50, alpha: 0, duration: 700, onComplete: () => t.destroy() });
    if (e.type.boss) { this.fx(e.x, laneFeet(e.lane) - 60, 0.9); this.cameras.main.shake(250, 0.006); sfx.boom(); }
    sfx.coin();
  }

  private onWallHit(e: Enemy): void {
    sfx.thud();
    buzz(e.type.boss ? 60 : 25);
    this.wallFlash.setFillStyle(0xff3020, 0.35);
    this.tweens.add({ targets: this.wallFlash, fillAlpha: 0, duration: 160 });
    if (e.type.boss) this.cameras.main.shake(120, 0.003);
  }

  /** A pooled one-shot effect sprite. */
  private fx(x: number, y: number, scale: number, key = 'fx.explosion'): Phaser.GameObjects.Sprite {
    let s = this.fxPool.find((f) => !f.active);
    if (!s) { s = this.add.sprite(0, 0, key); this.fxPool.push(s); s.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s!.setActive(false).setVisible(false)); }
    s.setTexture(key).setOrigin(0.5).setPosition(x, y).setScale(scale).setDepth(D.fx + 3).setActive(true).setVisible(true).play(key);
    return s;
  }

  // ── HUD and tray ─────────────────────────────────────────────────────────────────────────────────
  /** HUD on the top sidewalk, cards on the bottom one, like the kit's own screens. */
  private drawHud(): void {
    this.add.image(118, 46, 'ui.coinbar').setDepth(D.hud);
    this.add.image(44, 46, 'ui.coin').setScale(0.85).setDepth(D.hud + 1);
    this.coinText = text(this, 128, 44, '0', 34).setOrigin(0.5).setDepth(D.hud + 2);
    const where = this.def.n === FULL_ALLEY ? 'Full Alley' : this.def.title;
    this.areaText = text(this, 240, 46, `${where} · ${AREAS[this.sim.area].name}`, 30).setOrigin(0, 0.5).setDepth(D.hud);
    this.add.image(GAME_W - 270, 46, 'ui.wavebar').setDepth(D.hud);
    this.waveText = text(this, GAME_W - 250, 44, this.def.n === ENDLESS ? 'Wave 0' : `Wave 0/${this.sim.totalWaves}`, 28).setOrigin(0.5).setDepth(D.hud + 1);
    this.coinsX2 = text(this, 128, 96, 'Coins ×2', 24, '#ffd02a', 5).setOrigin(0.5).setDepth(D.hud + 2).setVisible(false);
    const spd = text(this, GAME_W - 132, 46, '×1', 34).setOrigin(0.5).setDepth(D.hud);
    tappable(spd, () => { this.speed = this.speed === 1 ? 2 : 1; spd.setText(`×${this.speed}`); });
    const pause = this.add.image(GAME_W - 52, 46, 'ui.settings').setScale(0.62).setDepth(D.hud);
    tappable(pause, () => this.togglePause());
    this.hint = text(this, GAME_W / 2, 104, 'Pick a cat card, then tap a square by the wall', 26, COLORS.text, 5).setOrigin(0.5).setDepth(D.hud);
  }

  private drawTray(deck: Defender[]): void {
    const gap = 112, x0 = GAME_W - 70 - (deck.length - 1) * gap;
    deck.forEach((def, i) => {
      const x = x0 + i * gap;
      const glow = this.add.rectangle(0, 0, 108, 108, 0xffffff, 0.9).setVisible(false);
      const box = this.add.image(0, 0, 'ui.cardbox').setScale(0.62);
      const stripe = this.add.rectangle(0, -38, 76, 6, RARITY_COLOR[def.rarity]);
      const cat = this.add.image(-2, 28, `cat.c${def.cat}.idle`, 0).setOrigin(0.5, 1).setScale(0.5);
      const bullet = shotIcon(this, 30, -24, def.attack, 30);
      const coin = this.add.image(-16, 44, 'ui.coin').setScale(0.3);
      const cost = text(this, 2, 42, '', 22, COLORS.text, 4).setOrigin(0, 0.5);
      const c = this.add.container(x, TRAY_Y, [glow, box, stripe, cat, bullet, coin, cost]).setSize(100, 100).setDepth(D.tray);
      tappable(c, () => this.selectCard(def));
      this.cards.push({ def, c, cost, glow, afford: null });
    });
  }

  private selectCard(def: Defender): void {
    this.selected = def;
    this.tutStep('card');
    this.closeBubble();
    for (const c of this.cards) {
      const on = c.def === def;
      c.glow.setVisible(on);
      this.tweens.add({ targets: c.c, y: TRAY_Y - (on ? 10 : 0), duration: 120 });
    }
  }

  private tapSlot(slot: number): void {
    if (this.ended || this.paused) return;
    this.disarm();
    const placed = this.sim.slots[slot];
    if (placed) { this.openBubble(placed); return; }
    this.closeBubble();
    if (!this.selected) { this.flashHint('Tap a cat card first'); return; }
    const cost = this.sim.placeCost(this.selected);
    if (this.sim.coins < cost) { this.flashHint(`Need ${cost} coins`); return; }
    this.sim.place(slot, this.selected);
  }

  private hideHint(): void {
    if (this.hint.visible && this.hint.alpha === 1) this.tweens.add({ targets: this.hint, alpha: 0, duration: 400, onComplete: () => this.hint.setVisible(false) });
  }

  private flashHint(s: string): void {
    this.hint.setText(s).setVisible(true).setAlpha(1).setColor('#ff9a8a');
    this.tweens.killTweensOf(this.hint);
    this.tweens.add({ targets: this.hint, alpha: 0, delay: 900, duration: 400, onComplete: () => this.hint.setVisible(false) });
    sfx.hurt();
  }

  /** Tap a placed cat: a bubble above it shows its stats and an upgrade button. */
  private openBubble(p: Placed): void {
    this.closeBubble();
    const v = this.cats.get(p.slot);
    if (!v) return;
    const cost = this.sim.upgradeCost(p);
    const x = v.spr.x + 170, y = Math.max(86, v.spr.y - 70);
    const role = ROLE[roleOf(p.def.cat)], sell = this.sim.sellValue(p);
    const bg = this.add.rectangle(0, 0, 320, 150, 0x16131d, 0.92).setStrokeStyle(3, RARITY_COLOR[p.def.rarity]);
    const title = text(this, 0, -52, `${p.def.name} · Lv ${p.level}`, 26).setOrigin(0.5);
    if (title.width > 300) title.setScale(300 / title.width);
    const stats = text(this, 0, -22, `${this.sim.dmgOf(p)} dmg · ${p.def.rate}/s · ${ATTACKS[p.def.attack].name}`, 20, COLORS.dim, 3).setOrigin(0.5);
    const roleT = text(this, 0, 2, `${role.name}: ${role.blurb}`, 17, '#9fd8ff', 3).setOrigin(0.5);
    if (roleT.width > 300) roleT.setScale(300 / roleT.width);
    const items: Phaser.GameObjects.GameObject[] = [bg, title, stats, roleT];
    const upX = -50, by = 44;
    if (cost !== null) {
      const ok = this.sim.coins >= cost;
      const btn = this.add.rectangle(upX, by, 196, 40, ok ? COLORS.good : 0x666666).setStrokeStyle(3, 0x2b1d14);
      const lbl = text(this, upX, by - 2, `⬆ Upgrade  ${cost}`, 22).setOrigin(0.5);
      items.push(btn, lbl);
      btn.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        if (this.sim.upgrade(p.slot)) this.closeBubble(); else this.flashHint(`Need ${cost} coins`);
      });
    } else items.push(text(this, upX, by, `Max level (${MAX_LEVEL})`, 22, '#ffd02a', 3).setOrigin(0.5));
    if (!this.def.tutorial) {
      const sb = this.add.rectangle(104, by, 96, 40, 0x8a4a2a).setStrokeStyle(3, 0x2b1d14);
      items.push(sb, text(this, 104, by - 2, `Sell ${sell}`, 20).setOrigin(0.5));
      sb.setInteractive({ useHandCursor: true }).on('pointerup', () => { this.sim.sell(p.slot); this.closeBubble(); });
    }
    this.bubble = this.add.container(x, y, items).setDepth(D.bubble).setSize(320, 150);
    if (this.tut?.step === 6 && cost !== null) this.pointAt(x + upX, y + by - 18);
    bg.setInteractive(); // swallow taps on the bubble itself
    this.time.delayedCall(4000, () => { if (this.bubble?.getData('slot') === p.slot) this.closeBubble(); });
    this.bubble.setData('slot', p.slot);
  }

  private closeBubble(): void { this.bubble?.destroy(); this.bubble = null; }

  private banner(title: string, sub: string): void {
    const y = 300;
    const rib = this.add.image(GAME_W / 2, y, 'ui.ribbon').setDepth(D.overlay - 10);
    const t = text(this, GAME_W / 2, y - 14, title, 46, '#ffffff', 8).setOrigin(0.5).setDepth(D.overlay - 9);
    if (t.width > 400) t.setScale(400 / t.width);
    const s = text(this, GAME_W / 2, y + 70, sub, 30, '#ffd02a', 6).setOrigin(0.5).setDepth(D.overlay - 9);
    const all = [rib, t, s];
    for (const o of all) o.setAlpha(0);
    this.tweens.add({ targets: all, alpha: 1, duration: 200, yoyo: true, hold: 1300, onComplete: () => all.forEach((o) => o.destroy()) });
  }

  // ── Tutorial (level 1) and one-time tips ───────────────────────────────────────────────────────────
  private startTutorial(): void {
    const msg = text(this, 0, 0, '', 28, '#ffffff', 5).setOrigin(0.5);
    const box = this.add.container(GAME_W / 2, 168, [this.add.rectangle(0, 0, 760, 74, 0x16131d, 0.88).setStrokeStyle(3, 0xffd02a), msg]).setDepth(D.bubble + 10);
    const hand = text(this, 0, 0, '👇', 64, '#ffffff', 0).setOrigin(0.5, 1).setDepth(D.bubble + 11);
    this.tweens.add({ targets: hand, y: '+=14', yoyo: true, repeat: -1, duration: 380, ease: 'Sine.InOut' });
    this.tut = { step: 0, hand, box, msg };
    this.hint.setVisible(false);
    this.tutShow();
  }

  /** Point the hand at (x, y) from above. */
  private pointAt(x: number, y: number): void {
    if (!this.tut) return;
    this.tweens.killTweensOf(this.tut.hand);
    this.tut.hand.setVisible(true).setPosition(x, y);
    this.tweens.add({ targets: this.tut.hand, y: y + 14, yoyo: true, repeat: -1, duration: 380, ease: 'Sine.InOut' });
  }

  private tutShow(): void {
    const t = this.tut;
    if (!t) return;
    const card = this.cards[0]?.c, square = (lane: number) => [SLOT_X[1], laneCenter(lane) - 30] as const;
    const say = (s: string) => { t.msg.setText(s); if (t.msg.width > 730) t.msg.setScale(730 / t.msg.width); else t.msg.setScale(1); };
    t.hand.setVisible(false);
    switch (t.step) {
      case 0: say('Tap the cat card'); if (card) this.pointAt(card.x, TRAY_Y - 50); break;
      case 1: say('Now tap a square by the wall'); this.pointAt(...square(2)); break;
      case 2: say('Zombies! Your cat shoots along its lane. Each zombie drops coins.'); break;
      case 3: say('Zombies come down every lane: put a cat in this one too'); this.pointAt(...square(1)); break;
      case 4: say('And one in the last lane'); this.pointAt(...square(3)); break;
      case 5: say('Good! Coins keep coming in, a few every second.'); break;
      case 6: { say('Tap one of your cats to upgrade it'); const v = this.cats.get(slotIndex(2, 1)) ?? [...this.cats.values()][0]; if (v) this.pointAt(v.spr.x, v.spr.y - 66); break; }
      case 7:
        say('Upgraded! Now hold the street.');
        this.time.delayedCall(3000, () => this.endTutorial());
        break;
    }
  }

  /** Something happened that may finish the current step. */
  private tutStep(what: 'card' | 'place' | 'upgrade'): void {
    const t = this.tut;
    if (!t) return;
    const next = (t.step === 0 && what === 'card') || ((t.step === 1 || t.step === 3 || t.step === 4) && what === 'place') || (t.step === 6 && what === 'upgrade');
    if (next) { t.step++; this.tutShow(); }
  }

  /** Steps that wait on coins. */
  private tutTick(): void {
    const t = this.tut!;
    if (t.step === 2 && this.sim.stats.kills > 0 && this.selected && this.sim.coins >= this.sim.placeCost(this.selected)) { t.step = 3; this.tutShow(); }
    else if (t.step === 5 && this.sim.coins >= 35) { t.step = 6; this.tutShow(); }
  }

  private endTutorial(): void {
    const t = this.tut;
    if (!t) return;
    this.tut = null;
    this.tweens.killTweensOf(t.hand);
    this.tweens.add({ targets: [t.box, t.hand], alpha: 0, duration: 400, onComplete: () => { t.box.destroy(); t.hand.destroy(); } });
  }

  /** The first fight with Repair or add-ons explains them once. */
  private showTips(): void {
    const s = player.save, tips: [string, string, number, number][] = [];
    if (this.repairBtn && !s.tips.includes('repair')) tips.push(['repair', 'New: Repair Wall. Tap it to fix a quarter of the wall (costs coins).', this.repairBtn.c.x, TRAY_Y - 60]);
    const a = this.addonBtns[0];
    if (a && !s.tips.includes('addons')) tips.push(['addons', 'Add-ons: tap one, then tap a lane. Big Bomb and Coins ×2 go off at once.', a.c.x, TRAY_Y - 60]);
    if (!tips.length) return;
    for (const [k] of tips) s.tips.push(k);
    player.persist();
    tips.forEach(([, msg, x, y], i) => this.time.delayedCall(2000 + i * 5500, () => {
      if (this.ended) return;
      const m = text(this, GAME_W / 2, 168, msg, 26, '#ffd02a', 5).setOrigin(0.5).setDepth(D.bubble + 10);
      if (m.width > 1100) m.setScale(1100 / m.width);
      const hand = text(this, x, y, '👇', 56, '#ffffff', 0).setOrigin(0.5, 1).setDepth(D.bubble + 11);
      this.tweens.add({ targets: hand, y: y + 12, yoyo: true, repeat: 6, duration: 380 });
      this.tweens.add({ targets: [m, hand], alpha: 0, delay: 4800, duration: 400, onComplete: () => { m.destroy(); hand.destroy(); } });
    }));
  }

  // ── Repair and add-ons ───────────────────────────────────────────────────────────────────────────
  /** Bottom left, beside the cards: Repair Wall, then one button per equipped add-on. */
  private drawAddons(): void {
    this.repairBtn = null;
    const x0 = this.sim.canRepair ? 196 : 80;
    this.sim.addons.forEach((a, i) => this.addonButton(a, i, x0 + i * 108));
    if (!this.sim.canRepair) return;
    const cost = text(this, 0, 40, '', 22).setOrigin(0.5);
    const c = this.add.container(80, TRAY_Y, [
      this.add.image(0, 0, 'ui.addon-slot').setScale(0.62),
      this.add.image(0, -8, 'ui.wall').setScale(0.8),
      this.add.image(-20, 40, 'ui.coin').setScale(0.28), cost,
    ]).setSize(94, 94).setDepth(D.tray);
    cost.setX(8);
    this.repairBtn = { c, cost, shown: '' };
    tappable(c, () => {
      this.disarm();
      const rc = this.sim.repairCost();
      if (rc === null) { this.flashHint('The wall is fine'); return; }
      if (!this.sim.repair()) this.flashHint(`Need ${rc} coins to repair`);
    });
    text(this, 80, TRAY_Y - 58, 'Repair', 18, COLORS.text, 4).setOrigin(0.5).setDepth(D.tray);
  }

  private addonButton(a: Equipped, i: number, x: number): void {
    const glow = this.add.rectangle(0, 0, 100, 100, 0xffee00, 0.85).setVisible(false);
    const count = text(this, 30, 32, String(a.uses), 26).setOrigin(0.5);
    const items: Phaser.GameObjects.GameObject[] = [glow, this.add.image(0, 0, 'ui.addon-slot').setScale(0.62), this.add.image(0, -4, `ui.addon-${a.id}`).setScale(0.56), count];
    if (a.awi) items.push(this.add.rectangle(0, -40, 56, 6, 0xffd02a), text(this, -26, 32, 'AWI', 16, '#ffd02a', 4).setOrigin(0.5));
    const c = this.add.container(x, TRAY_Y, items).setSize(94, 94).setDepth(D.tray);
    tappable(c, () => this.tapAddon(i));
    this.addonBtns.push({ c, count, glow, shown: -1 });
  }

  private drawLaneZones(): void {
    const x0 = STOP_X - 20;
    for (let l = 0; l < LANES; l++) {
      if (!this.sim.laneOpen(l)) { this.laneZones.push(this.add.rectangle(0, 0, 1, 1).setVisible(false)); continue; }
      const z = this.add.rectangle(x0, laneCenter(l), GAME_W - x0, LANE_H - 6, 0xffee00, 0).setOrigin(0, 0.5)
        .setStrokeStyle(3, 0xffee00, 0).setDepth(D.fx - 1);
      z.on('pointerover', () => { if (this.armed >= 0) z.setFillStyle(0xffee00, 0.22); });
      z.on('pointerout', () => { if (this.armed >= 0) z.setFillStyle(0xffee00, 0.08); });
      z.on('pointerup', () => this.fireAddon(l));
      this.laneZones.push(z);
    }
  }

  private tapAddon(i: number): void {
    if (this.ended || this.paused) return;
    const a = this.sim.addons[i];
    if (a.uses <= 0) { this.flashHint(`No ${ADDONS[a.id].name} left`); return; }
    if (this.armed === i) { this.disarm(); return; }
    this.closeBubble();
    if (!ADDONS[a.id].lane) { this.sim.useAddon(i); return; }
    this.disarm();
    this.armed = i;
    this.addonBtns[i].glow.setVisible(true);
    for (const z of this.laneZones.filter((z) => z.visible)) z.setInteractive({ useHandCursor: true }).setFillStyle(0xffee00, 0.08).setStrokeStyle(3, 0xffee00, 0.6);
    this.hint.setText(`${ADDONS[a.id].name}: tap a lane`).setVisible(true).setAlpha(1).setColor('#ffd02a');
    this.tweens.killTweensOf(this.hint);
  }

  private fireAddon(lane: number): void {
    const i = this.armed;
    if (i < 0) return;
    this.disarm();
    this.sim.useAddon(i, lane);
  }

  private disarm(): void {
    if (this.armed < 0) return;
    this.addonBtns[this.armed]?.glow.setVisible(false);
    this.armed = -1;
    for (const z of this.laneZones) z.disableInteractive().setFillStyle(0xffee00, 0).setStrokeStyle(3, 0xffee00, 0);
    this.hint.setVisible(false);
  }

  private onRepair(): void {
    sfx.buff();
    const g = this.add.rectangle(WALL_X0, LANE_TOP - 20, WALL_X1 - WALL_X0, LANE_H * LANES + 40, 0x6aff6a, 0.4).setOrigin(0).setDepth(D.wall + 3);
    this.tweens.add({ targets: g, alpha: 0, duration: 450, onComplete: () => g.destroy() });
    const t = text(this, WALL_BAR.x, LANE_TOP - 10, 'Repaired!', 28, '#8cff6a', 5).setOrigin(0.5).setDepth(D.fx + 5);
    this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  private onAddon(id: Equipped['id']): void {
    if (id === 'coins') { sfx.finish(); return; }
    if (id === 'guard' || id === 'boxer') { sfx.place(); return; }
    if (id === 'tnt' || id === 'spikes' || id === 'timebomb') sfx.place();
  }

  /** An explosion: a lane (x −1: the whole lane), the whole street (lane −1), or a radius round x. */
  private onBlast(lane: number, x: number, r: number): void {
    sfx.boom();
    buzz(50);
    if (lane < 0) {
      for (let l = 0; l < LANES; l++) for (let bx = STOP_X + 80; bx < GAME_W; bx += 230) this.fx(bx + (l % 2) * 100, laneFeet(l) - 40, 0.7);
      this.cameras.main.shake(350, 0.008);
      this.cameras.main.flash(180, 255, 230, 160);
    } else if (x < 0) {
      for (let bx = STOP_X + 60; bx < GAME_W; bx += 120) this.time.delayedCall((bx - STOP_X) * 0.25, () => this.fx(bx, laneFeet(lane) - 40, 0.6));
      this.cameras.main.shake(220, 0.005);
    } else {
      this.fx(x, laneFeet(lane) - 40, Math.max(0.7, r / 160));
      this.cameras.main.shake(200, 0.005);
    }
  }

  private showUnit(u: Unit): void {
    const key = `addon.${u.kind}`, y = laneFeet(u.lane);
    const spr = this.add.sprite(u.x, y + 4, `${key}.idle`).setOrigin(0.5, 1).setScale(asset(`${key}.idle`).displayScale)
      .setDepth(D.actors + y + 0.2).play(`${key}.idle`);
    if (u.kind === 'guard') spr.setFlipX(true); // the kit's Cat Guardian faces left
    spr.setAlpha(0);
    this.tweens.add({ targets: spr, alpha: 1, duration: 250 });
    const bar = this.add.rectangle(u.x - 28, y - 118, 56, 6, 0x6ad0ff).setOrigin(0, 0.5).setDepth(D.fx + 2);
    this.units.set(u.id, { spr, bar, fighting: false });
  }

  private dropUnit(u: Unit): void {
    const v = this.units.get(u.id);
    if (!v) return;
    this.units.delete(u.id);
    v.bar.destroy();
    this.tweens.add({ targets: v.spr, alpha: 0, duration: 300, onComplete: () => v.spr.destroy() });
  }

  private showTrap(t: Trap): void {
    const y = laneFeet(t.lane) - 22, icon = `ui.addon-${t.kind}`;
    const imgs: Phaser.GameObjects.Image[] = [];
    if (t.kind === 'spikes') for (let x = t.x; x <= t.x1; x += 64) imgs.push(this.add.image(x, y + 10, icon).setScale(0.42).setAlpha(0.9));
    else imgs.push(this.add.image(t.x, y, icon).setScale(0.55));
    for (const im of imgs) im.setDepth(D.actors + y - 40);
    if (t.kind === 'timebomb') this.tweens.add({ targets: imgs, scale: 0.68, yoyo: true, repeat: -1, duration: 250 });
    this.traps.set(t.id, imgs);
  }

  private dropTrap(t: Trap): void {
    const imgs = this.traps.get(t.id);
    if (!imgs) return;
    this.traps.delete(t.id);
    this.tweens.killTweensOf(imgs);
    for (const im of imgs) im.destroy();
  }

  // ── Pause / end ──────────────────────────────────────────────────────────────────────────────────
  private overlay: Phaser.GameObjects.Container | null = null;

  private togglePause(): void {
    if (this.ended || this.modal) return;
    if (this.paused) { this.paused = false; this.overlay?.destroy(); this.overlay = null; this.anims.resumeAll(); this.tweens.resumeAll(); return; }
    this.paused = true;
    this.disarm();
    this.anims.pauseAll(); this.tweens.pauseAll();
    // The kit's pause screen: a ribbon, the music / sound / vibration bar, and Restart / Resume.
    const cx = GAME_W / 2;
    const items: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0).setInteractive(),
      this.add.image(cx, 120, 'ui.ribbon').setScale(0.9), text(this, cx, 106, 'PAUSED GAME', 46).setOrigin(0.5),
      this.add.image(cx, 290, 'ui.pausebar').setScale(0.9),
    ];
    const toggles: [string, () => boolean, () => void][] = [['music', musicOn, toggleMusic], ['sound', soundOn, toggleSound], ['vibra', vibraOn, toggleVibra]];
    toggles.forEach(([k, on, flip], i) => {
      const img = this.add.image(cx - 200 + i * 200, 290, on() ? `ui.${k}` : `ui.${k}-off`).setScale(0.75);
      tappable(img, () => { flip(); img.setTexture(on() ? `ui.${k}` : `ui.${k}-off`); });
      items.push(img);
    });
    if (isMuted()) items.push(text(this, cx, 370, 'All sound is muted (M): tap to unmute', 22, COLORS.dim, 4).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerup', () => toggleMute()));
    items.push(
      button(this, cx - 210, 480, 'Restart', () => this.scene.restart({ level: this.levelN }), 'ui.btn-orange', 0.75),
      button(this, cx + 210, 480, 'Resume', () => this.togglePause(), 'ui.btn-green', 0.75),
      button(this, cx, 610, 'Map', () => this.leave(), 'ui.btn-orange', 0.6, 38),
    );
    this.overlay = this.add.container(0, 0, items).setDepth(D.overlay);
  }

  /** Back to the map: free this fight's streets, bosses and add-on cats (area 1's street stays). */
  private leave(): void {
    const keys = Object.keys(this.textures.list).filter((k) => (isAreaArt(k) && k !== 'bg.area1') || k.startsWith('addon.'));
    this.scene.start('Map');
    release(this, keys);
  }

  private endRun(won: boolean): void {
    this.ended = true;
    this.endTutorial();
    this.closeBubble();
    this.disarm();
    const st = this.sim.stats, s = player.save, n = this.def.n;
    const cleared = won ? this.sim.totalWaves : this.sim.wave;
    let gems = 0, stars = 0, first = false, better = false, got: Unlock[] = [], goals: boolean[] = [];
    if (n === FULL_ALLEY) {
      gems = alleyGems(cleared, won);
      const best = s.alley, wave = this.sim.wave + 1, time = this.sim.time;
      better = !best || (won && (!best.won || time < best.time)) || (!won && !best.won && wave > best.wave);
      if (better) s.alley = { won, wave, time: Math.round(time * 10) / 10 };
    } else if (n === ENDLESS) {
      const best = s.endless;
      gems = endlessGems(cleared, best);
      better = cleared > best;
      if (better) s.endless = cleared;
    } else if (n === DAILY) {
      const before = challengeToday(s, new Date()).stars;
      if (won) {
        goals = starGoals(this.def, { wallShare: this.sim.wallHp / this.sim.wallMax, addonsUsed: st.addonsUsed, repairs: st.repairs, maxCats: st.maxCats });
        stars = goals.filter(Boolean).length;
      }
      gems = finishDaily(s, new Date(), stars);
      better = stars > before;
    } else if (won) {
      goals = starGoals(this.def, { wallShare: this.sim.wallHp / this.sim.wallMax, addonsUsed: st.addonsUsed, repairs: st.repairs, maxCats: st.maxCats });
      stars = goals.filter(Boolean).length;
      first = (isHard(n) ? s.hard[n - HARD_BASE] : s.stars[n]) === 0;
      gems = levelGems(n, stars, first);
      got = clearLevel(s, player.awis, n, stars);
    } else if (!this.def.tutorial) gems = lossGems(cleared);
    gems = withGemBoost(player.awis, gems);
    s.gems += gems;
    spendAddons(s, this.startAddons, this.sim.addons);
    addTotals(s, st, won);
    const ach = checkAchievements(s);
    player.persist();
    (won ? sfx.finish : sfx.die)();

    this.time.delayedCall(won ? 300 : 900, () => {
      const cx = GAME_W / 2;
      const items: Phaser.GameObjects.GameObject[] = [
        this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.65).setOrigin(0).setInteractive(),
        this.add.image(cx, 150, won ? 'ui.win' : 'ui.lose').setScale(0.8),
      ];
      const line = (y: number, s2: string, size = 30, color = '#ffffff') => items.push(text(this, cx, y, s2, size, color, 6).setOrigin(0.5));
      if (n === FULL_ALLEY) {
        line(320, won ? `All 5 areas cleared in ${Math.round(this.sim.time)} s` : `Fell in Area ${this.sim.area + 1} · wave ${this.sim.wave + 1} of ${this.sim.totalWaves}`);
        if (better) line(368, 'New best!', 32, '#ffd02a');
      } else if (n === ENDLESS) {
        line(320, `${cleared} waves cleared`, 40, '#ffd02a');
        line(368, better ? 'New best!' : `Best: ${s.endless} waves`, 30, better ? '#ffd02a' : '#ffffff');
      } else if (n === DAILY && !won) {
        line(320, `Wave ${this.sim.wave + 1} of ${this.sim.totalWaves}: same zombies next try, until tomorrow`);
      } else if (won) {
        line(300, '★'.repeat(stars) + '☆'.repeat(3 - stars), 56, '#ffd02a');
        const names = ['Win', 'Keep half the wall', GOALS[this.def.goal]];
        names.forEach((g, i) => {
          const l = text(this, cx - 300 + i * 300, 352, `${goals[i] ? '✓' : '✗'} ${g}`, 21, goals[i] ? '#8cff6a' : '#ff9a8a', 4).setOrigin(0.5);
          if (l.width > 280) l.setScale(280 / l.width);
          items.push(l);
        });
      } else line(320, `Wave ${this.sim.wave + 1} of ${this.sim.totalWaves}: upgrade your cats and try again`);
      line(418, `${st.kills} zombies · ${st.bossKills} bosses · ${st.addonsUsed} add-ons`, 26, COLORS.dim);
      if (gems) {
        items.push(this.add.image(cx, 486, 'ui.winbonus').setScale(0.75), this.add.image(cx - 50, 486, 'ui.gem').setScale(0.7));
        items.push(text(this, cx - 22, 484, `+${gems}${first ? ' first clear' : n === DAILY && better ? ' today' : ''}`, 30).setOrigin(0, 0.5));
      }
      const achLines = ach.length > 2 ? [`🏆 ${ach.length} achievements · +${ach.reduce((g, a) => g + a.gems, 0)} gems`] : ach.map((a) => `🏆 ${a.name} · +${a.gems} gems`);
      achLines.forEach((l, i) => items.push(text(this, cx, 532 + i * 26, l, 22, '#ffd02a', 4).setOrigin(0.5)));
      const last = isHard(n) ? HARD_BASE + LEVEL_COUNT - 1 : LEVEL_COUNT - 1;
      const nextOpen = won && n < last && (isHard(n) || n < LEVEL_COUNT);
      items.push(
        button(this, cx - 200, 610, won ? 'Map' : 'Restart', () => (won ? this.leave() : this.scene.restart({ level: this.levelN })), 'ui.btn-orange', 0.7),
        button(this, cx + 200, 610, nextOpen ? 'Next' : won ? 'Again' : 'Map', () => {
          if (nextOpen) { this.leaveTo(n + 1); return; }
          if (won) this.scene.restart({ level: this.levelN }); else this.leave();
        }, 'ui.btn-green', 0.7),
      );
      const c = this.add.container(0, 0, items).setDepth(D.overlay).setAlpha(0);
      this.tweens.add({ targets: c, alpha: 1, duration: 300 });
      if (got.length) void this.reveal(got);
      if (ach.length) sfx.buff();
      if (BOT) this.time.delayedCall(4000, () => this.scene.restart({ level: this.levelN }));
    });
  }

  /** "NEW!" cards for what this clear unlocked, over the win screen; OK closes them. */
  private async reveal(got: Unlock[]): Promise<void> {
    await ensureLoaded(this, got.flatMap((u) => (u.kind === 'cat' ? [`cat.c${u.cat}.idle`] : [])));
    if (!this.scene.isActive()) return;
    const cx = GAME_W / 2, w = 300, gap = 24, x0 = cx - ((got.length - 1) * (w + gap)) / 2;
    const items: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.7).setOrigin(0).setInteractive(),
      this.add.image(cx, 110, 'ui.ribbon').setScale(0.8), text(this, cx, 96, got.length > 1 ? 'NEW UNLOCKS!' : 'NEW UNLOCK!', 42).setOrigin(0.5),
    ];
    got.forEach((u, i) => {
      const x = x0 + i * (w + gap), y = 360;
      const card = this.add.rectangle(x, y, w, 330, 0xf4e3c3).setStrokeStyle(5, 0xffd02a);
      let pic: Phaser.GameObjects.Image, title: string, blurb: string;
      if (u.kind === 'cat') {
        const d = guestCat(u.cat);
        pic = this.add.image(x, y + 4, `cat.c${u.cat}.idle`, 0).setOrigin(0.5, 1).setScale(asset(`cat.c${u.cat}.idle`).displayScale * 2);
        title = `New cat: ${catName(u.cat)}`;
        blurb = `${family(u.cat).name} · ${ATTACKS[d.attack].name}: ${ATTACKS[d.attack].blurb.toLowerCase()}`;
      } else if (u.kind === 'addon') {
        pic = this.add.image(x, y - 80, `ui.addon-${u.id}`).setScale(0.9);
        title = ADDONS[u.id].name; blurb = ADDONS[u.id].blurb;
      } else {
        pic = this.add.image(x, y - 80, FEATURE_ICON[u.id]).setScale(0.9);
        title = FEATURES[u.id].name; blurb = FEATURES[u.id].blurb;
      }
      const t = text(this, x, y + 30, title, 28, '#3a2a1c', 0).setOrigin(0.5);
      if (t.width > w - 24) t.setScale((w - 24) / t.width);
      const b = this.add.text(x, y + 62, blurb, { fontFamily: '"Passion One", sans-serif', fontSize: '21px', color: '#5a4a3a', align: 'center', wordWrap: { width: w - 30 } }).setOrigin(0.5, 0);
      items.push(card, pic, t, b);
      card.setScale(0.2).setAlpha(0);
      this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 300, delay: 150 * i, ease: 'Back.Out' });
    });
    const box = this.add.container(0, 0, items).setDepth(D.overlay + 5);
    box.add(button(this, cx, 620, 'OK', () => box.destroy(), 'ui.btn-green', 0.6, 42));
    sfx.finish();
    if (BOT) this.time.delayedCall(1500, () => box.destroy());
  }

  /** Straight into another level: load its art, free what it doesn't need. */
  private leaveTo(level: number): void {
    const f = player.fight(level);
    const want = new Set([...areaArt(f.level, f.level.waves[0].area), ...addonArt(f.addons.map((a) => a.id))]);
    const shade = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0).setDepth(D.overlay + 10).setInteractive();
    text(this, GAME_W / 2, GAME_H / 2, 'Loading…', 44).setOrigin(0.5).setDepth(D.overlay + 11);
    void ensureLoaded(this, [...want]).then(() => {
      const drop = Object.keys(this.textures.list).filter((k) => ((isAreaArt(k) && k !== 'bg.area1') || k.startsWith('addon.')) && !want.has(k));
      shade.disableInteractive();
      this.scene.restart({ level });
      release(this, drop);
    });
  }
}
