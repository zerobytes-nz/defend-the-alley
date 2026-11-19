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
wall. When the wall breaks, the fight is lost. Pick one of **15 levels** on the map (3 per area), or play **Full Alley**:
all 5 areas in one run.

| | |
|---|---|
| Screen | 1440×720 landscape (2:1). The kit's Area art fills it and already has the 2×5 cat grid, the crate wall and the wall's health bar on the left, so the game uses them as drawn (`src/game/layout.ts` measures them). HUD on the top sidewalk (coins, level and area, wave, ×1/×2, pause); Repair and add-on buttons bottom left, card tray bottom right. |
| Levels | 4 waves at level 1, rising to 10 at level 15. Every 3rd level ends with its area's boss; Boss 6 and 7 join levels 14–15. Full Alley: 15 waves, 7 bosses, about 3 minutes. |
| Areas | Main Street, Sand Lot, Overpass, Rush Hour, Park Lane (the kit's Area1–5). Each brings tougher zombie types and its own boss (kit Boss 1–5). |
| Taps | Tap a cat card, then tap an empty spot to place it (the card stays picked, so placing several is quick). Tap a placed cat for its stats and **Upgrade** (levels 1–4). |
| Coins | Reset each fight. Start with 150; +3 a second; zombies drop 8–12, bosses 60. Placing costs 30, +10 for each more copy of the same card. Upgrades cost 35 / 60 / 95. |
| Wall | 100 HP (+15 per Wall upgrade). Zombies hit it for 1–2, bosses for 5. **Repair** restores 25% for 40 coins, +25 each time. |
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
- **Collection bonus** (milestone 4): 2+ cards from one NFT collection: +10% damage for those cats; 3+: also +10% fire rate.
  TheoSwap test NFTs share the zero-address contract, which counts as no collection (same rule as Arena).

### Balance (`npm run sim`)

A bot plays whole fights headless (`src/game/bot.ts`, the same code as `?bot` in the browser). It places and upgrades
cats, repairs below 40% wall and fires add-ons at bosses or crowded lanes.

Win % over 60 seeds, **no upgrades or add-ons bought**:

| Player | L1–8 | L9 | L10 | L11 | L12 | L13–15 | Full Alley |
|---|---|---|---|---|---|---|---|
| Guest (free cats unlocked by then) | 100 | 92 | 87 | 47 | 2 | 0 | 3 |
| Collector (4 cat AWIs, 1 add-on AWI) | 100 | 100 | 100 | 100 | 100 | 97–100 | 100 |
| Whale (6 Legendary/Epic cat AWIs, 3 add-on AWIs) | 100 | 100 | 100 | 100 | 100 | 100 | 100 |

`npm run sim -- --campaign` plays 20 guests through the levels in order, spending gems on upgrades between fights and
replaying the last cleared level for gems after a loss: levels 1–13 take 1 fight each, level 14 about 1.5, level 15
about 9. None got stuck. The tuning knobs are `src/game/levels.ts → tune()` (`--tune g0,step,curve,share`).

That is the pitch: guests can clear everything by upgrading; NFTs (AWIs) make the hard levels easy. A human may play
worse than the bot, so check on a phone with real players in milestone 5.

## Code map

| | |
|---|---|
| `src/game/` | Pure TypeScript, no Phaser: `layout.ts` (lanes, spots, wall), `cats.ts` (AWI stats, upgrade steps), `waves.ts` (areas, zombies, bosses, seeded waves), `levels.ts` (15 levels, Full Alley, stars, map markers), `addons.ts` (the 8 add-ons), `awi.ts` (TheoSwap-shaped items → cat and add-on AWIs), `demo.ts` (demo profiles), `progress.ts` (the save: gems, stars, upgrades, stock, loadout, daily gift), `sim.ts` (the 60 Hz simulation: commands in, events out), `bot.ts`. `npm run sim` runs it in Node. |
| `src/save.ts` | The current demo player: their AWIs and their save (localStorage, one per profile). |
| `src/scenes/` | `BootScene` (loads the deck's cats and area 1), `MenuScene` (pick a demo player, install), `MapScene`, `CatsScene`, `AddonsScene` (sharing `menuFrame.ts`: side tabs, gems, daily gift), `DefenseScene` (draws sim events, taps → commands, HUD, tray, add-ons, repair, pause, end screens). |
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

### 2. Level select, upgrades, add-ons, and AWIs in all of them ✅
Gives players a reason to come back between levels, built the way the kit's own screens are laid out
(see [docs/KIT-REVIEW.md](docs/KIT-REVIEW.md)). **AWIs (Altered World Items) are part of every screen**, using bundled
sample data in this milestone; live TheoSwap sign-in follows in milestone 4.

**Menu frame** (`LevelMap_Bg_Screen`, `BtnTab_*`, `Icon_home` / `Icon_Cat` / `Icon_Addon`, `GemsBarBg`, `DaillyIcon`)
- The kit's dark side menu with tabs: **Map**, **Cats**, **Add-ons**. No Shop tab (no real-money sales).
- Gem counter at the top. Daily gift box on the side menu with a day streak ("Day 3").

**Map: level select** (`LevelMap.png`, `GreenLevel` / `OrangeLvl` / `LockedLevel`, `TitleRibbon`)
- 15 levels, 3 per area (Main Street 1–3 … Park Lane 13–15), on the kit's winding road map. It scrolls sideways with a
  drag. The map is 7782×785, so it is imported at half size (3891×393, under the 4096 px limit).
- A level is a fight on that area's street: 4 waves early, rising to 10 by level 15 ("Wave 3 / 10" in the HUD). The 3rd
  level of each area ends with that area's boss. Boss 6 and 7 (unused so far) join the last levels and Full Alley.
- Markers, as the kit uses them: orange = cleared (with 1–3 stars), green = next, grey with a lock = locked. Clearing a
  level unlocks the next. Tap a marker to pick it, tap again (or PLAY) to start.
- Stars from the wall's health left: any = ★, ≥ 50% = ★★, 100% = ★★★ (a repaired wall counts).
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
  bottom left in a level with how many are left.
- Bought add-ons: hold up to 5 of each, 25 gems each, used up when fired.
- **Add-on AWIs:** an NFT can also become an add-on AWI (for example an Epic TNT Crate). It shows in the list with its
  rarity stripe instead of a price. It never runs out: it gives free uses every level (Common 1, Rare 1, Epic 2,
  Legendary 3) and is stronger by rarity (×1 / 1.2 / 1.4 / 1.7).

**In a level** (from the kit's in-game mock-up)
- **Repair Wall** button (`WallIcon`): spend coins to restore some wall health; the price rises with each use.
- Add-on buttons bottom left with counts; tap one, then a lane where needed.
- Pause screen with the kit's music / sound / vibration toggles (`BtnMusic`, `BtnSound`, `BtnVibra`), Restart, Resume.
- "You Win" with the gem bonus and Continue; "You Lose" with Restart and Home (back to the map).

**AWIs in this milestone**
- `src/game/awi.ts`: one AWI model for both kinds, **cat defender** and **add-on**, from TheoSwap-shaped item data
  (`itemId`, `Rarity`, `attack`, optional stat overrides), so milestone 4 only has to plug in the live fetch.
- Bundled demo profiles to try it without TheoSwap: **Guest** (no AWIs), **Collector** (4 cat AWIs, Rare to Legendary,
  and a Rare TNT Crate), **Whale** (6 Legendary/Epic cat AWIs, and Cat Guardian, Big Bomb and Rocket Strike AWIs). Picked on the menu or with `?profile=`; `?nft` keeps working.
- AWIs are always unlocked, appear first on the Cats and Add-ons screens, and are marked with an "AWI" tag and rarity stripe.

**Code and checks**
- New scenes: `MapScene`, `CatsScene` (upgrades + deck), `AddonsScene`, sharing `menuFrame.ts` (side tabs, gem counter, daily gift).
- `src/game/progress.ts`: stars, gems, cat and wall/income steps, add-on stock, unlocked slots, daily streak; saved in
  localStorage (one save per profile).
- `src/game/addons.ts`: add-on effects inside the simulation, so `npm run sim` and `?bot` can use them.
- The sim learns levels, upgrade steps, add-ons and AWI add-ons. Targets:
  - guests clear levels 1–9 with no upgrades and need some upgrades for 10–15
  - demo profiles with AWIs need fewer upgrades
  - Full Alley still shows "NFTs make the difference"
- The new UI art goes into the manifest with placeholders of the same names and sizes, as before.

### 3. Gameplay depth: a full game
It stays a **free web game**: nothing to buy, no ads. This milestone adds what a full game needs on top of the demo:
a tutorial, steady unlocks, more decisions in each fight, and reasons to keep playing after level 15. It comes before TheoSwap because cat roles and AWI perks change what the config has to hold. It reuses the
kit's art; no new art is needed. Everything new goes into the simulation first, so `npm run sim` and the bot can
balance it.

**Tutorial: level 1**
- A short guided level on Main Street: one cat card (Ginger), 3 of the 5 lanes open, 3 small waves, no boss.
- A pointing hand and short tips walk through it one step at a time: pick the card, tap a square, watch it shoot, earn
  coins, place a second cat, upgrade one. The next step only shows once the player has done the last one.
- It can't be lost: the wall can't drop below 1 in the tutorial. It can be replayed from the map.
- Repair and add-ons get their own short tip the first time they unlock (see below), not in level 1.

**Unlocks: something new after every level**
- The player starts with **one cat**. Each level cleared unlocks something new, revealed on the "You Win" screen with a
  card ("New cat: Smokey · Venom slows zombies"). Then the next level is built to use it.
- New zombie types get a card too, the first time they show up ("New zombie: Traffic Cone, takes less damage from the
  front"). An **Almanac** tab lists every cat, add-on and zombie seen so far.
- The unlock order (a first draft, to tune with `npm run sim -- --campaign`):

  | Clear | Unlocks |
  |---|---|
  | 1 (tutorial) | Smokey (C6, Venom) |
  | 2 | Repair Wall |
  | 3 | Snowy (C11, Rapid), and the **Cats** screen (upgrades) |
  | 4 | Rocket Strike, and the **Add-ons** screen |
  | 5 | C2 |
  | 6 | Merging cats (see below) |
  | 7 | C7, Big Bomb |
  | 8 | C12, TNT Crate |
  | 9 | C3, Cat Guardian |
  | 10 | C8, Time Bomb |
  | 11 | C13, Spike Trap |
  | 12 | C4, Coins ×2 |
  | 13 | C9, Boxer Cat |
  | 14 | C14 |
  | 15 | C5, C10, C15, Full Alley, Hard mode |

- Locked add-ons and loadout slots can't be bought until they unlock. Gems still buy upgrades and add-on stock.
- **AWIs (Altered World Items) skip the queue:** owning an AWI of a cat or add-on unlocks it at once, as in milestone 2.

**More decisions in each fight**
- **A role for each cat family**, on top of its attack (Blast, Rapid, Venom):
  - **Bazooka tabbies** (C1–5): knock zombies back a little.
  - **Blaster greys** (C6–10): every 3rd shot also hits the lane above or below.
  - **Rifle whites** (C11–15): shots go through the first zombie.
- **Merging:** drag a cat onto a matching cat (same card) to make one cat a level higher. The upgrade button stays, so
  merging is a cheaper but slower path that frees a square.
- **Move and sell:** drag a placed cat to another free square (a short cooldown), or sell it for half its cost.
- **Synergies:** zombies slowed by Venom take +20% damage from Blast.

**Zombies that need different answers** (the kit's 8 zombie types each get one behaviour)
- Shield (front hits do little until something reaches it or it is hit from another lane), jumper (hops over the first
  trap or unit), healer (heals zombies near it), splitter (two small zombies when it dies), lane switcher, armoured
  (only Blast hurts it properly), runner (fast, weak), and the plain zombie.
- Bosses get one ability each, such as summoning zombies, a charge across the street, or an enrage at half health.

**Levels that play differently**
- Some levels get a rule: fog (zombies show only near the wall), double speed, no Repair, only 3 lanes, fewer coins,
  or a fixed set of cats.
- Each level has 3 star goals instead of stars from wall health alone. For example: win, keep 50% of the wall,
  and one level goal ("use no add-ons", "4 cats or fewer").

**After level 15**
- **Hard mode:** the 15 levels again, with level rules and every zombie behaviour. Twice the content without new art.
- **Daily challenge:** the same street, rules and seed for everyone that day. The simulation is already seeded and
  repeatable. A best score is kept per day.
- **Endless:** Full Alley turns into a survival run with a personal best (waves survived).
- **Achievements** for things like 3 stars everywhere, or beating a boss without Repair.

**Deeper progression**
- A cat's 5th upgrade step unlocks a perk that changes how it plays, for example C1's knockback doubling, or C11
  piercing two zombies.
- Add-ons get upgrade steps too (gems), like the cats.
- AWIs can roll a perk from the TheoSwap config (milestone 4 data), so NFTs feel special without being required.

**Checks**
- `npm run sim` learns the new roles, behaviours and rules. `--campaign` follows the unlock order, so each level stays
  winnable with only what has been unlocked by then.
- Play-test on real phones: the tutorial without help, and how many tries the late levels take.

### 4. TheoSwap
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

### 5. Polish and deploy
- Fill wide phones (19.5:9) instead of letterboxing (Phaser `Scale.EXPAND`, extend the street art to the sides).
- Measure FPS and memory on a real Android phone and an iPhone; trim texture sizes if needed.
- Hit/death juice, coin fly-to-HUD, music per area.
- Balance with real players.
- **Ask first:** GitHub repo (zerobytes-nz/defend-the-alley), Jira epic (THEOS), push; then deploy to
  `games.theoswap.io/defend-the-alley` with the nginx key proxy (same as Arena).
