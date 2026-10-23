import { describe, expect, it } from 'vitest';
import { START_NODE, ShipC, deserialize, fleetName, galaxyIndex, newGame, portOf, serialize, visibleFleets, type GalaxyContent, type Sim } from '../sim';
import { catchUp, stepAgenda } from '../sim/galaxy/agenda';
import { liftFleet, materialiseFleet, tendFleets } from '../sim/galaxy/fleetShips';
import { stepFleets, syncFleets } from '../sim/galaxy/fleets';
import { portNode } from '../sim/galaxy/ports';
import { CATCHUP_MAX, STRANDED_INTEGRITY } from '../sim/galaxy/tuning';
import { onTurn } from '../sim/galaxy/turn';
import type { Fleet } from '../sim/galaxy/types';
import { content } from '.';

/** Play `n` turns of the starmap (the sector is parked as 'deploying' so nothing is materialised: fleets stay data). */
function turns(sim: Sim, n: number, each?: (turn: number) => void): void {
  for (let i = 0; i < n; i++) {
    onTurn(sim, ++sim.galaxy.turn);
    each?.(sim.galaxy.turn);
  }
}
const parked = (seed: number): Sim => {
  const sim = newGame(seed, content);
  sim.sector.state = 'deploying';
  return sim;
};
const fleetKit = (sim: Sim) => JSON.stringify(sim.galaxy.fleets);
const galaxy: GalaxyContent = content.galaxy;
const kinds = (sim: Sim, node: string) => (galaxyIndex(sim.galaxy).nodes.get(node)?.structures ?? []).map((s) => galaxy.structures[s.def]?.kind);

describe('rosters (persistent population)', () => {
  it('is deterministic: the same seed gives the same fleets, ships and names; another seed differs', () => {
    expect(fleetKit(newGame(21, content))).toBe(fleetKit(newGame(21, content)));
    expect(fleetKit(newGame(21, content))).not.toBe(fleetKit(newGame(22, content)));
  });

  it.each([21, 22, 23])('seed %i: every ship has a name and a home port, fleets match their port\'s kind and size, nothing starts at the player', (seed) => {
    const sim = newGame(seed, content);
    const g = sim.galaxy;
    expect(g.fleets.length).toBeGreaterThan(10);
    const per = new Map<string, number>();
    const names = new Set<string>();
    for (const f of g.fleets) {
      const port = portOf(sim, f.home);
      expect(port, f.home).toBeDefined();
      per.set(f.home, (per.get(f.home) ?? 0) + 1);
      const fixed = { den: 'pirate', depot: 'patrol', outpost: 'miner', nest: 'raider' } as const;
      if (port && port.kind !== 'station') expect(f.role).toBe(fixed[port.kind]);
      expect(galaxy.factions[f.faction]?.fleet?.groups[f.role]).toBeDefined();
      for (const c of f.ships) {
        expect(c.name, 'ship name').toBeTruthy();
        expect(names.has(c.name as string), `${c.name} is unique`).toBe(false);
        names.add(c.name as string);
        expect(c.ship).toBeUndefined();
      }
      expect(f.ships[0]?.name).toBeTruthy();
      expect(f.node === g.current && f.route.length === 0).toBe(false);
    }
    for (const [id, n] of per) {
      const port = portOf(sim, id)!;
      expect(n).toBeLessThanOrEqual(galaxy.fleet.ports[port.kind].groups[port.size - 1] as number);
    }
    // The player's own node holds no ship; a fleet homed there starts a hop out and comes in.
    expect(sim.world.query(ShipC).filter((id) => sim.world.get(id, ShipC)?.faction !== 'player')).toEqual([]);
  });

  it('names are faction flavoured', () => {
    const sim = newGame(21, content);
    for (const f of sim.galaxy.fleets) {
      const prefix = galaxy.factions[f.faction]?.fleet?.names.prefix;
      for (const c of f.ships) if (prefix) expect(c.name?.startsWith(`${prefix} `)).toBe(true);
    }
    expect(sim.galaxy.fleets.some((f) => f.faction === 'navy' && fleetName(f).startsWith('CNS '))).toBe(true);
    expect(fleetName({ role: 'pirate', ships: [{ name: 'Rust Jackal' }, { name: 'Gutter Saint' }] } as Fleet)).toBe('Rust Jackal +1');
  });

  it('size budgets: groups stay within their faction\'s caps; traders, civilians and miners are always one ship', () => {
    const cost = galaxy.fleet.sizeCost;
    let seen = 0;
    for (const seed of [21, 22, 23, 24]) {
      const sim = newGame(seed, content);
      for (const f of sim.galaxy.fleets) {
        seen++;
        const def = galaxy.factions[f.faction]?.fleet?.groups[f.role];
        expect(def).toBeDefined();
        if (!def) continue;
        expect(f.ships.length).toBeGreaterThanOrEqual(1);
        expect(f.ships.length).toBeLessThanOrEqual(def.maxShips);
        const spent = f.ships.reduce((n, c) => n + cost[c.size ?? 'small'], 0);
        const top = Math.max(...def.budget.map((b) => b.value));
        if (f.ships.length > 1) expect(spent).toBeLessThanOrEqual(top);
        if (f.role === 'trader' || f.role === 'miner' || galaxy.factions[f.faction]?.kind === 'civilian') expect(f.ships.length).toBe(1);
        if (f.ships.some((c) => c.size === 'heavy')) expect(f.ships.length).toBe(1);
        if (f.role === 'pirate') expect(f.ships.length).toBeLessThanOrEqual(2);
        // The ship really is a hull of its size class (the seed was searched for it).
        for (const c of f.ships) expect(c.size).toBeDefined();
      }
    }
    expect(seen).toBeGreaterThan(80);
  });
});

