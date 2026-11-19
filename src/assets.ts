import Phaser from 'phaser';
import manifest from '../assets.manifest.json';
import urls from 'virtual:asset-urls';
import type { LevelDef } from './game/levels.ts';

/**
 * All art comes from assets.manifest.json. Game code refers to assets by manifest key only
 * (e.g. `unit.slime.attack`); paths, sizes and frame data live in the manifest.
 */
export interface AssetDef {
  key: string;
  type: 'image' | 'spritesheet' | 'audio';
  path: string;
  width: number; height: number;
  frameWidth: number; frameHeight: number; frameCount: number;
  /** Frames per row; absent = one row. Phaser reads grid sheets left to right, top to bottom. */
  columns?: number;
  displayScale: number;
  animation?: { frameRate: number; repeat: number };
  /** Real art for this key is pixel art: drawn with nearest-neighbour scaling so it stays crisp. */
  pixelArt?: boolean;
}

const DEFS = new Map<string, AssetDef>((manifest.assets as AssetDef[]).map((a) => [a.key, a]));

export function asset(key: string): AssetDef {
  const a = DEFS.get(key);
  if (!a) throw new Error(`Unknown asset key "${key}" (not in assets.manifest.json)`);
  return a;
}

/** True when the file in use is real art (licensed or CC0), not the committed placeholder. */
export const isRealArt = (key: string): boolean => !urls[key].startsWith(`${manifest.roots.placeholder}/`);

/**
 * Queue art for loading. Call from preload(). Cats are about half of all texture memory, so only the cats
 * of the player's deck are loaded (`want` says which keys); everything else always is.
 */
export function preloadAll(scene: Phaser.Scene, want: (key: string) => boolean = () => true): void {
  for (const a of DEFS.values()) {
    if (!want(a.key) || scene.textures.exists(a.key)) continue;
    const url = urls[a.key];
    if (a.type === 'spritesheet') scene.load.spritesheet(a.key, url, { frameWidth: a.frameWidth, frameHeight: a.frameHeight });
    else if (a.type === 'image') scene.load.image(a.key, url);
    else scene.load.audio(a.key, url);
  }
}

/** Call once after loading: animations for every sheet, and sharp scaling for real pixel art. */
export function setupAssets(scene: Phaser.Scene): void {
  for (const a of DEFS.values()) {
    if (!scene.textures.exists(a.key)) continue;
    if (a.pixelArt && isRealArt(a.key)) scene.textures.get(a.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    if (!a.animation || scene.anims.exists(a.key)) continue;
    scene.anims.create({
      key: a.key,
      frames: scene.anims.generateFrameNumbers(a.key, { start: 0, end: a.frameCount - 1 }),
      frameRate: a.animation.frameRate || 10,
      repeat: a.animation.repeat,
    });
  }
}

/** Seconds an animation lasts (one loop). */
export const animSeconds = (key: string): number => { const a = asset(key); return a.frameCount / (a.animation?.frameRate || 10); };

/** Art one area (0–4) of a fight needs: its street and the bosses of its waves. Loaded ahead, released after. */
export function areaArt(level: LevelDef, a: number): string[] {
  const bosses = new Set(level.waves.filter((w) => w.area === a).flatMap((w) => w.bosses));
  return [`bg.area${a + 1}`, ...[...bosses].flatMap((b) => ['walk', 'attack', 'dead'].map((m) => `enemy.boss${b}.${m}`))];
}
/** Every street and boss sheet (Boot leaves these out; fights load what they need). */
export const isAreaArt = (key: string) => key.startsWith('bg.area') || key.startsWith('enemy.boss');
/** The melee add-on cats' sheets, only loaded when the loadout has them. */
export const addonArt = (ids: string[]): string[] => ids.flatMap((id) => (id === 'guard' || id === 'boxer' ? [`addon.${id}.idle`, `addon.${id}.attack`] : []));
/** A deck's cat sheets. */
export const catArt = (cats: number[]): string[] => cats.flatMap((c) => [`cat.c${c}.idle`, `cat.c${c}.shoot`]);

/** Load these keys if they aren't loaded yet. Resolves when they are ready (animations included). */
export function ensureLoaded(scene: Phaser.Scene, keys: string[]): Promise<void> {
  const missing = new Set(keys.filter((k) => !scene.textures.exists(k)));
  if (!missing.size) return Promise.resolve();
  return new Promise((resolve) => {
    preloadAll(scene, (k) => missing.has(k));
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => { setupAssets(scene); resolve(); });
    scene.load.start();
  });
}

/** Free GPU memory for art no sprite uses any more. */
export function release(scene: Phaser.Scene, keys: string[]): void {
  for (const k of keys) {
    if (scene.anims.exists(k)) scene.anims.remove(k);
    if (scene.textures.exists(k)) scene.textures.remove(k);
  }
}
