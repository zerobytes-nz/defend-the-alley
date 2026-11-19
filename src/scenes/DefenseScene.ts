// The run: draws the simulation (src/game/sim.ts) and turns taps into its commands.
// The sim steps at a fixed 60 Hz; this scene only creates/destroys sprites from sim events and moves them.
import Phaser from 'phaser';
import { BG_Y, COLORS, DEBUG, GAME_H, GAME_W, SEED, TRAY_Y } from '../config.ts';
import { areaArt, asset, ensureLoaded, release } from '../assets.ts';
import { currentDeck } from '../deck.ts';
import { ATTACKS, MAX_LEVEL, RARITY_COLOR, muzzleOffset, type Defender } from '../game/cats.ts';
import { COLS, LANES, LANE_H, SLOT_X, WALL_X, laneCenter, laneFeet, slotIndex, slotLane } from '../game/layout.ts';
import { Defense, STEP, WALL_HP, type Enemy, type Placed, type SimEvent } from '../game/sim.ts';
import { AREAS, TOTAL_WAVES } from '../game/waves.ts';
import { think } from '../game/bot.ts';
import { button, muteButton, tappable, text } from '../ui.ts';
import { sfx } from '../systems/audio.ts';
import { loadBest, saveBest } from './MenuScene.ts';

const BOT = new URLSearchParams(location.search).has('bot');
const D = { bg: 0, slot: 10, wall: 20, actors: 100, fx: 900, hud: 1000, tray: 1100, bubble: 1200, overlay: 2000 };

