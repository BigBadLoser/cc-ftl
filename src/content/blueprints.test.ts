import { describe, expect, it } from 'vitest';
import {
  ModuleC, deserialize, engineFuelFactor, galaxyIndex, isBlueprintKnown, jumpFuel, newGame, playerShip, portBlueprints, serialize, shieldCapacity, shipGrid, type ModuleDef, type Sim,
} from '../sim';
import { portsAt } from '../sim/galaxy/portIndex';
import { ensureAround } from '../sim/galaxy/state';
import { homeShip } from '../sim/index';
import { placementGapError } from '../sim/regions';
import { content } from '.';

/** Deploy at the first free spot (a node's structures stand east of the west margin). */
function deploy(sim: Sim): void {
  const p = sim.sector.packet!;
  for (let x = 0; x + p.w <= sim.sector.width; x += 4) {
    for (let y = 2; y + p.h <= sim.sector.height; y += 4) {
      if (placementGapError(sim, { x, y, w: p.w, h: p.h })) continue;
      sim.enqueue({ type: 'sector.deploy', x, y });
      return sim.step();
    }
  }
  throw new Error('no room to deploy');
}

const step = (sim: Sim, n = 1): void => {
  for (let i = 0; i < n; i++) sim.step();
};
const rejected = (sim: Sim, command: string): string[] => sim.events.drain().flatMap((e) => (e.type === 'command.rejected' && e.command === command ? [e.reason] : []));

/** A game whose player is at a node with a blueprint stall of at least `danger`, with credits to spend. */
function atBlueprintStation(minDanger: number): { sim: Sim; port: string } {
  const sim = newGame(7, content);
  step(sim, 2);
  sim.enqueue({ type: 'debug.galaxyReveal', radius: 12 });
  step(sim);
  const nodes = [...galaxyIndex(sim.galaxy).nodes.values()].filter((n) => n.danger >= minDanger).sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const n of nodes) {
    const p = portsAt(sim, n.id).find((q) => portBlueprints(sim, q).length > 0);
    if (!p) continue;
    sim.enqueue({ type: 'debug.galaxyTeleport', node: n.id });
    step(sim);
    deploy(sim);
    step(sim, 25);
    sim.trade.credits = 100000;
    sim.events.drain();
    return { sim, port: p.id };
  }
  throw new Error(`no blueprint station at danger ${minDanger}`);
}

/** Where a 2x2 reactor-sized module fits on the home ship: a floor tile with free floor around (found by trying the placement). */
function tryBuild(sim: Sim, def: string): string[] {
  const ship = homeShip(sim);
  const g = shipGrid(sim, ship)!;
  for (let y = g.y0; y < g.y0 + g.height; y++) {
    for (let x = g.x0; x < g.x0 + g.width; x++) {
      sim.enqueue({ type: 'job.buildModule', ship, x, y, def, rot: 0 });
      sim.step();
      const r = rejected(sim, 'job.buildModule');
      if (!r.length || r[0] === 'unknownBlueprint') return r;
    }
  }
  return ['nowhere'];
}

const m: Record<string, ModuleDef> = content.modules;

const total = (d: ModuleDef): number => (d.cost ?? []).reduce((t, c) => t + c.count, 0);

