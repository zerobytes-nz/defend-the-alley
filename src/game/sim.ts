// The defense, as pure TypeScript: fixed 60 Hz steps, seeded, no Phaser. The scene sends commands
// (place, upgrade, repair, add-ons) and draws what happened from `events`; `npm run sim` plays it with a bot.
import { CROSS_EVERY, KNOCKBACK, PERK, LEVEL_DMG, MAX_LEVEL, PIERCE, PLACE_COST, PLACE_STEP, SLOW_FACTOR, SLOW_TIME, SPLASH_R, SPLASH_SHARE, UPGRADE_COST, VENOM_BLAST, roleOf, type Defender } from './cats.ts';
import { COLS, LANES, SLOT_X, SPAWN_X, STOP_X, U, slotLane } from './layout.ts';
import { AREAS, ENEMIES, MINION, SPLIT_CHILD, makeWave, rng, waveHp, type EnemyType, type Spawn } from './waves.ts';
import { ADDON_TUNING as T, type AddonId, type Equipped } from './addons.ts';
import { HARD_HP, type LevelDef } from './levels.ts';

export const STEP = 1 / 60;
const BULLET_SPEED = 900 * U;
export const START_COINS = 150, INCOME_PER_S = 3;
const FIRST_WAVE_AT = 3;          // seconds to place the first cats
const WAVE_TIMEOUT = 2.5;          // next wave starts this long after the last spawn even if enemies remain
const AREA_BREAK = 2;             // after a boss wave or before a new area
/** Extra coins for each zombie a Coin Cat AWI stops. */
export const COIN_PERK = 2;
export const WALL_HP = 100;
/**
 * Repair Wall: restores this share of the wall, evenly over REPAIR_TIME seconds (it can't be bought again until it's
 * done); the price starts at REPAIR_COST and rises by REPAIR_STEP each time.
 */
export const REPAIR_SHARE = 0.25, REPAIR_COST = 40, REPAIR_STEP = 25, REPAIR_TIME = 8;
/** Melee add-on cats: zombies stop this far in front of them to fight. */
const UNIT_REACH = 70;
/** Where a tap-placed add-on cat may stand: just past the crosswalk, up to short of where zombies walk in. */
export const UNIT_MIN_X = Math.round(STOP_X + 40), UNIT_MAX_X = 1250;
export const unitSpot = (x: number): number => Math.round(Math.min(UNIT_MAX_X, Math.max(UNIT_MIN_X, x)));

export interface Placed {
  id: number; slot: number; def: Defender; level: number; cooldown: number;
  /** Shots fired (Blaster cats send every 3rd one down the next lane too). */
  shots: number;
  /** Coins paid for it (placing + upgrades), for selling. */
  spent: number;
  /** It can be moved again from this time. */
  moveAt: number;
}
/** Move a placed cat again after this many seconds. */
export const MOVE_COOLDOWN = 3;
/** Selling gives back this share of what a cat cost. */
export const SELL_SHARE = 0.5;
export interface Enemy {
  id: number; type: EnemyType; lane: number; x: number;
  hp: number; maxHp: number; slowUntil: number; hitTimer: number;
  state: 'walk' | 'attack' | 'dead';
  /** The melee add-on cat it is fighting (0 = the wall). */
  blockedBy: number;
  /** Behaviour state: shield left, a one-off move used (switch / jump / charge / enrage), next ability time, speed and hit-rate multipliers. */
  shield: number; used: boolean; nextAt: number; speedMul: number; until: number; rage: number;
  /** A Linebacker's small zombie (doesn't split again). */
  child?: boolean;
}
/** Zombie behaviour numbers. */
const ARMOUR = 0.5, SHIELD_SHARE = 0.6, SHIELD_LET = 0.3, SWITCH_X = 1000, HEAL_EVERY = 2, HEAL_R = 190, HEAL_SHARE = 0.08;
const SUMMON_EVERY = 7, CHARGE_AT = 0.6, CHARGE_MUL = 2.6, CHARGE_TIME = 1.8, ENRAGE_AT = 0.5, HOP_EVERY = 6;
export interface Bullet { id: number; lane: number; x: number; dmg: number; attack: Defender['attack']; from: number; pierce: number; hitIds: number[]; knock: number }
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
  | { t: 'switch'; enemy: Enemy; from: number }
  | { t: 'jump'; enemy: Enemy }
  | { t: 'heal'; enemy: Enemy }
  | { t: 'ability'; enemy: Enemy; what: 'summon' | 'charge' | 'enrage' | 'shieldBreak' }
  | { t: 'wall'; enemy: Enemy; dmg: number }
  | { t: 'place'; cat: Placed }
  | { t: 'upgrade'; cat: Placed }
  | { t: 'merge'; from: number; cat: Placed }
  | { t: 'move'; from: number; cat: Placed }
  | { t: 'sell'; slot: number; coins: number }
  | { t: 'repair'; hp: number; time: number }
  | { t: 'repairDone' }
  | { t: 'addon'; index: number; id: AddonId; lane: number }
  | { t: 'blast'; lane: number; x: number; r: number }
  | { t: 'coins'; until: number }
  | { t: 'unit'; unit: Unit }
  | { t: 'unitGone'; unit: Unit }
  | { t: 'trap'; trap: Trap }
  | { t: 'trapGone'; trap: Trap }
  | { t: 'end'; won: boolean };

