import { describe, expect, it } from 'vitest';
import { sightLine } from '../../sim/fight/los';
import { AllegianceC, CrewC, DeadC, DownedC, EmergencyArmC, EquipC, EquipOrderC, StowOrderC, ModuleC, StorageC, storageAdd, storageCount, storageTake, FighterC, JobC, PathC, Struct, shipGrid, SurrenderedC, HealthC, PositionC, newGame, spawnCrew, type Sim, type SimEvent } from '../../sim';
import { content } from '../index';
import { DoorJam } from '../../sim/structure';
import { EMERGENCY_STAND_DOWN_SEC } from '../../sim/tuning';
import { shipIdOf, shipIds } from '../../sim/regions';

const run = (sim: Sim, n: number): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
const ownShip = (sim: Sim): number => shipIds(sim)[0] as number;
const player = (sim: Sim): number[] => sim.world.query(CrewC).filter((c) => sim.world.get(c, AllegianceC)?.faction === 'player' && shipIdOf(sim, sim.world.get(c, PositionC)) === ownShip(sim));
const down = (sim: Sim, c: number): boolean => sim.world.has(c, DownedC) || sim.world.has(c, DeadC);

/** Land `n` hostile boarders (sidearms) on the player's ship. */
function land(sim: Sim, n: number): number[] {
  const boarders = spawnCrew(sim, ownShip(sim), Array(n).fill('role.security'));
  for (const b of boarders) {
    sim.world.add(b, AllegianceC, { faction: 'hostile' });
    sim.world.add(b, EquipC, { weapon: 'item.sidearm' });
  }
  return boarders;
}

const crate = (sim: Sim): number => sim.world.query(StorageC, ModuleC).find((s) => shipIdOf(sim, sim.world.get(s, ModuleC)!) === ownShip(sim) && storageCount(sim, s, 'item.fuel') > 0)!; // the starter crate (fuel stays)
/** Empty the ship's weapon locker (the starter crate holds a rifle, two sidearms and a blade). */
const bare = (sim: Sim): void => {
  const c = crate(sim);
  for (const item of ['item.rifle', 'item.sidearm', 'item.blade']) storageTake(sim, c, item, storageCount(sim, c, item));
};

/** A hiding crew member rescues a downed one out of the lone boarder's sight; the locker is empty. */
function rescueScenario(): void {
  const sim = newGame(1, content);
  run(sim, 20 * 5);
  bare(sim);
  const grid = shipGrid(sim, ownShip(sim))!;
  const [boarder] = land(sim, 1) as [number];
  sim.world.remove(boarder, EquipC);
  sim.world.get(boarder, HealthC)!.hp = 1e9;
  sim.world.get(boarder, HealthC)!.max = 1e9;
  const at = sim.world.get(boarder, PositionC)!;
  const spot = { x: at.x, y: at.y };
  // Floor tiles the boarder cannot see and that are well away from it; the first two hold the patient and a rescuer.
  const hidden: { x: number; y: number }[] = [];
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
    for (let x = grid.x0; x < grid.x0 + grid.width; x++) {
      if (grid.get('struct', x, y) === Struct.Floor && Math.hypot(x - spot.x, y - spot.y) > 8 && !sightLine(sim, grid, spot, { x, y }).visible) hidden.push({ x, y });
    }
  }
  expect(hidden.length).toBeGreaterThan(4);
  const [patientAt, rescuerAt] = [hidden[0]!, hidden[hidden.length - 1]!];
  const crew = player(sim).filter((c) => sim.world.get(c, CrewC)!.role !== 'role.gunner');
  const [patient, rescuer] = [crew[0]!, crew[1]!];
  for (const [c, t] of [[patient, patientAt], [rescuer, rescuerAt]] as const) {
    sim.world.add(c, PositionC, { x: t.x, y: t.y, toX: t.x, toY: t.y, progress: 0, facing: 0 });
    sim.world.add(c, PathC, { steps: [] });
  }
  const pin = (): void => {
    sim.world.add(boarder, PositionC, { x: spot.x, y: spot.y, toX: spot.x, toY: spot.y, progress: 0, facing: 0 });
  };
  for (let i = 0; i < 40; i++) {
    run(sim, 1);
    pin();
  }
  expect(sim.world.get(rescuer, FighterC)?.mode).toBe('flee'); // hiding first: it is the flee mode that used to block rescues
  sim.world.get(patient, HealthC)!.hp = 0;
  // Pin the boarder where it is (it cannot walk): the scene must stay hidden for the rescuer to be free to go.
  sim.world.get(boarder, PathC)!.steps = [];
  let rescued = false;
  for (let i = 0; i < 20 * 40 && !rescued; i++) {
    run(sim, 1);
    pin();
    for (const j of sim.world.query(JobC)) {
      const job = sim.world.get(j, JobC)!;
      if (job.kind === 'rescue' && job.target === patient && job.reservedBy && job.reservedBy !== patient) rescued = true;
    }
  }
  expect(sim.world.has(patient, DownedC)).toBe(true);
  expect(rescued).toBe(true);
}

