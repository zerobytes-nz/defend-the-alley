# Defend the Alley: plan

TheoSwap showcase game #3. The same NFTs that are hero skins in [Altered Run](https://github.com/zerobytes-nz/altered-run)
and unit cards in [Altered Arena](https://github.com/zerobytes-nz/altered-arena) become **cat defenders** here:
**AWIs (Altered World Items)**, the in-game items TheoSwap maps an NFT to.

- **Genre:** lane defense, **landscape only**, taps only, for the phone browser (installable PWA). Portrait phones get a "turn your phone sideways" screen.
- **Stack:** Phaser 3.90 + TypeScript + Vite, the same setup as Altered Run and Altered Arena.
- **Art:** CraftPix [Free Cartoon Cat Defense Game Asset Kit](https://craftpix.net/freebies/free-cartoon-cat-defense-game-asset-kit/).
  It is never committed: see [ASSETS.md](ASSETS.md). The font is Passion One (OFL), which is committed.
- **Name:** "Defend the Alley" (earlier working names: "Altered Defense", "Altered Alley"). It is easy to rename
  while there is no GitHub repo yet.

## The game

Cats stand behind a wall of crates on the left of a street. Zombies walk in from the right along **5 lanes** and hit the
wall. When the wall breaks, the run is over. Clear **5 areas** of the street to win.

| | |
|---|---|
| Screen | 1440×720 landscape (2:1). The kit's Area art fills it and already has the 2×5 cat grid, the crate wall and the wall's health bar on the left, so the game uses them as drawn (`src/game/layout.ts` measures them). HUD on the top sidewalk (coins, area, wave, ×1/×2, pause), card tray bottom right. |
| Run | 5 areas × 3 waves: two zombie waves, then a **boss** wave. About 2½–3 minutes. |
| Areas | Main Street, Sand Lot, Overpass, Rush Hour, Park Lane (the kit's Area1–5). Each brings tougher zombie types and its own boss (kit Boss 1–5). |
| Taps | Tap a cat card, then tap an empty spot to place it (the card stays picked, so placing several is quick). Tap a placed cat for its stats and **Upgrade** (levels 1–4). |
| Coins | Start with 150; +3 a second; zombies drop 8–12, bosses 60. Placing costs 30, +10 for each more copy of the same card. Upgrades cost 35 / 60 / 95. |
| Wall | 100 HP. Zombies hit it for 1–2, bosses for 5. |
| Zombies | 8 kinds (kit Enemy Reg 1–8): plain, pot helmet, fast granny, red cap, baseball cap, spiked tank, traffic cone, football helmet. Health grows each wave. |

### Cat defender AWIs

Every defender is **one of the kit's 15 cats** plus an **attack** and a **rarity**:

| | Options | Effect |
|---|---|---|
| Cat (C1–C15) | 3 families of 5: bazooka tabbies C1–5 (slow, heavy), blaster greys C6–10 (balanced), rifle whites C11–15 (fast, long range). Later cats in a family are 4% stronger per step. | art + base damage, fire rate, range |
| Attack (bullet colour) | **Blast** (red): splash 60% within 70 px. **Rapid** (yellow): 1.8× fire rate, 0.6× damage. **Venom** (green): slows to 55% for 1.6 s. | |
| Rarity | Common / Rare / Epic / Legendary: damage ×1 / 1.3 / 1.7 / 2.3, fire rate ×1 / 1.05 / 1.1 / 1.2, range +0 / 20 / 40 / 60 | the card's colour stripe |

So an AWI says: which cat, its attack, its rarity, and the stats **damage, fire rate, range** (`src/game/cats.ts → makeDefender`).

- **Guests** get three free Common cats, one per family and attack (Ginger · Blast, Smokey · Venom, Snowy · Rapid).
- **NFT holders** bring up to 5 cards (the tray holds 5): their best NFTs, then guest cats to fill.
- **Collection bonus** (milestone 2): 2+ cards from one NFT collection: +10% damage for those cats; 3+: also +10% fire rate.
  TheoSwap test NFTs share the zero-address contract, which counts as no collection (same rule as Arena).

### Balance (`npm run sim`)

A bot plays whole runs headless (`src/game/bot.ts`, the same code as `?bot` in the browser). 100 seeds per deck:

| Deck | Wins | Typical end | Median run |
|---|---|---|---|
| Guest (3 Common) | 1% | area 4–5 | 185 s |
| Rare ×3 | 90% | win / area 5 | 189 s |
| Epic ×3 | 100% | win, wall 95 | 162 s |
| Legendary ×3 | 100% | win, wall 100 | 142 s |
| `?nft` sample deck | 100% | win, wall 90 | 159 s |

That is the pitch: guests get far and see every area but rarely win; NFTs make the difference. A human may play worse
than the bot, so check on a phone with real players in milestone 3 (and maybe give guests a little more).

## Code map

| | |
|---|---|
| `src/game/` | Pure TypeScript, no Phaser: `layout.ts` (lanes, spots, wall), `cats.ts` (AWI stats), `waves.ts` (areas, zombies, seeded waves), `sim.ts` (the 60 Hz simulation: commands in, events out), `bot.ts`. `npm run sim` runs it in Node. |
| `src/scenes/` | `BootScene` (loads the deck's cats and area 1), `MenuScene` (deck, install, best run), `DefenseScene` (draws sim events, taps → commands, HUD, tray, pause, end screen). |
| `src/assets.ts` | Manifest keys → Phaser textures/animations; `ensureLoaded` / `release` per area. |
| `src/theoswap.ts`, `src/systems/install.ts`, `src/systems/audio.ts` | From Altered Arena: TheoSwap proxy client + offline cache, Android-via-Chrome / iOS install, Web Audio synth (no sound files). |
| `scripts/` | Asset rails (`check-assets`, `assets:docs`, `assets:status`, `assets:placeholders`, `assets:pack`, **`assets:import`** for the kit), `sim`, `pwa:icons`, `deploy`. |

## Asset decisions

- **PNG frame sequences**, not Spine and not the JSON atlases: the kit's `Json Atlas/` folders are Spine 4.3 skeletons
  (part atlases + bone animation), not frame atlases, so they would need the Spine runtime plugin. `Png/` has every
  animation as numbered frames, which pack straight into Phaser spritesheets. Spine would only be worth it for
  smoother/smaller animation later.
- `npm run assets:import -- <kit>` packs everything in one go (3 s): frames sampled evenly (e.g. zombie walk 35 → 14),
  one fixed scale per character, sheets wrapped into rows to stay ≤ 4096 px.
- Memory: only the deck's cats are loaded; streets and bosses load one area ahead and are released after.
  Real art is 9.9 MB on disk for all 94 sheets (placeholders 4.4 MB).
- Not used yet: Cat Guardian and CatBoxing (melee cats: candidates for Legendary-only AWIs), Boss 6–7, most UI screens.

## Milestones

### 1. Core loop on a phone ✅ (this commit)
- Kit art via `assets:import`, committed placeholders with the same names/sizes, ASSETS.md, check-assets + CI.
- 5 lanes, place/upgrade cats, 8 zombie kinds, 5 areas with bosses, Blast/Rapid/Venom, win/lose, best run, pause, ×2.
- Guest deck; `?nft` sample NFT deck; `?bot` autoplay; `?seed=N`; `?debug` FPS meter.
- PWA manifest, service worker, install button (from Arena).
- **Landscape only** (switched from portrait after the first build): 1440×720 on the kit's own street art.
- **Measured** in the Claude browser pane (desktop CPU, WebGL, 812×375): full bot runs with no errors (portrait build:
  2.5 ms median, 3.0 ms p95 per frame; landscape: well under that). The pane throttles rendering, so **60 FPS on a
  real phone is not measured yet**.

### 2. TheoSwap
- **Ask first:** create the hidden game "Defend the Alley" and its config with the theoswap MCP (dry run → approval).
- Config tree "Defend the Alley Cat Defenders": leaves `cat_c1` … `cat_c15`, each with attack and rarity weights,
  so an NFT's seed picks e.g. `{ itemId: 'cat_c9', attack: 'blast', Rarity: 'Epic' }`; stats come from `makeDefender`
  (optional `damage` / `fireRate` / `range` overrides in itemData win, so the config can tune single AWIs).
- Port from Arena: Connect scene (8-letter code + `?userCode=` deep link), Reveal scene (one AWI card per NFT), demo
  profiles with test codes (Whale / Collector / New player) + bundled sample data, `src/awi.ts`, `src/profile.ts`.
- Deck screen: pick up to 5 cards; collection bonus shown on the cards.
- Remember the Arena lesson: test codes only return items once the config is **published**, which is a live change
  that needs the user's explicit OK.

### 3. Polish and deploy
- Fill wide phones (19.5:9) instead of letterboxing (Phaser `Scale.EXPAND`, extend the street art to the sides).
- Measure FPS and memory on a real Android phone and an iPhone; trim texture sizes if needed.
- Hit/death juice, coin fly-to-HUD, tutorial hint on the first run, music per area.
- Balance with real players; Cat Guardian / CatBoxing AWIs.
- **Ask first:** GitHub repo (zerobytes-nz/defend-the-alley), Jira epic (THEOS), push; then deploy to
  `games.theoswap.io/defend-the-alley` with the nginx key proxy (same as Arena).
