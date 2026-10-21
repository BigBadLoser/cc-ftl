import { describe, expect, it } from 'vitest';
import {
  deserialize, homeShip as homeShipOf, newGame, serialize, shipGrid, shipIdAt, shipIds, Struct, type Body, type Drafted, type Module, type Sim, type Vehicle,
} from '../../sim';
import { content } from '../index';

/**
 * The pre-refactor grid id of a ship id: grids and ships were created together with ascending ids, so a ship's grid id was its
 * 1-based place in ship-id order. 0 for no ship. (Step 7d removed grid ids; the hashes were recorded with them.)
 */
const ordinal = (sim: Sim, ship: number): number => shipIds(sim).indexOf(ship) + 1;
const gridIdAt = (sim: Sim, x: number, y: number): number => ordinal(sim, shipIdAt(sim, x, y));
const gridOfShip = (sim: Sim, ship: number): number => ordinal(sim, ship);

/** Grid fields that existed before the sector refactor (the `ship` owner layer is new and left out). */
const FIELDS = ['struct', 'room', 'o2', 'co2', 'temp', 'fire', 'smoke', 'light', 'door', 'module', 'item', 'hp'];

/** FNV-1a over a string, as 8 hex digits. */
function fnv(s: string, h = 0x811c9dc5): number {
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/**
 * The world as the pre-refactor code stored it. Step 8 moved vehicle position and heading onto `BodyC` and `homeGrid` to
 * `homeShip`: fold them back into the old `vehicle` component, in its old key order, and drop the `body` store (altitude is
 * new and derived from the state). Anything else that changed would still change the hash.
 */
function legacyWorld(sim: Sim): unknown {
  const data = sim.world.serialize();
  const stores = { ...data.stores };
  const bodies = new Map((stores.body ?? []) as [number, Body][]);
  delete stores.body;
  // Cargo containers came after the refactor: their (empty) store is not part of the legacy shape.
  if ((stores.container ?? []).length === 0) delete stores.container;
  // So did aliens (egg sacs, nests, creatures): their empty stores are not part of it either.
  // And asteroids (slice 1): an empty asteroid store is not part of it.
  for (const k of ['eggSac', 'nest', 'alien', 'asteroid']) if ((stores[k] ?? []).length === 0) delete stores[k];
  stores.vehicle = (stores.vehicle ?? []).map(([id, raw]) => {
    const { def, homeShip, home, state, hp, ...rest } = raw as Vehicle;
    const b = bodies.get(id) as Body;
    return [id, { def, homeGrid: gridOfShip(sim, homeShip), home, state, x: b.x, y: b.y, heading: b.heading, hp, ...rest }];
  });
  // Step 7d drops `gridId` from ShipC: it was the first key.
  stores.ship = (stores.ship ?? []).map(([id, raw]) => [id, { gridId: ordinal(sim, id), ...(raw as object) }]);
  // Step 7b drops `gridId` from the module component (the ship under its tile says it): put it back after `def`.
  stores.module = (stores.module ?? []).map(([id, raw]) => {
    const { def, ...rest } = raw as Module;
    return [id, { def, gridId: gridIdAt(sim, rest.x, rest.y), ...rest }];
  });
  // Step 7b2 drops `gridId` from Position (the tile says it): it was the first key.
  stores.position = (stores.position ?? []).map(([id, raw]) => {
    const pos = raw as Record<string, unknown>;
    return [id, { gridId: gridIdAt(sim, pos.x as number, pos.y as number), ...pos }];
  });
  // Jobs: `gridId` sat just before `x` in the key order.
  stores.job = (stores.job ?? []).map(([id, raw]) => {
    const j = raw as Record<string, unknown>;
    const gridId = gridIdAt(sim, j.x as number, j.y as number);
    return [id, Object.fromEntries(Object.entries(j).flatMap(([k, v]) => (k === 'x' ? [['gridId', gridId], [k, v]] : [[k, v]])))];
  });
  // Drafted: `planned` always carried its grid; `target` only when it was not the crew member's own grid.
  const crewGrid = new Map(((stores.position ?? []) as [number, { gridId: number }][]).map(([id, p]) => [id, p.gridId]));
  stores.drafted = (stores.drafted ?? []).map(([id, raw]) => {
    const d = raw as Drafted;
    const own = crewGrid.get(id) ?? 0;
    const grid = (t: { x: number; y: number }): number => gridIdAt(sim, t.x, t.y) || own;
    const out: Record<string, unknown> = { ...d };
    if (d.target) out.target = grid(d.target) === own ? d.target : { ...d.target, gridId: grid(d.target) };
    if (d.planned) out.planned = { ...d.planned, gridId: grid(d.planned) };
    return [id, out];
  });
  // Step 7c: targets, projectile origins and robot home links hold ship ids; the old code held grid ids, under the old key
  // names (`gridId`, `fromGridId`), in the same key positions.
  const gridKeyed = (o: Record<string, unknown>, from: string, to: string): Record<string, unknown> =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => (k === from ? [to, gridOfShip(sim, v as number)] : [k, v])));
  const target = (t: unknown): unknown => (t ? gridKeyed(t as Record<string, unknown>, 'ship', 'gridId') : t);
  stores.combat = (stores.combat ?? []).map(([id, raw]) => {
    const c = raw as Record<string, unknown>;
    return [id, { ...c, target: target(c.target) }];
  });
  stores.weapon = (stores.weapon ?? []).map(([id, raw]) => {
    const w = raw as Record<string, unknown>;
    return [id, { ...w, target: target(w.target), volleyTarget: target(w.volleyTarget) }];
  });
  stores.projectile = (stores.projectile ?? []).map(([id, raw]) => {
    const p = gridKeyed(raw as Record<string, unknown>, 'fromShip', 'fromGridId');
    return [id, { ...p, target: target(p.target) }];
  });
  stores.coreLink = (stores.coreLink ?? []).map(([id, raw]) => [id, gridKeyed(raw as Record<string, unknown>, 'ship', 'gridId')]);
  // Step 6 stores sector tiles in every component; the old code stored grid-local ones. Subtract each grid's origin.
  const origin = (gridId: number): [number, number] => {
    const g = shipGrid(sim, shipIds(sim)[gridId - 1] ?? 0);
    return g ? [g.x0, g.y0] : [0, 0];
  };
  const posGrid = new Map(((stores.position ?? []) as [number, { gridId: number }][]).map(([id, p]) => [id, p.gridId]));
  for (const [name, rows] of Object.entries(stores)) {
    stores[name] = (rows as [number, Record<string, unknown>][]).map(([id, c]) => {
      if (name === 'path') {
        const [ox, oy] = origin(posGrid.get(id) ?? 0);
        const steps = (c.steps as { x: number; y: number }[]).map((t) => ({ ...t, x: t.x - ox, y: t.y - oy }));
        return [id, { ...c, steps }];
      }
      if (name === 'ship' || typeof c.gridId !== 'number' || typeof c.x !== 'number') return [id, c]; // ShipC x, y were sector already
      const [ox, oy] = origin(c.gridId);
      const out: Record<string, unknown> = { ...c, x: (c.x as number) - ox, y: (c.y as number) - oy };
      if (typeof c.toX === 'number') Object.assign(out, { toX: c.toX - ox, toY: (c.toY as number) - oy });
      return [id, out];
    });
  }
  return { ...data, stores };
}

