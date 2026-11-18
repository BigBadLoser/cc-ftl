import { describe, expect, it } from 'vitest';
import { BodyC } from '../../sim/body';
import { DeadC, DownedC, PositionC } from '../../sim/crew/components';
import type { SimEvent } from '../../sim/events';
import { storageAdd } from '../../sim/items/storage';
import { ModuleC } from '../../sim/modules/components';
import { accessTile, footprintTiles, rotatedSize } from '../../sim/modules/footprint';
import { isTileWalkable } from '../../sim/modules/walk';
import { newGame } from '../../sim/newGame';
import type { ContentRegistry, ModuleDef } from '../../sim/registry';
import { deserialize, serialize } from '../../sim/save';
import type { Sim } from '../../sim/sim';
import { AboardC, VehicleBayC, VehicleC } from '../../sim/vehicles/components';
import { boardingTile } from '../../sim/vehicles/geometry';
import { destroyVehicle } from '../../sim/vehicles/lifecycle';
import { vehicleViews } from '../../sim/vehicles/queries';
import { content } from '../index';
import { airlockOf, embark, roleOf, missileRaiderId, runTo, shuttleContent, shuttleOf, shuttleSetup } from '../../../test/support/fixtures/shuttle';
import { shipIdOf, shipGrid } from '../../sim/regions';
import { shipIds } from '../../sim/regions';
import { crewOn, eventsOf, nth, run } from '../../../test/support/sim';
import { cachedNewGame } from '../../../test/support/content';


/** Switch off every weapon of a grid (so a raider cannot shoot the shuttle). */
function disarm(sim: Sim, shipId: number): void {
  for (const i of sim.world.query(ModuleC)) {
    const m = sim.world.get(i, ModuleC)!;
    if (!(content.modules[m.def as keyof typeof content.modules] as ModuleDef).weapon) continue;
    if (shipIdOf(sim, m) === nth(sim, shipId)) m.enabled = false; // disabled rather than broken: the crew cannot repair it
  }
}
const setup = shuttleSetup; // starter (grid 1) facing an optional raider (grid 2) 80 tiles away
describe('shuttle round trip', () => {
  it('embark at the bay, launch, fly, dock at the raider airlock, disembark, re-embark and return', () => {
    const sim = setup();
    disarm(sim, 2);
    const shuttle = shuttleOf(sim, 1);
    const crew = crewOn(sim, 1);
    const pilot = crew.find((c) => roleOf(sim, c) === 'role.pilot')!;
    const medic = crew.find((c) => roleOf(sim, c) === 'role.medic')!;
    const boarded = eventsOf(embark(sim, [pilot, medic], shuttle), 'crew.embarked');
    expect(boarded.map((e) => e.crew).sort()).toEqual([pilot, medic].sort());
    expect(sim.world.has(pilot, PositionC)).toBe(false); // hidden, on no grid
    expect(sim.world.has(pilot, AboardC)).toBe(true);
    const v = (): ReturnType<typeof vehicleViews>[number] => vehicleViews(sim).find((x) => x.id === shuttle)!;
    expect(v().pilot).not.toBe(0);

    sim.enqueue({ type: 'vehicle.dock', vehicle: shuttle, airlock: airlockOf(sim, 2) });
    const out = run(sim, 600, { until: () => v().state === 'docked' });
    expect(eventsOf(out, 'vehicle.launched')).toHaveLength(1);
    expect(eventsOf(out, 'vehicle.docked')[0]).toMatchObject({ vehicle: shuttle, ship: nth(sim, 2) });
    expect(v().state).toBe('docked');

    sim.enqueue({ type: 'vehicle.disembark', vehicle: shuttle });
    sim.enqueue({ type: 'vehicle.disembark', vehicle: shuttle, crew: v().pilot });
    const landed = eventsOf(run(sim, 3), 'crew.disembarked');
    expect(landed).toHaveLength(2);
    expect(landed.every((e) => e.ship === nth(sim, 2))).toBe(true);
    expect(shipIdOf(sim, sim.world.get(pilot, PositionC))).toBe(nth(sim, 2));

    const back = eventsOf(embark(sim, [pilot, medic], shuttle), 'crew.embarked');
    expect(back).toHaveLength(2);
    sim.enqueue({ type: 'vehicle.return', vehicle: shuttle });
    const home = run(sim, 600, { until: () => v().state === 'stowed' });
    expect(eventsOf(home, 'vehicle.undocked')).toHaveLength(1);
    expect(eventsOf(home, 'vehicle.stowed')).toHaveLength(1);
    expect(v().state).toBe('stowed');
    sim.enqueue({ type: 'vehicle.disembark', vehicle: shuttle });
    sim.enqueue({ type: 'vehicle.disembark', vehicle: shuttle, crew: pilot });
    run(sim, 3);
    expect(shipIdOf(sim, sim.world.get(pilot, PositionC))).toBe(nth(sim, 1));
    expect(shipIdOf(sim, sim.world.get(medic, PositionC))).toBe(nth(sim, 1));
  });

  it('holds a pilot plus the content capacity and refuses more', () => {
    const reg: ContentRegistry = { ...content, vehicles: { 'vehicle.shuttle': { ...content.vehicles['vehicle.shuttle'], capacity: 1 } } };
    const sim = newGame(1, reg);
    const shuttle = shuttleOf(sim, 1);
    const events = embark(sim, crewOn(sim, 1).slice(0, 3), shuttle);
    const v = sim.world.get(shuttle, VehicleC)!;
    expect(1 + v.passengers.length).toBe(2);
    expect(eventsOf(events, 'crew.embarked')).toHaveLength(2);
    expect(eventsOf(events, 'command.rejected').filter((e) => e.reason === 'full')).toHaveLength(1);
  });

  it('does not launch without a pilot', () => {
    const sim = cachedNewGame(1);
    const shuttle = shuttleOf(sim, 1);
    sim.enqueue({ type: 'vehicle.launch', vehicle: shuttle });
    const out = run(sim, 2);
    expect(eventsOf(out, 'command.rejected')[0]).toMatchObject({ command: 'vehicle.launch', reason: 'noPilot' });
    expect(sim.world.get(shuttle, VehicleC)!.state).toBe('stowed');
  });

  it('a pilot with the piloting skill flies faster', () => {
    const fly = (role: string): number => {
      const sim = cachedNewGame(1);
      const shuttle = shuttleOf(sim, 1);
      const c = crewOn(sim, 1).find((i) => roleOf(sim, i) === role)!;
      embark(sim, [c], shuttle);
      sim.enqueue({ type: 'vehicle.launch', vehicle: shuttle });
      run(sim, 2);
      const x0 = sim.world.get(shuttle, BodyC)!.x;
      const bay = sim.world.query(VehicleBayC)[0] as number;
      expect(bay).toBeGreaterThan(0);
      sim.world.get(shuttle, VehicleC)!.dest = { type: 'dock', airlock: airlockOf(sim, 1) };
      run(sim, 20);
      return Math.hypot(sim.world.get(shuttle, BodyC)!.x - x0, 0);
    };
    expect(fly('role.pilot')).toBeGreaterThan(fly('role.medic'));
  });
});

