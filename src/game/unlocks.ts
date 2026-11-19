// What each level unlocks: something new after every level cleared (a cat, an add-on, or a feature), revealed on the
// "You Win" screen. The player starts with one cat. AWIs (Altered World Items) skip the queue: owning an AWI of a cat
// or add-on unlocks it right away. Pure TS: the sim and `npm run sim -- --campaign` follow the same order.
import type { AddonId } from './addons.ts';

export type Feature = 'repair' | 'cats' | 'addons' | 'merge' | 'alley' | 'hard' | 'daily' | 'endless';
export type Unlock = { kind: 'cat'; cat: number } | { kind: 'addon'; id: AddonId } | { kind: 'feature'; id: Feature };

export const FEATURES: Record<Feature, { name: string; blurb: string }> = {
  repair: { name: 'Repair Wall', blurb: 'Tap the wall button in a fight to fix a quarter of the wall (coins)' },
  cats: { name: 'Cats screen', blurb: 'Spend gems on cat upgrades and pick your deck' },
  addons: { name: 'Add-ons', blurb: 'Take power-ups into a fight: tap one, then a lane' },
  merge: { name: 'Merging', blurb: 'Drag a cat onto the same cat to make one stronger cat' },
  alley: { name: 'Full Alley', blurb: 'All 5 areas in one run' },
  hard: { name: 'Hard mode', blurb: 'The 15 levels again, with rules and tougher zombies' },
  daily: { name: 'Daily Challenge', blurb: 'A new level every day, the same for everyone' },
  endless: { name: 'Endless', blurb: 'How many waves can you hold? Beat your best' },
};

/** The cat everyone starts with. */
export const START_CAT = 1;

const cat = (c: number): Unlock => ({ kind: 'cat', cat: c });
const addon = (id: AddonId): Unlock => ({ kind: 'addon', id });
const feature = (id: Feature): Unlock => ({ kind: 'feature', id });

/** UNLOCKS[n]: what clearing level n (0-based) unlocks. */
export const UNLOCKS: Unlock[][] = [
  [cat(6)],                          // 1, the tutorial: Smokey (Venom)
  [feature('repair')],               // 2
  [cat(11), feature('cats')],        // 3: Snowy (Rapid) and the Cats screen
  [addon('rocket'), feature('addons')], // 4
  [cat(2)],                          // 5
  [feature('merge'), feature('daily')], // 6
  [cat(7), addon('bomb')],           // 7
  [cat(12), addon('tnt')],           // 8
  [cat(3), addon('guard')],          // 9
  [cat(8), addon('timebomb')],       // 10
  [cat(13), addon('spikes')],        // 11
  [cat(4), addon('coins')],          // 12
  [cat(9), addon('boxer')],          // 13
  [cat(14)],                         // 14
  [cat(5), cat(10), cat(15), feature('alley'), feature('endless'), feature('hard')], // 15
];

/** Every free cat in the order it unlocks (the Cats screen lists them like this). */
export const CAT_ORDER: number[] = [START_CAT, ...UNLOCKS.flat().flatMap((u) => (u.kind === 'cat' ? [u.cat] : []))];

/** The level (1-based) whose clear unlocks this; 0 = from the start. */
function levelOf(match: (u: Unlock) => boolean): number {
  const i = UNLOCKS.findIndex((us) => us.some(match));
  return i + 1;
}
export const catLevel = (c: number) => (c === START_CAT ? 0 : levelOf((u) => u.kind === 'cat' && u.cat === c));
export const addonLevel = (id: AddonId) => levelOf((u) => u.kind === 'addon' && u.id === id);
export const featureLevel = (f: Feature) => levelOf((u) => u.kind === 'feature' && u.id === f);

/** Unlocked after clearing the first `cleared` levels in a row. */
export const catOpen = (cleared: number, c: number) => cleared >= catLevel(c);
export const addonOpen = (cleared: number, id: AddonId) => cleared >= addonLevel(id);
export const featureOpen = (cleared: number, f: Feature) => cleared >= featureLevel(f);
