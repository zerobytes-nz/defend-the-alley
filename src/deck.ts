// The cats the player brings to a run. Milestone 1: the free guest cats, or the sample NFT deck with ?nft.
// Milestone 2 adds the connected TheoSwap profile: each NFT becomes a cat defender AWI (src/awi.ts).
import { SAMPLE_NFTS } from './config.ts';
import { GUEST_DECK, SAMPLE_DECK, type Defender } from './game/cats.ts';

/** Up to this many cards fit the tray. */
export const DECK_MAX = 5;

export function currentDeck(): Defender[] {
  return (SAMPLE_NFTS ? SAMPLE_DECK : GUEST_DECK).slice(0, DECK_MAX);
}

/** Art keys the deck needs (Boot loads only these cats). */
export const deckArt = (deck: Defender[]) => new Set(deck.flatMap((d) => [`cat.c${d.cat}.idle`, `cat.c${d.cat}.shoot`]));
