// A simple player for `npm run sim` (balance) and ?bot (hands-free demo / soak test in the browser).
// Call think() about twice a second: it fills the most threatened lane, else upgrades a cat there.
import type { Defense } from './sim.ts';
import { COLS, LANES, SPAWN_X, slotIndex } from './layout.ts';

export function think(d: Defense): void {
  const threat = Array.from({ length: LANES }, (_, l) => d.enemies.filter((e) => e.lane === l).reduce((s, e) => s + e.hp + (SPAWN_X - e.x) / 2, 0));
  const lanes = [...Array(LANES).keys()].sort((a, b) => threat[b] - threat[a]);
  const best = [...d.deck].sort((a, b) => b.dmg * b.rate - a.dmg * a.rate);
  for (const l of lanes) {
    for (let c = COLS - 1; c >= 0; c--) {
      const s = slotIndex(l, c);
      if (d.slots[s]) continue;
      const def = best.find((x) => d.placeCost(x) <= d.coins);
      if (def && (c === COLS - 1 || threat[l] > 0)) { d.place(s, def); return; }
    }
    const up = [0, 1].map((c) => d.slots[slotIndex(l, c)]).filter((p) => p !== null).sort((a, b) => a.level - b.level)[0];
    const cost = up ? d.upgradeCost(up) : null;
    if (up && cost !== null && cost <= d.coins && threat[l] > 0) { d.upgrade(up.slot); return; }
  }
}
