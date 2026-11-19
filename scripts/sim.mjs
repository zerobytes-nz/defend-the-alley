// Balance check: a simple bot plays many fights with different players and prints win rates. No browser needed.
//   npm run sim                 levels and Full Alley, no upgrades, for each demo player
//   npm run sim -- --campaign   a guest plays levels 1–15 in order, spending gems like a player would
//   npm run sim -- --seeds 200
//   npm run sim -- --tune 1.5,0.97,0.03,0.3
// Node runs the game's own TypeScript (src/game/) directly (type stripping, Node ≥ 22.18).
import { Defense } from '../src/game/sim.ts';
import { think } from '../src/game/bot.ts';
import { FULL_ALLEY, LEVEL_COUNT, levelDef, starsFor, tune } from '../src/game/levels.ts';
import { awisFromItems } from '../src/game/awi.ts';
import { PROFILES } from '../src/game/demo.ts';
import { addonUnlocked, featureUnlocked, buyAddon, buyCatStep, buyIncome, buyWall, catStepCost, clearLevel, deckOf, equipped, fightSetup, levelGems, newSave, rowStepCost, spendAddons, toggleLoadout } from '../src/game/progress.ts';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const seeds = arg('--seeds', 60);
/** --tune g0,step,curve,share: try other level difficulty numbers (see src/game/levels.ts). */
const t = process.argv.indexOf('--tune');
if (t > 0) tune(...process.argv[t + 1].split(',').map(Number));

/** One fight; returns the sim at the end. */
function fight(save, awis, n, seed) {
  const setup = fightSetup(save, awis, n);
  const d = new Defense({ ...setup, seed });
  d.used = setup.addons; // as they were at the start (the sim works on a copy)
  let k = 0;
  while (d.state === 'playing' && d.time < 900) { if (k++ % 30 === 0) think(d); d.step(); d.events.length = 0; }
  return d;
}

/** A save with every level up to `cleared` done (unlocks free cats) and nothing bought. */
const saveAt = (cleared) => { const s = newSave(); for (let i = 0; i < cleared; i++) s.stars[i] = 1; return s; };

if (process.argv.includes('--campaign')) campaign(); else table();

function table() {
  const cols = [...Array(LEVEL_COUNT).keys(), FULL_ALLEY];
  console.log(`Win % over ${seeds} seeds, no upgrades or add-ons bought (each level played with the cats unlocked by then).\n`);
  console.log('Player'.padEnd(11), cols.map((n) => (n === FULL_ALLEY ? ' Alley' : `L${n + 1}`.padStart(4))).join(''));
  for (const p of Object.values(PROFILES)) {
    const awis = awisFromItems(p.items);
    const row = cols.map((n) => {
      const s = saveAt(n === FULL_ALLEY ? LEVEL_COUNT : n);
      for (const a of awis) if (a.kind === 'addon') toggleLoadout(s, a.uid);
      let wins = 0;
      for (let seed = 1; seed <= seeds; seed++) if (fight(s, awis, n, seed).state === 'won') wins++;
      return String(Math.round((wins / seeds) * 100)).padStart(n === FULL_ALLEY ? 6 : 4);
    });
    console.log(p.name.padEnd(11), row.join(''));
  }
}

/** A guest plays the levels in order like a player: retry until cleared, spend gems between fights. */
function campaign() {
  const runs = Math.min(seeds, 20);
  const tries = Array(LEVEL_COUNT).fill(0);
  let stuck = 0;
  const end = [];
  for (let r = 0; r < runs; r++) {
    const s = newSave(), awis = [];
    let seed = r * 1000;
    for (let n = 0; n < LEVEL_COUNT; n++) {
      let t = 0;
      for (;;) {
        shop(s, awis);
        const d = fight(s, awis, n, ++seed);
        spendAddons(s, d.used, d.addons);
        t++;
        if (d.state === 'won') { award(s, n, d); break; }
        if (t >= 40) break;
        // Lost: replay the last cleared level for gems, like a player would.
        if (n > 0) { const f = fight(s, awis, n - 1, ++seed); spendAddons(s, f.used, f.addons); if (f.state === 'won') award(s, n - 1, f); t++; }
      }
      tries[n] += t;
      if (s.stars[n] === 0) { stuck++; break; }
    }
    end.push({ cleared: s.stars.filter((x) => x > 0).length, steps: s.cat.reduce((a, b) => a + b, 0), wall: s.wall, income: s.income, gems: s.gems });
  }
  console.log(`Guest campaign, ${runs} players. Average fights per level, replays for gems included (1 = cleared first try):`);
  console.log(tries.map((t, i) => `L${i + 1} ${(t / runs).toFixed(1)}`).join('  '));
  console.log(`Stuck (40 fights without a clear): ${stuck} of ${runs}`);
  console.log('End state:', end.slice(0, 5).map((e) => JSON.stringify(e)).join('\n           '));
}

function award(s, n, d) {
  const stars = starsFor(d.wallHp / d.wallMax);
  s.gems += levelGems(n, stars, s.stars[n] === 0);
  clearLevel(s, [], n, stars);
}

/** Spend gems like a sensible player: deck cats' upgrades, then wall and income, keep 2 add-ons stocked. */
function shop(s, awis) {
  if (!featureUnlocked(s, awis, 'cats')) return; // the Cats screen opens after level 3
  for (let guard = 0; guard < 50; guard++) {
    const deck = deckOf(s, awis);
    const cat = deck.map((d) => d.cat).sort((a, b) => s.cat[a - 1] - s.cat[b - 1])[0];
    const options = [
      [catStepCost(s, cat), () => buyCatStep(s, cat)],
      [rowStepCost(s.wall), () => buyWall(s)],
      [rowStepCost(s.income), () => buyIncome(s)],
    ].filter(([c]) => c !== null).sort((a, b) => a[0] - b[0]);
    if (!options.length || !options[0][1]()) break;
  }
  for (const id of ['bomb', 'rocket']) {
    if (!addonUnlocked(s, awis, id)) continue;
    if (!s.loadout.includes(id)) toggleLoadout(s, id);
    while ((s.stock[id] ?? 0) < 2 && buyAddon(s, id));
  }
}
