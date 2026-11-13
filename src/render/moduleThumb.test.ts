import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { World } from '../sim/ecs';
import { AirlockC } from '../sim/modules/airlock';
import type { Module } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import { TICK_HZ } from '../sim/time';
import raw from '../../public/assets/1x/manifest.json?raw';
import { PREVIEW_LEVEL, layersOf } from './layerPick';
import { steady } from './vehicleBayArt';

const ids = new Set(Object.keys((JSON.parse(raw) as { assets: Record<string, unknown> }).assets));

/** Planned modules whose sheets are not in the manifest yet (the card shows a placeholder icon). Remove an id when its art lands. */
const ART_PENDING = new Set(['module.cargo_container']);

describe('build catalog thumbnails', () => {
  // The catalog, popover preview and placement ghost all draw a def through `layersOf` in its preview state: every buildable
  // module has to resolve at least one layer whose art exists in the manifest (else its card is empty and its ghost invisible).
  it.each(Object.entries(content.modules as Record<string, ModuleDef>))('%s has art in the preview state', (defId, def) => {
    const world = new World();
    const id = world.createEntity();
    if (def.airlock) world.add(id, AirlockC, { state: 'toInner', timer: Math.round((def.airlock.cycleSec * TICK_HZ) / 2), request: null });
    const m: Module = { def: defId, x: 0, y: 0, rot: 0, hp: def.maxHp, powerPriority: 3, enabled: true, powered: true, reservedBy: 0 };
    const layers = layersOf(world, id, m, def, { active: false, now: 0, airlock: { level: PREVIEW_LEVEL, roofed: false, collar: null }, bay: steady(true) });
    expect(layers.length).toBeGreaterThan(0);
    const hasArt = layers.some((l) => l.chain.some((c) => ids.has(c)));
    expect(hasArt, `${defId}: ${layers.map((l) => l.chain[0]).join(', ')}`).toBe(!ART_PENDING.has(defId));
  });
});