export interface Stats { kills: number; bossKills: number; coinsEarned: number; placed: number; upgrades: number; repairs: number; addonsUsed: number; merges: number; sold: number; maxCats: number }

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
  /** Repair Wall unlocks after level 2 (default on). */
  repair?: boolean;
  /** Merging cats unlocks after level 6 (default on). */
  merge?: boolean;
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
  stats: Stats = { kills: 0, bossKills: 0, coinsEarned: 0, placed: 0, upgrades: 0, repairs: 0, addonsUsed: 0, merges: 0, sold: 0, maxCats: 0 };
  /** How many copies of each card (by uid) are on the street. */
  copies = new Map<string, number>();
  /** Coins ×2 add-on: kill coins are doubled until this time. */
  coinsUntil = 0;

  readonly deck: Defender[];
  readonly level: LevelDef;
  readonly addons: Equipped[];
  readonly seed: number;
  readonly canRepair: boolean;
  readonly canMerge: boolean;
  /** Rush rule: zombies walk faster. Hard mode: more health. */
  private readonly walkK: number;
  private readonly hpK: number;
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
    const poor = setup.level.rule === 'poor';
    this.coins = Math.round((setup.startCoins ?? START_COINS) * (poor ? 0.6 : 1));
    this.incomePerS = (setup.income ?? INCOME_PER_S) * (poor ? 0.65 : 1);
    this.addons = (setup.addons ?? []).map((a) => ({ ...a }));
    this.area = setup.level.waves[0].area;
    this.canRepair = (setup.repair ?? true) && setup.level.rule !== 'norepair';
    this.walkK = setup.level.rule === 'fast' ? 1.33 : 1;
    this.hpK = setup.level.hard ? HARD_HP : 1;
    this.canMerge = setup.merge ?? true;
  }

  get totalWaves(): number { return this.level.waves.length; }

  // ── Commands ─────────────────────────────────────────────────────────────────────────────────────
  placeCost(def: Defender): number { return PLACE_COST + PLACE_STEP * (this.copies.get(def.uid) ?? 0); }
  upgradeCost(p: Placed): number | null { return p.level >= MAX_LEVEL ? null : UPGRADE_COST[p.level - 1]; }
  /** null when the wall is full. */
  /** A repair in progress: wall still to add, the rate (hp/s), when it ends, and the fraction carried between steps. */
  repairing: { left: number; rate: number; until: number; acc: number } | null = null;
  /** 0–1 through the current repair, or null when none is running. */
  repairProgress(): number | null { return this.repairing ? 1 - (this.repairing.until - this.time) / REPAIR_TIME : null; }

  repairCost(): number | null { return !this.canRepair || this.wallHp >= this.wallMax ? null : REPAIR_COST + REPAIR_STEP * this.stats.repairs; }

  /** A lane is closed on levels that use fewer (the tutorial). */
  laneOpen(lane: number): boolean { return !this.level.lanes || this.level.lanes.includes(lane); }

  place(slot: number, def: Defender): Placed | null {
    const cost = this.placeCost(def);
    if (this.state !== 'playing' || this.slots[slot] || this.coins < cost || !this.laneOpen(slotLane(slot))) return null;
    this.coins -= cost;
    const p: Placed = { id: this.ids++, slot, def, level: 1, cooldown: 0.25, shots: 0, spent: cost, moveAt: 0 };
    this.slots[slot] = p;
    this.copies.set(def.uid, (this.copies.get(def.uid) ?? 0) + 1);
    this.stats.placed++;
    this.stats.maxCats = Math.max(this.stats.maxCats, this.slots.filter(Boolean).length);
    this.events.push({ t: 'place', cat: p });
    return p;
  }

  upgrade(slot: number): boolean {
    const p = this.slots[slot];
    const cost = p ? this.upgradeCost(p) : null;
    if (this.state !== 'playing' || !p || cost === null || this.coins < cost) return false;
    this.coins -= cost;
    p.level++;
    p.spent += cost;
    this.stats.upgrades++;
    this.events.push({ t: 'upgrade', cat: p });
    return true;
  }

  /** Two copies of the same card at the same level can merge (drag one onto the other): one cat, a level higher. */
  canMergeInto(from: number, to: number): boolean {
    const a = this.slots[from], b = this.slots[to];
    return this.canMerge && from !== to && !!a && !!b && a.def.uid === b.def.uid && a.level === b.level && b.level < MAX_LEVEL;
  }

  merge(from: number, to: number): boolean {
    if (this.state !== 'playing' || !this.canMergeInto(from, to)) return false;
    const a = this.slots[from]!, b = this.slots[to]!;
    this.drop(a);
    b.level++;
    b.spent += a.spent;
    this.stats.merges++;
    this.events.push({ t: 'merge', from, cat: b });
    return true;
  }

  /** Drag a cat to a free square (in an open lane). It can't move again for MOVE_COOLDOWN seconds. */
  move(from: number, to: number): boolean {
    const p = this.slots[from];
    if (this.state !== 'playing' || !p || this.slots[to] || from === to || !this.laneOpen(slotLane(to)) || this.time < p.moveAt) return false;
    this.slots[from] = null;
    this.slots[to] = p;
    p.slot = to;
    p.moveAt = this.time + MOVE_COOLDOWN;
    p.cooldown = Math.max(p.cooldown, 0.4);
    this.events.push({ t: 'move', from, cat: p });
    return true;
  }

  sellValue(p: Placed): number { return Math.floor(p.spent * SELL_SHARE); }

  sell(slot: number): boolean {
    const p = this.slots[slot];
    if (this.state !== 'playing' || !p) return false;
    const coins = this.sellValue(p);
    this.drop(p);
    this.coins += coins;
    this.stats.sold++;
    this.events.push({ t: 'sell', slot, coins });
    return true;
  }

  /** Take a cat off the street (merged or sold). */
  private drop(p: Placed): void {
    this.slots[p.slot] = null;
    this.copies.set(p.def.uid, Math.max(0, (this.copies.get(p.def.uid) ?? 1) - 1));
  }

  repair(): boolean {
    const cost = this.repairCost();
    if (this.state !== 'playing' || cost === null || this.coins < cost || this.repairing) return false;
    this.coins -= cost;
    const hp = Math.round(this.wallMax * REPAIR_SHARE);
    this.repairing = { left: hp, rate: hp / REPAIR_TIME, until: this.time + REPAIR_TIME, acc: 0 };
    this.stats.repairs++;
    this.events.push({ t: 'repair', hp, time: REPAIR_TIME });
    return true;
  }

  /** The wall fills a little every step while a repair runs (whole hp; anything past full is lost). */
  private runRepair(dt: number): void {
    const r = this.repairing;
    if (!r) return;
    r.acc += r.rate * dt;
    const add = Math.min(r.left, Math.floor(r.acc));
    if (add > 0) { r.acc -= add; r.left -= add; this.wallHp = Math.min(this.wallMax, this.wallHp + add); }
    if (this.time >= r.until - 1e-9 || r.left <= 0) {
      if (r.left > 0) this.wallHp = Math.min(this.wallMax, this.wallHp + r.left);
      this.repairing = null;
      this.events.push({ t: 'repairDone' });
    }
  }

  /**
   * Fire the add-on in loadout slot `index`. Lane add-ons need a lane (0–4). Cat Guardian and Boxer Cat stand at `x`
   * (where the player tapped, kept between the crosswalk and the far end), or at their usual spot without one.
   */
  useAddon(index: number, lane = -1, x?: number): boolean {
    const a = this.addons[index];
    if (this.state !== 'playing' || !a || a.uses <= 0) return false;
    const needsLane = a.id !== 'coins' && a.id !== 'bomb';
    if (needsLane && (lane < 0 || lane >= LANES || !this.laneOpen(lane))) return false;
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
        this.coinsUntil = this.time + T.coins.time * p;
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
        const u: Unit = { id: this.ids++, kind: a.id, lane, x: unitSpot(x ?? t.x), hp: Math.round(t.hp * p), maxHp: Math.round(t.hp * p), until: this.time + t.time, cooldown: 0.3, dmg: Math.round(t.dmg * p), every: t.every, fighting: false };
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
    if (this.level.tutorial && this.stats.placed === 0) return; // the tutorial waits for the first cat
    const dt = STEP;
    this.time += dt;
    this.income += this.incomePerS * dt;
    if (this.income >= 1) { const n = Math.floor(this.income); this.coins += n; this.income -= n; }

    this.runWaves();
    this.abilities();
    this.runRepair(dt);
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
      this.spawn(s.type, s.lane, SPAWN_X, hp);
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

  private spawn(type: EnemyType, lane: number, x: number, hp: number, child = false): Enemy {
    hp = Math.round(hp * this.hpK);
    const e: Enemy = {
      id: this.ids++, type, lane, x, hp, maxHp: hp, slowUntil: 0, hitTimer: 0, state: 'walk', blockedBy: 0,
      shield: type.ability === 'shield' ? hp * SHIELD_SHARE : 0, used: false, nextAt: this.time + (type.boss ? 4 : HEAL_EVERY), speedMul: 1, until: 0, rage: 1, child,
    };
    this.enemies.push(e);
    this.events.push({ t: 'spawn', enemy: e });
    return e;
  }

  /** The lanes next to `lane` that are open. */
  private nextLanes(lane: number): number[] { return [lane - 1, lane + 1].filter((l) => l >= 0 && l < LANES && this.laneOpen(l)); }

  /** Cats on a lane's two squares (fewer = where a lane switcher goes). */
  private catsIn(lane: number): number { return [0, 1].reduce((n, c) => n + (this.slots[lane * COLS + c] ? this.slots[lane * COLS + c]!.level : 0), 0); }

  /** Zombie behaviours and boss abilities that act on their own (not on being hit). */
  private abilities(): void {
    const g = this.level.waves[Math.max(0, this.wave)].g;
    for (const e of [...this.enemies]) {
      if (e.state === 'dead') continue;
      const a = e.type.ability, share = e.hp / e.maxHp;
      if (e.until && this.time >= e.until) { e.speedMul = 1; e.until = 0; }
      switch (a) {
        case 'switch': case 'hop': {
          const due = a === 'switch' ? !e.used && e.x < SWITCH_X : this.time >= e.nextAt;
          if (!due || e.state !== 'walk') break;
          e.used = true; e.nextAt = this.time + HOP_EVERY;
          const to = this.nextLanes(e.lane).sort((x, y) => this.catsIn(x) - this.catsIn(y))[0];
          if (to === undefined) break;
          const from = e.lane;
          e.lane = to;
          this.events.push({ t: 'switch', enemy: e, from });
          break;
        }
        case 'heal':
          if (this.time < e.nextAt) break;
          e.nextAt = this.time + HEAL_EVERY;
          for (const o of this.enemies) if (o !== e && !o.type.boss && o.state !== 'dead' && Math.abs(o.lane - e.lane) <= 1 && Math.abs(o.x - e.x) < HEAL_R && o.hp < o.maxHp) o.hp = Math.min(o.maxHp, o.hp + Math.round(o.maxHp * HEAL_SHARE));
          this.events.push({ t: 'heal', enemy: e });
          break;
        case 'summon': {
          if (this.time < e.nextAt || e.x > SPAWN_X - 60) break;
          e.nextAt = this.time + SUMMON_EVERY;
          const type = ENEMIES[MINION[Number(e.type.key.slice(4))] ?? 'reg1'];
          for (const l of [e.lane, ...this.nextLanes(e.lane)].slice(0, 2)) this.spawn(type, l, Math.min(SPAWN_X, e.x + 60), Math.round(type.hp * waveHp(g)));
          this.events.push({ t: 'ability', enemy: e, what: 'summon' });
          break;
        }
        case 'charge':
          if (e.used || share > CHARGE_AT) break;
          e.used = true; e.speedMul = CHARGE_MUL; e.until = this.time + CHARGE_TIME;
          this.events.push({ t: 'ability', enemy: e, what: 'charge' });
          break;
        case 'enrage':
          if (e.used || share > ENRAGE_AT) break;
          e.used = true; e.speedMul = 1.5; e.rage = 1.6;
          this.events.push({ t: 'ability', enemy: e, what: 'enrage' });
          break;
      }
    }
  }

  private startWave(i: number): void {
    const w = this.level.waves[i];
    if (w.area !== this.area) { this.area = w.area; this.events.push({ t: 'area', area: w.area }); }
    this.wave = i;
    this.waveStart = this.time;
    this.queue = makeWave(w, this.rand, this.level.lanes, this.level.pool);
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
        // A Slugger jumps the first add-on cat in its way and lands behind it.
        if (by && e.type.ability === 'jump' && !e.used && e.x - e.type.speed * U * dt <= stop) { e.used = true; e.x = stop - UNIT_REACH - 50; this.events.push({ t: 'jump', enemy: e }); continue; }
        e.x -= e.type.speed * U * slow * e.speedMul * this.walkK * dt;
        if (e.x <= stop) { e.x = stop; e.state = 'attack'; e.blockedBy = by; e.hitTimer = e.type.hitEvery * 0.5; }
      } else if (e.state === 'attack') {
        const u = this.unitById(e.blockedBy);
        if (e.blockedBy && !u) { e.state = 'walk'; e.blockedBy = 0; continue; } // its add-on cat is gone: walk on
        e.hitTimer -= dt * slow * e.rage;
        if (e.hitTimer > 0) continue;
        e.hitTimer += e.type.hitEvery;
        if (u) {
          u.hp -= e.type.dmg * 8; // add-on cats take hits harder than crates
          if (u.hp <= 0) this.removeUnit(u);
        } else {
          this.wallHp = Math.max(this.level.tutorial ? 1 : 0, this.wallHp - e.type.dmg);
          this.events.push({ t: 'wall', enemy: e, dmg: e.type.dmg });
          // The tutorial can't be lost: once its wall is down to 1, zombies that reach it are knocked out.
          if (this.level.tutorial && this.wallHp <= 1) this.damage(e, e.hp, null, true);
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
      if (t.kind === 'tnt') for (const e of inLane) if (e.type.ability === 'jump' && !e.used && e.x <= t.x + 20 && e.x > t.x - 80) { e.used = true; e.x = t.x - 90; this.events.push({ t: 'jump', enemy: e }); }
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
      p.shots++;
      const role = roleOf(p.def.cat), lane = slotLane(p.slot), perk = !!p.def.perk, every = perk ? PERK.crossEvery : CROSS_EVERY;
      const shot = (l: number): Bullet => ({ id: this.ids++, lane: l, x: SLOT_X[p.slot % COLS] + 25, dmg: this.dmgOf(p), attack: p.def.attack, from: p.slot, pierce: role === 'pierce' ? (perk ? PERK.pierce : PIERCE) : 0, hitIds: [], knock: role === 'knockback' ? (perk ? PERK.knock : 1) : 0 });
      const b = shot(lane);
      this.bullets.push(b);
      this.events.push({ t: 'shoot', slot: p.slot, bullet: b });
      if (role === 'cross' && p.shots % every === 0) {
        // Alternate between the lane below and above (whichever is open).
        const tries = (p.shots / every) % 2 ? [lane + 1, lane - 1] : [lane - 1, lane + 1];
        const l = tries.find((x) => x >= 0 && x < LANES && this.laneOpen(x));
        if (l !== undefined) { const c = shot(l); this.bullets.push(c); this.events.push({ t: 'shoot', slot: p.slot, bullet: c }); }
      }
    }
  }

  private moveBullets(dt: number): void {
    const keep: Bullet[] = [];
    for (const b of this.bullets) {
      b.x += BULLET_SPEED * dt;
      const hit = this.enemies.find((e) => e.lane === b.lane && e.state !== 'dead' && Math.abs(e.x - b.x) < 24 && !b.hitIds.includes(e.id));
      if (hit) {
        this.hit(b, hit);
        if (b.pierce-- > 0) { b.hitIds.push(hit.id); keep.push(b); } // a Rifle shot goes on to the next zombie
        continue;
      }
      if (b.x < SPAWN_X + 40) keep.push(b);
    }
    this.bullets = keep;
  }

  private hit(b: Bullet, e: Enemy): void {
    const venomed = (o: Enemy) => (b.attack === 'blast' && this.time < o.slowUntil ? VENOM_BLAST : 1);
    this.damage(e, Math.round(b.dmg * venomed(e)), b, false);
    if (b.attack === 'venom') e.slowUntil = this.time + SLOW_TIME;
    if (b.attack === 'blast') {
      for (const o of this.enemies) if (o !== e && o.lane === b.lane && o.state !== 'dead' && Math.abs(o.x - e.x) < SPLASH_R * U) this.damage(o, Math.round(b.dmg * SPLASH_SHARE * venomed(o)), b, true);
    }
    if (b.knock && e.state !== 'dead') {
      // Bazooka hits shove the zombie back (bosses less); one fighting the wall has to walk up again.
      e.x = Math.min(SPAWN_X - 60, e.x + KNOCKBACK * b.knock * U * (e.type.boss ? 0.33 : 1));
      if (e.state === 'attack' && !e.blockedBy) e.state = 'walk';
    }
  }

  private damage(e: Enemy, dmg: number, b: Bullet | null, splash: boolean): void {
    if (e.state === 'dead') return;
    const front = !!b && !splash && b.lane === slotLane(b.from); // a shot straight down its lane
    if (e.type.ability === 'armour' && b && !splash && b.attack !== 'blast') dmg = Math.round(dmg * ARMOUR);
    if (e.shield > 0 && front) {
      const soaked = dmg * (1 - SHIELD_LET);
      e.shield -= soaked;
      dmg = Math.round(dmg * SHIELD_LET);
      if (e.shield <= 0) this.events.push({ t: 'ability', enemy: e, what: 'shieldBreak' });
    }
    e.hp -= dmg;
    this.events.push({ t: 'hit', bullet: b, enemy: e, dmg, splash });
    if (e.hp > 0) return;
    e.state = 'dead';
    const coinCat = b && this.slots[b.from]?.def.awiPerk === 'coin' ? COIN_PERK : 0; // a Coin Cat AWI's kill pays more
    const coins = (e.type.coins + coinCat) * (this.time < this.coinsUntil ? 2 : 1);
    this.coins += coins;
    this.stats.kills++;
    if (e.type.boss) this.stats.bossKills++;
    this.stats.coinsEarned += coins;
    this.events.push({ t: 'kill', enemy: e, coins });
    if (e.type.ability === 'split' && !e.child) for (const dx of [-30, 30]) this.spawn(SPLIT_CHILD, e.lane, Math.min(SPAWN_X, e.x + 40 + dx), Math.round(SPLIT_CHILD.hp * waveHp(this.level.waves[this.wave].g)), true);
  }

  private finish(won: boolean): void {
    if (this.state !== 'playing') return;
    this.state = won ? 'won' : 'lost';
    this.events.push({ t: 'end', won });
  }

  get areaName(): string { return AREAS[this.area].name; }
}
