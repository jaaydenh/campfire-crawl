// Map 1: Whispering Woods into the Bandit Cave. Six sections, five campfires, one mini-boss.
// b.spawn places a monster on every difficulty tier; b.extra(2, ...) and b.extra(3, ...) add to the packs from that tier up.
// The den and the nest are only there from tier 2: on tier 1 a wolf and a spider stand in their place.
// Each tier has its own secrets. The shared layout is built the same way for every tier (so the random
// ground and clearing shapes match); what differs between tiers is added or sealed at the end.
import { O, T } from '../art/manifest';
import { MapBuilder, type MapDef, type Zone } from '../world/mapdef';

const W = 150;
const H = 100;

const zone = (x: number, y: number): Zone => (y >= 66 || (x >= 74 && y >= 56) || (x >= 88 && y >= 46) ? 'cave' : 'forest');

export function buildMap1(tier = 1): MapDef {
  const b = new MapBuilder(W, H, zone, 20261124);
  const t1 = tier === 1;

  // ---------- Section 1: the edge of the woods ----------
  b.section(0);
  b.blob(12, 50, 6, 5);
  b.checkpoints[0] = { x: 10, y: 50 };
  b.obj('sign', 9, 47, { text: 'WASD to move. Aim with the mouse. Left click, right click and Space use your three slots. E interacts. Tab opens your pack. M shows the map.' });
  b.obj('npc', 15, 47, {
    name: 'Old Hermit',
    sprite: 0,
    lines: [
      "Another one heading for the Chief's cave? With your bare hands?",
      "Listen. You will fall. Everyone does. But the gold you carried buys you something back at camp, and the next attempt goes further.",
      'Wolves crouch before they lunge. Step aside, then hit them while they catch their breath.',
      'And poke at anything that looks wrong: cracked rock, a crooked torch. The bandits hid their best loot.',
    ],
  });
  b.path([[12, 50], [26, 50], [32, 44], [34, 42]], 3);
  b.blob(34, 42, 6, 5);
  b.rect(36, 38, 38, 39);
  b.rect(37, 44, 38, 45, T.Water);
  b.obj('chest', 37, 38, { loot: 'weapon' });
  b.obj('pot', 30, 41);
  b.obj('pot', 31, 45);
  b.obj('pot', 39, 41);
  b.decor(O.Stump, 33, 39, true);
  b.spawn(21, 50, 'slime');
  b.spawn(27, 49, 'slime');
  b.spawn(33, 43, 'slime');
  b.spawn(36, 41, 'slime', 'slime', 'wolf');
  b.spawn(32, 41, 'slime');
  b.extra(2, 24, 50, 'wolf');
  b.extra(3, 18, 50, 'wolf');
  // a side grove with a guarded chest
  b.path([[26, 50], [27, 56], [27, 60]], 2);
  b.blob(27, 60, 4, 3);
  b.obj('chest', 29, 61, { loot: 'common' });
  b.obj('pot', 25, 60);
  b.spawn(27, 59, 'wolf');
  b.path([[34, 42], [44, 40], [52, 40]], 3);
  b.spawn(43, 40, 'wolf', 'wolf', 'slime');
  b.spawn(46, 41, 'wolf');
  b.extra(3, 48, 40, 'archer');
  b.blob(52, 40, 5, 4);
  b.campfire(1, 52, 40);

  // ---------- Section 2: the weighted gate ----------
  b.section(1);
  b.path([[52, 40], [60, 34], [66, 30], [70, 28]], 3);
  b.spawn(59, 35, 'wolf', 'slime');
  b.spawn(63, 32, 'slime');
  b.spawn(65, 31, 'slime', 'wolf');
  b.extra(2, 56, 37, 'wolf');
  b.extra(3, 70, 30, 'bandit');
  b.blob(70, 28, 7, 5);
  b.rect(68, 23, 72, 25);
  b.rect(77, 20, 79, 36, T.Tree);
  b.rect(77, 28, 79, 28, T.Dirt);
  b.obj('gate', 78, 28, { puzzle: 'log' });
  b.obj('plate', 73, 30, { puzzle: 'log' });
  b.obj('block', 67, 27, { puzzle: 'log' });
  b.obj('sign', 75, 26, { text: 'The gate answers to weight. The old stone is heavy enough. (Press E on the stone to send it back where it stood.)' });
  // secret 1: a hidden grove behind cracked rock
  b.rect(66, 16, 74, 22, T.CaveWall);
  b.rect(67, 17, 73, 21);
  b.set(70, 22, T.Cracked);
  if (t1) {
    b.obj('pedestal', 70, 18, { item: 'longsword', secret: 's1' });
    b.obj('chest', 68, 18, { loot: 'good' });
    b.obj('pot', 72, 18);
    b.obj('pot', 72, 20);
    b.obj('secret', 67, 17, { secret: 's1', w: 7, h: 5 });
  }
  b.path([[80, 28], [86, 24], [90, 22], [92, 21]], 3);
  b.spawn(84, 25, 'bandit');
  b.spawn(87, 24, 'bandit', 'archer');
  b.extra(2, 82, 27, 'archer');
  b.blob(92, 21, 5, 4);
  b.campfire(2, 92, 21, true);

  // ---------- Section 3: the bandit camp ----------
  b.section(2);
  b.path([[92, 21], [102, 20], [108, 22], [114, 24]], 3);
  b.spawn(103, 20, 'wolf');
  b.blob(114, 24, 8, 6);
  b.decor(O.Tent, 111, 21, true);
  b.decor(O.Tent, 117, 21, true);
  b.decor(O.Crate, 119, 26, true);
  b.decor(O.Barrel, 109, 26, true);
  b.obj('pot', 110, 22);
  b.obj('pot', 118, 27);
  b.spawn(112, 24, 'bandit');
  b.spawn(116, 23, 'bandit');
  b.spawn(118, 23, 'archer');
  b.spawn(114, 27, 'bandit', 'archer');
  b.extra(2, 110, 24, 'archer');
  b.extra(3, 114, 22, 'bandit');
  // the wolf den holds the key
  b.path([[112, 19], [112, 13]], 2);
  b.blob(112, 12, 5, 3);
  b.spawn(109, 12, 'den');
  b.spawn(112, 12, 'wolf');
  b.extra(2, 113, 13, 'wolf');
  b.extra(3, 111, 11, 'wolf');
  b.obj('chest', 115, 11, { loot: 'key:red' });
  // cave mouth
  b.path([[116, 29], [120, 34], [120, 37]], 3);
  b.rect(112, 39, 128, 45, T.CaveWall);
  b.rect(120, 38, 120, 40, T.Dirt);
  b.rect(120, 41, 120, 45, T.CaveFloor);
  b.obj('door', 120, 41, { key: 'red' });
  b.set(118, 37);
  b.obj('sign', 118, 37, { text: "BANDIT TERRITORY. Chief's orders: no key, no entry. (The dogs have the key.)" });
  b.rect(114, 46, 126, 53);
  b.campfire(3, 120, 49);

  // ---------- Section 4: the upper cave ----------
  b.section(3);
  b.obj('sign', 116, 47, { text: "A note nailed to the wall: 'For the thick-skulled: light the vault fires SUNWISE, starting in the WEST.'" });
  b.rect(120, 54, 121, 58);
  b.rect(112, 59, 128, 68);
  b.spawn(115, 62, 'bat');
  b.spawn(124, 61, 'bat');
  b.spawn(120, 66, 'bat', 'spider');
  b.spawn(125, 66, 'spider');
  b.spawn(114, 66, 'spider', 'bat');
  b.extra(2, 120, 62, 'spider');
  b.extra(3, 117, 65, 'nest');
  b.decor(O.Mushroom, 113, 60);
  b.decor(O.Bones, 126, 67);
  b.obj('sconce', 114, 58, { frame: O.Sconce });
  b.obj('sconce', 117, 58, { frame: O.Sconce });
  b.obj('sconce', 124, 58, { frame: O.Sconce });
  // secret 2: the crooked torch opens a wall
  b.obj('sconce', 127, 58, t1 ? { frame: O.SconceOdd, puzzle: 'torch' } : { frame: O.Sconce });
  if (t1) b.obj('hidden', 129, 63, { puzzle: 'torch' });
  b.rect(130, 61, 134, 65);
  if (t1) {
    b.obj('pedestal', 132, 62, { item: 'dash', secret: 's2' });
    b.obj('chest', 133, 64, { loot: 'good' });
    b.obj('secret', 130, 61, { secret: 's2', w: 5, h: 5 });
  }
  // spike corridor
  b.rect(104, 63, 111, 64);
  b.obj('spikes', 106, 63, { period: 2400, phase: 0 });
  b.obj('spikes', 106, 64, { period: 2400, phase: 0 });
  b.obj('spikes', 108, 63, { period: 2400, phase: 0.5, chance: 0.6 });
  b.obj('spikes', 108, 64, { period: 2400, phase: 0.5, chance: 0.6 });
  b.obj('spikes', 110, 63, { period: 2400, phase: 0 });
  b.obj('spikes', 110, 64, { period: 2400, phase: 0 });
  // the brazier vault
  b.rect(92, 58, 103, 69);
  b.obj('brazier', 94, 63, { puzzle: 'vault', order: 0 });
  b.obj('brazier', 98, 60, { puzzle: 'vault', order: 1 });
  b.obj('brazier', 101, 63, { puzzle: 'vault', order: 2 });
  b.obj('brazier', 98, 67, { puzzle: 'vault', order: 3 });
  b.spawn(96, 61, 'bat');
  b.spawn(100, 66, 'spider');
  b.spawn(95, 67, 'bat', 'spider');
  b.extra(2, 100, 61, 'bat');
  b.extra(3, 96, 65, 'spider');
  b.rect(88, 64, 91, 64);
  b.obj('gate', 90, 64, { puzzle: 'vault' });
  // a life shrine up a trapped side passage
  b.rect(98, 55, 98, 57);
  b.obj('spikes', 98, 56, { period: 1800, phase: 0.2 });
  b.rect(96, 51, 100, 54);
  b.obj('shrine', 98, 52);
  b.obj('pot', 96, 51);
  b.obj('pot', 100, 51);
  b.decor(O.Bones, 99, 54);
  // shortcut back to the cave mouth, opened from this side and kept open in later runs
  b.set(113, 50);
  b.obj('gate', 113, 50, { puzzle: 'shortcut', meta: true });
  b.rect(105, 50, 112, 50);
  b.rect(105, 51, 105, 56);
  b.rect(103, 56, 104, 56);
  b.set(103, 57);
  b.set(106, 56);
  b.obj('lever', 106, 56, { puzzle: 'shortcut', meta: true });
  // camp
  b.rect(78, 60, 87, 70);
  b.campfire(4, 83, 65, true);
  b.decor(O.Mushroom, 79, 61);

  // ---------- Section 5: the deep cave ----------
  b.section(4);
  b.rect(82, 71, 83, 75);
  b.rect(70, 76, 92, 86);
  b.rect(76, 76, 77, 82, T.Pit);
  // a lever on an island: only a thrown or shot weapon reaches it
  b.rect(89, 76, 89, 79, T.Pit);
  b.rect(90, 79, 92, 79, T.Pit);
  b.obj('lever', 91, 77, { puzzle: 'island' });
  b.set(93, 82);
  b.obj('gate', 93, 82, { puzzle: 'island' });
  b.rect(94, 80, 97, 84);
  b.obj('chest', 96, 82, { loot: 'rare' });
  b.obj('pot', 94, 80);
  b.obj('pot', 94, 84);
  b.obj('pot', 97, 80);
  b.spawn(88, 84, 'nest');
  b.spawn(85, 81, 'spider');
  b.spawn(80, 84, 'spider', 'bandit');
  b.spawn(86, 78, 'bat');
  b.spawn(79, 78, 'bat');
  b.spawn(73, 84, 'bandit');
  b.spawn(73, 79, 'archer');
  b.extra(2, 82, 79, 'spider');
  b.extra(3, 83, 83, 'bandit');
  b.decor(O.Bones, 84, 85);
  b.decor(O.Mushroom, 91, 86);
  // secret 3: across the gap
  b.set(75, 87, T.Pit);
  b.set(75, 88, T.Pit);
  b.rect(72, 89, 78, 93);
  if (t1) {
    b.obj('shrine', 73, 91);
    b.obj('pedestal', 77, 91, { item: 'frost', secret: 's3' });
    b.obj('secret', 72, 89, { secret: 's3', w: 7, h: 5 });
  }
  // the timed gate and its gauntlet
  b.obj('lever', 70, 78, { puzzle: 'gauntlet', timed: 7 });
  b.obj('sign', 71, 83, { text: 'The lever by the passage lifts the far gate, but not for long. Mind the darts.' });
  b.rect(62, 80, 69, 81);
  b.obj('gate', 62, 80, { puzzle: 'gauntlet' });
  b.obj('gate', 62, 81, { puzzle: 'gauntlet' });
  b.obj('arrowtrap', 64, 79, { dir: 0, period: 1500, phase: 0 });
  b.obj('arrowtrap', 66, 79, { dir: 0, period: 1500, phase: 0.33 });
  b.obj('arrowtrap', 68, 79, { dir: 0, period: 1500, phase: 0.66 });
  b.obj('spikes', 65, 80, { period: 2000, phase: 0.5, chance: 0.5 });
  b.obj('spikes', 65, 81, { period: 2000, phase: 0.5, chance: 0.5 });
  b.rect(50, 76, 61, 85);
  b.spawn(56, 78, 'bandit');
  b.spawn(55, 83, 'bandit', 'archer');
  b.spawn(52, 80, 'archer');
  b.extra(2, 57, 81, 'bandit');
  b.extra(3, 53, 77, 'archer');
  b.decor(O.Crate, 60, 76, true);
  b.decor(O.Barrel, 61, 85, true);
  b.obj('pot', 50, 76);
  b.obj('pot', 50, 85);
  b.obj('npc', 59, 84, {
    name: 'Captive',
    sprite: 0,
    lines: [
      "You're not one of them. Good. I can't walk, but I can talk.",
      'The Chief charges like a drunk ox. Put a pillar between you and he will crack his own skull on it.',
      'Break his guard three times. Each time, his men lose heart and yours gain it.',
    ],
  });
  b.rect(46, 80, 49, 81);
  b.rect(40, 77, 45, 84);
  b.campfire(5, 43, 80);

  // ---------- Section 6: the Chief's hall ----------
  b.section(5);
  b.rect(37, 80, 39, 81);
  b.rect(29, 76, 36, 85);
  b.spawn(33, 78, 'bandit');
  b.spawn(32, 83, 'bandit');
  b.spawn(30, 80, 'archer');
  b.extra(2, 34, 81, 'archer');
  b.extra(3, 31, 77, 'bandit');
  b.decor(O.Crate, 36, 76, true);
  b.decor(O.Crate, 35, 76, true);
  b.obj('pot', 29, 85);
  b.obj('pot', 36, 85);
  b.rect(25, 80, 28, 81);
  b.obj('gate', 27, 80, { puzzle: 'boss' });
  b.obj('gate', 27, 81, { puzzle: 'boss' });
  b.rect(5, 71, 24, 90);
  for (const [px, py] of [[9, 75], [19, 75], [9, 85], [19, 85]]) b.rect(px, py, px + 1, py + 1, T.CaveWall);
  b.obj('pot', 5, 71);
  b.obj('pot', 24, 71);
  b.obj('pot', 5, 90);
  b.obj('pot', 24, 90);
  b.decor(O.Bones, 15, 73);
  b.decor(O.Bones, 8, 88);

  if (!t1) {
    // tier 1's hiding places are solid rock on the higher tiers
    b.rect(67, 17, 73, 21, T.CaveWall);
    b.set(70, 22, T.CaveWall);
    b.rect(130, 61, 134, 65, T.CaveWall);
    b.set(75, 87, T.CaveWall);
    b.set(75, 88, T.CaveWall);
    b.rect(72, 89, 78, 93, T.CaveWall);
  }
  if (tier === 2) veteranSecrets(b);
  if (tier === 3) legendSecrets(b);

  b.finalize();
  return {
    id: 'map1',
    tier,
    number: 1,
    name: 'Whispering Woods',
    w: W,
    h: H,
    tiles: b.tiles,
    objects: b.objects,
    spawns: b.spawns,
    checkpoints: b.checkpoints,
    sectionNames: ['Edge of the Woods', 'The Weighted Gate', 'Bandit Camp', 'Upper Cave', 'Deep Cave', "The Chief's Hall"],
    boss: { type: 'chief', x: 13, y: 80, arena: { x0: 5, y0: 71, x1: 23, y1: 90 }, gate: 'boss' },
    secrets: SECRETS[tier - 1],
    clearUnlocks: CLEAR_UNLOCKS[tier - 1],
  };
}

