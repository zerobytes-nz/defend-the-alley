// Achievements: one-off goals across all play, each paying gems once. Checked after every fight (and after
// upgrades); the Almanac lists them. Pure TS so `npm run sim -- --campaign` earns them too.
import { CAT_STEPS } from './cats.ts';
import { ADDON_IDS } from './addons.ts';
import { LEVEL_COUNT } from './levels.ts';
import { ADDON_STEPS, addonStep, levelsCleared, type Save } from './progress.ts';
import type { Stats } from './sim.ts';

export interface Achievement { id: string; name: string; blurb: string; gems: number; done: (s: Save) => boolean }

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', name: 'First Defence', blurb: 'Clear level 1', gems: 20, done: (s) => levelsCleared(s) >= 1 },
  { id: 'area1', name: 'Main Street Safe', blurb: 'Clear level 3 (beat Boss 1)', gems: 40, done: (s) => levelsCleared(s) >= 3 },
  { id: 'half', name: 'Halfway Down', blurb: 'Clear level 8', gems: 60, done: (s) => levelsCleared(s) >= 8 },
  { id: 'all', name: 'Alley Cat', blurb: 'Clear all 15 levels', gems: 150, done: (s) => levelsCleared(s) >= LEVEL_COUNT },
  { id: 'stars3', name: 'Perfect', blurb: 'Get 3 stars on a level', gems: 30, done: (s) => s.stars.some((n) => n >= 3) },
  { id: 'stars45', name: 'Star Collector', blurb: 'Get all 45 stars', gems: 250, done: (s) => sum(s.stars) >= LEVEL_COUNT * 3 },
  { id: 'hard', name: 'Hard as Nails', blurb: 'Clear all 15 Hard levels', gems: 300, done: (s) => s.hard.every((n) => n > 0) },
  { id: 'kills500', name: 'Zombie Sweeper', blurb: 'Stop 500 zombies', gems: 40, done: (s) => s.totals.kills >= 500 },
  { id: 'kills5k', name: 'Zombie Hunter', blurb: 'Stop 5,000 zombies', gems: 150, done: (s) => s.totals.kills >= 5000 },
  { id: 'bosses', name: 'Boss Basher', blurb: 'Beat 25 bosses', gems: 80, done: (s) => s.totals.bosses >= 25 },
  { id: 'merge', name: 'Better Together', blurb: 'Merge cats 20 times', gems: 40, done: (s) => s.totals.merges >= 20 },
  { id: 'maxcat', name: 'Top Cat', blurb: 'Upgrade a cat all 5 steps (perk!)', gems: 50, done: (s) => s.cat.some((n) => n >= CAT_STEPS) },
  { id: 'maxaddon', name: 'Gadget Cat', blurb: 'Upgrade an add-on all 3 steps', gems: 50, done: (s) => ADDON_IDS.some((id) => addonStep(s, id) >= ADDON_STEPS) },
  { id: 'daily', name: 'Daily Defender', blurb: 'Win 5 Daily Challenges', gems: 80, done: (s) => s.totals.dailies >= 5 },
  { id: 'endless25', name: 'Holding Out', blurb: 'Clear 25 waves in Endless', gems: 100, done: (s) => s.endless >= 25 },
  { id: 'endless40', name: 'Last Cat Standing', blurb: 'Clear 40 waves in Endless', gems: 200, done: (s) => s.endless >= 40 },
];

/** Add a fight's numbers to the lifetime totals. */
export function addTotals(s: Save, st: Stats, won: boolean): void {
  s.totals.kills += st.kills;
  s.totals.bosses += st.bossKills;
  s.totals.merges += st.merges;
  s.totals.addons += st.addonsUsed;
  if (won) s.totals.wins++;
}

/** Award every achievement newly done: adds the gems and returns them (for the "Achievement!" lines). */
export function checkAchievements(s: Save): Achievement[] {
  const got = ACHIEVEMENTS.filter((a) => !s.ach.includes(a.id) && a.done(s));
  for (const a of got) { s.ach.push(a.id); s.gems += a.gems; }
  return got;
}
