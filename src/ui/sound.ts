// Sound settings shared by the HUD and the menus.
import { IC } from '../art/manifest';
import { audio } from '../audio/audio';
import { G } from '../core';
import { loadSlot, writeSlot } from '../save';

export const musicOn = (): boolean => G.save?.settings.musicOn !== false;
/** The two-state icon shown inside every music toggle button. */
export const musicIcon = (): string => `<i class="ico" style="--i:${musicOn() ? IC.MusicOn : IC.MusicOff}"></i>`;
/** A music toggle for a menu screen; the screen maps data-act="music" to its handler. */
export const musicToggle = (): string => `<button class="btn ghost iconbtn" data-act="music" title="Music on / off" aria-label="Music on / off">${musicIcon()}</button>`;

/** Pushes the save's sound settings to the audio engine. Music off keeps the chosen volume for when it comes back. */
export function applyVolumes(): void {
  const st = G.save?.settings;
  if (st) audio.setVolumes(st.musicOn === false ? 0 : st.music, st.sfx);
}

/**
 * Stores the sound settings without saving the rest of the game: mid-section the save on disk
 * must stay at the last campfire, so only its settings are replaced.
 */
function persistSettings(): void {
  if (!G.save) return;
  const disk = loadSlot(G.slot);
  if (!disk) return;
  disk.settings = { ...G.save.settings };
  writeSlot(G.slot, disk);
}

export function toggleMusic(): void {
  if (!G.save) return;
  G.save.settings.musicOn = !musicOn();
  audio.unlock();
  applyVolumes();
  persistSettings();
}
