// Headless checks of the run rules and puzzle logic. Run with: npx tsx scripts/check-rules.ts
import assert from 'node:assert/strict';
import { T } from '../src/art/manifest';
import { getMap } from '../src/data/maps';
import { ITEMS, STARTER_POOL, isLastingWeapon, newStack } from '../src/data/items';
import { World } from '../src/game/world';
import { ARROW_MAX, ARROW_PILE, KIT_OFFER_SIZE, addArrows, advanceTurn, bowEquipped, fillMissingCharges, createRun, finishRun, giveItem, heroStats, kitCost, kitOffer, packBits, rollChest, setFlag, shopStock, toggleKitItem, trimKit, unpackBits } from '../src/run';
import { newSave, parseSave } from '../src/save';

const save = newSave();
save.created = 1764000000000; // fixed, so the starter kit offers below are the same on every run of this script
save.heroes.push({ name: 'Ada', color: 0, renown: 100, upgrades: { vit: 2, wind: 1 }, kit: [null, null, null, null] });
save.heroes.push({ name: 'Bo', color: 1, renown: 5, upgrades: {}, kit: [null, null, null, null] });

// starter kit offers: four per hero, stable until a run starts, always with a reusable weapon
const isWeapon = (id: string) => isLastingWeapon(ITEMS[id]);
for (let n = 0; n < 200; n++) {
  save.runsPlayed = n;
  for (const h of [0, 1]) {
    const o = kitOffer(save, h);
    assert.equal(o.length, KIT_OFFER_SIZE, 'four offers');
    assert.equal(new Set(o).size, KIT_OFFER_SIZE, 'offers are distinct');
    assert.ok(o.every((id) => save.pool.includes(id) && id !== 'fists'), 'offers come from the unlocked pool');
    assert.ok(o.some(isWeapon), 'one offer is always a reusable weapon');
    assert.deepEqual(kitOffer(save, h), o, 'the offer does not change until a run starts');
  }
}
const seenOffers = new Set<string>();
for (let n = 0; n < 30; n++) {
  save.runsPlayed = n;
  seenOffers.add(kitOffer(save, 0).join());
}
assert.ok(seenOffers.size > 10, 'offers vary from run to run');
save.runsPlayed = 0;

// choosing from the offer
const offer = kitOffer(save, 0);
const weapon = offer.find(isWeapon)!;
const notOffered = save.pool.find((id) => !offer.includes(id))!;
assert.equal(toggleKitItem(save, 0, notOffered), 'none', 'cannot take an item that is not on offer');
assert.equal(toggleKitItem(save, 0, weapon), 'added');
assert.equal(save.heroes[0].kit[0], weapon);
assert.equal(toggleKitItem(save, 0, weapon), 'removed');
assert.equal(toggleKitItem(save, 0, weapon), 'added');
assert.equal(kitCost(save.heroes[0]), ITEMS[weapon].kit);
assert.equal(toggleKitItem(save, 1, kitOffer(save, 1).find((id) => ITEMS[id].kit > 5)!), 'cost', 'cannot choose more than the hero can pay for');
save.heroes[1].kit[1] = save.pool.find((id) => !kitOffer(save, 1).includes(id) && ITEMS[id].slot === 'active')!;
trimKit(save, 1);
assert.deepEqual(save.heroes[1].kit, [null, null, null, null], 'items that are not on offer are removed');

// starting a run
const run = createRun(save, [0, 1], 'map1');
save.run = run;
assert.equal(run.lives, 2 * 2 + 1, 'two lives per hero plus Second Wind');
assert.equal(save.heroes[0].renown, 100 - ITEMS[weapon].kit, 'kit is paid for');
assert.equal(run.heroes[0].slots[0]?.id, weapon);
assert.deepEqual(save.heroes[0].kit, [null, null, null, null], 'the kit is used up');
assert.equal(save.runsPlayed, 1);
assert.equal(run.heroes[1].slots[0], null);
assert.equal(save.heroes[1].renown, 5);
assert.equal(heroStats(save, run.heroes[0]).maxHp, 20 + 8);
assert.equal(run.heroes[0].hp, 28);
run.heroes[0].slots[0] = { id: 'club' };
run.heroes[0].passive = { id: 'lantern' };
assert.equal(heroStats(save, run.heroes[0]).light, 5 + 3);

// inventory
const bo = run.heroes[1];
assert.equal(giveItem(bo, { id: 'bow' }), 'slot');
assert.equal(giveItem(bo, { id: 'armour' }), 'slot');
assert.equal(giveItem(bo, { id: 'lantern' }), 'pack', 'second passive goes to the pack');
for (let i = 0; i < 2; i++) assert.equal(giveItem(bo, { id: 'club' }), 'slot');
for (let i = 0; i < 5; i++) assert.equal(giveItem(bo, { id: 'club' }), 'pack');
assert.equal(giveItem(bo, { id: 'club' }), null, 'full pack refuses');

// loot is fixed per run and chest, and drawn from the pool
const a = rollChest(run, save, 'chest1', 'common');
const b = rollChest(run, save, 'chest1', 'common');
assert.deepEqual(a, b);
for (let i = 0; i < 200; i++) {
  const it = rollChest(run, save, 'c' + i, i % 2 ? 'good' : 'rare').item.id;
  assert.ok(STARTER_POOL.includes(it), `${it} is not in the pool`);
  const w = rollChest(run, save, 'w' + i, 'weapon').item.id;
  assert.ok(isLastingWeapon(ITEMS[w]), `${w} is not a lasting weapon`);
}
const stock = shopStock(run, save, 2);
assert.ok(stock.length >= 5 && stock.some((e) => e.kind === 'heal'));
setFlag(run, `shop:2:${stock[0].key}`);
assert.equal(shopStock(run, save, 2).length, stock.length - 1, 'sold stock disappears');

