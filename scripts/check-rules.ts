// Headless checks of the run rules and puzzle logic. Run with: npx tsx scripts/check-rules.ts
import assert from 'node:assert/strict';
import { T } from '../src/art/manifest';
import { getMap } from '../src/data/maps';
import { PATHS, UPGRADE, UPGRADES, upgradeDepth } from '../src/data/upgrades';
import { ITEMS, STARTER_POOL, isLastingWeapon, newStack } from '../src/data/items';
import { World } from '../src/game/world';
import { ARROW_DROP_CHANCE, ARROW_MAX, ARROW_PILE, BASE_IFRAMES, BASE_PULL, KIT_OFFER_SIZE, addArrows, buyUpgrade, canRerollKit, kitPrice, mergeBits, outfit, rerollKit, shopPrice, upgradeCost, upgradeLock, advanceTurn, bowEquipped, fillMissingCharges, createRun, finishRun, giveItem, heroStats, kitCost, kitOffer, packBits, rollChest, setFlag, shopStock, toggleKitItem, trimKit, unpackBits } from '../src/run';
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
// ---------------------------------------------------------------- upgrade tree

// shape: every upgrade is on a path, grows from an upgrade on the same path, and the list is in tree order
assert.equal(UPGRADES.length, 23);
assert.equal(new Set(UPGRADES.map((u) => u.id)).size, 23, 'upgrade ids are unique');
for (const u of UPGRADES) {
  assert.ok(PATHS.some((p) => p.id === u.path), `${u.id} has a path`);
  assert.ok(u.costs.length >= 1 && u.costs.every((c, i) => c > 0 && (i === 0 || c > u.costs[i - 1])), `${u.id} costs rise`);
  if (!u.needs) continue;
  const parent = UPGRADE[u.needs.id];
  assert.ok(parent, `${u.id} grows from a real upgrade`);
  assert.equal(parent.path, u.path, `${u.id} grows from its own path`);
  assert.ok(u.needs.level >= 1 && u.needs.level <= parent.costs.length, `${u.id} needs a level its parent can reach`);
  assert.ok(UPGRADES.indexOf(parent) < UPGRADES.indexOf(u), `${u.id} is listed after its parent`);
  assert.ok(u.costs[0] >= parent.costs[0], `${u.id} costs at least as much as the upgrade above it`);
  assert.ok(upgradeDepth(u.id) <= 3, `${u.id} is no more than three steps down, which is all the screen indents`);
}
assert.deepEqual(UPGRADES.filter((u) => !u.needs).map((u) => u.id), ['vit', 'might', 'swift', 'eyes', 'fortune'], 'the five starting upgrades');
for (const id of ['bigpack', 'laststand', 'campfire', 'story']) assert.equal(UPGRADE[id], undefined);

// unlocking and buying
const t = newSave();
t.created = 1764000000000;
t.heroes.push({ name: 'Cy', color: 2, renown: 10000, upgrades: {}, kit: [null, null, null, null] });
const cy = t.heroes[0];
assert.deepEqual(upgradeLock(cy, 'thick'), { id: 'vit', level: 2 });
assert.equal(buyUpgrade(cy, 'thick'), false, 'a locked upgrade cannot be bought');
assert.equal(buyUpgrade(cy, 'vit'), true);
assert.equal(upgradeLock(cy, 'hearty'), null, 'Vitality 1 opens Hearty');
assert.ok(upgradeLock(cy, 'thick'), 'but not Thick Skin');
assert.equal(buyUpgrade(cy, 'vit'), true);
assert.equal(buyUpgrade(cy, 'thick'), true);
assert.equal(upgradeLock(cy, 'trap'), null);
assert.equal(cy.renown, 10000 - 25 - 45 - 40);
const poor = { name: 'Di', color: 3, renown: 24, upgrades: {}, kit: [null, null, null, null] };
assert.equal(buyUpgrade(poor, 'vit'), false, 'cannot buy without the renown');
const old = { name: 'Ed', color: 0, renown: 500, upgrades: { wind: 1 }, kit: [null, null, null, null] };
assert.equal(upgradeLock(old, 'wind'), null, 'an upgrade owned before the tree existed stays open');
assert.equal(buyUpgrade(old, 'wind'), true);
assert.equal(upgradeCost(old, 'wind'), null, 'and tops out as before');

// buy the whole tree in listed order: always possible, never locked
for (const u of UPGRADES) while (upgradeCost(cy, u.id) !== null) assert.equal(buyUpgrade(cy, u.id), true, `${u.id} can be bought in tree order`);
assert.ok(UPGRADES.every((u) => cy.upgrades[u.id] === u.costs.length));

