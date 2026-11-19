// Levels: the 15 fights on the level map, plus Full Alley (milestone 1's run of all 5 areas).
// A level is a list of waves; each wave says which area's zombies come, how hard they are (g) and which bosses.
import { AREAS } from './waves.ts';

export interface WavePlan {
  area: number;     // 0–4: street art and zombie pool
  g: number;        // difficulty: zombie count, spawn gap and health (see waves.ts)
  bosses: number[]; // boss numbers 1–7 that join this wave
}

export interface LevelDef {
  /** 0–14 for the map levels; 15 = Full Alley, 16 = Endless, 17 = today's Daily Challenge; 100+ = Hard mode. */
  n: number;
  title: string;
  area: number;
  waves: WavePlan[];
  /** Open lanes (0–4); all 5 when left out. */
  lanes?: number[];
  /** Level 1: guided, waves wait for the first cat, and the wall can't fall below 1. */
  tutorial?: boolean;
  /** Only these zombies (the tutorial uses plain ones). */
  pool?: string[];
  /** A rule that changes how the level plays. */
  rule?: Rule;
  /** The third star's goal (the first two: win, and keep half the wall). */
  goal: Goal;
  /** Hard mode: the same levels with a rule each and tougher zombies. */
  hard?: boolean;
}

export type Rule = 'fog' | 'fast' | 'norepair' | 'lanes3' | 'poor';
export const RULES: Record<Rule, { name: string; blurb: string }> = {
  fog: { name: 'Fog', blurb: 'Zombies only show up near the wall' },
  fast: { name: 'Rush', blurb: 'Zombies walk a third faster' },
  norepair: { name: 'No Repair', blurb: 'The wall can\'t be repaired' },
  lanes3: { name: 'Narrow street', blurb: 'Only the middle 3 lanes' },
  poor: { name: 'Tight budget', blurb: 'Fewer starting coins and slower income' },
};
export type Goal = 'wall100' | 'noaddons' | 'cats6' | 'norepair';
export const GOALS: Record<Goal, string> = {
  wall100: 'Keep the whole wall',
  noaddons: 'Win without add-ons',
  cats6: 'Never more than 6 cats on the street',
  norepair: 'Win without repairing',
};
/** Third-star goal and rule of each map level (normal mode). Hard mode puts a rule on every level. */
const LEVEL_GOAL: Goal[] = ['wall100', 'wall100', 'cats6', 'norepair', 'noaddons', 'cats6', 'wall100', 'norepair', 'noaddons', 'cats6', 'wall100', 'noaddons', 'norepair', 'cats6', 'wall100'];
const LEVEL_RULE: Partial<Record<number, Rule>> = { 4: 'poor', 7: 'fast', 10: 'fog', 12: 'lanes3', 13: 'norepair' };
const HARD_RULE: Rule[] = ['fast', 'poor', 'fog', 'norepair', 'lanes3'];
/** Hard mode levels are numbered after Full Alley: HARD_BASE + 0…14. */
export const HARD_BASE = 100;
/** Hard mode zombies have this much more health. */
export const HARD_HP = 1.35;

export const LEVEL_COUNT = 15;
/** Level difficulty: the last wave of level n has g = PEAK_G0 + PEAK_STEP·n + PEAK_CURVE·n²; the first START_SHARE of that. */
export let PEAK_G0 = 1.6, PEAK_STEP = 0.8, PEAK_CURVE = 0, START_SHARE = 0.3;
/** For balancing from scripts/sim.mjs. */
export const tune = (g0: number, step: number, curve: number, share: number) => { PEAK_G0 = g0; PEAK_STEP = step; PEAK_CURVE = curve; START_SHARE = share; };
export const FULL_ALLEY = LEVEL_COUNT;
/** Endless: Full Alley, then Park Lane waves that keep getting harder. The best is the waves cleared. */
export const ENDLESS = LEVEL_COUNT + 1, ENDLESS_WAVES = 99;
/** Daily Challenge: one level a day, the same street, rule, goal and zombies (seed) for everyone. */
export const DAILY = LEVEL_COUNT + 2;

/** Extra bosses on the last levels: level 14 ends with Boss 6, level 15 with Boss 5 and Boss 7. */
const EXTRA_BOSS: Record<number, number[]> = { 13: [6], 14: [7] };

/** Level 1, the tutorial: 3 lanes, 3 small waves, no boss. */
export const TUTORIAL_LANES = [1, 2, 3];
const tutorial = (): LevelDef => ({
  n: 0, title: 'Level 1', area: 0, lanes: TUTORIAL_LANES, tutorial: true, pool: ['reg1'],
  waves: [0.3, 0.8, 1.4].map((g) => ({ area: 0, g, bosses: [] })), goal: 'wall100',
});

export function levelDef(n: number): LevelDef {
  if (n === FULL_ALLEY) return fullAlley();
  if (n === ENDLESS) return endless();
  if (n === DAILY) return dailyDef(dayKey(new Date()));
  if (n >= HARD_BASE) return hardLevel(n - HARD_BASE);
  if (n === 0) return tutorial();
  const area = Math.floor(n / 3), step = n % 3;
  const count = 4 + Math.round((n * 6) / 14);          // 4 waves on level 1 … 10 on level 15
  // Coins start from scratch every level, so each level ramps from easy waves up to its peak.
  const peak = PEAK_G0 + PEAK_STEP * n + PEAK_CURVE * n * n, start = peak * START_SHARE;
  const waves: WavePlan[] = Array.from({ length: count }, (_, w) => ({ area, g: start + (peak - start) * (w / (count - 1)) ** 1.3, bosses: [] }));
  const last = waves[count - 1];
  if (step === 2) last.bosses.push(area + 1);            // every area's 3rd level ends with its boss
  last.bosses.push(...(EXTRA_BOSS[n] ?? []));
  const rule = LEVEL_RULE[n];
  return { n, title: `Level ${n + 1}`, area, waves, goal: LEVEL_GOAL[n], ...(rule ? { rule, lanes: rule === 'lanes3' ? [1, 2, 3] : undefined } : {}) };
}

