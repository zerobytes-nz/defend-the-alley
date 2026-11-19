import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS } from '../config.ts';
import { button, muteButton, notice, tappable, text } from '../ui.ts';
import { currentDeck } from '../deck.ts';
import { RARITY_COLOR } from '../game/cats.ts';
import { canInstall, install, isInstalled, onInstallChange, openInChromeUrl, tryCloseApp } from '../systems/install.ts';
import { startMusic } from '../systems/audio.ts';

const BEST_KEY = 'altered-alley.best.v1';
export interface Best { won: boolean; wave: number; time: number }
export function loadBest(): Best | null { try { const v = localStorage.getItem(BEST_KEY); return v ? (JSON.parse(v) as Best) : null; } catch { return null; } }
export function saveBest(b: Best): void { try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch { /* private mode */ } }

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create(): void {
    this.add.image(0, 0, 'bg.menu').setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.15).setOrigin(0);
    const glow = this.add.rectangle(0, 0, GAME_W, 330, 0x000000, 0.35).setOrigin(0);
    void glow;
    text(this, GAME_W / 2, 120, 'ALTERED', 70, '#ffd02a', 12).setOrigin(0.5);
    text(this, GAME_W / 2, 205, 'ALLEY', 120, '#ff9a2a', 14).setOrigin(0.5);
    text(this, GAME_W / 2, 285, 'Cats hold the street. Zombies want it.', 30, COLORS.text, 6).setOrigin(0.5);

    const deck = currentDeck();
    const panelY = 930;
    this.add.rectangle(GAME_W / 2, panelY, 640, 170, 0x000000, 0.5).setStrokeStyle(3, 0xffffff, 0.25);
    const nft = deck.some((d) => d.source === 'nft');
    text(this, GAME_W / 2, panelY - 58, nft ? 'Sample NFT deck (?nft)' : 'Guest cats: free for everyone', 28).setOrigin(0.5);
    deck.forEach((d, i) => {
      const x = GAME_W / 2 + (i - (deck.length - 1) / 2) * 116;
      const s = this.add.sprite(x, panelY + 64, `cat.c${d.cat}.idle`).setOrigin(0.5, 1).setScale(0.72).play(`cat.c${d.cat}.idle`);
      s.anims.setProgress((i * 0.31) % 1);
      this.add.rectangle(x, panelY + 70, 80, 6, RARITY_COLOR[d.rarity]);
    });

    button(this, GAME_W / 2, 1110, 'PLAY', () => this.play(), 'ui.btn-green', 1, 56);
    const best = loadBest();
    if (best) text(this, GAME_W / 2, 1200, best.won ? `Best: cleared all 5 areas in ${Math.round(best.time)} s` : `Best: wave ${best.wave} of 15`, 28, COLORS.dim, 5).setOrigin(0.5);
    text(this, GAME_W / 2, 1248, 'TheoSwap sign-in: your NFTs become cat AWIs (coming in milestone 2)', 20, COLORS.dim, 4).setOrigin(0.5);

    muteButton(this, GAME_W - 50, 50);
    this.appButtons();
    this.input.keyboard?.on('keydown-SPACE', () => this.play());
  }

  private play(): void {
    startMusic();
    // On a phone browser tab, play full screen (the installed app already is).
    if (!isInstalled() && this.sys.game.device.input.touch && !this.scale.isFullscreen) this.scale.startFullscreen();
    this.scene.start('Defense');
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
          '3.  Open Altered Alley from your home screen:',
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