interface EnemyView { spr: Phaser.GameObjects.Sprite; bar: Phaser.GameObjects.Rectangle; barBg: Phaser.GameObjects.Rectangle; state: Enemy['state']; flashUntil: number }
interface CatView { spr: Phaser.GameObjects.Sprite; badge: Phaser.GameObjects.Image | null }
interface CardView { def: Defender; c: Phaser.GameObjects.Container; cost: Phaser.GameObjects.Text; glow: Phaser.GameObjects.Rectangle; afford: boolean | null }

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
  private bullets = new Map<number, Phaser.GameObjects.Image>();
  private fxPool: Phaser.GameObjects.Sprite[] = [];
  private cards: CardView[] = [];
  private selected: Defender | null = null;
  private slotTiles: Phaser.GameObjects.Rectangle[] = [];
  private wallG!: Phaser.GameObjects.Graphics;
  private bubble: Phaser.GameObjects.Container | null = null;

  private coinText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private areaText!: Phaser.GameObjects.Text;
  private wallBar!: Phaser.GameObjects.Rectangle;
  private hint!: Phaser.GameObjects.Text;
  private fpsText: Phaser.GameObjects.Text | null = null;
  private shown = { coins: -1, wall: -1 };

  constructor() { super('Defense'); }

  create(): void {
    const deck = currentDeck();
    this.sim = new Defense(deck, SEED || Math.floor(Math.random() * 1e9));
    this.acc = 0; this.speed = 1; this.paused = false; this.ended = false;
    this.enemies.clear(); this.cats.clear(); this.bullets.clear(); this.fxPool = []; this.cards = []; this.slotTiles = []; this.bubble = null;
    this.shown = { coins: -1, wall: -1 };
    this.loadingArea = false;
    void ensureLoaded(this, areaArt(1));

    this.add.rectangle(0, 0, GAME_W, GAME_H, COLORS.bg).setOrigin(0).setDepth(-1);
    this.bg = this.add.image(0, BG_Y, AREAS[0].bg).setOrigin(0).setDepth(D.bg);
    this.drawSlots();
    this.wallG = this.add.graphics().setDepth(D.wall);
    this.drawWall();
    this.drawHud();
    this.drawTray(deck);
    this.selectCard(deck[0]);
    this.banner(`Area 1 · ${AREAS[0].name}`, 'Place your cats!');

    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => { if (!over.length) this.closeBubble(); });
    this.input.keyboard?.on('keydown-P', () => this.togglePause());
    this.input.keyboard?.on('keydown-ESC', () => this.togglePause());
    if (DEBUG) {
      this.fpsText = text(this, GAME_W - 12, TRAY_Y - 34, '', 22, '#9fffa0', 4).setOrigin(1, 0.5).setDepth(D.overlay);
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
      case 'place': this.hideHint(); return this.showCat(e.cat, true);
      case 'upgrade': return this.showCat(e.cat, false);
      case 'shoot': return this.shoot(e.slot, e.bullet.id, e.bullet.attack);
      case 'hit': return this.onHit(e.enemy, e.bullet.id, e.bullet.attack, e.splash);
      case 'kill': return this.onKill(e.enemy, e.coins);
      case 'wall': return this.onWallHit(e.enemy);
      case 'wave':
        this.waveText.setText(`Wave ${e.wave + 1}/${TOTAL_WAVES}`);
        if (e.boss) { this.banner('BOSS!', `${AREAS[e.area].name} boss incoming`); sfx.bossIn(); this.cameras.main.shake(300, 0.004); }
        return;
      case 'area': return this.changeArea(e.area);
      case 'end': return this.endRun(e.won);
    }
  }

  /** Move sprites to the sim's positions. */
  private sync(): void {
    const now = this.sim.time;
    for (const e of this.sim.enemies) {
      const v = this.enemies.get(e.id);
      if (!v) continue;
      v.spr.x = e.x;
      if (e.state !== v.state) { v.state = e.state; v.spr.play(`enemy.${e.type.key}.${e.state}`); }
      if (now < v.flashUntil) v.spr.setTintFill(0xffffff);
      else if (now < e.slowUntil) v.spr.setTint(0x9dff8a);
      else v.spr.clearTint();
      const show = e.hp < e.maxHp;
      v.bar.setVisible(show); v.barBg.setVisible(show);
      if (show) { v.barBg.x = e.x; v.bar.x = e.x - v.barBg.width / 2 + 2; v.bar.width = Math.max(0, (v.barBg.width - 4) * (e.hp / e.maxHp)); }
    }
    const live = new Set(this.sim.bullets.map((b) => b.id));
    for (const b of this.sim.bullets) { const img = this.bullets.get(b.id); if (img) img.x = b.x; }
    for (const [id, img] of this.bullets) if (!live.has(id)) { img.destroy(); this.bullets.delete(id); }

    if (this.sim.coins !== this.shown.coins) {
      this.shown.coins = this.sim.coins;
      this.coinText.setText(String(this.sim.coins));
      for (const c of this.cards) {
        const cost = this.sim.placeCost(c.def), ok = this.sim.coins >= cost;
        c.cost.setText(String(cost));
        if (ok !== c.afford) { c.afford = ok; c.c.setAlpha(ok ? 1 : 0.55); c.cost.setColor(ok ? '#ffffff' : '#ff8a7a'); }
      }
    }
    if (this.sim.wallHp !== this.shown.wall) {
      this.shown.wall = this.sim.wallHp;
      const f = this.sim.wallHp / WALL_HP;
      this.wallBar.width = 196 * f;
      this.wallBar.setFillStyle(f > 0.5 ? COLORS.good : f > 0.25 ? COLORS.gold : COLORS.bad);
    }
  }

  // ── Street ───────────────────────────────────────────────────────────────────────────────────────
  private drawSlots(): void {
    for (let l = 0; l < LANES; l++) for (let c = 0; c < COLS; c++) {
      const s = slotIndex(l, c);
      const tile = this.add.rectangle(SLOT_X[c], laneCenter(l) + 4, 100, LANE_H - 14, 0xffffff, 0.1)
        .setStrokeStyle(3, 0xffffff, 0.22).setDepth(D.slot).setInteractive({ useHandCursor: true });
      tile.on('pointerup', () => this.tapSlot(s));
      this.slotTiles.push(tile);
    }
  }

  /** A column of crates per lane. Redrawn (with a red flash) when hit. */
  private drawWall(flash = false): void {
    const g = this.wallG;
    g.clear();
    for (let l = 0; l < LANES; l++) {
      const top = laneCenter(l) - LANE_H / 2 + 6;
      for (let k = 0; k < 2; k++) {
        const y = top + k * ((LANE_H - 10) / 2);
        g.fillStyle(flash ? 0xe07a5a : 0xc68a52).fillRoundedRect(WALL_X - 24, y, 44, (LANE_H - 14) / 2, 6);
        g.lineStyle(3, 0x5a3418).strokeRoundedRect(WALL_X - 24, y, 44, (LANE_H - 14) / 2, 6);
        g.lineStyle(2, 0x8a5a2a).lineBetween(WALL_X - 18, y + 8, WALL_X + 14, y + (LANE_H - 14) / 2 - 8);
      }
    }
  }

  private changeArea(a: number): void {
    const loaded = areaArt(a).every((k) => this.textures.exists(k));
    if (!loaded) { // slow connection: hold the run until this area's art is in
      this.loadingArea = true;
      void ensureLoaded(this, areaArt(a)).then(() => { this.loadingArea = false; this.changeArea(a); });
      return;
    }
    if (a + 1 < AREAS.length) void ensureLoaded(this, areaArt(a + 1));
    const next = this.add.image(0, BG_Y, AREAS[a].bg).setOrigin(0).setDepth(D.bg + 1).setAlpha(0);
    const old = this.bg;
    // Free the previous area's street and boss once its street is off screen (area 1 stays for the next run).
    this.tweens.add({ targets: next, alpha: 1, duration: 700, onComplete: () => { old.destroy(); next.setDepth(D.bg); if (a - 1 >= 1) release(this, areaArt(a - 1)); } });
    this.bg = next;
    this.areaText.setText(`Area ${a + 1} · ${AREAS[a].name}`);
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
      v.badge = this.add.image(v.spr.x - 40, v.spr.y - 96, `ui.up${Math.min(3, p.level - 1)}`).setScale(0.6).setDepth(D.actors + 900);
      this.tweens.add({ targets: v.spr, scaleY: v.spr.scaleY * 1.12, yoyo: true, duration: 120 });
      this.fx(v.spr.x, v.spr.y - 50, 0.5);
      sfx.buff();
    } else if (isNew) sfx.place();
  }

  private shoot(slot: number, bulletId: number, attack: Defender['attack']): void {
    const p = this.sim.slots[slot], v = this.cats.get(slot);
    if (!p || !v) return;
    const key = `cat.c${p.def.cat}`;
    v.spr.play(`${key}.shoot`).chain(`${key}.idle`);
    const [mx, my] = muzzleOffset(p.def.cat);
    const x = v.spr.x + mx, y = v.spr.y + my;
    const flash = this.fx(x, y, asset('fx.muzzle').displayScale, 'fx.muzzle');
    flash.setOrigin(0.1, 0.5);
    const b = this.add.image(x + 10, y, `bullet.${attack}`).setScale(asset(`bullet.${attack}`).displayScale).setDepth(D.fx);
    this.bullets.set(bulletId, b);
    sfx.pew(attack);
  }

  // ── Enemies ──────────────────────────────────────────────────────────────────────────────────────
  private spawnEnemy(e: Enemy): void {
    const key = `enemy.${e.type.key}`;
    const y = laneFeet(e.lane);
    const spr = this.add.sprite(e.x, y + 4, `${key}.walk`).setOrigin(0.5, 1).setScale(asset(`${key}.walk`).displayScale)
      .setDepth(D.actors + y + (e.type.boss ? 0.5 : 0)).play(`${key}.walk`);
    spr.anims.setProgress(Math.random());
    const w = e.type.boss ? 120 : 64, top = y - (e.type.boss ? 170 : 116);
    const barBg = this.add.rectangle(e.x, top, w, e.type.boss ? 14 : 10, 0x000000, 0.65).setDepth(D.fx + 1).setVisible(false);
    const bar = this.add.rectangle(e.x, top, w - 4, e.type.boss ? 10 : 6, e.type.boss ? 0xff5040 : 0x8cff6a).setOrigin(0, 0.5).setDepth(D.fx + 2).setVisible(false);
    this.enemies.set(e.id, { spr, bar, barBg, state: 'walk', flashUntil: 0 });
    if (e.type.boss) { spr.setAlpha(0); this.tweens.add({ targets: spr, alpha: 1, duration: 400 }); }
  }

  private onHit(e: Enemy, bulletId: number, attack: Defender['attack'], splash: boolean): void {
    const v = this.enemies.get(e.id);
    if (v) v.flashUntil = this.sim.time + 0.06;
    if (splash) return;
    const b = this.bullets.get(bulletId);
    if (b) { b.destroy(); this.bullets.delete(bulletId); }
    if (attack === 'blast') { this.fx(e.x - 10, laneFeet(e.lane) - 50, 0.55); sfx.boom(); }
  }

  private onKill(e: Enemy, coins: number): void {
    const v = this.enemies.get(e.id);
    if (!v) return;
    this.enemies.delete(e.id);
    v.bar.destroy(); v.barBg.destroy();
    v.spr.clearTint().play(`enemy.${e.type.key}.dead`);
    v.spr.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.tweens.add({ targets: v.spr, alpha: 0, duration: 250, onComplete: () => v.spr.destroy() }));
    const t = text(this, e.x, laneFeet(e.lane) - 110, `+${coins}`, e.type.boss ? 44 : 30, '#ffd02a', 5).setOrigin(0.5).setDepth(D.fx + 5);
    this.tweens.add({ targets: t, y: t.y - 50, alpha: 0, duration: 700, onComplete: () => t.destroy() });
    if (e.type.boss) { this.fx(e.x, laneFeet(e.lane) - 70, 1.2); this.cameras.main.shake(250, 0.006); sfx.boom(); }
    sfx.coin();
  }

  private onWallHit(e: Enemy): void {
    sfx.thud();
    this.drawWall(true);
    this.time.delayedCall(90, () => this.drawWall(false));
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
  private drawHud(): void {
    this.add.rectangle(0, 0, GAME_W, BG_Y, 0x16131d).setOrigin(0).setDepth(D.hud - 1);
    this.add.image(110, 40, 'ui.coinbar').setDepth(D.hud);
    this.add.image(40, 40, 'ui.coin').setScale(0.85).setDepth(D.hud + 1);
    this.coinText = text(this, 120, 38, '0', 36).setOrigin(0.5).setDepth(D.hud + 2);
    this.add.image(GAME_W / 2 + 20, 40, 'ui.wavebar').setDepth(D.hud);
    this.waveText = text(this, GAME_W / 2 + 40, 38, `Wave 0/${TOTAL_WAVES}`, 28).setOrigin(0.5).setDepth(D.hud + 1);
    const pause = this.add.image(GAME_W - 46, 40, 'ui.settings').setScale(0.62).setDepth(D.hud);
    tappable(pause, () => this.togglePause());
    const spd = text(this, GAME_W - 122, 40, '×1', 34).setOrigin(0.5).setDepth(D.hud);
    tappable(spd, () => { this.speed = this.speed === 1 ? 2 : 1; spd.setText(`×${this.speed}`); });

    // Wall health and the area name on the top sidewalk.
    const y = BG_Y + 44;
    this.add.rectangle(20, y, 240, 54, 0x000000, 0.45).setOrigin(0, 0.5).setDepth(D.hud);
    this.add.image(46, y, 'ui.wall').setScale(0.55).setDepth(D.hud + 1);
    this.add.rectangle(78, y, 200, 22, 0x000000, 0.6).setOrigin(0, 0.5).setDepth(D.hud + 1);
    this.wallBar = this.add.rectangle(80, y, 196, 18, COLORS.good).setOrigin(0, 0.5).setDepth(D.hud + 2);
    this.areaText = text(this, GAME_W - 20, y, `Area 1 · ${AREAS[0].name}`, 30).setOrigin(1, 0.5).setDepth(D.hud);
    this.hint = text(this, GAME_W / 2, TRAY_Y - 40, 'Pick a cat, then tap a spot by the wall', 26, COLORS.text, 5).setOrigin(0.5).setDepth(D.hud);
  }

  private drawTray(deck: Defender[]): void {
    this.add.rectangle(0, TRAY_Y, GAME_W, GAME_H - TRAY_Y, COLORS.tray).setOrigin(0).setDepth(D.tray - 1);
    this.add.rectangle(0, TRAY_Y, GAME_W, 6, 0x000000, 0.4).setOrigin(0).setDepth(D.tray - 1);
    const gap = 138, y = TRAY_Y + 104;
    deck.forEach((def, i) => {
      const x = GAME_W / 2 + (i - (deck.length - 1) / 2) * gap;
      const glow = this.add.rectangle(0, 0, 140, 140, 0xffffff, 0.9).setVisible(false);
      const box = this.add.image(0, 0, 'ui.cardbox').setScale(0.8);
      const stripe = this.add.rectangle(0, -50, 100, 8, RARITY_COLOR[def.rarity]);
      const cat = this.add.image(-4, 34, `cat.c${def.cat}.idle`, 0).setOrigin(0.5, 1).setScale(0.62);
      const bullet = this.add.image(40, -34, `bullet.${def.attack}`).setScale(0.55);
      const coin = this.add.image(-22, 58, 'ui.coin').setScale(0.38);
      const cost = text(this, 6, 56, '', 26).setOrigin(0, 0.5);
      const c = this.add.container(x, y, [glow, box, stripe, cat, bullet, coin, cost]).setSize(130, 130).setDepth(D.tray);
      tappable(c, () => this.selectCard(def));
      const name = text(this, x, y + 84, def.source === 'nft' ? def.name : `${def.name} · ${ATTACKS[def.attack].name}`, 18, COLORS.dim, 3).setOrigin(0.5).setDepth(D.tray);
      if (name.width > gap - 6) name.setScale((gap - 6) / name.width);
      this.cards.push({ def, c, cost, glow, afford: null });
    });
  }

  private selectCard(def: Defender): void {
    this.selected = def;
    this.closeBubble();
    for (const c of this.cards) {
      const on = c.def === def;
      c.glow.setVisible(on);
      this.tweens.add({ targets: c.c, y: TRAY_Y + (on ? 92 : 104), duration: 120 });
    }
  }

  private tapSlot(slot: number): void {
    if (this.ended || this.paused) return;
    const placed = this.sim.slots[slot];
    if (placed) { this.openBubble(placed); return; }
    this.closeBubble();
    if (!this.selected) return;
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
    const x = Math.max(150, v.spr.x + 90), y = v.spr.y - 120;
    const bg = this.add.rectangle(0, 0, 270, 112, 0x16131d, 0.92).setStrokeStyle(3, RARITY_COLOR[p.def.rarity]);
    const title = text(this, 0, -36, `${p.def.name} · Lv ${p.level}`, 26).setOrigin(0.5);
    if (title.width > 250) title.setScale(250 / title.width);
    const stats = text(this, 0, -6, `${this.sim.dmgOf(p)} dmg · ${p.def.rate}/s · ${ATTACKS[p.def.attack].name}`, 20, COLORS.dim, 3).setOrigin(0.5);
    const items: Phaser.GameObjects.GameObject[] = [bg, title, stats];
    if (cost !== null) {
      const ok = this.sim.coins >= cost;
      const btn = this.add.rectangle(0, 32, 200, 40, ok ? COLORS.good : 0x666666).setStrokeStyle(3, 0x2b1d14);
      const lbl = text(this, 0, 30, `⬆ Upgrade  ${cost}`, 24).setOrigin(0.5);
      items.push(btn, lbl);
      btn.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        if (this.sim.upgrade(p.slot)) this.closeBubble(); else this.flashHint(`Need ${cost} coins`);
      });
    } else items.push(text(this, 0, 32, `Max level (${MAX_LEVEL})`, 22, '#ffd02a', 3).setOrigin(0.5));
    this.bubble = this.add.container(x, y, items).setDepth(D.bubble).setSize(270, 112);
    bg.setInteractive(); // swallow taps on the bubble itself
    this.time.delayedCall(4000, () => { if (this.bubble?.getData('slot') === p.slot) this.closeBubble(); });
    this.bubble.setData('slot', p.slot);
  }

  private closeBubble(): void { this.bubble?.destroy(); this.bubble = null; }

  private banner(title: string, sub: string): void {
    const y = 560;
    const rib = this.add.image(GAME_W / 2, y, 'ui.ribbon').setDepth(D.overlay - 10);
    const t = text(this, GAME_W / 2, y - 14, title, 46, '#ffffff', 8).setOrigin(0.5).setDepth(D.overlay - 9);
    if (t.width > 400) t.setScale(400 / t.width);
    const s = text(this, GAME_W / 2, y + 70, sub, 30, '#ffd02a', 6).setOrigin(0.5).setDepth(D.overlay - 9);
    const all = [rib, t, s];
    for (const o of all) o.setAlpha(0);
    this.tweens.add({ targets: all, alpha: 1, duration: 200, yoyo: true, hold: 1300, onComplete: () => all.forEach((o) => o.destroy()) });
  }

  // ── Pause / end ──────────────────────────────────────────────────────────────────────────────────
  private overlay: Phaser.GameObjects.Container | null = null;

  private togglePause(): void {
    if (this.ended) return;
    if (this.paused) { this.paused = false; this.overlay?.destroy(); this.overlay = null; this.anims.resumeAll(); this.tweens.resumeAll(); return; }
    this.paused = true;
    this.anims.pauseAll(); this.tweens.pauseAll();
    const shade = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0).setInteractive();
    const t = text(this, GAME_W / 2, 420, 'Paused', 80).setOrigin(0.5);
    const items = [shade, t,
      button(this, GAME_W / 2, 600, 'Resume', () => this.togglePause()),
      button(this, GAME_W / 2, 750, 'Restart', () => this.scene.restart(), 'ui.btn-orange'),
      button(this, GAME_W / 2, 900, 'Menu', () => this.scene.start('Menu'), 'ui.btn-orange'),
      muteButton(this, GAME_W / 2, 1040, 36)];
    this.overlay = this.add.container(0, 0, items).setDepth(D.overlay);
  }

  private endRun(won: boolean): void {
    this.ended = true;
    this.closeBubble();
    const st = this.sim.stats;
    const wave = this.sim.wave + 1, time = this.sim.time;
    const best = loadBest();
    const better = !best || (won && (!best.won || time < best.time)) || (!won && !best.won && wave > best.wave);
    if (better) saveBest({ won, wave, time });
    (won ? sfx.finish : sfx.die)();
    this.time.delayedCall(won ? 300 : 900, () => {
      const shade = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.65).setOrigin(0).setInteractive();
      const ban = this.add.image(GAME_W / 2, 380, won ? 'ui.win' : 'ui.lose').setScale(0.95);
      const lines = [
        won ? `All 5 areas cleared in ${Math.round(time)} s` : `Fell in Area ${this.sim.area + 1} · wave ${wave} of ${TOTAL_WAVES}`,
        `${st.kills} zombies · ${st.bossKills} bosses · wall ${this.sim.wallHp}%`,
        better ? 'New best!' : best ? (best.won ? `Best: cleared in ${Math.round(best.time)} s` : `Best: wave ${best.wave}`) : '',
      ];
      const ts = lines.map((l, i) => text(this, GAME_W / 2, 600 + i * 56, l, i === 2 ? 34 : 32, i === 2 ? '#ffd02a' : '#ffffff', 6).setOrigin(0.5));
      const again = button(this, GAME_W / 2, 860, 'Play again', () => this.scene.restart());
      const menu = button(this, GAME_W / 2, 1010, 'Menu', () => this.scene.start('Menu'), 'ui.btn-orange');
      const c = this.add.container(0, 0, [shade, ban, ...ts, again, menu]).setDepth(D.overlay).setAlpha(0);
      this.tweens.add({ targets: c, alpha: 1, duration: 300 });
      if (BOT) this.time.delayedCall(4000, () => this.scene.restart());
    });
  }
}
