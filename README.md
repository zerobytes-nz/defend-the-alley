# Defend the Alley

A landscape lane-defense game for the phone browser (Phaser 3 + TypeScript + Vite), and TheoSwap showcase game #3.
Cats hold a street against zombie waves: 15 levels across 5 areas on the kit's road map, then Full Alley (all 5 in a row).
Gems from cleared levels buy cat upgrades and add-ons. Players' NFTs become
**AWIs (Altered World Items)**: **cat defenders** with a cat (one of 15), an attack (Blast, Rapid or Venom), a rarity,
and damage / fire rate / range, or **add-ons** (power-ups with free uses each level). Guests start with three free cats
and unlock more as they clear levels. See [PLAN.md](PLAN.md) for the design and milestones.

The same NFTs are hero skins in [Altered Run](https://github.com/zerobytes-nz/altered-run) (game #1) and unit cards in
[Altered Arena](https://github.com/zerobytes-nz/altered-arena) (game #2).

```bash
npm install      # also installs the pre-commit hook
npm run dev      # http://localhost:5182
npm run build    # static site in dist/
npm run sim      # balance check: win % per level for each demo player, no browser
npm run sim -- --campaign   # guests playing through all 15 levels, upgrading as they go
npm run sim -- --modes      # Daily Challenge and Endless
```

URL switches: `?profile=guest|collector|whale` demo player (also picked on the title screen) · `?nft` = collector · `?bot` the bot plays (hands-free demo) · `?seed=N` same waves · `?debug` FPS meter.

Controls: taps and drags. Tap a cat card, then a square by the wall. Tap a placed cat for its stats, **Upgrade** and
**Sell**. Drag a cat to another free square to move it, or onto the same cat to merge them (from level 6). Tap an
add-on, then a lane (Big Bomb and Coins ×2 fire at once). The wall button repairs. ⚙ pauses, ×1/×2 speeds up.
The map has the 15 levels, **Hard mode** (after level 15), the **Daily Challenge** (after level 6), **Endless** and
Full Alley; the **Almanac** tab lists cats, add-ons, zombies met and achievements.
Keyboard: Space = Play, P / Esc = pause, M = mute.

## Art: read [ASSETS.md](ASSETS.md)

A fresh clone runs on **original placeholder art** (MIT, `public/assets/placeholder/`). The real art is the CraftPix
**Free Cartoon Cat Defense Game Asset Kit**, which may **not** be redistributed, so **no kit images are in this repo**.
To play with the real art:

1. **Download** the kit (free, needs a CraftPix account):
   **https://craftpix.net/freebies/free-cartoon-cat-defense-game-asset-kit/**
2. **Unzip it outside this repo**, anywhere you like. You get a folder named
   `craftpix-net-397030-free-cartoon-cat-defense-game-asset-kit` with `Png/` inside. Don't move or rename files in it.
3. **Import** it (this only reads the kit; it writes packed sheets into `public/assets/licensed/`, which git ignores):
   ```bash
   npm run assets:import -- "/path/to/craftpix-net-397030-free-cartoon-cat-defense-game-asset-kit"
   ```
4. **Check** with `npm run assets:status` (● = kit art in place), then `npm run dev`.

Never copy kit images anywhere else in the repo: `npm run check-assets` (pre-commit hook) blocks commits that contain
them. Full details per asset: [ASSETS.md](ASSETS.md).

| Command | What it does |
|---|---|
| `npm run assets:import -- <kit>` | Pack the kit's PNG frames into `public/assets/licensed/` (gitignored). Only reads the kit. |
| `npm run assets:status` | Which assets are licensed ● / placeholder ○ / missing ✖ |
| `npm run assets:pack -- <key> <files…>` | Make one sheet from any frames (art from elsewhere) |
| `npm run check-assets` | Fails if licensed art, unlisted media or secrets are in git (pre-commit hook and CI) |
| `npm run assets:docs` | Regenerate ASSETS.md from `assets.manifest.json` |
| `npm run assets:placeholders` | Regenerate the placeholder art from the manifest |
| `npm run pwa:icons` | Redraw the home-screen icons in `public/icons/` (from committable art only) |

## Install on a phone

`npm run build` writes a service worker (offline play) and `manifest.webmanifest` (landscape, full screen). On Android,
**Install app** on the menu uses Chrome's install (other Android browsers trigger a Play Protect warning, so the game offers
"Open in Chrome" instead). On iPhone it shows the Share → Add to Home Screen steps.

## TheoSwap and secrets

TheoSwap game **Defend the Alley** (id 9, released) has the free config **Defend the Alley AWIs** (id 18, published,
the default) and the private **Theo Swap** config (id 19). On the title screen, **Connect TheoSwap** takes a player
code (or open the game with `?userCode=CODE`). For TheoSwap to open the game already connected, the game's website on
the Developer page must be `https://games.theoswap.io/defend-the-alley/?userCode=$USER_CODE`: TheoSwap fills in the
player's code (a link where `$USER_CODE` wasn't filled in just opens the title screen);
each NFT becomes an AWI (Altered World Item) and gets a reveal card: a cat defender (with a perk half the time), an
add-on, or a boost. The connected player has their own save. Demo players keep bundled sample AWIs.
Test codes (`AAAAAAAA`…) only return items once the config is published.

