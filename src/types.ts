// Shared data shapes: what gets saved, and what a run consists of.

export const GAME_TITLE = 'Campfire Crawl';
export const TILE = 16;
export const VIEW_W = 384;
export const VIEW_H = 216;
export const UI_SCALE = 3; // CSS pixels per game pixel at stage scale 1
export const SAVE_VERSION = 1;
export const MAX_HEROES = 4;
export const PACK_SIZE = 6;
export const LIVES_PER_HERO = 2;

export interface ItemStack {
  id: string;
  charges?: number;
}

/** A hero that persists between runs inside a save file. */
export interface HeroProfile {
  name: string;
  color: number; // 0..4, selects sheet hero0..hero4 (4 is the heroine)
  renown: number; // meta currency
  upgrades: Record<string, number>;
  /** Starter kit chosen for the next run: 3 active slots then the passive slot. Paid for when the run starts. */
  kit: (string | null)[];
  /** The run number (SaveFile.runsPlayed) whose kit offer this hero has re-rolled with Second Look. */
  rerollAt?: number;
}

export interface MapKnowledge {
  secrets: string[];
  shortcuts: string[];
  bestCheckpoint: number;
  clears: number;
  /** Every tile any party has explored here, packed like RunState.explored. Used by the Cartographer upgrade. */
  explored?: string;
}

export interface RunHero {
  profile: number; // index into SaveFile.heroes
  hp: number;
  slots: (ItemStack | null)[]; // 3 active
  passive: ItemStack | null;
  pack: (ItemStack | null)[]; // PACK_SIZE
  gold: number;
  charmHp: number; // one-run charms bought from merchants
  charmDmg: number;
  deaths: number;
  earned: number; // renown bonuses earned this run
  /** Gold handed out at the start by Pocket Change. It can be spent, but never turns into renown. */
  startGold?: number;
}

export interface GroundItem {
  x: number; // world pixels
  y: number;
  item: ItemStack;
}

export interface RunState {
  mapId: string;
  seed: number;
  heroes: RunHero[]; // in turn order
  active: number; // index into heroes
  lives: number;
  checkpoint: number; // last checkpoint reached (0 = map start)
  /** Persistent world facts: opened chests, solved puzzles, broken pots, found secrets ... */
  flags: string[];
  /** Monsters that stay dead (killed in sections the party has completed). */
  dead: string[];
  explored: string; // base64 bitset, one bit per tile
  keys: string[]; // party key ring
  ground: GroundItem[];
  bossPhase: number;
  startedAt: number;
  secretsFound: number;
  kills: number;
}

export interface SaveFile {
  version: number;
  created: number;
  updated: number;
  heroes: HeroProfile[];
  pool: string[]; // unlocked item ids
  knowledge: Record<string, MapKnowledge>;
  bestiary: string[];
  mapsUnlocked: number; // highest map number available (1-based)
  runsPlayed: number;
  run: RunState | null;
  settings: { music: number; sfx: number; musicOn: boolean };
}
