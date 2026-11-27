// Turn flow: what happens between the hub, the world and the screens in between.
import { audio } from './audio/audio';
import { G, run } from './core';
import { getMap } from './data/maps';
import { BOSS_LINES } from './data/monsters';
import { tierDef } from './data/tiers';
import { scene } from './game/scene';
import { advanceTurn, campRest, createRun, discoverItem, finishRun, heroFell } from './run';
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

export function startRun(party: number[], mapId: string, tier: number): void {
  G.save!.run = createRun(G.save!, party, mapId, tier);
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
  const { settings, heroes } = G.save!;
  const disk = loadSlot(G.slot);
  if (disk) {
    disk.settings = settings;
    disk.heroes.forEach((h, i) => (h.controls = heroes[i]?.controls)); // set from the pause menu, like the volume
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
  const def = getMap(r.mapId, r.tier);
  const unlocked: string[] = [];
  if (won) {
    for (const id of def.clearUnlocks) if (discoverItem(s, id)) unlocked.push(id);
    s.mapsUnlocked = Math.max(s.mapsUnlocked, def.number + 1);
  }
  const summary = finishRun(s, won, unlocked, Math.ceil((def.checkpoints.length - 1) / 2));
  scene.unloadRun();
  showHud(false);
  saveNow();
  audio.music(null);
  audio.sfx(won ? 'victory' : 'gameover');
  ui.summaryScreen(summary, def, () => ui.hubScreen());
}

export function wireHooks(): void {
  G.hooks.toast = ui.toast;
  G.hooks.dialog = ui.dialog;

  G.hooks.onCheckpoint = (index) => {
    const r = run();
    r.checkpoint = index;
    campRest(G.save!, r);
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

  G.hooks.onHeroDeath = (x, y) => {
    const r = run();
    const fallen = r.active;
    const lostRescue = !!r.fallen; // someone was waiting for this hero to reach them
    if (heroFell(G.save!, r, x, y)) return endRun(false);
    advanceTurn(r);
    saveNow();
    ui.deathScreen(fallen, lostRescue, nextTurn);
  };

  G.hooks.onBossPhase = (phase) => {
    const r = run();
    r.lives++;
    for (const rh of r.heroes) rh.earned += 10;
    audio.sfx('phase');
    const boss = getMap(r.mapId, r.tier).boss.type;
    const lines = BOSS_LINES[boss];
    const help = (tierDef(r.tier).bossHelp[boss]?.[phase - 1] ?? []).length > 0;
    ui.toast(`${lines.breaks[Math.min(phase, lines.breaks.length) - 1]}: +1 life.${help ? ` ${lines.help}` : ''}`, 'good');
  };

  G.hooks.onBossDefeated = () => endRun(true);
}
