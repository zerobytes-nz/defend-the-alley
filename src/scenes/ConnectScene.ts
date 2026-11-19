// Connect TheoSwap: enter the player code from your TheoSwap profile (or open the game with ?userCode=…), and your
// NFTs become AWIs (Altered World Items): cat defenders, add-ons and boosts. Then the Reveal screen shows each one.
import Phaser from 'phaser';
import { GAME_W, COLORS } from '../config.ts';
import { player } from '../save.ts';
import { connect, forgetConnection, loadConnection } from '../profile.ts';
import { normalizeCode } from '../theoswap.ts';
import { button, text } from '../ui.ts';

export class ConnectScene extends Phaser.Scene {
  private busy = false;
  private status!: Phaser.GameObjects.Text;
  private field!: HTMLInputElement;
  private autoCode = '';

  constructor() { super('Connect'); }

  /** `code` comes from a ?userCode= deep link: fill it in and connect right away. */
  init(data: { code?: string }): void {
    this.autoCode = data?.code ?? '';
    if (data) delete data.code; // Phaser hands a restarted scene its last data again
  }

  create(): void {
    this.busy = false;
    this.add.image(0, 0, 'bg.menu').setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, 720, 0x000000, 0.55).setOrigin(0);
    text(this, GAME_W / 2, 70, 'CONNECT THEOSWAP', 56, '#ffd02a', 10).setOrigin(0.5);
    text(this, GAME_W / 2, 132, 'Your NFTs become AWIs (Altered World Items): cat defenders, add-ons and boosts.', 26, COLORS.text, 5).setOrigin(0.5);
    text(this, GAME_W / 2, 200, 'Enter the player code from your TheoSwap profile', 26, COLORS.dim, 4).setOrigin(0.5);

    const dom = this.add.dom(GAME_W / 2, 268).createFromHTML(
      '<input type="text" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="16" placeholder="PLAYER CODE" ' +
      'style="width:460px;height:74px;box-sizing:border-box;padding:0 18px;font:400 40px \'Passion One\',sans-serif;letter-spacing:5px;text-align:center;' +
      'text-transform:uppercase;color:#fff;background:#2b1d14;border:4px solid #ffd02a;border-radius:14px;outline:none;user-select:text;-webkit-user-select:text">');
    this.field = dom.node.querySelector('input') as HTMLInputElement;
    this.field.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') this.submit(); });
    button(this, GAME_W / 2, 372, 'Connect', () => this.submit(), 'ui.btn-green', 0.7, 52);
    this.status = text(this, GAME_W / 2, 446, '', 26, '#ff9a8a', 4).setOrigin(0.5).setAlign('center');

    const c = loadConnection();
    if (c) {
      text(this, GAME_W / 2, 510, `Connected: code ${c.code} · ${c.results.length} NFT${c.results.length === 1 ? '' : 's'}`, 26, '#8cff6a', 4).setOrigin(0.5);
      button(this, GAME_W / 2 - 170, 580, 'Disconnect', () => {
        forgetConnection();
        if (player.id === 'me') player.use('guest');
        this.scene.restart();
      }, 'ui.btn-orange', 0.5, 50);
      button(this, GAME_W / 2 + 170, 580, 'Show AWIs', () => this.leave('Reveal', { connection: c }), 'ui.btn-green', 0.5, 50);
    } else {
      text(this, GAME_W / 2, 520, 'No NFTs? You can play free: every cat unlocks by clearing levels.', 24, COLORS.dim, 4).setOrigin(0.5);
    }
    button(this, 130, 650, '← Back', () => this.leave('Menu'), 'ui.btn-orange', 0.45, 56);

    if (this.autoCode) { this.field.value = this.autoCode; this.submit(); }
    else if (!this.sys.game.device.input.touch) this.field.focus({ preventScroll: true });
  }

  private submit(): void {
    const code = normalizeCode(this.field.value);
    if (code.length < 4) { this.status.setColor('#ff9a8a').setText('Enter the code from your TheoSwap profile.'); return; }
    if (this.busy) return;
    this.busy = true;
    this.status.setColor(COLORS.text).setText('Connecting to TheoSwap…');
    connect(code).then(
      (connection) => { player.use('me'); this.leave('Reveal', { connection }); },
      (e: unknown) => { this.busy = false; this.status.setColor('#ff9a8a').setText(e instanceof Error ? e.message : 'Something went wrong.'); },
    );
  }

  private leave(key: string, data?: object): void {
    this.field.blur();
    this.scene.start(key, data);
  }
}