// effects of a full tree against a bare hero
const rhOf = (profile: number) => ({ profile, hp: 1, slots: [null, null, null], passive: null, pack: Array(6).fill(null), gold: 0, charmHp: 0, charmDmg: 0, deaths: 0, earned: 0 });
t.heroes.push({ name: 'Bare', color: 1, renown: 0, upgrades: {}, kit: [null, null, null, null] });
const full = heroStats(t, rhOf(0));
const bare = heroStats(t, rhOf(1));
assert.deepEqual(
  [bare.iframes, bare.heartBonus, bare.trapDmg, bare.cdMult, bare.knockMult, bare.bigMult, bare.ambushMult, bare.pull, bare.arrowDrop, bare.nose],
  [BASE_IFRAMES, 0, 3, 1, 1, 1, 1, BASE_PULL, ARROW_DROP_CHANCE, false],
  'a hero with no upgrades plays exactly as before',
);
assert.equal(full.iframes, BASE_IFRAMES + 450);
assert.equal(full.heartBonus, 3);
assert.equal(full.trapDmg, 1);
assert.ok(Math.abs(full.cdMult - 0.82) < 1e-9);
assert.equal(full.knockMult, 1.5);
assert.ok(Math.abs(full.bigMult - 1.3) < 1e-9);
assert.equal(full.ambushMult, 1.5);
assert.equal(full.pull, BASE_PULL + 28);
assert.ok(Math.abs(full.arrowDrop - (ARROW_DROP_CHANCE + 0.09)) < 1e-9);
assert.equal(full.nose, true);

// Packrat and Deep Quiver change what a fresh stack holds
assert.equal(outfit(cy, newStack('knives')).charges, Math.round(14 * 1.6));
assert.equal(outfit(cy, newStack('bombs')).charges, 8);
assert.equal(outfit(cy, newStack('bow')).charges, 96);
assert.ok(96 <= ARROW_MAX);
assert.equal(outfit(t.heroes[1], newStack('bow')).charges, 60);
assert.equal(outfit(cy, newStack('club')).charges, undefined);

// Quartermaster, Wider Offer, Second Look
assert.equal(kitPrice(cy, 'bow'), Math.ceil(ITEMS.bow.kit * 0.7));
assert.equal(kitPrice(t.heroes[1], 'bow'), ITEMS.bow.kit);
assert.equal(kitOffer(t, 0).length, KIT_OFFER_SIZE + 1, 'Wider Offer adds a fifth choice');
assert.equal(kitOffer(t, 1).length, KIT_OFFER_SIZE);
assert.equal(canRerollKit(t, 1), false, 'no re-roll without Second Look');
const firstOffer = kitOffer(t, 0);
assert.equal(toggleKitItem(t, 0, firstOffer[0]), 'added');
assert.equal(rerollKit(t, 0), true);
assert.notDeepEqual(kitOffer(t, 0), firstOffer, 'the re-roll draws a different offer');
assert.deepEqual(cy.kit, [null, null, null, null], 'and clears what was chosen');
assert.equal(rerollKit(t, 0), false, 'only once per run');
assert.deepEqual(kitOffer(t, 0), kitOffer(t, 0));

// Pocket Change, Haggler, Cartographer
t.knowledge.map1 = { secrets: [], shortcuts: [], bestCheckpoint: 2, clears: 0, explored: packBits(Uint8Array.from([1, 0, 1, 1, 0, 0, 0, 0, 1])) };
cy.renown = 1000;
const picked = kitOffer(t, 0)[0];
assert.equal(toggleKitItem(t, 0, picked), 'added');
const r2 = createRun(t, [0, 1], 'map1');
t.run = r2;
assert.equal(cy.renown, 1000 - kitPrice(cy, picked), 'the kit is charged at the discounted price');
assert.equal(canRerollKit(t, 0), true, 'the re-roll comes back for the next run');
assert.equal(r2.heroes[0].gold, 45);
assert.equal(r2.heroes[1].gold, 0);
assert.equal(r2.explored, t.knowledge.map1.explored, 'a party with a Cartographer starts with the old map');
assert.equal(createRun(t, [1], 'map1').explored, '', 'a party without one starts blind');
t.runsPlayed--;
const entry = shopStock(r2, t, 2)[0];
assert.equal(shopPrice(t, r2.heroes[0], entry), Math.ceil(entry.price * 0.76));
assert.equal(shopPrice(t, r2.heroes[1], entry), entry.price);
r2.heroes[0].gold = 45 + 20; // found 20, never spent the starting 45
r2.heroes[1].gold = 7;
r2.explored = packBits(Uint8Array.from([0, 1, 0, 0, 0, 0, 0, 0, 0, 1]));
const before = [cy.renown, t.heroes[1].renown];
const sum2 = finishRun(t, false, []);
assert.equal(sum2.rows[0].gold, 20, 'starting gold does not turn into renown');
assert.equal(cy.renown, before[0] + 20);
assert.equal(t.heroes[1].renown, before[1] + 7);
assert.deepEqual(Array.from(unpackBits(t.knowledge.map1.explored!, 10)), [1, 1, 1, 1, 0, 0, 0, 0, 1, 1], 'explored tiles accumulate across runs');
assert.equal(mergeBits('', ''), '');

console.log('All rule checks passed');
