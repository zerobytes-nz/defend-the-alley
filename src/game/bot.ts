// A simple player for `npm run sim` (balance) and ?bot (hands-free demo / soak test in the browser).
// Call think() about twice a second: it repairs a weak wall, fires add-ons when things look bad, fills the most
// threatened lane, else upgrades a cat there.
import type { Defense } from './sim.ts';
import { ADDONS } from './addons.ts';
import { COLS, LANES, SPAWN_X, slotIndex } from './layout.ts';

export function think(d: Defense): void {
  const threat = Array.from({ length: LANES }, (_, l) => d.enemies.filter((e) => e.lane === l).reduce((s, e) => s + e.hp + (SPAWN_X - e.x) / 2, 0));
  const lanes = [...Array(LANES).keys()].filter((l) => d.laneOpen(l)).sort((a, b) => threat[b] - threat[a]);

  // Wall below 40%: repair if there's money.
  const repair = d.repairCost();
  if (repair !== null && d.wallHp < d.wallMax * 0.4 && d.coins >= repair) { d.repair(); return; }

  // Add-ons: when a boss is on the street, the wall is under 60%, or a lane is swamped. Coins ×2 early.
  const boss = d.enemies.some((e) => e.type.boss && e.state !== 'dead');
  const swamped = threat[lanes[0]] > 900;
  const i = d.addons.findIndex((a) => a.uses > 0 && (a.id === 'coins' ? d.wave >= 0 && d.time > 8 : boss || swamped || d.wallHp < d.wallMax * 0.6));
  if (i >= 0 && d.time >= nextAddon.get(d)!) {
    nextAddon.set(d, d.time + 5);
    if (d.useAddon(i, ADDONS[d.addons[i].id].lane ? lanes[0] : -1)) return;
  }

  // Every square full: merge two matching cats to free one (a free level up).
  const open = d.slots.map((p, s) => s).filter((s) => d.laneOpen(Math.floor(s / COLS)));
  if (d.canMerge && open.every((s) => d.slots[s])) {
    for (const a of open) for (const b of open) if (d.canMergeInto(a, b)) { d.merge(a, b); return; }
  }

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
const nextAddon = new (class extends WeakMap<Defense, number> { get(k: Defense) { return super.get(k) ?? 0; } })();