describe('blueprints', () => {
  it('basic modules are known at the start, the Mk II and III cores are not', () => {
    const sim = newGame(7, content);
    for (const d of ['module.reactor', 'module.shieldGen', 'module.engine', 'module.bed']) expect(isBlueprintKnown(sim, d)).toBe(true);
    for (const t of [2, 3]) for (const d of ['reactor', 'shieldGen', 'engine']) expect(isBlueprintKnown(sim, `module.${d}.mk${t}`)).toBe(false);
  });

  it('an unknown blueprint cannot be built, even through the command', () => {
    const sim = newGame(7, content);
    step(sim, 2);
    expect(tryBuild(sim, 'module.reactor.mk2')).toEqual(['unknownBlueprint']);
    expect(sim.world.query(ModuleC).some((id) => sim.world.get(id, ModuleC)?.def === 'module.reactor.mk2')).toBe(false);
  });

  it('Mk II is sold from the middle danger tiers and Mk III only deep, priced up with danger', () => {
    const mid = atBlueprintStation(3);
    const midOffers = portBlueprints(mid.sim, portsAt(mid.sim, mid.sim.galaxy.current).find((p) => p.id === mid.port)!);
    expect(midOffers.some((o) => o.tier === 2)).toBe(true);
    const deep = atBlueprintStation(6);
    const port = portsAt(deep.sim, deep.sim.galaxy.current).find((p) => p.id === deep.port)!;
    const offers = portBlueprints(deep.sim, port);
    expect(offers.some((o) => o.tier === 3)).toBe(true);
    const mk2 = offers.find((o) => o.def === 'module.reactor.mk2')!;
    expect(mk2.price).toBeGreaterThan(m['module.reactor.mk2']!.blueprint!.price);
  });

  it('a blueprint bought at a deep station can then be built; a second purchase and a broke player are refused', () => {
    const { sim, port } = atBlueprintStation(6);
    const def = 'module.reactor.mk2';
    const price = portBlueprints(sim, portsAt(sim, sim.galaxy.current).find((p) => p.id === port)!).find((o) => o.def === def)!.price;
    sim.trade.credits = price - 1;
    sim.enqueue({ type: 'blueprint.buy', port, def });
    step(sim);
    expect(rejected(sim, 'blueprint.buy')).toEqual(['cantAfford']);
    expect(isBlueprintKnown(sim, def)).toBe(false);
    sim.trade.credits = price + 5;
    sim.enqueue({ type: 'blueprint.buy', port, def });
    step(sim);
    expect(sim.events.drain().some((e) => e.type === 'blueprint.bought')).toBe(true);
    expect(sim.trade.credits).toBe(5);
    expect(isBlueprintKnown(sim, def)).toBe(true);
    expect(tryBuild(sim, def)).toEqual([]);
    sim.enqueue({ type: 'blueprint.buy', port, def });
    step(sim);
    expect(rejected(sim, 'blueprint.buy')).toEqual(['alreadyKnown']);
  });

  it('a save round-trip keeps the known set', () => {
    const { sim, port } = atBlueprintStation(6);
    sim.enqueue({ type: 'blueprint.buy', port, def: 'module.engine.mk3' });
    step(sim);
    expect(isBlueprintKnown(sim, 'module.engine.mk3')).toBe(true);
    const back = deserialize(serialize(sim), content);
    expect(isBlueprintKnown(back, 'module.engine.mk3')).toBe(true);
    expect(isBlueprintKnown(back, 'module.engine.mk2')).toBe(false);
  });

  it('a blueprint station does not sell what the danger tier is too low for', () => {
    const sim = newGame(7, content);
    step(sim, 2);
    ensureAround(sim, sim.galaxy.current);
    for (const p of portsAt(sim, sim.galaxy.current)) expect(portBlueprints(sim, p)).toEqual([]);
  });
});

describe('module tiers', () => {
  it('footprints, power, shield layers, evasion and fuel grow per tier', () => {
    const reactors = ['module.reactor', 'module.reactor.mk2', 'module.reactor.mk3'].map((id) => m[id]!);
    expect(reactors.map((d) => d.footprint)).toEqual([[2, 2], [2, 3], [2, 4]]);
    expect(reactors.map((d) => d.power)).toEqual([50, 100, 180]);
    const shields = ['module.shieldGen', 'module.shieldGen.mk2', 'module.shieldGen.mk3'].map((id) => m[id]!);
    expect(shields.map((d) => d.footprint)).toEqual([[2, 3], [2, 4], [2, 5]]);
    expect(shields.map((d) => Math.floor(Math.abs(d.power) * d.shieldGen!.layersPerPower))).toEqual([2, 4, 7]);
    expect(shields.map((d) => d.shieldGen!.rechargeSec)).toEqual([10, 8, 6]);
    const engines = ['module.engine', 'module.engine.mk2', 'module.engine.mk3'].map((id) => m[id]!);
    expect(engines.map((d) => d.footprint)).toEqual([[4, 5], [4, 6], [4, 7]]);
    expect(engines.map((d) => Math.round(Math.abs(d.power) * d.engine!.evasionPerPower * 100))).toEqual([12, 25, 45]);
    expect(engines.map((d) => d.engine!.fuelFactor ?? 1)).toEqual([1, 0.85, 0.7]);
    for (const line of [reactors, shields, engines]) {
      expect(total(line[1]!)).toBeGreaterThan(total(line[0]!));
      expect(total(line[2]!)).toBeGreaterThan(total(line[1]!));
    }
  });

  /** Swap the home ship's module of `from` for `to` (a stat check: the footprint need not fit). */
  function swap(sim: Sim, from: string, to: string): void {
    for (const id of sim.world.query(ModuleC)) {
      const mod = sim.world.get(id, ModuleC)!;
      if (mod.def === from) mod.def = to;
    }
  }

  it('shield layers in the sim follow the generator tier', () => {
    const sim = newGame(7, content);
    const ship = playerShip(sim);
    step(sim, 100);
    const before = shieldCapacity(sim, ship, true);
    swap(sim, 'module.shieldGen', 'module.shieldGen.mk3');
    expect(shieldCapacity(sim, ship, true)).toBeGreaterThan(before);
    expect(shieldCapacity(sim, ship, true)).toBe(7);
  });

  it('a better engine burns less fuel per jump', () => {
    const sim = newGame(7, content);
    expect(engineFuelFactor(sim)).toBe(1);
    expect(jumpFuel(sim, 10)).toBe(10);
    swap(sim, 'module.engine', 'module.engine.mk2');
    expect(jumpFuel(sim, 10)).toBe(9);
    swap(sim, 'module.engine.mk2', 'module.engine.mk3');
    expect(engineFuelFactor(sim)).toBe(0.7);
    expect(jumpFuel(sim, 10)).toBe(7);
    expect(jumpFuel(sim, 1)).toBe(1);
  });
});
