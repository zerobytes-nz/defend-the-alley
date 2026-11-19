// Cat defenders: what an AWI (Altered World Item) becomes in Defend the Alley.
//
// Every defender is one of the kit's 15 cats (C1–C15) plus an attack type (the bullet colour) and a rarity.
// Milestone 2 reads these from TheoSwap: each NFT's seed picks a leaf of the game's AWI config tree, which
// gives the cat, attack, rarity and stats (damage, fire rate, range). Until then makeDefender() derives the
// stats, and guests get three free Common cats.

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

/** Free cats for everyone: one of each family and attack. */
export const GUEST_DECK: Defender[] = [
  makeDefender(1, 'blast', 'Common'),
  makeDefender(6, 'venom', 'Common'),
  makeDefender(11, 'rapid', 'Common'),
];

/** ?nft: a deck like a collector's, to try rarities before TheoSwap sign-in exists (milestone 2). */
export const SAMPLE_DECK: Defender[] = [
  makeDefender(9, 'blast', 'Legendary', { source: 'nft', name: 'Top Hat #172' }),
  makeDefender(14, 'rapid', 'Epic', { source: 'nft', name: 'Viking #21' }),
  makeDefender(3, 'venom', 'Rare', { source: 'nft', name: 'Bandana #8' }),
  makeDefender(12, 'rapid', 'Rare', { source: 'nft', name: 'Violet #65' }),
  ...GUEST_DECK,
].map((d, i) => ({ ...d, uid: `${d.uid}#${i}` }));

/** Placing a cat: the first copy of a card costs PLACE_COST, each further copy of the same card PLACE_STEP more. */
export const PLACE_COST = 30, PLACE_STEP = 10;
/** Upgrading a placed cat (tap it): level 2, 3, 4. Each level multiplies damage. */
export const UPGRADE_COST = [35, 60, 95] as const;
export const MAX_LEVEL = 4, LEVEL_DMG = 1.45;
