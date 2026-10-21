import { describe, expect, it } from 'vitest';
import {
  AboardC, BodyC, CombatC, CrewC, FTL_CHARGE_SEC, ModuleC, PositionC, ShipC, Struct, VehicleC, deserialize, generateShip, homeShip,
  jumpWarnings, liftSet, liftShip, newGame, serialize, shipGrid, stampShip, type FactionDef, type ModuleDef, type Sim,
} from '../../sim';
import { ContainerC } from '../../sim/containers/components';
import { translated } from '../../sim/sector/translate';
import { content } from '../index';
import { factions } from '../factions/index';

/** A ship's state in its own frame: every entity that lifts with it (components moved to ship-local tiles) and its tiles. */
function local(sim: Sim, ship: number): string {
  const s = sim.world.get(ship, ShipC)!;
  const byId = new Map<number, Record<string, unknown>>();
  for (const [name, rows] of Object.entries(sim.world.serialize().stores)) {
    for (const [id, v] of rows) {
      if (!byId.has(id)) byId.set(id, {});
      byId.get(id)![name] = v;
    }
  }
  const entities = liftSet(sim, ship).map((id) => [id, translated(byId.get(id) ?? {}, -s.x, -s.y)]);
  const rect = { x: s.x, y: s.y, w: s.width, h: s.height };
  const tiles = sim.sector.grid.fieldNames().map((f) => [f, Array.from(sim.sector.grid.load(f, rect))]);
  return JSON.stringify({ entities, tiles });
}

function run(sim: Sim, n: number): string[] {
  const log: string[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    for (const e of sim.events.drain()) log.push(e.type === 'command.rejected' ? `${e.type}:${e.command}:${e.reason}` : e.type);
  }
  return log;
}

/** Charge the player's drive and queue a jump. */
function jump(sim: Sim, node: number, withDocked?: number[], ship = homeShip(sim)): void {
  const combat = sim.world.get(ship, CombatC);
  if (combat) combat.ftl = FTL_CHARGE_SEC;
  sim.enqueue({ type: 'sector.jump', ship, node, ...(withDocked ? { withDocked } : {}) });
}

const vehicleOf = (sim: Sim, ship: number): number => sim.world.query(VehicleC).find((v) => sim.world.get(v, VehicleC)?.homeShip === ship) ?? 0;
const airlockOf = (sim: Sim, ship: number): number =>
  sim.world.query(ModuleC).find((m) => sim.world.get(m, ModuleC)?.def === 'module.airlock' && liftSet(sim, ship).includes(m)) ?? 0;

describe('ship packets', () => {
  it('lift then stamp at another offset gives the identical ship modulo translation, and frees its chunks', () => {
    const sim = newGame(4, content);
    run(sim, 300);
    const ship = homeShip(sim);
    const before = local(sim, ship);
    const n = sim.world.entityCount;
    const packet = liftShip(sim, ship);
    expect(sim.world.entityCount).toBe(0);
    expect(sim.sector.grid.chunkCount).toBe(0);
    expect(stampShip(sim, packet, { x: 333, y: 217 })).toBe(ship);
    expect(sim.world.entityCount).toBe(n);
    expect(sim.world.get(ship, ShipC)).toMatchObject({ x: 333, y: 217 });
    expect(local(sim, ship)).toBe(before);
  });

  it('a lifted and re-stamped ship plays on exactly like one that stayed (modulo translation)', () => {
    const a = newGame(6, content);
    const b = newGame(6, content);
    run(a, 200);
    run(b, 200);
    const ship = homeShip(b);
    stampShip(b, liftShip(b, ship), { x: 261, y: 143 });
    const la = run(a, 600);
    const lb = run(b, 600);
    expect(lb).toEqual(la);
    expect(local(b, ship)).toBe(local(a, ship));
    expect(b.rng.getState()).toBe(a.rng.getState());
  });

  it('the template path still stamps a fresh ship (stampShip(template))', () => {
    const sim = newGame(1, content);
    const id = stampShip(sim, content.ships['ship.raider']!, { faction: 'hostile', x: 300, y: 40 });
    expect(sim.world.get(id, ShipC)).toMatchObject({ faction: 'hostile', x: 300, y: 40 });
    expect(sim.world.query(ModuleC).some((m) => liftSet(sim, id).includes(m))).toBe(true);
  });

  it('a hostile shuttle docked at the airlock is cut loose by default and comes along when picked', () => {
    for (const take of [false, true]) {
      const sim = newGame(2, content);
      const raider = stampShip(sim, content.ships['ship.raider']!, { faction: 'hostile', x: 160, y: 40 });
      const player = homeShip(sim);
      const shuttle = vehicleOf(sim, raider);
      const airlock = airlockOf(sim, player);
      expect(shuttle && airlock).toBeTruthy();
      const v = sim.world.get(shuttle, VehicleC)!;
      Object.assign(v, { state: 'docked', dock: airlock, dest: null });
      expect(jumpWarnings(sim, player).hostileDocked).toEqual([shuttle]);
      const packet = liftShip(sim, player, { withDocked: take ? [shuttle] : false });
      const ids = packet.entities.map((e) => e.id);
      expect(ids.includes(shuttle)).toBe(take);
      if (!take) expect(sim.world.get(shuttle, VehicleC)).toMatchObject({ state: 'flying', dock: 0 });
      // The player's own shuttle (stowed in its bay) always comes.
      expect(ids).toContain(vehicleOf(newGame(2, content), player));
    }
  });

  it('clamped cargo containers travel with their ship', () => {
    const civ = factions['faction.civilian'] as FactionDef;
    const only: FactionDef = { ...civ, hullFamilies: (civ.hullFamilies ?? []).filter((h) => h.id === 'freighter') };
    const g = generateShip(only, 'faction.civilian', 3, 0, content.modules as Record<string, ModuleDef>);
    const sim = newGame(1, content);
    const ship = stampShip(sim, g.template, { faction: 'neutral', x: 300, y: 40, state: 'prize' });
    const boxes = sim.world.query(ContainerC).slice();
    expect(boxes.length).toBeGreaterThan(0);
    const before = local(sim, ship);
    const packet = liftShip(sim, ship);
    for (const id of boxes) expect(packet.entities.some((e) => e.id === id)).toBe(true);
    stampShip(sim, packet, { x: 300, y: 300 });
    expect(local(sim, ship)).toBe(before);
    for (const id of boxes) expect(sim.world.get(id, ContainerC)?.state).toBe('clamped');
  });
});

