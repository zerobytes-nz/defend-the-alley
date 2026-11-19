// What a player keeps between fights: stars, gems, upgrades, add-ons, deck and loadout. Pure TS (the sim uses
// it too); src/save.ts stores it in localStorage, one save per demo player.
import { CAT_STEPS, dps, guestCat, upgraded, type Defender } from './cats.ts';
import { ADDON_MAX, ADDON_PRICE, AWI_ADDON_POWER, AWI_ADDON_USES, SLOTS_MAX, SLOT_PRICES, type AddonId, type Equipped } from './addons.ts';
import { INCOME_PER_S, START_COINS, WALL_HP } from './sim.ts';
import { FULL_ALLEY, LEVEL_COUNT, levelDef } from './levels.ts';
import { CAT_ORDER, UNLOCKS, addonOpen, catOpen, featureOpen, type Feature, type Unlock } from './unlocks.ts';
import type { FightSetup } from './sim.ts';
import type { AWI, AddonAwi, CatAwi } from './awi.ts';

export interface Best { won: boolean; wave: number; time: number }
export interface Save {
  v: 1;
  gems: number;
  stars: number[];           // per level, 0 = not cleared
  cat: number[];             // upgrade steps per cat C1–C15 (index 0–14)
  wall: number;              // Wall row steps
  income: number;            // Income row steps
  stock: Partial<Record<AddonId, number>>;
  slots: number;             // open loadout slots (2–4)
  loadout: string[];         // add-on ids (bought) or AWI uids
  deck: string[];            // card uids, up to DECK_MAX
  daily: { day: string; streak: number };
  alley: Best | null;        // Full Alley best run
  tips: string[];            // one-time tips already shown (repair, addons, merge…)
}

export const DECK_MAX = 5;
export const START_GEMS = 50;
export const newSave = (): Save => ({
  v: 1, gems: START_GEMS, stars: Array(LEVEL_COUNT).fill(0), cat: Array(15).fill(0), wall: 0, income: 0,
  stock: {}, slots: 2, loadout: [], deck: [], daily: { day: '', streak: 0 }, alley: null, tips: [],
});
/** A stored save, repaired if it is from an older build or damaged. */
export function fixSave(raw: unknown): Save {
  const s = { ...newSave(), ...(raw && typeof raw === 'object' ? raw : {}) } as Save;
  const arr = (a: unknown, n: number) => Array.from({ length: n }, (_, i) => (Array.isArray(a) && Number.isFinite(a[i]) ? Math.max(0, a[i]) : 0));
  s.stars = arr(s.stars, LEVEL_COUNT); s.cat = arr(s.cat, 15);
  s.slots = Math.min(SLOTS_MAX, Math.max(2, s.slots | 0));
  if (!Array.isArray(s.loadout)) s.loadout = [];
  if (!Array.isArray(s.deck)) s.deck = [];
  if (!Array.isArray(s.tips)) s.tips = [];
  return s;
}

// ── Prices ───────────────────────────────────────────────────────────────────────────────────────────
export const CAT_STEP_COST = [20, 40, 70, 110, 160] as const;
export const ROW_STEP_COST = [30, 60, 100, 150, 220] as const; // Wall and Income rows
export const WALL_PER_STEP = 15, START_PER_STEP = 15, INCOME_PER_STEP = 0.3;

// ── Levels and gems ──────────────────────────────────────────────────────────────────────────────────
export const levelsCleared = (s: Save) => { let n = 0; while (n < LEVEL_COUNT && s.stars[n] > 0) n++; return n; };
export const levelOpen = (s: Save, n: number) => (n === FULL_ALLEY ? featureOpen(levelsCleared(s), 'alley') : n === 0 || s.stars[n - 1] > 0);

/** Gems for clearing level n with `stars` (more on the first clear). */
export function levelGems(n: number, stars: number, first: boolean): number {
  const base = 15 + 5 * n;
  return Math.round((base * [0, 1, 1.5, 2][stars] + (first ? 20 : 0)) / 5) * 5;
}
/** Gems for a Full Alley run: per wave cleared, plus a prize for winning. */
export const alleyGems = (wavesCleared: number, won: boolean) => wavesCleared * 10 + (won ? 200 : 0);

