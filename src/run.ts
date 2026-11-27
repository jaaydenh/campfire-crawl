// Run rules that do not need the game world: stats, loot rolls, turn order, rewards.
import { ITEMS, ITEM_LIST, STARTER_WEAPON, isLastingWeapon, newStack, type ItemDef } from './data/items';
import { TIERS, TIER_COUNT, tierDef } from './data/tiers';
import { UPGRADE } from './data/upgrades';
import { Rng, seeded } from './rng';
import type { MapObject } from './world/mapdef';
import { LIVES_PER_HERO, PACK_SIZE, type HeroProfile, type ItemStack, type MapKnowledge, type RunHero, type RunState, type SaveFile } from './types';

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
  antivenom: boolean; // poison cannot touch them
  waders: boolean; // mire does not slow them, and floors that give way hold longer
  leech: boolean; // every kill heals 1 HP
  wisp: boolean; // a caught wisp circles them and strikes monsters
}

const lvl = (p: HeroProfile, id: string) => p.upgrades[id] ?? 0;

export function heroStats(save: SaveFile, rh: RunHero): HeroStats {
  const p = save.heroes[rh.profile];
  const passive = rh.passive?.id;
  return {
    maxHp: BASE_HP + 4 * lvl(p, 'vit') + (passive === 'vigor' ? 8 : 0) + 4 * rh.charmHp,
    dmgMult: (1 + 0.15 * lvl(p, 'might')) * (1 + 0.1 * rh.charmDmg),
    speed: BASE_SPEED * (1 + 0.05 * lvl(p, 'swift')),
    light: BASE_LIGHT + lvl(p, 'eyes') + (passive === 'lantern' || passive === 'wisplantern' ? 3 : 0),
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
    antivenom: passive === 'antivenom',
    waders: passive === 'waders',
    leech: passive === 'leechring',
    wisp: passive === 'wisplantern',
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
export const ARROW_MAX = 199; // most a bow can hold
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

// ---------------------------------------------------------------- Prowess and the starter kit

/** Prowess every hero has before any achievement. */
export const PROWESS_START = 3;

/**
 * The hero's Prowess: what they may spend on a starter kit. It is a budget, not a purse: it is full
 * before every run and nothing is carried over. Each achievement in `feats` raises it by one.
 */
export const prowess = (p: HeroProfile): number => PROWESS_START + (p.feats?.length ?? 0);

/** Prowess to start a run with an item. */
export const kitPrice = (id: string): number => ITEMS[id]?.kit ?? 0;

export function kitCost(p: HeroProfile): number {
  return p.kit.reduce((sum, id) => sum + (id ? kitPrice(id) : 0), 0);
}

/** What an item is for in a starter kit. The offer draws from each role, so every slot can be filled. */
export type KitRole = 'weapon' | 'active' | 'passive';

export const KIT_ROLES: { role: KitRole; name: string; offers: number }[] = [
  { role: 'weapon', name: 'Weapons', offers: 2 }, // reusable: unlimited use, or ammunition that refills
  { role: 'active', name: 'Tools', offers: 2 }, // every other active item: defence, tools, limited-use
  { role: 'passive', name: 'Passives', offers: 2 },
];
export const KIT_OFFER_SIZE = KIT_ROLES.reduce((n, r) => n + r.offers, 0); // six; one more each for the Wider Offer upgrade and a first tier 3 clear

export const kitRole = (d: ItemDef): KitRole => (d.slot === 'passive' ? 'passive' : isLastingWeapon(d) ? 'weapon' : 'active');

/** Signature items each hero may pin: one, and a second once the save has cleared any map on tier 2. */
export const pinSlots = (save: SaveFile): number => 1 + (everCleared(save, 2) ? 1 : 0);

const kitItem = (save: SaveFile, id: string): boolean => save.pool.includes(id) && ITEM_LIST.includes(ITEMS[id]);

/** The hero's pinned items that can still be offered. */
export function pinsOf(save: SaveFile, heroIdx: number): string[] {
  return [...new Set(save.heroes[heroIdx].pins ?? [])].filter((id) => kitItem(save, id)).slice(0, pinSlots(save));
}

/**
 * Pins an item from the unlocked pool as one of the hero's signatures, or unpins it if it is pinned already.
 * With every pin slot taken the oldest pin makes way. `null` clears the pins. Returns false for an item that cannot be pinned.
 */
export function setPin(save: SaveFile, heroIdx: number, id: string | null): boolean {
  if (id && !kitItem(save, id)) return false;
  const cur = pinsOf(save, heroIdx);
  save.heroes[heroIdx].pins = !id ? [] : cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-pinSlots(save));
  trimKit(save, heroIdx);
  return true;
}

/** How many times the hero has re-rolled the offer for the coming run. */
export const rerollCount = (save: SaveFile, p: HeroProfile): number => (p.rerolls?.at === save.runsPlayed ? p.rerolls.n : 0);

/**
 * The starter gear a hero is offered before the next run, on top of their pinned item: two reusable
 * weapons, two other active items and two passives from the unlocked pool, so every slot can be filled.
 * Where the pool is short of a role the place goes to any other item. Wider Offer adds one more, of any role,
 * and so does the save's first clear of any map on tier 3.
 * Items discovered since the last run started are offered first.
 * The draw depends only on the save, the run number, the hero and their re-rolls, so it stays the same
 * until a run starts and reloading cannot change it. Listed role by role.
 */
export function kitOffer(save: SaveFile, heroIdx: number): string[] {
  const p = save.heroes[heroIdx];
  const rng = seeded(save.created >>> 0, `kit:${save.runsPlayed}:${heroIdx}:${rerollCount(save, p)}`);
  const pool = save.pool.filter((id) => ITEM_LIST.includes(ITEMS[id]));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const fresh = save.fresh ?? [];
  pool.sort((a, b) => Number(fresh.includes(b)) - Number(fresh.includes(a))); // stable: the shuffle decides the rest
  // The pins are left out after the shuffle, not before it, so changing a pin cannot redraw the whole offer.
  const pins = pinsOf(save, heroIdx);
  const queue = pool.filter((id) => !pins.includes(id));
  const out: string[] = [];
  for (const { role, offers } of KIT_ROLES) out.push(...queue.filter((id) => kitRole(ITEMS[id]) === role).slice(0, offers));
  const size = KIT_OFFER_SIZE + (lvl(p, 'wider') > 0 ? 1 : 0) + (everCleared(save, 3) ? 1 : 0);
  for (const id of queue) if (out.length < size && !out.includes(id)) out.push(id);
  const order = (id: string) => KIT_ROLES.findIndex((r) => r.role === kitRole(ITEMS[id])) * 1000 + ITEM_LIST.indexOf(ITEMS[id]);
  return out.sort((a, b) => order(a) - order(b));
}

/** Everything the hero may put in their kit for the coming run: their pinned items, then the offer. */
export const kitChoices = (save: SaveFile, heroIdx: number): string[] => [...pinsOf(save, heroIdx), ...kitOffer(save, heroIdx)];

/** Removes from the hero's chosen kit anything they can no longer choose, any duplicate, and whatever their Prowess cannot cover. */
export function trimKit(save: SaveFile, heroIdx: number): void {
  const choices = kitChoices(save, heroIdx);
  const p = save.heroes[heroIdx];
  const seen = new Set<string>();
  p.kit = [0, 1, 2, 3].map((i) => {
    const id = p.kit[i];
    if (!id || !choices.includes(id) || seen.has(id) || (ITEMS[id].slot === 'passive') !== (i === 3)) return null;
    seen.add(id);
    return id;
  });
  for (let i = 3; i >= 0 && kitCost(p) > prowess(p); i--) p.kit[i] = null;
}

export const REROLL_BASE = 10; // renown for the first paid re-roll; each one after it costs double

/**
 * Renown for the hero's next re-roll of the coming run's offer: 10, 20, 40 and so on, starting again
 * at 10 for the run after. Second Look makes the first one free. Each Quartermaster level takes 15% off.
 */
export function rerollPrice(save: SaveFile, heroIdx: number): number {
  const p = save.heroes[heroIdx];
  const paid = rerollCount(save, p) - (lvl(p, 'look') > 0 ? 1 : 0);
  return paid < 0 ? 0 : Math.ceil((REROLL_BASE * 2 ** paid * (100 - 15 * lvl(p, 'quarter'))) / 100);
}

/** Why the hero cannot re-roll their offer right now, or null when they can. */
export function rerollBlock(save: SaveFile, heroIdx: number): 'running' | 'same' | 'cost' | null {
  if (save.run) return 'running';
  const others = save.pool.filter((id) => kitItem(save, id)).length - pinsOf(save, heroIdx).length;
  if (others <= kitOffer(save, heroIdx).length) return 'same'; // everything unlocked is already on offer
  return rerollPrice(save, heroIdx) > save.heroes[heroIdx].renown ? 'cost' : null;
}

/** Swaps the hero's offer for a new draw, for renown. Anything chosen that is no longer on offer leaves the kit; a pinned item stays. */
export function rerollKit(save: SaveFile, heroIdx: number): boolean {
  if (rerollBlock(save, heroIdx)) return false;
  const p = save.heroes[heroIdx];
  p.renown -= rerollPrice(save, heroIdx);
  p.rerolls = { at: save.runsPlayed, n: rerollCount(save, p) + 1 };
  trimKit(save, heroIdx);
  return true;
}

export type KitToggle = 'added' | 'removed' | 'full' | 'cost' | 'running' | 'none';

/**
 * Puts an offered or pinned item into the hero's kit, or takes it out again. Passives replace the current passive.
 * Nothing can be added while a run is in progress: a kit is handed out when a run starts, not when one resumes.
 */
export function toggleKitItem(save: SaveFile, heroIdx: number, id: string): KitToggle {
  const p = save.heroes[heroIdx];
  const at = p.kit.indexOf(id);
  if (at >= 0) {
    p.kit[at] = null;
    return 'removed';
  }
  if (save.run) return 'running';
  const def = ITEMS[id];
  if (!def || !kitChoices(save, heroIdx).includes(id)) return 'none';
  const slot = def.slot === 'passive' ? 3 : p.kit.findIndex((k, i) => i < 3 && !k);
  if (slot < 0) return 'full';
  const refund = p.kit[slot] ? kitPrice(p.kit[slot]!) : 0;
  if (kitCost(p) - refund + kitPrice(id) > prowess(p)) return 'cost';
  p.kit[slot] = id;
  return 'added';
}

/** Adds an item to the save's unlocked pool. A new one is guaranteed a place in the next starter kit offers. Returns false if it was known. */
export function discoverItem(save: SaveFile, id: string): boolean {
  if (save.pool.includes(id)) return false;
  save.pool.push(id);
  (save.fresh ??= []).push(id);
  return true;
}

// ---------------------------------------------------------------- difficulty tiers

/** The tier a run is played on. */
export const runTier = (run: RunState): number => tierDef(run.tier).tier;

/** How often the save has cleared a map on a tier. Saves from before tiers cleared everything on tier 1. */
export function tierClears(save: SaveFile, mapId: string, tier: number): number {
  const k = save.knowledge[mapId];
  if (!k) return 0;
  return k.tierClears?.[tier - 1] ?? (tier === 1 && !k.tierClears ? k.clears : 0);
}

/** Tier 1 of a map is open with the map. Each higher tier opens when the tier below it is cleared on that map. */
export const tierUnlocked = (save: SaveFile, mapId: string, tier: number): boolean =>
  tier >= 1 && tier <= TIER_COUNT && (tier === 1 || tierClears(save, mapId, tier - 1) > 0);

/** True once the save has cleared any map on this tier. */
export const everCleared = (save: SaveFile, tier: number): boolean => Object.keys(save.knowledge).some((id) => tierClears(save, id, tier) > 0);

/**
 * Starts a run for the chosen heroes (in turn order) on a tier; a tier that is not open yet plays as tier 1.
 * Hands each hero the starter kit their Prowess covers, and the starter weapon: it goes in the first active
 * slot the kit left empty, or the pack when there is none.
 */
export function createRun(save: SaveFile, heroIdxs: number[], mapId: string, tier = 1): RunState {
  const heroes: RunHero[] = heroIdxs.map((profile) => {
    const p = save.heroes[profile];
    trimKit(save, profile);
    const kit = p.kit;
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
    giveItem(rh, newStack(STARTER_WEAPON));
    rh.hp = heroStats(save, rh).maxHp;
    return rh;
  });
  const bonusLives = heroIdxs.reduce((n, i) => n + lvl(save.heroes[i], 'wind'), 0);
  save.runsPlayed++;
  save.fresh = []; // the offers for this run were the ones that showed off the last run's discoveries
  // Cartographer: a party with one starts with everything earlier parties explored on this map
  const charted = heroIdxs.some((i) => lvl(save.heroes[i], 'carto') > 0) ? (save.knowledge[mapId]?.explored ?? '') : '';
  return {
    mapId,
    tier: tierUnlocked(save, mapId, tier) ? tier : 1,
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

/** What the save remembers about a map, started empty the first time it is asked for. */
export function knowledgeOf(save: SaveFile, mapId: string): MapKnowledge {
  return (save.knowledge[mapId] ??= { secrets: [], prizes: [], shortcuts: [], bestCheckpoint: 0, clears: 0 });
}

/**
 * A secret pays its prize, the item on its pedestal, only the first time a save takes it.
 * In later runs the pedestal stands empty and the secret holds whatever else is in the room.
 */
export const prizeTaken = (save: SaveFile, mapId: string, secret: string): boolean => !!save.knowledge[mapId]?.prizes?.includes(secret);

export function takePrize(save: SaveFile, mapId: string, secret: string): void {
  const k = knowledgeOf(save, mapId);
  if (!(k.prizes ??= []).includes(secret)) k.prizes.push(secret);
}

/**
 * The item on a pedestal: the one the map names, or on a prize pedestal a rare or better item from the
 * unlocked pool (the best there is, in a pool without one). The pick depends only on the run and the pool.
 */
export function pedestalItem(run: RunState, save: SaveFile, o: MapObject): string {
  if (o.item) return o.item;
  const pool = save.pool.map((id) => ITEMS[id]).filter((d) => ITEM_LIST.includes(d));
  const cands = pool.length ? pool : ITEM_LIST;
  const top = Math.min(2, Math.max(...cands.map((d) => d.rarity)));
  return seeded(run.seed, 'prize:' + o.id).pick(cands.filter((d) => d.rarity >= top)).id;
}

export const hasFlag = (run: RunState, f: string) => run.flags.includes(f);
export function setFlag(run: RunState, f: string): void {
  if (!run.flags.includes(f)) run.flags.push(f);
}

export function advanceTurn(run: RunState): void {
  run.active = (run.active + 1) % run.heroes.length;
}

// ---------------------------------------------------------------- falling, rescue and rest

/** How close (px) a hero must come to a fallen hero to save them. Wide enough to reach one lying under a shut gate or a reset block. */
export const RESCUE_REACH = 18;
/** Share of max HP a hero gets as comeback health on the turn after they die. */
export const COMEBACK_SHARE = 0.25;
/** A campfire brings every hero up to at least this share of their max HP. */
export const CAMP_REST_SHARE = 0.5;

export const comebackHp = (maxHp: number) => Math.ceil(maxHp * COMEBACK_SHARE);

/**
 * The active hero has died at (x, y). They come back next turn at full health with comeback health on top.
 * With nobody waiting for rescue, their life is held at risk where they fell instead of being spent.
 * A hero who dies while another is waiting loses both lives, and leaves no one to rescue.
 * Returns true when the run is over.
 */
export function heroFell(save: SaveFile, run: RunState, x: number, y: number): boolean {
  const rh = run.heroes[run.active];
  const max = heroStats(save, rh).maxHp;
  rh.deaths++;
  rh.hp = max;
  rh.bonusHp = comebackHp(max);
  if (run.fallen) {
    run.fallen = null;
    const left = run.lives - 1;
    run.lives = Math.max(0, left);
    return left <= 0;
  }
  if (run.lives <= 0) return true;
  run.lives--;
  run.fallen = { hero: run.active, x: Math.round(x), y: Math.round(y) };
  return false;
}

/** A hero has reached the fallen one: the life held at risk returns to the party. Returns who was saved. */
export function rescueFallen(run: RunState): number | null {
  const f = run.fallen;
  if (!f) return null;
  run.fallen = null;
  run.lives++;
  return f.hero;
}

/** The party reaches a campfire: the arriving hero's comeback health ends, and everyone rests up to half health. */
export function campRest(save: SaveFile, run: RunState): void {
  run.heroes[run.active].bonusHp = 0;
  for (const rh of run.heroes) rh.hp = Math.max(rh.hp, Math.ceil(heroStats(save, rh).maxHp * CAMP_REST_SHARE));
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

/** How likely each rarity (common, uncommon, rare, legendary) is in each kind of chest or shop place. Higher difficulty tiers lean rarer. */
const LOOT_WEIGHTS: Record<LootTier, number[]>[] = [
  { weapon: [1, 0, 0, 0], common: [8, 2, 0, 0], good: [3, 6, 1, 0], rare: [0, 5, 5, 1] },
  { weapon: [3, 2, 0, 0], common: [6, 3, 1, 0], good: [2, 6, 2, 0], rare: [0, 4, 6, 2] },
  { weapon: [2, 3, 1, 0], common: [4, 4, 2, 0], good: [1, 5, 4, 1], rare: [0, 2, 8, 4] },
];

function rollItem(rng: Rng, pool: string[], tier: LootTier, difficulty: number): string {
  const weights = LOOT_WEIGHTS[difficulty - 1] ?? LOOT_WEIGHTS[0];
  let cands = pool.map((id) => ITEMS[id]).filter((d) => ITEM_LIST.includes(d));
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
  return { item: newStack(rollItem(rng, save.pool, tier, runTier(run))), gold };
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
    let id = rollItem(rng, save.pool, tier, runTier(run));
    for (let tries = 0; tries < 6 && seen.has(id); tries++) id = rollItem(rng, save.pool, tier, runTier(run));
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
  tier: number;
  /** What a first clear opened for the whole save: the next tier, a second pin, a wider offer. Ready to show. */
  opened: string[];
  /** `feats` are the achievements that raised the hero's Prowess this run; `prowess` is what they have now. */
  rows: { name: string; color: number; gold: number; bonus: number; total: number; feats: string[]; prowess: number }[];
  checkpoint: number;
  secrets: number;
  kills: number;
  unlockedItems: string[];
}

/**
 * The achievements that raise Prowess, each once per hero: the key starts a feat id such as 'half:map1'.
 * The halfway campfire and the clear without falling count once per map; a clear counts once per map and tier ('clear:map1:2').
 */
export const FEATS = {
  half: 'Reached the halfway campfire',
  deathless: 'Cleared it without falling',
};
export const clearFeat = (tier: number): string => `Cleared the map on ${tierDef(tier).name}`;

/** The feats a hero has not earned yet and could earn by playing this map on this tier. */
export function featsOpen(p: HeroProfile, mapId: string, tier: number): number {
  return [`half:${mapId}`, `clear:${mapId}:${tier}`, `deathless:${mapId}`].filter((id) => !p.feats?.includes(id)).length;
}

/**
 * Ends the run: converts gold and bonuses to renown, raises Prowess for first-time achievements and
 * clears the run from the save. `halfway` is the map's halfway campfire.
 */
export function finishRun(save: SaveFile, won: boolean, unlockedItems: string[], halfway = Infinity): RunSummary {
  const run = save.run!;
  const tier = runTier(run);
  const rows = run.heroes.map((rh) => {
    const p = save.heroes[rh.profile];
    const bonus = rh.earned + (won ? tierDef(tier).clearBonus : 0);
    const gold = Math.max(0, rh.gold - (rh.startGold ?? 0)); // Pocket Change gold is for spending, not banking
    p.renown += gold + bonus;
    const feats: string[] = [];
    const earn = (id: string, label: string) => {
      if (p.feats?.includes(id)) return;
      (p.feats ??= []).push(id);
      feats.push(label);
    };
    if (won || run.checkpoint >= halfway) earn(`half:${run.mapId}`, FEATS.half);
    if (won) earn(`clear:${run.mapId}:${tier}`, clearFeat(tier));
    if (won && rh.deaths === 0) earn(`deathless:${run.mapId}`, FEATS.deathless);
    return { name: p.name, color: p.color, gold, bonus, total: gold + bonus, feats, prowess: prowess(p) };
  });
  const k = knowledgeOf(save, run.mapId);
  k.bestCheckpoint = Math.max(k.bestCheckpoint, run.checkpoint);
  k.explored = mergeBits(k.explored ?? '', run.explored);
  const opened: string[] = [];
  if (won) {
    const before = { next: tierUnlocked(save, run.mapId, tier + 1), pins: pinSlots(save), wide: everCleared(save, 3) };
    const per = (k.tierClears ??= [k.clears]); // a save from before tiers made all its clears on tier 1
    while (per.length < TIER_COUNT) per.push(0);
    per[tier - 1]++;
    k.clears++;
    if (!before.next && tierUnlocked(save, run.mapId, tier + 1)) opened.push(`The ${TIERS[tier].name} tier of this map is open.`);
    if (pinSlots(save) > before.pins) opened.push('Every hero may now pin a second signature item.');
    if (!before.wide && everCleared(save, 3)) opened.push('Every starter kit offer now holds one more item.');
  }
  const summary: RunSummary = { won, tier, opened, rows, checkpoint: run.checkpoint, secrets: run.secretsFound, kills: run.kills, unlockedItems };
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
