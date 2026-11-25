// Permanent upgrades, bought per hero with renown. They form four paths; an upgrade opens
// once the one it grows from has reached the level in `needs`.

export type UpgradePath = 'body' | 'arms' | 'scout' | 'trade';

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string; // effect of one level, short enough for one line on the Upgrades screen
  more?: string; // the same in full, shown when pointing at the upgrade
  path: UpgradePath;
  costs: number[]; // renown per level
  needs?: { id: string; level: number };
}

export const PATHS: { id: UpgradePath; name: string; blurb: string }[] = [
  { id: 'body', name: 'Body', blurb: 'Staying alive' },
  { id: 'arms', name: 'Arms', blurb: 'Weapons and ammo' },
  { id: 'scout', name: 'Scout', blurb: 'Moving and finding' },
  { id: 'trade', name: 'Trade', blurb: 'Gold and gear' },
];

/** Listed path by path, each upgrade after the one it grows from. The Upgrades screen shows them in this order. */
export const UPGRADES: UpgradeDef[] = [
  { id: 'vit', path: 'body', name: 'Vitality', desc: '+4 max HP', costs: [25, 45, 70, 100, 140] },
  { id: 'hearty', path: 'body', name: 'Hearty', desc: 'Hearts heal +1 HP', costs: [30, 55, 85], needs: { id: 'vit', level: 1 } },
  { id: 'thick', path: 'body', name: 'Thick Skin', desc: '+0.15s hit safety', more: 'Stay invulnerable for 0.15 seconds longer after being hit.', costs: [40, 70, 110], needs: { id: 'vit', level: 2 } },
  { id: 'trap', path: 'body', name: 'Trap Sense', desc: '-1 trap damage', more: 'Spikes and arrow traps deal 1 less damage, never less than 1.', costs: [50, 90], needs: { id: 'thick', level: 1 } },
  { id: 'wind', path: 'body', name: 'Second Wind', desc: '+1 party life', more: 'The party starts each run with one more shared life.', costs: [60, 140], needs: { id: 'vit', level: 3 } },

  { id: 'might', path: 'arms', name: 'Might', desc: '+15% damage', costs: [30, 50, 80, 115, 160] },
  { id: 'heavy', path: 'arms', name: 'Heavy Blows', desc: '+25% knockback', more: 'Melee hits push monsters back 25% further.', costs: [30, 60], needs: { id: 'might', level: 1 } },
  { id: 'slayer', path: 'arms', name: 'Giant Slayer', desc: '+10% vs bosses', more: '+10% damage to bosses and to monster dens and nests.', costs: [60, 100, 150], needs: { id: 'heavy', level: 2 } },
  { id: 'quick', path: 'arms', name: 'Quick Hands', desc: '-6% cooldowns', costs: [45, 80, 125], needs: { id: 'might', level: 2 } },
  { id: 'packrat', path: 'arms', name: 'Packrat', desc: '+20% item uses', more: 'Knives, bombs and scrolls come with 20% more uses.', costs: [30, 55, 85], needs: { id: 'might', level: 1 } },
  { id: 'quiver', path: 'arms', name: 'Deep Quiver', desc: '+12 arrows', more: 'A new bow holds 12 more arrows, and arrow piles drop a little more often.', costs: [40, 70, 105], needs: { id: 'packrat', level: 1 } },

  { id: 'swift', path: 'scout', name: 'Swiftness', desc: '+5% move speed', costs: [30, 60, 100] },
  { id: 'reach', path: 'scout', name: 'Long Reach', desc: 'Wider pickup pull', more: 'Coins, hearts and arrows fly to the hero from further away.', costs: [30, 55], needs: { id: 'swift', level: 1 } },
  { id: 'ambush', path: 'scout', name: 'Opening Strike', desc: '+25% ambush', more: '+25% damage to monsters that have not noticed the hero yet.', costs: [50, 90], needs: { id: 'swift', level: 2 } },
  { id: 'eyes', path: 'scout', name: 'Keen Eyes', desc: '+1 light radius', costs: [20, 40, 70] },
  { id: 'nose', path: 'scout', name: 'Treasure Nose', desc: 'Chime near secrets', more: 'A chime sounds when an undiscovered secret is within 7 tiles.', costs: [80], needs: { id: 'eyes', level: 2 } },
  { id: 'carto', path: 'scout', name: 'Cartographer', desc: 'Keeps old maps', more: 'The party starts with everything explored on this map in earlier runs.', costs: [120], needs: { id: 'eyes', level: 3 } },

  { id: 'fortune', path: 'trade', name: 'Fortune', desc: '+15% gold found', costs: [25, 50, 90] },
  { id: 'pocket', path: 'trade', name: 'Pocket Change', desc: '+15 starting gold', more: 'Start each run with 15 more gold. It can be spent but never turns into renown.', costs: [30, 55, 85], needs: { id: 'fortune', level: 1 } },
  { id: 'haggle', path: 'trade', name: 'Haggler', desc: '-8% shop prices', costs: [40, 70, 110], needs: { id: 'fortune', level: 2 } },
  { id: 'quarter', path: 'trade', name: 'Quartermaster', desc: '-10% kit cost', more: 'Starter kits cost 10% less renown.', costs: [35, 60, 95], needs: { id: 'fortune', level: 1 } },
  { id: 'wider', path: 'trade', name: 'Wider Offer', desc: 'Fifth kit offer', more: 'One more item to choose from in every starter kit offer.', costs: [110], needs: { id: 'quarter', level: 2 } },
  { id: 'look', path: 'trade', name: 'Second Look', desc: 'Kit re-roll', more: 'Once per run, swap the starter kit offer for a new draw.', costs: [130], needs: { id: 'wider', level: 1 } },
];

export const UPGRADE: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

/** How many steps an upgrade sits below the start of its path. */
export function upgradeDepth(id: string): number {
  let depth = 0;
  for (let u = UPGRADE[id]; u?.needs; u = UPGRADE[u.needs.id]) depth++;
  return depth;
}
