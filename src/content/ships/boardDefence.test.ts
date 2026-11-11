import { describe, expect, it } from 'vitest';
import { sightLine } from '../../sim/fight/los';
import { AllegianceC, CrewC, DeadC, DownedC, EquipC, ModuleC, WontDoC, StorageC, storageCount, storageTake, FighterC, JobC, PathC, Struct, shipGrid, SurrenderedC, HealthC, PositionC, newGame, spawnCrew, type Sim, type SimEvent } from '../../sim';
import { content } from '../index';
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
/** Take the crew's own weapons too (everyone starts with a sidearm) and empty the locker: an unarmed crew. */
const disarm = (sim: Sim): void => {
  bare(sim);
  for (const c of player(sim)) sim.world.remove(c, EquipC);
};

/** A hiding crew member rescues a downed one out of the lone boarder's sight; the locker is empty. */
function rescueScenario(): void {
  const sim = newGame(1, content);
  run(sim, 20 * 5);
  disarm(sim);
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
  it('an armed crew fights a boarder undrafted and wins', () => {
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

  it('two armed boarders against an armed crew at least draw blood', () => {
    const sim = newGame(1, content);
    run(sim, 20 * 40);
    const boarders = land(sim, 2);
    const ev = run(sim, 20 * 30);
    expect(ev.some((e) => e.type === 'crew.hit' && boarders.includes(e.target))).toBe(true);
  });

  it('unarmed crew keep out of the open while boarders are aboard, then go back to work', () => {
    const sim = newGame(1, content);
    run(sim, 20 * 5);
    disarm(sim); // nobody armed, nothing in the locker
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

describe('always armed (docs/TRAITS.md 10.9)', () => {
  const stockOf = (sim: Sim, item: string): number => storageCount(sim, crate(sim), item);

  it('every person starts with a sidearm; the better shots trade up from the locker, one per item, and the old one goes back', () => {
    const sim = newGame(1, content);
    expect(player(sim).every((c) => sim.world.get(c, EquipC)?.weapon === 'item.sidearm')).toBe(true);
    run(sim, 20 * 60);
    const held = player(sim).map((c) => sim.world.get(c, EquipC)?.weapon);
    expect(held.filter((w) => w === 'item.rifle').length).toBe(1);
    expect(held.every((w) => !!w)).toBe(true);
    expect(stockOf(sim, 'item.rifle')).toBe(0);
    expect(stockOf(sim, 'item.sidearm')).toBeGreaterThanOrEqual(3); // the trade put a sidearm back
    const gunner = player(sim).find((c) => sim.world.get(c, CrewC)?.role === 'role.gunner')!;
    expect(sim.world.get(gunner, EquipC)?.weapon).toBe('item.rifle'); // the best shot first
  });

  it('a crew member who lost their weapon re-arms from storage once free', () => {
    const sim = newGame(1, content);
    run(sim, 20 * 5);
    const c = player(sim)[0]!;
    sim.world.remove(c, EquipC);
    run(sim, 20 * 60);
    expect(sim.world.get(c, EquipC)?.weapon).toBeTruthy();
  });

  it('a Pacifist carries nothing, refuses a weapon and an attack order, and keeps clear of boarders', () => {
    const sim = newGame(1, content);
    const c = player(sim)[0]!;
    sim.world.add(c, WontDoC, { ids: ['violence'] });
    sim.world.remove(c, EquipC);
    sim.enqueue({ type: 'crew.equip', id: c, item: 'item.rifle' });
    const ev = run(sim, 20 * 30);
    expect(ev).toContainEqual({ type: 'command.rejected', command: 'crew.equip', reason: 'wontDo' });
    expect(sim.world.get(c, EquipC)?.weapon).toBeFalsy();
    const [b] = land(sim, 1) as [number];
    sim.world.get(b, HealthC)!.hp = 1e9;
    sim.enqueue({ type: 'crew.draft', id: c, drafted: true });
    sim.enqueue({ type: 'crew.attack', id: c, target: b });
    const ev2 = run(sim, 20 * 3);
    expect(ev2).toContainEqual({ type: 'command.rejected', command: 'crew.attack', reason: 'wontDo' });
    expect(ev2.some((e) => e.type === 'crew.attacked' && e.crew === c)).toBe(false);
  });
});
