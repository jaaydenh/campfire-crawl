// Run rules that do not need the game world: stats, loot rolls, turn order, rewards.
import { ITEMS, ITEM_LIST, newStack } from './data/items';
import { UPGRADES } from './data/upgrades';
import { Rng, seeded } from './rng';
import { LIVES_PER_HERO, PACK_SIZE, type HeroProfile, type ItemStack, type RunHero, type RunState, type SaveFile } from './types';

export const BASE_HP = 20;
export const BASE_SPEED = 72;
export const BASE_LIGHT = 5;

export interface HeroStats {
  maxHp: number;
  dmgMult: number;
  speed: number;
  light: number; // tiles
  goldMult: number;
  armour: boolean;
  magnet: boolean;
}

const lvl = (p: HeroProfile, id: string) => p.upgrades[id] ?? 0;

export function heroStats(save: SaveFile, rh: RunHero): HeroStats {
  const p = save.heroes[rh.profile];
  const passive = rh.passive?.id;
  return {
    maxHp: BASE_HP + 4 * lvl(p, 'vit') + (passive === 'vigor' ? 8 : 0) + 4 * rh.charmHp,
    dmgMult: (1 + 0.15 * lvl(p, 'might')) * (1 + 0.1 * rh.charmDmg),
    speed: BASE_SPEED * (1 + 0.05 * lvl(p, 'swift')),
    light: BASE_LIGHT + lvl(p, 'eyes') + (passive === 'lantern' ? 3 : 0),
    goldMult: (1 + 0.15 * lvl(p, 'fortune')) * (passive === 'magnet' ? 1.2 : 1),
    armour: passive === 'armour',
    magnet: passive === 'magnet',
  };
}

export function upgradeCost(p: HeroProfile, id: string): number | null {
  const def = UPGRADES.find((u) => u.id === id)!;
  const cur = lvl(p, id);
  return cur < def.costs.length ? def.costs[cur] : null;
}

export function kitCost(p: HeroProfile): number {
  return p.kit.reduce((sum, id) => sum + (id ? ITEMS[id].kit : 0), 0);
}

/** Starts a run for the chosen heroes (in turn order). Charges each hero's starter kit. */
export function createRun(save: SaveFile, heroIdxs: number[], mapId: string): RunState {
  const heroes: RunHero[] = heroIdxs.map((profile) => {
    const p = save.heroes[profile];
    const cost = kitCost(p);
    const kit = cost <= p.renown ? p.kit : [null, null, null, null];
    if (cost <= p.renown) p.renown -= cost;
    const rh: RunHero = {
      profile,
      hp: 0,
      slots: [0, 1, 2].map((i) => (kit[i] ? newStack(kit[i]!) : null)),
      passive: kit[3] ? newStack(kit[3]) : null,
      pack: Array(PACK_SIZE).fill(null),
      gold: 0,
      charmHp: 0,
      charmDmg: 0,
      deaths: 0,
      earned: 0,
    };
    p.kit = [null, null, null, null];
    rh.hp = heroStats(save, rh).maxHp;
    return rh;
  });
  const bonusLives = heroIdxs.reduce((n, i) => n + lvl(save.heroes[i], 'wind'), 0);
  save.runsPlayed++;
  return {
    mapId,
    seed: (Math.random() * 0xffffffff) >>> 0,
    heroes,
    active: 0,
    lives: LIVES_PER_HERO * heroes.length + bonusLives,
    checkpoint: 0,
    flags: [],
    dead: [],
    explored: '',
    keys: [],
    ground: [],
    bossPhase: 0,
    startedAt: Date.now(),
    secretsFound: 0,
    kills: 0,
  };
}

export const hasFlag = (run: RunState, f: string) => run.flags.includes(f);
export function setFlag(run: RunState, f: string): void {
  if (!run.flags.includes(f)) run.flags.push(f);
}

export function advanceTurn(run: RunState): void {
  run.active = (run.active + 1) % run.heroes.length;
}

/** Puts an item on the hero: an empty matching slot first, then the pack. Returns where it went, or null if full. */
export function giveItem(rh: RunHero, stack: ItemStack): 'slot' | 'pack' | null {
  const def = ITEMS[stack.id];
  if (def.slot === 'passive') {
    if (!rh.passive) {
      rh.passive = stack;
      return 'slot';
    }
  } else {
    const i = rh.slots.findIndex((s) => !s);
    if (i >= 0) {
      rh.slots[i] = stack;
      return 'slot';
    }
  }
  const j = rh.pack.findIndex((s) => !s);
  if (j >= 0) {
    rh.pack[j] = stack;
    return 'pack';
  }
  return null;
}