describe('shuttle combat', () => {
  it('is shot down in flight by a raider with a missile launcher, and everyone aboard dies', () => {
    const sim = setup(1, shuttleContent, missileRaiderId);
    const shuttle = shuttleOf(sim, 1);
    const crew = crewOn(sim, 1).slice(0, 2);
    embark(sim, crew, shuttle);
    sim.enqueue({ type: 'vehicle.launch', vehicle: shuttle });
    const out = run(sim, 20 * 90, { until: () => !sim.world.isAlive(shuttle) });
    expect(eventsOf(out, 'vehicle.destroyed')[0]).toMatchObject({ vehicle: shuttle, state: 'flying' });
    expect(sim.world.isAlive(shuttle)).toBe(false);
    for (const c of crew) expect(sim.world.has(c, DeadC)).toBe(true);
    expect(eventsOf(out, 'crew.died')).toHaveLength(2);
  });

  it('a stowed shuttle cannot be targeted', () => {
    const sim = setup();
    sim.enqueue({ type: 'combat.setTarget', ship: nth(sim, 2), weaponId: null, targetShip: 0, targetModuleId: 0, targetVehicle: shuttleOf(sim, 1) });
    expect(eventsOf(run(sim, 1), 'command.rejected')[0]).toMatchObject({ reason: 'badTarget' });
  });

  it('a shuttle destroyed while docked drops its crew downed at the airlock', () => {
    const sim = setup();
    disarm(sim, 2);
    const shuttle = shuttleOf(sim, 1);
    const crew = crewOn(sim, 1).slice(0, 2);
    embark(sim, crew, shuttle);
    sim.enqueue({ type: 'vehicle.dock', vehicle: shuttle, airlock: airlockOf(sim, 2) });
    run(sim, 600, { until: () => sim.world.get(shuttle, VehicleC)!.state === 'docked' });
    expect(sim.world.get(shuttle, VehicleC)!.state).toBe('docked');
    destroyVehicle(sim, shuttle);
    for (const c of crew) {
      expect(shipIdOf(sim, sim.world.get(c, PositionC))).toBe(nth(sim, 2));
      expect(sim.world.has(c, DownedC)).toBe(true);
    }
  });

  it('point defence wears down a hostile shuttle that comes within range', () => {
    const sim = setup();
    const shuttle = shuttleOf(sim, 2);
    const crew = crewOn(sim, 2).slice(0, 2);
    embark(sim, crew, shuttle);
    sim.enqueue({ type: 'vehicle.dock', vehicle: shuttle, airlock: airlockOf(sim, 1) });
    const out = runTo(sim, 20 * 25, (e) => e.type === 'vehicle.damaged' && e.source === 'pointDefence');
    const pd = eventsOf(out, 'vehicle.damaged').filter((e) => e.source === 'pointDefence');
    expect(pd.length).toBeGreaterThan(0);
  });

  it('point defence does not engage without an AI core', () => {
    const sim = setup();
    for (const i of sim.world.query(ModuleC)) {
      const m = sim.world.get(i, ModuleC)!;
      if (shipIdOf(sim, m) === shipIds(sim)[0] as number && m.def === 'module.aiCore') m.enabled = false;
    }
    const shuttle = shuttleOf(sim, 2);
    embark(sim, crewOn(sim, 2).slice(0, 1), shuttle);
    sim.enqueue({ type: 'vehicle.dock', vehicle: shuttle, airlock: airlockOf(sim, 1) });
    const out = run(sim, 15 * 20); // with its core on, the first point-defence hit lands by tick ~230; the whole 25 s runs in vehicles.slow
    expect(eventsOf(out, 'vehicle.damaged').filter((e) => e.source === 'pointDefence')).toHaveLength(0);
  });
});