describe('combat onboarding: undrafted crew vs boarders', () => {
  it('gunners arm themselves from storage in peacetime, so they can fight without a draft', () => {
    const sim = newGame(1, content);
    run(sim, 20 * 40);
    const gunner = player(sim).find((c) => sim.world.get(c, CrewC)?.role === 'role.gunner')!;
    expect(sim.world.get(gunner, EquipC)?.weapon).toBeTruthy();
  });

  it('an armed gunner fights a boarder undrafted and wins; the unarmed keep clear', () => {
    const sim = newGame(1, content);
    run(sim, 20 * 40);
    const [boarder] = land(sim, 1) as [number];
    const ev = run(sim, 20 * 90);
    const crewShots = ev.filter((e) => e.type === 'crew.attacked' && player(sim).includes(e.crew));
    expect(crewShots.length).toBeGreaterThan(0);
    expect(down(sim, boarder) || sim.world.has(boarder, SurrenderedC)).toBe(true); // downed, dead or surrendered
    expect(player(sim).filter((c) => !down(sim, c)).length).toBeGreaterThanOrEqual(4);
    // Ship clear: nobody is left in a fighting mode and crew are back on colony duty.
    expect(player(sim).every((c) => (sim.world.get(c, FighterC)?.mode ?? 'idle') === 'idle')).toBe(true);
  });

  it('two armed boarders against one gunner at least draw blood', () => {
    const sim = newGame(1, content);
    run(sim, 20 * 40);
    const boarders = land(sim, 2);
    const ev = run(sim, 20 * 30);
    expect(ev.some((e) => e.type === 'crew.hit' && boarders.includes(e.target))).toBe(true);
  });

  it('unarmed crew keep out of the open while boarders are aboard, then go back to work', () => {
    const sim = newGame(1, content);
    run(sim, 20 * 5);
    bare(sim); // an empty locker: nothing to arm with (emergency arming is tested below)
    const boarders = land(sim, 1);
    const b = boarders[0] as number;
    sim.world.get(b, HealthC)!.hp = 1e9;
    sim.world.get(b, HealthC)!.max = 1e9;
    run(sim, 20 * 4);
    const fleeing = player(sim).filter((c) => sim.world.get(c, FighterC)?.mode === 'flee');
    const unarmed = player(sim).filter((c) => !sim.world.get(c, EquipC)?.weapon);
    expect(unarmed.length).toBeGreaterThanOrEqual(3);
    expect(unarmed.every((c) => fleeing.includes(c))).toBe(true); // seen or not
    // Once the intruder is gone they drop the flee mode and are free for jobs again.
    sim.world.remove(b, AllegianceC);
    sim.world.add(b, AllegianceC, { faction: 'player' });
    run(sim, 20 * 2);
    expect(player(sim).every((c) => (sim.world.get(c, FighterC)?.mode ?? 'idle') === 'idle')).toBe(true);
  });

  it('a fleeing crew member rescues a downed one who is out of the boarders\' sight', { timeout: 60000 }, () => rescueScenario());
});