describe('sector.jump, archives and sector.deploy', () => {
  it('jumps, archives the rest, deploys, and restores the archive on return', () => {
    const sim = newGame(3, content);
    const raider = stampShip(sim, content.ships['ship.raider']!, { faction: 'hostile', x: 160, y: 40, state: 'wreck' });
    run(sim, 20);
    const player = homeShip(sim);
    const raiderIds = sim.world.ids().filter((id) => !liftSet(sim, player).includes(id));
    const raiderTiles = Array.from(sim.sector.grid.load('struct', { x: 160, y: 40, w: 40, h: 30 }));
    jump(sim, 7);
    const log = run(sim, 1);
    expect(log).toContain('sector.jumped');
    expect(sim.sector).toMatchObject({ node: 7, state: 'deploying' });
    expect(sim.world.entityCount).toBe(0);
    expect(sim.archives.map((a) => a.node)).toEqual([0]);
    expect(sim.archives[0]!.entities.map((e) => e.id)).toEqual(raiderIds);
    // Deploying: the gap rule and the bounds are checked; then the ship is back with all its entities.
    sim.enqueue({ type: 'sector.deploy', x: -5, y: 0 });
    expect(run(sim, 1)).toContain('command.rejected:sector.deploy:outOfBounds');
    sim.enqueue({ type: 'sector.deploy', x: 100, y: 60 });
    expect(run(sim, 1)).toContain('sector.deployed');
    expect(sim.sector.state).toBe('active');
    expect(sim.world.get(player, ShipC)).toMatchObject({ x: 100, y: 60 });
    expect(sim.world.has(raider, ShipC)).toBe(false);
    // Back to node 0: the raider wreck returns as it was, and node 7 is archived (all archives are kept).
    jump(sim, 0);
    expect(run(sim, 1)).toContain('sector.jumped');
    expect(sim.archives.map((a) => a.node)).toEqual([7]);
    expect(sim.world.ids()).toEqual(raiderIds);
    expect(Array.from(sim.sector.grid.load('struct', { x: 160, y: 40, w: 40, h: 30 }))).toEqual(raiderTiles);
    sim.enqueue({ type: 'sector.deploy', x: 30, y: 40 });
    expect(run(sim, 1)).toContain('sector.deployed');
    expect(sim.world.get(raider, ShipC)?.state).toBe('wreck');
  });

  it('refuses a jump without FTL charge, and a deploy that breaks the gap rule', () => {
    const sim = newGame(3, content);
    const player = homeShip(sim);
    sim.enqueue({ type: 'sector.jump', ship: player, node: 1 });
    expect(run(sim, 1)).toContain('command.rejected:sector.jump:notCharged');
    jump(sim, 0);
    expect(run(sim, 1)).toContain('command.rejected:sector.jump:badNode');
    stampShip(sim, content.ships['ship.raider']!, { faction: 'hostile', x: 160, y: 40, state: 'wreck' });
    jump(sim, 1);
    run(sim, 1);
    jump(sim, 0, undefined, player); // refused while deploying
    expect(run(sim, 1)).toContain('command.rejected:sector.jump:deploying');
    // Back at node 0 the wreck is restored; deploying on top of it breaks the gap rule.
    sim.enqueue({ type: 'sector.deploy', x: 10, y: 10 });
    run(sim, 1);
    jump(sim, 0, undefined, player);
    run(sim, 1);
    sim.enqueue({ type: 'sector.deploy', x: 150, y: 35 });
    expect(run(sim, 1)).toContain('command.rejected:sector.deploy:overlap');
  });

  it('freezes a restored node while the deploy waits, including after a rejected deploy', () => {
    const sim = newGame(6, content);
    const player = homeShip(sim);
    // A fresh combat wreck with crew aboard: left to tick, its air, heat and crew would change.
    stampShip(sim, content.ships['ship.raider']!, { faction: 'hostile', x: 160, y: 40 });
    jump(sim, 1);
    run(sim, 1);
    sim.enqueue({ type: 'sector.deploy', x: 10, y: 10 });
    run(sim, 1);
    jump(sim, 0, undefined, player);
    expect(run(sim, 1)).toContain('sector.jumped');
    const snap = (): string => JSON.stringify({ w: sim.world.serialize(), g: sim.sector.grid.serialize() });
    const before = snap();
    sim.enqueue({ type: 'sector.deploy', x: 150, y: 35 }); // rejected: overlaps the raider
    expect(run(sim, 120)).toContain('command.rejected:sector.deploy:overlap');
    expect(snap()).toBe(before);
    sim.enqueue({ type: 'sector.deploy', x: 30, y: 40 });
    expect(run(sim, 1)).toContain('sector.deployed');
  });

  it('lists crew and shuttles away; they stay in the archive', () => {
    const sim = newGame(5, content);
    const player = homeShip(sim);
    const raider = stampShip(sim, content.ships['ship.raider']!, { faction: 'hostile', x: 160, y: 40, state: 'wreck' });
    const crew = sim.world.query(CrewC)[0]!;
    // One crew member boards the raider; the shuttle flies off with another aboard.
    const g = shipGrid(sim, raider)!;
    let tile = { x: 0, y: 0 };
    for (let y = g.y0; y < g.y0 + g.height && !tile.x; y++) for (let x = g.x0; x < g.x0 + g.width; x++) if (g.get('struct', x, y) === Struct.Floor) { tile = { x, y }; break; }
    Object.assign(sim.world.get(crew, PositionC)!, { ...tile, toX: tile.x, toY: tile.y, progress: 0 });
    const shuttle = vehicleOf(sim, player);
    const rider = sim.world.query(CrewC)[1]!;
    sim.world.remove(rider, PositionC);
    sim.world.add(rider, AboardC, { vehicle: shuttle });
    sim.world.get(shuttle, VehicleC)!.passengers.push(rider);
    Object.assign(sim.world.get(shuttle, VehicleC)!, { state: 'flying' });
    Object.assign(sim.world.get(shuttle, BodyC)!, { x: 120, y: 30 });
    const w = jumpWarnings(sim, player);
    expect(w.crew).toEqual([crew, rider].sort((a, b) => a - b));
    expect(w.vehicles).toEqual([shuttle]);
    expect(w.hostileDocked).toEqual([]);
    jump(sim, 2);
    run(sim, 1);
    const archived = sim.archives[0]!.entities.map((e) => e.id);
    expect(archived).toEqual(expect.arrayContaining([crew, rider, shuttle]));
    expect(sim.sector.packet!.entities.map((e) => e.id)).not.toContain(crew);
  });

  it('is deterministic and survives a save round trip with an archive and while deploying', () => {
    const make = (): Sim => {
      const sim = newGame(8, content);
      sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 160, y: 40 });
      run(sim, 100);
      jump(sim, 4);
      run(sim, 2);
      return sim;
    };
    const a = make();
    const b = deserialize(serialize(make()), content); // saved while deploying: the packet is in the save
    expect(serialize(b)).toBe(serialize(a));
    for (const s of [a, b]) {
      s.enqueue({ type: 'sector.deploy', x: 100, y: 60 });
      run(s, 300);
    }
    const c = deserialize(serialize(b), content);
    expect(c.archives).toHaveLength(1);
    const lc = run(c, 300);
    expect(run(a, 300)).toEqual(lc);
    expect(serialize(c)).toBe(serialize(a));
  });
});
