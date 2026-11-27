// Headless checks of the run rules and puzzle logic. Run with: npx tsx scripts/check-rules.ts
import assert from 'node:assert/strict';
import { T } from '../src/art/manifest';
import { getMap } from '../src/data/maps';
import { CHIEF_PHASES, MONSTERS } from '../src/data/monsters';
import { TIERS, scaleDmg, scaleHp, spawnOn, tierDef, tierMonster } from '../src/data/tiers';
import { SHEETS } from '../src/art/manifest';
import { PATHS, UPGRADE, UPGRADES, upgradeDepth } from '../src/data/upgrades';
import { ITEMS, ITEM_LIST, STARTER_POOL, STARTER_WEAPON, isLastingWeapon, newStack } from '../src/data/items';
import { MELEE_CONE, RANGED_CONE, leadAngle, pickTarget } from '../src/game/aim';
import { World } from '../src/game/world';
import { ARROW_DROP_CHANCE, ARROW_MAX, ARROW_PILE, BASE_IFRAMES, BASE_PULL, FEATS, KIT_OFFER_SIZE, clearFeat, everCleared, featsOpen, pedestalItem, pinSlots, runTier, tierClears, tierUnlocked, KIT_ROLES, PROWESS_START, campRest, comebackHp, heroFell, rescueFallen, addArrows, buyUpgrade, discoverItem, kitChoices, kitPrice, kitRole, mergeBits, outfit, pinsOf, prowess, rerollBlock, rerollKit, rerollPrice, setPin, shopPrice, upgradeCost, upgradeLock, advanceTurn, bowEquipped, fillMissingCharges, createRun, finishRun, giveItem, heroStats, kitCost, kitOffer, packBits, rollChest, knowledgeOf, prizeTaken, setFlag, shopStock, takePrize, toggleKitItem, trimKit, unpackBits } from '../src/run';
import { newSave, parseSave } from '../src/save';
import { controlsOf } from '../src/types';

const save = newSave();
save.created = 1764000000000; // fixed, so the starter kit offers below are the same on every run of this script
save.heroes.push({ name: 'Ada', color: 0, renown: 100, upgrades: { vit: 2, wind: 1 }, kit: [null, null, null, null] });
save.heroes.push({ name: 'Bo', color: 1, renown: 5, upgrades: {}, kit: [null, null, null, null] });

// starter kit offers: six per hero, two for each role, stable until a run starts
const isWeapon = (id: string) => isLastingWeapon(ITEMS[id]);
assert.equal(KIT_OFFER_SIZE, 6);
for (let n = 0; n < 200; n++) {
  save.runsPlayed = n;
  for (const h of [0, 1]) {
    const o = kitOffer(save, h);
    assert.equal(o.length, KIT_OFFER_SIZE, 'six offers');
    assert.equal(new Set(o).size, KIT_OFFER_SIZE, 'offers are distinct');
    assert.ok(o.every((id) => save.pool.includes(id) && id !== 'fists' && id !== STARTER_WEAPON), 'offers come from the unlocked pool');
    for (const r of KIT_ROLES) assert.equal(o.filter((id) => kitRole(ITEMS[id]) === r.role).length, r.offers, `${r.offers} offers are ${r.name}`);
    assert.deepEqual(o.map((id) => kitRole(ITEMS[id])), ['weapon', 'weapon', 'active', 'active', 'passive', 'passive'], 'listed role by role');
    assert.deepEqual(kitOffer(save, h), o, 'the offer does not change until a run starts');
  }
}
assert.deepEqual([kitRole(ITEMS.bow), kitRole(ITEMS.knives), kitRole(ITEMS.shield), kitRole(ITEMS.lantern)], ['weapon', 'active', 'active', 'passive']);
const seenOffers = new Set<string>();
for (let n = 0; n < 30; n++) {
  save.runsPlayed = n;
  seenOffers.add(kitOffer(save, 0).join());
}
assert.ok(seenOffers.size > 10, 'offers vary from run to run');
save.runsPlayed = 0;

// Prowess pays for the kit: every hero starts with 3, and it is a budget, not a purse
assert.equal(PROWESS_START, 3);
assert.equal(prowess(save.heroes[0]), 3);
assert.equal(prowess({ name: 'Vet', color: 0, renown: 0, upgrades: {}, kit: [], feats: ['half:map1', 'clear:map1:1'] }), 5);
for (const d of ITEM_LIST) assert.ok(d.kit >= [1, 3, 5, 8][d.rarity] && d.kit <= [2, 4, 7, 10][d.rarity], `${d.id} is priced for its rarity`);
assert.ok(STARTER_POOL.some((id) => isWeapon(id) && ITEMS[id].kit <= PROWESS_START), 'a new hero can afford a weapon');

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
assert.equal(kitPrice(weapon), ITEMS[weapon].kit);

// pinned item: always available on top of the offer, and pinning does not redraw the rest
assert.deepEqual(pinsOf(save, 1), []);
assert.equal(setPin(save, 1, 'frost'), false, 'only an unlocked item can be pinned');
assert.equal(setPin(save, 1, STARTER_WEAPON), false, 'the starter weapon cannot be pinned');
const unpinned = kitOffer(save, 1);
assert.equal(setPin(save, 1, 'spear'), true);
assert.deepEqual(pinsOf(save, 1), ['spear']);
assert.equal(kitChoices(save, 1)[0], 'spear', 'the pin leads the choices');
assert.ok(!kitOffer(save, 1).includes('spear'), 'and does not take up an offer as well');
assert.equal(kitOffer(save, 1).length, KIT_OFFER_SIZE);
assert.ok(unpinned.filter((id) => id !== 'spear').every((id) => kitOffer(save, 1).includes(id)), 'pinning leaves the other offers as they were');
assert.equal(toggleKitItem(save, 1, 'spear'), 'added', 'the pin can be chosen whatever the offer holds');
assert.equal(kitCost(save.heroes[1]), 3);
assert.equal(toggleKitItem(save, 1, kitOffer(save, 1).find((id) => ITEMS[id].slot === 'active')!), 'cost', 'cannot choose more than the hero has Prowess for');
assert.equal(setPin(save, 1, 'bow'), true, 'the pin can be changed');
assert.ok(save.heroes[1].kit.every((id) => !id || kitChoices(save, 1).includes(id)), 'an item that is neither pinned nor offered leaves the kit');
assert.equal(setPin(save, 1, null), true);
save.heroes[1].kit = [null, null, null, null];
save.heroes[1].kit[1] = save.pool.find((id) => !kitOffer(save, 1).includes(id) && ITEMS[id].slot === 'active')!;
trimKit(save, 1);
assert.deepEqual(save.heroes[1].kit, [null, null, null, null], 'items that are not on offer are removed');

