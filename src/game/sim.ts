// The defense, as pure TypeScript: fixed 60 Hz steps, seeded, no Phaser. The scene sends commands
// (place, upgrade, repair, add-ons) and draws what happened from `events`; `npm run sim` plays it with a bot.
import { LEVEL_DMG, MAX_LEVEL, PLACE_COST, PLACE_STEP, SLOW_FACTOR, SLOW_TIME, SPLASH_R, SPLASH_SHARE, UPGRADE_COST, type Defender } from './cats.ts';
import { COLS, LANES, SLOT_X, SPAWN_X, STOP_X, U, slotLane } from './layout.ts';
import { AREAS, makeWave, rng, waveHp, type EnemyType, type Spawn } from './waves.ts';
import { ADDON_TUNING as T, type AddonId, type Equipped } from './addons.ts';
import type { LevelDef } from './levels.ts';

export const STEP = 1 / 60;
const BULLET_SPEED = 900 * U;
export const START_COINS = 150, INCOME_PER_S = 3;
const FIRST_WAVE_AT = 3;          // seconds to place the first cats
const WAVE_TIMEOUT = 2.5;          // next wave starts this long after the last spawn even if enemies remain
const AREA_BREAK = 2;             // after a boss wave or before a new area
export const WALL_HP = 100;
/** Repair Wall: restores this share of the wall; the price starts at REPAIR_COST and rises by REPAIR_STEP each time. */
export const REPAIR_SHARE = 0.25, REPAIR_COST = 40, REPAIR_STEP = 25;
/** Melee add-on cats: zombies stop this far in front of them to fight. */
const UNIT_REACH = 70;

export interface Placed { id: number; slot: number; def: Defender; level: number; cooldown: number }
export interface Enemy {
  id: number; type: EnemyType; lane: number; x: number;
  hp: number; maxHp: number; slowUntil: number; hitTimer: number;
  state: 'walk' | 'attack' | 'dead';
  /** The melee add-on cat it is fighting (0 = the wall). */
  blockedBy: number;
}
export interface Bullet { id: number; lane: number; x: number; dmg: number; attack: Defender['attack']; from: number }
/** A melee add-on cat (Cat Guardian, Boxer Cat) standing in a lane. */
export interface Unit { id: number; kind: 'guard' | 'boxer'; lane: number; x: number; hp: number; maxHp: number; until: number; cooldown: number; dmg: number; every: number; fighting: boolean }
/** A trap or bomb lying in a lane. */
export interface Trap { id: number; kind: 'tnt' | 'timebomb' | 'spikes'; lane: number; x: number; x1: number; until: number; dmg: number; r: number; tick: number }

export type SimEvent =
  | { t: 'wave'; wave: number; total: number; area: number; boss: boolean }
  | { t: 'area'; area: number }
  | { t: 'spawn'; enemy: Enemy }
  | { t: 'shoot'; slot: number; bullet: Bullet }
  | { t: 'hit'; bullet: Bullet | null; enemy: Enemy; dmg: number; splash: boolean }
  | { t: 'kill'; enemy: Enemy; coins: number }
  | { t: 'wall'; enemy: Enemy; dmg: number }
  | { t: 'place'; cat: Placed }
  | { t: 'upgrade'; cat: Placed }
  | { t: 'repair'; hp: number }
  | { t: 'addon'; index: number; id: AddonId; lane: number }
  | { t: 'blast'; lane: number; x: number; r: number }
  | { t: 'coins'; until: number }
  | { t: 'unit'; unit: Unit }
  | { t: 'unitGone'; unit: Unit }
  | { t: 'trap'; trap: Trap }
  | { t: 'trapGone'; trap: Trap }
  | { t: 'end'; won: boolean };

export interface Stats { kills: number; bossKills: number; coinsEarned: number; placed: number; upgrades: number; repairs: number; addonsUsed: number }

export interface FightSetup {
  deck: Defender[];
  level: LevelDef;
  seed?: number;
  /** From the Cats screen's Wall and Income rows. */
  wallMax?: number;
  startCoins?: number;
  income?: number;
  /** The add-ons taken into this fight (the loadout). */
  addons?: Equipped[];
}

