// Run rules that do not need the game world: stats, loot rolls, turn order, rewards.
import { ITEMS, ITEM_LIST, isLastingWeapon, newStack } from './data/items';
import { UPGRADE } from './data/upgrades';
import { Rng, seeded } from './rng';
import { LIVES_PER_HERO, PACK_SIZE, type HeroProfile, type ItemStack, type RunHero, type RunState, type SaveFile } from './types';

export const BASE_HP = 20;
export const BASE_SPEED = 72;
export const BASE_LIGHT = 5;

export const BASE_IFRAMES = 800; // ms of safety after being hit
export const BASE_PULL = 20; // px from which pickups fly to the hero
export const TRAP_DMG = 3;

export interface HeroStats {
  maxHp: number;
  dmgMult: number;
  speed: number;
  light: number; // tiles
  goldMult: number;
  armour: boolean;
  magnet: boolean;
  iframes: number; // ms of safety after being hit
  heartBonus: number; // extra HP from each heart
  trapDmg: number; // damage taken from spikes and arrow traps
  cdMult: number; // multiplier on ability cooldowns
  knockMult: number; // multiplier on melee knockback
  bigMult: number; // damage multiplier against bosses and monster generators
  ambushMult: number; // damage multiplier against monsters that have not noticed the hero
  pull: number; // px from which pickups fly to the hero
  arrowDrop: number; // chance of an arrow pile per kill while a bow is equipped
  nose: boolean; // hears a chime near undiscovered secrets
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
    iframes: BASE_IFRAMES + 150 * lvl(p, 'thick'),
    heartBonus: lvl(p, 'hearty'),
    trapDmg: Math.max(1, TRAP_DMG - lvl(p, 'trap')),
    cdMult: 1 - 0.06 * lvl(p, 'quick'),
    knockMult: 1 + 0.25 * lvl(p, 'heavy'),
    bigMult: 1 + 0.1 * lvl(p, 'slayer'),
    ambushMult: 1 + 0.25 * lvl(p, 'ambush'),
    pull: (passive === 'magnet' ? 72 : BASE_PULL) + 14 * lvl(p, 'reach'),
    arrowDrop: ARROW_DROP_CHANCE + 0.03 * lvl(p, 'quiver'),
    nose: lvl(p, 'nose') > 0,
  };
}

/** Renown for the next level, or null when the upgrade is at its top level. */
export function upgradeCost(p: HeroProfile, id: string): number | null {
  const def = UPGRADE[id];
  const cur = lvl(p, id);
  return cur < def.costs.length ? def.costs[cur] : null;
}

/**
 * What still has to be bought before this upgrade opens, or null when it is open.
 * An upgrade the hero already owns stays open, whatever the tree says now.
 */
export function upgradeLock(p: HeroProfile, id: string): { id: string; level: number } | null {
  const needs = UPGRADE[id].needs;
  if (!needs || lvl(p, id) > 0 || lvl(p, needs.id) >= needs.level) return null;
  return needs;
}

/** Buys one level. Returns false when it is locked, maxed or too dear. */
export function buyUpgrade(p: HeroProfile, id: string): boolean {
  const cost = upgradeCost(p, id);
  if (cost === null || cost > p.renown || upgradeLock(p, id)) return false;
  p.renown -= cost;
  p.upgrades[id] = lvl(p, id) + 1;
  return true;
}

/** Renown to start a run with an item, after the hero's Quartermaster discount. */
export function kitPrice(p: HeroProfile, id: string): number {
  return Math.ceil(ITEMS[id].kit * (1 - 0.1 * lvl(p, 'quarter')));
}

export function kitCost(p: HeroProfile): number {
  return p.kit.reduce((sum, id) => sum + (id ? kitPrice(p, id) : 0), 0);
}

/** A fresh stack as this hero receives it: Packrat adds uses to limited items, Deep Quiver adds arrows. */
export function outfit(p: HeroProfile, stack: ItemStack): ItemStack {
  const d = ITEMS[stack.id];
  if (!d?.charges || stack.charges === undefined) return stack;
  if (d.ammo) stack.charges = Math.min(ARROW_MAX, stack.charges + 12 * lvl(p, 'quiver'));
  else stack.charges = Math.round(stack.charges * (1 + 0.2 * lvl(p, 'packrat')));
  return stack;
}

