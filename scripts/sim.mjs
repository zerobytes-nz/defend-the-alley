// Balance check: a simple bot plays whole runs with different decks, many seeds each, and prints how far
// it gets, the win rate and the run length. No browser needed.
//   npm run sim
//   npm run sim -- --seeds 200
// Node runs the game's own TypeScript (src/game/) directly (type stripping, Node ≥ 22.18).
import { Defense } from '../src/game/sim.ts';
import { GUEST_DECK, SAMPLE_DECK, makeDefender } from '../src/game/cats.ts';
import { AREAS, WAVES_PER_AREA } from '../src/game/waves.ts';
import { think } from '../src/game/bot.ts';

const seeds = Number(process.argv[process.argv.indexOf('--seeds') + 1]) || 100;
/** --trace: print the wave timeline of seed 1 for each deck. */
const trace = process.argv.includes('--trace');
const decks = [
  ['Guest (3 Common)', GUEST_DECK],
  ['Rare x3', [makeDefender(2, 'blast', 'Rare'), makeDefender(7, 'venom', 'Rare'), makeDefender(12, 'rapid', 'Rare')]],
  ['Epic x3', [makeDefender(4, 'blast', 'Epic'), makeDefender(8, 'venom', 'Epic'), makeDefender(13, 'rapid', 'Epic')]],
  ['Legendary x3', [makeDefender(5, 'blast', 'Legendary'), makeDefender(10, 'venom', 'Legendary'), makeDefender(15, 'rapid', 'Legendary')]],
  ['?nft sample deck', SAMPLE_DECK],
];

console.log(`${seeds} seeds per deck. Reached = area the run ended in (wins count as area 6).\n`);
console.log('Deck'.padEnd(20), 'Win%'.padStart(5), '  Reached area 1..5 / won', '   Median s', '  Wall left (wins)');
for (const [name, deck] of decks) {
  const reached = Array(AREAS.length + 1).fill(0);
  const times = [], walls = [];
  let wins = 0;
  if (trace) console.log(name);
  for (let seed = 1; seed <= seeds; seed++) {
    const d = new Defense(deck, seed);
    let n = 0;
    while (d.state === 'playing' && d.time < 600) {
      if (n++ % 30 === 0) think(d);
      d.step();
      if (trace && seed === 1) for (const e of d.events) {
        if (e.t === 'wave') console.log(`  ${d.time.toFixed(1).padStart(5)}s wave ${e.wave + 1}${e.boss ? ' BOSS' : ''}  wall ${d.wallHp}  coins ${d.coins}  cats ${d.slots.map((p) => (p ? p.level : '.')).join('')}  alive ${d.enemies.length}`);
        if (e.t === 'kill' && e.enemy.type.boss) console.log(`  ${d.time.toFixed(1).padStart(5)}s   boss down`);
      }
      d.events.length = 0;
    }
    if (d.state === 'won') { wins++; reached[AREAS.length]++; walls.push(d.wallHp); } else reached[Math.floor(Math.max(0, d.wave) / WAVES_PER_AREA)]++;
    times.push(d.time);
  }
  times.sort((a, b) => a - b);
  walls.sort((a, b) => a - b);
  console.log(name.padEnd(20), String(Math.round((wins / seeds) * 100)).padStart(5), '  ', reached.map((n) => String(n).padStart(3)).join(' '),
    '  ', times[times.length >> 1].toFixed(0).padStart(6), '     ', walls.length ? walls[walls.length >> 1] : '-');
}