export type LootTier = 'weapon' | 'common' | 'good' | 'rare';

function rollItem(rng: Rng, pool: string[], tier: LootTier): string {
  const weights: Record<LootTier, number[]> = {
    weapon: [1, 0, 0],
    common: [8, 2, 0],
    good: [3, 6, 1],
    rare: [0, 5, 5],
  };
  let cands = pool.map((id) => ITEMS[id]).filter(Boolean);
  if (tier === 'weapon') cands = cands.filter((d) => d.cat === 'offensive' && !d.charges);
  const bag: string[] = [];
  for (const d of cands) for (let i = 0; i < weights[tier][d.rarity]; i++) bag.push(d.id);
  if (!bag.length) return rng.pick(cands.length ? cands : ITEM_LIST).id;
  return rng.pick(bag);
}

/** Chest contents are fixed for a given run seed and chest, so re-opening after a reload cannot re-roll. */
export function rollChest(run: RunState, save: SaveFile, chestId: string, tier: LootTier): { item: ItemStack; gold: number } {
  const rng = seeded(run.seed, 'chest:' + chestId);
  const gold = tier === 'rare' ? rng.int(18, 28) : tier === 'good' ? rng.int(10, 18) : rng.int(5, 10);
  return { item: newStack(rollItem(rng, save.pool, tier)), gold };
}

export interface ShopEntry {
  key: string; // unique within the shop, used to mark it sold
  kind: 'item' | 'heal' | 'charmHp' | 'charmDmg';
  item?: ItemStack;
  price: number;
}

/** What the merchant at a checkpoint sells this run. */
export function shopStock(run: RunState, save: SaveFile, checkpoint: number): ShopEntry[] {
  const rng = seeded(run.seed, 'shop:' + checkpoint);
  const out: ShopEntry[] = [];
  const seen = new Set<string>();
  const tiers: LootTier[] = ['weapon', 'common', 'good', checkpoint >= 4 ? 'rare' : 'good'];
  tiers.forEach((tier, i) => {
    let id = rollItem(rng, save.pool, tier);
    for (let tries = 0; tries < 6 && seen.has(id); tries++) id = rollItem(rng, save.pool, tier);
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ key: `i${i}`, kind: 'item', item: newStack(id), price: ITEMS[id].price });
  });
  out.push({ key: 'ch', kind: 'charmHp', price: 30 });
  out.push({ key: 'cd', kind: 'charmDmg', price: 35 });
  out.push({ key: 'heal', kind: 'heal', price: 15 });
  return out.filter((e) => e.kind === 'heal' || !run.flags.includes(`shop:${checkpoint}:${e.key}`));
}

export interface RunSummary {
  won: boolean;
  rows: { name: string; color: number; gold: number; bonus: number; total: number }[];
  checkpoint: number;
  secrets: number;
  kills: number;
  unlockedItems: string[];
}

/** Ends the run: converts gold and bonuses to renown and clears the run from the save. */
export function finishRun(save: SaveFile, won: boolean, unlockedItems: string[]): RunSummary {
  const run = save.run!;
  const rows = run.heroes.map((rh) => {
    const p = save.heroes[rh.profile];
    const bonus = rh.earned + (won ? 30 : 0);
    p.renown += rh.gold + bonus;
    return { name: p.name, color: p.color, gold: rh.gold, bonus, total: rh.gold + bonus };
  });
  const k = (save.knowledge[run.mapId] ??= { secrets: [], shortcuts: [], bestCheckpoint: 0, clears: 0 });
  k.bestCheckpoint = Math.max(k.bestCheckpoint, run.checkpoint);
  if (won) k.clears++;
  const summary: RunSummary = { won, rows, checkpoint: run.checkpoint, secrets: run.secretsFound, kills: run.kills, unlockedItems };
  save.run = null;
  return summary;
}

// --- explored-tiles bitset <-> base64 ---

export function packBits(bits: Uint8Array): string {
  const bytes = new Uint8Array(Math.ceil(bits.length / 8));
  for (let i = 0; i < bits.length; i++) if (bits[i]) bytes[i >> 3] |= 1 << (i & 7);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function unpackBits(str: string, length: number): Uint8Array {
  const bits = new Uint8Array(length);
  if (!str) return bits;
  try {
    const s = atob(str);
    for (let i = 0; i < length; i++) if (s.charCodeAt(i >> 3) & (1 << (i & 7))) bits[i] = 1;
  } catch {
    /* corrupt fog data: start unexplored */
  }
  return bits;
}
