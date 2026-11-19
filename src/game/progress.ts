// What a player keeps between fights: stars, gems, upgrades, add-ons, deck and loadout. Pure TS (the sim uses
// it too); src/save.ts stores it in localStorage, one save per demo player.
import { CAT_STEPS, COLLECTION_DMG, COLLECTION_RATE, dps, guestCat, upgraded, type Defender } from './cats.ts';
import { ADDON_IDS, ADDON_MAX, ADDON_PRICE, AWI_ADDON_POWER, AWI_ADDON_USES, SLOTS_MAX, SLOT_PRICES, type AddonId, type Equipped } from './addons.ts';
import { INCOME_PER_S, START_COINS, WALL_HP } from './sim.ts';
import { DAILY, ENDLESS, FULL_ALLEY, HARD_BASE, LEVEL_COUNT, dayKey, isHard, levelDef } from './levels.ts';
export { dayKey };
import { CAT_ORDER, UNLOCKS, addonOpen, catOpen, featureOpen, type Feature, type Unlock } from './unlocks.ts';
import type { FightSetup } from './sim.ts';
import { BOOSTS, type AWI, type AddonAwi, type BoostAwi, type BoostId, type CatAwi } from './awi.ts';

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
  seen: string[];            // zombie and boss types met (New zombie cards, the Almanac)
  hard: number[];            // Hard mode stars per level
  challenge: { day: string; stars: number; tries: number }; // today's Daily Challenge (stars 0 = not won yet)
  endless: number;           // Endless best: waves cleared
  addonLv: Partial<Record<AddonId, number>>; // add-on upgrade steps
  ach: string[];             // achievements earned
  totals: Totals;            // lifetime counts for achievements
}
export interface Totals { kills: number; bosses: number; merges: number; wins: number; addons: number; dailies: number }

export const DECK_MAX = 5;
export const START_GEMS = 50;
export const newSave = (): Save => ({
  v: 1, gems: START_GEMS, stars: Array(LEVEL_COUNT).fill(0), cat: Array(15).fill(0), wall: 0, income: 0,
  stock: {}, slots: 2, loadout: [], deck: [], daily: { day: '', streak: 0 }, alley: null, tips: [], seen: [], hard: Array(LEVEL_COUNT).fill(0),
  challenge: { day: '', stars: 0, tries: 0 }, endless: 0, addonLv: {}, ach: [], totals: { kills: 0, bosses: 0, merges: 0, wins: 0, addons: 0, dailies: 0 },
});
/** A stored save, repaired if it is from an older build or damaged. */
export function fixSave(raw: unknown): Save {
  const s = { ...newSave(), ...(raw && typeof raw === 'object' ? raw : {}) } as Save;
  const arr = (a: unknown, n: number) => Array.from({ length: n }, (_, i) => (Array.isArray(a) && Number.isFinite(a[i]) ? Math.max(0, a[i]) : 0));
  s.stars = arr(s.stars, LEVEL_COUNT); s.cat = arr(s.cat, 15); s.hard = arr(s.hard, LEVEL_COUNT);
  s.slots = Math.min(SLOTS_MAX, Math.max(2, s.slots | 0));
  if (!Array.isArray(s.loadout)) s.loadout = [];
  if (!Array.isArray(s.deck)) s.deck = [];
  if (!Array.isArray(s.tips)) s.tips = [];
  if (!Array.isArray(s.seen)) s.seen = [];
  if (!Array.isArray(s.ach)) s.ach = [];
  if (!s.challenge || typeof s.challenge !== 'object') s.challenge = newSave().challenge;
  if (!s.addonLv || typeof s.addonLv !== 'object') s.addonLv = {};
  s.totals = { ...newSave().totals, ...(s.totals && typeof s.totals === 'object' ? s.totals : {}) };
  s.endless = Math.max(0, Number(s.endless) || 0);
  return s;
}

// ── Prices ───────────────────────────────────────────────────────────────────────────────────────────
export const CAT_STEP_COST = [20, 40, 70, 110, 160] as const;
export const ROW_STEP_COST = [30, 60, 100, 150, 220] as const; // Wall and Income rows
export const WALL_PER_STEP = 15, START_PER_STEP = 15, INCOME_PER_STEP = 0.3;