export class Defense {
  time = 0;
  coins: number;
  wallMax: number;
  wallHp: number;
  wave = -1;                     // index into level.waves, -1 before the first
  area: number;
  state: 'playing' | 'won' | 'lost' = 'playing';
  slots: (Placed | null)[] = Array(LANES * COLS).fill(null);
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  units: Unit[] = [];
  traps: Trap[] = [];
  events: SimEvent[] = [];
  stats: Stats = { kills: 0, bossKills: 0, coinsEarned: 0, placed: 0, upgrades: 0, repairs: 0, addonsUsed: 0 };
  /** How many copies of each card (by uid) are on the street. */
  copies = new Map<string, number>();
  /** Coins ×2 add-on: kill coins are doubled until this time. */
  coinsUntil = 0;

  readonly deck: Defender[];
  readonly level: LevelDef;
  readonly addons: Equipped[];
  readonly seed: number;
  private readonly incomePerS: number;
  private rand: () => number;
  private queue: Spawn[] = [];
  private waveStart = 0;
  private nextWaveAt = FIRST_WAVE_AT;
  private ids = 1;
  private income = 0;

  constructor(setup: FightSetup) {
    this.deck = setup.deck;
    this.level = setup.level;
    this.seed = setup.seed ?? 1;
    this.rand = rng(this.seed);
    this.wallMax = this.wallHp = setup.wallMax ?? WALL_HP;
    this.coins = setup.startCoins ?? START_COINS;
    this.incomePerS = setup.income ?? INCOME_PER_S;
    this.addons = (setup.addons ?? []).map((a) => ({ ...a }));
    this.area = setup.level.waves[0].area;
  }

  get totalWaves(): number { return this.level.waves.length; }

  // ── Commands ─────────────────────────────────────────────────────────────────────────────────────
  placeCost(def: Defender): number { return PLACE_COST + PLACE_STEP * (this.copies.get(def.uid) ?? 0); }
  upgradeCost(p: Placed): number | null { return p.level >= MAX_LEVEL ? null : UPGRADE_COST[p.level - 1]; }
  /** null when the wall is full. */
  repairCost(): number | null { return this.wallHp >= this.wallMax ? null : REPAIR_COST + REPAIR_STEP * this.stats.repairs; }

  place(slot: number, def: Defender): Placed | null {
    const cost = this.placeCost(def);
    if (this.state !== 'playing' || this.slots[slot] || this.coins < cost) return null;
    this.coins -= cost;
    const p: Placed = { id: this.ids++, slot, def, level: 1, cooldown: 0.25 };
    this.slots[slot] = p;
    this.copies.set(def.uid, (this.copies.get(def.uid) ?? 0) + 1);
    this.stats.placed++;
    this.events.push({ t: 'place', cat: p });
    return p;
  }

  upgrade(slot: number): boolean {
    const p = this.slots[slot];
    const cost = p ? this.upgradeCost(p) : null;
    if (this.state !== 'playing' || !p || cost === null || this.coins < cost) return false;
    this.coins -= cost;
    p.level++;
    this.stats.upgrades++;
    this.events.push({ t: 'upgrade', cat: p });
    return true;
  }

  repair(): boolean {
    const cost = this.repairCost();
    if (this.state !== 'playing' || cost === null || this.coins < cost) return false;
    this.coins -= cost;
    const hp = Math.round(this.wallMax * REPAIR_SHARE);
    this.wallHp = Math.min(this.wallMax, this.wallHp + hp);
    this.stats.repairs++;
    this.events.push({ t: 'repair', hp });
    return true;
  }

