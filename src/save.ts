// The current player in the browser: which demo player is picked, their AWIs, and their save (one per player).
// Milestone 3 adds TheoSwap sign-in as one more way to get AWIs; everything else stays the same.
import { SAMPLE_NFTS } from './config.ts';
import { awisFromItems, type AWI } from './game/awi.ts';
import { PROFILES, type ProfileId } from './game/demo.ts';
import { addonAwis, deckOf, equipped, fightBonus, fixSave, type Save } from './game/progress.ts';
import { levelDef, type LevelDef } from './game/levels.ts';

const PROFILE_KEY = 'defend-the-alley.profile.v1';
const SAVE_KEY = 'defend-the-alley.save.v1.'; // + profile id

const ls = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* private mode: progress lasts this visit */ } },
};

function startProfile(): ProfileId {
  const q = new URLSearchParams(location.search).get('profile');
  if (q && q in PROFILES) return q as ProfileId;
  if (SAMPLE_NFTS) return 'collector';
  const kept = ls.get(PROFILE_KEY);
  return kept && kept in PROFILES ? (kept as ProfileId) : 'guest';
}

class Player {
  id: ProfileId = startProfile();
  awis: AWI[] = [];
  save!: Save;
  constructor() { this.use(this.id); }

  /** Switch demo player: their AWIs and their own save. */
  use(id: ProfileId): void {
    this.id = id;
    ls.set(PROFILE_KEY, id);
    this.awis = awisFromItems(PROFILES[id].items);
    let raw: unknown = null;
    try { raw = JSON.parse(ls.get(SAVE_KEY + id) ?? 'null'); } catch { raw = null; }
    this.save = fixSave(raw);
    // A new save starts with the player's add-on AWIs equipped (as many as the open slots hold).
    if (raw === null) this.save.loadout = addonAwis(this.awis).slice(0, this.save.slots).map((a) => a.uid);
  }

  /** Another demo player's save, without switching (for the title screen). */
  peek(id: ProfileId): Save {
    try { return fixSave(JSON.parse(ls.get(SAVE_KEY + id) ?? 'null')); } catch { return fixSave(null); }
  }

  persist(): void { ls.set(SAVE_KEY + this.id, JSON.stringify(this.save)); }
  get name(): string { return PROFILES[this.id].name; }
  deck() { return deckOf(this.save, this.awis); }

  /** Everything a fight needs. */
  fight(level: number): { level: LevelDef; deck: ReturnType<typeof deckOf>; addons: ReturnType<typeof equipped>; bonus: ReturnType<typeof fightBonus> } {
    return { level: levelDef(level), deck: this.deck(), addons: equipped(this.save, this.awis), bonus: fightBonus(this.save) };
  }
}

export const player = new Player();
