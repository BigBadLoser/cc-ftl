import { describe, expect, it } from 'vitest';
import {
  AboardC, CrewC, DeadC, DownedC, ModuleC, PositionC, VehicleBayC, VehicleC, destroyVehicle, deserialize, newGame, serialize,
  storageAdd, vehicleViews, type ContentRegistry, type ModuleDef, type Sim, type SimEvent,
} from '../../sim';
import { content } from '../index';

const run = (sim: Sim, n: number): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
const of = <T extends SimEvent['type']>(events: SimEvent[], type: T): Extract<SimEvent, { type: T }>[] =>
  events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);

const crewOn = (sim: Sim, gridId: number): number[] => sim.world.query(CrewC).filter((i) => sim.world.get(i, PositionC)?.gridId === gridId);
const shuttleOf = (sim: Sim, gridId: number): number => sim.world.query(VehicleC).find((i) => sim.world.get(i, VehicleC)!.homeGrid === gridId)!;
const airlockOf = (sim: Sim, gridId: number): number =>
  sim.world.query(ModuleC).find((i) => sim.world.get(i, ModuleC)!.gridId === gridId && sim.world.get(i, ModuleC)!.def === 'module.airlock')!;
/** Switch off every weapon of a grid (so a raider cannot shoot the shuttle). */
function disarm(sim: Sim, gridId: number): void {
  for (const i of sim.world.query(ModuleC)) {
    const m = sim.world.get(i, ModuleC)!;
    if (!(content.modules[m.def as keyof typeof content.modules] as ModuleDef).weapon) continue;
    if (m.gridId === gridId) m.enabled = false; // disabled rather than broken: the crew cannot repair it
  }
}
/** Starter (grid 1) facing an optional raider (grid 2) 80 tiles away. */
function setup(seed = 1, reg: ContentRegistry = content, enemy = 'ship.raider'): Sim {
  const sim = newGame(seed, reg);
  sim.enqueue({ type: 'debug.spawnEnemy', template: enemy, x: 100, y: 50 });
  run(sim, 5);
  return sim;
}
const roleOf = (sim: Sim, id: number): string => sim.world.get(id, CrewC)!.role;
function embark(sim: Sim, crew: number[], vehicle: number): SimEvent[] {
  for (const c of crew) sim.enqueue({ type: 'vehicle.embark', crew: c, vehicle });
  return run(sim, 400);
}

