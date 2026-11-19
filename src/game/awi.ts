// AWIs (Altered World Items): what a player's NFTs become in Defend the Alley.
//
// TheoSwap's user-items API returns one entry per NFT, picked from this game's config tree (milestone 3):
//   cat defender  { itemId: 'cat_c9', attack: 'blast', Rarity: 'Epic' }   (+ optional damage / fireRate / range)
//   add-on        { itemId: 'addon_tnt', Rarity: 'Rare' }
// Until sign-in lands, the demo players in demo.ts supply the same shape. Pure TS: the sim imports it too.
import { ATTACKS, RARITIES, catName, makeDefender, type Attack, type Defender, type Rarity } from './cats.ts';
import { ADDONS, ADDON_IDS, type AddonId } from './addons.ts';
import type { ApiItem } from '../theoswap.ts';

/** TheoSwap's test NFTs all share this contract, which is not a real collection. */
export const TEST_CONTRACT = '0x0000000000000000000000000000000000000000';

interface AwiBase { uid: string; name: string; rarity: Rarity; collection: string | null }
export type CatAwi = AwiBase & { kind: 'cat'; def: Defender };
export type AddonAwi = AwiBase & { kind: 'addon'; addon: AddonId };
export type AWI = CatAwi | AddonAwi;

const pickRarity = (v: unknown): Rarity => ((RARITIES as readonly string[]).includes(String(v)) ? (v as Rarity) : 'Common');
const pickAttack = (v: unknown, cat: number): Attack => (String(v) in ATTACKS ? (v as Attack) : (['blast', 'venom', 'rapid'] as const)[cat % 3]);
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : typeof v === 'string' && Number(v) > 0 ? Number(v) : undefined);

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
    const cat = /^cat_c(\d+)$/.exec(id);
    if (cat && +cat[1] >= 1 && +cat[1] <= 15) {
      const c = +cat[1];
      const name = `${catName(c)} #${token}`;
      const def = makeDefender(c, pickAttack(d?.attack, c), rarity, { uid, name, source: 'nft', ...(collection ? { collection } : {}) });
      // The config may tune a single AWI: its own damage / fireRate / range win over the derived stats.
      const dmg = num(d?.damage), rate = num(d?.fireRate), range = num(d?.range);
      if (dmg) def.dmg = Math.round(dmg);
      if (rate) def.rate = rate;
      if (range) def.range = range;
      out.push({ kind: 'cat', uid, name, rarity, collection, def });
    } else if (id.startsWith('addon_') && (ADDON_IDS as string[]).includes(id.slice(6))) {
      const addon = id.slice(6) as AddonId;
      out.push({ kind: 'addon', uid, name: `${ADDONS[addon].name} #${token}`, rarity, collection, addon });
    } else continue;
    seen.add(uid);
  }
  return out.sort((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity));
}