const SECRETS = [
  [
    { id: 's1', name: 'The hidden grove' },
    { id: 's2', name: 'Behind the crooked torch' },
    { id: 's3', name: 'Across the gap' },
  ],
  [
    { id: 'v1', name: 'The slab in the rock' },
    { id: 'v2', name: 'Past the far lever' },
  ],
  [
    { id: 'l1', name: 'Beyond the cold brazier' },
    { id: 'l2', name: 'Behind the wolf den' },
  ],
];

/** What the Chief's first defeat on each tier adds to the item pool. */
const CLEAR_UNLOCKS = [['cleaver', 'vigor'], ['berserk'], ['kingsplitter']];

/** Tier 2, Veteran: two hiding places that tier 1 does not have. */
function veteranSecrets(b: MapBuilder): void {
  // v1: a slab in the rock east of the side grove. It slides away while the plate on the trail is held down,
  // and stays open once the stone from the grove is parked on the plate.
  b.section(0);
  b.rect(33, 57, 41, 63, T.CaveWall);
  b.rect(34, 58, 40, 62);
  b.rect(30, 60, 32, 60);
  b.obj('hidden', 33, 60, { puzzle: 'slab' });
  b.obj('plate', 28, 58, { puzzle: 'slab' });
  b.obj('block', 26, 61, { puzzle: 'slab' });
  b.obj('pedestal', 38, 60, { item: 'ember', secret: 'v1' });
  b.obj('chest', 36, 58, { loot: 'good' });
  b.obj('pot', 40, 58);
  b.obj('pot', 40, 62);
  b.obj('secret', 34, 58, { secret: 'v1', w: 7, h: 5 });
  // v2: a lever across a pit on the south side of the upper cave. Only something thrown or shot reaches it;
  // it opens the cave's west wall.
  b.section(3);
  b.set(116, 69, T.Pit);
  b.set(116, 70, T.Pit);
  b.set(116, 71);
  b.obj('lever', 116, 71, { puzzle: 'farlever' });
  b.rect(105, 66, 110, 68);
  b.obj('hidden', 111, 67, { puzzle: 'farlever' });
  b.obj('pedestal', 106, 67, { prize: true, secret: 'v2' });
  b.obj('chest', 108, 66, { loot: 'rare' });
  b.obj('pot', 105, 66);
  b.obj('pot', 105, 68);
  b.obj('secret', 105, 66, { secret: 'v2', w: 6, h: 3 });
}