describe('crafting and assignment', () => {
  it('a shuttle item in storage fills an empty bay', () => {
    const sim = cachedNewGame(1);
    const bay = sim.world.query(VehicleBayC)[0] as number;
    sim.enqueue({ type: 'vehicle.assign', bay });
    expect(eventsOf(run(sim, 1), 'command.rejected')[0]).toMatchObject({ reason: 'bayFull' });
    destroyVehicle(sim, shuttleOf(sim, 1));
    sim.enqueue({ type: 'vehicle.assign', bay });
    expect(eventsOf(run(sim, 1), 'command.rejected')[0]).toMatchObject({ reason: 'noShuttle' });
    const crate = sim.world.query(ModuleC).find((i) => sim.world.get(i, ModuleC)!.def === 'module.storage')!;
    storageAdd(sim, crate, 'item.shuttle', 1);
    sim.enqueue({ type: 'vehicle.assign', bay });
    run(sim, 1);
    expect(vehicleViews(sim)).toHaveLength(1);
    expect(content.recipes['recipe.shuttle'].outputs[0]?.item).toBe('item.shuttle');
  });

  it('an empty bay builds its own shuttle: crew bring the materials and work it, no fabricator needed (#387)', () => {
    const sim = cachedNewGame(1);
    const bay = sim.world.query(VehicleBayC)[0] as number;
    destroyVehicle(sim, shuttleOf(sim, 1));
    for (const id of sim.world.query(ModuleC)) if (sim.world.get(id, ModuleC)!.def === 'module.fabricator') sim.world.get(id, ModuleC)!.hp = 0;
    const crate = sim.world.query(ModuleC).find((i) => sim.world.get(i, ModuleC)!.def.startsWith('module.storage'))!;
    for (const q of content.vehicles['vehicle.shuttle'].assemble!.cost) storageAdd(sim, crate, q.item, q.count);
    sim.enqueue({ type: 'vehicle.build', bay });
    sim.enqueue({ type: 'vehicle.build', bay }); // one at a time
    expect(eventsOf(run(sim, 1), 'command.rejected')[0]).toMatchObject({ command: 'vehicle.build', reason: 'bayTaken' });
    sim.enqueue({ type: 'vehicle.assign', bay }); // nothing fitted over a build in place
    expect(eventsOf(run(sim, 1), 'command.rejected')[0]).toMatchObject({ command: 'vehicle.assign', reason: 'bayTaken' });
    const out: SimEvent[] = [];
    for (let i = 0; i < 20 * 600 && vehicleViews(sim).length === 0; i++) out.push(...run(sim, 1));
    expect(eventsOf(out, 'vehicle.assembled')).toHaveLength(1);
    expect(sim.world.get(bay, VehicleBayC)?.vehicle).toBeTruthy();
    sim.enqueue({ type: 'vehicle.build', bay });
    expect(eventsOf(run(sim, 1), 'command.rejected')[0]).toMatchObject({ reason: 'bayFull' });
  });
});

