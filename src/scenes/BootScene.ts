import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS, FONT } from '../config.ts';
import { centreCamera } from '../systems/wide.ts';
import { areaArt, catArt, isAreaArt, preloadAll, setupAssets } from '../assets.ts';
import { player } from '../save.ts';
import { normalizeCode } from '../theoswap.ts';
import { levelDef } from '../game/levels.ts';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload(): void {
    centreCamera(this);
    const w = 420, x = (GAME_W - w) / 2, y = GAME_H / 2;
    this.add.rectangle(x, y, w, 16, COLORS.panel).setOrigin(0, 0.5);
    const bar = this.add.rectangle(x, y, 1, 16, COLORS.gold).setOrigin(0, 0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => { bar.width = Math.max(1, w * p); });
    document.getElementById('loading')?.remove();
    // Cats: only the deck's (the Cats screen loads the rest). Streets and bosses: only area 1's street; fights load
    // their own. Add-on cats: only when a fight takes them.
    const want = new Set([...catArt(player.deck().map((d) => d.cat)), ...areaArt(levelDef(0), 0)]);
    preloadAll(this, (key) => want.has(key) || !(key.startsWith('cat.') || key.startsWith('addon.') || isAreaArt(key)));
  }

  create(): void {
    setupAssets(this);
    // Passion One is a CSS @font-face (index.html); wait for it so the first texts aren't drawn in the fallback.
    const ready = document.fonts?.load(`40px ${FONT.split(',')[0]}`).catch(() => null) ?? Promise.resolve();
    // A ?userCode= link connects straight away; the code is taken out of the address afterwards. TheoSwap's
    // Developer page sets the game's website to …/defend-the-alley/?userCode=$USER_CODE and fills in the player's
    // code. A link where it wasn't filled in ($USER_CODE) or a code too short to be real is ignored.
    const q = new URLSearchParams(location.search), raw = q.get('userCode');
    if (raw !== null) { q.delete('userCode'); history.replaceState(null, '', `${location.pathname}${q.size ? `?${q}` : ''}${location.hash}`); }
    const clean = normalizeCode(raw ?? ''), code = clean.length >= 4 && clean !== 'USERCODE' ? clean : '';
    Promise.race([ready, new Promise((r) => setTimeout(r, 2500))]).then(() => (code ? this.scene.start('Connect', { code }) : this.scene.start('Menu')));
  }
}