// ── Levels and gems ──────────────────────────────────────────────────────────────────────────────────
export const levelsCleared = (s: Save) => { let n = 0; while (n < LEVEL_COUNT && s.stars[n] > 0) n++; return n; };
export function levelOpen(s: Save, n: number): boolean {
  if (n === FULL_ALLEY) return featureOpen(levelsCleared(s), 'alley');
  if (n === ENDLESS) return featureOpen(levelsCleared(s), 'endless');
  if (n === DAILY) return featureOpen(levelsCleared(s), 'daily');
  if (isHard(n)) { const h = n - HARD_BASE; return featureOpen(levelsCleared(s), 'hard') && (h === 0 || s.hard[h - 1] > 0); }
  return n === 0 || s.stars[n - 1] > 0;
}
/** Stars on a map level (normal or Hard). */
export const starsAt = (s: Save, n: number) => (isHard(n) ? s.hard[n - HARD_BASE] : s.stars[n]);

/** Gems for clearing level n with `stars` (more on the first clear; Hard mode pays 1.5×). */
export function levelGems(n: number, stars: number, first: boolean): number {
  const k = isHard(n) ? 1.5 : 1;
  if (isHard(n)) n -= HARD_BASE;
  const base = (15 + 5 * n) * k;
  return Math.round((base * [0, 1, 1.5, 2][stars] + (first ? 20 : 0)) / 5) * 5;
}
/** A lost level still pays a little: 3 gems per wave cleared (so a hard level can be ground out). */
export const lossGems = (wavesCleared: number) => wavesCleared * 3;
/** Gems for a Full Alley run: per wave cleared, plus a prize for winning. */
export const alleyGems = (wavesCleared: number, won: boolean) => wavesCleared * 10 + (won ? 200 : 0);
/** Gems for an Endless run: 5 a wave, and 15 more for each wave past your old best. */
export const endlessGems = (wavesCleared: number, best: number) => wavesCleared * 5 + Math.max(0, wavesCleared - best) * 15;

/** Today's Daily Challenge record (reset when the day changes). */
export function challengeToday(s: Save, today: Date) {
  const day = dayKey(today);
  if (s.challenge.day !== day) s.challenge = { day, stars: 0, tries: 0 };
  return s.challenge;
}
/** Record a Daily Challenge result. Gems: 60 for the day's first win, then 25 per star above your best today. */
export function finishDaily(s: Save, today: Date, stars: number): number {
  const c = challengeToday(s, today);
  c.tries++;
  if (stars <= c.stars) return 0;
  const gems = (c.stars === 0 ? 60 : 0) + 25 * (stars - c.stars);
  if (c.stars === 0) s.totals.dailies++;
  c.stars = stars;
  return gems;
}

// ── Daily gift ───────────────────────────────────────────────────────────────────────────────────────
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
export const boostAwis = (awis: AWI[]) => awis.filter((a): a is BoostAwi => a.kind === 'boost');
/** The best boost AWI of a kind (they don't stack), or null. */
export function bestBoost(awis: AWI[], id: BoostId): BoostAwi | null {
  return boostAwis(awis).filter((a) => a.boost === id).sort((a, b) => BOOSTS[id].value[b.rarity] - BOOSTS[id].value[a.rarity])[0] ?? null;
}
export const boostValue = (awis: AWI[], id: BoostId) => { const b = bestBoost(awis, id); return b ? BOOSTS[id].value[b.rarity] : 0; };
/** Gems from a fight, with a Gem Pouch AWI's bonus. */
export const withGemBoost = (awis: AWI[], gems: number) => Math.round(gems * (1 + boostValue(awis, 'gems')));

/**
 * Collection bonus: deck cards from the same NFT collection (2+: +10% damage; 3+: also +10% fire rate).
 * Returns the deck with the bonus in the stats, and `set` = how many share each card's collection.
 */
