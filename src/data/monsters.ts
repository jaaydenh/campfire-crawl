import { F, O, type SheetKey } from '../art/manifest';

export type MonsterAi = 'hopper' | 'lunger' | 'melee' | 'ranged' | 'flyer' | 'spitter' | 'leaper' | 'swimmer' | 'wisp' | 'generator' | 'boss';

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
  // Map 2:
  frame?: O; // generator: its frame on the objects sheet
  swims?: boolean; // shallow mire does not slow it
  land?: number; // swimmer: speed multiplier out of the water
  poison?: number; // ms of poison its hit leaves on the hero
  slows?: boolean; // its hit leaves the hero slowed
  thrust?: { from: number; reach: number; half: number; windup: number; recover: number; combo?: number }; // melee: a long, narrow spear thrust, `combo` in a row
  lurks?: boolean; // lies under the surface until the hero is close, showing only ripples
  bolt?: { frame: F; speed: number; reach: number }; // ranged: what it shoots instead of an arrow
  heals?: number; // ranged: HP it restores to a wounded ally near it instead of shooting
  cloud?: number; // leaves a poison cloud this many ms long where it dies
  sparks?: number; // wisp: sparks thrown outward by its burst
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
  // Map 2: the swamp and the sunken temple
  { id: 'toad', name: 'Bog Toad', desc: 'Sits, then leaps onto where you stand. Its slime is poison. Step out of the circle and strike while it squats.', sheet: 'toad', ai: 'leaper', hp: 11, dmg: 4, speed: 30, aggro: 7, radius: 6, gold: [3, 5], swims: true, poison: 3000 },
  { id: 'leech', name: 'Mire Leech', desc: 'Quick in the water, sluggish on land. Fights in swarms: lure them onto dry ground.', sheet: 'leech', ai: 'swimmer', hp: 4, dmg: 2, speed: 86, aggro: 7, radius: 4, gold: [1, 2], swims: true, land: 0.4, poison: 2000 },
  { id: 'wisp', name: "Will-o'-wisp", desc: 'Drifts close, flares, and bursts. Back away from the flare, then hit it before it blinks off.', sheet: 'wisp', ai: 'wisp', hp: 6, dmg: 4, speed: 58, aggro: 8, radius: 4, gold: [2, 4] },
  { id: 'lizard', name: 'Lizardfolk Spearman', desc: 'Thrusts a long way in a narrow line. Sidestep the spear, never back away from it.', sheet: 'lizard', ai: 'melee', hp: 15, dmg: 5, speed: 58, aggro: 8, radius: 5, gold: [4, 7], swims: true, thrust: { from: 34, reach: 44, half: 0.34, windup: 470, recover: 650 } },
  { id: 'shaman', name: 'Lizardfolk Shaman', desc: 'Throws hexes that poison, and mends its wounded friends. Kill it first.', sheet: 'shaman', ai: 'ranged', hp: 9, dmg: 3, speed: 46, aggro: 9, radius: 5, gold: [5, 8], swims: true, poison: 4000, bolt: { frame: F.Hex, speed: 112, reach: 170 }, heals: 5 },
  { id: 'drowned', name: 'Drowned Dead', desc: 'Lies under the water until you are close: watch for ripples. Slow, tough, and its grip leaves you sluggish.', sheet: 'drowned', ai: 'melee', hp: 19, dmg: 5, speed: 36, aggro: 3.2, radius: 5, gold: [4, 8], swims: true, slows: true, lurks: true },
  // Their variants on the higher tiers
  { id: 'bloat', name: 'Bloat Toad', desc: 'Swollen with gas. It leaves a cloud of poison where it dies: finish it and step back.', sheet: 'bloat', ai: 'leaper', hp: 16, dmg: 4, speed: 30, aggro: 7, radius: 7, gold: [5, 8], scale: 1.25, swims: true, poison: 3000, cloud: 3500 },
  { id: 'gravelight', name: 'Grave Light', desc: 'A wisp that has fed. Its burst throws sparks in every direction.', sheet: 'gravelight', ai: 'wisp', hp: 9, dmg: 4, speed: 62, aggro: 9, radius: 4, gold: [4, 7], sparks: 6 },
  { id: 'stalker', name: 'Marsh Stalker', desc: 'A lizardfolk veteran. It thrusts twice, turning between them: sidestep both.', sheet: 'stalker', ai: 'melee', hp: 22, dmg: 6, speed: 62, aggro: 9, radius: 5, gold: [6, 10], scale: 1.15, swims: true, thrust: { from: 36, reach: 46, half: 0.34, windup: 430, recover: 750, combo: 2 } },
  { id: 'witch', name: 'Mire Witch', desc: 'Throws three hexes in a fan and mends more than a shaman does.', sheet: 'witch', ai: 'ranged', hp: 12, dmg: 3, speed: 46, aggro: 10, radius: 5, gold: [7, 11], swims: true, poison: 4000, bolt: { frame: F.Hex, speed: 112, reach: 170 }, heals: 8, volley: 3 },
  { id: 'den', name: 'Wolf Den', desc: 'Wolves keep coming until the den is destroyed.', sheet: 'objects', ai: 'generator', hp: 28, dmg: 0, speed: 0, aggro: 9, radius: 7, gold: [8, 12], frame: O.Den },
  { id: 'nest', name: 'Spider Nest', desc: 'Hatches spiders until it is destroyed.', sheet: 'objects', ai: 'generator', hp: 28, dmg: 0, speed: 0, aggro: 9, radius: 7, gold: [8, 12], frame: O.Nest },
  { id: 'clutch', name: 'Leech Clutch', desc: 'A rotten log full of eggs. Leeches keep hatching until it is destroyed.', sheet: 'objects', ai: 'generator', hp: 30, dmg: 0, speed: 0, aggro: 9, radius: 7, gold: [9, 13], frame: O.Clutch },
  { id: 'coffin', name: 'Sunken Coffin', desc: 'The drowned keep climbing out of it until it is destroyed.', sheet: 'objects', ai: 'generator', hp: 34, dmg: 0, speed: 0, aggro: 9, radius: 7, gold: [10, 14], frame: O.Coffin },
  { id: 'chief', name: 'The Bandit Chief', desc: 'Lord of the cave. Cleaves, charges and hurls axes.', sheet: 'chief', ai: 'boss', hp: 50, dmg: 6, speed: 40, aggro: 30, radius: 10, gold: [40, 40] },
  { id: 'priest', name: 'The Drowned Priest', desc: 'Keeper of the sunken temple. Hurls water, calls geysers and floods his own sanctum: keep to dry ground.', sheet: 'priest', ai: 'boss', hp: 48, dmg: 6, speed: 26, aggro: 30, radius: 9, gold: [50, 50] },
];

export const MONSTERS: Record<string, MonsterDef> = Object.fromEntries(defs.map((d) => [d.id, d]));
/** What each generator hatches. */
export const GENERATOR_SPAWN: Record<string, string> = { den: 'wolf', nest: 'spider', clutch: 'leech', coffin: 'drowned' };
/** HP of each boss phase. */
export const CHIEF_PHASES = [50, 55, 65];
export const BOSS_PHASES: Record<string, number[]> = { chief: CHIEF_PHASES, priest: [48, 56, 66] };
/** What the party is told when a boss's guard breaks: the first break, then the second. */
export const BOSS_LINES: Record<string, { short: string; breaks: string[]; help: string; beaten: string; ahead: string }> = {
  chief: { short: 'The Chief', breaks: ["The Chief's guard is broken", 'The Chief is enraged! His guard is broken again'], help: 'He calls for help!', beaten: 'The Bandit Chief is beaten.', ahead: "The Chief's hall lies ahead." },
  priest: { short: 'The Priest', breaks: ['The Priest falters and the water rises', 'The Priest howls and the sanctum floods'], help: 'The drowned answer him!', beaten: 'The Drowned Priest sinks for the last time.', ahead: 'The Drowned Sanctum lies ahead.' },
};