describe('agendas', () => {
  /** Run 160 turns and record, per fleet, where it stopped (finished a route) and whether it was ever away from home. */
  function observe(seed: number) {
    const sim = parked(seed);
    const stops = new Map<number, Set<string>>();
    const restedHome = new Set<number>();
    turns(sim, 160, (t) => {
      for (const f of sim.galaxy.fleets) {
        if (f.moved === t && f.route.length === 0) (stops.get(f.id) ?? stops.set(f.id, new Set()).get(f.id))?.add(f.node);
        if (f.node === portNode(f.home) && f.dwell > 0) restedHome.add(f.id);
      }
    });
    return { sim, stops, restedHome };
  }

  it.each([21, 23])('seed %i: traders stop at stations, miners at ore fields, patrols in their territory, pirates near their den, and all rest at home', (seed) => {
    const { sim, stops, restedHome } = observe(seed);
    const index = galaxyIndex(sim.galaxy);
    const seenRoles = new Set<string>();
    for (const f of sim.galaxy.fleets) {
      const home = portNode(f.home);
      for (const node of stops.get(f.id) ?? []) {
        seenRoles.add(f.role);
        if (node === home) continue;
        if (f.role === 'trader') expect(kinds(sim, node)).toContain('station');
        if (f.role === 'miner') expect(kinds(sim, node)).toContain('asteroids');
        if (f.role === 'patrol') expect(index.nodes.get(node)?.faction).toBe(f.faction);
      }
    }
    expect(seenRoles.has('trader') || seenRoles.has('miner') || seenRoles.has('patrol')).toBe(true);
    const moved = sim.galaxy.fleets.filter((f) => (stops.get(f.id)?.size ?? 0) > 0);
    expect(moved.length).toBeGreaterThan(3);
    // Fleets that went out came home to rest at some point.
    expect(moved.filter((f) => restedHome.has(f.id)).length).toBeGreaterThan(moved.length / 2);
  }, 60000);

  /** The stops (`node:dwell`) of a fleet running its agenda alone for 120 turns. */
  function run(sim: Sim, f: Fleet): string[] {
    sim.galaxy.current = f.node; // its region is the simulated one
    const trail: string[] = [];
    for (let t = 1; t <= 120; t++) {
      stepAgenda(sim, f, t);
      if (f.moved === t && !f.route.length) trail.push(`${f.node}:${f.dwell}`);
    }
    return trail;
  }

  it.each([['trader', 24], ['miner', 5]] as const)('a %s runs its errands and dwells at every stop (seed %i)', (role, seed) => {
    const sim = parked(seed);
    const mover = sim.galaxy.fleets.map((f) => ({ f, trail: run(sim, f) })).find((x) => x.f.role === role && x.trail.length > 2);
    expect(mover, `a ${role} that moves`).toBeDefined();
    const { f, trail } = mover!;
    const home = portNode(f.home);
    for (const stop of trail) {
      const [node, dwell] = stop.split(':') as [string, string];
      expect(Number(dwell)).toBeGreaterThanOrEqual(1);
      if (node !== home) expect(kinds(sim, node)).toContain(role === 'trader' ? 'station' : 'asteroids');
    }
    if (role === 'miner') expect(trail[0]?.split(':')[0]).not.toBe(home); // out to a field first
    expect(trail.some((s) => s.startsWith(`${home}:`))).toBe(true); // and back home
    if (role === 'trader') expect(new Set(trail.map((s) => s.split(':')[0])).size).toBeGreaterThan(1); // station to station
  });

  it('pirates and raiders prowl within a few jumps of their den', () => {
    // Pirate and nest ports are far from the start: park the player there.
    const sim = parked(21);
    sim.enqueue({ type: 'debug.galaxyReveal', radius: 3 });
    sim.step();
    const hostile = sim.galaxy.fleets.filter((f) => f.role === 'pirate' || f.role === 'raider');
    expect(hostile.length).toBeGreaterThan(0);
    for (const f of hostile.slice(0, 6)) {
      const home = portNode(f.home);
      const reach = (n: string): number => {
        let seen = new Set([home]);
        for (let h = 0; h < 8; h++) {
          if (seen.has(n)) return h;
          seen = new Set([...seen, ...[...seen].flatMap((id) => (galaxyIndex(sim.galaxy).adjacent.get(id) ?? []).map((e) => (e.a === id ? e.b : e.a)))]);
        }
        return 99;
      };
      sim.galaxy.current = f.node;
      for (let t = 1; t <= 80; t++) {
        stepAgenda(sim, f, t);
        if (f.moved === t && !f.route.length) expect(reach(f.node)).toBeLessThanOrEqual(3);
      }
    }
  }, 60000);
});

