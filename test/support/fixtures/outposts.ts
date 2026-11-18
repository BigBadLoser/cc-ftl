import { expect } from 'vitest';
import type { OreDef } from '../../../src/sim/asteroids/types';
import { generateOutpost } from '../../../src/sim/outposts/gen';
import { airlockOutside } from '../../../src/sim/outposts/site';
import { validateOutpost } from '../../../src/sim/outposts/validate';
import type { ModuleDef } from '../../../src/sim/registry';
import { Struct } from '../../../src/sim/structure';
import { content } from '../content';
import { workerCache } from '../cache';

export const outpostCtx = { ores: Object.values(content.ores) as OreDef[], modules: content.modules, stations: content.stations };
const MODS: Record<string, ModuleDef> = content.modules;

type Outpost = NonNullable<ReturnType<typeof generateOutpost>>;
const built = workerCache<{ o: Outpost | null }>('outposts', 40);

/** A generated outpost, once per (style, seed, kind) per worker (shared by the test files it runs). Read-only: never mutate the result. */
export function cachedOutpost(style: 'surface' | 'dug', seed: number, kind?: string): Outpost | null {
  return built.get(`${style}:${seed}:${kind ?? ''}`, () => ({ o: generateOutpost(style, seed, outpostCtx, kind as never) })).o;
}

/** Airlocks never open into rock: a dug base has only its dock, whose collar is space. */
export function expectAirlocksClear(style: 'surface' | 'dug', seed: number): void {
  const o = cachedOutpost(style, seed);
  if (!o) return;
  const plan = o.asteroid;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= plan.w || y >= plan.h ? Struct.Space : plan.struct[y * plan.w + x]);
  const locks = (o.template.modules ?? []).filter((m) => MODS[m.def]?.airlock);
  expect(locks.length, `${style} #${seed}`).toBeGreaterThan(0);
  if (style === 'dug') {
    expect(locks.length, `dug #${seed}`).toBe(1);
    expect(at(o.at.x + o.dock.collar.x, o.at.y + o.dock.collar.y)).toBe(Struct.Space);
  }
  for (const m of locks) {
    const out = airlockOutside(MODS[m.def]!, m);
    expect(at(o.at.x + out.x, o.at.y + out.y), `${style} #${seed} airlock ${m.x},${m.y}`).not.toBe(Struct.Rock);
  }
  expect(o.station.station.docks).toBe(locks.length);
  expect(validateOutpost(o, content.modules), `${style} #${seed}`).toEqual([]);
}
