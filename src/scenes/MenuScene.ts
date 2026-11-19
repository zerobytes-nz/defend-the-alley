// Title screen: pick a demo player (their AWIs come from bundled sample data until TheoSwap sign-in), then PLAY.
import Phaser from 'phaser';
import { GAME_W, COLORS } from '../config.ts';
import { button, muteButton, notice, tappable, text } from '../ui.ts';
import { player } from '../save.ts';
import { PROFILES, type ProfileId } from '../game/demo.ts';
import { awisFromItems } from '../game/awi.ts';
import { RARITY_COLOR } from '../game/cats.ts';
import { levelsCleared } from '../game/progress.ts';
import { canInstall, install, isInstalled, onInstallChange, openInChromeUrl, tryCloseApp } from '../systems/install.ts';
import { startMusic } from '../systems/audio.ts';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create(): void {
    this.add.image(0, 0, 'bg.menu').setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, 720, 0x000000, 0.25).setOrigin(0);
    text(this, GAME_W / 2, 90, 'DEFEND THE', 64, '#ffd02a', 12).setOrigin(0.5);
    text(this, GAME_W / 2, 170, 'ALLEY', 110, '#ff9a2a', 14).setOrigin(0.5);
    text(this, GAME_W / 2, 245, 'Cats hold the street. Zombies want it.', 30, COLORS.text, 6).setOrigin(0.5);

    text(this, GAME_W / 2, 300, 'Play as', 28, COLORS.dim, 5).setOrigin(0.5);
    (Object.keys(PROFILES) as ProfileId[]).forEach((id, i) => this.profileCard(id, GAME_W / 2 + (i - 1) * 330, 400));

    button(this, GAME_W / 2, 560, 'PLAY', () => this.play(), 'ui.btn-green', 0.85, 56);
    text(this, GAME_W / 2, 640, 'Demo players bring sample AWIs (Altered World Items): cat defenders and add-ons.', 22, COLORS.dim, 4).setOrigin(0.5);
    text(this, GAME_W / 2, 674, 'TheoSwap sign-in, where your own NFTs become AWIs, comes in milestone 3.', 22, COLORS.dim, 4).setOrigin(0.5);

    muteButton(this, GAME_W - 50, 50);
    this.appButtons();
    this.input.keyboard?.on('keydown-SPACE', () => this.play());
  }

  private profileCard(id: ProfileId, x: number, y: number): void {
    const p = PROFILES[id], on = player.id === id, save = player.peek(id);
    const awis = awisFromItems(p.items);
    const bg = this.add.rectangle(0, 0, 300, 150, 0x000000, on ? 0.7 : 0.5).setStrokeStyle(on ? 5 : 3, on ? 0xffee00 : 0xffffff, on ? 1 : 0.3);
    const items: Phaser.GameObjects.GameObject[] = [bg,
      text(this, 0, -46, p.name, 36, on ? '#ffd02a' : '#ffffff').setOrigin(0.5),
      text(this, 0, -8, p.blurb, 20, COLORS.dim, 3).setOrigin(0.5),
      text(this, 0, 50, `Level ${Math.min(15, levelsCleared(save) + 1)} · ${save.gems} gems`, 20, COLORS.text, 3).setOrigin(0.5),
    ];
    awis.slice(0, 9).forEach((a, k) => items.push(this.add.rectangle((k - (Math.min(9, awis.length) - 1) / 2) * 28, 22, 22, 8, RARITY_COLOR[a.rarity])));
    const c = this.add.container(x, y, items).setSize(300, 150);
    tappable(c, () => { if (player.id !== id) { player.use(id); this.scene.restart(); } });
  }

  private play(): void {
    startMusic();
    // On a phone browser tab, play full screen (the installed app already is).
    if (!isInstalled() && this.sys.game.device.input.touch && !this.scale.isFullscreen) {
      this.scale.startFullscreen();
      // Android Chrome can hold landscape while full screen; elsewhere the "turn your phone" hint covers it.
      (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.('landscape').catch(() => { /* not supported */ });
    }
    this.scene.start('Map');
  }

  /** Top left: "Install app" (until it is installed) and "Exit" (in full screen or the installed app). */
  private appButtons(): void {
    const mk = (x: number, label: string, onTap: () => void) => {
      const bg = this.add.rectangle(0, 0, 210, 56, 0x000000, 0.5).setStrokeStyle(3, 0xffffff, 0.4);
      const t = text(this, 0, -2, label, 28, COLORS.text, 4).setOrigin(0.5);
      return tappable(this.add.container(x, 50, [bg, t]).setSize(210, 56), onTap);
    };
    const inst = mk(125, '📲 Install app', () => this.installApp());
    const exit = mk(GAME_W - 200, '✕ Exit', () => this.exitApp());
    const sync = () => {
      inst.setVisible(canInstall());
      exit.setVisible(isInstalled() || this.scale.isFullscreen);
    };
    sync();
    const off = onInstallChange(sync);
    this.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, sync).on(Phaser.Scale.Events.LEAVE_FULLSCREEN, sync);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off();
      this.scale.off(Phaser.Scale.Events.ENTER_FULLSCREEN, sync).off(Phaser.Scale.Events.LEAVE_FULLSCREEN, sync);
    });
  }

  private installApp(): void {
    install().then((r) => {
      if (r === 'ios') {
        notice(this, 'Install on iPhone / iPad', [
          '1.  Tap the Share button  ⬆  in the browser bar',
          '2.  Choose  "Add to Home Screen"',
          '3.  Open Defend the Alley from your home screen:',
          '     it plays full screen, even offline.',
        ]);
      } else if (r === 'use-chrome') {
        notice(this, 'Install with Chrome', [
          'This browser builds an old-style app, and',
          'Android warns about it. Chrome installs it',
          'cleanly:',
          '1.  Tap  "Open in Chrome"  below',
          '2.  Tap  📲 Install app  again there',
        ], { label: 'Open in Chrome', onTap: () => { location.href = openInChromeUrl(); } });
      } else if (r === 'unavailable') {
        notice(this, 'Install', ['Open your browser menu  ⋮  and choose', '"Install app" or "Add to Home screen".']);
      }
    });
  }

  private exitApp(): void {
    if (this.scale.isFullscreen && !isInstalled()) { this.scale.stopFullscreen(); return; }
    tryCloseApp().then((closed) => {
      if (!closed) notice(this, 'Close the game', ['Swipe up, or use your phone\'s Home or', 'Back button.']);
    });
  }
}
