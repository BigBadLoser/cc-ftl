import type { World } from '../sim/ecs';
import type { Module } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import { slabDrainingIn, wheelSlots, type WheelSlot } from '../sim/stasis/query';
import { moduleLayers, type ModuleLayer, type ModuleLook } from './moduleArt';

/**
 * The stasis wheel's layers (#116; sprites from tools/blender/sprites/slab_game.py, lab panel `stasis`). The base
 * `<asset>.r<n>` is the wheel with every socket empty; each full slot adds its slab, `<asset>.slot<i>.r<n>`, drawn
 * over it back to front. Slot i stands at angle 45 + 36 i deg in the wheel's own frame (slot 0 at the hatch corner),
 * and rotation r turns that frame 90 deg per step the way the sprite pipeline's modkit does, so a slot's depth is how
 * far round it sits from the corner facing the camera.
 */

export const STASIS_SLOTS = 10;
const DZ = 0.001;                                   // per slab, over the wheel's key (all under FRONT_DZ)
const LAMP_DZ = 0.02;                               // the rim lamps, over every slab

/** Each slot's rim lamp: off (no slab), amber (an empty slab ready), cyan (a prisoner held) or red (their slab on its reserve). */
export type Lamp = 'off' | 'amb' | 'cy' | 'red';
/** Each lit lamp's colour, multiplied into its white lens: green held, yellow an empty slab ready, red on its reserve. */
export const LAMP_TINT: Readonly<Record<Exclude<Lamp, 'off'>, number>> = { cy: 0x4f8f3a, amb: 0xc07a18, red: 0xb02a22 };
/** The red lamp's pulse: lit this many ms, then dark as long. */
export const PULSE_MS = 500;

export function lampOf(world: World, slot: WheelSlot | undefined): Lamp {
  if (!slot || slot.kind === 'none') return 'off';
  if (slot.kind === 'empty') return 'amb';
  return slabDrainingIn(world, slot.prisoner) ? 'red' : 'cy';
}

/** True in the lit half of the red lamp's pulse. */
export const pulseLit = (now: number): boolean => Math.floor(Math.max(0, now) / PULSE_MS) % 2 === 0;

/**
 * What the wheel's art depends on besides the module itself (moduleMemo's inputs): each slot's lamp, and the pulse's phase
 * while a lamp is red (the only time the wheel's art moves with the clock).
 */
export function stasisInputs(world: World, id: number, now: number): string {
  const lamps = wheelSlots(world, id).map((s) => lampOf(world, s));
  return lamps.join(',') + (lamps.includes('red') ? `|${pulseLit(now) ? 1 : 0}` : '');
}

/** Slots back to front for rotation `rot`: the order full slots are drawn in (fixed: the wheel rests in whole steps). */
export function slotOrder(rot: number): number[] {
  const depth = (i: number): number => Math.cos(((45 + 36 * i + 90 * rot - 45) * Math.PI) / 180);
  return Array.from({ length: STASIS_SLOTS }, (_, i) => i).sort((a, b) => depth(a) - depth(b));
}

export function stasisLayers(
  world: World, id: number, m: Module, def: ModuleDef, active: boolean, look?: ModuleLook,
): ModuleLayer[] {
  const main = moduleLayers(world, id, m, def, active, true, null, look)[0] as ModuleLayer;
  if (look?.hp !== undefined && look.hp <= 0) return [main];
  const out: ModuleLayer[] = [main];
  // A slot with a slab in it, empty or full, shows the slab (a full one's prisoner face is a later layer); a slot with none shows the bare socket.
  const slots = wheelSlots(world, id);
  slotOrder(m.rot).forEach((i, k) => {
    if ((slots[i]?.kind ?? 'none') === 'none') return;
    const sid = `${def.asset}.slot${i}.r${m.rot}`;
    out.push({ chain: [sid], key: `${def.asset}.slot${i}`, tiles: 'all', dz: DZ * (k + 1), optional: true });
  });
  // The rim gauge, on the canopy's top over everything inside: one segment per slot, lit in its state's colour (dark in the base), red pulsing.
  const lit = pulseLit(look?.now ?? 0);
  slots.forEach((s, i) => {
    const lamp = lampOf(world, s);
    if (lamp === 'off' || (lamp === 'red' && !lit)) return;
    out.push({ chain: [`${def.asset}.lamp${i}.r${m.rot}`], key: `${def.asset}.lamp${i}`, tiles: 'all', dz: LAMP_DZ, optional: true, tint: LAMP_TINT[lamp] });
  });
  return out;
}
