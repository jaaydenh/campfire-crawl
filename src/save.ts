import { STARTER_POOL } from './data/items';
import { SAVE_VERSION, type SaveFile } from './types';

const KEY = (slot: number) => `campfire-crawl.save.${slot}`;
/** Saves written before the game was renamed. Moved to the new key the first time they are read. */
const OLD_KEY = (slot: number) => `relay-of-embers.save.${slot}`;
export const SLOT_COUNT = 3;

export function newSave(): SaveFile {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    created: now,
    updated: now,
    heroes: [],
    pool: [...STARTER_POOL],
    knowledge: {},
    bestiary: [],
    mapsUnlocked: 1,
    runsPlayed: 0,
    run: null,
    settings: { music: 0.35, sfx: 0.6, musicOn: true },
  };
}

/** Throws with a readable message when the data is not one of our saves. */
export function parseSave(text: string): SaveFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid save data.');
  }
  const s = data as Partial<SaveFile>;
  if (!s || typeof s !== 'object' || s.version !== SAVE_VERSION || !Array.isArray(s.heroes) || !Array.isArray(s.pool)) {
    throw new Error('That file is not a save from this game (or is from a different version).');
  }
  const base = newSave();
  const save = { ...base, ...s, settings: { ...base.settings, ...(s.settings ?? {}) } } as SaveFile;
  // The sword that map 1's hidden grove used to unlock is now every hero's starter weapon, and the grove
  // holds the longsword instead: a save that found the old sword has the longsword unlocked.
  if (save.pool.includes('sword')) save.pool = [...new Set(save.pool.map((id) => (id === 'sword' ? 'longsword' : id)))];
  return save;
}

export function loadSlot(slot: number): SaveFile | null {
  try {
    let raw = localStorage.getItem(KEY(slot));
    if (!raw) {
      raw = localStorage.getItem(OLD_KEY(slot));
      if (raw) {
        localStorage.setItem(KEY(slot), raw);
        localStorage.removeItem(OLD_KEY(slot));
      }
    }
    return raw ? parseSave(raw) : null;
  } catch {
    return null;
  }
}

/** Returns false when the browser refused to store the save (private mode, storage full). */
export function writeSlot(slot: number, save: SaveFile): boolean {
  save.updated = Date.now();
  try {
    localStorage.setItem(KEY(slot), JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function deleteSlot(slot: number): void {
  try {
    localStorage.removeItem(KEY(slot));
    localStorage.removeItem(OLD_KEY(slot));
  } catch {
    /* nothing to delete */
  }
}

export function exportSave(save: SaveFile, slot: number): void {
  const blob = new Blob([JSON.stringify(save, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `campfire-crawl-save-${slot + 1}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
