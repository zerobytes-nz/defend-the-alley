// Add-ons, the "Extra" screen: one-use power-ups taken into a level (the kit's AddonIcon1–8).
// Bought ones cost gems and are used up; an add-on AWI (an NFT) gives free uses every level and is stronger by rarity.
import type { Rarity } from './cats.ts';

export type AddonId = 'rocket' | 'coins' | 'bomb' | 'timebomb' | 'guard' | 'tnt' | 'boxer' | 'spikes';
export const ADDON_IDS: AddonId[] = ['rocket', 'coins', 'bomb', 'timebomb', 'guard', 'tnt', 'boxer', 'spikes'];

export interface AddonDef {
  name: string;
  blurb: string;
  /** True: after tapping the button, tap a lane. */
  lane: boolean;
}

export const ADDONS: Record<AddonId, AddonDef> = {
  rocket: { name: 'Rocket Strike', blurb: 'Hits every zombie in one lane', lane: true },
  coins: { name: 'Coins ×2', blurb: 'Double coins for 30 seconds', lane: false },
  bomb: { name: 'Big Bomb', blurb: 'Hurts every zombie on the street', lane: false },
  timebomb: { name: 'Time Bomb', blurb: 'Big blast in a lane after 3 seconds', lane: true },
  guard: { name: 'Cat Guardian', blurb: 'Holds a lane by the wall for a while', lane: true },
  tnt: { name: 'TNT Crate', blurb: 'Blows up the first zombie to reach it', lane: true },
  boxer: { name: 'Boxer Cat', blurb: 'Punches zombies mid-street for a while', lane: true },
  spikes: { name: 'Spike Trap', blurb: 'Slows and hurts zombies for 20 seconds', lane: true },
};

/** Numbers the simulation uses (damage at power 1; game px; seconds). */
export const ADDON_TUNING = {
  rocket: { dmg: 160 },
  coins: { time: 30, mult: 2 },
  bomb: { dmg: 100 },
  timebomb: { delay: 3, dmg: 300, r: 210 },
  guard: { x: 790, hp: 450, dmg: 30, every: 0.8, time: 25 },
  tnt: { x: 1060, dmg: 260, r: 180 },
  boxer: { x: 960, hp: 240, dmg: 55, every: 0.55, time: 25 },
  spikes: { x0: 860, x1: 1120, dps: 28, time: 20 },
} as const;

/** Gem shop rules (the kit's Extra screen): price each, how many you can hold, and the extra loadout slots. */
export const ADDON_PRICE = 25, ADDON_MAX = 5;
export const SLOT_PRICES = [300, 400] as const; // slots 3 and 4; slots 1 and 2 are open from the start
export const SLOTS_MAX = 4;

/** Add-on AWIs: free uses every level and strength, by rarity. */
export const AWI_ADDON_USES: Record<Rarity, number> = { Common: 1, Rare: 1, Epic: 2, Legendary: 3 };
export const AWI_ADDON_POWER: Record<Rarity, number> = { Common: 1, Rare: 1.2, Epic: 1.4, Legendary: 1.7 };

/** One equipped add-on inside a fight. */
export interface Equipped { key: string; id: AddonId; uses: number; power: number; awi: boolean }