// ── Daily gift ───────────────────────────────────────────────────────────────────────────────────────
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const dailyReady = (s: Save, today: Date) => s.daily.day !== dayKey(today);
/** Claim today's gift: 30 gems on day 1, +10 a day in a row, up to 90. Returns the gems, or 0 if already claimed. */
export function claimDaily(s: Save, today: Date): number {
  const day = dayKey(today);
  if (s.daily.day === day) return 0;
  const y = new Date(today); y.setDate(y.getDate() - 1);
  const streak = s.daily.day === dayKey(y) ? s.daily.streak + 1 : 1;
  const gems = 20 + 10 * Math.min(streak, 7);
  s.daily = { day, streak };
  s.gems += gems;
  return gems;
}

// ── Unlocks (src/game/unlocks.ts) ────────────────────────────────────────────────────────────────────
const catAwis = (awis: AWI[]) => awis.filter((a): a is CatAwi => a.kind === 'cat');
export const addonAwis = (awis: AWI[]) => awis.filter((a): a is AddonAwi => a.kind === 'addon');

/** A cat is unlocked by clearing its level, or right away when the player owns an AWI of it. */
export const catUnlocked = (s: Save, awis: AWI[], cat: number) => catOpen(levelsCleared(s), cat) || catAwis(awis).some((a) => a.def.cat === cat);
/** Bought add-ons unlock by level; an add-on AWI is always usable (and unlocks buying more of its kind). */
export const addonUnlocked = (s: Save, awis: AWI[], id: AddonId) => addonOpen(levelsCleared(s), id) || addonAwis(awis).some((a) => a.addon === id);
/** Owning cat AWIs opens the Cats screen at once (to pick a deck); owning add-on AWIs opens Add-ons. */
export function featureUnlocked(s: Save, awis: AWI[], f: Feature): boolean {
  if (featureOpen(levelsCleared(s), f)) return true;
  return (f === 'cats' && catAwis(awis).length > 0) || (f === 'addons' && addonAwis(awis).length > 0);
}

/**
 * Record a cleared level. On the first clear of the next level in line, returns what it unlocked (for the reveal
 * cards) and adds new cats to a hand-picked deck while there is room.
 */
export function clearLevel(s: Save, awis: AWI[], n: number, stars: number): Unlock[] {
  const before = levelsCleared(s);
  s.stars[n] = Math.max(s.stars[n], stars);
  const after = levelsCleared(s);
  const got = UNLOCKS.slice(before, after).flat();
  for (const u of got) {
    if (u.kind !== 'cat' || !s.deck.length || s.deck.length >= DECK_MAX) continue;
    const uid = guestCat(u.cat).uid;
    if (!s.deck.includes(uid) && !catAwis(awis).some((a) => a.def.cat === u.cat)) s.deck.push(uid);
  }
  return got;
}

/** Every card the player can put in the deck, with cat upgrades applied: AWIs first, then free cats. */
export function cards(s: Save, awis: AWI[]): Defender[] {
  const nft = catAwis(awis).map((a) => a.def);
  const free = CAT_ORDER.filter((c) => catUnlocked(s, awis, c)).map(guestCat);
  return [...nft, ...free].map((d) => upgraded(d, s.cat[d.cat - 1]));
}

/** The deck for a fight: the saved picks, or (none saved) the strongest cards. */
export function deckOf(s: Save, awis: AWI[]): Defender[] {
  const all = cards(s, awis);
  const picked = s.deck.map((u) => all.find((d) => d.uid === u)).filter((d): d is Defender => !!d);
  if (picked.length) return picked.slice(0, DECK_MAX);
  const nft = all.filter((d) => d.source === 'nft').sort((a, b) => dps(b) - dps(a));
  return [...nft, ...all.filter((d) => d.source !== 'nft')].slice(0, DECK_MAX);
}

