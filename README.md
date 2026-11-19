# Altered Alley

A portrait lane-defense game for the phone browser (Phaser 3 + TypeScript + Vite), and TheoSwap showcase game #3.
Cats hold a street against zombie waves across 5 areas, with a boss at the end of each. Players' NFTs become
**AWIs (Altered World Items)**: **cat defenders** with a cat (one of 15), an attack (Blast, Rapid or Venom), a rarity,
and damage / fire rate / range. Guests play with three free cats. See [PLAN.md](PLAN.md) for the design and milestones.

The same NFTs are hero skins in [Altered Run](https://github.com/zerobytes-nz/altered-run) (game #1) and unit cards in
[Altered Arena](https://github.com/zerobytes-nz/altered-arena) (game #2).

```bash
npm install      # also installs the pre-commit hook
npm run dev      # http://localhost:5182
npm run build    # static site in dist/
npm run sim      # balance check: a bot plays 100 runs per deck, no browser
```

URL switches: `?nft` sample NFT deck · `?bot` the bot plays (hands-free demo) · `?seed=N` same waves · `?debug` FPS meter.

Controls: taps only. Tap a cat card, then a spot by the wall. Tap a placed cat to upgrade it. ⚙ pauses, ×1/×2 speeds up.
Keyboard: Space = Play, P / Esc = pause, M = mute.

## Art: read [ASSETS.md](ASSETS.md)

A fresh clone runs on **original placeholder art** (MIT, `public/assets/placeholder/`). The real art is the CraftPix
**Free Cartoon Cat Defense Game Asset Kit**, which may **not** be redistributed, so it is never in this repo.
Download it yourself, then:

```bash
npm run assets:import -- "/path/to/craftpix-net-397030-free-cartoon-cat-defense-game-asset-kit"
```

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

`npm run build` writes a service worker (offline play) and `manifest.webmanifest` (portrait, full screen). On Android,
**Install app** on the menu uses Chrome's install (other Android browsers trigger a Play Protect warning, so the game offers
"Open in Chrome" instead). On iPhone it shows the Share → Add to Home Screen steps.

## TheoSwap and secrets

TheoSwap sign-in arrives in milestone 2 (same flow as Altered Arena: player code or `?userCode=` link, AWI reveal cards,
demo players). `src/theoswap.ts` already holds the client.

**No API key is ever in the browser or in git.** The game only calls its own server: `./api/user-items?userCode=…`.
- `npm run dev` / `npm run preview`: `vite.config.ts` forwards that to TheoSwap's `/api/public/user-items` and adds
  `THEOSWAP_API_KEY` from `.env` (copy `.env.example`; use the game's **test** key). The name has no `VITE_` prefix, so Vite never bundles it.
- Production: an nginx proxy holds the live key (set up in milestone 3, like Altered Arena).
- `check-assets` rejects key-like `VITE_*` names, any key use in `src/`, and hard-coded key values. `npm run deploy` refuses to upload a build that contains the key.

## Licence

Code and placeholder art: [MIT](LICENSE). Font: Passion One, [SIL OFL 1.1](public/fonts/OFL.txt). The CraftPix kit isn't included.
