// Demo players: AWIs from bundled sample data in the same shape TheoSwap returns for this game's config
// ("Defend the Alley AWIs"), so every screen can be tried without signing in. To try the real thing, connect on the
// title screen with your TheoSwap player code (or a TheoSwap test code such as AAAAAAAA once the config is published).
import type { ApiItem } from '../theoswap.ts';
import { TEST_CONTRACT } from './awi.ts';

export type ProfileId = 'guest' | 'collector' | 'whale';
export interface DemoProfile { id: ProfileId; name: string; blurb: string; items: ApiItem[] }

const FAMILY = ['cat_bazooka', 'cat_blaster', 'cat_rifle'];
/** A sample NFT on a made-up collection (so the collection bonus can be seen), or the test contract. */
const DEMO_SET = '0xa11e7ca7a11e7ca7a11e7ca7a11e7ca7a11e7ca7';
const cat = (token: number, c: number, attack: string, Rarity: string, perk = 'none', contract = TEST_CONTRACT): ApiItem =>
  ({ contract, token_id: token, itemData: { itemId: FAMILY[Math.floor((c - 1) / 5)], cat: String(c), attack, Rarity, perk } });
const addon = (token: number, id: string, Rarity: string): ApiItem => ({ contract: TEST_CONTRACT, token_id: token, itemData: { itemId: 'addon', addon: id, Rarity } });
const boost = (token: number, id: string, Rarity: string): ApiItem => ({ contract: TEST_CONTRACT, token_id: token, itemData: { itemId: 'boost', boost: id, Rarity } });

export const PROFILES: Record<ProfileId, DemoProfile> = {
  guest: { id: 'guest', name: 'Guest', blurb: 'No NFTs: free cats only', items: [] },
  collector: {
    id: 'collector', name: 'Collector', blurb: '4 cats, an add-on, a boost',
    items: [cat(172, 9, 'blast', 'Legendary', 'hot'), cat(21, 14, 'rapid', 'Epic'), cat(8, 3, 'venom', 'Rare', 'coin'), cat(65, 12, 'rapid', 'Rare'), addon(9, 'tnt', 'Rare'), boost(30, 'coins', 'Rare')],
  },
  whale: {
    id: 'whale', name: 'Whale', blurb: '6 cats, 3 add-ons, 2 boosts',
    items: [
      cat(1, 15, 'rapid', 'Legendary', 'quick', DEMO_SET), cat(7, 5, 'blast', 'Legendary', 'brick', DEMO_SET), cat(33, 10, 'venom', 'Epic', 'none', DEMO_SET),
      cat(48, 9, 'blast', 'Legendary', 'sharp'), cat(51, 13, 'rapid', 'Epic'), cat(77, 7, 'venom', 'Rare', 'coin'),
      addon(3, 'guard', 'Legendary'), addon(12, 'bomb', 'Epic'), addon(40, 'rocket', 'Rare'),
      boost(5, 'gems', 'Epic'), boost(6, 'luckybox', 'Legendary'),
    ],
  },
};
