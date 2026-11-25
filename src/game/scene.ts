// The world scene: draws the map and runs the real-time simulation for the active hero.
import Phaser from 'phaser';
import { F, O, SHEETS, T, type SheetKey } from '../art/manifest';
import { audio } from '../audio/audio';
import { G, activeHero, profileOf, run } from '../core';
import { ITEMS } from '../data/items';
import { getMap } from '../data/maps';
import { input } from '../input';
import { ARROW_MAX, ARROW_PILE, addArrows, fillMissingCharges, giveItem, hasFlag, heroStats, packBits, rollChest, setFlag, type HeroStats, type LootTier } from '../run';
import { TILE, VIEW_H, VIEW_W, type GroundItem, type ItemStack } from '../types';
import type { MapDef } from '../world/mapdef';
import { angDiff, type Bomb, type Hero, type Mon, type Pickup, type Proj } from './ents';
import { damageMon, drawTelegraphs, spawnMonsters, updateMonsters } from './monsters';
import { World, type Obj } from './world';

type Img = Phaser.GameObjects.Image;

export const DEPTH = { floor: 2, ent: 10, fx: 60, fog: 100, top: 110 };
const entDepth = (y: number) => DEPTH.ent + y / 100;
const HERO_R = 4;
const tx = (px: number) => Math.floor(px / TILE);
const center = (t: number) => t * TILE + TILE / 2;

export let scene: GameScene;

export class GameScene extends Phaser.Scene {
  world!: World;
  def!: MapDef;
  loaded = false;
  paused = true;
  clock = 0;
  hero: Hero | null = null;
  stats!: HeroStats;
  mons: Mon[] = [];
  projs: Proj[] = [];
  picks: Pickup[] = [];
  bombs: Bomb[] = [];
  boss: Mon | null = null;
  attemptKills: string[] = [];
  prompt = '';
  fogVersion = 0;
  zone: 'forest' | 'cave' = 'forest';
  tele!: Phaser.GameObjects.Graphics;

  private map: Phaser.Tilemaps.Tilemap | null = null;
  private layer: Phaser.Tilemaps.TilemapLayer | null = null;
  private fogTex: Phaser.Textures.CanvasTexture | null = null;
  private fogImg: Img | null = null;
  private fogData: ImageData | null = null;
  private objSpr = new Map<Obj, Img>();
  private itemSpr = new Map<Obj, Img>();
  private groundSpr = new Map<GroundItem, Img>();
  private lastTile = -1;
  private pushT = 0;
  private promptObj: Obj | null = null;
  private promptGround: GroundItem | null = null;
  private leverDebounce = new Map<Obj, number>();
  private ending = false;

  constructor() {
    super('game');
    scene = this;
  }

  create(): void {
    for (const key of Object.keys(SHEETS) as SheetKey[]) {
      const { w, h, frames } = SHEETS[key];
      const tex = this.textures.addCanvas(key, G.art[key])!;
      for (let i = 0; i < frames; i++) tex.add(i, 0, i * w, 0, w, h);
    }
    this.tele = this.add.graphics().setDepth(DEPTH.fx - 1);
    this.cameras.main.setRoundPixels(true);
    this.events.emit('ready');
  }

  // ------------------------------------------------------------------ run lifecycle

