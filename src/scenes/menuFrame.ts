// The frame the Map, Cats and Add-ons screens share, laid out like the kit's own screens (Preview/Ui):
// the dark side menu with tabs and the daily gift, a gem counter, a title ribbon over the grey panel.
import Phaser from 'phaser';
import { COLORS, GAME_W, GAME_H } from '../config.ts';
import { addonArt, areaArt, catArt, ensureLoaded } from '../assets.ts';
import { player } from '../save.ts';
import { claimDaily, dailyReady, featureUnlocked } from '../game/progress.ts';
import { featureLevel } from '../game/unlocks.ts';
import { notice, tappable, text } from '../ui.ts';
import { isInstalled, tryCloseApp } from '../systems/install.ts';
import { sfx } from '../systems/audio.ts';

export type Tab = 'Map' | 'Cats' | 'Addons' | 'Almanac';
/** The side menu's width, and the grey panels of the two kit screen backgrounds (game px). */
export const SIDE_W = 281;
export const PANEL = { x: 370, y: 174, w: 904, h: 445 };
export const ADDON_PANEL = { x: 555, y: 181, w: 719, h: 445 };

const TABS: { tab: Tab; icon: string; label: string }[] = [
  { tab: 'Map', icon: 'ui.icon-home', label: 'Map' },
  { tab: 'Cats', icon: 'ui.icon-cat', label: 'Cats' },
  { tab: 'Addons', icon: 'ui.icon-addon', label: 'Add-ons' },
  { tab: 'Almanac', icon: '📖', label: 'Almanac' },
];

export interface Frame { refreshGems(): void; flash(msg: string, bad?: boolean): void }

export function drawFrame(scene: Phaser.Scene, active: Tab, title: string, bg = 'bg.screen'): Frame {
  scene.add.image(0, 0, bg).setOrigin(0);
  const cx = active === 'Addons' ? ADDON_PANEL.x + ADDON_PANEL.w / 2 : PANEL.x + PANEL.w / 2;
  scene.add.image(cx, 100, 'ui.ribbon').setScale(0.78);
  text(scene, cx, 88, title, 40).setOrigin(0.5);

  TABS.forEach((t, i) => {
    const y = 262 + i * 112, on = t.tab === active;
    const tab = on ? scene.add.image(SIDE_W + 46, y, 'ui.tab-on').setOrigin(1, 0.5).setScale(0.66) : scene.add.image(SIDE_W, y, 'ui.tab').setOrigin(1, 0.5).setScale(0.66);
    const ix = on ? SIDE_W - 50 : SIDE_W - 58;
    if (t.icon.startsWith('ui.')) scene.add.image(ix, y - 10, t.icon).setScale(0.62);
    else text(scene, ix, y - 10, t.icon, 40, '#ffffff', 0).setOrigin(0.5);
    text(scene, ix, y + 34, t.label, 20, COLORS.text, 4).setOrigin(0.5);
    const feature = t.tab === 'Cats' ? 'cats' : t.tab === 'Addons' ? 'addons' : null;
    const open = !feature || featureUnlocked(player.save, player.awis, feature);
    if (!open) { tab.setAlpha(0.55); scene.add.image(ix + 30, y - 34, 'ui.lvl-locked').setScale(0.3); }
    if (!on) tappable(tab, () => (open ? scene.scene.start(t.tab) : flash(`Clear level ${featureLevel(feature!)} to open ${t.label}`)));
  });

  // Gems, top left of the panel.
  scene.add.image(PANEL.x + 120, 100, 'ui.gembar').setScale(0.9);
  scene.add.image(PANEL.x + 42, 100, 'ui.gem').setScale(0.9);
  const gems = text(scene, PANEL.x + 140, 98, '', 32).setOrigin(0.5);
  const refreshGems = () => gems.setText(String(player.save.gems));
  refreshGems();

  // Daily gift: tap to claim once a day; the streak grows on days in a row.
  const ready = dailyReady(player.save, new Date());
  const gift = scene.add.image(140, 120, 'ui.daily').setScale(0.62).setAlpha(ready ? 1 : 0.55);
  const day = text(scene, 140, 160, ready ? 'Gift!' : `Day ${player.save.daily.streak}`, 22, '#ffffff', 4).setOrigin(0.5);
  if (ready) scene.tweens.add({ targets: gift, scale: 0.68, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.InOut' });
  tappable(gift, () => {
    const got = claimDaily(player.save, new Date());
    if (!got) { flash(`Next gift tomorrow (day ${player.save.daily.streak + 1})`, false); return; }
    player.persist();
    scene.tweens.killTweensOf(gift);
    gift.setScale(0.62).setAlpha(0.55);
    day.setText(`Day ${player.save.daily.streak}`);
    refreshGems();
    flash(`Day ${player.save.daily.streak} gift: +${got} gems`, false);
    sfx.finish();
  });

  // Back to the title screen (pick another demo player).
  const whoLabel = text(scene, 0, -2, `👤 ${player.name}`, 26, COLORS.text, 4).setOrigin(0.5);
  whoLabel.setScale(Math.min(1, 170 / whoLabel.width)); // long names ("Code AAAAAAAA") shrink to fit the box
  const who = scene.add.container(GAME_W - 110, 44, [
    scene.add.rectangle(0, 0, 190, 50, 0x000000, 0.45).setStrokeStyle(3, 0xffffff, 0.35),
    whoLabel,
  ]).setSize(190, 50);
  tappable(who, () => scene.scene.start('Menu'));

  // Installed app (or full screen): an Exit button next to it, so players don't have to go back to the title.
  if (isInstalled() || scene.scale.isFullscreen) {
    const exit = scene.add.container(GAME_W - 280, 44, [
      scene.add.rectangle(0, 0, 130, 50, 0x000000, 0.45).setStrokeStyle(3, 0xffffff, 0.35),
      text(scene, 0, -2, '✕ Exit', 26, COLORS.text, 4).setOrigin(0.5),
    ]).setSize(130, 50);
    tappable(exit, () => exitApp(scene));
  }

  let msg: Phaser.GameObjects.Text | null = null;
  function flash(s: string, bad = true): void {
    msg?.destroy();
    msg = text(scene, cx, GAME_H - 52, s, 30, bad ? '#ff9a8a' : '#ffd02a', 6).setOrigin(0.5).setDepth(3000);
    scene.tweens.add({ targets: msg, alpha: 0, delay: 1400, duration: 400 });
    if (bad) sfx.hurt();
  }
  return { refreshGems, flash };
}

/** Close the installed app (or leave full screen in a browser). Browsers may refuse to close: then say how. */
export function exitApp(scene: Phaser.Scene): void {
  if (scene.scale.isFullscreen && !isInstalled()) { scene.scale.stopFullscreen(); return; }
  tryCloseApp().then((closed) => {
    if (!closed) notice(scene, 'Close the game', ['Swipe up, or use your phone\'s Home or', 'Back button.']);
  });
}

/** Load what a fight needs (deck cats, first street and bosses, add-on cats), then start it. */
export function startFight(scene: Phaser.Scene, level: number): void {
  const f = player.fight(level);
  const keys = [...catArt(f.deck.map((d) => d.cat)), ...areaArt(f.level, f.level.waves[0].area), ...addonArt(f.addons.map((a) => a.id))];
  const shade = scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0).setDepth(4000).setInteractive();
  const t = text(scene, GAME_W / 2, GAME_H / 2, 'Loading…', 44).setOrigin(0.5).setDepth(4001);
  void ensureLoaded(scene, keys).then(() => { shade.destroy(); t.destroy(); scene.scene.start('Defense', { level }); });
}
