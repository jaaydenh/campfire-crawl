// Entry point for the code-authored pixel art.
//   buildArtPixels()   pure RGBA data for every sheet in the manifest (runs in Node)
//   buildArtCanvases() the same, as canvases ready to hand to Phaser

import { SHEETS, type ArtPixels, type SheetKey, type SheetPixels } from './manifest';
import { type Img, artWarnings, toSheet } from './draw';
import { buildTiles } from './tiles';
import { buildObjects } from './objects';
import { buildFx } from './fx';
import { buildIcons } from './icons';
import { buildMireMonsters, buildPriest } from './mire';
import { buildChief, buildDigits, buildHero, buildMonsters, buildNpcs } from './sprites';

export { artWarnings };

export function buildArtFrames(): Record<SheetKey, Img[]> {
  const monsters = buildMonsters();
  return {
    ...buildMireMonsters(),
    priest: buildPriest(),
    tiles: buildTiles(),
    objects: buildObjects(),
    fx: buildFx(),
    icons: buildIcons(),
    hero0: buildHero(0),
    hero1: buildHero(1),
    hero2: buildHero(2),
    hero3: buildHero(3),
    hero4: buildHero(4),
    slime: monsters.slime,
    wolf: monsters.wolf,
    bandit: monsters.bandit,
    archer: monsters.archer,
    bat: monsters.bat,
    spider: monsters.spider,
    brood: monsters.brood,
    dire: monsters.dire,
    marksman: monsters.marksman,
    brute: monsters.brute,
    chief: buildChief(),
    npc: buildNpcs(),
    digits: buildDigits(),
  };
}

export function buildArtPixels(): ArtPixels {
  artWarnings.length = 0;
  const frames = buildArtFrames();
  const out = {} as Record<SheetKey, SheetPixels>;
  for (const key of Object.keys(SHEETS) as SheetKey[]) {
    const def = SHEETS[key];
    out[key] = toSheet(key, frames[key], def.w, def.h, def.frames);
  }
  return out;
}

export function buildArtCanvases(): Record<SheetKey, HTMLCanvasElement> {
  const pixels = buildArtPixels();
  const out = {} as Record<SheetKey, HTMLCanvasElement>;
  for (const key of Object.keys(SHEETS) as SheetKey[]) {
    const sheet = pixels[key];
    const canvas = document.createElement('canvas');
    canvas.width = sheet.width;
    canvas.height = sheet.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(`2D canvas context unavailable for sheet "${key}"`);
    const image = ctx.createImageData(sheet.width, sheet.height);
    image.data.set(sheet.data);
    ctx.putImageData(image, 0, 0);
    out[key] = canvas;
  }
  return out;
}