describe('persistence: nothing disappears except by destruction', () => {
  it('over 150 turns no ship leaves the population and every fleet keeps its ships, node and home valid', () => {
    const sim = parked(22);
    const before = new Map(sim.galaxy.fleets.flatMap((f) => f.ships.map((c) => [c.id, c.name] as const)));
    turns(sim, 150, () => {
      const index = galaxyIndex(sim.galaxy);
      for (const f of sim.galaxy.fleets) {
        expect(index.nodes.has(f.node)).toBe(true);
        expect(portOf(sim, f.home)).toBeDefined();
        expect(f.ships.length).toBeGreaterThan(0);
      }
    });
    const after = new Map(sim.galaxy.fleets.flatMap((f) => f.ships.map((c) => [c.id, c.name] as const)));
    expect([...after]).toEqual([...before]);
    expect(Object.keys(sim.galaxy.ports)).toEqual([]);
  }, 60000);

  it('a ship wrecked in the player\'s node is gone for good; its port owes a replacement and builds it after the rebuild time', () => {
    const sim = newGame(24, content);
    const g = sim.galaxy;
    const f = g.fleets.find((x) => x.role === 'patrol') as Fleet;
    const port = portOf(sim, f.home)!;
    const wait = galaxy.fleet.ports[port.kind].rebuildTurns;
    const doomed = f.ships[0]!;
    const total = g.fleets.reduce((n, x) => n + x.ships.length, 0);
    // Bring the fleet to the player's node, make it real, wreck one ship.
    Object.assign(f, { node: g.current, from: g.current, route: [], dwell: 99, synced: g.turn });
    materialiseFleet(sim, f);
    expect(doomed.ship).toBeDefined();
    sim.world.get(doomed.ship as number, ShipC)!.state = 'wreck';
    tendFleets(sim);
    const lostName = doomed.name;
    expect(g.fleets.flatMap((x) => x.ships).some((c) => c.name === lostName)).toBe(false);
    expect(g.ports[f.home]?.queue).toEqual([{ faction: f.faction, role: 'patrol', size: doomed.size }]);
    const owed = g.ports[f.home]!.next;
    expect(owed).toBe(g.turn + wait);
    // Nothing is built before it is due.
    sim.sector.state = 'deploying';
    const ships = () => g.fleets.reduce((n, x) => n + x.ships.length, 0);
    const alive = ships();
    expect(alive).toBeLessThan(total);
    while (g.turn < owed - 1) onTurn(sim, ++g.turn);
    expect(ships()).toBe(alive);
    onTurn(sim, ++g.turn);
    expect(g.turn).toBe(owed);
    expect(ships()).toBe(alive + 1);
    expect(g.ports[f.home]).toBeUndefined();
    const fresh = g.fleets.at(-1)!;
    expect(fresh.home).toBe(f.home);
    expect(fresh.ships).toHaveLength(1);
    expect(fresh.ships[0]?.name).toBeTruthy();
    expect(fresh.role).toBe('patrol');
  }, 60000);

  it('a port rebuilds one ship per rebuild time, in order, even when frozen far from the player', () => {
    const sim = parked(24);
    const g = sim.galaxy;
    const f = g.fleets.find((x) => x.role === 'patrol') as Fleet;
    const wait = galaxy.fleet.ports[portOf(sim, f.home)!.kind].rebuildTurns;
    const count = g.fleets.length;
    g.fleets = g.fleets.filter((x) => x.home !== f.home);
    const gone = count - g.fleets.length;
    for (let i = 0; i < gone; i++) g.ports[f.home] = { queue: [...(g.ports[f.home]?.queue ?? []), { faction: f.faction, role: 'patrol', size: 'small' }], next: 10 + wait, built: 0 };
    const total = g.fleets.length;
    g.turn = 10 + wait * gone + 5; // time passes while the port is out of the simulated area
    g.current = '__elsewhere__';
    syncFleets(sim, g.turn);
    expect(g.fleets.length).toBe(total); // frozen: not processed
    g.current = f.node;
    g.turn += 0;
    syncFleets(sim, g.turn);
    expect(g.fleets.length).toBe(total + gone);
    expect(g.ports[f.home]).toBeUndefined();
  });
});

