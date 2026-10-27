import { describe, expect, it } from 'vitest';
import { AssignmentC, CrewC, JobC, ModuleC, PathC, PositionC, newGame, operatorOf, placementError, type Sim } from '../../sim';
import { operateJobsSystem } from '../../sim/systems/operateJobs';
import { content } from '../index';
import { shipIdOf, shipIds } from '../../sim/regions';
import { releaseAssignment } from '../../sim/crew/helpers';

/** A crewless raider never fires back: nothing of ours breaks unless a test breaks it, so no repair job appears by itself. */
const dummy = { ...content.ships['ship.raider'], crew: [] };
function setup(): Sim {
  const sim = newGame(1, { ...content, ships: { ...content.ships, 'ship.dummy': dummy } });
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.dummy', x: 20, y: 90 });
  for (let i = 0; i < 5; i++) sim.step();
  return sim;
}
const run = (sim: Sim, n: number, stop: () => boolean = () => false): void => { for (let i = 0; i < n && !stop(); i++) sim.step(); };
const crewOf = (sim: Sim, role: string): number => sim.world.query(CrewC).find((c) => sim.world.get(c, CrewC)!.role === role) as number;
const weaponsConsole = (sim: Sim): number =>
  sim.world.query(ModuleC).find((i) => sim.content.modules[sim.world.get(i, ModuleC)!.def]?.console === 'weapons' && shipIdOf(sim, sim.world.get(i, ModuleC)!) === shipIds(sim)[0]) as number;
const jobOf = (sim: Sim, crew: number) => { const a = sim.world.get(crew, AssignmentC); return a ? sim.world.get(a.jobId, JobC) : undefined; };
/** Set a priority of the player's crew of a role (the enemy's crew keep theirs). */
const priority = (sim: Sim, role: string, category: string, value: number): void => {
  for (const id of sim.world.query(CrewC, PositionC)) {
    if (sim.world.get(id, CrewC)!.role === role && shipIdOf(sim, sim.world.get(id, PositionC)!) === shipIds(sim)[0]) sim.enqueue({ type: 'crew.setPriority', id, category: category as never, value });
  }
};
/** Break the first non-console module of the player's ship halfway: an open repair job appears. */
function breakSomething(sim: Sim): void {
  const m = sim.world.query(ModuleC).find((i) => {
    const mod = sim.world.get(i, ModuleC)!;
    const def = sim.content.modules[mod.def];
    return shipIdOf(sim, mod) === shipIds(sim)[0] && !def?.console && !def?.weapon && (def?.maxHp ?? 0) > 20;
  }) as number;
  const mod = sim.world.get(m, ModuleC)!;
  mod.hp = sim.content.modules[mod.def]!.maxHp / 2;
}
const repairJob = (sim: Sim): number | undefined =>
  sim.world.query(JobC).find((j) => sim.world.get(j, JobC)!.kind === 'repair' && sim.world.get(j, JobC)!.reservedBy === 0);

describe('covering an empty console', () => {
  it('calls the operator back from a chore they rank lower', () => {
    const sim = setup();
    const gunner = crewOf(sim, 'role.gunner');
    const console = weaponsConsole(sim);
    run(sim, 1500, () => operatorOf(sim, console) === gunner);
    expect(operatorOf(sim, console)).toBe(gunner);
    // nobody else repairs: the gunner takes the chore and leaves the console, as a gunner busy elsewhere would
    for (const role of ['role.engineer', 'role.medic', 'role.pilot']) priority(sim, role, 'repair', 0);
    run(sim, 2);
    breakSomething(sim);
    run(sim, 5);
    const repair = repairJob(sim);
    expect(repair).toBeDefined();
    releaseAssignment(sim, gunner);
    sim.world.get(repair!, JobC)!.reservedBy = gunner;
    sim.world.add(gunner, AssignmentC, { jobId: repair! });
    sim.world.add(gunner, PathC, { steps: [] });
    run(sim, 60);
    // the console is empty and the gunner ranks operating (1) above repair (3): they are sent back
    expect(jobOf(sim, gunner)?.kind).toBe('operate');
  });
});

describe('a relief at a console', () => {
  /** The gunner will not operate; the engineer relieves the empty weapons console after the wait. */
  function withRelief(): { sim: Sim; engineer: number; gunner: number; console: number } {
    const sim = setup();
    const [engineer, gunner, console] = [crewOf(sim, 'role.engineer'), crewOf(sim, 'role.gunner'), weaponsConsole(sim)];
    priority(sim, 'role.gunner', 'operating', 0);
    priority(sim, 'role.medic', 'operating', 0);
    run(sim, 1500, () => operatorOf(sim, console) === engineer);
    expect(operatorOf(sim, console)).toBe(engineer);
    return { sim, engineer, gunner, console };
  }

  it('hands the console to an operator who is free again', () => {
    const { sim, engineer, gunner, console } = withRelief();
    priority(sim, 'role.gunner', 'operating', 1);
    run(sim, 400, () => operatorOf(sim, console) === gunner);
    expect(operatorOf(sim, console)).toBe(gunner);
    expect(jobOf(sim, engineer)?.kind).not.toBe('operate');
  });

  it('leaves the console for work it ranks higher', () => {
    const { sim, engineer, console } = withRelief();
    breakSomething(sim);
    run(sim, 60);
    expect(jobOf(sim, engineer)?.kind).toBe('repair'); // repair is the engineer's first priority, operating its third
    expect(operatorOf(sim, console)).not.toBe(engineer);
  });
});

