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

### AWIs: cat defenders and add-ons

An NFT becomes one of two kinds of AWI (Altered World Item): a **cat defender** (below) or, from milestone 2, an
**add-on** (one of the kit's 8 power-ups, with a rarity; see milestone 2).

Every cat defender is **one of the kit's 15 cats** plus an **attack** and a **rarity**:

| | Options | Effect |
|---|---|---|
| Cat (C1–C15) | 3 families of 5: bazooka tabbies C1–5 (slow, heavy), blaster greys C6–10 (balanced), rifle whites C11–15 (fast, long range). Later cats in a family are 4% stronger per step. | art + base damage, fire rate, range |
| Attack (bullet colour) | **Blast** (red): splash 60% within 70 px. **Rapid** (yellow): 1.8× fire rate, 0.6× damage. **Venom** (green): slows to 55% for 1.6 s. | |
| Rarity | Common / Rare / Epic / Legendary: damage ×1 / 1.3 / 1.7 / 2.3, fire rate ×1 / 1.05 / 1.1 / 1.2, range +0 / 20 / 40 / 60 | the card's colour stripe |

So an AWI says: which cat, its attack, its rarity, and the stats **damage, fire rate, range** (`src/game/cats.ts → makeDefender`).

- **Guests** get three free Common cats, one per family and attack (Ginger · Blast, Smokey · Venom, Snowy · Rapid).
- **NFT holders** bring up to 5 cards (the tray holds 5): their best NFTs, then guest cats to fill.
- **Collection bonus** (milestone 3): 2+ cards from one NFT collection: +10% damage for those cats; 3+: also +10% fire rate.
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
than the bot, so check on a phone with real players in milestone 4 (and maybe give guests a little more).

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
- Not used yet (all planned for milestone 2): Cat Guardian and CatBoxing (add-ons), Boss 6–7, the menu screens.
- Full inventory of the kit, its mock-up screens and how they compare with this plan: [docs/KIT-REVIEW.md](docs/KIT-REVIEW.md).

## Milestones

### 1. Core loop on a phone ✅
- Kit art via `assets:import`, committed placeholders with the same names/sizes, ASSETS.md, check-assets + CI.
- 5 lanes, place/upgrade cats, 8 zombie kinds, 5 areas with bosses, Blast/Rapid/Venom, win/lose, best run, pause, ×2.
- Guest deck; `?nft` sample NFT deck; `?bot` autoplay; `?seed=N`; `?debug` FPS meter.
- PWA manifest, service worker, install button (from Arena).
- **Landscape only** (switched from portrait after the first build): 1440×720 on the kit's own street art.
- **Measured** in the Claude browser pane (desktop CPU, WebGL, 812×375): full bot runs with no errors (portrait build:
  2.5 ms median, 3.0 ms p95 per frame; landscape: well under that). The pane throttles rendering, so **60 FPS on a
  real phone is not measured yet**.

### 2. Level select, upgrades, add-ons, and AWIs in all of them
Gives players a reason to come back between levels, built the way the kit's own screens are laid out
(see [docs/KIT-REVIEW.md](docs/KIT-REVIEW.md)). **AWIs (Altered World Items) are part of every screen**, using bundled
sample data in this milestone; live TheoSwap sign-in follows in milestone 3.

**Menu frame** (`LevelMap_Bg_Screen`, `BtnTab_*`, `Icon_home` / `Icon_Cat` / `Icon_Addon`, `GemsBarBg`, `DaillyIcon`)
- The kit's dark side menu with tabs: **Map**, **Cats**, **Add-ons**. No Shop tab (no real-money sales).
- Gem counter at the top. Daily gift box on the side menu with a day streak ("Day 3").

**Map: level select** (`LevelMap.png`, `GreenLevel` / `OrangeLvl` / `LockedLevel`, `TitleRibbon`)
- 15 levels, 3 per area (Main Street 1–3 … Park Lane 13–15), on the kit's winding road map. It scrolls sideways with a
  drag. The map is 7782×785, so it is split into two sheets of ≤ 4096 px.
- A level is a fight on that area's street: 4 waves early, rising to 10 by level 15 ("Wave 3 / 10" in the HUD). The 3rd
  level of each area ends with that area's boss. Boss 6 and 7 (unused so far) join the last levels and Full Alley.
- Markers: green = cleared (with 1–3 stars), orange = next, grey with a lock = locked. Clearing a level unlocks the next.
- Stars from the wall's health left: any = ★, ≥ 50% = ★★, 100% = ★★★.
- The milestone 1 run (all 5 areas in a row) stays as **Full Alley**, unlocked after level 15, with its own best score.

**Gems** (`GemsIcon`, `WinBonus`, `WinPopUp`)
- The one currency kept between levels; in-level coins still reset each level.
- Earned by clearing levels (more for more stars, a bonus the first time; shown on the "You Win" popup), plus the daily gift.
- **No real-money purchases or ads.** The kit's gem packs and "watch ads" art (`ShopIcon1–7`, shop boxes) are not used.

**Cats: upgrades** (`CatUpgradeScreen`, `0Bar–5Bar`, `AddBtn`, `LockedCatBox`, `SelectedBorder`, `ScrollBar*`, `Uplogo1–15`)
- The kit's layout: **one row per cat (C1–C15)**, each with a 5-step bar and a + button that costs gems.
  Each step adds damage and a little fire rate (capped at about +35% at step 5, so rarity still matters most).
- **Your AWIs come first:** a "Your AWIs" group at the top shows each cat defender AWI as its own card (cat, attack,
  rarity stripe, damage / fire rate / range). An AWI uses its cat's upgrade row, so upgrading C9 makes every C9 stronger,
  NFT or not.
- Guest cats unlock as levels are cleared (the kit shows locked cats as dark silhouettes with "Level 13"). **Owning an AWI
  of a cat unlocks that cat right away.**
- Two more rows under the cats: **Wall** (more health) and **Income** (more starting coins and coins per second).
- Deck: the tray still holds 5 cards. You pick them on this screen, with AWIs suggested first.

**Add-ons, the "Extra" screen** (`AddonScreen`, `AddonIcon1–8`, `AddonBoxGrey`, `AddonBoxNumber`, `AddOnSlotBtn`, `YellowBorderAddon`, `LockedBoxHelp`)
- The kit's 8 add-ons:
  - rocket strike (one lane)
  - coins ×2 for 30 s
  - bomb (whole street)
  - time bomb (one lane, after 3 s)
  - **Cat Guardian** (a melee cat that blocks a lane for a while)
  - TNT crate (lane trap)
  - **Boxer Cat** (a melee cat for a while)
  - spike trap (slows and hurts)

  Cat Guardian and Boxer Cat use the kit's `Cat Guardian` and `CatBoxing` animations.
- **Loadout: 4 slots**, as in the kit. 2 are open and 2 are unlocked with gems (300 and 400). Equipped add-ons appear
  bottom right in a level with how many are left.
- Bought add-ons: hold up to 5 of each, 25 gems each, used up when fired.
- **Add-on AWIs:** an NFT can also become an add-on AWI (for example an Epic TNT Crate). It shows in the list with its
  rarity stripe instead of a price. It never runs out: it gives free uses every level (Common 1, Rare 1, Epic 2,
  Legendary 3) and is stronger by rarity (×1 / 1.2 / 1.4 / 1.7).

**In a level** (from the kit's in-game mock-up)
- **Repair Wall** button (`WallIcon`): spend coins to restore some wall health; the price rises with each use.
- Add-on buttons bottom right with counts; tap one, then a lane where needed.
- Pause screen with the kit's music / sound / vibration toggles (`BtnMusic`, `BtnSound`, `BtnVibra`), Restart, Resume.
- "You Win" with the gem bonus and Continue; "You Lose" with Restart and Home (back to the map).

**AWIs in this milestone**
- `src/awi.ts`: one AWI model for both kinds, **cat defender** and **add-on**, from TheoSwap-shaped item data
  (`itemId`, `Rarity`, `attack`, optional stat overrides), so milestone 3 only has to plug in the live fetch.
- Bundled demo profiles to try it without TheoSwap: **Guest** (no AWIs), **Collector** (a few Rare/Epic cats and an
  add-on), **Whale** (Legendary cats and add-ons). Picked on the menu or with `?profile=`; `?nft` keeps working.
- AWIs are always unlocked, appear first on the Cats and Add-ons screens, and are marked with an "AWI" tag and rarity stripe.

**Code and checks**
- New scenes: `MapScene`, `CatsScene` (upgrades + deck), `AddonsScene`, sharing a `MenuFrame` (side tabs, gem counter).
- `src/game/progress.ts`: stars, gems, cat and wall/income steps, add-on stock, unlocked slots, daily streak; saved in
  localStorage (one save per profile).
- `src/game/addons.ts`: add-on effects inside the simulation, so `npm run sim` and `?bot` can use them.
- The sim learns levels, upgrade steps, add-ons and AWI add-ons. Targets:
  - guests clear levels 1–9 with no upgrades and need some upgrades for 10–15
  - demo profiles with AWIs need fewer upgrades
  - Full Alley still shows "NFTs make the difference"
- The new UI art goes into the manifest with placeholders of the same names and sizes, as before.

### 3. TheoSwap
- **Ask first:** create the hidden game "Defend the Alley" and its config with the theoswap MCP (dry run → approval).
- Config tree "Defend the Alley AWIs" with two branches:
  - **Cat defenders**: leaves `cat_c1` … `cat_c15`, each with attack and rarity weights, so an NFT's seed picks e.g.
    `{ itemId: 'cat_c9', attack: 'blast', Rarity: 'Epic' }`. Stats come from `makeDefender`; optional `damage` /
    `fireRate` / `range` overrides in itemData win, so the config can tune single AWIs.
  - **Add-ons**: leaves `addon_rocket` … `addon_spikes` (the 8 add-ons) with rarity weights. This branch is rarer,
    e.g. 1 in 5 NFTs.
- Swap the bundled demo profiles from milestone 2 for real test codes; `src/awi.ts` already reads TheoSwap-shaped data.
- Port from Arena: Connect scene (8-letter code + `?userCode=` deep link), Reveal scene (one AWI card per NFT, both
  kinds), `src/profile.ts`.
- Collection bonus shown on the cards on the Cats screen.
- Remember the Arena lesson: test codes only return items once the config is **published**, which is a live change
  that needs the user's explicit OK.

### 4. Polish and deploy
- Fill wide phones (19.5:9) instead of letterboxing (Phaser `Scale.EXPAND`, extend the street art to the sides).
- Measure FPS and memory on a real Android phone and an iPhone; trim texture sizes if needed.
- Hit/death juice, coin fly-to-HUD, tutorial hint on the first run, music per area.
- Balance with real players; Cat Guardian / CatBoxing AWIs.
- **Ask first:** GitHub repo (zerobytes-nz/defend-the-alley), Jira epic (THEOS), push; then deploy to
  `games.theoswap.io/defend-the-alley` with the nginx key proxy (same as Arena).
