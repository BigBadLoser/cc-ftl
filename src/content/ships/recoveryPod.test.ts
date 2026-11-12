import { describe, expect, it } from 'vitest';
import {
  AssignmentC, CrewC, DownedC, HealthC, ModuleC, NeedsC, PositionC, RecoveringC, ShipC, TICK_HZ, homeShip, newGame, placementError, playerShip, spawnModule,
  type Sim, type SimEvent,
} from '../../sim';
import { findFreeBed } from '../../sim/crew/beds';
import { isIncapacitated } from '../../sim/crew/helpers';
import { content } from '../index';
import { accessTile, footprintTiles } from '../../sim/modules/footprint';

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

/** The starter game with a recovery pod placed and the crew fed and rested, so only the test's patients act. */
function podGame(): { sim: Sim; pod: number; crew: number[] } {
  const sim = newGame(3, content);
  run(sim, 5);
  const pod = place(sim, 'module.recovery');
  for (const h of humans(sim)) {
    sim.world.get(h, NeedsC)!.hunger = 100;
    sim.world.get(h, NeedsC)!.rest = 100;
  }
  run(sim, 3);
  return { sim, pod, crew: humans(sim) };
}
const hp = (sim: Sim, id: number): number => sim.world.get(id, HealthC)!.hp;
const hurt = (sim: Sim, id: number, to: number): void => { sim.world.get(id, HealthC)!.hp = to; };

describe('recovery pod', () => {
  it('is powered content with a footprint matching the art', () => {
    const def = content.modules['module.recovery'];
    expect(def.footprint).toEqual([2, 2]);
    expect(def.power).toBeLessThan(0);
    expect(def.recovery).toBe(true);
  });

  it('a hurt crew member walks to a free powered pod, is out of action in it and heals to full', () => {
    const { sim, pod, crew } = podGame();
    expect(sim.world.get(pod, ModuleC)!.powered).toBe(true);
    const id = crew[0] as number;
    hurt(sim, id, 30);
    const events = run(sim, secs(20));
    expect(events.some((e) => e.type === 'crew.enteredPod' && e.crew === id)).toBe(true);
    expect(sim.world.get(id, RecoveringC)?.bed).toBe(pod);
    expect(sim.world.get(pod, ModuleC)!.reservedBy).toBe(id);
    expect(isIncapacitated(sim, id)).toBe(true);
    expect(sim.world.has(id, AssignmentC)).toBe(false);
    expect(hp(sim, id)).toBeGreaterThan(30);
    const m = sim.world.get(pod, ModuleC)!;
    expect(sim.world.get(id, PositionC)).toMatchObject({ x: m.x, y: m.y });
    const later = run(sim, secs(60));
    expect(later.some((e) => e.type === 'crew.leftPod' && e.crew === id)).toBe(true);
    expect(hp(sim, id)).toBe(100);
    expect(sim.world.has(id, RecoveringC)).toBe(false);
    expect(sim.world.get(pod, ModuleC)!.reservedBy).toBe(0);
    expect(isIncapacitated(sim, id)).toBe(false);
  });

  it('holds one patient at a time', () => {
    const { sim, pod, crew } = podGame();
    const [a, b] = crew as [number, number];
    hurt(sim, a, 30);
    hurt(sim, b, 30);
    run(sim, secs(8));
    const inside = [a, b].filter((id) => sim.world.has(id, RecoveringC));
    expect(inside).toHaveLength(1);
    expect(sim.world.get(pod, ModuleC)!.reservedBy).toBe(inside[0]);
  });

  it('an unpowered pod heals nobody: a hurt crew member does not go to it', () => {
    const { sim, pod, crew } = podGame();
    sim.world.get(pod, ModuleC)!.enabled = false;
    run(sim, 3);
    expect(sim.world.get(pod, ModuleC)!.powered).toBe(false);
    const id = crew[0] as number;
    hurt(sim, id, 30);
    run(sim, secs(10));
    expect(sim.world.has(id, RecoveringC)).toBe(false);
    expect(hp(sim, id)).toBeLessThan(35);
  });

  it('a patient is let out when the pod loses power, and a downed one in it is paused, not healed', () => {
    const { sim, pod, crew } = podGame();
    const [a] = crew as [number];
    hurt(sim, a, 30);
    run(sim, secs(10));
    expect(sim.world.has(a, RecoveringC)).toBe(true);
    sim.world.get(pod, ModuleC)!.enabled = false;
    run(sim, 3);
    expect(sim.world.has(a, RecoveringC)).toBe(false);
    expect(sim.world.get(pod, ModuleC)!.reservedBy).toBe(0);
  });

  it('downed crew are carried to it, stabilised, heal without a medic, and stay to full', () => {
    const { sim, pod, crew } = podGame();
    const patient = crew[0] as number;
    hurt(sim, patient, 0);
    const events = run(sim, secs(40));
    
    expect(events.some((e) => e.type === 'crew.rescued' && e.crew === patient)).toBe(true);
    const bedId = sim.world.get(patient, DownedC)?.bed ?? sim.world.get(patient, RecoveringC)?.bed;
    expect(bedId).toBe(pod);
    expect(hp(sim, patient)).toBeGreaterThan(0);
    run(sim, secs(80));
    expect(hp(sim, patient)).toBe(100);
    expect(sim.world.has(patient, DownedC)).toBe(false);
    expect(sim.world.has(patient, RecoveringC)).toBe(false);
  });

  it('a downed patient in an unpowered pod is stabilised but does not heal', () => {
    const { sim, pod, crew } = podGame();
    const patient = crew[0] as number;
    const m = sim.world.get(pod, ModuleC)!;
    sim.world.get(pod, ModuleC)!.enabled = false;
    run(sim, 3);
    m.reservedBy = patient;
    sim.world.add(patient, DownedC, { bleed: 100, stabilized: true, bed: pod });
    hurt(sim, patient, 1);
    run(sim, secs(5));
    expect(hp(sim, patient)).toBe(1);
  });

  it('patients prefer a pod to a medical bed; sleepers never get one', () => {
    const { sim, pod, crew } = podGame();
    const med = place(sim, 'module.med_bed');
    const ship = homeShip(sim);
    const pos = sim.world.get(crew[0] as number, PositionC)!;
    const from = { x: pos.x, y: pos.y };
    expect(findFreeBed(sim, ship, from, false, undefined, true)?.bed).toBe(pod);
    sim.world.get(pod, ModuleC)!.reservedBy = 99;
    expect(findFreeBed(sim, ship, from, false, undefined, true)?.bed).toBe(med);
    sim.world.get(pod, ModuleC)!.reservedBy = 0;
    for (const id of sim.world.query(ModuleC)) {
      const d = content.modules[sim.world.get(id, ModuleC)!.def as 'module.bed'];
      if (d.bed && id !== pod && id !== med) sim.world.get(id, ModuleC)!.reservedBy = 99;
    }
    sim.world.get(med, ModuleC)!.reservedBy = 99;
    expect(findFreeBed(sim, ship, from)).toBeNull();
  });
});
