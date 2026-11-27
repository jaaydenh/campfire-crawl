// Map 2: the Drowned Mire into the Sunken Temple. Seven sections, six campfires, one mini-boss.
// What is new here: shallow mire that slows (Bog), deep water nothing crosses on foot (Murk), rafts and slabs that
// give way underfoot (Sinking, Crumble), gas vents that poison, and sluice wheels that raise and lower the temple's water.
// As on map 1, b.spawn places a monster on every tier and b.extra adds to the packs from a tier up; the clutch and the
// coffin are generators, so on tier 1 one of what they hatch stands in their place. Each tier has its own secrets:
// the shared layout is built the same way for every tier, and what differs is added or sealed at the end.
import { O, T } from '../art/manifest';
import { MapBuilder, type MapDef, type Zone } from '../world/mapdef';

const W = 180;
const H = 120;

const zone = (x: number, y: number): Zone => (y >= 64 || (x >= 112 && y >= 50) ? 'temple' : 'swamp');

/** The sanctum: the Priest's hall, its pillars, and where he may rise. */
const ARENA = { x0: 4, y0: 93, x1: 23, y1: 114 };
const PILLARS: [number, number][] = [[8, 98], [18, 98], [8, 108], [18, 108]];

export function buildMap2(tier = 1): MapDef {
  const b = new MapBuilder(W, H, zone, 20261127);
  const t1 = tier === 1;

  // ---------- Section 1: the sodden road ----------
  b.section(0);
  b.blob(12, 16, 6, 5);
  b.checkpoints[0] = { x: 10, y: 16 };
  b.obj('sign', 9, 13, { text: 'THE DROWNED MIRE. The green water is shallow, and wading through it is slow going. The black water is deep: nothing on foot crosses it. Keep to the causeway when something is after you.' });
  b.obj('npc', 15, 13, {
    name: 'Old Ferryman',
    sprite: 2,
    lines: [
      'No ferry today. No ferry any day, since the temple went under and its priest would not stay drowned.',
      'Leeches are quick as eels in the water and slow as slugs out of it. Make them come to you.',
      'A toad shows you where it means to land. Do not be standing there.',
      'And if the ground hisses at you, hold your breath and wait. The poison is patient, but so is a campfire.',
    ],
  });
  b.decor(O.Boat, 8, 18, true);
  b.bog(29, 21, 5, 3);
  b.bog(20, 12, 3, 2);
  b.rect(15, 12, 17, 13);
  b.path([[12, 16], [24, 16], [32, 20], [40, 22]], 3);
  b.blob(40, 22, 6, 5);
  b.bog(44, 25, 3, 2);
  b.rect(43, 18, 45, 19);
  b.obj('chest', 44, 18, { loot: 'weapon' });
  b.obj('pot', 36, 20);
  b.obj('pot', 37, 25);
  b.decor(O.Stump, 42, 26, true);
  b.spawn(20, 16, 'slime');
  b.spawn(26, 17, 'slime', 'toad');
  b.spawn(29, 21, 'leech');
  b.spawn(31, 22, 'leech');
  b.spawn(38, 22, 'toad');
  b.spawn(42, 23, 'toad', 'slime');
  b.spawn(44, 25, 'leech');
  b.extra(2, 34, 21, 'toad');
  b.extra(3, 22, 12, 'leech');
  b.extra(3, 40, 24, 'lizard');
  // a side pool with a guarded chest
  b.path([[26, 17], [27, 26], [27, 30]], 2);
  b.blob(27, 32, 4, 3);
  b.bog(25, 33, 3, 2);
  b.obj('chest', 29, 33, { loot: 'common' });
  b.obj('pot', 29, 30);
  b.spawn(27, 31, 'toad');
  b.spawn(25, 33, 'leech');
  b.spawn(24, 34, 'leech');
  b.extra(3, 26, 34, 'clutch');
  // secret (tier 1): a hollow in the rock north of the clearing, behind cracked stone
  b.rect(36, 9, 44, 15, T.CaveWall);
  b.rect(37, 10, 43, 14);
  b.set(40, 15, T.Cracked);
  b.rect(40, 16, 40, 18);
  if (t1) {
    b.obj('pedestal', 40, 11, { item: 'waders', secret: 'm1' });
    b.obj('chest', 38, 11, { loot: 'good' });
    b.obj('pot', 42, 11);
    b.obj('pot', 42, 13);
    b.obj('secret', 37, 10, { secret: 'm1', w: 7, h: 5 });
  }
  b.path([[40, 22], [50, 20], [58, 20]], 3);
  b.spawn(49, 20, 'toad', 'slime');
  b.spawn(53, 21, 'slime');
  b.extra(2, 51, 19, 'toad');
  b.blob(58, 20, 5, 4);
  b.campfire(1, 58, 20);

  // ---------- Section 2: Leechwater ----------
  b.section(1);
  b.path([[58, 20], [66, 20]], 3);
  b.rect(67, 9, 97, 34, T.Murk);
  b.rect(67, 20, 76, 21, T.Planks);
  b.bogRect(68, 22, 75, 24);
  b.bogRect(69, 17, 74, 19);
  // the first islet, and the shallows south of it that lead to the lever
  b.blob(79, 20, 3, 3);
  b.rect(77, 20, 81, 21);
  b.bogRect(77, 22, 81, 29);
  b.blob(79, 31, 3, 2);
  b.rect(79, 30, 81, 32);
  b.obj('lever', 79, 32, { puzzle: 'reeds' });
  b.spawn(81, 31, 'clutch');
  b.obj('sign', 78, 18, { text: 'ROTTEN PLANKS AHEAD. They hold for a breath, no longer. Cross without stopping. (South through the shallows: the lever for the reed gate.)' });
  // rotten planks to the second islet
  b.rect(82, 20, 87, 20, T.Sinking);
  b.blob(90, 20, 3, 3);
  b.rect(88, 18, 92, 21);
  // and more of them north, to an islet with a chest
  b.rect(90, 14, 90, 17, T.Sinking);
  b.blob(90, 12, 3, 2);
  b.rect(89, 11, 91, 13);
  b.obj('chest', 91, 11, { loot: 'good' });
  b.obj('pot', 88, 12);
  b.spawn(89, 12, 'toad');
  // the east shore and the reed gate
  b.rect(93, 20, 97, 21, T.Planks);
  b.rect(98, 17, 100, 24);
  b.blob(106, 20, 4, 4);
  b.rect(102, 19, 106, 22);
  b.rect(101, 12, 101, 28, T.Reeds);
  b.rect(101, 20, 101, 21, T.Planks);
  b.obj('gate', 101, 20, { puzzle: 'reeds' });
  b.obj('gate', 101, 21, { puzzle: 'reeds' });
  b.spawn(70, 23, 'leech');
  b.spawn(73, 18, 'leech');
  b.spawn(74, 23, 'leech');
  b.spawn(78, 26, 'leech');
  b.spawn(80, 27, 'leech');
  b.spawn(79, 21, 'toad');
  b.spawn(90, 21, 'toad', 'slime');
  b.spawn(91, 19, 'slime', 'toad');
  b.spawn(99, 22, 'toad');
  b.extra(2, 78, 25, 'leech');
  b.extra(2, 99, 18, 'lizard');
  b.extra(3, 71, 18, 'leech');
  b.extra(3, 89, 22, 'toad');
  b.extra(3, 105, 22, 'shaman');
  // a rock outcrop north of the far shore (a tier 2 secret lies in it)
  b.rect(102, 8, 110, 14, T.CaveWall);
  b.path([[106, 20], [113, 18]], 3);
  b.blob(114, 18, 5, 4);
  b.campfire(2, 114, 18, true);

  // ---------- Section 3: the lizard village ----------
  b.section(2);
  b.path([[114, 18], [122, 18], [130, 22], [136, 26]], 3);
  b.set(121, 16);
  b.obj('sign', 121, 16, { text: 'The ground breathes here. When it does, stand back: the green air is poison, and it stays in the blood. A heart or a campfire clears it.' });
  b.obj('vent', 125, 19, { period: 3400, phase: 0 });
  b.obj('vent', 128, 22, { period: 3400, phase: 0.5 });
  b.obj('vent', 131, 22, { period: 3400, phase: 0.25, chance: 0.5 });
  b.spawn(121, 19, 'toad');
  b.blob(138, 28, 9, 7);
  b.bog(134, 33, 3, 2);
  for (const [x, y] of [[134, 24], [142, 24], [144, 31], [131, 28], [146, 27], [135, 25], [143, 25]]) b.set(x, y); // firm ground under the huts and totems
  b.decor(O.Hut, 134, 24, true);
  b.decor(O.Hut, 142, 24, true);
  b.decor(O.Hut, 144, 31, true);
  b.decor(O.Totem, 131, 28, true);
  b.decor(O.Totem, 146, 27, true);
  b.obj('pot', 135, 25);
  b.obj('pot', 143, 25);
  b.set(145, 32);
  b.obj('pot', 145, 32);
  b.spawn(136, 28, 'lizard');
  b.spawn(140, 27, 'lizard');
  b.spawn(141, 31, 'shaman');
  b.spawn(137, 31, 'lizard', 'toad');
  b.spawn(134, 33, 'leech');
  b.extra(2, 139, 30, 'lizard');
  b.extra(2, 143, 28, 'shaman');
  b.extra(3, 133, 29, 'lizard');
  // the witch-doctor's hut holds the key
  b.path([[143, 25], [150, 17], [153, 13]], 2);
  b.blob(154, 12, 5, 3);
  for (const [x, y] of [[152, 10], [157, 13], [157, 11]]) b.set(x, y);
  b.decor(O.Hut, 152, 10, true);
  b.decor(O.Totem, 157, 13, true);
  b.spawn(154, 13, 'shaman');
  b.spawn(152, 12, 'lizard');
  b.spawn(156, 12, 'lizard', 'toad');
  b.extra(2, 155, 14, 'lizard');
  b.extra(3, 153, 14, 'shaman');
  b.obj('chest', 157, 11, { loot: 'key:blue' });
  // a rock outcrop east of the village (a tier 3 secret lies in it)
  b.rect(150, 26, 158, 32, T.CaveWall);
  // the temple gate
  b.path([[138, 34], [140, 40], [140, 46]], 3);
  b.rect(138, 47, 142, 49);
  b.rect(140, 50, 140, 54);
  b.obj('door', 140, 51, { key: 'blue' });
  b.obj('sign', 138, 47, { text: 'Only the anointed pass. (The witch-doctor keeps the key.)' });
  b.decor(O.Statue, 142, 47, true);
  b.rect(134, 55, 146, 62);
  b.campfire(3, 140, 58);
  b.decor(O.Statue, 135, 56, true);
  b.decor(O.Statue, 145, 56, true);

  // ---------- Section 4: the sunken gate ----------
  b.section(3);
  b.rect(140, 63, 141, 66);
  b.rect(130, 67, 152, 80);
  // a flooded channel cuts the court in two: the wheel on the north side drains it
  b.channel('court', 'flood', 130, 72, 152, 74);
  b.obj('valve', 146, 69, { channel: 'court' });
  b.obj('sign', 136, 69, { text: 'THE WHEEL COMMANDS THE WATER. What the flood bars, the ebb opens. What rides the flood, the ebb lays low.' });
  // A side door in the east wall stands under the same water. Beyond it is a second wheel, and past that a drop
  // crossed by rafts that ride only at high water.
  b.channel('court', 'flood', 153, 69, 154, 69);
  b.rect(155, 67, 158, 71);
  b.channel('court', 'float', 157, 72, 157, 73);
  b.rect(155, 74, 160, 78);
  if (t1) {
    // secret (tier 1): drain the court to get in, then raise the water again from inside to ride the rafts
    b.obj('valve', 157, 68, { channel: 'court' });
    b.obj('pedestal', 158, 76, { item: 'antivenom', secret: 'm2' });
    b.obj('chest', 159, 77, { loot: 'good' });
    b.obj('pot', 155, 74);
    b.obj('secret', 155, 74, { secret: 'm2', w: 6, h: 5 });
  }
  b.bogRect(132, 76, 137, 79);
  b.spawn(134, 77, 'drowned');
  b.spawn(136, 78, 'drowned');
  b.spawn(144, 78, 'wisp');
  b.spawn(133, 69, 'wisp', 'bat');
  b.spawn(149, 70, 'bat');
  b.extra(2, 141, 77, 'drowned');
  b.extra(3, 147, 76, 'wisp');
  b.decor(O.Statue, 131, 68, true);
  b.decor(O.Statue, 151, 68, true);
  b.decor(O.Bones, 143, 79);
  // west to the wisp gallery
  b.rect(124, 77, 129, 78);
  b.rect(112, 72, 123, 83);
  b.bogRect(113, 79, 116, 82);
  b.spawn(115, 80, 'drowned');
  b.spawn(118, 75, 'wisp');
  b.spawn(121, 80, 'wisp');
  b.spawn(114, 74, 'bat', 'wisp');
  b.extra(2, 120, 76, 'shaman');
  b.extra(3, 117, 81, 'drowned');
  b.obj('sconce', 114, 71, { frame: O.TSconce });
  b.obj('sconce', 116, 71, { frame: O.TSconce });
  b.obj('sconce', 121, 71, tier === 2 ? { frame: O.TSconceOdd, puzzle: 'idol' } : { frame: O.TSconce });
  b.obj('pot', 123, 72);
  b.obj('pot', 123, 83);
  // shortcut back to the temple gate, opened from this side and kept open in later runs
  b.rect(119, 58, 133, 58);
  b.rect(118, 58, 118, 71);
  b.obj('gate', 133, 58, { puzzle: 'stair', meta: true });
  b.set(119, 68);
  b.obj('lever', 119, 68, { puzzle: 'stair', meta: true });
  // camp
  b.rect(106, 77, 111, 78);
  b.rect(98, 73, 105, 82);
  b.campfire(4, 101, 77, true);
  b.decor(O.Bones, 99, 81);

  // ---------- Section 5: the sluice halls ----------
  b.section(4);
  b.rect(94, 77, 97, 78);
  b.rect(70, 68, 93, 90);
  // a moat between the east strip and the middle of the hall: drained at low water
  b.channel('moat', 'flood', 84, 68, 85, 90);
  // the wheel for the moat stands in a nook across a drop, reached by rafts that ride the other water
  b.rect(86, 72, 93, 73, T.Pit);
  b.channel('weir', 'float', 89, 72, 90, 73);
  b.obj('valve', 90, 69, { channel: 'moat' });
  b.obj('valve', 91, 87, { channel: 'weir' });
  b.obj('sign', 88, 80, { text: 'TWO WATERS, TWO WHEELS EACH. The amber mark means the water is down. Mind which water carries you before you send it away.' });
  // the middle: a second wheel for the moat, and a drop on its west side crossed by rafts that ride the moat's water
  b.obj('valve', 80, 88, { channel: 'moat' });
  b.rect(74, 68, 75, 90, T.Pit);
  b.channel('moat', 'float', 74, 80, 75, 81);
  b.bogRect(77, 71, 82, 74);
  b.spawn(78, 72, 'drowned');
  b.spawn(81, 73, 'drowned');
  b.spawn(79, 79, 'lizard');
  b.spawn(81, 84, 'shaman');
  b.spawn(78, 85, 'lizard', 'wisp');
  b.spawn(88, 76, 'wisp');
  b.spawn(89, 84, 'bat', 'wisp');
  b.extra(2, 82, 80, 'lizard');
  b.extra(3, 77, 77, 'shaman');
  b.extra(3, 90, 82, 'wisp');
  b.decor(O.Statue, 79, 69, true);
  b.decor(O.Bones, 82, 89);
  b.obj('arrowtrap', 69, 72, { dir: 3, period: 1900, phase: 0, chance: 0.6 });
  b.obj('arrowtrap', 69, 88, { dir: 3, period: 1900, phase: 0.5, chance: 0.6 });
  // the way out is barred by the weir's water
  b.rect(60, 80, 69, 81);
  b.channel('weir', 'flood', 65, 80, 66, 81);
  // the broken gallery: slabs that fall away over a long drop
  b.rect(46, 74, 59, 88);
  b.rect(49, 76, 56, 86, T.Pit);
  b.rect(49, 80, 56, 81, T.Crumble);
  b.rect(52, 77, 53, 78);
  b.rect(52, 79, 53, 79, T.Crumble);
  b.obj('chest', 52, 77, { loot: 'good' });
  b.obj('sign', 58, 78, { text: 'These slabs fall when trodden and climb back after. Do not linger on them.' });
  b.obj('arrowtrap', 52, 73, { dir: 0, period: 2100, phase: 0.3, chance: 0.4 });
  b.spawn(57, 84, 'wisp');
  b.spawn(47, 76, 'wisp');
  b.spawn(47, 85, 'lizard');
  b.spawn(58, 75, 'bat');
  b.extra(2, 48, 87, 'shaman');
  b.extra(3, 57, 87, 'lizard');
  b.obj('pot', 46, 74);
  b.obj('pot', 59, 88);
  // secret (tier 1): across a gap north of the gallery, for a dash
  b.set(55, 73, T.Pit);
  b.set(55, 72, T.Pit);
  b.rect(52, 68, 58, 71);
  if (t1) {
    b.obj('shrine', 53, 69);
    b.obj('pedestal', 57, 69, { item: 'stoneskin', secret: 'm3' });
    b.obj('secret', 52, 68, { secret: 'm3', w: 7, h: 4 });
  }
  // camp
  b.rect(42, 80, 45, 81);
  b.rect(34, 76, 41, 85);
  b.campfire(5, 37, 80);
  b.decor(O.Statue, 35, 77, true);

  // ---------- Section 6: the ossuary ----------
  b.section(5);
  // a corridor of vents
  b.rect(37, 86, 38, 93);
  b.rect(39, 92, 50, 93);
  b.rect(49, 94, 50, 96);
  b.obj('vent', 37, 89, { period: 3200, phase: 0 });
  b.obj('vent', 41, 92, { period: 3200, phase: 0.33 });
  b.obj('vent', 44, 93, { period: 3200, phase: 0.66 });
  b.obj('vent', 47, 92, { period: 3200, phase: 0, chance: 0.6 });
  b.rect(48, 97, 72, 110);
  b.bogRect(50, 106, 55, 109);
  b.bogRect(66, 98, 70, 101);
  b.obj('npc', 52, 98, {
    name: 'The Penitent',
    sprite: 3,
    lines: [
      'I rang the bells the night the water came. I am still ringing them.',
      'The four fires open the way on. The tide comes in from the EAST. Then it turns against the sun, and does not stop until every fire burns.',
      'He will keep his distance and let the water do his work. Stand on stone when it rises, and strike him when he is spent.',
      'Crowd him and he sinks away. Watch where the floor ripples: that is where he comes up.',
    ],
  });
  // the four fires, lit east, north, west, south
  b.obj('brazier', 68, 104, { puzzle: 'fires', order: 0 });
  b.obj('brazier', 60, 99, { puzzle: 'fires', order: 1 });
  b.obj('brazier', 52, 104, { puzzle: 'fires', order: 2 });
  b.obj('brazier', 60, 109, { puzzle: 'fires', order: 3 });
  b.spawn(63, 102, 'coffin');
  b.spawn(52, 107, 'drowned');
  b.spawn(54, 108, 'drowned');
  b.spawn(68, 99, 'drowned');
  b.spawn(57, 103, 'lizard');
  b.spawn(64, 107, 'shaman');
  b.spawn(70, 106, 'lizard', 'wisp');
  b.spawn(58, 98, 'wisp');
  b.extra(2, 66, 104, 'lizard');
  b.extra(2, 55, 100, 'shaman');
  b.extra(3, 62, 106, 'drowned');
  b.extra(3, 70, 109, 'lizard');
  b.decor(O.Statue, 49, 98, true);
  b.decor(O.Statue, 71, 98, true);
  b.decor(O.Statue, 71, 109, true);
  b.decor(O.Bones, 59, 105);
  b.decor(O.Bones, 66, 108);
  b.obj('pot', 48, 110);
  b.obj('pot', 72, 110);
  b.rect(46, 103, 47, 104);
  b.obj('gate', 47, 103, { puzzle: 'fires' });
  b.obj('gate', 47, 104, { puzzle: 'fires' });
  b.rect(38, 100, 45, 107);
  b.campfire(6, 41, 103);

  // ---------- Section 7: the drowned sanctum ----------
  b.section(6);
  b.rect(36, 103, 37, 104);
  b.rect(27, 98, 35, 109);
  b.bogRect(28, 99, 31, 101);
  b.bogRect(28, 106, 31, 108);
  b.spawn(29, 100, 'drowned');
  b.spawn(30, 107, 'drowned');
  b.spawn(33, 101, 'shaman');
  b.spawn(32, 106, 'lizard');
  b.extra(2, 34, 104, 'lizard');
  b.extra(3, 29, 104, 'coffin');
  b.decor(O.Statue, 35, 98, true);
  b.decor(O.Statue, 35, 109, true);
  b.obj('pot', 27, 98);
  b.obj('pot', 27, 109);
  b.rect(24, 103, 26, 104);
  b.obj('gate', 25, 103, { puzzle: 'boss' });
  b.obj('gate', 25, 104, { puzzle: 'boss' });
  b.rect(ARENA.x0, ARENA.y0, ARENA.x1, ARENA.y1);
  for (const [px, py] of PILLARS) b.rect(px, py, px + 1, py + 1, T.TempleWall);
  b.obj('pot', 4, 93);
  b.obj('pot', 23, 93);
  b.obj('pot', 4, 114);
  b.obj('pot', 23, 114);
  b.decor(O.Bones, 15, 95);
  b.decor(O.Bones, 7, 112);

  // tier 1's hiding places are solid on the higher tiers
  if (!t1) {
    b.rect(37, 10, 43, 14, T.CaveWall);
    b.set(40, 15, T.CaveWall);
    b.seal(153, 67, 160, 79);
    b.seal(52, 68, 58, 73);
  }
  if (tier === 2) veteranSecrets(b);
  if (tier === 3) legendSecrets(b);

  // The sanctum floods as the Priest's guard breaks. First the outer ring; then everything but the stone
  // around each pillar and the middle of the hall.
  const idx = (x: number, y: number) => y * W + x;
  const cx = (ARENA.x0 + ARENA.x1) / 2;
  const cy = (ARENA.y0 + ARENA.y1) / 2;
  const ring: number[] = [];
  const rest: number[] = [];
  const dry = (x: number, y: number) => Math.hypot(x - cx, y - cy) < 3.3 || PILLARS.some(([px, py]) => Math.hypot(x - (px + 0.5), y - (py + 0.5)) < 3.1);
  for (let y = ARENA.y0; y <= ARENA.y1; y++)
    for (let x = ARENA.x0; x <= ARENA.x1; x++) {
      if (b.get(x, y) === T.TempleWall || (x >= ARENA.x1 - 1 && (y === 103 || y === 104))) continue; // the pillars, and the stone just inside the gate
      const edge = Math.min(x - ARENA.x0, ARENA.x1 - x, y - ARENA.y0, ARENA.y1 - y);
      if (edge < 3) ring.push(idx(x, y));
      else if (!dry(x, y)) rest.push(idx(x, y));
    }

  b.finalize();
  return {
    id: 'map2',
    tier,
    number: 2,
    name: 'The Drowned Mire',
    w: W,
    h: H,
    tiles: b.tiles,
    objects: b.objects,
    spawns: b.spawns,
    checkpoints: b.checkpoints,
    sectionNames: ['The Sodden Road', 'Leechwater', 'The Lizard Village', 'The Sunken Gate', 'The Sluice Halls', 'The Ossuary', 'The Drowned Sanctum'],
    boss: {
      type: 'priest',
      x: 11,
      y: 103,
      arena: { ...ARENA, x1: ARENA.x1 - 1 },
      gate: 'boss',
      flood: [ring, rest],
      anchors: [{ x: 13, y: 104 }, { x: 6, y: 95 }, { x: 21, y: 95 }, { x: 6, y: 112 }, { x: 21, y: 112 }, { x: 13, y: 95 }, { x: 13, y: 112 }],
      lit: true,
    },
    secrets: SECRETS[tier - 1],
    clearUnlocks: CLEAR_UNLOCKS[tier - 1],
    indoor: b.indoorMask(),
    scale: { hp: 1.22, dmg: 1.29 },
    music: { outdoor: 'swamp', indoor: 'temple' },
    water: b.water,
  };
}