// starting a run
const run = createRun(save, [0, 1], 'map1');
save.run = run;
assert.equal(run.lives, 2 * 2 + 1, 'two lives per hero plus Second Wind');
assert.equal(save.heroes[0].renown, 100, 'a kit costs no renown');
assert.equal(run.heroes[0].slots[0]?.id, weapon);
assert.deepEqual(save.heroes[0].kit, [null, null, null, null], 'the kit is used up');
assert.equal(save.runsPlayed, 1);
// every hero sets out with the starter weapon, in the first active slot the kit left empty
assert.equal(STARTER_WEAPON, 'sword');
assert.deepEqual(run.heroes[0].slots.map((s) => s?.id ?? null), [weapon, STARTER_WEAPON, null]);
assert.deepEqual(run.heroes[1].slots.map((s) => s?.id ?? null), [STARTER_WEAPON, null, null]);
assert.ok(!ITEM_LIST.includes(ITEMS[STARTER_WEAPON]) && !STARTER_POOL.includes(STARTER_WEAPON), 'the starter weapon is never loot');
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
assert.equal(giveItem(bo, { id: 'club' }), 'slot', 'the starter sword and the bow leave one active slot');
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

// falling and rescue: a death holds the life at risk where the hero fell, and reaching the spot wins it back
{
  const s = newSave();
  s.heroes.push({ name: 'Ka', color: 0, renown: 0, upgrades: { vit: 1 }, kit: [null, null, null, null] });
  s.heroes.push({ name: 'Lu', color: 1, renown: 0, upgrades: {}, kit: [null, null, null, null] });
  const r = createRun(s, [0, 1], 'map1');
  assert.equal(r.lives, 4);
  r.heroes[0].hp = 3;
  assert.equal(heroFell(s, r, 100.4, 200.6), false);
  assert.equal(r.lives, 3, 'the life leaves the pool');
  assert.deepEqual(r.fallen, { hero: 0, x: 100, y: 201 }, 'and waits where the hero fell');
  assert.equal(r.heroes[0].deaths, 1);
  assert.equal(r.heroes[0].hp, 24, 'the fallen hero comes back at full health');
  assert.equal(r.heroes[0].bonusHp, comebackHp(24), 'with comeback health on top');
  assert.equal(comebackHp(24), 6);
  assert.equal(comebackHp(20), 5);
  advanceTurn(r);
  assert.equal(rescueFallen(r), 0, 'the next hero reaches the spot');
  assert.equal(r.lives, 4, 'and the life is back');
  assert.equal(r.fallen, null);
  assert.equal(rescueFallen(r), null, 'nobody left to rescue');
  assert.equal(r.lives, 4);
  // the rescuer falls first: both lives are spent and nobody is left waiting
  assert.equal(heroFell(s, r, 10, 10), false);
  advanceTurn(r);
  assert.equal(heroFell(s, r, 20, 20), false);
  assert.equal(r.lives, 2);
  assert.equal(r.fallen, null);
  // the last life can still be rescued: the party plays on with none in the pool
  assert.equal(heroFell(s, r, 30, 30), false);
  assert.equal(heroFell(s, r, 40, 40), true, 'lives 2: a death and a failed rescue end the run');
  assert.equal(r.lives, 0);
  r.lives = 1;
  r.fallen = null;
  assert.equal(heroFell(s, r, 30, 30), false, 'the last life is held, not lost');
  assert.deepEqual([r.lives, (r.fallen as { hero: number } | null)?.hero], [0, r.active]);
  assert.equal(rescueFallen(r), r.active);
  assert.equal(r.lives, 1);
  assert.equal(heroFell(s, r, 30, 30), false);
  assert.equal(heroFell(s, r, 30, 30), true, 'falling on the last-chance rescue ends the run');
  assert.equal(r.lives, 0, 'lives never go below zero');
  // a save from before rescues existed has no marker: its next death behaves like any first death
  const olderRun = JSON.parse(JSON.stringify(createRun(s, [0], 'map1')));
  delete olderRun.fallen;
  assert.equal(heroFell(s, olderRun, 5, 5), false);
  assert.equal(olderRun.lives, 1);

  // campfires: everyone rests up to half health, nobody is lowered, and the arriving hero's comeback health ends
  const c = createRun(s, [0, 1], 'map1');
  c.heroes[0].hp = 2;
  c.heroes[0].bonusHp = 4;
  c.heroes[1].hp = 17;
  c.heroes[1].bonusHp = 5; // waiting for their turn after a death
  campRest(s, c);
  assert.equal(c.heroes[0].hp, 12, 'half of 24');
  assert.equal(c.heroes[0].bonusHp, 0);
  assert.equal(c.heroes[1].hp, 17, 'a hero above half is left alone');
  assert.equal(c.heroes[1].bonusHp, 5, 'a waiting hero keeps their comeback health');
  c.heroes[1].hp = 1;
  campRest(s, c);
  assert.equal(c.heroes[1].hp, 10, 'half of 20');
}

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

// arrows: a new bow holds 120, piles refill it up to the cap, and only a hero with a bow can use them
assert.equal(newStack('bow').charges, 120);
assert.ok(isLastingWeapon(ITEMS.bow) && !isLastingWeapon(ITEMS.knives) && !isLastingWeapon(ITEMS.bombs));
const archer = run.heroes[1];
archer.slots = [{ id: 'club' }, null, null];
archer.pack.fill(null);
assert.equal(bowEquipped(archer), false);
assert.equal(addArrows(archer, ARROW_PILE), 0, 'no bow, no use for arrows');
archer.pack[0] = { id: 'bow', charges: 0 };
assert.equal(bowEquipped(archer), false, 'a bow in the pack is not equipped');
assert.equal(addArrows(archer, ARROW_PILE), 10, 'a bow in the pack can still be refilled');
archer.slots[1] = { id: 'bow', charges: ARROW_MAX - 4 };
assert.equal(bowEquipped(archer), true);
assert.equal(addArrows(archer, ARROW_PILE), 4, 'the equipped bow fills first, up to the cap');
assert.equal(addArrows(archer, ARROW_PILE), 10, 'then the spare bow');
assert.equal(archer.pack[0]!.charges, 20);
archer.slots[2] = { id: 'bow' }; // a bow saved before arrows existed
fillMissingCharges(run);
assert.equal(archer.slots[2]!.charges, 120);

// ending a run pays out
run.heroes[0].gold = 40;
run.heroes[0].earned = 15;
run.checkpoint = 3;
const sum = finishRun(save, false, []);
assert.equal(sum.rows[0].total, 55);
assert.equal(save.heroes[0].renown, 100 + 55);
assert.deepEqual(sum.rows[0].feats, [], 'no halfway campfire given, no Prowess earned');
assert.equal(save.run, null);
assert.equal(save.knowledge.map1.bestCheckpoint, 3);

// saves round-trip and reject junk
assert.deepEqual(parseSave(JSON.stringify(save)).heroes, save.heroes);
assert.throws(() => parseSave('{"hello":1}'));
// the sword the hidden grove used to unlock is the starter weapon now: an old save has the longsword instead
const oldPool = newSave();
oldPool.pool.push('sword');
const moved = parseSave(JSON.stringify(oldPool)).pool;
assert.ok(moved.includes('longsword') && !moved.includes('sword'));
assert.equal(getMap('map1').objects.find((o) => o.secret === 's1' && o.type === 'pedestal')!.item, 'longsword');

