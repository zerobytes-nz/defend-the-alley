import Phaser from 'phaser';
import { COLORS, FONT } from './config.ts';
import { isMuted, onMuteChange, sfx, toggleMute } from './systems/audio.ts';

/** Passion One text with the kit's chunky dark outline. */
export function text(scene: Phaser.Scene, x: number, y: number, s: string, size = 32, color = COLORS.text, stroke = 6) {
  const t = scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color });
  if (stroke) t.setStroke(COLORS.stroke, stroke);
  return t;
}

/** Make any object a tap target that squashes a little while pressed. */
export function tappable<T extends Phaser.GameObjects.GameObject & { setScale(x: number, y?: number): T; scale: number }>(obj: T, onTap: () => void, sound = true): T {
  const base = obj.scale;
  obj.setInteractive({ useHandCursor: true })
    .on('pointerdown', () => obj.setScale(base * 0.94))
    .on('pointerout', () => obj.setScale(base))
    .on('pointerup', () => { obj.setScale(base); if (sound) sfx.tap(); onTap(); });
  return obj;
}

/** A kit button (ui.btn-green / ui.btn-orange) with a label. */
export function button(scene: Phaser.Scene, x: number, y: number, label: string, onTap: () => void, key = 'ui.btn-green', scale = 1, size = 44) {
  const img = scene.add.image(0, 0, key);
  const t = text(scene, 0, -6, label, size).setOrigin(0.5);
  const c = scene.add.container(x, y, [img, t]).setSize(img.width, img.height).setScale(scale);
  tappable(c, onTap);
  return c;
}

/** Round speaker button that toggles sound (also the M key). Stays in sync across scenes. */
export function muteButton(scene: Phaser.Scene, x: number, y: number, r = 30) {
  const bg = scene.add.circle(0, 0, r, 0x000000, 0.45).setStrokeStyle(3, 0xffffff, 0.5);
  const t = scene.add.text(0, 1, '', { fontSize: `${Math.round(r * 0.95)}px` }).setOrigin(0.5);
  const c = scene.add.container(x, y, [bg, t]).setSize(r * 2, r * 2);
  const draw = (m: boolean) => t.setText(m ? '🔇' : '🔊');
  draw(isMuted());
  const off = onMuteChange(draw);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  bg.setInteractive({ useHandCursor: true }).on('pointerup', () => { toggleMute(); sfx.tap(); });
  return c;
}

/** A dimmed full-screen panel with a title, lines of text and a close tap. */
export function notice(scene: Phaser.Scene, title: string, lines: string[], action?: { label: string; onTap: () => void }): void {
  const W = scene.scale.gameSize.width, H = scene.scale.gameSize.height;
  const layer = scene.add.container(0, 0).setDepth(5000);
  const shade = scene.add.rectangle(0, 0, W, H, 0x000000, 0.75).setOrigin(0).setInteractive();
  const ph = 190 + lines.length * 42 + (action ? 130 : 0);
  const panel = scene.add.rectangle(W / 2, H / 2, 640, ph, COLORS.panel).setInteractive().setStrokeStyle(4, 0xffffff, 0.4);
  const top = H / 2 - ph / 2;
  layer.add([shade, panel, text(scene, W / 2, top + 50, title, 40).setOrigin(0.5)]);
  lines.forEach((l, i) => layer.add(text(scene, W / 2 - 290, top + 110 + i * 42, l, 28, COLORS.text, 0).setOrigin(0, 0.5)));
  if (action) layer.add(button(scene, W / 2, top + ph - 120, action.label, action.onTap, 'ui.btn-green', 0.8, 40));
  layer.add(text(scene, W / 2, top + ph - 34, 'Tap outside to close', 24, COLORS.dim, 0).setOrigin(0.5));
  shade.on('pointerup', () => layer.destroy());
}
