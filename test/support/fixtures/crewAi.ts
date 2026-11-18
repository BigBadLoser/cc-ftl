/** Shared pieces of the crew AI phase 1 tests (docs/CREW_AI.md section 10) and their slow tiers. */
import { expect } from 'vitest';
import { CrewC, HealthC, NeedsC } from '../../../src/sim/crew/components';
import { homeShip } from '../../../src/sim/combat/ships';
import { newGame } from '../../../src/sim/newGame';
import { shipGrid } from '../../../src/sim/regions';
import { deserialize, serialize } from '../../../src/sim/save';
import type { Sim } from '../../../src/sim/sim';
import { Struct } from '../../../src/sim/structure';
import { content } from '../content';
import { run } from '../sim';

export function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

export /** A small deterministic sequence for the tests' own choices (the sim's RNG is not touched). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}

export function floorTiles(sim: Sim): { x: number; y: number }[] {
  const g = shipGrid(sim, homeShip(sim))!;
  const out: { x: number; y: number }[] = [];
  for (let y = g.y0; y < g.y0 + g.height; y++) for (let x = g.x0; x < g.x0 + g.width; x++) if (g.get('struct', x, y) === Struct.Floor && !g.get('module', x, y)) out.push({ x, y });
  return out;
}

export /** The starter with metal stacks on its floor to haul. */
function haulBoard(seed: number): Sim {
  const sim = newGame(seed, content, 'ship.starter', false);
  run(sim, 2);
  const ship = homeShip(sim);
  for (const t of floorTiles(sim).filter((_, i) => i % 6 === 0)) sim.enqueue({ type: 'debug.spawnItems', ship, x: t.x, y: t.y, item: 'item.metal', count: 7 });
  run(sim, 1);
  return sim;
}

/** One scripted run: hauls, a downed crew member, draft and move orders, a cancelled job. Returns the events and per-tick hashes. */
export function scripted(saveAt: readonly number[] = [], hashEvery = 1): { events: string; hashes: number[] } {
  let sim = haulBoard(5);
  const crew = sim.world.query(CrewC);
  sim.world.get(crew[1]!, HealthC)!.hp = 0;
  sim.world.get(crew[2]!, NeedsC)!.rest = 10;
  const ship = homeShip(sim);
  const floor = floorTiles(sim);
  const events: string[] = [];
  const hashes: number[] = [];
  for (let i = 0; i < 500; i++) {
    if (i === 40) sim.enqueue({ type: 'crew.draft', id: crew[0]!, drafted: true });
    if (i === 41) sim.enqueue({ type: 'crew.moveTo', id: crew[0]!, x: floor[3]!.x, y: floor[3]!.y });
    if (i === 120) sim.enqueue({ type: 'crew.draft', id: crew[0]!, drafted: false });
    if (i === 200) sim.enqueue({ type: 'job.build', ship, x: floor[10]!.x, y: floor[10]!.y, struct: Struct.Door });
    if (i === 260) sim.enqueue({ type: 'job.cancel', ship, x: floor[10]!.x, y: floor[10]!.y });
    if (saveAt.includes(i)) sim = deserialize(serialize(sim), content);
    sim.step();
    events.push(...sim.events.drain().map((e) => JSON.stringify(e)));
    if ((i + 1) % hashEvery === 0 || i === 499) hashes.push(fnv(serialize(sim)));
  }
  return { events: events.join('\n'), hashes };
}

/** Three scripted runs agree event for event and (every `hashEvery` ticks) hash for hash, and so does one saved and reloaded at random points. */
export function expectScriptedReplay(hashEvery: number): void {
  const a = scripted([], hashEvery);
  const b = scripted([], hashEvery);
  const c = scripted([], hashEvery);
  expect(b.events).toBe(a.events);
  expect(c.events).toBe(a.events);
  expect(b.hashes).toEqual(a.hashes);
  expect(c.hashes).toEqual(a.hashes);
  const next = lcg(11);
  const points = Array.from({ length: 8 }, () => Math.floor(next() * 500)).sort((x, y) => x - y);
  const d = scripted(points, hashEvery);
  expect(d.events).toBe(a.events);
  expect(d.hashes).toEqual(a.hashes);
}
