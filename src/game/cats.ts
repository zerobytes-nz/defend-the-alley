// Cat defenders: what a cat defender AWI (Altered World Item) becomes in Defend the Alley.
//
// Every defender is one of the kit's 15 cats (C1–C15) plus an attack type (the bullet colour) and a rarity.
// AWIs come from TheoSwap item data (src/game/awi.ts): the NFT's seed picks the cat, attack and rarity, and
// makeDefender() derives the stats (damage, fire rate, range) unless the item overrides them.
// Everyone also has free Common cats, unlocked by clearing levels (src/game/progress.ts).

export const RARITIES = ['Common', 'Rare', 'Epic', 'Legendary'] as const;
export type Rarity = (typeof RARITIES)[number];
export const RARITY_COLOR: Record<Rarity, number> = { Common: 0xd8d8d8, Rare: 0x3fa9ff, Epic: 0xc06bff, Legendary: 0xffb020 };
const RARITY_DMG: Record<Rarity, number> = { Common: 1, Rare: 1.3, Epic: 1.7, Legendary: 2.3 };
const RARITY_RATE: Record<Rarity, number> = { Common: 1, Rare: 1.05, Epic: 1.1, Legendary: 1.2 };
const RARITY_RANGE: Record<Rarity, number> = { Common: 0, Rare: 20, Epic: 40, Legendary: 60 };

export type Attack = 'blast' | 'rapid' | 'venom';
export const ATTACKS: Record<Attack, { name: string; blurb: string; dmg: number; rate: number }> = {
  blast: { name: 'Blast', blurb: 'Splash damage', dmg: 1.25, rate: 0.75 },
  rapid: { name: 'Rapid', blurb: 'Fast fire', dmg: 0.6, rate: 1.8 },
  venom: { name: 'Venom', blurb: 'Slows enemies', dmg: 0.85, rate: 1 },
};
/** Blast bullets hurt every enemy this close to the hit (street units), at this share of the damage. */
export const SPLASH_R = 70, SPLASH_SHARE = 0.6;
/** Venom: enemies walk at this share of their speed for this many seconds. */
export const SLOW_FACTOR = 0.55, SLOW_TIME = 1.6;

/** The three cat families in the kit: bazooka tabbies (C1–5), blaster greys (C6–10), rifle whites (C11–15). */
const FAMILIES = [
  { name: 'Bazooka', dmg: 30, rate: 0.8, range: 520, muzzle: [25, -34] },
  { name: 'Blaster', dmg: 19, rate: 1.25, range: 470, muzzle: [32, -35] },
  { name: 'Rifle', dmg: 14, rate: 1.75, range: 600, muzzle: [32, -26] },
] as const;
const CAT_NAMES = ['Ginger', 'Beanie', 'Bandana', 'Pinky', 'Hoodie', 'Smokey', 'Bandit', 'Goggles', 'Top Hat', 'Captain', 'Snowy', 'Violet', 'Racer', 'Viking', 'Ninja'];

export interface Defender {
  uid: string;
  name: string;         // "Goggles", "Goggles #42" for an NFT
  cat: number;          // 1–15: which kit cat (art key cat.c<n>.*)
  attack: Attack;
  rarity: Rarity;
  dmg: number;          // per hit, level 1
  rate: number;         // shots per second
  range: number;        // street units in front of the cat (× layout U = game px)
  source: 'guest' | 'nft';
  /** The NFT's collection (contract), for the collection bonus in milestone 4. */
  collection?: string;
}

export const family = (cat: number) => FAMILIES[Math.floor((cat - 1) / 5)];
export const catName = (cat: number) => CAT_NAMES[cat - 1];
/** Where bullets leave the gun, relative to the cat's feet (game px at display scale). */
export const muzzleOffset = (cat: number) => family(cat).muzzle;

export function makeDefender(cat: number, attack: Attack, rarity: Rarity, extra: Partial<Defender> = {}): Defender {
  const f = family(cat), a = ATTACKS[attack];
  const k = 1 + ((cat - 1) % 5) * 0.04; // fancier outfits in a family are a little stronger
  return {
    uid: `${extra.source ?? 'guest'}:c${cat}:${attack}:${rarity}`,
    name: catName(cat),
    cat, attack, rarity,
    dmg: Math.round(f.dmg * a.dmg * k * RARITY_DMG[rarity]),
    rate: Math.round(f.rate * a.rate * RARITY_RATE[rarity] * 100) / 100,
    range: f.range + RARITY_RANGE[rarity],
    source: 'guest',
    ...extra,
  };
}

/** The attack of each free cat: the three attacks rotate through every family. */
export const GUEST_ATTACK = (cat: number): Attack => (['blast', 'venom', 'rapid'] as const)[(Math.floor((cat - 1) / 5) + ((cat - 1) % 5)) % 3];
/** The free Common version of a cat (everyone gets these as levels unlock them). */
export const guestCat = (cat: number): Defender => makeDefender(cat, GUEST_ATTACK(cat), 'Common');

/** The three cats everyone starts with: one of each family and attack (Ginger · Blast, Smokey · Venom, Snowy · Rapid). */
export const GUEST_DECK: Defender[] = [guestCat(1), guestCat(6), guestCat(11)];

/** Cat upgrades (Cats screen): 5 steps per cat, bought with gems. Each step adds damage and a little fire rate. */
export const CAT_STEPS = 5;
export const STEP_DMG = 0.07, STEP_RATE = 0.02;
export function upgraded(d: Defender, step: number): Defender {
  if (!step) return d;
  return { ...d, dmg: Math.round(d.dmg * (1 + STEP_DMG * step)), rate: Math.round(d.rate * (1 + STEP_RATE * step) * 100) / 100 };
}

/** Damage per second, for sorting cards. */
export const dps = (d: Defender) => d.dmg * d.rate * (d.attack === 'blast' ? 1.3 : 1);

/** Placing a cat: the first copy of a card costs PLACE_COST, each further copy of the same card PLACE_STEP more. */
export const PLACE_COST = 30, PLACE_STEP = 10;
/** Upgrading a placed cat (tap it): level 2, 3, 4. Each level multiplies damage. */
export const UPGRADE_COST = [35, 60, 95] as const;
export const MAX_LEVEL = 4, LEVEL_DMG = 1.45;