describe('shuttle round trip', () => {
  it('embark at the bay, launch, fly, dock at the raider airlock, disembark, re-embark and return', () => {
    const sim = setup();
    disarm(sim, 2);
    const shuttle = shuttleOf(sim, 1);
    const crew = crewOn(sim, 1);
    const pilot = crew.find((c) => roleOf(sim, c) === 'role.pilot')!;
    const medic = crew.find((c) => roleOf(sim, c) === 'role.medic')!;
    const boarded = of(embark(sim, [pilot, medic], shuttle), 'crew.embarked');
    expect(boarded.map((e) => e.crew).sort()).toEqual([pilot, medic].sort());
    expect(sim.world.has(pilot, PositionC)).toBe(false); // hidden, on no grid
    expect(sim.world.has(pilot, AboardC)).toBe(true);
    const v = (): ReturnType<typeof vehicleViews>[number] => vehicleViews(sim).find((x) => x.id === shuttle)!;
    expect(v().pilot).not.toBe(0);

    sim.enqueue({ type: 'vehicle.dock', vehicle: shuttle, airlock: airlockOf(sim, 2) });
    const out = run(sim, 600);
    expect(of(out, 'vehicle.launched')).toHaveLength(1);
    expect(of(out, 'vehicle.docked')[0]).toMatchObject({ vehicle: shuttle, gridId: 2 });
    expect(v().state).toBe('docked');

    sim.enqueue({ type: 'vehicle.disembark', vehicle: shuttle });
    sim.enqueue({ type: 'vehicle.disembark', vehicle: shuttle, crew: v().pilot });
    const landed = of(run(sim, 3), 'crew.disembarked');
    expect(landed).toHaveLength(2);
    expect(landed.every((e) => e.gridId === 2)).toBe(true);
    expect(sim.world.get(pilot, PositionC)?.gridId).toBe(2);

    const back = of(embark(sim, [pilot, medic], shuttle), 'crew.embarked');
    expect(back).toHaveLength(2);
    sim.enqueue({ type: 'vehicle.return', vehicle: shuttle });
    const home = run(sim, 600);
    expect(of(home, 'vehicle.undocked')).toHaveLength(1);
    expect(of(home, 'vehicle.stowed')).toHaveLength(1);
    expect(v().state).toBe('stowed');
    sim.enqueue({ type: 'vehicle.disembark', vehicle: shuttle });
    sim.enqueue({ type: 'vehicle.disembark', vehicle: shuttle, crew: pilot });
    run(sim, 3);
    expect(sim.world.get(pilot, PositionC)?.gridId).toBe(1);
    expect(sim.world.get(medic, PositionC)?.gridId).toBe(1);
  });

  it('holds a pilot plus the content capacity and refuses more', () => {
    const reg: ContentRegistry = { ...content, vehicles: { 'vehicle.shuttle': { ...content.vehicles['vehicle.shuttle'], capacity: 1 } } };
    const sim = newGame(1, reg);
    const shuttle = shuttleOf(sim, 1);
    const events = embark(sim, crewOn(sim, 1).slice(0, 3), shuttle);
    const v = sim.world.get(shuttle, VehicleC)!;
    expect(1 + v.passengers.length).toBe(2);
    expect(of(events, 'crew.embarked')).toHaveLength(2);
    expect(of(events, 'command.rejected').filter((e) => e.reason === 'full')).toHaveLength(1);
  });

  it('does not launch without a pilot', () => {
    const sim = newGame(1, content);
    const shuttle = shuttleOf(sim, 1);
    sim.enqueue({ type: 'vehicle.launch', vehicle: shuttle });
    const out = run(sim, 2);
    expect(of(out, 'command.rejected')[0]).toMatchObject({ command: 'vehicle.launch', reason: 'noPilot' });
    expect(sim.world.get(shuttle, VehicleC)!.state).toBe('stowed');
  });

  it('a pilot with the piloting skill flies faster', () => {
    const fly = (role: string): number => {
      const sim = newGame(1, content);
      const shuttle = shuttleOf(sim, 1);
      const c = crewOn(sim, 1).find((i) => roleOf(sim, i) === role)!;
      embark(sim, [c], shuttle);
      sim.enqueue({ type: 'vehicle.launch', vehicle: shuttle });
      run(sim, 2);
      const x0 = sim.world.get(shuttle, VehicleC)!.x;
      const bay = sim.world.query(VehicleBayC)[0] as number;
      expect(bay).toBeGreaterThan(0);
      sim.world.get(shuttle, VehicleC)!.dest = { type: 'dock', airlock: airlockOf(sim, 1) };
      run(sim, 20);
      return Math.hypot(sim.world.get(shuttle, VehicleC)!.x - x0, 0);
    };
    expect(fly('role.pilot')).toBeGreaterThan(fly('role.medic'));
  });
});

describe('shuttle combat', () => {
  it('is shot down in flight by an armed raider, and everyone aboard dies', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 1);
    const crew = crewOn(sim, 1).slice(0, 2);
    embark(sim, crew, shuttle);
    sim.enqueue({ type: 'vehicle.launch', vehicle: shuttle });
    const out = run(sim, 20 * 90);
    expect(of(out, 'vehicle.destroyed')[0]).toMatchObject({ vehicle: shuttle, state: 'flying' });
    expect(sim.world.isAlive(shuttle)).toBe(false);
    for (const c of crew) expect(sim.world.has(c, DeadC)).toBe(true);
    expect(of(out, 'crew.died')).toHaveLength(2);
  });

  it('a stowed shuttle cannot be targeted', () => {
    const sim = setup();
    sim.enqueue({ type: 'combat.setTarget', shipGridId: 2, weaponId: null, targetGridId: 0, targetModuleId: 0, targetVehicle: shuttleOf(sim, 1) });
    expect(of(run(sim, 1), 'command.rejected')[0]).toMatchObject({ reason: 'badTarget' });
  });

  it('a shuttle destroyed while docked drops its crew downed at the airlock', () => {
    const sim = setup();
    disarm(sim, 2);
    const shuttle = shuttleOf(sim, 1);
    const crew = crewOn(sim, 1).slice(0, 2);
    embark(sim, crew, shuttle);
    sim.enqueue({ type: 'vehicle.dock', vehicle: shuttle, airlock: airlockOf(sim, 2) });
    run(sim, 600);
    expect(sim.world.get(shuttle, VehicleC)!.state).toBe('docked');
    destroyVehicle(sim, shuttle);
    for (const c of crew) {
      expect(sim.world.get(c, PositionC)?.gridId).toBe(2);
      expect(sim.world.has(c, DownedC)).toBe(true);
    }
  });

  it('point defence wears down a hostile shuttle that comes within range', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 2);
    const crew = crewOn(sim, 2).slice(0, 2);
    embark(sim, crew, shuttle);
    sim.enqueue({ type: 'vehicle.dock', vehicle: shuttle, airlock: airlockOf(sim, 1) });
    const out = run(sim, 20 * 25);
    const pd = of(out, 'vehicle.damaged').filter((e) => e.source === 'pointDefence');
    expect(pd.length).toBeGreaterThan(0);
  });

  it('point defence does not engage without an AI core', () => {
    const sim = setup();
    for (const i of sim.world.query(ModuleC)) {
      const m = sim.world.get(i, ModuleC)!;
      if (m.gridId === 1 && m.def === 'module.aiCore') m.enabled = false;
    }
    const shuttle = shuttleOf(sim, 2);
    embark(sim, crewOn(sim, 2).slice(0, 1), shuttle);
    sim.enqueue({ type: 'vehicle.dock', vehicle: shuttle, airlock: airlockOf(sim, 1) });
    const out = run(sim, 20 * 25);
    expect(of(out, 'vehicle.damaged').filter((e) => e.source === 'pointDefence')).toHaveLength(0);
  });
});