  /** Fire the add-on in loadout slot `index`. Lane add-ons need a lane (0–4). */
  useAddon(index: number, lane = -1): boolean {
    const a = this.addons[index];
    if (this.state !== 'playing' || !a || a.uses <= 0) return false;
    const needsLane = a.id !== 'coins' && a.id !== 'bomb';
    if (needsLane && (lane < 0 || lane >= LANES)) return false;
    a.uses--;
    this.stats.addonsUsed++;
    this.events.push({ t: 'addon', index, id: a.id, lane });
    const p = a.power;
    switch (a.id) {
      case 'rocket':
        for (const e of this.enemies) if (e.lane === lane && e.state !== 'dead') this.damage(e, Math.round(T.rocket.dmg * p), null, true);
        this.events.push({ t: 'blast', lane, x: -1, r: 0 });
        break;
      case 'bomb':
        for (const e of this.enemies) if (e.state !== 'dead') this.damage(e, Math.round(T.bomb.dmg * p), null, true);
        this.events.push({ t: 'blast', lane: -1, x: -1, r: 0 });
        break;
      case 'coins':
        this.coinsUntil = this.time + T.coins.time;
        this.events.push({ t: 'coins', until: this.coinsUntil });
        break;
      case 'timebomb': {
        // Lands on the zombie nearest the wall in that lane (or mid-street) and goes off after a few seconds.
        const front = this.enemies.filter((e) => e.lane === lane && e.state !== 'dead' && e.x < SPAWN_X - 45).sort((x, y) => x.x - y.x)[0];
        this.addTrap({ kind: 'timebomb', lane, x: front ? Math.max(STOP_X + 60, front.x - 40) : 1000, x1: 0, until: this.time + T.timebomb.delay, dmg: Math.round(T.timebomb.dmg * p), r: T.timebomb.r });
        break;
      }
      case 'tnt':
        this.addTrap({ kind: 'tnt', lane, x: T.tnt.x, x1: 0, until: Infinity, dmg: Math.round(T.tnt.dmg * p), r: T.tnt.r });
        break;
      case 'spikes':
        this.addTrap({ kind: 'spikes', lane, x: T.spikes.x0, x1: T.spikes.x1, until: this.time + T.spikes.time, dmg: Math.round(T.spikes.dps * p * 0.25), r: 0 });
        break;
      case 'guard': case 'boxer': {
        const t = T[a.id];
        const old = this.units.find((u) => u.lane === lane && u.kind === a.id);
        if (old) this.removeUnit(old);
        const u: Unit = { id: this.ids++, kind: a.id, lane, x: t.x, hp: Math.round(t.hp * p), maxHp: Math.round(t.hp * p), until: this.time + t.time, cooldown: 0.3, dmg: Math.round(t.dmg * p), every: t.every, fighting: false };
        this.units.push(u);
        this.events.push({ t: 'unit', unit: u });
        break;
      }
    }
    return true;
  }

  dmgOf(p: Placed): number { return Math.round(p.def.dmg * LEVEL_DMG ** (p.level - 1)); }

  // ── Simulation ───────────────────────────────────────────────────────────────────────────────────
  step(): void {
    if (this.state !== 'playing') return;
    const dt = STEP;
    this.time += dt;
    this.income += this.incomePerS * dt;
    if (this.income >= 1) { const n = Math.floor(this.income); this.coins += n; this.income -= n; }

    this.runWaves();
    this.moveEnemies(dt);
    this.runUnits(dt);
    this.runTraps();
    this.fire(dt);
    this.moveBullets(dt);
    this.enemies = this.enemies.filter((e) => e.state !== 'dead');
    if (this.wallHp <= 0) this.finish(false);
  }

  private runWaves(): void {
    while (this.queue.length && this.time >= this.waveStart + this.queue[0].at) {
      const s = this.queue.shift()!;
      const hp = Math.round(s.type.boss ? s.type.hp : s.type.hp * waveHp(this.level.waves[this.wave].g));
      const e: Enemy = { id: this.ids++, type: s.type, lane: s.lane, x: SPAWN_X, hp, maxHp: hp, slowUntil: 0, hitTimer: 0, state: 'walk', blockedBy: 0 };
      this.enemies.push(e);
      this.events.push({ t: 'spawn', enemy: e });
    }
    const waves = this.level.waves, last = this.wave === waves.length - 1;
    if (this.wave >= 0 && !this.queue.length) {
      const clear = this.enemies.length === 0;
      if (clear && last) return this.finish(true);
      // A boss wave must be cleared before the next wave, and so must the last wave of an area. Other waves time out.
      const hold = waves[this.wave].bosses.length > 0 || (!last && waves[this.wave + 1].area !== waves[this.wave].area);
      const pause = hold ? AREA_BREAK : 0.8;
      if (clear && this.nextWaveAt > this.time + pause) this.nextWaveAt = this.time + pause;
      if (!clear && hold) this.nextWaveAt = Math.max(this.nextWaveAt, this.time + AREA_BREAK);
    }
    if (this.time >= this.nextWaveAt && !this.queue.length && !last) this.startWave(this.wave + 1);
  }