describe('enemy boarding AI', () => {
  const reg: ContentRegistry = {
    ...content,
    ships: { ...content.ships, 'ship.raiderBoarder': { ...content.ships['ship.raiderBoarder'], boarding: { party: 2, afterSec: 3, losingBelow: 0.6 } } },
  };

  it('the plain raider never boards', () => {
    const sim = setup(1, reg, 'ship.raider');
    const out = run(sim, 20 * 30); // the boarder launches by tick ~380; the whole minute runs in vehicles.slow

    expect(eventsOf(out, 'vehicle.launched')).toHaveLength(0);
  });

  it('sends a party by shuttle to a player airlock and lands it', () => {
    const sim = setup(1, reg, 'ship.raiderBoarder');
    let n = 0;
    const out = runTo(sim, 20 * 80, (e) => e.type === 'crew.disembarked' && ++n >= 2);
    expect(eventsOf(out, 'vehicle.launched').length).toBeGreaterThan(0);
    const dock = eventsOf(out, 'vehicle.docked')[0];
    expect(dock).toMatchObject({ ship: nth(sim, 1), airlock: airlockOf(sim, 1) });
    const landed = eventsOf(out, 'crew.disembarked');
    expect(landed.length).toBeGreaterThanOrEqual(2);
    expect(landed.every((e) => e.ship === nth(sim, 1))).toBe(true);
    for (const e of landed) expect(shipIdOf(sim, sim.world.get(e.crew, PositionC))).toBe(nth(sim, 1));
  });

  it('armed boarders fight the defenders once ashore, and nobody else takes chores from them', () => {
    const armed: ContentRegistry = {
      ...content,
      ships: { ...content.ships, 'ship.raiderBoarder': { ...content.ships['ship.raiderBoarder'], boarding: { party: 2, afterSec: 3, losingBelow: 0.6, weapon: 'item.sidearm' } } },
    };
    const sim = setup(1, armed, 'ship.raiderBoarder');
    const landedSet = new Set<number>();
    const out = runTo(sim, 20 * 120, (e) => {
      if (e.type === 'crew.disembarked') landedSet.add(e.crew);
      return e.type === 'crew.attacked' && landedSet.has(e.crew);
    });
    const landed = eventsOf(out, 'crew.disembarked').map((e) => e.crew);
    expect(landed.length).toBeGreaterThanOrEqual(2);
    const shots = eventsOf(out, 'crew.attacked').filter((e) => landed.includes(e.crew));
    expect(shots.length).toBeGreaterThan(0);
    expect(shots.every((e) => e.weapon === 'item.sidearm' && e.ship === nth(sim, 1))).toBe(true);
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
    run(a, 20 * 5); // (20 s in vehicles.slow)
    run(loaded, 20 * 5);
    expect(serialize(loaded)).toBe(serialize(a));
  });
});

describe('shuttle bay pit', () => {
  const bayDef = content.modules['module.vehicle_bay'] as ModuleDef;

  it('is a solid pit: no footprint tile is walkable, and the shuttle boards from the floor east of it in the hatch row', () => {
    const sim = cachedNewGame(1);
    const bay = sim.world.query(VehicleBayC)[0] as number;
    const m = sim.world.get(bay, ModuleC)!;
    const grid = shipGrid(sim, shipIdOf(sim, m))!;
    for (const t of footprintTiles(bayDef, m.x, m.y, m.rot)) expect(isTileWalkable(sim, grid, t.x, t.y)).toBe(false);
    const at = boardingTile(sim, shuttleOf(sim, 1));
    expect(at).toEqual({ shipId: shipIdOf(sim, m), x: m.x + 4, y: m.y + 3 });
    expect(isTileWalkable(sim, grid, at!.x, at!.y)).toBe(true);
  });

  it('keeps its access tile outside the footprint beside the long side at every rotation, in the hatch row', () => {
    const outside = [[4, 3], [1, 4], [-1, 1], [3, -1]]; // offsets from the module origin for 4x5 rotated 0..3 (x, y)
    for (let rot = 0; rot < 4; rot++) {
      const a = accessTile(bayDef, 10, 10, rot)!;
      const [w, h] = rotatedSize(bayDef, rot);
      const inside = a.x >= 10 && a.x < 10 + w && a.y >= 10 && a.y < 10 + h;
      expect(inside).toBe(false);
      expect({ x: a.x - 10, y: a.y - 10 }).toEqual({ x: outside[rot]![0], y: outside[rot]![1] });
      // The long side: for the 4 wide (5 tall) pit the access tile is east or west of it; rotated, south or north.
      expect(rot % 2 === 0 ? a.y >= 10 && a.y < 10 + h : a.x >= 10 && a.x < 10 + w).toBe(true);
    }
  });
});
