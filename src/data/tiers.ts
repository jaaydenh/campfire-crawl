// Difficulty tiers. Every map can be played on each of them; clearing one opens the next on that map.
// All the numbers that make a tier easier or harder are in this one table.
import { seeded } from '../rng';
import type { MonsterSpawn } from '../world/mapdef';
import { GENERATOR_SPAWN, MONSTERS, type MonsterDef } from './monsters';

/**
 * The Chief. slam: a shockwave around him. leap: he jumps to where the hero stands and lands with one.
 * The Drowned Priest. pool: a whirlpool that drags the hero in. wave: a wall of water with one gap crosses the sanctum.
 */
export type BossMove = 'slam' | 'leap' | 'pool' | 'wave';

export interface TierDef {
  tier: number; // 1-based
  name: string;
  blurb: string; // one line for the camp screen
  hp: number; // multiplier on monster and boss health
  dmg: number; // multiplier on monster and boss damage
  hearts: number; // multiplier on the chance that a monster drops a heart
  /** False: no dens or nests. Each one is replaced by a single monster of the kind it would hatch. */
  generators: boolean;
  hatchEvery: number; // ms between a generator's hatchlings
  hatchMax: number; // hatchlings one generator keeps alive at once
  trapDmg: number; // added to spike and arrow trap damage
  trapChance: number; // added to the chance that an optional trap is there in a run
  /** Who each boss calls in when each phase breaks: one list per break. */
  bossHelp: Record<string, string[][]>;
  /** Attacks each boss has on this tier on top of his usual ones. */
  bossMoves: Record<string, BossMove[]>;
  /** Variants met on this tier: for a monster, the variant that may stand in its place and how often (0 to 1). */
  variants: Record<string, [string, number]>;
  clearBonus: number; // renown each hero earns for clearing the map
}

/**
 * Tier 1 is tuned so that a brand-new party can just barely clear map 1 on its first run.
 * Tier 2 is about level with tier 1 of the map two further on, and tier 3 with the map four further on.
 */
export const TIERS: TierDef[] = [
  { tier: 1, name: 'Adventurer', blurb: 'Weaker monsters, more hearts, no dens or nests.', hp: 0.8, dmg: 0.75, hearts: 1.5, generators: false, hatchEvery: 5200, hatchMax: 3, trapDmg: 0, trapChance: 0, bossHelp: { chief: [['bandit', 'bandit'], []], priest: [['drowned', 'drowned'], []] }, bossMoves: { chief: [], priest: [] }, variants: {}, clearBonus: 30 },
  { tier: 2, name: 'Veteran', blurb: 'Tougher monsters in larger packs, new kinds among them, dens and nests.', hp: 1.2, dmg: 1.25, hearts: 1, generators: true, hatchEvery: 5200, hatchMax: 3, trapDmg: 0, trapChance: 0.2, bossHelp: { chief: [['bandit', 'bandit', 'archer'], []], priest: [['drowned', 'drowned', 'shaman'], []] }, bossMoves: { chief: ['slam'], priest: ['pool'] }, variants: { slime: ['brood', 0.3], wolf: ['dire', 0.3], toad: ['bloat', 0.3], wisp: ['gravelight', 0.3] }, clearBonus: 60 },
  { tier: 3, name: 'Legend', blurb: 'Deadly monsters and more new kinds, every trap armed, few hearts.', hp: 1.5, dmg: 1.6, hearts: 0.75, generators: true, hatchEvery: 4200, hatchMax: 4, trapDmg: 1, trapChance: 1, bossHelp: { chief: [['bandit', 'bandit', 'archer'], ['brute', 'marksman']], priest: [['drowned', 'drowned', 'shaman'], ['stalker', 'witch']] }, bossMoves: { chief: ['slam', 'leap'], priest: ['pool', 'wave'] }, variants: { slime: ['brood', 0.45], wolf: ['dire', 0.45], archer: ['marksman', 0.4], bandit: ['brute', 0.3], toad: ['bloat', 0.45], wisp: ['gravelight', 0.45], lizard: ['stalker', 0.35], shaman: ['witch', 0.4] }, clearBonus: 100 },
];

export const TIER_COUNT = TIERS.length;

/** The tier with this number. Anything out of range plays as tier 1. */
export const tierDef = (tier: number | undefined): TierDef => TIERS[(tier ?? 1) - 1] ?? TIERS[0];

export const scaleHp = (hp: number, t: TierDef): number => Math.max(1, Math.round(hp * t.hp));
/** Damage never drops below 1; something harmless stays harmless. */
export const scaleDmg = (dmg: number, t: TierDef): number => (dmg > 0 ? Math.max(1, Math.round(dmg * t.dmg)) : 0);

/** A tier as it plays on a map whose monsters are tougher than the table says: the same tier with the map's multipliers folded in. */
export function tierOnMap(t: TierDef, scale: { hp: number; dmg: number }): TierDef {
  return scale.hp === 1 && scale.dmg === 1 ? t : { ...t, hp: t.hp * scale.hp, dmg: t.dmg * scale.dmg };
}

const scaled = new Map<string, MonsterDef>();
/** A monster as it is on a tier: the same creature with that tier's health and damage. */
export function tierMonster(def: MonsterDef, t: TierDef): MonsterDef {
  const key = `${def.id}:${t.hp}:${t.dmg}`;
  let m = scaled.get(key);
  if (!m) {
    m = { ...def, hp: scaleHp(def.hp, t), dmg: scaleDmg(def.dmg, t) };
    scaled.set(key, m);
  }
  return m;
}

/**
 * What stands at a spawn point in a run on a tier, or null when that monster is not there on this tier.
 * The pick among a point's options depends only on the run's seed, so it is the same after a reload.
 * On a tier without dens and nests, one of their hatchlings stands there instead.
 * On the higher tiers some monsters are replaced by their variant.
 */
export function spawnOn(sp: MonsterSpawn, seed: number, t: TierDef): string | null {
  if ((sp.minTier ?? 1) > t.tier) return null;
  let type = seeded(seed, sp.id).pick(sp.options);
  if (!t.generators && MONSTERS[type].ai === 'generator') type = GENERATOR_SPAWN[type];
  const v = t.variants[type];
  return v && seeded(seed, sp.id + ':variant').next() < v[1] ? v[0] : type;
}
