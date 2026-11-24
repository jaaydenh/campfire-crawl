import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import './ui/style.css';
import Phaser from 'phaser';
import { wireHooks } from './app';
import * as app from './app';
import { buildArtCanvases } from './art/art';
import type { SheetKey } from './art/manifest';
import { audio } from './audio/audio';
import { G } from './core';
import { GameScene, scene } from './game/scene';
import { initInput } from './input';
import { UI_SCALE, VIEW_H, VIEW_W } from './types';
import { hudFrame, initHud } from './ui/hud';
import { initUi, titleScreen } from './ui/ui';

const stage = document.getElementById('stage')!;
const gameEl = document.getElementById('game')!;
const uiEl = document.getElementById('ui')!;

// Scale the fixed-size stage to the window, in steps that keep game pixels square and crisp.
function fit(): void {
  const raw = Math.min(window.innerWidth / (VIEW_W * UI_SCALE), window.innerHeight / (VIEW_H * UI_SCALE));
  const k = raw >= 1 ? Math.floor(raw * UI_SCALE) / UI_SCALE : raw;
  stage.style.transform = `translate(-50%, -50%) scale(${k})`;
}
window.addEventListener('resize', fit);
fit();

G.art = buildArtCanvases();
for (const key of Object.keys(G.art) as SheetKey[]) G.artUrl[key] = G.art[key].toDataURL();
const rootStyle = document.documentElement.style;
rootStyle.setProperty('--icons', `url(${G.artUrl.icons})`);
for (let i = 0; i < 4; i++) rootStyle.setProperty(`--hero${i}`, `url(${G.artUrl[`hero${i}` as SheetKey]})`);

initInput(gameEl);
initHud(uiEl);
initUi(uiEl);
wireHooks();
G.hooks.frame = hudFrame;

const unlock = () => audio.unlock();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

new Phaser.Game({
  type: Phaser.AUTO,
  parent: gameEl,
  width: VIEW_W,
  height: VIEW_H,
  backgroundColor: '#07060b',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.NONE, zoom: UI_SCALE },
  audio: { noAudio: true },
  banner: false,
  scene: [GameScene],
});

titleScreen();

if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__game = { G, app, audio, get scene() { return scene; } };