/** Add or remove a card from the deck. Returns false if that would leave it empty or overfull. */
export function toggleDeck(s: Save, awis: AWI[], uid: string): boolean {
  const deck = deckOf(s, awis).map((d) => d.uid);
  const i = deck.indexOf(uid);
  if (i >= 0) { if (deck.length <= 1) return false; deck.splice(i, 1); }
  else { if (deck.length >= DECK_MAX) return false; deck.push(uid); }
  s.deck = deck;
  return true;
}

export const catStepCost = (s: Save, cat: number): number | null => (s.cat[cat - 1] >= CAT_STEPS ? null : CAT_STEP_COST[s.cat[cat - 1]]);
export const rowStepCost = (steps: number): number | null => (steps >= ROW_STEP_COST.length ? null : ROW_STEP_COST[steps]);

function spend(s: Save, cost: number | null): boolean {
  if (cost === null || s.gems < cost) return false;
  s.gems -= cost;
  return true;
}
export const buyCatStep = (s: Save, cat: number) => spend(s, catStepCost(s, cat)) && !!++s.cat[cat - 1];
export const buyWall = (s: Save) => spend(s, rowStepCost(s.wall)) && !!++s.wall;
export const buyIncome = (s: Save) => spend(s, rowStepCost(s.income)) && !!++s.income;

/** Wall, starting coins and coins per second for a fight. */
export const fightBonus = (s: Save) => ({
  wallMax: WALL_HP + WALL_PER_STEP * s.wall,
  startCoins: START_COINS + START_PER_STEP * s.income,
  income: Math.round((INCOME_PER_S + INCOME_PER_STEP * s.income) * 10) / 10,
});

// ── Add-ons ──────────────────────────────────────────────────────────────────────────────────────────
export const slotPrice = (s: Save): number | null => (s.slots >= SLOTS_MAX ? null : SLOT_PRICES[s.slots - 2]);
export const buySlot = (s: Save) => spend(s, slotPrice(s)) && !!++s.slots;
export const stockOf = (s: Save, id: AddonId) => s.stock[id] ?? 0;
export const buyAddon = (s: Save, id: AddonId) => stockOf(s, id) < ADDON_MAX && spend(s, ADDON_PRICE) && !!(s.stock[id] = stockOf(s, id) + 1);

/** Equip or unequip an add-on (an id, or an add-on AWI's uid). Returns false when the loadout is full. */
export function toggleLoadout(s: Save, key: string): boolean {
  const i = s.loadout.indexOf(key);
  if (i >= 0) { s.loadout.splice(i, 1); return true; }
  if (s.loadout.length >= s.slots) return false;
  s.loadout.push(key);
  return true;
}

/** The add-ons a fight starts with. Bought ones bring their whole stock; empty ones are left out. */
export function equipped(s: Save, awis: AWI[]): Equipped[] {
  const mine = addonAwis(awis);
  const out: Equipped[] = [];
  for (const key of s.loadout.slice(0, s.slots)) {
    const a = mine.find((x) => x.uid === key);
    if (a) out.push({ key, id: a.addon, uses: AWI_ADDON_USES[a.rarity], power: AWI_ADDON_POWER[a.rarity], awi: true });
    else if (stockOf(s, key as AddonId) > 0 && addonUnlocked(s, awis, key as AddonId)) out.push({ key, id: key as AddonId, uses: stockOf(s, key as AddonId), power: 1, awi: false });
  }
  return out;
}

/** After a fight: bought add-ons used up come off the stock. */
export function spendAddons(s: Save, used: Equipped[], left: Equipped[]): void {
  used.forEach((a, i) => { if (!a.awi) s.stock[a.id] = Math.max(0, stockOf(s, a.id) - (a.uses - left[i].uses)); });
}

/** Everything a fight on level n needs except the seed (the game and `npm run sim` both use this). */
export function fightSetup(s: Save, awis: AWI[], n: number): Omit<FightSetup, 'seed'> & { addons: Equipped[] } {
  return {
    level: levelDef(n), deck: deckOf(s, awis), ...fightBonus(s),
    addons: featureUnlocked(s, awis, 'addons') ? equipped(s, awis) : [],
    repair: featureUnlocked(s, awis, 'repair'),
    merge: featureUnlocked(s, awis, 'merge'),
  };
}