// --- arrows ---

export const ARROW_PILE = 10; // arrows in one dropped pile
export const ARROW_MAX = 99; // most a bow can hold
export const ARROW_DROP_CHANCE = 0.15; // per monster killed while a bow is equipped

/** True when the hero has a bow in one of the three active slots. */
export const bowEquipped = (rh: RunHero): boolean => rh.slots.some((s) => s?.id === 'bow');

/** Adds arrows to the hero's bow (an equipped one first, then one in the pack). Returns how many fitted. */
export function addArrows(rh: RunHero, count: number): number {
  const bow = [...rh.slots, ...rh.pack].find((s) => s?.id === 'bow' && (s.charges ?? 0) < ARROW_MAX);
  if (!bow) return 0;
  const before = bow.charges ?? 0;
  bow.charges = Math.min(ARROW_MAX, before + count);
  return bow.charges - before;
}

/** Gives a charge count to stacks saved before their item had one (the bow, before arrows existed). */
export function fillMissingCharges(run: RunState): void {
  const fix = (s: ItemStack | null) => {
    if (s && s.charges === undefined && ITEMS[s.id]?.charges) s.charges = ITEMS[s.id].charges;
  };
  for (const rh of run.heroes) [...rh.slots, rh.passive, ...rh.pack].forEach(fix);
  for (const g of run.ground) fix(g.item);
}

export const KIT_OFFER_SIZE = 4; // five with the Wider Offer upgrade

/**
 * The starter gear a hero may buy before the next run: four items drawn from the unlocked pool.
 * The draw depends only on the save, the run number and the hero, so it stays the same until a
 * run starts and is different for the run after. One of the four is always a reusable weapon
 * when the pool has one, so nobody is offered a start with no way to fight better than fists.
 */
export function kitOffer(save: SaveFile, heroIdx: number): string[] {
  const p = save.heroes[heroIdx];
  const rerolled = p.rerollAt === save.runsPlayed ? ':again' : '';
  const rng = seeded(save.created >>> 0, `kit:${save.runsPlayed}:${heroIdx}${rerolled}`);
  const pool = save.pool.filter((id) => ITEMS[id] && id !== 'fists');
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const weapon = pool.findIndex((id) => isLastingWeapon(ITEMS[id]));
  if (weapon > 0) pool.unshift(pool.splice(weapon, 1)[0]);
  const order = (id: string) => ITEM_LIST.indexOf(ITEMS[id]);
  return pool.slice(0, KIT_OFFER_SIZE + (lvl(p, 'wider') > 0 ? 1 : 0)).sort((a, b) => order(a) - order(b));
}

/** Removes anything from the hero's chosen kit that is not in their current offer, and any duplicate. */
export function trimKit(save: SaveFile, heroIdx: number): void {
  const offer = kitOffer(save, heroIdx);
  const p = save.heroes[heroIdx];
  const seen = new Set<string>();
  p.kit = [0, 1, 2, 3].map((i) => {
    const id = p.kit[i];
    if (!id || !offer.includes(id) || seen.has(id) || (ITEMS[id].slot === 'passive') !== (i === 3)) return null;
    seen.add(id);
    return id;
  });
}

/** True when the hero owns Second Look and has not yet used it on the coming run's offer. */
export const canRerollKit = (save: SaveFile, heroIdx: number): boolean => lvl(save.heroes[heroIdx], 'look') > 0 && save.heroes[heroIdx].rerollAt !== save.runsPlayed;

/** Second Look: swaps the hero's kit offer for a new draw, once per run. Clears anything already chosen. */
export function rerollKit(save: SaveFile, heroIdx: number): boolean {
  if (!canRerollKit(save, heroIdx)) return false;
  const p = save.heroes[heroIdx];
  p.rerollAt = save.runsPlayed;
  p.kit = [null, null, null, null];
  return true;
}

