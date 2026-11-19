// Levels: the 15 fights on the level map, plus Full Alley (milestone 1's run of all 5 areas).
// A level is a list of waves; each wave says which area's zombies come, how hard they are (g) and which bosses.
import { AREAS } from './waves.ts';

export interface WavePlan {
  area: number;     // 0–4: street art and zombie pool
  g: number;        // difficulty: zombie count, spawn gap and health (see waves.ts)
  bosses: number[]; // boss numbers 1–7 that join this wave
}

export interface LevelDef {
  /** 0–14 for the map levels; 15 = Full Alley. */
  n: number;
  title: string;
  area: number;
  waves: WavePlan[];
}

export const LEVEL_COUNT = 15;
/** Level difficulty: the last wave of level n has g = PEAK_G0 + PEAK_STEP·n + PEAK_CURVE·n²; the first START_SHARE of that. */
export let PEAK_G0 = 1.5, PEAK_STEP = 0.95, PEAK_CURVE = 0.006, START_SHARE = 0.3;
/** For balancing from scripts/sim.mjs. */
export const tune = (g0: number, step: number, curve: number, share: number) => { PEAK_G0 = g0; PEAK_STEP = step; PEAK_CURVE = curve; START_SHARE = share; };
export const FULL_ALLEY = LEVEL_COUNT;

/** Extra bosses on the last levels: level 14 ends with Boss 6, level 15 with Boss 5 and Boss 7. */
const EXTRA_BOSS: Record<number, number[]> = { 13: [6], 14: [7] };

export function levelDef(n: number): LevelDef {
  if (n === FULL_ALLEY) return fullAlley();
  const area = Math.floor(n / 3), step = n % 3;
  const count = 4 + Math.round((n * 6) / 14);          // 4 waves on level 1 … 10 on level 15
  // Coins start from scratch every level, so each level ramps from easy waves up to its peak.
  const peak = PEAK_G0 + PEAK_STEP * n + PEAK_CURVE * n * n, start = peak * START_SHARE;
  const waves: WavePlan[] = Array.from({ length: count }, (_, w) => ({ area, g: start + (peak - start) * (w / (count - 1)) ** 1.3, bosses: [] }));
  const last = waves[count - 1];
  if (step === 2) last.bosses.push(area + 1);            // every area's 3rd level ends with its boss
  last.bosses.push(...(EXTRA_BOSS[n] ?? []));
  return { n, title: `Level ${n + 1}`, area, waves };
}

function fullAlley(): LevelDef {
  const waves: WavePlan[] = [];
  for (let g = 0; g < AREAS.length * 3; g++) {
    const area = Math.floor(g / 3), boss = g % 3 === 2;
    waves.push({ area, g, bosses: boss ? [area + 1] : [] });
  }
  waves[13].bosses.push(6);
  waves[14].bosses.push(7);
  return { n: FULL_ALLEY, title: 'Full Alley', area: 0, waves };
}

/** Stars for a cleared level, from the wall's health left (share of its maximum). */
export const starsFor = (wallShare: number) => (wallShare >= 0.999 ? 3 : wallShare >= 0.5 ? 2 : 1);

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