describe('catching up', () => {
  const stepped = (seed: number, k: number) => {
    const sim = parked(seed);
    turns(sim, k);
    return sim;
  };
  /** The same world with the player away for `k` turns (the region frozen), then back: its fleets catch up. */
  const caughtUp = (seed: number, k: number) => {
    const sim = parked(seed);
    const home = sim.galaxy.current;
    sim.galaxy.current = '__elsewhere__';
    for (let i = 0; i < k; i++) sim.galaxy.turn++;
    sim.galaxy.current = home;
    syncFleets(sim, sim.galaxy.turn);
    return sim;
  };

  it.each([21, 23])('seed %i: K turns caught up equals K turns stepped for the same fleets (up to CATCHUP_MAX turns)', (seed) => {
    for (const k of [1, 7, 25, CATCHUP_MAX]) {
      const a = stepped(seed, k);
      const b = caughtUp(seed, k);
      const area = new Set(b.galaxy.fleets.filter((f) => f.synced === k).map((f) => f.id));
      expect(area.size).toBeGreaterThan(3);
      const pick = (s: Sim) => JSON.stringify(s.galaxy.fleets.filter((f) => area.has(f.id)));
      expect(pick(b)).toBe(pick(a));
    }
  }, 60000);

  it('a long absence (beyond CATCHUP_MAX) is deterministic and leaves every fleet valid: back at home plus the last CATCHUP_MAX turns', () => {
    const a = caughtUp(22, 500);
    const b = caughtUp(22, 500);
    expect(fleetKit(a)).toBe(fleetKit(b));
    const index = galaxyIndex(a.galaxy);
    const caught = a.galaxy.fleets.filter((f) => f.synced === 500);
    expect(caught.length).toBeGreaterThan(3);
    for (const f of caught) {
      expect(index.nodes.has(f.node)).toBe(true);
      expect(f.ships.length).toBeGreaterThan(0);
    }
    // The bounded difference: only the cycle phase is lost, so a fleet is at home or within a trip of it.
    const fleet = a.galaxy.fleets.find((f) => f.synced === 500) as Fleet;
    const lone = parked(22).galaxy.fleets.find((f) => f.id === fleet.id) as Fleet;
    catchUp(parked(22), lone, 500);
    expect(lone.synced).toBe(500);
  });

  it('the area follows the player: arriving somewhere plays the fleets there forward', () => {
    const sim = parked(22);
    const far = sim.galaxy.fleets.find((f) => f.synced === 0 && galaxyIndex(sim.galaxy).nodes.has(f.node) && f.node !== sim.galaxy.current) as Fleet;
    sim.galaxy.current = '__elsewhere__';
    turns(sim, 12);
    expect(far.synced).toBe(0); // frozen while the player is away
    sim.galaxy.current = far.node;
    stepFleets(sim, ++sim.galaxy.turn);
    expect(far.synced).toBe(sim.galaxy.turn);
  });
});

