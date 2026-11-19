// The current player in the browser: a demo player or the TheoSwap-connected player ('me'), their AWIs, and their
// save (one per player).
import { SAMPLE_NFTS } from './config.ts';
import { awisFromItems, type AWI } from './game/awi.ts';
import { PROFILES, type ProfileId } from './game/demo.ts';
import { addonAwis, deckOf, fightSetup, fixSave, type Save } from './game/progress.ts';
import { loadConnection } from './profile.ts';

const PROFILE_KEY = 'defend-the-alley.profile.v1';
const SAVE_KEY = 'defend-the-alley.save.v1.'; // + profile id

const ls = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* private mode: progress lasts this visit */ } },
};

/** A demo player, or 'me': the player connected with their TheoSwap code. */
export type PlayerId = ProfileId | 'me';
const known = (id: string | null): id is PlayerId => !!id && (id in PROFILES || (id === 'me' && !!loadConnection()));

function startProfile(): PlayerId {
  const q = new URLSearchParams(location.search).get('profile');
  if (known(q)) return q;
  if (SAMPLE_NFTS) return 'collector';
  const kept = ls.get(PROFILE_KEY);
  return known(kept) ? kept : 'guest';
}

class Player {
  id: PlayerId = startProfile();
  awis: AWI[] = [];
  save!: Save;
  constructor() { this.use(this.id); }

  /** Switch demo player: their AWIs and their own save. */
  use(id: PlayerId): void {
    if (!known(id)) id = 'guest';
    this.id = id;
    ls.set(PROFILE_KEY, id);
    this.awis = awisFromItems(id === 'me' ? loadConnection()?.results ?? [] : PROFILES[id].items);
    let raw: unknown = null;
    try { raw = JSON.parse(ls.get(SAVE_KEY + id) ?? 'null'); } catch { raw = null; }
    this.save = fixSave(raw);
    // A new save starts with the player's add-on AWIs equipped (as many as the open slots hold).
    if (raw === null) this.save.loadout = addonAwis(this.awis).slice(0, this.save.slots).map((a) => a.uid);
  }

  /** Another demo player's save, without switching (for the title screen). */
  peek(id: PlayerId): Save {
    try { return fixSave(JSON.parse(ls.get(SAVE_KEY + id) ?? 'null')); } catch { return fixSave(null); }
  }

  persist(): void { ls.set(SAVE_KEY + this.id, JSON.stringify(this.save)); }
  get name(): string { return this.id === 'me' ? `Code ${loadConnection()?.code ?? ''}` : PROFILES[this.id].name; }
  deck() { return deckOf(this.save, this.awis); }

  /** Everything a fight needs. */
  fight(level: number) { return fightSetup(this.save, this.awis, level); }
}

export const player = new Player();
