// The defense, as pure TypeScript: fixed 60 Hz steps, seeded, no Phaser. The scene sends commands
// (place, upgrade) and draws what happened from `events`; `npm run sim` plays it with a bot to balance it.
import { ATTACKS, LEVEL_DMG, MAX_LEVEL, PLACE_COST, PLACE_STEP, SLOW_FACTOR, SLOW_TIME, SPLASH_R, SPLASH_SHARE, UPGRADE_COST, type Defender } from './cats.ts';
import { COLS, LANES, SLOT_X, SPAWN_X, STOP_X, U, slotLane } from './layout.ts';
import { AREAS, TOTAL_WAVES, WAVES_PER_AREA, makeWave, rng, waveHp, type EnemyType, type Spawn } from './waves.ts';

export const STEP = 1 / 60;
const BULLET_SPEED = 900 * U;
const START_COINS = 150, INCOME_PER_S = 3;
const FIRST_WAVE_AT = 3;          // seconds to place the first cats
const WAVE_TIMEOUT = 2.5;          // next wave starts this long after the last spawn even if enemies remain
const AREA_BREAK = 2;             // banner between areas
export const WALL_HP = 100;

export interface Placed { id: number; slot: number; def: Defender; level: number; cooldown: number }
export interface Enemy {
  id: number; type: EnemyType; lane: number; x: number;
  hp: number; maxHp: number; slowUntil: number; hitTimer: number;
  state: 'walk' | 'attack' | 'dead';
}
export interface Bullet { id: number; lane: number; x: number; dmg: number; attack: Defender['attack']; from: number }

export type SimEvent =
  | { t: 'wave'; wave: number; area: number; boss: boolean }
  | { t: 'area'; area: number }
  | { t: 'spawn'; enemy: Enemy }
  | { t: 'shoot'; slot: number; bullet: Bullet }
  | { t: 'hit'; bullet: Bullet; enemy: Enemy; dmg: number; splash: boolean }
  | { t: 'kill'; enemy: Enemy; coins: number }
  | { t: 'wall'; enemy: Enemy; dmg: number }
  | { t: 'place'; cat: Placed }
  | { t: 'upgrade'; cat: Placed }
  | { t: 'end'; won: boolean };

export interface Stats { kills: number; bossKills: number; coinsEarned: number; placed: number; upgrades: number }

export class Defense {
  time = 0;
  coins = START_COINS;
  wallHp = WALL_HP;
  wave = -1;                     // global wave index 0–14, -1 before the first
  area = 0;
  state: 'playing' | 'won' | 'lost' = 'playing';
  slots: (Placed | null)[] = Array(LANES * COLS).fill(null);
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  events: SimEvent[] = [];
  stats: Stats = { kills: 0, bossKills: 0, coinsEarned: 0, placed: 0, upgrades: 0 };
  /** How many copies of each card (by uid) are on the street. */
  copies = new Map<string, number>();

  private rand: () => number;
  private queue: Spawn[] = [];
  private waveStart = 0;
  private nextWaveAt = FIRST_WAVE_AT;
  private ids = 1;
  private income = 0;

  readonly deck: Defender[];
  readonly seed: number;

  constructor(deck: Defender[], seed = 1) {
    this.deck = deck;
    this.seed = seed;
    this.rand = rng(seed);
  }

  // ── Commands ─────────────────────────────────────────────────────────────────────────────────────
  placeCost(def: Defender): number { return PLACE_COST + PLACE_STEP * (this.copies.get(def.uid) ?? 0); }
  upgradeCost(p: Placed): number | null { return p.level >= MAX_LEVEL ? null : UPGRADE_COST[p.level - 1]; }

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

  dmgOf(p: Placed): number { return Math.round(p.def.dmg * LEVEL_DMG ** (p.level - 1)); }