/**
 * A save-format-independent hash of the sim: tick, rng, every entity and component (in their pre-refactor shape, see
 * `legacyWorld`, with positions back in grid-local tiles), and each grid's legacy fields read tile by tile in local order
 * from its top-left (grids in id order). Recorded on the
 * pre-refactor code; must never change.
 */
function stateHash(sim: Sim, events: string): string {
  let h = fnv(`${sim.tick}|${sim.rng.getState()}|${JSON.stringify(legacyWorld(sim))}|${events}`);
  for (const [i, ship] of shipIds(sim).entries()) {
    const g = shipGrid(sim, ship)!;
    const vals: number[] = [i + 1, g.width, g.height];
    for (const f of FIELDS) {
      for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) vals.push(g.get(f, g.x0 + x, g.y0 + y));
    }
    h = fnv(vals.join(','), h);
  }
  return h.toString(16).padStart(8, '0');
}

function run(sim: Sim, n: number, log: string[]): void {
  for (let i = 0; i < n; i++) {
    sim.step();
    for (const e of sim.events.drain()) log.push(e.type);
  }
}

/** Starter ship against a raider: weapons, shields, breaches, fire and boarding. */
function combat(seed: number): Sim {
  const sim = newGame(seed, content);
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
  return sim;
}

/** Starter ship with a fire in the first floor tile from the centre and a hull breach on the first outer wall. */
function disaster(seed: number): Sim {
  const sim = newGame(seed, content);
  const g = shipGrid(sim, homeShipOf(sim))!;
  let fire: { x: number; y: number } | null = null;
  let breach: { x: number; y: number } | null = null;
  const at = (x: number, y: number) => g.get('struct', g.x0 + x, g.y0 + y);
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const k = at(x, y);
      if (!fire && k === Struct.Floor && y >= g.height / 2 && x >= g.width / 2) fire = { x: g.x0 + x, y: g.y0 + y };
      if (!breach && k === Struct.Wall && x > 0 && at(x - 1, y) === Struct.Space && at(x + 1, y) === Struct.Floor) {
        breach = { x: g.x0 + x, y: g.y0 + y };
      }
    }
  }
  sim.enqueue({ type: 'debug.ignite', ship: homeShipOf(sim), ...fire! });
  sim.enqueue({ type: 'debug.setStruct', ship: homeShipOf(sim), ...breach!, kind: Struct.Space });
  return sim;
}

describe('sector refactor equivalence', () => {
  it('a combat run hashes the same as before the refactor', () => {
    const sim = combat(3);
    const log: string[] = [];
    run(sim, 2400, log);
    expect(stateHash(sim, log.join(','))).toBe(EXPECTED.combat);
  });

  it('a fire and breach run hashes the same as before the refactor', () => {
    const sim = disaster(9);
    const log: string[] = [];
    run(sim, 1200, log);
    expect(stateHash(sim, log.join(','))).toBe(EXPECTED.disaster);
  });

  it('a save round trip midway gives the identical state', () => {
    const a = combat(5);
    const b = combat(5);
    const la: string[] = [], lb: string[] = [];
    run(a, 1200, la);
    run(b, 600, lb);
    const c = deserialize(serialize(b), content);
    run(c, 600, lb);
    expect(stateHash(c, lb.join(','))).toBe(stateHash(a, la.join(',')));
    expect(serialize(c)).toBe(serialize(a));
  });
});

const EXPECTED = { combat: 'd44fb7e2', disaster: '04df4a60' };
