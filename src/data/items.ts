import { IC } from '../art/manifest';

export type ItemSlot = 'active' | 'passive';
export type ItemCat = 'offensive' | 'defensive' | 'utility';

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  slot: ItemSlot;
  cat: ItemCat;
  rarity: 0 | 1 | 2; // common, uncommon, rare
  icon: IC;
  cooldown: number; // ms
  charges?: number; // limited use when set
  ammo?: boolean; // charges are ammunition: the item is kept at zero and refills from pickups
  hold?: boolean; // works while the button is held
  price: number; // merchant gold
  kit: number; // renown to start a run with it
  starter: boolean; // in the item pool of a brand-new save
}

export const RARITY_NAMES = ['Common', 'Uncommon', 'Rare'];

const defs: ItemDef[] = [
  // Offensive
  { id: 'fists', name: 'Fists', desc: 'Your bare hands. Short reach, quick jabs.', slot: 'active', cat: 'offensive', rarity: 0, icon: IC.Fists, cooldown: 320, price: 0, kit: 0, starter: false },
  { id: 'club', name: 'Club', desc: 'A heavy swing that knocks foes back.', slot: 'active', cat: 'offensive', rarity: 0, icon: IC.Club, cooldown: 480, price: 30, kit: 15, starter: true },
  { id: 'sword', name: 'Sword', desc: 'Fast, wide slashes.', slot: 'active', cat: 'offensive', rarity: 1, icon: IC.Sword, cooldown: 380, price: 70, kit: 35, starter: false },
  { id: 'spear', name: 'Spear', desc: 'A long thrust that pierces everything in a line.', slot: 'active', cat: 'offensive', rarity: 1, icon: IC.Spear, cooldown: 520, price: 60, kit: 30, starter: true },
  { id: 'bow', name: 'Bow', desc: 'Looses arrows toward the cursor. Comes with 120 arrows; monsters sometimes drop more while it is equipped.', slot: 'active', cat: 'offensive', rarity: 0, icon: IC.Bow, cooldown: 620, charges: 120, ammo: true, price: 35, kit: 18, starter: true },
  { id: 'knives', name: 'Throwing Knives', desc: 'Very fast to throw. Limited supply.', slot: 'active', cat: 'offensive', rarity: 0, icon: IC.Knives, cooldown: 220, charges: 14, price: 20, kit: 10, starter: true },
  { id: 'firebolt', name: 'Fire Bolt', desc: 'A blast of flame that bursts on impact and lights braziers.', slot: 'active', cat: 'offensive', rarity: 1, icon: IC.Firebolt, cooldown: 1100, price: 80, kit: 40, starter: false },
  { id: 'frost', name: 'Frost Nova', desc: 'Freezes everything around you for a few seconds.', slot: 'active', cat: 'offensive', rarity: 2, icon: IC.Frost, cooldown: 4200, price: 110, kit: 55, starter: false },
  { id: 'bombs', name: 'Bombs', desc: 'Thrown, then explode. Break cracked walls. Limited supply.', slot: 'active', cat: 'offensive', rarity: 0, icon: IC.Bombs, cooldown: 900, charges: 5, price: 25, kit: 12, starter: true },
  { id: 'cleaver', name: "Chief's Cleaver", desc: 'A brutal, slow cleave with huge knockback.', slot: 'active', cat: 'offensive', rarity: 2, icon: IC.Cleaver, cooldown: 680, price: 120, kit: 60, starter: false },
  // Defensive
  { id: 'shield', name: 'Shield', desc: 'Hold to block attacks from the direction of the cursor. Slows you while raised.', slot: 'active', cat: 'defensive', rarity: 0, icon: IC.Shield, cooldown: 0, hold: true, price: 30, kit: 15, starter: true },
  { id: 'dash', name: 'Dash Boots', desc: 'A quick dash that passes through danger and over gaps.', slot: 'active', cat: 'defensive', rarity: 1, icon: IC.DashBoots, cooldown: 1500, price: 70, kit: 35, starter: false },
  { id: 'armour', name: 'Leather Armour', desc: 'Passive. Take a quarter less damage.', slot: 'passive', cat: 'defensive', rarity: 0, icon: IC.Armour, cooldown: 0, price: 40, kit: 20, starter: true },
  { id: 'vigor', name: 'Vigor Ring', desc: 'Passive. +8 maximum HP.', slot: 'passive', cat: 'defensive', rarity: 2, icon: IC.VigorRing, cooldown: 0, price: 100, kit: 50, starter: false },
  // Utility
  { id: 'lantern', name: 'Lantern', desc: 'Passive. See much further through the dark.', slot: 'passive', cat: 'utility', rarity: 0, icon: IC.Lantern, cooldown: 0, price: 30, kit: 15, starter: true },
  { id: 'magnet', name: 'Magnet Charm', desc: 'Passive. Pulls in coins and hearts, and finds a fifth more gold.', slot: 'passive', cat: 'utility', rarity: 1, icon: IC.Magnet, cooldown: 0, price: 50, kit: 25, starter: true },
  { id: 'scroll', name: 'Reveal Scroll', desc: 'Reveals the map far around you. Limited supply.', slot: 'active', cat: 'utility', rarity: 0, icon: IC.Scroll, cooldown: 1500, charges: 3, price: 20, kit: 10, starter: true },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(defs.map((d) => [d.id, d]));
export const ITEM_LIST = defs.filter((d) => d.id !== 'fists');
export const STARTER_POOL = defs.filter((d) => d.starter).map((d) => d.id);

/** A weapon that never leaves the hero's hands: unlimited use, or ammunition that can be refilled. */
export const isLastingWeapon = (d: ItemDef): boolean => d.slot === 'active' && d.cat === 'offensive' && (!d.charges || !!d.ammo);

export function newStack(id: string) {
  const d = ITEMS[id];
  return d.charges ? { id, charges: d.charges } : { id };
}
