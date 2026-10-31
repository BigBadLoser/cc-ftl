import { expect } from 'vitest';
import { AboardC, AllegianceC, CrewC, ModuleC, PositionC, ShipC, StunC, VehicleC, WeaponC, newGame, type ModuleDef, type Sim, type SimEvent } from '../../sim';
import { auditReservations } from '../../sim/ai/audit';
import { content } from '../index';
import { shipIdOf, shipIds } from '../../sim/regions';

/** The ship with ordinal `n` (1 = the player's, 2 = the first enemy). */
export const nth = (sim: Sim, n: number): number => shipIds(sim)[n - 1] as number;

/** Run `n` ticks (or until `stop`), collecting the events; the reservation audit must stay clean on every tick. */
export function run(sim: Sim, n: number, stop: () => boolean = () => false): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < n && !stop(); i++) {
    sim.step();
    out.push(...sim.events.drain());
    const audit = auditReservations(sim);
    expect(audit.problems, `tick ${sim.tick}`).toEqual([]);
  }
  return out;
}
export const of = <T extends SimEvent['type']>(events: SimEvent[], type: T): Extract<SimEvent, { type: T }>[] =>
  events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);

export const crewOn = (sim: Sim, n: number): number[] => sim.world.query(CrewC).filter((i) => shipIdOf(sim, sim.world.get(i, PositionC)) === nth(sim, n));
/** The raider's own crew (not the player's boarders standing on it). */
export const raiderCrew = (sim: Sim): number[] => crewOn(sim, 2).filter((c) => sim.world.get(c, AllegianceC)?.faction === 'hostile');
export const roleOf = (sim: Sim, id: number): string => sim.world.get(id, CrewC)!.role;
export const shuttleOf = (sim: Sim, n: number): number => sim.world.query(VehicleC).find((i) => sim.world.get(i, VehicleC)!.homeShip === nth(sim, n))!;
export const airlockOf = (sim: Sim, n: number): number =>
  sim.world.query(ModuleC).find((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === nth(sim, n) && sim.world.get(i, ModuleC)!.def === 'module.airlock')!;
export const modulesOf = (sim: Sim, n: number, def: string): number[] =>
  sim.world.query(ModuleC).filter((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === nth(sim, n) && sim.world.get(i, ModuleC)!.def === def);
export const ship = (sim: Sim, n: number) => sim.world.get(nth(sim, n), ShipC)!;

/** A player ship and a raider side by side; every raider weapon switched off and its crew stunned for good (they neither fight nor count as subdued). */
export function setup(seed = 1): Sim {
  const sim = newGame(seed, content);
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
  run(sim, 5);
  for (const i of sim.world.query(WeaponC)) {
    if (shipIdOf(sim, sim.world.get(i, ModuleC)) === nth(sim, 2)) sim.world.get(i, ModuleC)!.enabled = false;
  }
  for (const c of raiderCrew(sim)) sim.world.add(c, StunC, { until: 1e9 });
  return sim;
}

/** A shuttle of the player's, the pilot and `passengers` more crew aboard, flown to the raider's airlock and docked; the passengers then step out (the pilot stays at the controls). Returns them and the shuttle. */
export function dockParty(sim: Sim, passengers = 2): { shuttle: number; pilot: number; party: number[] } {
  const home = crewOn(sim, 1);
  const shuttle = shuttleOf(sim, 1);
  for (const c of home.slice(0, passengers + 1)) sim.enqueue({ type: 'vehicle.embark', crew: c, vehicle: shuttle });
  run(sim, 800, () => sim.world.get(shuttle, VehicleC)!.passengers.length === passengers && sim.world.get(shuttle, VehicleC)!.pilot !== 0);
  const { pilot, passengers: seated } = sim.world.get(shuttle, VehicleC)!; // whoever reached the ramp first flies it
  const party = [...seated];
  expect(party).toHaveLength(passengers);
  sim.enqueue({ type: 'vehicle.dock', vehicle: shuttle, airlock: airlockOf(sim, 2) });
  run(sim, 1200, () => sim.world.get(shuttle, VehicleC)!.state === 'docked');
  expect(sim.world.get(shuttle, VehicleC)!.state).toBe('docked');
  sim.enqueue({ type: 'vehicle.disembark', vehicle: shuttle });
  run(sim, 3);
  for (const c of party) expect(sim.world.has(c, AboardC)).toBe(false);
  return { shuttle, pilot, party };
}

export const defOf = (sim: Sim, id: number): ModuleDef => content.modules[sim.world.get(id, ModuleC)!.def as keyof typeof content.modules] as ModuleDef;