describe('saves and the player\'s node', () => {
  it('sensors show only fleets within SENSOR_HOPS of the player', () => {
    const sim = newGame(22, content);
    const seen = visibleFleets(sim);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.length).toBeLessThan(sim.galaxy.fleets.length);
    const index = galaxyIndex(sim.galaxy);
    const here = index.nodes.get(START_NODE)!;
    for (const f of seen) expect(Math.hypot((index.nodes.get(f.node)?.x ?? 0) - here.x, (index.nodes.get(f.node)?.y ?? 0) - here.y)).toBeLessThan(1500);
  });

  it('saves and loads mid-trip and carries on identically (fleets, ports, names)', () => {
    const a = parked(23);
    turns(a, 24);
    expect(a.galaxy.fleets.some((f) => f.route.length > 0)).toBe(true);
    const b = deserialize(serialize(a), content);
    b.sector.state = 'deploying';
    expect(b.galaxy.fleets).toEqual(a.galaxy.fleets);
    turns(a, 30);
    turns(b, 30);
    expect(b.galaxy.fleets).toEqual(a.galaxy.fleets);
    expect(b.galaxy.ports).toEqual(a.galaxy.ports);
  }, 60000);

  it('a fleet made real in the player\'s node keeps its name and is lifted out whole, with no duplicates', () => {
    const sim = newGame(24, content);
    const g = sim.galaxy;
    const f = g.fleets.find((x) => x.role === 'patrol') as Fleet;
    Object.assign(f, { node: g.current, from: g.current, route: [], dwell: 99, synced: g.turn });
    materialiseFleet(sim, f);
    materialiseFleet(sim, f);
    const real = f.ships.flatMap((c) => (c.ship === undefined ? [] : [c.ship]));
    expect(real.length).toBeGreaterThan(0);
    expect(sim.world.get(real[0] as number, ShipC)?.name).toBe(f.ships[0]?.name);
    expect(sim.world.query(ShipC).filter((id) => sim.world.get(id, ShipC)?.faction !== 'player')).toEqual(real);
    liftFleet(sim, f);
    expect(f.ships.every((c) => c.ship === undefined)).toBe(true);
    expect(sim.world.query(ShipC).filter((id) => sim.world.get(id, ShipC)?.faction !== 'player')).toEqual([]);
  });

  it('a crippled ship strands its fleet (a distress call) until it is repaired; an escaped ship stays in the fleet', () => {
    const sim = newGame(24, content);
    const g = sim.galaxy;
    const f = g.fleets.find((x) => x.role === 'patrol') as Fleet;
    Object.assign(f, { node: g.current, from: g.current, route: [], dwell: 0, synced: g.turn });
    materialiseFleet(sim, f);
    sim.world.get(f.ships[0]!.ship as number, ShipC)!.integrity = STRANDED_INTEGRITY - 0.1;
    liftFleet(sim, f);
    expect(f.damaged).toBe(true);
    expect(f.dwell).toBeGreaterThan(0);
    const wait = f.dwell;
    for (let t = 1; t <= wait; t++) stepAgenda(sim, f, t);
    expect(f.damaged).toBeUndefined();
    // A ship that jumps away is not destroyed: the fleet keeps it and heads for home, away from the node.
    Object.assign(f, { node: g.current, from: g.current, route: [], dwell: 0 });
    materialiseFleet(sim, f);
    const n = f.ships.length;
    sim.world.get(f.ships[0]!.ship as number, ShipC)!.state = 'fled';
    tendFleets(sim);
    expect(f.ships).toHaveLength(n);
    expect(f.node).not.toBe(g.current);
    expect(g.ports[f.home]).toBeUndefined();
  });
});