const SECRETS = [
  [
    { id: 'm1', name: 'The hollow in the rock' },
    { id: 'm2', name: 'Where the rafts ride' },
    { id: 'm3', name: 'Across the broken floor' },
  ],
  [
    { id: 'n1', name: 'Behind the tilted flame' },
    { id: 'n2', name: 'The far shore' },
  ],
  [
    { id: 'o1', name: 'The cold altar' },
    { id: 'o2', name: "The witch-doctor's cache" },
  ],
];

/** What the Priest's first defeat on each tier adds to the item pool. */
const CLEAR_UNLOCKS = [['blowpipe', 'firebolt'], ['leechring'], ['crown']];

/** Tier 2, Veteran: two hiding places that tier 1 does not have. */
function veteranSecrets(b: MapBuilder): void {
  // n1: the tilted torch in the wisp gallery opens the wall below it
  b.section(3);
  b.rect(114, 86, 120, 89);
  b.set(117, 85);
  b.obj('hidden', 117, 84, { puzzle: 'idol' });
  b.obj('pedestal', 117, 88, { item: 'tide', secret: 'n1' });
  b.obj('chest', 115, 87, { loot: 'good' });
  b.obj('pot', 120, 86);
  b.obj('pot', 120, 89);
  b.obj('secret', 114, 86, { secret: 'n1', w: 7, h: 4 });
  // n2: a lever on a rock out in Leechwater. Only something thrown or shot reaches it; it opens the outcrop on the far shore.
  b.section(1);
  b.set(72, 27);
  b.obj('lever', 72, 27, { puzzle: 'farshore' });
  b.rect(103, 9, 109, 13);
  b.rect(106, 15, 106, 18);
  b.obj('hidden', 106, 14, { puzzle: 'farshore' });
  b.obj('pedestal', 106, 10, { prize: true, secret: 'n2' });
  b.obj('chest', 104, 10, { loot: 'rare' });
  b.obj('pot', 108, 10);
  b.obj('pot', 108, 12);
  b.obj('secret', 103, 9, { secret: 'n2', w: 7, h: 5 });
}

