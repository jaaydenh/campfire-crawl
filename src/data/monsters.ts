import type { SheetKey } from '../art/manifest';

export type MonsterAi = 'hopper' | 'lunger' | 'melee' | 'ranged' | 'flyer' | 'spitter' | 'generator' | 'boss';

export interface MonsterDef {
  id: string;
  name: string;
  desc: string;
  sheet: SheetKey | 'objects';
  ai: MonsterAi;
  hp: number;
  dmg: number;
  speed: number; // pixels per second
  aggro: number; // tiles
  radius: number; // pixels
  gold: [number, number];
  // What sets a variant apart from the monster it grows out of:
  scale?: number; // drawn this much larger
  split?: string; // hopper: bursts into two of these when it dies
  lunges?: number; // lunger: lunges in a row before it rests
  volley?: number; // ranged: arrows loosed at once, in a fan
  heavy?: boolean; // melee: a slower, wider, longer swing, and hard to stagger
}

const defs: MonsterDef[] = [
  { id: 'slime', name: 'Slime', desc: 'Hops at you. Harmless alone, a nuisance in groups.', sheet: 'slime', ai: 'hopper', hp: 6, dmg: 3, speed: 34, aggro: 6, radius: 5, gold: [1, 3] },
  { id: 'wolf', name: 'Wolf', desc: 'Faster than you. Crouches, then lunges: sidestep it and strike while it recovers.', sheet: 'wolf', ai: 'lunger', hp: 8, dmg: 4, speed: 84, aggro: 8, radius: 5, gold: [2, 4] },
  { id: 'bandit', name: 'Bandit', desc: 'Winds up a heavy club swing. Step out of reach, then punish.', sheet: 'bandit', ai: 'melee', hp: 13, dmg: 5, speed: 52, aggro: 7, radius: 5, gold: [3, 6] },
  { id: 'archer', name: 'Bandit Archer', desc: 'Keeps its distance and shoots. Close in or use cover.', sheet: 'archer', ai: 'ranged', hp: 8, dmg: 4, speed: 46, aggro: 9, radius: 5, gold: [3, 6] },
  { id: 'bat', name: 'Cave Bat', desc: 'Swoops in erratic arcs. Fragile.', sheet: 'bat', ai: 'flyer', hp: 4, dmg: 2, speed: 88, aggro: 7, radius: 4, gold: [1, 2] },
  { id: 'spider', name: 'Cave Spider', desc: 'Spits webbing that slows you, then bites.', sheet: 'spider', ai: 'spitter', hp: 10, dmg: 4, speed: 48, aggro: 7, radius: 5, gold: [2, 5] },
  // Variants: only met on the higher difficulty tiers, where they take the place of some of the monsters above
  { id: 'brood', name: 'Brood Slime', desc: 'Bloated and slow. Bursts into two slimes when it dies.', sheet: 'brood', ai: 'hopper', hp: 12, dmg: 3, speed: 30, aggro: 6, radius: 6, gold: [3, 5], scale: 1.3, split: 'slime' },
  { id: 'dire', name: 'Dire Wolf', desc: 'Bigger and meaner. Lunges twice before it rests: sidestep both.', sheet: 'dire', ai: 'lunger', hp: 13, dmg: 5, speed: 88, aggro: 9, radius: 6, gold: [4, 7], scale: 1.2, lunges: 2 },
  { id: 'marksman', name: 'Bandit Marksman', desc: 'Looses three arrows in a fan. Slip between the shafts or get behind cover.', sheet: 'marksman', ai: 'ranged', hp: 10, dmg: 4, speed: 46, aggro: 10, radius: 5, gold: [5, 8], volley: 3 },
  { id: 'brute', name: 'Bandit Brute', desc: 'Slow, armoured and hard to stagger. His swing is wide and long: back right out of it.', sheet: 'brute', ai: 'melee', hp: 26, dmg: 7, speed: 40, aggro: 7, radius: 6, gold: [6, 10], scale: 1.3, heavy: true },
  { id: 'den', name: 'Wolf Den', desc: 'Wolves keep coming until the den is destroyed.', sheet: 'objects', ai: 'generator', hp: 28, dmg: 0, speed: 0, aggro: 9, radius: 7, gold: [8, 12] },
  { id: 'nest', name: 'Spider Nest', desc: 'Hatches spiders until it is destroyed.', sheet: 'objects', ai: 'generator', hp: 28, dmg: 0, speed: 0, aggro: 9, radius: 7, gold: [8, 12] },
  { id: 'chief', name: 'The Bandit Chief', desc: 'Lord of the cave. Cleaves, charges and hurls axes.', sheet: 'chief', ai: 'boss', hp: 50, dmg: 6, speed: 40, aggro: 30, radius: 10, gold: [40, 40] },
];

export const MONSTERS: Record<string, MonsterDef> = Object.fromEntries(defs.map((d) => [d.id, d]));
/** What each generator hatches. */
export const GENERATOR_SPAWN: Record<string, string> = { den: 'wolf', nest: 'spider' };
/** HP of each boss phase. */
export const CHIEF_PHASES = [50, 55, 65];
