import { describe, expect, it } from 'vitest';
import { AllegianceC, AssignmentC, CrewC, DraftedC, ModuleC, NeedsC, PositionC, ShipC, placementError, playerShip, spawnModule, type Sim, type SimEvent } from '../sim';
import { JobC, type Job } from '../sim/crew/components';
import { CarryingC } from '../sim/items/components';
import { performStasis } from '../sim/stasis/jobs';
import { parkCart } from '../sim/stasis/cart';
import { floorTiles } from '../sim/stasis/place';
import { isTileWalkable } from '../sim/modules/walk';
import { Struct, writeStruct } from '../sim/structure';
import { shipGrid } from '../sim/regions';
import { abortTask } from '../sim/ai/task';
import { isHostile } from '../sim/fight/relations';
import { PrisonerC } from '../sim/fight/components';
import { StorageC } from '../sim/items/components';
import { accessTile, footprintTiles } from '../sim/modules/footprint';
import { footprintBlockedByCrew, removeModule } from '../sim/modules/spawn';
import { deserialize, serialize } from '../sim/save';
import { SLOT_NONE, StasisC, StasisWheelC } from '../sim/stasis/components';
import { cartRest, walking, isFrozen, slabDraining, slabInfo, slabPlace, wheelSlots } from '../sim/stasis/query';
import { RESERVE_TICKS, SLAB_ITEM } from '../sim/stasis/tuning';
import { playerCrew } from '../sim/story/world';
import { heldItems } from '../sim/items/held';
import { newGame } from '../sim';
import { content } from '.';

/** Prisoner holding (#116): seal on the spot, cart to the stasis wheel, reserve and thaw. */

const run = (sim: Sim, n: number): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
/** Step until `done` holds (at most `max` ticks); the events seen. */
const until = (sim: Sim, done: () => boolean, max = 3000): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < max && !done(); i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};

/** A free spot for a module (off every other module's access tile), scanning the ship from its top-left. */
function place(sim: Sim, def: string): number {
  const ship = playerShip(sim) as number;
  const at = sim.world.get(ship, ShipC)!;
  const d = content.modules[def as 'module.stasis_wheel'];
  const access = new Set(sim.world.query(ModuleC).map((id) => {
    const m = sim.world.get(id, ModuleC)!;
    const a = accessTile(content.modules[m.def as 'module.stasis_wheel'], m.x, m.y, m.rot);
    return a ? `${a.x},${a.y}` : '';
  }));
  const blocks = (x: number, y: number): boolean => footprintTiles(d, x, y, 0).some((t) => access.has(`${t.x},${t.y}`));
  for (let y = at.y; y < at.y + at.height; y++) {
    for (let x = at.x; x < at.x + at.width; x++) if (placementError(sim, ship, def, x, y, 0) === null && !blocks(x, y) && !footprintBlockedByCrew(sim, ship, def, x, y, 0)) return spawnModule(sim, def, x, y, 0);
  }
  throw new Error(`no room for ${def}`);
}

/** The starter game, crew fed and rested, a stasis wheel placed (unless `wheel` is false) and one hostile prisoner standing by the first crew member. */
function prisonGame(wheel = true): { sim: Sim; wheel: number; prisoner: number } {
  const sim = newGame(3, content);
  run(sim, 5);
  const w = wheel ? place(sim, 'module.stasis_wheel') : 0;
  for (const h of playerCrew(sim)) {
    const n = sim.world.get(h, NeedsC);
    if (n) Object.assign(n, { hunger: 100, rest: 100 });
  }
  const ship = playerShip(sim) as number;
  const at = sim.world.get(playerCrew(sim)[0] as number, PositionC)!;
  sim.enqueue({ type: 'debug.spawnCrew', ship, x: at.x, y: at.y, role: 'role.security', faction: 'hostile' });
  run(sim, 1);
  const prisoner = sim.world.query(CrewC).find((id) => sim.world.get(id, AllegianceC)?.faction === 'hostile') as number;
  sim.enqueue({ type: 'debug.imprison', crew: prisoner });
  run(sim, 1);
  return { sim, wheel: w, prisoner };
}

