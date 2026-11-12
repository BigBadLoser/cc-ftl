import { describe, expect, it } from 'vitest';
import {
  AssignmentC, CrewC, DownedC, HealthC, JobC, ModuleC, NeedsC, PathC, PositionC, PrioritiesC, ShipC, TICK_HZ, newGame, placementError, playerShip, spawnModule,
  type Sim, type SimEvent,
} from '../../sim';
import { WontDoC } from '../../sim/crew/background';
import { WONT_DO_WHY, blockWork } from '../../sim/crew/workBlock';
import { tendingOf } from '../../sim/crew/treatment';
import { accessTile, footprintTiles } from '../../sim/modules/footprint';
import { SkillXpC } from '../../sim/story/components';
import { content } from '../index';

const run = (sim: Sim, n: number): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
const secs = (n: number): number => Math.round(n * TICK_HZ);
const humans = (sim: Sim): number[] => sim.world.query(CrewC).filter((id) => sim.world.get(id, CrewC)?.species === 'species.human');

/** A free spot (with the walkway beside it, off every other module's access tile) for a module, scanning the ship from its top-left. */
function place(sim: Sim, def: string): number {
  const ship = playerShip(sim) as number;
  const at = sim.world.get(ship, ShipC)!;
  const d = content.modules[def as 'module.hydroponics'];
  const access = new Set(sim.world.query(ModuleC).map((id) => {
    const m = sim.world.get(id, ModuleC)!;
    const a = accessTile(content.modules[m.def as 'module.hydroponics'], m.x, m.y, m.rot);
    return a ? `${a.x},${a.y}` : '';
  }));
  const blocks = (x: number, y: number): boolean => footprintTiles(d, x, y, 0).some((t) => access.has(`${t.x},${t.y}`));
  for (let y = at.y; y < at.y + at.height; y++) {
    for (let x = at.x; x < at.x + at.width; x++) if (placementError(sim, ship, def, x, y, 0) === null && !blocks(x, y)) return spawnModule(sim, def, x, y, 0);
  }
  throw new Error('no room for the bed');
}


const hp = (sim: Sim, id: number): number => sim.world.get(id, HealthC)!.hp;
const tendJobs = (sim: Sim): number[] => sim.world.query(JobC).filter((j) => sim.world.get(j, JobC)!.kind === 'tend');
const medicXp = (sim: Sim, id: number): number => sim.world.get(id, SkillXpC)?.xp.medicine ?? 0;

/** Put a crew member on a free floor tile beside a module (so the test is about tending, not the walk). */
function standBeside(sim: Sim, id: number, m: { x: number; y: number }): void {
  const ship = playerShip(sim) as number;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1], [0, 2], [1, 2], [-1, 2], [1, 1], [-1, 1], [-1, -1], [1, -1]] as const) {
    if (placementError(sim, ship, 'module.battery', m.x + dx, m.y + dy, 0) !== null) continue;
    const p = sim.world.get(id, PositionC)!;
    p.x = p.toX = m.x + dx;
    p.y = p.toY = m.y + dy;
    p.progress = 0;
    sim.world.get(id, PathC)!.steps = [];
    return;
  }
  throw new Error('no free tile beside the bed');
}

/** The starter game with one free medical bed, a stabilised downed patient (crew 0) in it at 1 hp, and only crew 1 willing to do medical work (skilled). */
function sickbay(medicWorks = true, wontDoMedical = false): { sim: Sim; med: number; patient: number; medic: number; other: number } {
  const sim = newGame(3, content);
  run(sim, 5);
  for (const id of sim.world.query(ModuleC)) if (content.modules[sim.world.get(id, ModuleC)!.def as 'module.med_bed'].bed) sim.world.get(id, ModuleC)!.reservedBy = 99; // no other bed is free
  const med = place(sim, 'module.med_bed');
  const crew = humans(sim);
  const [patient, medic, other] = crew as [number, number, number];
  for (const id of crew) {
    sim.world.get(id, NeedsC)!.hunger = 100;
    sim.world.get(id, NeedsC)!.rest = 100;
    if (id !== medic || !medicWorks) sim.world.get(id, PrioritiesC)!.medical = 0;
  }
  sim.world.get(medic, PrioritiesC)!.medical = medicWorks ? 1 : 0;
  sim.enqueue({ type: 'debug.setCrew', id: medic, xp: { medicine: 2000 } });
  if (wontDoMedical) {
    sim.world.add(medic, WontDoC, { ids: ['medical'] });
    blockWork(sim, medic, 'medical', WONT_DO_WHY); // what the spawn does for a crew member with this won't-do
  }
  sim.world.get(med, ModuleC)!.reservedBy = patient;
  sim.world.add(patient, DownedC, { bleed: 100, stabilized: true, bed: med });
  const m = sim.world.get(med, ModuleC)!;
  const pos = sim.world.get(patient, PositionC)!;
  pos.x = pos.toX = m.x;
  pos.y = pos.toY = m.y;
  sim.world.get(patient, HealthC)!.hp = 1;
  run(sim, secs(12)); // the tend job is posted and a medic takes it
  standBeside(sim, medic, m); // then they stand beside the bed, so the test is about tending, not the walk
  sim.world.get(patient, HealthC)!.hp = 1;
  return { sim, med, patient, medic, other };
}