/** Hard mode: level n again (the tutorial becomes a normal level), harder, with a rule. */
function hardLevel(n: number): LevelDef {
  const base = n === 0 ? { ...levelDef(1), waves: levelDef(1).waves.map((w) => ({ ...w, area: 0 })) } : levelDef(n);
  const rule = HARD_RULE[n % HARD_RULE.length];
  return { ...base, n: HARD_BASE + n, title: `Hard ${n + 1}`, rule, lanes: rule === 'lanes3' ? [1, 2, 3] : undefined, hard: true, goal: LEVEL_GOAL[n], tutorial: false, pool: undefined };
}
export const isHard = (n: number) => n >= HARD_BASE;

function fullAlley(): LevelDef {
  const waves: WavePlan[] = [];
  for (let g = 0; g < AREAS.length * 3; g++) {
    const area = Math.floor(g / 3), boss = g % 3 === 2;
    waves.push({ area, g, bosses: boss ? [area + 1] : [] });
  }
  waves[13].bosses.push(6);
  waves[14].bosses.push(7);
  return { n: FULL_ALLEY, title: 'Full Alley', area: 0, waves, goal: 'wall100' };
}

function endless(): LevelDef {
  const waves = fullAlley().waves;
  for (let i = waves.length; i < ENDLESS_WAVES; i++) waves.push({ area: 4, g: 14 + (i - 14) * 0.9, bosses: i % 3 === 2 ? [1 + ((i / 3) | 0) % 7, ...(i >= 30 ? [1 + ((i * 5) % 7)] : [])] : [] });
  return { n: ENDLESS, title: 'Endless', area: 0, waves, goal: 'wall100' };
}

/** A local date as YYYY-MM-DD (the daily gift and the Daily Challenge). */
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** The day's number for seeding: everyone playing on that date gets the same one. */
export function daySeed(day: string): number {
  let h = 2166136261;
  for (const ch of `daily:${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
const GOAL_LIST = Object.keys(GOALS) as Goal[];
/** The Daily Challenge of a day: the waves of one of levels 5–12, on any street, with a rule and a goal. */
export function dailyDef(day: string): LevelDef {
  const h = daySeed(day), base = 4 + (h % 8), area = (h >>> 3) % 5;
  const rule = HARD_RULE[(h >>> 6) % HARD_RULE.length];
  const waves = levelDef(base).waves.map((w) => ({ ...w, area }));
  if (!waves[waves.length - 1].bosses.length) waves[waves.length - 1].bosses.push(area + 1);
  return { n: DAILY, title: 'Daily Challenge', area, waves, rule, lanes: rule === 'lanes3' ? [1, 2, 3] : undefined, goal: GOAL_LIST[(h >>> 9) % GOAL_LIST.length] };
}

/** What the star goals look at. */
export interface Result { wallShare: number; addonsUsed: number; repairs: number; maxCats: number }
/** The three star goals of a won level: won, half the wall kept, the level's own goal. */
export function starGoals(def: LevelDef, r: Result): boolean[] {
  const third = { wall100: r.wallShare >= 0.999, noaddons: r.addonsUsed === 0, cats6: r.maxCats <= 6, norepair: r.repairs === 0 }[def.goal];
  return [true, r.wallShare >= 0.5, third];
}
export const starsOf = (def: LevelDef, r: Result) => starGoals(def, r).filter(Boolean).length;

// ── The map ───────────────────────────────────────────────────────────────────────────────────────────
/** The road on the kit's LevelMap.png (7782×785 source px): its centre line, start to end. */
export const MAP_PATH: [number, number][] = [
  [183, 330], [183, 590], [561, 590], [561, 213], [967, 213], [967, 590], [1339, 590], [1339, 213], [1744, 213], [1744, 590],
  [2122, 590], [2122, 213], [2511, 213], [2511, 590], [2883, 590], [2883, 213], [3267, 213], [3267, 590], [3667, 590],
  [3667, 213], [4044, 213], [4044, 595], [4439, 595], [4439, 213], [4833, 213], [4833, 590], [5211, 590], [5211, 213],
  [5589, 213], [5589, 590], [5983, 590], [5983, 213], [6372, 213], [6372, 590], [6750, 590], [6750, 213], [7139, 213],
  [7139, 480], [7630, 480],
];

/** Where each level's marker stands on the map (source px): evenly spaced along the road. */
export const MAP_MARKERS: [number, number][] = (() => {
  const seg = MAP_PATH.slice(1).map((p, i) => Math.hypot(p[0] - MAP_PATH[i][0], p[1] - MAP_PATH[i][1]));
  const total = seg.reduce((a, b) => a + b, 0);
  const out: [number, number][] = [];
  for (let k = 0; k < LEVEL_COUNT; k++) {
    let d = total * (0.03 + (0.94 * k) / (LEVEL_COUNT - 1)), i = 0;
    while (d > seg[i]) d -= seg[i++];
    const [ax, ay] = MAP_PATH[i], [bx, by] = MAP_PATH[i + 1], t = d / seg[i];
    out.push([Math.round(ax + (bx - ax) * t), Math.round(ay + (by - ay) * t)]);
  }
  return out;
})();