export type KitToggle = 'added' | 'removed' | 'full' | 'cost' | 'none';

/** Puts an offered item into the hero's kit, or takes it out again. Passives replace the current passive. */
export function toggleKitItem(save: SaveFile, heroIdx: number, id: string): KitToggle {
  const p = save.heroes[heroIdx];
  const at = p.kit.indexOf(id);
  if (at >= 0) {
    p.kit[at] = null;
    return 'removed';
  }
  const def = ITEMS[id];
  if (!def || !kitOffer(save, heroIdx).includes(id)) return 'none';
  const slot = def.slot === 'passive' ? 3 : p.kit.findIndex((k, i) => i < 3 && !k);
  if (slot < 0) return 'full';
  const refund = p.kit[slot] ? kitPrice(p, p.kit[slot]!) : 0;
  if (kitCost(p) - refund + kitPrice(p, id) > p.renown) return 'cost';
  p.kit[slot] = id;
  return 'added';
}

/** Starts a run for the chosen heroes (in turn order). Charges each hero's starter kit. */
export function createRun(save: SaveFile, heroIdxs: number[], mapId: string): RunState {
  const heroes: RunHero[] = heroIdxs.map((profile) => {
    const p = save.heroes[profile];
    trimKit(save, profile);
    const cost = kitCost(p);
    const kit = cost <= p.renown ? p.kit : [null, null, null, null];
    if (cost <= p.renown) p.renown -= cost;
    const rh: RunHero = {
      profile,
      hp: 0,
      slots: [0, 1, 2].map((i) => (kit[i] ? outfit(p, newStack(kit[i]!)) : null)),
      passive: kit[3] ? newStack(kit[3]) : null,
      pack: Array(PACK_SIZE).fill(null),
      gold: 15 * lvl(p, 'pocket'),
      startGold: 15 * lvl(p, 'pocket'),
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
  // Cartographer: a party with one starts with everything earlier parties explored on this map
  const charted = heroIdxs.some((i) => lvl(save.heroes[i], 'carto') > 0) ? (save.knowledge[mapId]?.explored ?? '') : '';
  return {
    mapId,
    seed: (Math.random() * 0xffffffff) >>> 0,
    heroes,
    active: 0,
    lives: LIVES_PER_HERO * heroes.length + bonusLives,
    checkpoint: 0,
    flags: [],
    dead: [],
    explored: charted,
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
  if (tier === 'weapon') cands = cands.filter(isLastingWeapon);
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

/** What this hero pays the merchant for an entry, after their Haggler discount. */
export function shopPrice(save: SaveFile, rh: RunHero, e: ShopEntry): number {
  return Math.ceil(e.price * (1 - 0.08 * lvl(save.heroes[rh.profile], 'haggle')));
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
    const gold = Math.max(0, rh.gold - (rh.startGold ?? 0)); // Pocket Change gold is for spending, not banking
    p.renown += gold + bonus;
    return { name: p.name, color: p.color, gold, bonus, total: gold + bonus };
  });
  const k = (save.knowledge[run.mapId] ??= { secrets: [], shortcuts: [], bestCheckpoint: 0, clears: 0 });
  k.bestCheckpoint = Math.max(k.bestCheckpoint, run.checkpoint);
  k.explored = mergeBits(k.explored ?? '', run.explored);
  if (won) k.clears++;
  const summary: RunSummary = { won, rows, checkpoint: run.checkpoint, secrets: run.secretsFound, kills: run.kills, unlockedItems };
  save.run = null;
  return summary;
}

// --- explored-tiles bitset <-> base64 ---

/** The union of two packed bitsets. */
export function mergeBits(a: string, b: string): string {
  let x = '';
  let y = '';
  try {
    x = atob(a);
    y = atob(b);
  } catch {
    return a || b;
  }
  let out = '';
  for (let i = 0; i < Math.max(x.length, y.length); i++) out += String.fromCharCode((x.charCodeAt(i) || 0) | (y.charCodeAt(i) || 0));
  return btoa(out);
}

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
