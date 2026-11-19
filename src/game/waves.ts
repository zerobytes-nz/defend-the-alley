// The run: 5 areas × 3 waves (two zombie waves, then a boss), about 2½ minutes.
import { LANES } from './layout.ts';

export interface EnemyType {
  key: string;        // art: enemy.<key>.walk / .attack / .dead
  hp: number;         // at wave 1; scaled by waveHp()
  speed: number;      // px per second
  dmg: number;        // wall damage per hit
  hitEvery: number;   // seconds between hits
  coins: number;      // reward
  boss?: boolean;
}

export const ENEMIES: Record<string, EnemyType> = {
  reg1: { key: 'reg1', hp: 60, speed: 45, dmg: 1, hitEvery: 1, coins: 8 },   // plain zombie
  reg2: { key: 'reg2', hp: 95, speed: 38, dmg: 1, hitEvery: 1, coins: 9 },   // pot helmet
  reg3: { key: 'reg3', hp: 45, speed: 70, dmg: 1, hitEvery: 0.8, coins: 8 }, // granny: fast, fragile
  reg4: { key: 'reg4', hp: 80, speed: 50, dmg: 2, hitEvery: 1, coins: 9 },   // red cap
  reg5: { key: 'reg5', hp: 75, speed: 58, dmg: 1, hitEvery: 0.9, coins: 9 }, // baseball cap
  reg6: { key: 'reg6', hp: 150, speed: 34, dmg: 2, hitEvery: 1.2, coins: 12 }, // spiked helmet: tank
  reg7: { key: 'reg7', hp: 120, speed: 40, dmg: 2, hitEvery: 1, coins: 11 }, // traffic cone
  reg8: { key: 'reg8', hp: 95, speed: 62, dmg: 2, hitEvery: 0.9, coins: 11 }, // football helmet
};
const boss = (n: number, hp: number, speed: number): EnemyType => ({ key: `boss${n}`, hp, speed, dmg: 5, hitEvery: 1.3, coins: 60, boss: true });
/** Boss health is absolute (not scaled by waveHp): one boss closes each area. */
export const BOSSES = [boss(1, 700, 34), boss(2, 1200, 36), boss(3, 1900, 34), boss(4, 2800, 38), boss(5, 4000, 36)];

export interface Area { name: string; bg: string; pool: string[] }
export const AREAS: Area[] = [
  { name: 'Main Street', bg: 'bg.area1', pool: ['reg1', 'reg2'] },
  { name: 'Sand Lot', bg: 'bg.area2', pool: ['reg1', 'reg2', 'reg3', 'reg4'] },
  { name: 'Overpass', bg: 'bg.area3', pool: ['reg2', 'reg3', 'reg4', 'reg5', 'reg6'] },
  { name: 'Rush Hour', bg: 'bg.area4', pool: ['reg3', 'reg4', 'reg5', 'reg6', 'reg7'] },
  { name: 'Park Lane', bg: 'bg.area5', pool: ['reg4', 'reg5', 'reg6', 'reg7', 'reg8'] },
];
export const WAVES_PER_AREA = 3;
export const TOTAL_WAVES = AREAS.length * WAVES_PER_AREA;

/** Enemy health grows each wave (global wave index 0–14). */
export const waveHp = (g: number) => 1 + 0.14 * g + 0.007 * g * g;

export interface Spawn { at: number; type: EnemyType; lane: number }

/** Small deterministic RNG (mulberry32), so a seed replays the same run. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The spawns of one wave, times in seconds from the wave's start. */
export function makeWave(g: number, rand: () => number): Spawn[] {
  const area = AREAS[Math.floor(g / WAVES_PER_AREA)];
  const w = g % WAVES_PER_AREA;
  const isBoss = w === WAVES_PER_AREA - 1;
  const count = Math.round((5 + g * 0.8) * (isBoss ? 0.6 : 1));
  const gap = Math.max(0.38, 0.85 - g * 0.035);
  const out: Spawn[] = [];
  let lastLane = -1;
  for (let i = 0; i < count; i++) {
    let lane = Math.floor(rand() * LANES);
    if (lane === lastLane) lane = Math.floor(rand() * LANES); // fewer same-lane streaks
    lastLane = lane;
    out.push({ at: i * gap + rand() * gap * 0.5, type: ENEMIES[area.pool[Math.floor(rand() * area.pool.length)]], lane });
  }
  if (isBoss) out.push({ at: 1, type: BOSSES[Math.floor(g / WAVES_PER_AREA)], lane: 1 + Math.floor(rand() * 3) });
  return out.sort((a, b) => a.at - b.at);
}