describe('emergency arming: unarmed crew fetch weapons from storage when boarders are aboard', () => {
  const stockOf = (sim: Sim, item: string): number => storageCount(sim, crate(sim), item);
  const roleOf = (sim: Sim, c: number): string => sim.world.get(c, CrewC)!.role;
  const armed = (sim: Sim): number[] => player(sim).filter((c) => sim.world.get(c, EquipC)?.weapon);
  const settle = (): Sim => {
    const sim = newGame(1, content);
    run(sim, 20 * 40); // the gunner has taken the rifle
    return sim;
  };

  it('with rifles in the crate, more crew than the gunner arm and the crew win', { timeout: 60000 }, () => {
    const sim = settle();
    storageAdd(sim, crate(sim), 'item.rifle', 2);
    const boarders = land(sim, 2);
    run(sim, 20 * 6);
    const volunteers = armed(sim).filter((c) => roleOf(sim, c) !== 'role.gunner');
    expect(volunteers.length).toBeGreaterThanOrEqual(1);
    expect(volunteers.every((c) => sim.world.has(c, EmergencyArmC))).toBe(true);
    run(sim, 20 * 84);
    expect(boarders.every((b) => down(sim, b) || sim.world.has(b, SurrenderedC))).toBe(true);
    expect(player(sim).filter((c) => !down(sim, c)).length).toBeGreaterThanOrEqual(3);
  });

  it('the medic is not sent for a weapon while a rescue waits, and the pilot is last in line', () => {
    const sim = settle();
    storageAdd(sim, crate(sim), 'item.rifle', 1);
    land(sim, 2);
    run(sim, 20 * 6);
    const picked = player(sim).filter((c) => sim.world.has(c, EmergencyArmC)).map((c) => roleOf(sim, c));
    expect(picked).toContain('role.engineer'); // before the pilot (stock for the sidearms too, engineer first by id)
    expect(picked.indexOf('role.pilot') === -1 || picked.indexOf('role.engineer') !== -1).toBe(true);
  });

  it('with nothing in storage, unarmed crew still hide', () => {
    const sim = settle();
    bare(sim);
    land(sim, 1);
    run(sim, 20 * 4);
    expect(player(sim).some((c) => sim.world.has(c, EmergencyArmC) || sim.world.has(c, EquipOrderC))).toBe(false);
    const unarmed = player(sim).filter((c) => !sim.world.get(c, EquipC)?.weapon);
    expect(unarmed.length).toBeGreaterThanOrEqual(3);
    expect(unarmed.every((c) => sim.world.get(c, FighterC)?.mode === 'flee')).toBe(true);
  });

  it('once the ship is clear, emergency weapons go back to storage and the crew are off duty-free', { timeout: 60000 }, () => {
    const sim = settle();
    storageAdd(sim, crate(sim), 'item.rifle', 2);
    const boarders = land(sim, 1);
    run(sim, 20 * 6);
    const volunteers = player(sim).filter((c) => sim.world.has(c, EmergencyArmC));
    expect(volunteers.length).toBeGreaterThanOrEqual(1);
    for (const b of boarders) sim.world.add(b, AllegianceC, { faction: 'player' }); // the threat is over
    const rifles = stockOf(sim, 'item.rifle');
    run(sim, 20 * (EMERGENCY_STAND_DOWN_SEC + 60));
    expect(volunteers.every((c) => !sim.world.has(c, EmergencyArmC) && !sim.world.get(c, EquipC)?.weapon)).toBe(true);
    expect(stockOf(sim, 'item.rifle') + stockOf(sim, 'item.sidearm') + stockOf(sim, 'item.blade')).toBeGreaterThan(rifles);
    expect(player(sim).every((c) => (sim.world.get(c, FighterC)?.mode ?? 'idle') === 'idle')).toBe(true);
  });

  it('a medic is not sent for a weapon while a rescue waits (rescues themselves: see above)', { timeout: 60000 }, () => {
    const sim = settle();
    bare(sim);
    storageAdd(sim, crate(sim), 'item.rifle', 1);
    const [engineer, medic] = ['role.engineer', 'role.medic'].map((r) => player(sim).find((c) => roleOf(sim, c) === r)!) as [number, number];
    sim.world.get(engineer, HealthC)!.hp = 0;
    land(sim, 1);
    run(sim, 20 * 3);
    expect(sim.world.has(engineer, DownedC)).toBe(true);
    expect(sim.world.has(medic, EmergencyArmC) || sim.world.has(medic, EquipOrderC) || !!sim.world.get(medic, EquipC)?.weapon).toBe(false);
    expect(sim.world.get(medic, FighterC)?.mode).toBe('flee'); // hiding, free to take the rescue once the patient is out of the boarder's sight
  });

  /** Arm volunteers against one boarder, then make the ship safe and run to just before they would put the weapon back. */
  function almostStandDown(): { sim: Sim; volunteers: number[]; storages: number[] } {
    const sim = settle();
    storageAdd(sim, crate(sim), 'item.rifle', 2);
    const [boarder] = land(sim, 1) as [number];
    run(sim, 20 * 6);
    const volunteers = player(sim).filter((c) => sim.world.has(c, EmergencyArmC));
    expect(volunteers.length).toBeGreaterThanOrEqual(1);
    sim.world.add(boarder, AllegianceC, { faction: 'player' });
    run(sim, 20 * (EMERGENCY_STAND_DOWN_SEC - 2));
    const storages = sim.world.query(StorageC, ModuleC).filter((s) => shipIdOf(sim, sim.world.get(s, ModuleC)!) === ownShip(sim));
    return { sim, volunteers, storages };
  }
  /** Jam shut every tile around the storage module (its own tiles included are solid anyway). */
  function walledOff(sim: Sim, storage: number): void {
    const m = sim.world.get(storage, ModuleC)!;
    const grid = shipGrid(sim, ownShip(sim))!;
    for (let y = m.y - 1; y <= m.y + 1; y++) for (let x = m.x - 1; x <= m.x + 1; x++) if (x !== m.x || y !== m.y) grid.set('jam', x, y, DoorJam.Shut);
  }

  it('puts the weapon in a reachable locker when the nearest one is cut off', { timeout: 60000 }, () => {
    const { sim, volunteers, storages } = almostStandDown();
    const v = volunteers[0] as number;
    const at = sim.world.get(v, PositionC)!;
    const dist = (s: number): number => { const m = sim.world.get(s, ModuleC)!; return Math.max(Math.abs(m.x - at.x), Math.abs(m.y - at.y)); };
    const nearest = [...storages].sort((a, b) => dist(a) - dist(b) || a - b)[0] as number;
    walledOff(sim, nearest);
    const targets = new Set<number>();
    for (let i = 0; i < 20 * 60; i++) {
      run(sim, 1);
      const o = sim.world.get(v, StowOrderC);
      if (o) targets.add(o.storage);
    }
    expect(targets.has(nearest)).toBe(false);
    expect(targets.size).toBeGreaterThan(0);
    expect(sim.world.has(v, EmergencyArmC)).toBe(false);
    expect(sim.world.get(v, EquipC)?.weapon ?? null).toBeNull();
  });

  it('drops the weapon and goes back to work when no locker can be reached', { timeout: 60000 }, () => {
    const { sim, volunteers, storages } = almostStandDown();
    for (const s of storages) walledOff(sim, s);
    run(sim, 20 * 60);
    for (const v of volunteers) {
      expect(sim.world.has(v, EmergencyArmC)).toBe(false);
      expect(sim.world.has(v, StowOrderC)).toBe(false);
      expect(sim.world.get(v, EquipC)?.weapon ?? null).toBeNull();
      expect(sim.world.get(v, FighterC)?.mode ?? 'idle').toBe('idle');
    }
  });

  it('a crew member drafted beside the locker mid-stow keeps the weapon', { timeout: 60000 }, () => {
    const { sim, volunteers } = almostStandDown();
    let v = 0;
    for (let i = 0; i < 20 * 60 && !v; i++) {
      run(sim, 1);
      v = volunteers.find((c) => sim.world.has(c, StowOrderC)) ?? 0;
    }
    expect(v).not.toBe(0);
    const order = sim.world.get(v, StowOrderC)!;
    const m = sim.world.get(order.storage, ModuleC)!;
    while (sim.tick % 10 !== 4) {
      run(sim, 1); // so that the next tick is not one the arming pass looks at
      if (!sim.world.has(v, StowOrderC)) break;
    }
    expect(sim.world.has(v, StowOrderC)).toBe(true);
    sim.world.add(v, PositionC, { x: m.x, y: m.y, toX: m.x, toY: m.y, progress: 0, facing: 0 });
    const weapon = sim.world.get(v, EquipC)!.weapon;
    expect(weapon).toBeTruthy();
    sim.enqueue({ type: 'crew.draft', id: v, drafted: true });
    run(sim, 1);
    expect(sim.world.get(v, EquipC)?.weapon).toBe(weapon);
    expect(sim.world.has(v, StowOrderC) || sim.world.has(v, EmergencyArmC)).toBe(false);
  });
});
