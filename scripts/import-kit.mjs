// Copies the art the game uses out of YOUR download of the CraftPix "Free Cartoon Cat Defense Game Asset Kit"
// into public/assets/licensed/ (gitignored), packed into the strips assets.manifest.json lists.
// The kit folder is only read: nothing in it is moved or changed.
//
//   npm run assets:import -- "<path to the unzipped kit folder>"
//
// The folder is the one that holds Png/, Json Atlas/, Spine/ … (e.g. craftpix-net-397030-free-cartoon-cat-defense-game-asset-kit).
// Each manifest entry's `kit` field says which files it is made from:
//   files  a folder of numbered frames, or one PNG, relative to the kit folder
//   scale  fixed scale (keeps a character the same size across its animations); default: fit the frame
//   crop   [x, y, w, h] part of the image to use (backgrounds)
//   align  'bottom' (characters) or 'center'
//   patch  [[sx, sy, w, h, dx, dy], …] copy part of the result over another (backgrounds: hide the trash-bin tile)
import fs from 'node:fs';
import path from 'node:path';
import { loadManifest, PUBLIC_DIR, ROOT } from './lib/assets.mjs';
import { packFrames } from './lib/pack.mjs';

const kitDir = process.argv[2];
if (!kitDir || !fs.existsSync(path.join(kitDir, 'Png'))) {
  console.error('Usage: npm run assets:import -- "<kit folder that contains Png/>"\nGet the kit from https://craftpix.net/freebies/ (see ASSETS.md).');
  process.exit(1);
}
const m = loadManifest();
const only = process.argv.slice(3); // optional: just these keys
let n = 0;
const problems = [];
for (const a of m.assets) {
  if (!a.kit || (only.length && !only.includes(a.key))) continue;
  const src = path.join(kitDir, a.kit.files);
  let files;
  if (!fs.existsSync(src)) { problems.push(`${a.key}: not found in the kit: ${a.kit.files}`); continue; }
  if (fs.statSync(src).isDirectory()) files = fs.readdirSync(src).filter((f) => f.toLowerCase().endsWith('.png') && !f.startsWith('.')).map((f) => path.join(src, f));
  else files = [src];
  if (!files.length) { problems.push(`${a.key}: no PNG frames in ${a.kit.files}`); continue; }
  const out = path.join(PUBLIC_DIR, m.roots.licensed, a.path);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, await packFrames(a, files, { scale: a.kit.scale, crop: a.kit.crop, align: a.kit.align, patch: a.kit.patch }));
  n++;
  process.stdout.write(`\r  ${n} files…`);
}
console.log(`\r✔ Wrote ${n} files to ${path.relative(ROOT, path.join(PUBLIC_DIR, m.roots.licensed))}/ (gitignored). Run npm run assets:status to check.`);
if (problems.length) { console.error(problems.map((p) => `  ✖ ${p}`).join('\n')); process.exit(1); }