  // ── Simulation ───────────────────────────────────────────────────────────────────────────────────
  step(): void {
    if (this.state !== 'playing') return;
    const dt = STEP;
    this.time += dt;
    this.income += INCOME_PER_S * dt;
    if (this.income >= 1) { const n = Math.floor(this.income); this.coins += n; this.income -= n; }

    this.runWaves();
    this.moveEnemies(dt);
    this.fire(dt);
    this.moveBullets(dt);
    this.enemies = this.enemies.filter((e) => e.state !== 'dead');
    if (this.wallHp <= 0) this.finish(false);
  }

  private runWaves(): void {
    while (this.queue.length && this.time >= this.waveStart + this.queue[0].at) {
      const s = this.queue.shift()!;
      const hp = Math.round(s.type.boss ? s.type.hp : s.type.hp * waveHp(this.wave));
      const e: Enemy = { id: this.ids++, type: s.type, lane: s.lane, x: SPAWN_X, hp, maxHp: hp, slowUntil: 0, hitTimer: 0, state: 'walk' };
      this.enemies.push(e);
      this.events.push({ t: 'spawn', enemy: e });
    }
    const lastWave = this.wave === TOTAL_WAVES - 1;
    if (this.wave >= 0 && !this.queue.length) {
      const clear = this.enemies.length === 0;
      const endOfArea = this.wave % WAVES_PER_AREA === WAVES_PER_AREA - 1;
      if (clear && lastWave) return this.finish(true);
      // The boss wave of an area must be cleared before the next area; other waves time out.
      if (clear && this.nextWaveAt > this.time + (endOfArea ? AREA_BREAK : 0.8)) this.nextWaveAt = this.time + (endOfArea ? AREA_BREAK : 0.8);
      if (!clear && endOfArea) this.nextWaveAt = Math.max(this.nextWaveAt, this.time + AREA_BREAK);
    }
    if (this.time >= this.nextWaveAt && !this.queue.length && !lastWave) this.startWave(this.wave + 1);
  }

  private startWave(g: number): void {
    const area = Math.floor(g / WAVES_PER_AREA);
    if (area !== this.area) { this.area = area; this.events.push({ t: 'area', area }); }
    this.wave = g;
    this.waveStart = this.time;
    this.queue = makeWave(g, this.rand);
    const last = this.queue[this.queue.length - 1]?.at ?? 0;
    this.nextWaveAt = this.time + last + WAVE_TIMEOUT;
    this.events.push({ t: 'wave', wave: g, area, boss: g % WAVES_PER_AREA === WAVES_PER_AREA - 1 });
  }

  private moveEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (e.state === 'walk') {
        const v = e.type.speed * U * (this.time < e.slowUntil ? SLOW_FACTOR : 1);
        e.x -= v * dt;
        if (e.x <= STOP_X) { e.x = STOP_X; e.state = 'attack'; e.hitTimer = e.type.hitEvery * 0.5; }
      } else if (e.state === 'attack') {
        e.hitTimer -= dt * (this.time < e.slowUntil ? SLOW_FACTOR : 1);
        if (e.hitTimer <= 0) {
          e.hitTimer += e.type.hitEvery;
          this.wallHp = Math.max(0, this.wallHp - e.type.dmg);
          this.events.push({ t: 'wall', enemy: e, dmg: e.type.dmg });
        }
      }
    }
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

  private damage(e: Enemy, dmg: number, b: Bullet, splash: boolean): void {
    e.hp -= dmg;
    this.events.push({ t: 'hit', bullet: b, enemy: e, dmg, splash });
    if (e.hp > 0) return;
    e.state = 'dead';
    this.coins += e.type.coins;
    this.stats.kills++;
    if (e.type.boss) this.stats.bossKills++;
    this.stats.coinsEarned += e.type.coins;
    this.events.push({ t: 'kill', enemy: e, coins: e.type.coins });
  }

  private finish(won: boolean): void {
    if (this.state !== 'playing') return;
    this.state = won ? 'won' : 'lost';
    this.events.push({ t: 'end', won });
  }

  /** Progress through the run, 0–1 (for the HUD). */
  get progress(): number { return Math.max(0, this.wave + 1) / TOTAL_WAVES; }
  get areaName(): string { return AREAS[this.area].name; }
}

export { ATTACKS };
