# Licensed art goes here (not in git)

Everything in this folder except this README is **gitignored**. It holds the art made from **your own download** of the
CraftPix *Free Cartoon Cat Defense Game Asset Kit*, which may **not** be redistributed. See [ASSETS.md](../../../ASSETS.md).

```bash
npm run assets:import -- "/path/to/craftpix-net-397030-free-cartoon-cat-defense-game-asset-kit"
```

- That command only **reads** the kit folder and writes packed sheets here (the kit itself is never changed).
- Files here override `public/assets/placeholder/` one by one. Anything missing falls back to the placeholder.
- `npm run assets:status` shows which file each asset uses.
- **Never commit these files.** `npm run check-assets` (pre-commit hook and CI) blocks it.