const stowed = (sim: Sim, prisoner: number) => (): boolean => slabPlace(sim, prisoner)?.kind === 'wheel';

describe('stasis wheel', () => {
  it('is built with ten empty slabs, and draws power only while it holds a prisoner', () => {
    const { sim, wheel } = prisonGame();
    const def = content.modules['module.stasis_wheel'];
    expect(def.footprint).toEqual([3, 3]);
    expect(def.stasisWheel?.slots).toBe(10);
    expect(wheelSlots(sim.world, wheel)).toEqual(new Array(10).fill({ kind: 'empty' }));
    expect(sim.world.get(wheel, ModuleC)!.powered).toBe(false); // idle: nothing to hold
    expect(heldItems(sim).filter((h) => h.where === 'slotted').reduce((n, h) => n + h.count, 0)).toBe(10);
  });

  it('crew seal a prisoner where they stand and cart the slab to the wheel', () => {
    const { sim, wheel, prisoner } = prisonGame();
    const events = until(sim, stowed(sim, prisoner));
    expect(events.some((e) => e.type === 'stasis.sealed' && e.crew === prisoner)).toBe(true);
    expect(events.some((e) => e.type === 'stasis.stowed' && e.crew === prisoner && e.wheel === wheel)).toBe(true);
    expect(isFrozen(sim, prisoner)).toBe(true);
    expect(sim.world.has(prisoner, PositionC)).toBe(false); // out of the world
    const slots = wheelSlots(sim.world, wheel);
    expect(slots.filter((s) => s.kind === 'full')).toEqual([{ kind: 'full', prisoner }]);
    expect(slots.filter((s) => s.kind === 'empty')).toHaveLength(9); // its own empty slab was used
    run(sim, 2);
    expect(sim.world.get(wheel, ModuleC)!.powered).toBe(true);
    expect(slabDraining(sim, prisoner)).toBe(false);
    expect(sim.world.query(JobC).some((j) => sim.world.get(j, JobC)?.kind === 'stasis')).toBe(false);
  });

  it('posts no seal job without a wheel', () => {
    const { sim, prisoner } = prisonGame(false);
    run(sim, 200);
    expect(sim.world.query(JobC).some((j) => sim.world.get(j, JobC)?.kind === 'stasis')).toBe(false);
    expect(isFrozen(sim, prisoner)).toBe(false);
  });

  it('takes an empty slab from storage when the wheel has none', () => {
    const { sim, wheel, prisoner } = prisonGame();
    sim.world.get(wheel, StasisWheelC)!.slots.fill(SLOT_NONE);
    const store = sim.world.query(StorageC, ModuleC).find((id) => sim.world.get(id, ModuleC)?.def === 'module.storage') as number;
    sim.world.get(store, StorageC)!.stacks.push({ item: SLAB_ITEM, count: 1 });
    until(sim, stowed(sim, prisoner));
    expect(isFrozen(sim, prisoner)).toBe(true);
    expect(sim.world.get(store, StorageC)!.stacks.filter((s) => s.item === SLAB_ITEM && s.count > 0)).toHaveLength(0);
  });

  it('a slab whose cart is set down lies on the floor and is picked up again', () => {
    const { sim, prisoner } = prisonGame();
    until(sim, () => sim.world.get(prisoner, StasisC)?.at === 'carried');
    const carrier = sim.world.get(prisoner, StasisC)!.carrier;
    abortTask(sim, carrier, 'cancelled');
    run(sim, 1);
    const p = slabPlace(sim, prisoner);
    expect(p?.kind).toBe('floor');
    if (p?.kind === 'floor') expect(Math.abs(p.tiles[1].x - p.tiles[0].x) + Math.abs(p.tiles[1].y - p.tiles[0].y)).toBe(1); // two tiles
    until(sim, stowed(sim, prisoner));
    expect(slabPlace(sim, prisoner)?.kind).toBe('wheel');
  });

  it('without power the reserve runs out in a game hour and the prisoner thaws, hostile, by the hatch', () => {
    const { sim, wheel, prisoner } = prisonGame();
    until(sim, stowed(sim, prisoner));
    run(sim, 2);
    const m = sim.world.get(wheel, ModuleC)!;
    m.enabled = false;
    run(sim, 2);
    expect(slabDraining(sim, prisoner)).toBe(true);
    const half = run(sim, RESERVE_TICKS / 2);
    expect(half.some((e) => e.type === 'stasis.thawed')).toBe(false);
    expect(slabInfo(sim, prisoner)!.reserve).toBeGreaterThan(0.4);
    // Power back: the reserve refills.
    m.enabled = true;
    run(sim, RESERVE_TICKS / 2);
    expect(slabInfo(sim, prisoner)!.reserve).toBe(1);
    m.enabled = false;
    const events = run(sim, RESERVE_TICKS + 5);
    expect(events.some((e) => e.type === 'stasis.thawed' && e.crew === prisoner)).toBe(true);
    expect(isFrozen(sim, prisoner)).toBe(false);
    expect(sim.world.has(prisoner, PrisonerC)).toBe(false);
    expect(sim.world.has(prisoner, DraftedC)).toBe(true);
    const pos = sim.world.get(prisoner, PositionC)!;
    const hatch = accessTile(content.modules['module.stasis_wheel'], m.x, m.y, m.rot)!;
    expect(Math.abs(pos.x - hatch.x) + Math.abs(pos.y - hatch.y)).toBeLessThanOrEqual(6);
    expect(isHostile(sim, prisoner, playerCrew(sim)[0] as number)).toBe(true);
    expect(wheelSlots(sim.world, wheel).filter((s) => s.kind === 'empty')).toHaveLength(10); // the slab is left empty in its slot
  });

  it('a wheel taken down sets its full slabs on the floor and spills its empty ones', () => {
    const { sim, wheel, prisoner } = prisonGame();
    until(sim, stowed(sim, prisoner));
    removeModule(sim, wheel);
    expect(slabPlace(sim, prisoner)?.kind).toBe('floor');
    expect(slabDraining(sim, prisoner)).toBe(true);
    expect(heldItems(sim).filter((h) => h.item === SLAB_ITEM).reduce((n, h) => n + h.count, 0)).toBe(9);
  });

  it('a frozen prisoner and the wheel slots survive a save round trip', () => {
    const { sim, wheel, prisoner } = prisonGame();
    until(sim, stowed(sim, prisoner));
    const copy = deserialize(serialize(sim), content);
    expect(wheelSlots(copy.world, wheel)).toEqual(wheelSlots(sim.world, wheel));
    expect(copy.world.get(prisoner, StasisC)).toEqual(sim.world.get(prisoner, StasisC));
    expect(slabPlace(copy, prisoner)).toEqual(slabPlace(sim, prisoner));
    expect(copy.world.get(prisoner, CrewC)?.name).toBe(sim.world.get(prisoner, CrewC)?.name);
  });

  it('never takes a second empty slab while the crew member holds one (a fetch that runs again)', () => {
    const { sim, wheel, prisoner } = prisonGame();
    const crew = playerCrew(sim)[1] as number;
    sim.world.add(crew, CarryingC, { item: SLAB_ITEM, count: 1 });
    const job = { category: 'hauling', kind: 'stasis', x: 0, y: 0, struct: 0, work: 1, progress: 0, reservedBy: crew, target: prisoner, stasis: { phase: 'fetch', from: { kind: 'wheel', id: wheel } } } as Job;
    for (let i = 0; i < 3; i++) {
      job.stasis = { phase: 'fetch', from: { kind: 'wheel', id: wheel } };
      performStasis(sim, crew, job, 1);
    }
    expect(wheelSlots(sim.world, wheel).filter((s) => s.kind === 'empty')).toHaveLength(10);
    expect(sim.world.get(crew, CarryingC)).toEqual({ item: SLAB_ITEM, count: 1 });
    expect(job.stasis?.phase).toBe('seal');
  });

  it('a prisoner walled off from the wheel gets no job, and the wheel keeps its slabs', () => {
    const { sim, wheel, prisoner } = prisonGame();
    const pos = sim.world.get(prisoner, PositionC)!;
    const grid = shipGrid(sim, playerShip(sim) as number)!;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) writeStruct(grid, pos.x + dx, pos.y + dy, Struct.Wall);
    run(sim, 600);
    expect(wheelSlots(sim.world, wheel).filter((s) => s.kind === 'empty')).toHaveLength(10);
    expect(sim.world.query(JobC).some((j) => sim.world.get(j, JobC)?.kind === 'stasis')).toBe(false);
    expect(isFrozen(sim, prisoner)).toBe(false);
  });

  it('a stopped carrier\'s cart parks beside them on free floor, toward the prisoner, and stays put until they walk', () => {
    const { sim, prisoner } = prisonGame();
    const sealing = (): number => sim.world.query(CarryingC).find((id) => {
      const job = sim.world.get(sim.world.get(id, AssignmentC)?.jobId ?? 0, JobC);
      return job?.stasis?.phase === 'seal' && !walking(sim.world, id) && !!cartRest(sim.world, id);
    }) ?? 0;
    until(sim, () => sealing() !== 0);
    const crew = sealing();
    expect(crew).not.toBe(0);
    const at = sim.world.get(crew, PositionC)!;
    const rest = cartRest(sim.world, crew)!;
    const [a, b] = floorTiles(rest.x, rest.y, rest.rot);
    const near = [a, b].find((t) => Math.abs(t.x - at.x) + Math.abs(t.y - at.y) === 1);
    const far = [a, b].find((t) => Math.abs(t.x - at.x) + Math.abs(t.y - at.y) === 2);
    expect(near && far).toBeTruthy(); // straight out from the carrier, the bar end beside them
    const grid = shipGrid(sim, playerShip(sim) as number)!;
    for (const t of [a, b]) expect(isTileWalkable(sim, grid, t.x, t.y)).toBe(true);
    const p = sim.world.get(prisoner, PositionC)!;
    expect([a, b].some((t) => t.x === p.x && t.y === p.y)).toBe(false);
    // Toward the prisoner where there is room: no other side is closer to them.
    const side = { x: near!.x - at.x, y: near!.y - at.y };
    const best = parkCart(sim, crew, { x: at.x, y: at.y }, { x: p.x, y: p.y });
    expect(best).toEqual(rest);
    expect(side.x * (p.x - at.x) + side.y * (p.y - at.y)).toBeGreaterThanOrEqual(0);
    // Stable while they stand and work.
    for (let i = 0; i < 5 && !walking(sim.world, crew); i++) {
      run(sim, 1);
      if (!walking(sim.world, crew) && cartRest(sim.world, crew)) expect(cartRest(sim.world, crew)).toEqual(rest);
    }
    // Walking: no rest.
    until(sim, () => walking(sim.world, crew));
    expect(cartRest(sim.world, crew)).toBeNull();
  });

  it('parks on the side toward the target, never on it, and finds none when boxed in', () => {
    const { sim } = prisonGame();
    const crew = playerCrew(sim)[1] as number;
    sim.world.add(crew, CarryingC, { item: SLAB_ITEM, count: 1 });
    const at = sim.world.get(crew, PositionC)!;
    const grid = shipGrid(sim, playerShip(sim) as number)!;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
      const near = { x: at.x + dx, y: at.y + dy }, far = { x: at.x + 2 * dx, y: at.y + 2 * dy };
      if (!isTileWalkable(sim, grid, near.x, near.y) || !isTileWalkable(sim, grid, far.x, far.y)) continue;
      const r = parkCart(sim, crew, at, { x: at.x + 5 * dx, y: at.y + 5 * dy })!;
      expect(floorTiles(r.x, r.y, r.rot)).toEqual(expect.arrayContaining([near, far])); // the side toward a far target
      const onTarget = parkCart(sim, crew, at, near); // the target beside them: never parked on it
      expect(onTarget && floorTiles(onTarget.x, onTarget.y, onTarget.rot).some((t) => t.x === near.x && t.y === near.y)).toBeFalsy();
    }
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) writeStruct(grid, at.x + dx, at.y + dy, Struct.Wall);
    expect(parkCart(sim, crew, at, null)).toBeNull();
  });
});