/** Tier 3, Legend: two more, in places of their own. */
function legendSecrets(b: MapBuilder): void {
  // l1: a cold brazier across a pit in the deep cave's north wall. Only fire that flies lights it (a fire bolt,
  // a bomb); it opens the south wall.
  b.section(4);
  b.set(72, 75, T.Pit);
  b.set(72, 74, T.Pit);
  b.set(72, 73);
  b.obj('brazier', 72, 73, { puzzle: 'coldfire', order: 0 });
  b.rect(82, 88, 88, 91);
  b.obj('hidden', 85, 87, { puzzle: 'coldfire' });
  b.obj('pedestal', 85, 90, { item: 'dawn', secret: 'l1' });
  b.obj('pot', 82, 88);
  b.obj('pot', 88, 88);
  b.obj('secret', 82, 88, { secret: 'l1', w: 7, h: 4 });
  // l2: cracked rock at the back of the wolf den's clearing, for a bomb
  b.section(2);
  b.rect(108, 3, 116, 8, T.CaveWall);
  b.rect(109, 4, 115, 7);
  b.set(112, 8, T.Cracked);
  b.set(112, 9);
  b.set(112, 10);
  b.obj('pedestal', 112, 5, { prize: true, secret: 'l2' });
  b.obj('shrine', 110, 5);
  b.obj('chest', 114, 5, { loot: 'rare' });
  b.obj('secret', 109, 4, { secret: 'l2', w: 7, h: 4 });
}