// secret prizes: the item on a secret's pedestal is won once per save, then the pedestal stands empty
{
  const s = newSave();
  s.heroes.push({ name: 'Sy', color: 0, renown: 0, upgrades: {}, kit: [null, null, null, null] });
  const map = getMap('map1');
  const pedestals = map.objects.filter((o) => o.type === 'pedestal' && o.secret);
  assert.deepEqual(pedestals.map((o) => o.secret).sort(), map.secrets.map((x) => x.id).sort(), 'every secret on map 1 has one prize');
  assert.ok(pedestals.every((o) => !STARTER_POOL.includes(o.item!)), 'and each prize is an item a new save has yet to discover');
  const openOf = (r: ReturnType<typeof createRun>, secret: string) => new World(map, r, s).objs.find((o) => o.def.type === 'pedestal' && o.def.secret === secret)!.open;
  let r = createRun(s, [0], 'map1');
  assert.equal(prizeTaken(s, 'map1', 's1'), false);
  assert.equal(openOf(r, 's1'), false, 'the prize waits on a save that has not won it');
  knowledgeOf(s, 'map1').secrets.push('s1');
  assert.equal(openOf(createRun(s, [0], 'map1'), 's1'), false, 'finding the room is not winning the prize');
  takePrize(s, 'map1', 's1');
  takePrize(s, 'map1', 's1');
  assert.deepEqual(s.knowledge.map1.prizes, ['s1'], 'a prize is won once');
  r = createRun(s, [0], 'map1');
  assert.equal(openOf(r, 's1'), true, 'on the next run the pedestal is empty');
  assert.equal(openOf(r, 's2'), false, 'the other secrets still hold theirs');
  const chest = new World(map, r, s).objs.find((o) => o.def.type === 'chest' && o.x === 68 && o.y === 18)!;
  assert.equal(chest.open, false, 'and the chest in the room is there every run');
  assert.deepEqual(parseSave(JSON.stringify(s)).knowledge.map1.prizes, ['s1'], 'prizes survive a save');
  // a save from before prizes: a found secret whose item reached the pool has been won, any other has not
  const older = JSON.parse(JSON.stringify(s));
  delete older.knowledge.map1.prizes;
  older.knowledge.map1.secrets = ['s1', 's2', 's3'];
  older.pool.push('longsword', 'frost');
  assert.deepEqual(parseSave(JSON.stringify(older)).knowledge.map1.prizes, ['s1', 's3'], 'the dash boots were never taken, so that prize still waits');
  older.knowledge.map9 = { secrets: ['x'], shortcuts: [], bestCheckpoint: 0, clears: 0 };
  assert.deepEqual(parseSave(JSON.stringify(older)).knowledge.map9.prizes, ['x'], 'a map this build does not know is left as found');
}
// a kit of three actives leaves no slot free, so the starter weapon rides in the pack
const kitted = newSave();
kitted.created = 1764000000000;
kitted.heroes.push({ name: 'Jo', color: 0, renown: 0, upgrades: {}, kit: [null, null, null, null], feats: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
assert.equal(prowess(kitted.heroes[0]), 10);
const fullOffer = kitOffer(kitted, 0).filter((id) => ITEMS[id].slot === 'active').slice(0, 3);
fullOffer.forEach((id) => assert.equal(toggleKitItem(kitted, 0, id), 'added'));
assert.equal(toggleKitItem(kitted, 0, kitOffer(kitted, 0).find((id) => ITEMS[id].slot === 'active' && !fullOffer.includes(id))!), 'full', 'three active slots at most');
const fullRun = createRun(kitted, [0], 'map1').heroes[0];
assert.deepEqual(fullRun.slots.map((s) => s?.id), fullOffer);
assert.equal(fullRun.pack[0]?.id, STARTER_WEAPON);
assert.equal(kitted.heroes[0].renown, 0, 'with no renown at all');
// a kit that costs more than the hero's Prowess (an edited or older save) is cut back to what it covers
kitted.heroes[0].feats = [];
kitted.heroes[0].kit = kitOffer(kitted, 0).filter((id) => ITEMS[id].slot === 'active').slice(0, 3).concat(kitOffer(kitted, 0).find((id) => ITEMS[id].slot === 'passive')!);
trimKit(kitted, 0);
assert.ok(kitCost(kitted.heroes[0]) <= 3 && kitted.heroes[0].kit[0], 'the first choices are the ones kept');

// newly discovered items are offered to everyone before the next run, then take their chances
{
  const s = newSave();
  s.created = 1764000000000;
  s.heroes.push({ name: 'Mo', color: 0, renown: 0, upgrades: {}, kit: [null, null, null, null] }, { name: 'Ny', color: 1, renown: 0, upgrades: {}, kit: [null, null, null, null] });
  assert.equal(discoverItem(s, 'cleaver'), true);
  assert.equal(discoverItem(s, 'cleaver'), false, 'an item is discovered once');
  assert.equal(discoverItem(s, 'club'), false, 'a known item is not a discovery');
  assert.equal(discoverItem(s, 'vigor'), true);
  assert.deepEqual(s.fresh, ['cleaver', 'vigor']);
  for (let n = 0; n < 40; n++) {
    s.runsPlayed = n;
    for (const h of [0, 1]) assert.ok(['cleaver', 'vigor'].every((id) => kitOffer(s, h).includes(id)), 'both discoveries are on offer');
  }
  assert.equal(toggleKitItem(s, 0, 'cleaver'), 'cost', 'but a rare item is out of a new hero\'s reach');
  createRun(s, [0, 1], 'map1');
  assert.deepEqual(s.fresh, [], 'only until a run has started');
  assert.ok(s.pool.includes('cleaver') && s.pool.includes('vigor'));
}

// achievements raise Prowess by one each, once per hero
{
  const s = newSave();
  s.heroes.push({ name: 'Ox', color: 0, renown: 0, upgrades: {}, kit: [null, null, null, null] }, { name: 'Pi', color: 1, renown: 0, upgrades: {}, kit: [null, null, null, null] });
  const play = (checkpoint: number, won: boolean, deaths = [0, 0]) => {
    s.run = createRun(s, [0, 1], 'map1');
    s.run.checkpoint = checkpoint;
    s.run.heroes.forEach((rh, i) => (rh.deaths = deaths[i]));
    return finishRun(s, won, [], 3).rows.map((r) => r.feats);
  };
  assert.deepEqual(play(2, false), [[], []], 'short of the halfway campfire');
  assert.deepEqual(play(3, false), [[FEATS.half], [FEATS.half]]);
  assert.deepEqual(s.heroes.map(prowess), [4, 4]);
  assert.deepEqual(play(4, false), [[], []], 'the same achievement does not count twice');
  assert.deepEqual(play(5, true, [0, 2]), [[clearFeat(1), FEATS.deathless], [clearFeat(1)]]);
  assert.deepEqual(s.heroes.map(prowess), [6, 5]);
  assert.deepEqual(s.heroes[1].feats, ['half:map1', 'clear:map1:1']);
  assert.deepEqual(play(5, true, [1, 0]), [[], [FEATS.deathless]], 'a later clean clear still counts');
  assert.deepEqual(play(5, true), [[], []]);
  assert.deepEqual(s.heroes.map(prowess), [6, 6]);
  s.heroes.push({ name: 'Qu', color: 2, renown: 0, upgrades: {}, kit: [null, null, null, null] });
  s.run = createRun(s, [2], 'map1');
  const first = finishRun(s, true, [], 3).rows[0];
  assert.deepEqual(first.feats, [FEATS.half, clearFeat(1), FEATS.deathless], 'a clear counts for the halfway campfire too');
  assert.equal(first.prowess, 6);
  assert.deepEqual(parseSave(JSON.stringify(s)).heroes.map(prowess), [6, 6, 6], 'Prowess survives a save');
}
assert.throws(() => parseSave('not json'));

// ---------------------------------------------------------------- difficulty tiers

// the table: three tiers, each tougher than the one before, and no dens or nests on the lowest
assert.deepEqual(TIERS.map((t) => t.tier), [1, 2, 3]);
for (let i = 1; i < TIERS.length; i++) {
  const [a, b] = [TIERS[i - 1], TIERS[i]];
  assert.ok(b.hp > a.hp && b.dmg > a.dmg && b.hearts < a.hearts && b.clearBonus > a.clearBonus && b.trapChance > a.trapChance, `${b.name} is harder than ${a.name} and pays more`);
}
assert.equal(TIERS[0].generators, false, 'no monster generators on the lowest tier');
assert.ok(TIERS[1].generators && TIERS[2].generators);
assert.equal(tierDef(undefined).tier, 1, 'a run saved before tiers plays as tier 1');
assert.equal(tierDef(9).tier, 1);

// monsters: the same creatures with the tier's health and damage
{
  const [t1, t2, t3] = TIERS;
  const stat = (id: string, t: (typeof TIERS)[number]) => [tierMonster(MONSTERS[id], t).hp, tierMonster(MONSTERS[id], t).dmg];
  assert.deepEqual([stat('wolf', t1), stat('wolf', t2), stat('wolf', t3)], [[6, 3], [10, 5], [12, 6]]);
  assert.deepEqual([stat('bandit', t1), stat('bandit', t2), stat('bandit', t3)], [[10, 4], [16, 6], [20, 8]]);
  assert.equal(tierMonster(MONSTERS.wolf, t2).id, 'wolf', 'the bestiary knows it as the same monster');
  assert.equal(tierMonster(MONSTERS.den, t3).dmg, 0, 'a den still does no damage itself');
  assert.equal(MONSTERS.wolf.hp, 8, 'the base table is untouched');
  for (const m of Object.values(MONSTERS)) {
    if (m.dmg > 0) assert.ok(tierMonster(m, t1).dmg >= 1, `${m.id} still hurts on tier 1`);
    // the starter sword hits for 4: on the lowest tier nothing but the boss takes more than three swings
    const variant = Object.values(t3.variants).some(([id]) => id === m.id); // never met on tier 1
    if (m.ai !== 'boss' && m.ai !== 'generator' && !variant) assert.ok(Math.ceil(tierMonster(m, t1).hp / 4) <= 3, `${m.id} falls to three sword hits on tier 1`);
  }
  assert.deepEqual(CHIEF_PHASES.map((h) => scaleHp(h, t1)), [40, 44, 52]);
  assert.deepEqual([scaleDmg(6, t1), scaleDmg(6, t2), scaleDmg(6, t3)], [5, 8, 10], "the Chief's cleave");
}

// map 1's monsters on each tier: tier 1 has the shared roster and no generator, higher tiers add to the packs
{
  const map = getMap('map1');
  const shared = map.spawns.filter((sp) => !sp.minTier);
  assert.equal(new Set(map.spawns.map((sp) => sp.id)).size, map.spawns.length, 'spawn ids are unique');
  assert.deepEqual(shared.map((sp) => sp.id), shared.map((_, i) => `m${i}`), 'monsters every tier shares keep their old ids, so a run in progress is not disturbed');
  for (let seed = 1; seed <= 60; seed++) {
    const roster = (tier: number) => map.spawns.map((sp) => spawnOn(sp, seed * 7919, TIERS[tier - 1])).filter((x): x is string => !!x);
    const gens = (tier: number) => roster(tier).filter((id) => MONSTERS[id].ai === 'generator').length;
    assert.equal(roster(1).length, shared.length);
    assert.equal(gens(1), 0, 'tier 1: a wolf and a spider stand where the den and the nest would be');
    assert.equal(gens(2), 2);
    assert.equal(gens(3), 3);
    assert.ok(roster(2).length > roster(1).length && roster(3).length > roster(2).length);
    // apart from the generators, a spawn point holds the same monster on every tier
    for (const sp of shared) {
      const [a, b] = [spawnOn(sp, seed * 7919, TIERS[0])!, spawnOn(sp, seed * 7919, TIERS[1])!];
      assert.ok(a === b || (MONSTERS[b].ai === 'generator' && MONSTERS[a].ai !== 'generator') || TIERS[1].variants[a]?.[0] === b, `${sp.id}: ${a} on tier 1, ${b} on tier 2`);
    }
  }
  // the key chest by the den must be guarded by something on every tier
  const den = map.spawns.find((sp) => sp.options.includes('den'))!;
  assert.equal(spawnOn(den, 1, TIERS[0]), 'wolf');
  assert.equal(spawnOn(den, 1, TIERS[1]), 'den');
}

// unlocking: a tier opens when the tier below it is cleared on that map; rewards grow with the tier
{
  const s = newSave();
  s.created = 1764000000000;
  s.heroes.push({ name: 'Ty', color: 0, renown: 0, upgrades: {}, kit: [null, null, null, null] }, { name: 'Uz', color: 1, renown: 0, upgrades: {}, kit: [null, null, null, null] });
  assert.deepEqual([1, 2, 3, 4].map((t) => tierUnlocked(s, 'map1', t)), [true, false, false, false]);
  assert.equal(featsOpen(s.heroes[0], 'map1', 1), 3, 'halfway, the clear and the clear without falling');
  s.run = createRun(s, [0], 'map1', 2);
  assert.equal(runTier(s.run), 1, 'a tier that is not open yet plays as tier 1');
  const play = (tier: number, won: boolean, party = [0]) => {
    s.run = createRun(s, party, 'map1', tier);
    assert.equal(runTier(s.run), tier);
    return finishRun(s, won, [], 3);
  };
  const lost = play(1, false);
  assert.deepEqual([lost.tier, lost.opened, lost.rows[0].bonus], [1, [], 0]);
  assert.equal(tierUnlocked(s, 'map1', 2), false, 'losing opens nothing');
  const first = play(1, true);
  assert.deepEqual(first.opened, ['The Veteran tier of this map is open.']);
  assert.equal(first.rows[0].bonus, 30);
  assert.deepEqual(s.knowledge.map1.tierClears, [1, 0, 0]);
  assert.deepEqual([1, 2, 3].map((t) => tierUnlocked(s, 'map1', t)), [true, true, false]);
  assert.deepEqual(play(1, true).opened, [], 'a tier opens once');
  assert.equal(pinSlots(s), 1);
  assert.equal(kitOffer(s, 0).length, KIT_OFFER_SIZE);
  assert.equal(featsOpen(s.heroes[0], 'map1', 1), 0);
  assert.equal(featsOpen(s.heroes[0], 'map1', 2), 1, 'the clear on the new tier');
  const second = play(2, true, [0, 1]);
  assert.deepEqual(second.opened, ['The Legend tier of this map is open.', 'Every hero may now pin a second signature item.']);
  assert.deepEqual(second.rows.map((r) => r.bonus), [60, 60]);
  assert.deepEqual(second.rows[0].feats, [clearFeat(2)], 'a first clear of each tier raises Prowess');
  assert.deepEqual(second.rows[1].feats, [FEATS.half, clearFeat(2), FEATS.deathless]);
  assert.ok(s.heroes[0].feats!.includes('clear:map1:1') && s.heroes[0].feats!.includes('clear:map1:2'));
  assert.equal(s.heroes[1].feats!.includes('clear:map1:1'), false, 'a hero who was not there has not cleared tier 1');
  assert.equal(pinSlots(s), 2);
  assert.equal(everCleared(s, 3), false);
  const third = play(3, true);
  assert.deepEqual(third.opened, ['Every starter kit offer now holds one more item.']);
  assert.equal(third.rows[0].bonus, 100);
  assert.deepEqual(s.knowledge.map1.tierClears, [2, 1, 1]);
  assert.equal(s.knowledge.map1.clears, 4);
  assert.equal(kitOffer(s, 0).length, KIT_OFFER_SIZE + 1, 'a first tier 3 clear widens every offer');
  assert.deepEqual([1, 2, 3].map((t) => tierClears(parseSave(JSON.stringify(s)), 'map1', t)), [2, 1, 1], 'tier clears survive a save');

  // two pin slots: a second pin is added, a click on a pinned item unpins it, and a third pushes out the oldest
  assert.equal(setPin(s, 0, 'club'), true);
  assert.equal(setPin(s, 0, 'bow'), true);
  assert.deepEqual(pinsOf(s, 0), ['club', 'bow']);
  assert.ok(!kitOffer(s, 0).includes('club') && !kitOffer(s, 0).includes('bow'), 'pinned items are not offered twice');
  assert.equal(setPin(s, 0, 'spear'), true);
  assert.deepEqual(pinsOf(s, 0), ['bow', 'spear']);
  assert.equal(setPin(s, 0, 'bow'), true);
  assert.deepEqual(pinsOf(s, 0), ['spear']);
  assert.equal(setPin(s, 0, null), true);
  assert.deepEqual(pinsOf(s, 0), []);
}

// a save from before tiers: every clear it has was on tier 1
{
  const s = newSave();
  s.heroes.push({ name: 'Vi', color: 0, renown: 0, upgrades: {}, kit: [null, null, null, null], feats: ['half:map1', 'clear:map1:1'] });
  s.knowledge.map1 = { secrets: [], shortcuts: [], bestCheckpoint: 5, clears: 2 };
  const old = parseSave(JSON.stringify(s));
  assert.deepEqual([1, 2, 3].map((t) => tierClears(old, 'map1', t)), [2, 0, 0]);
  assert.deepEqual([1, 2, 3].map((t) => tierUnlocked(old, 'map1', t)), [true, true, false], 'so its tier 2 is open');
  old.run = createRun(old, [0], 'map1', 2);
  finishRun(old, true, [], 3);
  assert.deepEqual(old.knowledge.map1.tierClears, [2, 1, 0]);
  assert.equal(old.knowledge.map1.clears, 3);
  // a run it had in progress carries no tier and plays on tier 1
  old.run = createRun(old, [0], 'map1');
  delete old.run.tier;
  assert.equal(runTier(parseSave(JSON.stringify(old)).run!), 1);
}

// traps and loot follow the tier
{
  const s = newSave();
  s.heroes.push({ name: 'Wu', color: 0, renown: 0, upgrades: {}, kit: [null, null, null, null] });
  s.pool = ITEM_LIST.map((d) => d.id);
  s.knowledge.map1 = { secrets: [], shortcuts: [], bestCheckpoint: 0, clears: 3, tierClears: [1, 1, 1] };
  const map = getMap('map1');
  const optional = map.objects.filter((o) => o.chance !== undefined);
  assert.ok(optional.length > 0);
  const count = [0, 0, 0];
  const rarity = [0, 0, 0];
  for (let i = 0; i < 80; i++) {
    for (const tier of [1, 2, 3]) {
      const r = createRun(s, [0], 'map1', tier);
      r.seed = (i + 1) * 104729;
      count[tier - 1] += new World(map, r, s).objs.filter((o) => o.def.chance !== undefined && o.exists).length;
      for (const kind of ['weapon', 'common', 'good', 'rare'] as const) rarity[tier - 1] += ITEMS[rollChest(r, s, 'c' + kind, kind).item.id].rarity;
    }
  }
  assert.equal(count[2], optional.length * 80, 'every optional trap is armed on tier 3');
  assert.ok(count[0] < count[1] && count[1] < count[2], 'more traps on each tier');
  assert.ok(rarity[0] < rarity[1] && rarity[1] < rarity[2], 'chests lean rarer on each tier');
}

// ---------------------------------------------------------------- each tier's own secrets and items

// the layout is the same on every tier: tiles differ only around the hiding places
{
  const [m1, m2, m3] = [1, 2, 3].map((t) => getMap('map1', t));
  assert.deepEqual([m1.tier, m2.tier, m3.tier], [1, 2, 3]);
  const boxes = [
    [66, 16, 74, 22], [129, 60, 135, 66], [71, 86, 79, 94], // tier 1: the grove, the crooked torch, across the gap
    [30, 56, 41, 63], [104, 65, 111, 69], [116, 68, 116, 71], // tier 2: the slab in the rock, the far lever and its room
    [72, 72, 72, 75], [81, 87, 89, 92], [107, 2, 117, 10], // tier 3: the cold brazier and its room, behind the den
  ];
  for (const m of [m2, m3]) {
    let changed = 0;
    for (let i = 0; i < m.tiles.length; i++) {
      if (m.tiles[i] === m1.tiles[i]) continue;
      const [x, y] = [i % m.w, Math.floor(i / m.w)];
      assert.ok(boxes.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1), `tier ${m.tier} differs from tier 1 at ${x},${y}, outside any hiding place`);
      changed++;
    }
    assert.ok(changed > 0);
    assert.deepEqual(m.checkpoints, m1.checkpoints);
    assert.deepEqual(m.spawns, m1.spawns, 'monster spawn points are shared');
    // everything that is not part of a secret is in the same place
    const shared = (map: typeof m) => map.objects.filter((o) => !boxes.some(([x0, y0, x1, y1]) => o.x >= x0 && o.x <= x1 && o.y >= y0 && o.y <= y1) && !(o.x === 127 && o.y === 58) && !['slab', 'farlever', 'coldfire'].includes(o.puzzle ?? '')).map((o) => `${o.type}@${o.x},${o.y}`);
    assert.deepEqual(shared(m), shared(m1));
  }
  // tier 1 is built exactly as before tiers, so a run in progress still finds its chests and pedestals
  for (const [id, x, y] of [['pedestal14', 70, 18], ['chest15', 68, 18], ['lever61', 91, 77], ['shrine69', 73, 91], ['pedestal70', 77, 91]] as const) {
    const o = m1.objects.find((q) => q.id === id)!;
    assert.deepEqual([o.x, o.y], [x, y], `${id} keeps its id`);
  }

  // secrets: three on tier 1, two each on the higher tiers, none shared
  assert.deepEqual([m1, m2, m3].map((m) => m.secrets.map((x) => x.id)), [['s1', 's2', 's3'], ['v1', 'v2'], ['l1', 'l2']]);
  for (const m of [m1, m2, m3]) {
    for (const sec of m.secrets) {
      assert.equal(m.objects.filter((o) => o.type === 'secret' && o.secret === sec.id).length, 1, `${sec.id} has a hidden area`);
      const ped = m.objects.filter((o) => o.type === 'pedestal' && o.secret === sec.id);
      assert.equal(ped.length, 1, `${sec.id} has a prize pedestal`);
      assert.ok(ped[0].item ? ITEMS[ped[0].item] : ped[0].prize, `${sec.id}'s pedestal holds something`);
    }
    assert.ok(m.objects.every((o) => !o.secret || m.secrets.some((x) => x.id === o.secret)), 'no object belongs to another tier\'s secret');
    for (const id of m.clearUnlocks) assert.ok(ITEMS[id] && !ITEMS[id].starter, `${id} is unlocked by a clear`);
  }
  assert.deepEqual([m1, m2, m3].map((m) => m.clearUnlocks), [['cleaver', 'vigor'], ['berserk'], ['kingsplitter']]);
  // tier 1's hiding places are sealed on the higher tiers
  for (const m of [m2, m3]) {
    assert.notEqual(m.tiles[22 * m.w + 70], T.Cracked, 'no cracked rock at the grove');
    assert.equal(m.objects.find((o) => o.x === 127 && o.y === 58)!.puzzle, undefined, 'the torch is an ordinary one');
    assert.ok(!m.objects.some((o) => o.type === 'hidden' && o.puzzle === 'torch'));
    assert.equal(m.tiles[87 * m.w + 75], T.CaveWall, 'no gap to cross');
  }
  assert.equal(m1.tiles[22 * m1.w + 70], T.Cracked);
  // the tier-only items: two rare, two legendary, one from a secret and one from the Chief on each tier
  const only = (m: typeof m1) => [...m.objects.filter((o) => o.type === 'pedestal' && o.item).map((o) => o.item!), ...m.clearUnlocks];
  assert.deepEqual(only(m2).map((id) => ITEMS[id].rarity), [2, 2]);
  assert.deepEqual(only(m3).map((id) => ITEMS[id].rarity), [3, 3]);
  assert.deepEqual([...only(m2), ...only(m3)].sort(), ['berserk', 'dawn', 'ember', 'kingsplitter']);
  assert.deepEqual(['ember', 'dawn', 'kingsplitter', 'berserk'].map((id) => kitRole(ITEMS[id])), ['weapon', 'weapon', 'weapon', 'passive']);
  assert.ok(ITEM_LIST.filter((d) => d.rarity === 3).every((d) => d.kit === 8), 'a hero with every feat of one map can start with one legendary');
}

// the Veteran secrets work: the slab answers to the plate, the far lever cannot be walked to
{
  const s = newSave();
  s.heroes.push({ name: 'Xi', color: 0, renown: 0, upgrades: {}, kit: [null, null, null, null] });
  s.pool.push('cleaver', 'vigor'); // what the tier 1 clear that opened Veteran unlocked
  s.knowledge.map1 = { secrets: [], shortcuts: [], bestCheckpoint: 0, clears: 2, tierClears: [1, 1, 0] };
  const map = getMap('map1', 2);
  const r = createRun(s, [0], 'map1', 2);
  const w2 = new World(map, r, s);
  const slab = w2.objs.find((o) => o.def.type === 'hidden' && o.def.puzzle === 'slab')!;
  const plate = w2.objs.find((o) => o.def.type === 'plate' && o.def.puzzle === 'slab')!;
  const stone = w2.objs.find((o) => o.def.type === 'block' && o.def.puzzle === 'slab')!;
  assert.equal(slab.open, false);
  assert.ok(w2.solid(slab.x, slab.y));
  w2.updatePlates(plate.x, plate.y);
  w2.syncGates();
  assert.ok(slab.open && w2.walkable(slab.x, slab.y), 'standing on the plate slides the slab away');
  w2.updatePlates(plate.x, plate.y - 1);
  w2.syncGates();
  assert.equal(slab.open, false, 'and stepping off lets it close');
  // the stone can be walked to the plate: east along row 61, then north up column 28
  for (const [x, y] of [[27, 61], [28, 61], [28, 60], [28, 59], [28, 58], [25, 61], [28, 62]]) assert.ok(w2.walkable(x, y) || (x === stone.x && y === stone.y), `${x},${y} is open ground`);
  [stone.x, stone.y] = [plate.x, plate.y];
  assert.deepEqual(w2.updatePlates(-1, -1), ['slab'], 'the stone on the plate solves it for the run');
  // the far lever stands behind two pits; the room it opens holds a prize pedestal
  const lever = w2.objs.find((o) => o.def.type === 'lever' && o.def.puzzle === 'farlever')!;
  assert.ok(w2.pit(lever.x, lever.y - 1) && w2.pit(lever.x, lever.y - 2) && w2.walkable(lever.x, lever.y - 3));
  const prize = w2.objs.find((o) => o.def.secret === 'v2' && o.def.type === 'pedestal')!;
  assert.ok(ITEMS[prize.item!].rarity >= 2, 'a rare or better item waits there');
  assert.equal(w2.objs.find((o) => o.def.secret === 'v1' && o.def.type === 'pedestal')!.item, 'ember');
  // prizes are won per secret, so per tier
  takePrize(s, 'map1', 'v1');
  const again = new World(map, createRun(s, [0], 'map1', 2), s);
  assert.equal(again.objs.find((o) => o.def.secret === 'v1' && o.def.type === 'pedestal')!.open, true);
  assert.equal(again.objs.find((o) => o.def.secret === 'v2' && o.def.type === 'pedestal')!.open, false);
  assert.ok(new World(getMap('map1', 1), createRun(s, [0], 'map1', 1), s).objs.filter((o) => o.def.type === 'pedestal').every((o) => !o.open), 'tier 1 prizes still wait');
  // Legend: the brazier is out of reach across the pit, and the den's back wall is cracked
  const w3 = new World(getMap('map1', 3), createRun({ ...s, knowledge: { map1: { ...s.knowledge.map1, tierClears: [1, 1, 1] } } }, [0], 'map1', 3), s);
  const cold = w3.objs.find((o) => o.def.type === 'brazier' && o.def.puzzle === 'coldfire')!;
  assert.ok(w3.pit(cold.x, cold.y + 1) && w3.pit(cold.x, cold.y + 2) && w3.walkable(cold.x, cold.y + 3));
  assert.equal(w3.tile(112, 8), T.Cracked);
  assert.ok(w3.walkable(112, 9) && w3.walkable(112, 7));
  assert.equal(w3.objs.find((o) => o.def.secret === 'l1' && o.def.type === 'pedestal')!.item, 'dawn');
}

// prize pedestals and legendary loot
{
  const s = newSave();
  s.heroes.push({ name: 'Yo', color: 0, renown: 0, upgrades: {}, kit: [null, null, null, null] });
  s.knowledge.map1 = { secrets: [], shortcuts: [], bestCheckpoint: 0, clears: 3, tierClears: [1, 1, 1] };
  const ped = getMap('map1', 2).objects.find((o) => o.secret === 'v2' && o.type === 'pedestal')!;
  const r = createRun(s, [0], 'map1', 2);
  assert.equal(pedestalItem(r, s, getMap('map1', 2).objects.find((o) => o.secret === 'v1' && o.type === 'pedestal')!), 'ember', 'a named item is what it is');
  assert.equal(ITEMS[pedestalItem(r, s, ped)].rarity, 1, 'a pool without rares pays its best');
  s.pool.push('cleaver', 'vigor', 'frost');
  const seen = new Set<string>();
  for (let i = 1; i <= 60; i++) {
    r.seed = i * 7919;
    const id = pedestalItem(r, s, ped);
    assert.equal(id, pedestalItem(r, s, ped), 'the same prize for the whole run');
    assert.ok(ITEMS[id].rarity >= 2, 'rare or better');
    seen.add(id);
  }
  assert.ok(seen.size > 1, 'and not always the same one');
  // legendaries turn up only in the best chests, more often on higher tiers
  s.pool = ITEM_LIST.map((d) => d.id);
  const legends = [0, 0, 0];
  for (let i = 1; i <= 300; i++)
    for (const tier of [1, 2, 3]) {
      const run = createRun(s, [0], 'map1', tier);
      run.seed = i * 104729;
      for (const kind of ['weapon', 'common'] as const) assert.ok(ITEMS[rollChest(run, s, 'c', kind).item.id].rarity < 3, 'never in an ordinary chest');
      if (ITEMS[rollChest(run, s, 'c', 'rare').item.id].rarity === 3) legends[tier - 1]++;
    }
  assert.ok(legends[0] > 0 && legends[0] < legends[1] && legends[1] < legends[2], `legendaries by tier: ${legends}`);
}

// ---------------------------------------------------------------- monster variants and the boss's added attacks

// a variant is the same kind of monster as the one it replaces, with one thing of its own and its own look
{
  for (const m of Object.values(MONSTERS)) if (m.sheet !== 'objects') assert.ok(SHEETS[m.sheet], `${m.id} has a sprite sheet`);
  assert.deepEqual(TIERS.map((t) => Object.keys(t.variants).length), [0, 2, 4], 'none on tier 1, two kinds on tier 2, four on tier 3');
  for (const t of TIERS)
    for (const [base, [id, chance]] of Object.entries(t.variants)) {
      const [b, v] = [MONSTERS[base], MONSTERS[id]];
      assert.ok(b && v && v.ai === b.ai, `${id} behaves like ${base}`);
      assert.ok(v.sheet !== b.sheet && v.hp > b.hp && v.dmg >= b.dmg, `${id} looks different and is tougher`);
      assert.ok(v.split || v.lunges || v.volley || v.heavy, `${id} has a trick of its own`);
      assert.ok(chance > 0 && chance < 1);
      assert.ok(!TIERS[t.tier - 2] || (TIERS[t.tier - 2].variants[base]?.[1] ?? 0) <= chance, 'more common on the higher tier');
    }
  assert.equal(MONSTERS[MONSTERS.brood.split!].split, undefined, 'the young of a brood slime do not split again');
  // how many of them a run meets on map 1
  const map = getMap('map1');
  const seen = [new Map<string, number>(), new Map<string, number>(), new Map<string, number>()];
  const SEEDS = 200;
  for (let seed = 1; seed <= SEEDS; seed++)
    for (const t of TIERS)
      for (const sp of map.spawns) {
        const id = spawnOn(sp, seed * 7919, t);
        if (id && Object.values(TIERS[2].variants).some(([v]) => v === id)) seen[t.tier - 1].set(id, (seen[t.tier - 1].get(id) ?? 0) + 1);
        assert.equal(id, spawnOn(sp, seed * 7919, t), 'the same monster after a reload');
      }
  const per = (tier: number) => [...seen[tier - 1].values()].reduce((a, b) => a + b, 0) / SEEDS;
  assert.equal(per(1), 0, 'tier 1 has no variants');
  assert.deepEqual([...seen[1].keys()].sort(), ['brood', 'dire']);
  assert.deepEqual([...seen[2].keys()].sort(), ['brood', 'dire', 'brute', 'marksman'].sort());
  assert.ok(per(2) > 3 && per(2) < 9, `about a handful on tier 2: ${per(2)}`);
  assert.ok(per(3) > 2 * per(2) && per(3) < 30, `and many more on tier 3: ${per(3)}`);
  // the boss: no added attack on tier 1, a slam on tier 2, a slam and a leap on tier 3
  assert.deepEqual(TIERS.map((t) => t.bossMoves), [[], ['slam'], ['slam', 'leap']]);
  for (const t of TIERS) for (const id of t.bossHelp.flat()) assert.ok(MONSTERS[id], `${id} can be called in`);
}

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
// a chosen kit holds no renown back: kits are paid with Prowess, so every coin can go on upgrades
const keen = { name: 'Fi', color: 1, renown: 25, upgrades: {}, kit: ['bow', null, null, null] };
assert.equal(buyUpgrade(keen, 'vit'), true);
assert.equal(keen.renown, 0);
assert.deepEqual(keen.kit, ['bow', null, null, null], 'and the kit stays chosen');
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
assert.equal(outfit(cy, newStack('bow')).charges, 156);
assert.ok(156 <= ARROW_MAX);
assert.equal(outfit(t.heroes[1], newStack('bow')).charges, 120);
assert.equal(outfit(cy, newStack('club')).charges, undefined);

// Wider Offer: a seventh offer, of any role
assert.equal(kitOffer(t, 0).length, KIT_OFFER_SIZE + 1, 'Wider Offer adds a seventh choice');
assert.equal(kitOffer(t, 1).length, KIT_OFFER_SIZE);
assert.ok(KIT_ROLES.every((r) => kitOffer(t, 0).filter((id) => kitRole(ITEMS[id]) === r.role).length >= r.offers));

// re-rolls cost renown: 10, 20, 40. Second Look makes the first free and Quartermaster takes 15% off a level
const plain = t.heroes[1];
assert.equal(rerollPrice(t, 1), 10);
assert.equal(rerollBlock(t, 1), 'cost', 'no renown, no re-roll');
assert.equal(rerollKit(t, 1), false);
plain.renown = 35;
const bareOffer = kitOffer(t, 1);
assert.equal(rerollKit(t, 1), true);
assert.notDeepEqual(kitOffer(t, 1), bareOffer, 'the re-roll draws a different offer');
assert.deepEqual(kitOffer(t, 1), kitOffer(t, 1));
assert.deepEqual([plain.renown, rerollPrice(t, 1)], [25, 20]);
assert.equal(rerollKit(t, 1), true);
assert.deepEqual([plain.renown, rerollPrice(t, 1)], [5, 40]);
assert.equal(rerollBlock(t, 1), 'cost');
plain.renown = 0;
assert.equal(rerollPrice(t, 0), 0, 'Second Look: the first re-roll is free');
setPin(t, 0, 'bow');
assert.equal(toggleKitItem(t, 0, 'bow'), 'added');
const cyRenown = cy.renown;
assert.equal(rerollKit(t, 0), true);
assert.equal(cy.renown, cyRenown);
assert.equal(cy.kit[0], 'bow', 'a pinned item stays in the kit through a re-roll');
assert.ok(cy.kit.every((id) => !id || kitChoices(t, 0).includes(id)));
assert.equal(rerollPrice(t, 0), 6, '10 less three levels of Quartermaster, rounded up');
cy.renown = 100;
assert.equal(rerollKit(t, 0), true);
assert.deepEqual([cy.renown, rerollPrice(t, 0)], [94, 11]);
setPin(t, 0, null);
cy.kit = [null, null, null, null];
// with everything unlocked already on offer there is nothing to re-roll into
const small = newSave();
small.pool = ['club', 'bow', 'knives', 'bombs', 'armour', 'lantern'];
small.heroes.push({ name: 'Ro', color: 0, renown: 500, upgrades: {}, kit: [null, null, null, null] });
assert.equal(kitOffer(small, 0).length, 6);
assert.equal(rerollBlock(small, 0), 'same');
small.pool.push('spear');
assert.equal(rerollBlock(small, 0), null);
// a pool short of one role fills the place from the others
small.pool = ['club', 'bow', 'spear', 'knives', 'bombs', 'shield', 'scroll', 'armour'];
for (let n = 0; n < 50; n++) {
  small.runsPlayed = n;
  const roles = kitOffer(small, 0).map((id) => kitRole(ITEMS[id]));
  assert.equal(roles.length, KIT_OFFER_SIZE, 'still six offers');
  assert.equal(roles.filter((r) => r === 'passive').length, 1, 'the one passive there is');
  assert.ok(roles.filter((r) => r === 'weapon').length >= 2 && roles.filter((r) => r === 'active').length >= 2, 'and the spare place goes to a weapon or a tool');
}

// Pocket Change, Haggler, Cartographer
t.knowledge.map1 = { secrets: [], shortcuts: [], bestCheckpoint: 2, clears: 0, explored: packBits(Uint8Array.from([1, 0, 1, 1, 0, 0, 0, 0, 1])) };
cy.renown = 1000;
const picked = kitOffer(t, 0)[0];
assert.equal(toggleKitItem(t, 0, picked), 'added');
const r2 = createRun(t, [0, 1], 'map1');
t.run = r2;
assert.equal(cy.renown, 1000, 'the kit costs no renown');
assert.equal(r2.heroes[0].slots[0]?.id, picked);
assert.equal(rerollPrice(t, 0), 0, 'the free re-roll comes back for the next run');
assert.equal(rerollPrice(t, 1), 10, 'and the price starts again at 10');
assert.equal(r2.heroes[0].gold, 45);
assert.equal(r2.heroes[1].gold, 0);
assert.equal(r2.explored, t.knowledge.map1.explored, 'a party with a Cartographer starts with the old map');
assert.equal(createRun(t, [1], 'map1').explored, '', 'a party without one starts blind');
t.runsPlayed--;
const entry = shopStock(r2, t, 2)[0];
assert.equal(toggleKitItem(t, 1, kitOffer(t, 1)[0]), 'running', 'no kit can be chosen while a run is in progress');
assert.deepEqual(t.heroes[1].kit, [null, null, null, null]);
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

// control styles: a hero without the setting aims with the mouse, and the setting survives a save
assert.equal(controlsOf({ name: 'Gi', color: 0, renown: 0, upgrades: {}, kit: [] }), 'mouse');
assert.equal(controlsOf({ name: 'Gi', color: 0, renown: 0, upgrades: {}, kit: [], controls: 'facing' }), 'facing');
assert.equal(controlsOf({ name: 'Gi', color: 0, renown: 0, upgrades: {}, kit: [], controls: 'junk' as never }), 'mouse', 'an unknown style in an imported save falls back to the mouse');
const styled = newSave();
styled.heroes.push({ name: 'Hu', color: 2, renown: 0, upgrades: {}, kit: [null, null, null, null], controls: 'facing' });
assert.equal(controlsOf(parseSave(JSON.stringify(styled)).heroes[0]), 'facing');

// aim assist, hero at the origin facing right (+x); y grows downward
const mon = (x: number, y: number, r = 5) => ({ x, y, r });
const ahead = mon(30, 4);
const closeButWide = mon(12, 14);
const behind = mon(-10, 0);
assert.equal(pickTarget([behind, closeButWide, ahead], 0, 0, 0, 60, MELEE_CONE), ahead, 'in line with the facing beats closer but off to the side');
assert.equal(pickTarget([behind], 0, 0, 0, 60, MELEE_CONE), null, 'nothing behind the hero is picked');
assert.equal(pickTarget([mon(70, 0)], 0, 0, 0, 60, MELEE_CONE), null, 'out of reach');
assert.ok(pickTarget([mon(69, 0, 10)], 0, 0, 0, 60, MELEE_CONE), 'reach is measured to the edge of the body');
const diag = mon(40, 30); // 0.64 rad off the facing
assert.equal(pickTarget([diag], 0, 0, 0, 100, MELEE_CONE), diag);
assert.equal(pickTarget([diag], 0, 0, 0, 100, RANGED_CONE), diag, 'just inside the narrower cone for shots');
assert.equal(pickTarget([mon(40, 34)], 0, 0, 0, 100, RANGED_CONE), null, 'and just outside it');
for (let a = 0; a < Math.PI * 2; a += 0.05) {
  // whatever the bearing, one of the eight facings puts a monster inside the cone for shots
  const m = mon(Math.cos(a) * 80, Math.sin(a) * 80);
  assert.ok([0, 1, 2, 3, 4, 5, 6, 7].some((k) => pickTarget([m], 0, 0, (k * Math.PI) / 4, 100, RANGED_CONE)), `a monster at bearing ${a.toFixed(2)} can be shot`);
}
assert.equal(pickTarget([ahead, diag], 0, 0, 0, 100, MELEE_CONE, (m) => m !== ahead), diag, 'a blocked target is passed over for the next best');
assert.equal(leadAngle(100, 0, 0, 0, 200), 0, 'a still target is shot at directly');
assert.ok(Math.abs(leadAngle(100, 0, 0, 40, 200) - Math.atan2(20, 100)) < 1e-9, 'a moving one is led by its travel during the flight');
assert.ok(Math.abs(leadAngle(1000, 0, 0, 40, 200) - Math.atan2(20, 1000)) < 1e-9, 'the lead never looks more than half a second ahead');

console.log('All rule checks passed');
