// Zombies, bosses, areas and how a wave is made. Which waves a fight has is up to src/game/levels.ts.
import type { WavePlan } from './levels.ts';

export interface EnemyType {
  key: string;        // art: enemy.<key>.walk / .attack / .dead
  hp: number;         // at wave 1; scaled by waveHp()
  speed: number;      // street units per second (× layout U = game px)
  dmg: number;        // wall damage per hit
  hitEvery: number;   // seconds between hits
  coins: number;      // reward
  boss?: boolean;
  /** What makes it different (see ABILITIES). */
  ability?: Ability;
}

/**
 * Zombie behaviours (one per kit zombie) and boss abilities. The sim (src/game/sim.ts) runs them; the names and
 * blurbs show on the "New zombie" cards and in the Almanac.
 */
export type Ability = 'armour' | 'runner' | 'switch' | 'jump' | 'shield' | 'heal' | 'split' | 'summon' | 'charge' | 'enrage' | 'hop';
export const ABILITIES: Record<Ability, string> = {
  armour: 'Armoured: Rapid and Venom shots do half damage. Blast hurts it fully.',
  runner: 'Runner: fast but weak.',
  switch: 'Switches to the next lane halfway down the street.',
  jump: 'Jumps over the first add-on cat or TNT Crate in its way.',
  shield: 'Shield: shots from the front do little until the shield breaks. Splash, two-lane shots and add-ons go round it.',
  heal: 'Heals the zombies around it.',
  split: 'Splits into two small zombies when it falls.',
  summon: 'Calls more zombies onto the street.',
  charge: 'Charges at the wall when it gets hurt.',
  enrage: 'Gets faster and hits harder at half health.',
  hop: 'Hops to another lane every few seconds.',
};
/** Display names for the cards and the Almanac (art keys stay reg1–8, boss1–7). */
export const ENEMY_NAMES: Record<string, string> = {
  reg1: 'Zombie', reg2: 'Pot Head', reg3: 'Granny', reg4: 'Red Cap', reg5: 'Slugger', reg6: 'Spike Tank', reg7: 'Cone Medic', reg8: 'Linebacker',
  boss1: 'Butcher', boss2: 'Sand King', boss3: 'Bridge Troll', boss4: 'Road Rager', boss5: 'Park Keeper', boss6: 'Brute', boss7: 'Zombie King',
};

export const ENEMIES: Record<string, EnemyType> = {
  reg1: { key: 'reg1', hp: 60, speed: 45, dmg: 1, hitEvery: 1, coins: 8 },                       // plain zombie
  reg2: { key: 'reg2', hp: 95, speed: 38, dmg: 1, hitEvery: 1, coins: 9, ability: 'armour' },     // pot helmet
  reg3: { key: 'reg3', hp: 45, speed: 70, dmg: 1, hitEvery: 0.8, coins: 8, ability: 'runner' },   // granny: fast, fragile
  reg4: { key: 'reg4', hp: 80, speed: 50, dmg: 2, hitEvery: 1, coins: 9, ability: 'switch' },     // red cap
  reg5: { key: 'reg5', hp: 75, speed: 58, dmg: 1, hitEvery: 0.9, coins: 9, ability: 'jump' },     // baseball cap
  reg6: { key: 'reg6', hp: 150, speed: 34, dmg: 2, hitEvery: 1.2, coins: 12, ability: 'shield' }, // spiked helmet: tank
  reg7: { key: 'reg7', hp: 120, speed: 40, dmg: 2, hitEvery: 1, coins: 11, ability: 'heal' },     // traffic cone
  reg8: { key: 'reg8', hp: 95, speed: 62, dmg: 2, hitEvery: 0.9, coins: 11, ability: 'split' },   // football helmet
};
/** The small zombies a Linebacker splits into (a Granny's art, less health). */
export const SPLIT_CHILD: EnemyType = { ...ENEMIES.reg3, hp: 30, coins: 3, ability: undefined };
const BOSS_ABILITY: Record<number, Ability> = { 1: 'summon', 2: 'charge', 3: 'enrage', 4: 'summon', 5: 'charge', 6: 'hop', 7: 'summon' };
/** Who a summoning boss calls in. */
export const MINION: Record<number, string> = { 1: 'reg1', 4: 'reg3', 7: 'reg6' };
const boss = (n: number, hp: number, speed: number): EnemyType => ({ key: `boss${n}`, hp, speed, dmg: 5, hitEvery: 1.3, coins: 60, boss: true, ability: BOSS_ABILITY[n] });
/** Boss health is absolute (not scaled by waveHp). Bosses 1–5 close their area; 6 and 7 join the last fights. */
export const BOSSES: Record<number, EnemyType> = {
  1: boss(1, 700, 34), 2: boss(2, 1200, 36), 3: boss(3, 1900, 34), 4: boss(4, 2800, 38), 5: boss(5, 4000, 36),
  6: boss(6, 3000, 40), 7: boss(7, 4600, 32),
};

export interface Area { name: string; bg: string; pool: string[] }
export const AREAS: Area[] = [
  { name: 'Main Street', bg: 'bg.area1', pool: ['reg1', 'reg1', 'reg2'] },
  { name: 'Sand Lot', bg: 'bg.area2', pool: ['reg1', 'reg2', 'reg3', 'reg4'] },
  { name: 'Overpass', bg: 'bg.area3', pool: ['reg2', 'reg3', 'reg4', 'reg5', 'reg6'] },
  { name: 'Rush Hour', bg: 'bg.area4', pool: ['reg3', 'reg4', 'reg5', 'reg6', 'reg7'] },
  { name: 'Park Lane', bg: 'bg.area5', pool: ['reg4', 'reg5', 'reg6', 'reg7', 'reg8'] },
];
/** Enemy health grows with a wave's difficulty g (0 on level 1, 14 at the end of Full Alley). */
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
export function makeWave(w: WavePlan, rand: () => number, open: number[] = [0, 1, 2, 3, 4], only?: string[]): Spawn[] {
  const area = { ...AREAS[w.area], pool: only ?? AREAS[w.area].pool }, g = w.g;
  const count = Math.round((5 + g * 0.8) * (w.bosses.length ? 0.6 : 1));
  const gap = Math.max(0.38, 0.85 - g * 0.035);
  const out: Spawn[] = [];
  let lastLane = -1;
  for (let i = 0; i < count; i++) {
    let lane = open[Math.floor(rand() * open.length)];
    if (lane === lastLane) lane = open[Math.floor(rand() * open.length)]; // fewer same-lane streaks
    lastLane = lane;
    out.push({ at: i * gap + rand() * gap * 0.5, type: ENEMIES[area.pool[Math.floor(rand() * area.pool.length)]], lane });
  }
  const lanes = [1, 2, 3, 0, 4].filter((l) => open.includes(l)).sort(() => rand() - 0.5);
  w.bosses.forEach((b, i) => out.push({ at: 1 + i * 2.5, type: BOSSES[b], lane: lanes[i % lanes.length] }));
  return out.sort((a, b) => a.at - b.at);
}
