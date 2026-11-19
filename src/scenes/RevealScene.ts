// Reveal: after connecting, one card per AWI (Altered World Item): "Your NFT #172 became a Legendary Top Hat", with a
// bigger fanfare for rarer ones. Tap for the next card; Play goes to the map as the connected player.
import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS } from '../config.ts';
import { awisFromItems, BOOSTS, type AWI, type BoostId } from '../game/awi.ts';
import { ATTACKS, AWI_PERK_INFO, RARITIES, RARITY_COLOR, ROLE, family, roleOf } from '../game/cats.ts';
import { ADDONS, AWI_ADDON_POWER, AWI_ADDON_USES } from '../game/addons.ts';
import type { Connection } from '../profile.ts';
import { asset, ensureLoaded } from '../assets.ts';
import { button, text } from '../ui.ts';
import { sfx } from '../systems/audio.ts';

const BOOST_ICON: Record<BoostId, string> = { coins: 'ui.coin', gems: 'ui.gem', wall: 'ui.wall', luckybox: 'ui.daily' };
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export class RevealScene extends Phaser.Scene {
  private connection!: Connection;
  private awis: AWI[] = [];
  private i = 0;
  private card?: Phaser.GameObjects.Container;
  private counter!: Phaser.GameObjects.Text;

  constructor() { super('Reveal'); }

  init(data: { connection: Connection }): void {
    this.connection = data.connection;
    this.awis = awisFromItems(this.connection.results);
    this.i = 0;
    this.card = undefined;
  }

  create(): void {
    this.add.image(0, 0, 'bg.menu').setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0);
    const c = this.connection;
    text(this, GAME_W / 2, 40, `Code ${c.code}${c.source === 'cache' ? ' · offline: last saved items' : ''}`, 24, COLORS.dim, 4).setOrigin(0.5);
    this.counter = text(this, GAME_W / 2, 690, '', 22, COLORS.dim, 4).setOrigin(0.5);
    button(this, GAME_W - 150, 650, this.awis.length ? 'Play →' : 'Play', () => this.scene.start('Map'), 'ui.btn-green', 0.5, 56);

    if (!this.awis.length) {
      text(this, GAME_W / 2, 300, 'No AWIs yet', 64, '#ffffff', 10).setOrigin(0.5);
      text(this, GAME_W / 2, 400, 'None of this code\'s NFTs are AWIs in Defend the Alley yet.\nYou play with the free cats, and they all unlock by clearing levels.', 28, COLORS.text, 5)
        .setOrigin(0.5).setAlign('center');
      return;
    }
    const cats = this.awis.flatMap((a) => (a.kind === 'cat' ? [`cat.c${a.def.cat}.idle`] : []));
    void ensureLoaded(this, cats).then(() => { if (this.scene.isActive()) this.show(); });
    this.input.on('pointerup', (_: unknown, over: unknown[]) => { if (!over.length) this.next(); });
    this.input.keyboard?.on('keydown-SPACE', () => this.next());
  }

  private next(): void {
    if (this.i >= this.awis.length - 1) { this.scene.start('Map'); return; }
    this.i++;
    this.show();
  }

  private show(): void {
    const a = this.awis[this.i], tier = RARITIES.indexOf(a.rarity), rc = RARITY_COLOR[a.rarity];
    const old = this.card;
    if (old) this.tweens.add({ targets: old, x: old.x - 300, alpha: 0, duration: 200, onComplete: () => old.destroy() });

    const token = a.name.includes('#') ? `#${a.name.split('#')[1]}` : '';
    let pic: Phaser.GameObjects.Image, title: string, lines: string[];
    if (a.kind === 'cat') {
      const d = a.def, key = `cat.c${d.cat}.idle`;
      pic = this.add.image(0, 40, key, 0).setOrigin(0.5, 1).setScale(asset(key).displayScale * 2.4);
      title = `${a.rarity} ${d.name.replace(/ #.*$/, '')}`;
      lines = [`${family(d.cat).name} · ${ATTACKS[d.attack].name}: ${ATTACKS[d.attack].blurb.toLowerCase()}`, `${ROLE[roleOf(d.cat)].name}: ${ROLE[roleOf(d.cat)].blurb}`, `${d.dmg} damage · ${d.rate} shots a second`];
      if (d.awiPerk) lines.push(`★ ${AWI_PERK_INFO[d.awiPerk].name}: ${AWI_PERK_INFO[d.awiPerk].blurb}`);
    } else if (a.kind === 'addon') {
      pic = this.add.image(0, -40, `ui.addon-${a.addon}`).setScale(1.3);
      title = `${a.rarity} ${ADDONS[a.addon].name}`;
      lines = ['Add-on', ADDONS[a.addon].blurb, `${AWI_ADDON_USES[a.rarity]} free use${AWI_ADDON_USES[a.rarity] > 1 ? 's' : ''} every level · power ×${AWI_ADDON_POWER[a.rarity]}`];
    } else {
      pic = this.add.image(0, -40, BOOST_ICON[a.boost]).setScale(1.4);
      title = `${a.rarity} ${BOOSTS[a.boost].name}`;
      lines = ['Boost', BOOSTS[a.boost].blurb(a.rarity)];
    }

    const c = this.add.container(GAME_W / 2 + 300, GAME_H / 2 + 10).setAlpha(0);
    const rays = this.add.star(0, -40, 12, 110, 250, rc, tier >= 2 ? 0.3 : 0.12);
    const lead = text(this, 0, -270, `Your NFT ${token} became`, 30, COLORS.text, 5).setOrigin(0.5);
    const head = text(this, 0, -222, title.toUpperCase(), 48, hex(rc), 9).setOrigin(0.5);
    if (head.width > 900) head.setScale(900 / head.width);
    const body = this.add.text(0, 70, lines.join('\n'), { fontFamily: '"Passion One", sans-serif', fontSize: '26px', color: '#ffffff', align: 'center', lineSpacing: 4 })
      .setOrigin(0.5, 0).setStroke('#2b1d14', 5);
    c.add([rays, pic, lead, head, body]);
    this.tweens.add({ targets: c, x: GAME_W / 2, alpha: 1, duration: 280, ease: 'Back.Out' });
    this.tweens.add({ targets: rays, angle: 360, duration: 14000, repeat: -1 });
    if (tier === 3) this.cameras.main.flash(250, 255, 220, 120);
    this.card = c;
    sfx.reveal(tier);
    this.counter.setText(`${this.i + 1} / ${this.awis.length} · tap for the next one`);
  }
}