**No API key is ever in the browser or in git.** The game only calls its own server: `./api/user-items?userCode=…`.
- `npm run dev` / `npm run preview`: `vite.config.ts` forwards that to TheoSwap's `/api/public/user-items` and adds
  `THEOSWAP_API_KEY` from `.env` (copy `.env.example`; use the game's **test** key). The name has no `VITE_` prefix, so Vite never bundles it.
- Production: the nginx proxy below holds the keys.
- `check-assets` rejects key-like `VITE_*` names, any key use in `src/`, and hard-coded key values. `npm run deploy` refuses to upload a build that contains the key.

## Deploy (games.theoswap.io/defend-the-alley/)

Put the target in `.env` (gitignored): `DEPLOY_TARGET=user@host:/var/www/games.theoswap.io/defend-the-alley/`, then

```bash
npm run deploy:check   # build, then list what rsync would change (uploads nothing)
npm run deploy         # build, then rsync dist/ to DEPLOY_TARGET (--delete removes files the build no longer has)
```

The folder must exist on the server and be writable by that SSH user. The build ships whichever art it finds
(licensed → placeholder), so deploy from a checkout where `npm run assets:import` has been run. `npm run deploy`
refuses to upload a build that contains the API key.

### nginx: the API proxy and cache headers

The game asks its own server for `/defend-the-alley/api/user-items?userCode=…`; nginx adds the key and forwards it to
TheoSwap, so keys only live in the server's nginx config. **Defend the Alley has its own keys** (TheoSwap game 9,
Developer page), not Altered Run's. The test codes AAAAAAAA / BBBBBBBB / CCCCCCCC use the game's **test** key (its test
NFTs); every other code is a real player and uses the **live** key, so both work side by side.

```nginx
# Top of the site file, OUTSIDE server { } (next to Altered Run's map):
map $arg_userCode $defend_alley_key {
    default    "DEFEND_ALLEY_LIVE_KEY";
    AAAAAAAA   "DEFEND_ALLEY_TEST_KEY";
    BBBBBBBB   "DEFEND_ALLEY_TEST_KEY";
    CCCCCCCC   "DEFEND_ALLEY_TEST_KEY";
}

# Inside the listen 443 server { }, e.g. after Altered Run's location:
location = /defend-the-alley/api/user-items {
    limit_except GET { deny all; }
    if ($arg_userCode !~ "^[A-Za-z0-9]{4,16}$") { return 400; }
    set $args "apiKey=$defend_alley_key&userCode=$arg_userCode";
    proxy_pass https://www.theoswap.io/api/public/user-items;
    proxy_ssl_server_name on;
    proxy_set_header Host www.theoswap.io;
    proxy_set_header X-Forwarded-For $remote_addr;
    add_header Cache-Control "no-store" always;
}
# So updates reach players straight away (only hashed JS is safe to cache forever):
location = /defend-the-alley/sw.js                { add_header Cache-Control "no-cache"; }
location = /defend-the-alley/index.html           { add_header Cache-Control "no-cache"; }
location = /defend-the-alley/manifest.webmanifest { add_header Cache-Control "no-cache"; }
location ~ "^/defend-the-alley/assets/.+-[\w-]{8}\.js$" { add_header Cache-Control "public, max-age=31536000, immutable"; }
```

Then `sudo nginx -t && sudo systemctl reload nginx` and check
`https://games.theoswap.io/defend-the-alley/api/user-items?userCode=AAAAAAAA` answers with 12 items.

## Licence

Code and placeholder art: [MIT](LICENSE). Font: Passion One, [SIL OFL 1.1](public/fonts/OFL.txt). The CraftPix kit isn't included.