describe('crafting and assignment', () => {
  it('a shuttle item in storage fills an empty bay', () => {
    const sim = newGame(1, content);
    const bay = sim.world.query(VehicleBayC)[0] as number;
    sim.enqueue({ type: 'vehicle.assign', bay });
    expect(of(run(sim, 1), 'command.rejected')[0]).toMatchObject({ reason: 'bayFull' });
    destroyVehicle(sim, shuttleOf(sim, 1));
    sim.enqueue({ type: 'vehicle.assign', bay });
    expect(of(run(sim, 1), 'command.rejected')[0]).toMatchObject({ reason: 'noShuttle' });
    const crate = sim.world.query(ModuleC).find((i) => sim.world.get(i, ModuleC)!.def === 'module.storage')!;
    storageAdd(sim, crate, 'item.shuttle', 1);
    sim.enqueue({ type: 'vehicle.assign', bay });
    run(sim, 1);
    expect(vehicleViews(sim)).toHaveLength(1);
    expect(content.recipes['recipe.shuttle'].outputs[0]?.item).toBe('item.shuttle');
  });
});

describe('enemy boarding AI', () => {
  const reg: ContentRegistry = {
    ...content,
    ships: { ...content.ships, 'ship.raiderBoarder': { ...content.ships['ship.raiderBoarder'], boarding: { party: 2, afterSec: 3, losingBelow: 0.6 } } },
  };

  it('the plain raider never boards', () => {
    const sim = setup(1, reg, 'ship.raider');
    const out = run(sim, 20 * 60);
    expect(of(out, 'vehicle.launched')).toHaveLength(0);
  });

  it('sends a party by shuttle to a player airlock and lands it', () => {
    const sim = setup(1, reg, 'ship.raiderBoarder');
    const out = run(sim, 20 * 80);
    expect(of(out, 'vehicle.launched').length).toBeGreaterThan(0);
    const dock = of(out, 'vehicle.docked')[0];
    expect(dock).toMatchObject({ gridId: 1, airlock: airlockOf(sim, 1) });
    const landed = of(out, 'crew.disembarked');
    expect(landed.length).toBeGreaterThanOrEqual(2);
    expect(landed.every((e) => e.gridId === 1)).toBe(true);
    for (const e of landed) expect(sim.world.get(e.crew, PositionC)?.gridId).toBe(1);
  });

  it('is deterministic, and survives a save and load mid-flight', () => {
    const a = setup(3, reg, 'ship.raiderBoarder');
    const b = setup(3, reg, 'ship.raiderBoarder');
    const untilFlying = (sim: Sim): void => {
      for (let i = 0; i < 20 * 60 && !vehicleViews(sim).some((v) => v.state === 'flying'); i++) sim.step();
      run(sim, 40);
    };
    untilFlying(a);
    untilFlying(b);
    expect(serialize(a)).toBe(serialize(b));
    expect(vehicleViews(a).some((v) => v.state === 'flying')).toBe(true);
    const loaded = deserialize(serialize(a), reg);
    run(a, 20 * 20);
    run(loaded, 20 * 20);
    expect(serialize(loaded)).toBe(serialize(a));
  });
});