describe('covering a console with two ships in the fight', () => {
  /** A crewed hostile with no console at all and only a gunner: nothing of his own ship calls him, so only our consoles could. */
  const lone = {
    ...content.ships['ship.raider'], crew: ['role.gunner'],
    modules: content.ships['ship.raider'].modules!.filter((m) => !['module.weaponsConsole', 'module.helm', 'module.shieldConsole'].includes(m.def)),
  };
  function twoShips(): Sim {
    const sim = newGame(1, { ...content, ships: { ...content.ships, 'ship.lone': lone } });
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.lone', x: 20, y: 90 });
    for (let i = 0; i < 5; i++) sim.step();
    return sim;
  }
  const enemyGunner = (sim: Sim): number =>
    sim.world.query(CrewC).find((c) => sim.world.get(c, CrewC)!.role === 'role.gunner' && shipIdOf(sim, sim.world.get(c, PositionC)!) === shipIds(sim)[1]) as number;

  it("does not call the enemy's gunner off his chore for our empty console", () => {
    const sim = twoShips();
    const gunner = enemyGunner(sim);
    for (const role of ['role.gunner', 'role.pilot', 'role.engineer', 'role.medic']) priority(sim, role, 'operating', 0);
    run(sim, 2);
    for (const c of sim.world.query(CrewC)) if (shipIdOf(sim, sim.world.get(c, PositionC)!) === shipIds(sim)[0]) releaseAssignment(sim, c);
    // his own ship has a repair job he is busy with
    const enemyModule = sim.world.query(ModuleC).find((i) => shipIdOf(sim, sim.world.get(i, ModuleC)!) === shipIds(sim)[1] && (sim.content.modules[sim.world.get(i, ModuleC)!.def]?.maxHp ?? 0) > 20) as number;
    sim.world.get(enemyModule, ModuleC)!.hp = 5;
    run(sim, 100, () => jobOf(sim, gunner)?.kind === 'repair'); // with no console of his own to man, he takes the repair at once
    expect(jobOf(sim, gunner)?.kind).toBe('repair');
    const ours = sim.world.query(JobC).find((j) => sim.world.get(j, JobC)!.kind === 'operate' && sim.world.get(j, JobC)!.reservedBy === 0);
    expect(ours).toBeDefined(); // our weapons console stands empty
    operateJobsSystem(sim);
    expect(jobOf(sim, gunner)?.kind).toBe('repair');
  });

  it("does not let the enemy's idle gunner evict our relief", () => {
    const sim = twoShips();
    const [engineer, console] = [crewOf(sim, 'role.engineer'), weaponsConsole(sim)];
    priority(sim, 'role.gunner', 'operating', 0);
    priority(sim, 'role.medic', 'operating', 0);
    const gunner = enemyGunner(sim);
    releaseAssignment(sim, gunner);
    run(sim, 1500, () => operatorOf(sim, console) === engineer);
    expect(operatorOf(sim, console)).toBe(engineer);
    run(sim, 100);
    expect(operatorOf(sim, console)).toBe(engineer);
  });
});

describe('a relief and work it cannot take', () => {
  it('stays at the console while the only waiting work is a blueprint with no materials', () => {
    const sim = setup();
    const [engineer, console] = [crewOf(sim, 'role.engineer'), weaponsConsole(sim)];
    priority(sim, 'role.gunner', 'operating', 0);
    priority(sim, 'role.medic', 'operating', 0);
    for (const role of ['role.engineer', 'role.gunner', 'role.pilot', 'role.medic']) priority(sim, role, 'hauling', 0); // nobody fetches the materials
    run(sim, 1500, () => operatorOf(sim, console) === engineer);
    expect(operatorOf(sim, console)).toBe(engineer);
    const me = shipIds(sim)[0] as number;
    const def = Object.keys(sim.content.modules).find((d) => (sim.content.modules[d]?.cost ?? []).length > 0 && !sim.content.modules[d]?.console) as string;
    let placed = false;
    for (let y = 0; y < 40 && !placed; y++) {
      for (let x = 0; x < 60 && !placed; x++) {
        if (placementError(sim, me, def, 20 + x, 50 + y, 0)) continue;
        sim.enqueue({ type: 'job.buildModule', ship: me, x: 20 + x, y: 50 + y, def, rot: 0 });
        placed = true;
      }
    }
    expect(placed).toBe(true);
    run(sim, 5);
    expect(sim.world.query(JobC).some((j) => sim.world.get(j, JobC)!.kind === 'module')).toBe(true);
    run(sim, 100);
    expect(operatorOf(sim, console)).toBe(engineer);
  });
});
