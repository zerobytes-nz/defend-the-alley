// Demo players: AWIs from bundled sample data in the same shape TheoSwap returns, so every screen can be tried
// without signing in. Milestone 4 swaps these for real TheoSwap test codes.
import type { ApiItem } from '../theoswap.ts';
import { TEST_CONTRACT } from './awi.ts';

export type ProfileId = 'guest' | 'collector' | 'whale';
export interface DemoProfile { id: ProfileId; name: string; blurb: string; items: ApiItem[] }

const cat = (token: number, c: number, attack: string, Rarity: string): ApiItem => ({ contract: TEST_CONTRACT, token_id: token, itemData: { itemId: `cat_c${c}`, attack, Rarity } });
const addon = (token: number, id: string, Rarity: string): ApiItem => ({ contract: TEST_CONTRACT, token_id: token, itemData: { itemId: `addon_${id}`, Rarity } });

export const PROFILES: Record<ProfileId, DemoProfile> = {
  guest: { id: 'guest', name: 'Guest', blurb: 'No NFTs: free cats only', items: [] },
  collector: {
    id: 'collector', name: 'Collector', blurb: '4 cat AWIs + 1 add-on AWI',
    items: [cat(172, 9, 'blast', 'Legendary'), cat(21, 14, 'rapid', 'Epic'), cat(8, 3, 'venom', 'Rare'), cat(65, 12, 'rapid', 'Rare'), addon(9, 'tnt', 'Rare')],
  },
  whale: {
    id: 'whale', name: 'Whale', blurb: '6 cat AWIs + 3 add-on AWIs',
    items: [
      cat(1, 15, 'rapid', 'Legendary'), cat(7, 5, 'blast', 'Legendary'), cat(33, 10, 'venom', 'Epic'), cat(48, 9, 'blast', 'Legendary'),
      cat(51, 13, 'rapid', 'Epic'), cat(77, 7, 'venom', 'Rare'),
      addon(3, 'guard', 'Legendary'), addon(12, 'bomb', 'Epic'), addon(40, 'rocket', 'Rare'),
    ],
  },
};
