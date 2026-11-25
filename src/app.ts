// Turn flow: what happens between the hub, the world and the screens in between.
import { audio } from './audio/audio';
import { G, activeHero, run } from './core';
import { getMap } from './data/maps';
import { scene } from './game/scene';
import { advanceTurn, createRun, finishRun, heroStats } from './run';
import { loadSlot, writeSlot } from './save';
import { showHud } from './ui/hud';
import * as ui from './ui/ui';

export function saveNow(): void {
  if (!G.save) return;
  if (G.save.run && scene?.loaded) scene.syncRun();
  if (!writeSlot(G.slot, G.save)) ui.toast('Could not save: this browser is not storing data (private window or storage full).', 'bad');
}

function nextTurn(): void {
  showHud(true);
  ui.readyScreen(() => scene.beginTurn());
}

export function startRun(party: number[], mapId: string): void {
  G.save!.run = createRun(G.save!, party, mapId);
  scene.loadRun();
  saveNow();
  nextTurn();
}

export function resumeRun(): void {
  scene.loadRun();
  nextTurn();
}

/** Leaves the world without ending the run. The save on disk is the last campfire, so this attempt is discarded. */
export function quitToHub(): void {
  scene.unloadRun();
  showHud(false);
  const settings = G.save!.settings;
  const disk = loadSlot(G.slot);
  if (disk) {
    disk.settings = settings;
    G.save = disk;
    writeSlot(G.slot, disk);
  }
  ui.hubScreen();
}

export function abandonRun(): void {
  endRun(false);
}

function endRun(won: boolean): void {
  const s = G.save!;
  const r = run();
  if (scene.loaded) scene.syncRun(); // so the map knowledge kept after the run includes this attempt's exploring
  const def = getMap(r.mapId);
  const unlocked: string[] = [];
  if (won) {
    for (const id of def.clearUnlocks)
      if (!s.pool.includes(id)) {
        s.pool.push(id);
        unlocked.push(id);
      }
    s.mapsUnlocked = Math.max(s.mapsUnlocked, def.number + 1);
  }
  const summary = finishRun(s, won, unlocked);
  scene.unloadRun();
  showHud(false);
  saveNow();
  audio.music(null);
  audio.sfx(won ? 'victory' : 'gameover');
  ui.summaryScreen(summary, def.name, () => ui.hubScreen());
}

export function wireHooks(): void {
  G.hooks.toast = ui.toast;
  G.hooks.dialog = ui.dialog;

  G.hooks.onCheckpoint = (index) => {
    const r = run();
    r.checkpoint = index;
    scene.commitKills();
    for (const rh of r.heroes) rh.earned += 5;
    const arrived = r.active;
    advanceTurn(r);
    saveNow();
    ui.campScreen(index, arrived, () => {
      saveNow();
      nextTurn();
    });
  };

  G.hooks.onHeroDeath = () => {
    const r = run();
    const rh = activeHero();
    rh.deaths++;
    rh.hp = heroStats(G.save!, rh).maxHp; // comes back at full health next turn
    r.lives--;
    if (r.lives <= 0) return endRun(false);
    const fallen = r.active;
    advanceTurn(r);
    saveNow();
    ui.deathScreen(fallen, nextTurn);
  };

  G.hooks.onBossPhase = (phase) => {
    const r = run();
    r.lives++;
    for (const rh of r.heroes) rh.earned += 10;
    audio.sfx('phase');
    ui.toast(phase === 2 ? "The Chief is enraged! His guard is broken again: +1 life." : "The Chief's guard is broken: +1 life. He calls for help!", 'good');
  };

  G.hooks.onBossDefeated = () => endRun(true);
}