  private startWave(i: number): void {
    const w = this.level.waves[i];
    if (w.area !== this.area) { this.area = w.area; this.events.push({ t: 'area', area: w.area }); }
    this.wave = i;
    this.waveStart = this.time;
    this.queue = makeWave(w, this.rand);
    const lastAt = this.queue[this.queue.length - 1]?.at ?? 0;
    this.nextWaveAt = this.time + lastAt + WAVE_TIMEOUT;
    this.events.push({ t: 'wave', wave: i, total: this.totalWaves, area: w.area, boss: w.bosses.length > 0 });
  }

  private unitById(id: number): Unit | undefined { return id ? this.units.find((u) => u.id === id) : undefined; }

  private moveEnemies(dt: number): void {
    for (const e of this.enemies) {
      const slow = this.time < e.slowUntil ? SLOW_FACTOR : 1;
      if (e.state === 'walk') {
        // A melee add-on cat in the lane stops zombies in front of it; otherwise they walk up to the wall.
        let stop = STOP_X, by = 0;
        for (const u of this.units) if (u.lane === e.lane && u.x < e.x && u.x + UNIT_REACH > stop) { stop = u.x + UNIT_REACH; by = u.id; }
        e.x -= e.type.speed * U * slow * dt;
        if (e.x <= stop) { e.x = stop; e.state = 'attack'; e.blockedBy = by; e.hitTimer = e.type.hitEvery * 0.5; }
      } else if (e.state === 'attack') {
        const u = this.unitById(e.blockedBy);
        if (e.blockedBy && !u) { e.state = 'walk'; e.blockedBy = 0; continue; } // its add-on cat is gone: walk on
        e.hitTimer -= dt * slow;
        if (e.hitTimer > 0) continue;
        e.hitTimer += e.type.hitEvery;
        if (u) {
          u.hp -= e.type.dmg * 8; // add-on cats take hits harder than crates
          if (u.hp <= 0) this.removeUnit(u);
        } else {
          this.wallHp = Math.max(0, this.wallHp - e.type.dmg);
          this.events.push({ t: 'wall', enemy: e, dmg: e.type.dmg });
        }
      }
    }
  }

  private runUnits(dt: number): void {
    for (const u of [...this.units]) {
      if (this.time >= u.until) { this.removeUnit(u); continue; }
      u.cooldown -= dt;
      const foe = this.enemies.filter((e) => e.lane === u.lane && e.state !== 'dead' && e.x >= u.x - 20 && e.x - u.x < UNIT_REACH + 50).sort((a, b) => a.x - b.x)[0];
      u.fighting = !!foe;
      if (!foe || u.cooldown > 0) continue;
      u.cooldown = u.every;
      this.damage(foe, u.dmg, null, false);
    }
  }

  private removeUnit(u: Unit): void {
    this.units = this.units.filter((x) => x !== u);
    for (const e of this.enemies) if (e.blockedBy === u.id) { e.state = 'walk'; e.blockedBy = 0; }
    this.events.push({ t: 'unitGone', unit: u });
  }

  private addTrap(t: Omit<Trap, 'id' | 'tick'>): void {
    const trap: Trap = { ...t, id: this.ids++, tick: 0 };
    this.traps.push(trap);
    this.events.push({ t: 'trap', trap });
  }

