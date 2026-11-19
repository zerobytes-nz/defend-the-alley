# CraftPix cat defense kit: full review

A complete inventory of the **Free Cartoon Cat Defense Game Asset Kit** (craftpix-net-397030), what Defend the Alley
uses, and what the kit's own mock-ups tell us for milestone 2. Reviewed 2026-11-19. This file only describes the kit;
the art itself is never committed (see [ASSETS.md](../ASSETS.md)).

## What's in the box (209 MB, ~3,100 PNGs)

| Folder | What | Used by the game? |
|---|---|---|
| `Png/` | Every animation as numbered frames + all UI pieces. **The game's source.** | Yes (via `npm run assets:import`) |
| `Spine/`, `Json Atlas/` | Spine 4.3 skeletons + part atlases for the same characters | No (would need the Spine runtime) |
| `Ai/`, `Eps/` | Vector sources (Illustrator / EPS) for cats, enemies, UI, areas, bullets | No |
| `Preview/` | 8 UI mock-ups + 5 area previews (the kit's sample game) | Reference only |
| `Font Link.txt` | Passion One on Google Fonts | Yes (committed, OFL) |
| `license.txt` | Link to craftpix.net/file-licenses | — |

## Characters (`Png/Characters`, `Png/Cat Guardian`, `Png/CatBoxing`)

| | Frames | Size | Look |
|---|---|---|---|
| C1–C5 | Idle 20, Shoot 10 | 150×150 | Orange tabbies with a blue/white cannon; outfits: none, beanie, bandana cap, pink beanie, orange hood |
| C6–C10 | Idle 20, Shoot 10 | 198×150 / 198×179 | Grey cats with an orange blaster; goggles, hats, helmets |
| C11–C15 | Idle 20, Shoot 10 | 177×159 | White cats with a rifle; hoods and helmets |
| Cat Guardian | Idle 20, Attack 25 | 333×260 | Knight-helmet cat with a plunger and shield (melee) |
| CatBoxing | Idle 20, Attack ("Fight") 20 | 333×260 | Tabby with boxing gloves (melee) |

All 15 shooter cats are used (idle + shoot). **Cat Guardian and CatBoxing are not used yet.**

## Enemies (`Png/Enemies`)

| | Walk | Attack | Dead | Idle | Frame size | Used? |
|---|---|---|---|---|---|---|
| Reg 1–8 | 35 | 25 | 60 | 20 | 297–350 × 250–258 | Walk/attack/dead yes; **idle no** |
| Boss 1–3 | 35 | 40 | 50 | 20 | 372×320 / 406×344 | Yes (areas 1–3) |
| Boss 4 | 25 | 40 | 55 | 20 | 406×344 | Yes (area 4) |
| Boss 5 | 30 | 30 | 50 | 20 | 406×344 | Yes (area 5) |
| **Boss 6–7** | 30 | 30 | 50 | 20 | 393×335 | **No**: spiked-helmet shield zombie and a bandit zombie |

Regular walk frames are `Enemy-Walking_*`, boss walk frames are `Enemy-Walk_*` (the importer handles both).

## Effects

- `Png/Bullets`: 3 glowing bullets, 113×86 (yellow, green, red). Used: Rapid / Venom / Blast.
- `Png/ShootFx`: muzzle flash, 10 frames, 249×157. Used.
- `Png/Explosion`: 20 frames, 1305×1289 (packed down a lot). Used for Blast splash and deaths.

## Areas (`Png/Area`)

5 streets, 2143×1062, all with the same layout: a 2×5 cat grid with a trash-can square, a crate wall, the wall's health
bar, and a road from the right. All 5 used (Main Street, Sand Lot, Overpass, Rush Hour, Park Lane).

## UI (`Png/Ui`, 104 files)

| Group | Files | Used now |
|---|---|---|
| HUD | CoinBar, CoinIcon, WaveBar, SettingBtn, WallIcon | Yes |
| Cards / popups | YellowBox, TitleRibbon, WinPopUp, LosePopUp, BtnGreen, BtnOrange | Yes |
| Rank chevrons | Up0–Up3 (white → orange) | Up1–3 yes, Up0 no |
| Landing art | LandingScreen (menu background) | Yes |
| **Logo** | "MERGE CATS DEFENDER" title art | **No, and shouldn't be**: it is the kit's sample-game name, not ours |
| Screens | LevelMap_Bg_Screen, CatUpgradeScreen, AddonScreen, ShopScreen (dark side menu + grey panel) | M2 |
| Level map | LevelMap (7782×785 winding road), GreenLevel, OrangeLvl, LockedLevel | M2 |
| Side menu | Icon_home, Icon_Cat, Icon_Addon, Icon_Shop, BtnTab_Active, BtnTab_on | M2 |
| Upgrades | 0Bar–5Bar (5 pips), AddBtn / AddBtn_Pressed, LockedCatBox, SelectedBorder, ScrollBar*, Uplogo1–15 (one colour badge per cat) | M2 |
| Add-ons | AddonIcon1–8, AddonBoxGrey, AddonBoxNumber, AddonBtnyellow, AddOnSlotBtn, YellowBorderAddon, LockedBoxHelp | M2 |
| Currency | GemsIcon, GemsBarBg, WinBonus, DaillyIcon, BtnGreenAdd | M2 |
| Settings | BtnMusic/Off, BtnSound/Off, BtnVibra/Off, BtnHelp/Off, BgPaused | Could replace our pause screen |
| Shop | ShopIcon1–7 (gem piles, piggy bank, cart), Blue/Orange/Green shop boxes, BtnShopYellow/Disable, OrangeBTNAds* | Not planned (real-money / ads shop) |

Add-on icons: 1 rocket with timer, 2 coins ×2, 3 explosion with timer, 4 time bomb, 5 Cat Guardian, 6 TNT crate,
7 Boxer Cat, 8 spike trap.

## What the kit's mock-ups show (`Preview/Ui`)

The kit was designed for a sample game, **"Merge Cats Defender"**. Its screens differ from our plan in useful ways:

1. **Landing:** title over the landing art, "Tap To Play".
2. **Level Select:** the road map with numbered shield markers. Orange = open, green = current, grey with a lock = locked.
   The left side menu has Home / Cats / Add-ons / Shop tabs and a daily-gift box ("DAY 3" streak).
3. **Upgrades:** a gem counter, then **one row per cat (15 rows)**, each with a 5-pip bar (0Bar–5Bar) and a + button.
   Cats you don't have yet are dark silhouettes with a lock and a "Level 13" / "Level 17" unlock level.
4. **Extra (add-ons):** the left column is the **loadout: 4 slots**, 2 open (showing "2/5", "3/5") and 2 locked that cost
   300 and 400 gems. The right side is a list of add-ons: "Medium damage to enemies", owned 3/5, buy for 25 gems.
5. **Shop:** gem packs for real money ($4.99–$17.99) and "Watch Ads: 20 gems free".
6. **In-game (behind the popups):**
   - A **"Level 3, 56780 coins"** button bottom left: buy a new cat. Cats show rank chevrons and numbered colour badges (1, 13, 21, 41…).
   - A **"Repair Wall"** button with a coin price.
   - Add-ons bottom right, with counts (2/5).
   - "Wave 3 / 10" in the HUD.
   - The trash-can square in the grid for getting rid of a cat.
7. **Paused:** music, sound, vibration and hint toggles, then Restart / Resume.
8. **You Win:** a gem bonus (150) and Continue. **You Lose:** Restart / Home.

## Differences from our milestone 2 plan

| Topic | PLAN.md now | Kit design | Suggestion |
|---|---|---|---|
| Upgrades | 3 ranks per **family** + wall / coins / income | 5 pips per **cat** (15 rows); cats unlock at player levels | Follow the kit: per cat, 5 ranks. It suits AWIs (an NFT cat is upgraded through its cat). Put wall and income on the same screen as extra rows. |
| Unlocking cats | Guests always have 3 cats | Cats unlock by level | Guests unlock more cats as they clear levels; NFT cats are always unlocked. |
| Add-on slots | Up to 2 | 4 slots: 2 open, 2 bought with gems (300 / 400) | Follow the kit. |
| Add-on stock | One-use | Hold up to 5 of each, 25 gems each | Follow the kit. |
| Wall repair | Not planned | In-game button, costs coins | Add it: a nice coin sink inside a level. |
| Merging | Cards + tap to upgrade | Buy a random cat, merge two of the same into a stronger one | Keep ours. Merging would fight the AWI idea, where your NFT is one specific cat. |
| Shop | Not planned | Real-money gem packs and ads | Leave it out. Maybe one "free daily gems" box later. |
| Waves per level | 4–6 | "Wave 3 / 10" | 4–6 early, up to 10 late. |
| Bosses | 5 | 7 available | Use Boss 6–7 in later levels or as Full Alley extras. |

**Decision (2026-11-19):** the suggestions above are adopted in PLAN.md milestone 2, and AWIs are added to every screen
(cat defender AWIs on the Cats screen, a new add-on kind of AWI on the Add-ons screen).

**Built in milestone 2:** Cat Guardian and CatBoxing (the Cat Guardian and Boxer Cat add-ons), Boss 6–7 (levels 14–15
and Full Alley), the level map, side-menu tabs, upgrade bars, add-on screen, pause toggles and win bonus are all in the
manifest now (`npm run assets:import`). Still unused: the enemies' idle animations, `SelectedBorder` and `LockedCatBox`
(the Cats screen draws its own rows), the shop art and `Logo.png`.

## Files to watch out for

- `Logo.png` says "MERGE CATS DEFENDER". Our menu draws its own title, so don't use it.
- `LevelMap.png` is 7782 px wide: over the 4096 px texture limit. The game imports it at half size (3891×393).
- The Explosion frames are 1305×1289 each. They are already packed small (`ds 0.7`).
- The kit's `__MACOSX/` folder and `.DS_Store` files are junk from a Mac zip. The importer only reads the exact `Png/` paths in the manifest, so it never touches them.
