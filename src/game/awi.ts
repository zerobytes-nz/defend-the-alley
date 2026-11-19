// AWIs (Altered World Items): what a player's NFTs become in Defend the Alley.
//
// TheoSwap's user-items API returns one entry per NFT, picked from this game's config "Defend the Alley AWIs"
// (game 9, config 18):
//   cat defender  { itemId: 'cat_blaster', cat: '9', attack: 'blast', Rarity: 'Epic', perk: 'hot' }
//                 (cat_bazooka = cats 1–5, cat_blaster = 6–10, cat_rifle = 11–15; optional damage / fireRate / range)
//   add-on        { itemId: 'addon', addon: 'tnt', Rarity: 'Rare' }
//   boost         { itemId: 'boost', boost: 'coins' | 'gems' | 'wall' | 'luckybox', Rarity: 'Legendary' }
// The older one-item-per-cat shape (cat_c9, addon_tnt) is still read. Pure TS: the sim imports it too.
import { ATTACKS, AWI_PERKS, RARITIES, catName, makeDefender, type Attack, type AwiPerk, type Defender, type Rarity } from './cats.ts';
import { ADDONS, ADDON_IDS, type AddonId } from './addons.ts';
import type { ApiItem } from '../theoswap.ts';

/** TheoSwap's test NFTs all share this contract, which is not a real collection. */
export const TEST_CONTRACT = '0x0000000000000000000000000000000000000000';

interface AwiBase { uid: string; name: string; rarity: Rarity; collection: string | null }
export type CatAwi = AwiBase & { kind: 'cat'; def: Defender };
export type AddonAwi = AwiBase & { kind: 'addon'; addon: AddonId };
export type BoostId = 'coins' | 'gems' | 'wall' | 'luckybox';
export type BoostAwi = AwiBase & { kind: 'boost'; boost: BoostId };
export type AWI = CatAwi | AddonAwi | BoostAwi;

/** Boost AWIs, by rarity (Common → Legendary). The best one of each kind counts; they don't stack. */
export const BOOSTS: Record<BoostId, { name: string; blurb: (r: Rarity) => string; value: Record<Rarity, number> }> = {
  coins: { name: 'Coin Purse', blurb: (r) => `+${BOOSTS.coins.value[r]} starting coins every fight`, value: { Common: 20, Rare: 30, Epic: 45, Legendary: 70 } },
  gems: { name: 'Gem Pouch', blurb: (r) => `+${Math.round(BOOSTS.gems.value[r] * 100)}% gems from every fight`, value: { Common: 0.1, Rare: 0.15, Epic: 0.25, Legendary: 0.4 } },
  wall: { name: 'Brick Pile', blurb: (r) => `+${BOOSTS.wall.value[r]} wall health`, value: { Common: 10, Rare: 15, Epic: 25, Legendary: 40 } },
  luckybox: { name: 'Lucky Box', blurb: (r) => `${BOOSTS.luckybox.value[r]} free use${BOOSTS.luckybox.value[r] > 1 ? 's' : ''} of a random add-on every fight`, value: { Common: 1, Rare: 1, Epic: 1, Legendary: 2 } },
};
const BOOST_IDS = Object.keys(BOOSTS) as BoostId[];
const FAMILY_ITEM: Record<string, number> = { cat_bazooka: 1, cat_blaster: 6, cat_rifle: 11 };

const pickRarity = (v: unknown): Rarity => ((RARITIES as readonly string[]).includes(String(v)) ? (v as Rarity) : 'Common');
const pickAttack = (v: unknown, cat: number): Attack => (String(v) in ATTACKS ? (v as Attack) : (['blast', 'venom', 'rapid'] as const)[cat % 3]);
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : typeof v === 'string' && Number(v) > 0 ? Number(v) : undefined);

/** The cat (1–15) of a cat item: cat_c9, or a family item (cat_blaster) with a cat attribute in its range. */
function catOf(id: string, attr: unknown): number {
  const old = /^cat_c(\d+)$/.exec(id);
  if (old) return +old[1] >= 1 && +old[1] <= 15 ? +old[1] : 0;
  const first = FAMILY_ITEM[id];
  if (!first) return 0;
  const c = Number(attr);
  return Number.isInteger(c) && c >= first && c < first + 5 ? c : first;
}

/**
 * Turn user-items results into AWIs, best rarity first. Items this game doesn't know are skipped.
 * Each NFT is its own AWI, named after its token: "Top Hat #172", "TNT Crate #9".
 */
export function awisFromItems(results: ApiItem[]): AWI[] {
  const out: AWI[] = [];
  const seen = new Set<string>();
  for (const r of results ?? []) {
    const d = r?.itemData;
    const id = String(d?.itemId ?? '');
    const token = String(r.token_id ?? r.tokenId ?? '?');
    const contract = (r.contract ?? '').toLowerCase();
    let uid = `nft:${contract}:${token}`;
    for (let n = 2; seen.has(uid); n++) uid = `nft:${contract}:${token}~${n}`;
    const rarity = pickRarity(d?.Rarity);
    const collection = contract && contract !== TEST_CONTRACT ? contract : null;
    const c = catOf(id, d?.cat);
    const addonId = id === 'addon' ? String(d?.addon ?? '') : id.startsWith('addon_') ? id.slice(6) : '';
    if (c) {
      const name = `${catName(c)} #${token}`;
      const perk = (AWI_PERKS as readonly string[]).includes(String(d?.perk)) ? (d?.perk as AwiPerk) : undefined;
      const def = makeDefender(c, pickAttack(d?.attack, c), rarity, { uid, name, source: 'nft', ...(collection ? { collection } : {}), ...(perk ? { awiPerk: perk } : {}) });
      // The config may tune a single AWI: its own damage / fireRate / range win over the derived stats.
      const dmg = num(d?.damage), rate = num(d?.fireRate), range = num(d?.range);
      if (dmg) def.dmg = Math.round(dmg);
      if (rate) def.rate = rate;
      if (range) def.range = range;
      if (perk === 'hot') def.dmg = Math.round(def.dmg * 1.15);
      if (perk === 'quick') def.rate = Math.round(def.rate * 1.15 * 100) / 100;
      if (perk === 'sharp') def.range = Math.round(def.range * 1.2);
      out.push({ kind: 'cat', uid, name, rarity, collection, def });
    } else if ((ADDON_IDS as string[]).includes(addonId)) {
      const addon = addonId as AddonId;
      out.push({ kind: 'addon', uid, name: `${ADDONS[addon].name} #${token}`, rarity, collection, addon });
    } else if (id === 'boost' && (BOOST_IDS as string[]).includes(String(d?.boost))) {
      const boost = d?.boost as BoostId;
      out.push({ kind: 'boost', uid, name: `${BOOSTS[boost].name} #${token}`, rarity, collection, boost });
    } else continue;
    seen.add(uid);
  }
  return out.sort((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity));
}
