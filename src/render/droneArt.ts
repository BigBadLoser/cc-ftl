import { Sprite, type Container } from 'pixi.js';
import { batchAdditive } from './batch';
import type { Atlas, StaticSprite } from './assets/loader';
import { headingIndex } from './shuttleView';

/**
 * Pipeline art for drones (#324, `drones` sheet), used whenever the manifest has it; droneView falls back to the code placeholder
 * (`paintDrone`) when it does not. Ids: `<def>.<fly|work|docked|inert>.d<0..7>` (work adds `.f0|.f1`), the medic's `<def>.work.beam.d<k>`
 * and the shared `drone.shadow`. The def id is the art prefix (`drone.repair.fly.d3`).
 */
export interface DroneArtIds {
  /** Body sprite ids, best first (a docked drone has one pose, `.d1`, so its exact heading falls back to it). */
  body: string[];
  beam: string | null;
  shadow: string;
}

/** Work loop: ms per frame. */
const WORK_FRAME_MS = 160;

/** The art ids of a drone this frame. */
export function droneArtIds(def: string, s: { down: boolean; working: boolean; docked: boolean }, heading: number, clock: number): DroneArtIds {
  const d = headingIndex(heading);
  if (s.down) return { body: [`${def}.inert.d${d}`], beam: null, shadow: 'drone.shadow' };
  if (s.docked) return { body: [`${def}.docked.d${d}`, `${def}.docked.d1`], beam: null, shadow: 'drone.shadow' };
  if (s.working) {
    const f = Math.floor((clock * 1000) / WORK_FRAME_MS) % 2;
    return { body: [`${def}.work.d${d}.f${f}`], beam: `${def}.work.beam.d${d}`, shadow: 'drone.shadow' };
  }
  return { body: [`${def}.fly.d${d}`], beam: null, shadow: 'drone.shadow' };
}

/** The sprites one drone's art is drawn with (created on first use). */
export interface DroneArtSprites {
  shadow: Sprite;
  beam: Sprite;
  body: Sprite;
  glow: Sprite;
}

export function createDroneArtSprites(parent: Container): DroneArtSprites {
  const s = { shadow: new Sprite(), beam: new Sprite(), body: new Sprite(), glow: new Sprite() };
  batchAdditive(s.glow);
  parent.addChild(s.shadow, s.beam, s.body, s.glow);
  return s;
}

const show = (spr: Sprite, st: StaticSprite | undefined, y: number): void => {
  spr.visible = !!st;
  if (!st) return;
  spr.texture = st.tex;
  spr.position.set(-st.ax, -st.ay + y);
};

/**
 * Draw a drone from the atlas: the shadow on the deck at (0, 0), the body (and its glow, and a beam if any) lifted by `lift` art px. False
 * (and nothing shown) when the atlas has no body sprite for it: the caller draws the placeholder.
 */
export function applyDroneArt(atlas: Pick<Atlas, 'stat'>, spr: DroneArtSprites, ids: DroneArtIds, lift: number): boolean {
  const body = ids.body.map((id) => atlas.stat(id)).find((st) => !!st);
  if (!body) {
    for (const s of [spr.shadow, spr.beam, spr.body, spr.glow]) s.visible = false;
    return false;
  }
  show(spr.body, body, -lift);
  spr.glow.visible = !!body.glow;
  if (body.glow) {
    spr.glow.texture = body.glow;
    spr.glow.position.copyFrom(spr.body.position);
  }
  show(spr.shadow, lift > 0.5 ? atlas.stat(ids.shadow) : undefined, 0);
  show(spr.beam, ids.beam ? atlas.stat(ids.beam) : undefined, -lift);
  return true;
}