  private runTraps(): void {
    for (const t of [...this.traps]) {
      const inLane = this.enemies.filter((e) => e.lane === t.lane && e.state !== 'dead');
      if (t.kind === 'spikes') {
        if (this.time >= t.until) { this.dropTrap(t); continue; }
        const on = inLane.filter((e) => e.x >= t.x && e.x <= t.x1);
        for (const e of on) e.slowUntil = Math.max(e.slowUntil, this.time + 0.3);
        if (this.time >= t.tick) { t.tick = this.time + 0.25; for (const e of on) this.damage(e, t.dmg, null, true); }
        continue;
      }
      const go = t.kind === 'timebomb' ? this.time >= t.until : inLane.some((e) => e.x <= t.x + 20 && e.x > t.x - 80);
      if (!go) continue;
      for (const e of inLane) if (Math.abs(e.x - t.x) <= t.r) this.damage(e, t.dmg, null, true);
      this.events.push({ t: 'blast', lane: t.lane, x: t.x, r: t.r });
      this.dropTrap(t);
    }
  }

  private dropTrap(t: Trap): void {
    this.traps = this.traps.filter((x) => x !== t);
    this.events.push({ t: 'trapGone', trap: t });
  }

  /** The enemy a cat shoots at: the one closest to the wall in its lane, within range. */
  private target(p: Placed): Enemy | null {
    const lane = slotLane(p.slot), x0 = SLOT_X[p.slot % COLS];
    let best: Enemy | null = null;
    for (const e of this.enemies) {
      if (e.lane !== lane || e.state === 'dead' || e.x > x0 + p.def.range * U || e.x > SPAWN_X - 45) continue;
      if (!best || e.x < best.x) best = e;
    }
    return best;
  }

  private fire(dt: number): void {
    for (const p of this.slots) {
      if (!p) continue;
      p.cooldown -= dt;
      if (p.cooldown > 0) continue;
      if (!this.target(p)) { p.cooldown = 0; continue; }
      p.cooldown += 1 / p.def.rate;
      const b: Bullet = { id: this.ids++, lane: slotLane(p.slot), x: SLOT_X[p.slot % COLS] + 25, dmg: this.dmgOf(p), attack: p.def.attack, from: p.slot };
      this.bullets.push(b);
      this.events.push({ t: 'shoot', slot: p.slot, bullet: b });
    }
  }

  private moveBullets(dt: number): void {
    const keep: Bullet[] = [];
    for (const b of this.bullets) {
      b.x += BULLET_SPEED * dt;
      const hit = this.enemies.find((e) => e.lane === b.lane && e.state !== 'dead' && Math.abs(e.x - b.x) < 24);
      if (hit) { this.hit(b, hit); continue; }
      if (b.x < SPAWN_X + 40) keep.push(b);
    }
    this.bullets = keep;
  }

  private hit(b: Bullet, e: Enemy): void {
    this.damage(e, b.dmg, b, false);
    if (b.attack === 'venom') e.slowUntil = this.time + SLOW_TIME;
    if (b.attack === 'blast') {
      for (const o of this.enemies) if (o !== e && o.lane === b.lane && o.state !== 'dead' && Math.abs(o.x - e.x) < SPLASH_R * U) this.damage(o, Math.round(b.dmg * SPLASH_SHARE), b, true);
    }
  }

  private damage(e: Enemy, dmg: number, b: Bullet | null, splash: boolean): void {
    if (e.state === 'dead') return;
    e.hp -= dmg;
    this.events.push({ t: 'hit', bullet: b, enemy: e, dmg, splash });
    if (e.hp > 0) return;
    e.state = 'dead';
    const coins = e.type.coins * (this.time < this.coinsUntil ? 2 : 1);
    this.coins += coins;
    this.stats.kills++;
    if (e.type.boss) this.stats.bossKills++;
    this.stats.coinsEarned += coins;
    this.events.push({ t: 'kill', enemy: e, coins });
  }

  private finish(won: boolean): void {
    if (this.state !== 'playing') return;
    this.state = won ? 'won' : 'lost';
    this.events.push({ t: 'end', won });
  }

  get areaName(): string { return AREAS[this.area].name; }
}
