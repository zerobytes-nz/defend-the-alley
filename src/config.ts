// Screen size, the street layout and switches. Portrait 720×1280 (9:16), scaled to fit the phone (Scale.FIT).
export const GAME_W = 720;
export const GAME_H = 1280;

const params = new URLSearchParams(location.search);
/** ?debug: FPS meter, window.__game and window.__sim. */
export const DEBUG = params.has('debug');
/** ?nft: play with a sample deck of NFT-style cats (Rare to Legendary), until TheoSwap sign-in lands (milestone 2). */
export const SAMPLE_NFTS = params.has('nft');
/** ?seed=123: replay the same waves. */
export const SEED = Number(params.get('seed')) || 0;

export const FONT = '"Passion One", system-ui, sans-serif';

export const COLORS = {
  bg: 0x1d1a26,
  panel: 0x2c2638,
  tray: 0x3a3346,
  gold: 0xffd02a,
  good: 0x8cc63f,
  bad: 0xe0503a,
  text: '#ffffff',
  dim: '#c9c0d8',
  stroke: '#2b1d14',
};

/** Where the street art sits; see src/game/layout.ts for lanes and slots. */
export const BG_Y = 80;
export const BG_H = 988;
export const TRAY_Y = BG_Y + BG_H; // 1068: card tray below the street