  /** Builds the world for the run stored in the save. */
  loadRun(): void {
    this.unloadRun();
    const r = run();
    fillMissingCharges(r);
    this.def = getMap(r.mapId);
    this.world = new World(this.def, r, G.save!);
    const { w, h } = this.world;
    const data: number[][] = [];
    for (let y = 0; y < h; y++) data.push(Array.from(this.world.tiles.subarray(y * w, (y + 1) * w)));
    this.map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const ts = this.map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0)!;
    this.layer = this.map.createLayer(0, ts, 0, 0)!.setDepth(0);
    for (const o of this.world.objs) this.makeObjSprite(o);
    for (const g of r.ground) this.addGroundSprite(g);
    this.fogTex = this.textures.createCanvas('fog', w, h)!;
    this.fogData = this.fogTex.getContext().createImageData(w, h);
    this.fogImg = this.add.image(0, 0, 'fog').setOrigin(0).setScale(TILE).setDepth(DEPTH.fog);
    this.cameras.main.setBounds(0, 0, w * TILE, h * TILE);
    // until a hero is placed, show only what the party has already explored
    const px = this.fogData.data;
    for (let i = 0; i < w * h; i++) px[i * 4 + 3] = this.world.explored[i] ? 165 : 255;
    this.fogTex.getContext().putImageData(this.fogData, 0, 0);
    this.fogTex.refresh();
    const cp = this.def.checkpoints[r.checkpoint];
    this.cameras.main.stopFollow();
    this.cameras.main.centerOn(center(cp.x), center(cp.y));
    this.loaded = true;
    this.paused = true;
    this.ending = false;
  }

  unloadRun(): void {
    this.clearActors();
    this.objSpr.forEach((s) => s.destroy());
    this.itemSpr.forEach((s) => s.destroy());
    this.groundSpr.forEach((s) => s.destroy());
    this.objSpr.clear();
    this.itemSpr.clear();
    this.groundSpr.clear();
    this.fogImg?.destroy();
    this.fogImg = null;
    if (this.fogTex) this.textures.remove('fog');
    this.fogTex = null;
    this.layer?.destroy();
    this.map?.destroy();
    this.layer = null;
    this.map = null;
    this.tele?.clear();
    this.loaded = false;
    this.paused = true;
    this.boss = null;
  }

  private clearActors(): void {
    if (this.hero) {
      this.hero.spr.destroy();
      this.hero.shield.destroy();
      this.hero = null;
    }
    for (const m of this.mons) {
      m.spr.destroy();
      m.mark?.destroy();
    }
    for (const p of this.projs) p.spr.destroy();
    for (const p of this.picks) p.spr.destroy();
    for (const b of this.bombs) b.spr.destroy();
    this.mons = [];
    this.projs = [];
    this.picks = [];
    this.bombs = [];
    this.boss = null;
  }

  /** Writes fog and other live state back into the run so it can be saved. */
  syncRun(): void {
    if (this.loaded) run().explored = packBits(this.world.explored);
  }

  /** Called when a checkpoint is reached: this attempt's kills become permanent. */
  commitKills(): void {
    const r = run();
    for (const id of this.attemptKills) if (!r.dead.includes(id)) r.dead.push(id);
    this.attemptKills = [];
  }

  /** Puts the active hero at the last checkpoint and resets everything that resets between turns. */
  beginTurn(): void {
    const r = run();
    const rh = activeHero();
    this.clearActors();
    this.attemptKills = [];
    this.world.bossLocked = false;
    this.world.resetPuzzlePieces();
    for (const o of this.world.objs) {
      if (o.def.type === 'block') this.objSpr.get(o)?.setPosition(center(o.x), center(o.y));
      this.refreshObjSprite(o);
    }
    this.applyGateChanges(this.world.syncGates());
    this.stats = heroStats(G.save!, rh);
    rh.hp = Math.min(rh.hp, this.stats.maxHp);
    const cp = this.def.checkpoints[r.checkpoint];
    const color = profileOf(rh).color;
    const spr = this.add.image(0, 0, `hero${color}`, 0).setOrigin(0.5, 0.7);
    const shield = this.add.image(0, 0, 'fx', F.Shield).setVisible(false);
    this.hero = { x: center(cp.x), y: center(cp.y), kx: 0, ky: 0, aim: Math.PI / 2, cd: [0, 0, 0], cdMax: [1, 1, 1], iframes: 1000, slowT: 0, blocking: false, dash: null, moving: false, walkT: 0, dead: false, spr, shield };
    spawnMonsters(this);
    this.lastTile = -1;
    this.updateVision(true);
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.centerOn(this.hero.x, this.hero.y);
    cam.startFollow(spr, true, 0.18, 0.18);
    this.ending = false;
    this.paused = false;
    input.reset();
  }

  // ------------------------------------------------------------------ main loop

  update(_time: number, delta: number): void {
    if (this.loaded && !this.paused && this.hero) {
      const dt = Math.min(delta, 34);
      this.clock += dt;
      if (!this.hero.dead) this.updateHero(dt);
      updateMonsters(this, dt);
      this.updateProjectiles(dt);
      this.updateBombs(dt);
      this.updatePickups(dt);
      this.updateObjects(dt);
      this.updateVision(false);
      drawTelegraphs(this);
    }
    G.hooks.frame();
    input.endFrame();
  }

  // ------------------------------------------------------------------ movement and collision

  /** True if a square body centred at (x, y) overlaps something it cannot enter. */
  hits(x: number, y: number, r: number, fly: boolean): boolean {
    const x0 = tx(x - r);
    const x1 = tx(x + r);
    const y0 = tx(y - r);
    const y1 = tx(y + r);
    for (let yy = y0; yy <= y1; yy++)
      for (let xx = x0; xx <= x1; xx++) {
        if (this.world.solid(xx, yy)) return true;
        if (!fly && this.world.pit(xx, yy)) return true;
      }
    return false;
  }

  /** Moves a body one axis at a time so it slides along walls. Returns true if it moved freely on both axes. */
  moveBody(e: { x: number; y: number }, dx: number, dy: number, r: number, fly: boolean): boolean {
    let free = true;
    if (dx !== 0) {
      if (!this.hits(e.x + dx, e.y, r, fly)) e.x += dx;
      else free = false;
    }
    if (dy !== 0) {
      if (!this.hits(e.x, e.y + dy, r, fly)) e.y += dy;
      else free = false;
    }
    return free;
  }

  // ------------------------------------------------------------------ hero

  private slotHeld(i: number): boolean {
    return i === 0 ? input.buttons[0] : i === 1 ? input.buttons[2] : input.down.has('Space');
  }

  private updateHero(dt: number): void {
    const h = this.hero!;
    const rh = activeHero();
    const s = dt / 1000;
    for (let i = 0; i < 3; i++) h.cd[i] = Math.max(0, h.cd[i] - dt);
    h.iframes -= dt;
    h.slowT -= dt;
    const cam = this.cameras.main;
    h.aim = Math.atan2(input.my + cam.scrollY - h.y, input.mx + cam.scrollX - h.x);

    let mx = 0;
    let my = 0;
    if (h.dash) {
      h.dash.t += dt;
      const k = Math.min(1, h.dash.t / h.dash.dur);
      h.x = h.dash.x0 + (h.dash.x1 - h.dash.x0) * k;
      h.y = h.dash.y0 + (h.dash.y1 - h.dash.y0) * k;
      if (k >= 1) h.dash = null;
    } else {
      mx = (input.down.has('KeyD') || input.down.has('ArrowRight') ? 1 : 0) - (input.down.has('KeyA') || input.down.has('ArrowLeft') ? 1 : 0);
      my = (input.down.has('KeyS') || input.down.has('ArrowDown') ? 1 : 0) - (input.down.has('KeyW') || input.down.has('ArrowUp') ? 1 : 0);
      h.blocking = [0, 1, 2].some((i) => rh.slots[i]?.id === 'shield' && this.slotHeld(i));
      const len = Math.hypot(mx, my) || 1;
      const sp = this.stats.speed * (h.blocking ? 0.5 : 1) * (h.slowT > 0 ? 0.55 : 1);
      const free = this.moveBody(h, ((mx / len) * sp + h.kx) * s, ((my / len) * sp + h.ky) * s, HERO_R, false);
      const damp = Math.min(1, dt * 0.012);
      h.kx -= h.kx * damp;
      h.ky -= h.ky * damp;
      // leaning on a block for a moment shoves it one tile
      if (!free && (mx !== 0) !== (my !== 0)) {
        const bx = tx(h.x + mx * (HERO_R + 3));
        const by = tx(h.y + my * (HERO_R + 3));
        const block = this.world.objAt(bx, by, 'block');
        if (block) {
          this.pushT += dt;
          if (this.pushT > 220) {
            this.pushT = 0;
            this.pushBlock(block, mx, my);
          }
        } else this.pushT = 0;
      } else this.pushT = 0;
      for (let i = 0; i < 3; i++) if (this.slotHeld(i)) this.useSlot(i);
    }
    h.moving = mx !== 0 || my !== 0 || !!h.dash;

    this.findPrompt();
    if (input.pressed.has('KeyE')) this.interact();

    // sprite
    if (h.moving) h.walkT += dt;
    const step = Math.floor(h.walkT / 150) % 2;
    const c = Math.cos(h.aim);
    const sn = Math.sin(h.aim);
    const base = Math.abs(c) > Math.abs(sn) ? 4 : sn > 0 ? 0 : 2;
    h.spr.setFrame(base + step).setFlipX(base === 4 && c < 0);
    h.spr.setPosition(Math.round(h.x), Math.round(h.y)).setDepth(entDepth(h.y));
    h.spr.setAlpha(h.iframes > 0 && Math.floor(this.clock / 70) % 2 ? 0.35 : 1);
    h.spr.setTint(h.slowT > 0 ? 0x9fd0ff : 0xffffff);
    h.shield
      .setVisible(h.blocking)
      .setPosition(h.x + c * 8, h.y - 3 + sn * 8)
      .setRotation(h.aim)
      .setDepth(entDepth(h.y + sn * 8));

    // things that react to where the hero stands
    const htx = tx(h.x);
    const hty = tx(h.y);
    const ti = this.world.idx(htx, hty);
    if (ti !== this.lastTile) this.onHeroTile(htx, hty);
    for (const o of this.world.objs) {
      if (o.def.type === 'campfire' && o.def.index === run().checkpoint + 1 && Math.hypot(center(o.x) - h.x, center(o.y) - h.y) < 22) {
        this.reachCheckpoint(o);
        break;
      }
    }
  }

  private onHeroTile(htx: number, hty: number): void {
    const r = run();
    const w = this.world;
    this.lastTile = w.idx(htx, hty);
    w.computeFlow(htx, hty);
    // plates
    const solvedNow = w.updatePlates(htx, hty);
    for (const p of solvedNow) this.solvePuzzle(p, 'The gate grinds open for good.');
    let plateChanged = false;
    for (const o of w.objs) {
      if (o.def.type !== 'plate') continue;
      const spr = this.objSpr.get(o)!;
      const want = o.pressed ? O.PlateDown : O.PlateUp;
      if (Number(spr.frame.name) !== want) {
        spr.setFrame(want);
        plateChanged = true;
      }
    }
    if (plateChanged) audio.sfx('plate');
    // walking through a timed gate while it is open settles it for good
    const gate = w.objAt(htx, hty, 'gate');
    if (gate && (w.timers[gate.def.puzzle!] ?? 0) > 0 && !w.solved(gate.def.puzzle!)) this.solvePuzzle(gate.def.puzzle!, 'The gate locks open behind you.');
    this.applyGateChanges(w.syncGates((o) => !(o.x === htx && o.y === hty)));
    // secrets
    for (const o of w.objs) {
      if (o.def.type !== 'secret' || hasFlag(r, 'secret:' + o.def.secret)) continue;
      if (htx >= o.x && hty >= o.y && htx < o.x + (o.def.w ?? 1) && hty < o.y + (o.def.h ?? 1)) {
        setFlag(r, 'secret:' + o.def.secret);
        r.secretsFound++;
        activeHero().earned += 10;
        const k = (G.save!.knowledge[this.def.id] ??= { secrets: [], shortcuts: [], bestCheckpoint: 0, clears: 0 });
        if (!k.secrets.includes(o.def.secret!)) k.secrets.push(o.def.secret!);
        const name = this.def.secrets.find((x) => x.id === o.def.secret)?.name ?? 'A secret';
        audio.sfx('secret');
        G.hooks.toast(`Secret found: ${name}  (+10 renown)`, 'good');
      }
    }
    // the boss hall seals once you step inside
    const a = this.def.boss.arena;
    if (this.boss && !w.bossLocked && htx >= a.x0 && htx <= a.x1 && hty >= a.y0 && hty <= a.y1) {
      w.bossLocked = true;
      this.applyGateChanges(w.syncGates());
      this.boss.alerted = true;
      this.boss.boss!.mode = 'break';
      this.boss.boss!.t = 1400;
      audio.sfx('bossRoar');
      this.cameras.main.shake(400, 0.006);
      G.hooks.toast(this.boss.def.name, 'bad');
    }
    const zone = w.isCave(htx, hty) ? 'cave' : 'forest';
    this.zone = zone;
    audio.music(w.bossLocked ? 'boss' : zone);
  }

  private reachCheckpoint(o: Obj): void {
    if (this.ending) return;
    this.ending = true;
    this.paused = true;
    this.objSpr.get(o)?.setFrame(O.CampfireOn0);
    audio.sfx('checkpoint');
    this.time.delayedCall(700, () => G.hooks.onCheckpoint(o.def.index!));
  }

  /** Damages the hero unless dodged or blocked. Returns true if it landed. */
  hurtHero(dmg: number, sx: number, sy: number, opts: { slow?: boolean; knock?: number } = {}): boolean {
    const h = this.hero;
    if (!h || h.dead || h.dash || h.iframes > 0 || this.ending) return false;
    const a = Math.atan2(sy - h.y, sx - h.x);
    if (h.blocking && angDiff(a, h.aim) < 1.15) {
      audio.sfx('block');
      this.fx(F.Spark, h.x + Math.cos(a) * 9, h.y - 3 + Math.sin(a) * 9, 140);
      h.kx = -Math.cos(a) * 60;
      h.ky = -Math.sin(a) * 60;
      h.iframes = 150;
      return false;
    }
    if (this.stats.armour) dmg = Math.max(1, Math.round(dmg * 0.75));
    const rh = activeHero();
    rh.hp -= dmg;
    h.iframes = 800;
    const k = opts.knock ?? 150;
    h.kx = -Math.cos(a) * k;
    h.ky = -Math.sin(a) * k;
    if (opts.slow) h.slowT = 2200;
    this.number(h.x, h.y - 10, dmg, 0xff5a4a);
    this.cameras.main.shake(120, 0.004);
    audio.sfx('hurt');
    if (rh.hp <= 0) {
      rh.hp = 0;
      this.killHero();
    }
    return true;
  }

  private killHero(): void {
    const h = this.hero!;
    h.dead = true;
    h.shield.setVisible(false);
    this.ending = true;
    audio.sfx('death');
    this.tweens.add({ targets: h.spr, angle: 90, alpha: 0.2, duration: 700 });
    this.time.delayedCall(1100, () => {
      this.paused = true;
      G.hooks.onHeroDeath();
    });
  }

  // ------------------------------------------------------------------ abilities

  private useSlot(i: number): void {
    const h = this.hero!;
    const rh = activeHero();
    const stack = rh.slots[i];
    const id = stack?.id ?? 'fists';
    if (id === 'shield' || h.cd[i] > 0) return;
    const def = ITEMS[id];
    if (def.ammo && stack && (stack.charges ?? 0) <= 0) {
      // an empty bow stays equipped: it just clicks until arrows are found
      h.cd[i] = h.cdMax[i] = 400;
      audio.sfx('deny');
      return;
    }
    const mult = this.stats.dmgMult;
    const c = Math.cos(h.aim);
    const s = Math.sin(h.aim);
    switch (id) {
      case 'fists':
        this.melee(15, 0.95, 2 * mult, 70, 0.7, F.Punch, 'punch');
        break;
      case 'club':
        this.melee(20, 1.0, 3.5 * mult, 190, 1, F.Slash0, 'swing');
        break;
      case 'sword':
        this.melee(23, 1.3, 4 * mult, 100, 1.15, F.Slash0, 'swing');
        break;
      case 'cleaver':
        this.melee(25, 1.25, 7 * mult, 260, 1.4, F.Slash0, 'swing');
        break;
      case 'spear':
        this.melee(36, 0.3, 4.5 * mult, 110, 1, F.Thrust, 'swing');
        break;
      case 'bow':
        this.shoot(F.Arrow, 240, 3.5 * mult, 900, {});
        audio.sfx('shoot');
        break;
      case 'knives':
        this.shoot(F.Knife, 270, 2.5 * mult, 520, {});
        audio.sfx('shoot');
        break;
      case 'firebolt':
        this.shoot(F.Firebolt0, 175, 5 * mult, 1200, { fire: true });
        audio.sfx('fire');
        break;
      case 'frost': {
        audio.sfx('frost');
        const ring = this.add.circle(h.x, h.y, 46, 0x9fd8ff, 0.25).setStrokeStyle(2, 0xdff4ff).setDepth(DEPTH.fx).setScale(0.2);
        this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 350, onComplete: () => ring.destroy() });
        for (const m of this.mons) {
          if (m.dead || Math.hypot(m.x - h.x, m.y - h.y) > 46 + m.r) continue;
          m.slowT = 3000;
          damageMon(this, m, 2 * mult, 0, 0);
          this.fx(F.Frost, m.x, m.y - 6, 400);
        }
        break;
      }
      case 'bombs': {
        const want = Math.min(88, Math.hypot(input.mx + this.cameras.main.scrollX - h.x, input.my + this.cameras.main.scrollY - h.y));
        let d = 0;
        while (d + 4 <= want && !this.world.solid(tx(h.x + c * (d + 4)), tx(h.y + s * (d + 4)))) d += 4;
        const spr = this.add.image(h.x, h.y, 'fx', F.Bomb0).setDepth(DEPTH.fx);
        this.bombs.push({ x: h.x, y: h.y, x0: h.x, y0: h.y, x1: h.x + c * d, y1: h.y + s * d, t: 0, spr });
        audio.sfx('swing');
        break;
      }
      case 'dash': {
        const mvx = (input.down.has('KeyD') ? 1 : 0) - (input.down.has('KeyA') ? 1 : 0);
        const mvy = (input.down.has('KeyS') ? 1 : 0) - (input.down.has('KeyW') ? 1 : 0);
        const len = Math.hypot(mvx, mvy);
        const dx = len ? mvx / len : c;
        const dy = len ? mvy / len : s;
        let land = 0;
        for (let d = 2; d <= 58; d += 2) {
          if (this.hits(h.x + dx * d, h.y + dy * d, HERO_R, true)) break;
          if (!this.hits(h.x + dx * d, h.y + dy * d, HERO_R, false)) land = d;
        }
        if (land < 8) return;
        h.dash = { x0: h.x, y0: h.y, x1: h.x + dx * land, y1: h.y + dy * land, t: 0, dur: 130 };
        h.iframes = Math.max(h.iframes, 260);
        h.kx = h.ky = 0;
        this.fx(F.Poof0, h.x, h.y, 200);
        audio.sfx('dash');
        break;
      }
      case 'scroll':
        this.world.revealAround(tx(h.x), tx(h.y), 22);
        this.updateVision(true);
        audio.sfx('secret');
        G.hooks.toast('The scroll burns away and the land around you is laid bare.', 'info');
        break;
      default:
        return;
    }
    h.cd[i] = h.cdMax[i] = def.cooldown;
    if (stack && stack.charges !== undefined) {
      stack.charges--;
      if (stack.charges <= 0) {
        if (def.ammo) G.hooks.toast('Out of arrows. Monsters sometimes drop more while the bow is equipped.', 'info');
        else {
          rh.slots[i] = null;
          G.hooks.toast(`${def.name}: none left.`, 'info');
        }
      }
    }
  }

  private melee(range: number, half: number, dmg: number, knock: number, scale: number, frame: F, sfx: 'punch' | 'swing'): void {
    const h = this.hero!;
    audio.sfx(sfx);
    const c = Math.cos(h.aim);
    const s = Math.sin(h.aim);
    const reach = frame === F.Thrust ? range * 0.55 : range * 0.6;
    const spr = this.add.image(h.x + c * reach, h.y - 3 + s * reach, 'fx', frame).setRotation(h.aim).setScale(frame === F.Thrust ? 2 : scale, scale).setDepth(DEPTH.fx);
    this.time.delayedCall(60, () => frame === F.Slash0 && spr.active && spr.setFrame(F.Slash1));
    this.tweens.add({ targets: spr, alpha: 0, duration: 130, delay: 40, onComplete: () => spr.destroy() });
    const inArc = (x: number, y: number, r: number) => {
      const d = Math.hypot(x - h.x, y - h.y) - r;
      if (d > range) return false;
      return d < 5 || angDiff(Math.atan2(y - h.y, x - h.x), h.aim) <= half;
    };
    let landed = false;
    for (const m of this.mons) {
      if (m.dead || !inArc(m.x, m.y, m.r)) continue;
      if (!this.world.los(tx(h.x), tx(h.y), tx(m.x), tx(m.y))) continue;
      const a = Math.atan2(m.y - h.y, m.x - h.x);
      damageMon(this, m, dmg, Math.cos(a) * knock, Math.sin(a) * knock);
      landed = true;
    }
    for (const o of this.world.objs) {
      if ((o.def.type === 'pot' && !o.open) || o.def.type === 'lever') if (inArc(center(o.x), center(o.y), 6)) this.hitObject(o, false);
    }
    if (landed) audio.sfx('hit');
  }

  private shoot(frame: F, speed: number, dmg: number, life: number, opts: { fire?: boolean }): void {
    const h = this.hero!;
    const c = Math.cos(h.aim);
    const s = Math.sin(h.aim);
    this.addProj(h.x + c * 6, h.y - 2 + s * 6, c * speed, s * speed, { frame, dmg, life, fromHero: true, fire: !!opts.fire });
  }

  addProj(x: number, y: number, vx: number, vy: number, o: { frame: F; dmg: number; life: number; fromHero: boolean; fire?: boolean; web?: boolean; spin?: number; r?: number }): void {
    const spr = this.add.image(x, y, 'fx', o.frame).setRotation(Math.atan2(vy, vx)).setDepth(DEPTH.fx);
    this.projs.push({ x, y, vx, vy, r: o.r ?? 3, dmg: o.dmg, fromHero: o.fromHero, life: o.life, pierce: false, fire: !!o.fire, web: !!o.web, spin: o.spin ?? 0, hit: new Set(), spr });
  }

  private updateProjectiles(dt: number): void {
    const s = dt / 1000;
    const h = this.hero!;
    for (const p of this.projs) {
      p.life -= dt;
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.spr.setPosition(p.x, p.y);
      if (p.spin) p.spr.rotation += p.spin * s;
      if (p.fire) p.spr.setFrame(Math.floor(this.clock / 90) % 2 ? F.Firebolt1 : F.Firebolt0);
      p.spr.setVisible(!!this.world.visible[this.world.idx(tx(p.x), tx(p.y))]);
      let gone = p.life <= 0;
      const ptx = tx(p.x);
      const pty = tx(p.y);
      if (!gone && this.world.solid(ptx, pty)) {
        gone = true;
        const o = this.world.objAt(ptx, pty);
        if (o && p.fromHero) this.hitObject(o, p.fire);
      }
      if (!gone && p.fromHero) {
        for (const m of this.mons) {
          if (m.dead || p.hit.has(m) || Math.hypot(m.x - p.x, m.y - 3 - p.y) > p.r + m.r + 1) continue;
          const sp = Math.hypot(p.vx, p.vy) || 1;
          damageMon(this, m, p.dmg, (p.vx / sp) * 80, (p.vy / sp) * 80);
          audio.sfx('hit');
          gone = true;
          break;
        }
      } else if (!gone && !h.dead && Math.hypot(h.x - p.x, h.y - 3 - p.y) < p.r + HERO_R + 1) {
        this.hurtHero(p.dmg, p.x - p.vx * 0.05, p.y - p.vy * 0.05, { slow: p.web, knock: 90 });
        gone = true;
      }
      if (gone) {
        if (p.fire) this.explode(p.x, p.y, 16, p.dmg * 0.6, false);
        else if (p.life > 0) this.fx(F.Spark, p.x, p.y, 120);
        p.life = -1;
        p.spr.destroy();
      }
    }
    this.projs = this.projs.filter((p) => p.life > 0);
  }

  private updateBombs(dt: number): void {
    for (const b of this.bombs) {
      b.t += dt;
      const k = Math.min(1, b.t / 320);
      b.x = b.x0 + (b.x1 - b.x0) * k;
      b.y = b.y0 + (b.y1 - b.y0) * k;
      b.spr.setPosition(b.x, b.y - Math.sin(k * Math.PI) * 10).setFrame(Math.floor(b.t / 110) % 2 ? F.Bomb1 : F.Bomb0);
      if (b.t >= 1250) {
        b.spr.destroy();
        this.explode(b.x, b.y, 30, 8 * this.stats.dmgMult, true);
      }
    }
    this.bombs = this.bombs.filter((b) => b.t < 1250);
  }

  /** A burst that hurts monsters; bombs also hurt the hero and break cracked walls. */
  explode(x: number, y: number, radius: number, dmg: number, bomb: boolean): void {
    audio.sfx('explode');
    const spr = this.add.image(x, y, 'fx', F.Explosion0).setDepth(DEPTH.fx).setScale(radius / 10);
    this.time.delayedCall(70, () => spr.active && spr.setFrame(F.Explosion1));
    this.time.delayedCall(140, () => spr.active && spr.setFrame(F.Explosion2));
    this.time.delayedCall(220, () => spr.destroy());
    for (const m of this.mons) {
      const d = Math.hypot(m.x - x, m.y - y);
      if (m.dead || d > radius + m.r) continue;
      damageMon(this, m, dmg, ((m.x - x) / (d || 1)) * 160, ((m.y - y) / (d || 1)) * 160);
    }
    for (const o of this.world.objs) {
      if (Math.hypot(center(o.x) - x, center(o.y) - y) <= radius + 6) this.hitObject(o, true);
    }
    if (!bomb) return;
    this.cameras.main.shake(200, 0.006);
    const h = this.hero;
    if (h && Math.hypot(h.x - x, h.y - y) < radius) this.hurtHero(3, x, y);
    const w = this.world;
    const r = Math.ceil(radius / TILE) + 1;
    let broke = false;
    for (let yy = tx(y) - r; yy <= tx(y) + r; yy++)
      for (let xx = tx(x) - r; xx <= tx(x) + r; xx++) {
        if (w.tile(xx, yy) !== T.Cracked || Math.hypot(center(xx) - x, center(yy) - y) > radius + 10) continue;
        this.setTile(xx, yy, T.Rubble);
        setFlag(run(), `crack:${xx},${yy}`);
        this.fx(F.Poof0, center(xx), center(yy), 300);
        broke = true;
      }
    if (broke) {
      audio.sfx('door');
      G.hooks.toast('The cracked rock gives way!', 'good');
      this.updateVision(true);
    }
  }

  // ------------------------------------------------------------------ objects and puzzles

  setTile(xx: number, yy: number, t: T): void {
    const w = this.world;
    w.tiles[w.idx(xx, yy)] = t;
    this.layer?.putTileAt(t, xx, yy);
    // a wall directly above newly opened floor shows its face
    if (!w.solid(xx, yy) && w.tile(xx, yy - 1) === T.CaveWall) {
      w.tiles[w.idx(xx, yy - 1)] = T.CaveWallFace;
      this.layer?.putTileAt(T.CaveWallFace, xx, yy - 1);
    }
  }

  private objFrame(o: Obj): number {
    const d = o.def;
    switch (d.type) {
      case 'campfire':
        return d.index! <= run().checkpoint ? O.CampfireOn0 : O.CampfireOff;
      case 'chest':
        return o.open ? O.ChestOpen : O.ChestClosed;
      case 'pot':
        return o.open ? O.PotBroken : O.Pot;
      case 'sign':
        return O.Sign;
      case 'door':
        return o.open ? -1 : d.key === 'blue' ? O.DoorBlue : O.DoorRed;
      case 'gate':
        return o.open ? -1 : O.Gate;
      case 'plate':
        return o.pressed ? O.PlateDown : O.PlateUp;
      case 'block':
        return O.Block;
      case 'lever':
        return o.on ? O.LeverOn : O.LeverOff;
      case 'brazier':
        return o.lit ? O.BrazierOn0 : O.BrazierOff;
      case 'spikes':
        return o.exists ? (o.up ? O.SpikesUp : O.SpikesDown) : -1;
      case 'arrowtrap':
        return o.exists ? O.ArrowTrap : -1;
      case 'shrine':
        return o.open ? O.ShrineUsed : O.Shrine;
      case 'pedestal':
        return O.Pedestal;
      case 'sconce':
      case 'decor':
        return d.frame ?? O.Sconce;
      default:
        return -1;
    }
  }

  private makeObjSprite(o: Obj): void {
    const d = o.def;
    if (d.type === 'secret' || d.type === 'hidden') return;
    if (d.type === 'npc') {
      this.objSpr.set(o, this.add.image(center(o.x), center(o.y), 'npc', d.sprite ?? 0).setDepth(entDepth(center(o.y))));
      return;
    }
    const flat = d.type === 'plate' || d.type === 'spikes' || (d.type === 'decor' && !d.solid) || d.type === 'sconce' || d.type === 'arrowtrap';
    const f = this.objFrame(o);
    const spr = this.add.image(center(o.x), center(o.y), 'objects', Math.max(0, f)).setVisible(f >= 0);
    spr.setDepth(flat ? DEPTH.floor : entDepth(center(o.y)));
    if (d.type === 'arrowtrap') spr.setRotation([0, Math.PI / 2, Math.PI, -Math.PI / 2][d.dir ?? 0]);
    this.objSpr.set(o, spr);
    if (d.type === 'campfire' && d.merchant) {
      const m = this.add.image(center(o.x + 1), center(o.y), 'npc', 1).setDepth(entDepth(center(o.y)));
      this.itemSpr.set(o, m);
    }
    if (d.type === 'pedestal' && d.item) {
      const icon = this.add.image(center(o.x), center(o.y) - 7, 'icons', ITEMS[d.item].icon).setDepth(entDepth(center(o.y)) + 0.01).setVisible(!o.open);
      this.itemSpr.set(o, icon);
    }
  }

  refreshObjSprite(o: Obj): void {
    const spr = this.objSpr.get(o);
    if (!spr || o.def.type === 'npc') return;
    const f = this.objFrame(o);
    spr.setVisible(f >= 0);
    if (f >= 0) spr.setFrame(f);
    if (o.def.type === 'pedestal') this.itemSpr.get(o)?.setVisible(!o.open);
    if (o.def.type === 'pot' && o.open) spr.setDepth(DEPTH.floor);
  }

  applyGateChanges(changed: Obj[]): void {
    if (!changed.length) return;
    for (const o of changed) {
      if (o.def.type === 'hidden') this.setTile(o.x, o.y, o.open ? T.CaveFloor : T.CaveWall);
      else this.refreshObjSprite(o);
    }
    audio.sfx('door');
    this.updateVision(true);
  }

  private solvePuzzle(puzzle: string, msg: string): void {
    if (this.world.solved(puzzle)) return;
    setFlag(run(), 'pz:' + puzzle);
    audio.sfx('solved');
    G.hooks.toast(msg, 'good');
    for (const o of this.world.objs) {
      if (o.def.puzzle !== puzzle) continue;
      if (o.def.type === 'lever') o.on = true;
      if (o.def.type === 'brazier') o.lit = true;
      this.refreshObjSprite(o);
    }
  }

  /** Something struck an object: a weapon, a projectile or a blast. */
  hitObject(o: Obj, fire: boolean): void {
    const d = o.def;
    if (d.type === 'pot' && !o.open) {
      o.open = true;
      setFlag(run(), 'o:' + d.id);
      this.world.refreshBlocked();
      this.refreshObjSprite(o);
      audio.sfx('chest');
      const roll = Math.random();
      if (roll < 0.45) this.dropCoin(center(o.x), center(o.y), 1 + Math.floor(Math.random() * 3));
      else if (roll < 0.62) this.dropHeart(center(o.x), center(o.y));
    } else if (d.type === 'lever') {
      this.pullLever(o);
    } else if (d.type === 'brazier' && fire) {
      this.lightBrazier(o);
    }
  }

  private pullLever(o: Obj): void {
    const w = this.world;
    const p = o.def.puzzle!;
    if ((this.leverDebounce.get(o) ?? 0) > this.clock || w.solved(p)) return;
    this.leverDebounce.set(o, this.clock + 500);
    audio.sfx('lever');
    if (o.def.timed) {
      w.timers[p] = o.def.timed;
      o.on = true;
      this.refreshObjSprite(o);
      G.hooks.toast(`The far gate lifts. ${o.def.timed} seconds!`, 'info');
    } else {
      if (o.def.meta) {
        const k = (G.save!.knowledge[this.def.id] ??= { secrets: [], shortcuts: [], bestCheckpoint: 0, clears: 0 });
        if (!k.shortcuts.includes(p)) k.shortcuts.push(p);
        this.solvePuzzle(p, 'Shortcut opened. It will stay open on every future run.');
      } else this.solvePuzzle(p, 'Something unlocks nearby.');
    }
    this.applyGateChanges(w.syncGates());
  }

  private lightBrazier(o: Obj): void {
    const w = this.world;
    const p = o.def.puzzle!;
    if (o.lit || w.solved(p)) return;
    const all = w.ofPuzzle(p, 'brazier');
    const litCount = all.filter((b) => b.lit).length;
    if (o.def.order === litCount) {
      o.lit = true;
      audio.sfx('torch');
      this.refreshObjSprite(o);
      if (litCount + 1 === all.length) {
        this.solvePuzzle(p, 'The fires burn steady. The vault gate opens.');
        this.applyGateChanges(w.syncGates());
      }
    } else {
      for (const b of all) {
        b.lit = false;
        this.refreshObjSprite(b);
      }
      audio.sfx('wrong');
      G.hooks.toast('Wrong order. The flames gutter out.', 'bad');
    }
  }

  private pushBlock(o: Obj, dx: number, dy: number): void {
    const w = this.world;
    if (w.solved(o.def.puzzle ?? '')) return;
    const nx = o.x + dx;
    const ny = o.y + dy;
    const other = w.objs.find((b) => b !== o && b.x === nx && b.y === ny && !['plate', 'secret', 'spikes'].includes(b.def.type) && !(b.def.type === 'decor' && !b.def.solid));
    if (!w.walkable(nx, ny) || other || this.mons.some((m) => !m.dead && tx(m.x) === nx && tx(m.y) === ny)) return;
    o.x = nx;
    o.y = ny;
    w.refreshBlocked();
    audio.sfx('push');
    const spr = this.objSpr.get(o)!;
    spr.setDepth(entDepth(center(ny)));
    this.tweens.add({ targets: spr, x: center(nx), y: center(ny), duration: 120 });
    const h = this.hero!;
    this.onHeroTile(tx(h.x), tx(h.y));
  }

  private findPrompt(): void {
    const h = this.hero!;
    const r = run();
    this.promptObj = null;
    this.promptGround = null;
    this.prompt = '';
    let best = 15;
    for (const g of r.ground) {
      const d = Math.hypot(g.x - h.x, g.y - h.y);
      if (d < best) {
        best = d;
        this.promptGround = g;
      }
    }
    if (this.promptGround) {
      this.prompt = `Take ${ITEMS[this.promptGround.item.id].name}`;
      return;
    }
    best = 23;
    for (const o of this.world.objs) {
      const t = o.def.type;
      let label = '';
      if (t === 'chest' && !o.open) label = 'Open chest';
      else if (t === 'sign') label = 'Read';
      else if (t === 'npc') label = `Talk to ${o.def.name}`;
      else if (t === 'lever' && !this.world.solved(o.def.puzzle!)) label = 'Pull lever';
      else if (t === 'brazier' && !o.lit) label = 'Light brazier';
      else if (t === 'shrine' && !o.open) label = 'Pray at the shrine';
      else if (t === 'pedestal' && !o.open) label = `Take ${ITEMS[o.def.item!].name}`;
      else if (t === 'sconce') label = 'Examine torch';
      else if (t === 'block' && !this.world.solved(o.def.puzzle ?? '')) label = 'Send the stone back';
      else if (t === 'door' && !o.open) label = r.keys.includes(o.def.key!) ? `Unlock (${o.def.key} key)` : `Locked: needs the ${o.def.key} key`;
      else if (t === 'gate' && !o.open) label = 'Examine gate';
      else if (t === 'campfire' && o.def.merchant && o.def.index! <= r.checkpoint) label = '';
      if (!label) continue;
      const d = Math.hypot(center(o.x) - h.x, center(o.y) - h.y);
      if (d < best) {
        best = d;
        this.promptObj = o;
        this.prompt = label;
      }
    }
  }

  private interact(): void {
    const r = run();
    const rh = activeHero();
    const g = this.promptGround;
    if (g) {
      const where = giveItem(rh, g.item);
      if (!where) {
        audio.sfx('deny');
        G.hooks.toast('Your pack is full.', 'bad');
        return;
      }
      r.ground.splice(r.ground.indexOf(g), 1);
      this.groundSpr.get(g)?.destroy();
      this.groundSpr.delete(g);
      audio.sfx('pickup');
      this.refreshStats();
      return;
    }
    const o = this.promptObj;
    if (!o) return;
    const d = o.def;
    switch (d.type) {
      case 'chest': {
        o.open = true;
        setFlag(r, 'o:' + d.id);
        this.refreshObjSprite(o);
        audio.sfx('chest');
        if (d.loot?.startsWith('key:')) {
          const key = d.loot.slice(4);
          r.keys.push(key);
          audio.sfx('key');
          G.hooks.toast(`Found the ${key} key!`, 'good');
        } else {
          const loot = rollChest(r, G.save!, d.id, (d.loot ?? 'common') as LootTier);
          this.dropCoin(center(o.x), center(o.y) + 8, loot.gold);
          this.grantItem(loot.item, center(o.x), center(o.y) + 10);
        }
        break;
      }
      case 'sign':
        G.hooks.dialog('', [d.text ?? '']);
        break;
      case 'npc':
        G.hooks.dialog(d.name ?? '', d.lines ?? []);
        break;
      case 'lever':
        this.pullLever(o);
        break;
      case 'brazier':
        this.lightBrazier(o);
        break;
      case 'shrine':
        o.open = true;
        setFlag(r, 'o:' + d.id);
        r.lives++;
        this.refreshObjSprite(o);
        audio.sfx('life');
        G.hooks.toast('A warmth settles on the party: +1 life.', 'good');
        break;
      case 'pedestal': {
        o.open = true;
        setFlag(r, 'o:' + d.id);
        this.refreshObjSprite(o);
        const def = ITEMS[d.item!];
        if (!G.save!.pool.includes(def.id)) {
          G.save!.pool.push(def.id);
          G.hooks.toast(`New item discovered: ${def.name}. It can now appear in chests, shops and starter kits.`, 'good');
          audio.sfx('secret');
        }
        this.grantItem(def.charges ? { id: def.id, charges: def.charges } : { id: def.id }, center(o.x), center(o.y) + 12);
        break;
      }
      case 'sconce':
        if (d.puzzle && !this.world.solved(d.puzzle)) {
          audio.sfx('lever');
          this.solvePuzzle(d.puzzle, 'The crooked torch twists in your hand. Stone grinds somewhere close.');
          this.applyGateChanges(this.world.syncGates());
        } else G.hooks.toast(d.puzzle ? 'The torch has already been turned.' : 'An ordinary torch, firmly fixed.', 'info');
        break;
      case 'block': {
        o.x = d.x;
        o.y = d.y;
        this.world.refreshBlocked();
        this.objSpr.get(o)?.setPosition(center(o.x), center(o.y));
        this.fx(F.Poof0, center(o.x), center(o.y), 250);
        audio.sfx('push');
        const h = this.hero!;
        this.onHeroTile(tx(h.x), tx(h.y));
        break;
      }
      case 'door':
        if (r.keys.includes(d.key!)) {
          o.open = true;
          setFlag(r, 'o:' + d.id);
          this.world.refreshBlocked();
          this.refreshObjSprite(o);
          audio.sfx('door');
          this.updateVision(true);
        } else {
          audio.sfx('deny');
          G.hooks.toast(`Locked. It needs the ${d.key} key.`, 'bad');
        }
        break;
      case 'gate':
        G.hooks.toast(d.meta ? 'Barred from the other side.' : d.puzzle === this.def.boss.gate ? 'Sealed until the fight is over.' : 'Heavy bars. Something nearby must open it.', 'info');
        break;
    }
  }

  /** Hands an item to the active hero, or leaves it on the ground when they cannot carry it. */
  private grantItem(item: ItemStack, x: number, y: number): void {
    const def = ITEMS[item.id];
    const where = giveItem(activeHero(), item);
    audio.sfx('pickup');
    if (where) {
      G.hooks.toast(`Found: ${def.name}${where === 'pack' ? ' (in your pack)' : ''}`, 'good');
      this.refreshStats();
    } else {
      G.hooks.toast(`Found: ${def.name}. Your pack is full, so it lies on the ground.`, 'info');
      this.dropGround(item, x, y);
    }
  }

  dropGround(item: ItemStack, x: number, y: number): void {
    const g: GroundItem = { x, y, item };
    run().ground.push(g);
    this.addGroundSprite(g);
  }

  private addGroundSprite(g: GroundItem): void {
    const spr = this.add.image(g.x, g.y, 'icons', ITEMS[g.item.id].icon).setDepth(DEPTH.floor + 1).setScale(0.75);
    this.groundSpr.set(g, spr);
  }

  /** Call after equipment changes: recomputes derived stats and light. */
  refreshStats(): void {
    const rh = activeHero();
    this.stats = heroStats(G.save!, rh);
    rh.hp = Math.min(rh.hp, this.stats.maxHp);
    this.updateVision(true);
  }

  private updateObjects(dt: number): void {
    const h = this.hero!;
    const w = this.world;
    const flame = Math.floor(this.clock / 180) % 2;
    // timed gates
    let expired = false;
    for (const p of Object.keys(w.timers)) {
      if (w.timers[p] <= 0) continue;
      w.timers[p] -= dt / 1000;
      if (w.timers[p] <= 0 && !w.solved(p)) {
        expired = true;
        for (const l of w.ofPuzzle(p, 'lever')) {
          l.on = false;
          this.refreshObjSprite(l);
        }
        G.hooks.toast('The gate drops shut again.', 'bad');
      }
    }
    if (expired) this.applyGateChanges(w.syncGates((o) => !(o.x === tx(h.x) && o.y === tx(h.y))));
    for (const o of w.objs) {
      const d = o.def;
      const spr = this.objSpr.get(o);
      if (d.type === 'campfire' && d.index! <= run().checkpoint) spr?.setFrame(O.CampfireOn0 + flame);
      else if (d.type === 'brazier' && o.lit) spr?.setFrame(O.BrazierOn0 + flame);
      else if (d.type === 'pedestal' && !o.open) this.itemSpr.get(o)?.setY(center(o.y) - 7 + Math.sin(this.clock / 300) * 1.5);
      else if (d.type === 'spikes' && o.exists) {
        o.timer = (o.timer + dt) % (d.period ?? 2400);
        const up = o.timer < (d.period ?? 2400) * 0.36;
        if (up !== o.up) {
          o.up = up;
          spr?.setFrame(up ? O.SpikesUp : O.SpikesDown);
        }
        if (up && !h.dead && tx(h.x) === o.x && tx(h.y) === o.y) this.hurtHero(3, h.x, h.y + 4, { knock: 0 });
      } else if (d.type === 'arrowtrap' && o.exists) {
        o.timer += dt;
        if (o.timer >= (d.period ?? 1500)) {
          o.timer -= d.period ?? 1500;
          if (Math.hypot(center(o.x) - h.x, center(o.y) - h.y) < 14 * TILE) {
            const [dx, dy] = [[0, 1], [-1, 0], [0, -1], [1, 0]][d.dir ?? 0];
            this.addProj(center(o.x) + dx * 12, center(o.y) + dy * 12, dx * 150, dy * 150, { frame: F.EnemyArrow, dmg: 3, life: 2000, fromHero: false });
          }
        }
      }
    }
    for (const [g, spr] of this.groundSpr) spr.setY(g.y + Math.sin(this.clock / 350 + g.x) * 1.2);
  }

  // ------------------------------------------------------------------ pickups and effects

  dropCoin(x: number, y: number, value: number): void {
    const a = Math.random() * Math.PI * 2;
    const spr = this.add.image(x, y, 'fx', F.Coin0).setDepth(DEPTH.floor + 2);
    this.picks.push({ x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, kind: 'coin', value, age: 0, spr });
  }

  dropHeart(x: number, y: number): void {
    const a = Math.random() * Math.PI * 2;
    const spr = this.add.image(x, y, 'fx', F.Heart).setDepth(DEPTH.floor + 2);
    this.picks.push({ x, y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, kind: 'heart', value: 5, age: 0, spr });
  }

  dropArrows(x: number, y: number): void {
    const a = Math.random() * Math.PI * 2;
    const spr = this.add.image(x, y, 'fx', F.ArrowPile).setDepth(DEPTH.floor + 2);
    this.picks.push({ x, y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, kind: 'arrows', value: ARROW_PILE, age: 0, spr });
  }

  private updatePickups(dt: number): void {
    const h = this.hero!;
    const s = dt / 1000;
    const rh = activeHero();
    for (const p of this.picks) {
      p.age += dt;
      const d = Math.hypot(h.x - p.x, h.y - p.y);
      const pull = this.stats.magnet ? 72 : 20;
      // arrows are only any use to a hero carrying a bow with room in the quiver
      const wanted = p.kind !== 'arrows' || [...rh.slots, ...rh.pack].some((st) => st?.id === 'bow' && (st.charges ?? 0) < ARROW_MAX);
      if (p.age > 250 && d < pull && !h.dead && wanted) {
        p.vx = ((h.x - p.x) / (d || 1)) * 150;
        p.vy = ((h.y - p.y) / (d || 1)) * 150;
      } else {
        p.vx -= p.vx * Math.min(1, dt * 0.008);
        p.vy -= p.vy * Math.min(1, dt * 0.008);
      }
      const before = { x: p.x, y: p.y };
      this.moveBody(p, p.vx * s, p.vy * s, 2, true);
      if (before.x === p.x && before.y === p.y && d >= pull) p.vx = p.vy = 0;
      p.spr.setPosition(p.x, p.y);
      if (p.kind === 'coin') p.spr.setFrame(Math.floor((this.clock + p.x * 7) / 160) % 2 ? F.Coin1 : F.Coin0);
      if (p.age > 250 && d < 9 && !h.dead && wanted) {
        if (p.kind === 'arrows') {
          const got = addArrows(rh, p.value);
          audio.sfx('pickup');
          this.number(h.x, h.y - 10, got, 0xcfa066);
        } else if (p.kind === 'coin') {
          const v = p.value * this.stats.goldMult;
          const got = Math.floor(v) + (Math.random() < v - Math.floor(v) ? 1 : 0);
          rh.gold += got;
          audio.sfx('coin');
        } else {
          rh.hp = Math.min(this.stats.maxHp, rh.hp + p.value);
          audio.sfx('heart');
          this.number(h.x, h.y - 10, p.value, 0x7be06a);
        }
        p.age = 1e9;
      }
      if (p.age > 40000) p.spr.destroy();
    }
    this.picks = this.picks.filter((p) => p.age <= 40000);
  }

  /** A short-lived effect sprite. */
  fx(frame: F, x: number, y: number, ms: number): void {
    const spr = this.add.image(x, y, 'fx', frame).setDepth(DEPTH.fx);
    if (frame === F.Poof0) this.time.delayedCall(ms / 2, () => spr.active && spr.setFrame(F.Poof1));
    this.tweens.add({ targets: spr, alpha: 0, y: y - 4, duration: ms, onComplete: () => spr.destroy() });
  }

  /** A floating damage or healing number. */
  number(x: number, y: number, value: number, tint: number): void {
    const str = String(Math.max(1, Math.round(value)));
    const w = SHEETS.digits.w - 1;
    const sprs = [...str].map((ch, i) => this.add.image(x - ((str.length - 1) * w) / 2 + i * w, y, 'digits', Number(ch)).setDepth(DEPTH.top).setTint(tint));
    this.tweens.add({ targets: sprs, y: y - 12, alpha: { from: 1, to: 0 }, duration: 600, ease: 'Quad.easeOut', onComplete: () => sprs.forEach((s) => s.destroy()) });
  }

  // ------------------------------------------------------------------ vision

  lightRadius(): number {
    const h = this.hero!;
    return this.stats.light + (this.world.isCave(tx(h.x), tx(h.y)) ? 0 : 2);
  }

  updateVision(force: boolean): void {
    const h = this.hero;
    if (!h || !this.fogData || !this.fogTex) return;
    const w = this.world;
    const htx = tx(h.x);
    const hty = tx(h.y);
    const key = w.idx(htx, hty);
    if (!force && key === this.visionKey) {
      this.cullActors();
      return;
    }
    this.visionKey = key;
    const R = this.lightRadius();
    w.computeVisible(htx, hty, R);
    const px = this.fogData.data;
    for (let y = 0; y < w.h; y++)
      for (let x = 0; x < w.w; x++) {
        const i = y * w.w + x;
        let a = 255;
        if (w.visible[i]) {
          const d = Math.hypot(x - htx, y - hty);
          a = Math.max(0, Math.min(1, (d - (R - 3)) / 3)) * 120;
        } else if (w.explored[i]) a = 165;
        px[i * 4 + 3] = a;
      }
    this.fogTex.getContext().putImageData(this.fogData, 0, 0);
    this.fogTex.refresh();
    this.fogVersion++;
    this.cullActors();
  }
  private visionKey = -1;

  /** Monsters only show while the hero can actually see their tile. */
  private cullActors(): void {
    const w = this.world;
    for (const m of this.mons) {
      const vis = !!w.visible[w.idx(tx(m.x), tx(m.y))];
      m.spr.setVisible(vis && !m.dead);
      m.mark?.setVisible(vis);
    }
  }

  /** True when no alerted monster is close: the only time equipment may be changed. */
  isSafe(): boolean {
    const h = this.hero;
    if (!h) return true;
    return !this.mons.some((m) => !m.dead && m.alerted && m.def.ai !== 'generator' && Math.hypot(m.x - h.x, m.y - h.y) < 10 * TILE);
  }

  /** World position under the mouse, for debug and tools. */
  mouseWorld(): { x: number; y: number } {
    const cam = this.cameras.main;
    return { x: input.mx + cam.scrollX, y: input.my + cam.scrollY };
  }
}

export const VIEW = { w: VIEW_W, h: VIEW_H };