/** Tier 3, Legend: two more, in places of their own. */
function legendSecrets(b: MapBuilder): void {
  // o1: a cold brazier on a stump of floor out in the broken gallery's drop. Only fire that flies lights it
  // (a fire bolt, a bomb); it opens the gallery's south wall.
  b.section(4);
  b.set(55, 84);
  b.obj('brazier', 55, 84, { puzzle: 'coldaltar', order: 0 });
  b.rect(52, 91, 58, 94);
  b.set(55, 90);
  b.obj('hidden', 55, 89, { puzzle: 'coldaltar' });
  b.obj('pedestal', 55, 93, { item: 'wisplantern', secret: 'o1' });
  b.obj('pot', 52, 91);
  b.obj('pot', 58, 91);
  b.obj('secret', 52, 91, { secret: 'o1', w: 7, h: 4 });
  // o2: park the village's stone on the plate, and a slab in the outcrop east of the village stays open
  b.section(2);
  b.rect(151, 27, 157, 31);
  b.rect(147, 29, 149, 29);
  b.obj('hidden', 150, 29, { puzzle: 'cache' });
  b.obj('plate', 141, 29, { puzzle: 'cache' });
  b.obj('block', 138, 32, { puzzle: 'cache' });
  b.obj('pedestal', 155, 29, { prize: true, secret: 'o2' });
  b.obj('shrine', 153, 27);
  b.obj('chest', 156, 31, { loot: 'rare' });
  b.obj('secret', 151, 27, { secret: 'o2', w: 7, h: 5 });
}