// turn order
assert.equal(run.active, 0);
advanceTurn(run);
advanceTurn(run);
assert.equal(run.active, 0);

// fog packing
const bits = new Uint8Array(1000).map((_, i) => (i * 7) % 3 === 0 ? 1 : 0);
assert.deepEqual(unpackBits(packBits(bits), 1000), bits);

// world: gates and puzzles
const def = getMap('map1');
let w = new World(def, run, save);
const gate = (p: string) => w.objs.filter((o) => o.def.type === 'gate' && o.def.puzzle === p);
assert.ok(gate('log').every((g) => !g.open) && w.solid(78, 28), 'log gate starts shut');
const plate = w.ofPuzzle('log', 'plate')[0];
w.updatePlates(plate.x, plate.y);
w.syncGates();
assert.ok(gate('log')[0].open, 'standing on the plate opens the gate');
w.updatePlates(0, 0);
w.syncGates();
assert.ok(!gate('log')[0].open, 'stepping off shuts it');
const block = w.ofPuzzle('log', 'block')[0];
block.x = plate.x;
block.y = plate.y;
assert.deepEqual(w.updatePlates(0, 0), ['log'], 'block on the plate solves it');
setFlag(run, 'pz:log');
w.syncGates();
assert.ok(gate('log')[0].open && !w.solid(78, 28));
w = new World(def, run, save);
assert.ok(gate('log')[0].open, 'solved puzzles survive a reload');
assert.deepEqual([w.ofPuzzle('log', 'block')[0].x, w.ofPuzzle('log', 'block')[0].y], [plate.x, plate.y], 'the block rests on its plate');
// timed gate
w.timers.gauntlet = 3;
w.syncGates();
assert.ok(gate('gauntlet').every((g) => g.open));
w.timers.gauntlet = 0;
w.syncGates((o) => o.y !== 80); // someone stands in the y=80 gate
assert.deepEqual(gate('gauntlet').map((g) => g.open), [true, false], 'a gate will not shut on someone standing in it');
// hidden wall
assert.equal(w.tile(129, 63), T.CaveWall);
setFlag(run, 'pz:torch');
w.syncGates();
assert.ok(w.walkable(129, 63), 'the crooked torch opens the wall');
// boss door and shortcuts kept between runs
w.bossLocked = true;
w.syncGates();
assert.ok(gate('boss').every((g) => !g.open));
save.knowledge.map1 = { secrets: [], shortcuts: ['shortcut'], bestCheckpoint: 0, clears: 0 };
w = new World(def, createRun(save, [0], 'map1'), save);
assert.ok(w.objs.find((o) => o.def.type === 'gate' && o.def.puzzle === 'shortcut')!.open, 'shortcut stays open in later runs');
// sight and pathing
w.computeVisible(10, 50, 7);
assert.ok(w.visible[w.idx(12, 50)] && !w.visible[w.idx(40, 50)]);
w.computeFlow(10, 50);
assert.ok(w.flow[w.idx(14, 50)] === 4);
assert.ok(w.los(10, 50, 14, 50) && !w.los(10, 50, 10, 40));

// arrows: a new bow holds 60, piles refill it up to the cap, and only a hero with a bow can use them
assert.equal(newStack('bow').charges, 60);
assert.ok(isLastingWeapon(ITEMS.bow) && !isLastingWeapon(ITEMS.knives) && !isLastingWeapon(ITEMS.bombs));
const archer = run.heroes[1];
archer.slots = [{ id: 'club' }, null, null];
archer.pack.fill(null);
assert.equal(bowEquipped(archer), false);
assert.equal(addArrows(archer, ARROW_PILE), 0, 'no bow, no use for arrows');
archer.pack[0] = { id: 'bow', charges: 0 };
assert.equal(bowEquipped(archer), false, 'a bow in the pack is not equipped');
assert.equal(addArrows(archer, ARROW_PILE), 10, 'a bow in the pack can still be refilled');
archer.slots[1] = { id: 'bow', charges: 95 };
assert.equal(bowEquipped(archer), true);
assert.equal(addArrows(archer, ARROW_PILE), ARROW_MAX - 95, 'the equipped bow fills first, up to the cap');
assert.equal(addArrows(archer, ARROW_PILE), 10, 'then the spare bow');
assert.equal(archer.pack[0]!.charges, 20);
archer.slots[2] = { id: 'bow' }; // a bow saved before arrows existed
fillMissingCharges(run);
assert.equal(archer.slots[2]!.charges, 60);

// ending a run pays out
run.heroes[0].gold = 40;
run.heroes[0].earned = 15;
run.checkpoint = 3;
const sum = finishRun(save, false, []);
assert.equal(sum.rows[0].total, 55);
assert.equal(save.heroes[0].renown, 100 - ITEMS[weapon].kit + 55);
assert.equal(save.run, null);
assert.equal(save.knowledge.map1.bestCheckpoint, 3);

// saves round-trip and reject junk
assert.deepEqual(parseSave(JSON.stringify(save)).heroes, save.heroes);
assert.throws(() => parseSave('{"hello":1}'));
assert.throws(() => parseSave('not json'));
console.log('All rule checks passed');