describe('tending a medical bed', () => {
  it('a tended patient heals faster than an untended one, and the XP goes to the tending medic only', () => {
    const tended = sickbay();
    const lazy = sickbay(false);
    run(tended.sim, secs(8));
    run(lazy.sim, secs(8));
    expect(tendJobs(tended.sim)).toHaveLength(1);
    const t = tendingOf(tended.sim, tended.med);
    expect(t.medic).toBe(tended.medic);
    expect(t.mult).toBeGreaterThan(1);
    expect(hp(tended.sim, tended.patient) - 1).toBeGreaterThan((hp(lazy.sim, lazy.patient) - 1) * 1.2);
    expect(tendingOf(lazy.sim, lazy.med).medic).toBe(0);
    expect(medicXp(tended.sim, tended.medic)).toBeGreaterThan(2000 - 1); // grew from the level the test set
    expect(medicXp(tended.sim, tended.other)).toBe(0);
    expect(medicXp(tended.sim, tended.patient)).toBe(0);
  });

  it('the job is dropped, and the medic freed, when the patient gets up', () => {
    const { sim, patient, medic } = sickbay();
    run(sim, secs(10));
    expect(tendJobs(sim)).toHaveLength(1);
    expect(sim.world.has(medic, AssignmentC)).toBe(true);
    sim.world.get(patient, HealthC)!.hp = 39.99; // gets up at 40
    run(sim, 1);
    expect(sim.world.has(patient, DownedC)).toBe(false);
    sim.world.get(patient, HealthC)!.hp = 100; // well: nothing sends them back to a bed (at 40 hp they would walk back, which is a new stay)
    run(sim, 8);
    expect(sim.world.has(patient, DownedC)).toBe(false);
    expect(tendJobs(sim)).toHaveLength(0);
    expect(sim.world.get(medic, AssignmentC)).toBeUndefined();
  });

  it('a medic who will not do medical work never tends', () => {
    const { sim, med, medic } = sickbay(true, true);
    run(sim, secs(10));
    expect(tendJobs(sim)).toHaveLength(1);
    expect(tendingOf(sim, med).medic).toBe(0);
    expect(sim.world.get(medic, AssignmentC)).toBeUndefined();
  });

  it('a walking patient in a medical bed is tended the same way, and the tend job goes when they are healed', () => {
    const sim = newGame(3, content);
    run(sim, 5);
    for (const id of sim.world.query(ModuleC)) if (content.modules[sim.world.get(id, ModuleC)!.def as 'module.med_bed'].bed) sim.world.get(id, ModuleC)!.reservedBy = 99;
    const med = place(sim, 'module.med_bed');
    sim.world.get(med, ModuleC)!.reservedBy = 0;
    const [patient, medic] = humans(sim) as [number, number];
    for (const id of humans(sim)) {
      sim.world.get(id, NeedsC)!.hunger = 100;
      sim.world.get(id, NeedsC)!.rest = 100;
      sim.world.get(id, PrioritiesC)!.medical = id === medic ? 1 : 0;
    }
    sim.enqueue({ type: 'debug.setCrew', id: medic, xp: { medicine: 2000 } });
    sim.world.get(patient, HealthC)!.hp = 20;
    run(sim, secs(12));
    standBeside(sim, medic, sim.world.get(med, ModuleC)!);
    run(sim, secs(3));
    expect(tendingOf(sim, med).medic).toBe(medic);
    run(sim, secs(80));
    expect(hp(sim, patient)).toBe(100);
    expect(tendJobs(sim)).toHaveLength(0);
  });

  it('a medic tending a stable patient breaks off for a newly downed crew member (a rescue preempts tending)', () => {
    const { sim, medic, other } = sickbay();
    run(sim, secs(4));
    expect(sim.world.get(sim.world.get(medic, AssignmentC)?.jobId ?? 0, JobC)?.kind).toBe('tend');
    place(sim, 'module.med_bed'); // a free bed to carry them to
    sim.world.get(other, HealthC)!.hp = 0; // goes down, bleeding out
    let rescued = false;
    for (let i = 0; i < secs(15) && !rescued; i++) {
      run(sim, 1);
      rescued = sim.world.get(sim.world.get(medic, AssignmentC)?.jobId ?? 0, JobC)?.kind === 'rescue';
    }
    expect(rescued).toBe(true);
  });
});