export function withCollectionBonus(deck: Defender[]): (Defender & { set?: number })[] {
  const count = new Map<string, number>();
  for (const d of deck) if (d.collection) count.set(d.collection, (count.get(d.collection) ?? 0) + 1);
  return deck.map((d) => {
    const n = d.collection ? count.get(d.collection) ?? 0 : 0;
    if (n < 2) return d;
    return { ...d, set: n, dmg: Math.round(d.dmg * (1 + COLLECTION_DMG)), rate: n >= 3 ? Math.round(d.rate * (1 + COLLECTION_RATE) * 100) / 100 : d.rate };
  });
}

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
  if (isHard(n)) { s.hard[n - HARD_BASE] = Math.max(s.hard[n - HARD_BASE], stars); return []; }
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

/** Wall health each Brick Layer AWI in the deck adds. */
export const BRICK_PERK = 10;

// ── Add-ons ──────────────────────────────────────────────────────────────────────────────────────────
export const slotPrice = (s: Save): number | null => (s.slots >= SLOTS_MAX ? null : SLOT_PRICES[s.slots - 2]);
export const buySlot = (s: Save) => spend(s, slotPrice(s)) && !!++s.slots;
export const stockOf = (s: Save, id: AddonId) => s.stock[id] ?? 0;
export const buyAddon = (s: Save, id: AddonId) => stockOf(s, id) < ADDON_MAX && spend(s, ADDON_PRICE) && !!(s.stock[id] = stockOf(s, id) + 1);

/** Add-on upgrades: 3 steps per add-on, each +20% power (bought ones and AWIs alike). */
export const ADDON_STEPS = 3, ADDON_STEP_POWER = 0.2;
export const ADDON_STEP_COST = [60, 120, 200] as const;
export const addonStep = (s: Save, id: AddonId) => s.addonLv[id] ?? 0;
export const addonStepCost = (s: Save, id: AddonId): number | null => (addonStep(s, id) >= ADDON_STEPS ? null : ADDON_STEP_COST[addonStep(s, id)]);
export const buyAddonStep = (s: Save, id: AddonId) => spend(s, addonStepCost(s, id)) && !!(s.addonLv[id] = addonStep(s, id) + 1);
const addonPower = (s: Save, id: AddonId) => 1 + ADDON_STEP_POWER * addonStep(s, id);

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
    if (a) out.push({ key, id: a.addon, uses: AWI_ADDON_USES[a.rarity], power: Math.round(AWI_ADDON_POWER[a.rarity] * addonPower(s, a.addon) * 100) / 100, awi: true });
    else if (stockOf(s, key as AddonId) > 0 && addonUnlocked(s, awis, key as AddonId)) out.push({ key, id: key as AddonId, uses: stockOf(s, key as AddonId), power: addonPower(s, key as AddonId), awi: false });
  }
  return out;
}

/** After a fight: bought add-ons used up come off the stock. */
export function spendAddons(s: Save, used: Equipped[], left: Equipped[]): void {
  used.forEach((a, i) => { if (!a.awi) s.stock[a.id] = Math.max(0, stockOf(s, a.id) - (a.uses - left[i].uses)); });
}

/** Everything a fight on level n needs except the seed (the game and `npm run sim` both use this). */
export function fightSetup(s: Save, awis: AWI[], n: number): Omit<FightSetup, 'seed'> & { addons: Equipped[] } {
  const deck = withCollectionBonus(deckOf(s, awis)), bonus = fightBonus(s);
  const bricks = deck.filter((d) => d.awiPerk === 'brick').length * BRICK_PERK;
  const addons = featureUnlocked(s, awis, 'addons') ? equipped(s, awis) : [];
  const lucky = bestBoost(awis, 'luckybox');
  if (lucky && featureUnlocked(s, awis, 'addons')) {
    // A Lucky Box AWI: a free add-on, a different one each level (picked from the AWI's token and the level).
    let h = n * 7;
    for (const ch of lucky.uid) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const id = ADDON_IDS[h % ADDON_IDS.length];
    addons.push({ key: lucky.uid, id, uses: BOOSTS.luckybox.value[lucky.rarity], power: 1, awi: true });
  }
  return {
    level: levelDef(n), deck,
    wallMax: bonus.wallMax + bricks + boostValue(awis, 'wall'),
    startCoins: bonus.startCoins + boostValue(awis, 'coins'),
    income: bonus.income,
    addons,
    repair: featureUnlocked(s, awis, 'repair'),
    merge: featureUnlocked(s, awis, 'merge'),
  };
}
