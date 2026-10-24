import { describe, expect, it } from 'vitest';
import {
  AssignmentC, CombatC, CrewC, DraftedC, FTL_CHARGE_SEC, JobC, ModuleC, START_NODE, deserialize, ftlStatus, galaxyIndex, homeShip, newGame,
  operatorOf, serialize, type Sim, type SimEvent,
} from '../../sim';
import { giveItems } from '../../sim/story/effects';
import { content } from '../index';

const run = (sim: Sim, n: number): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
const helmOf = (sim: Sim): number => sim.world.query(ModuleC).find((m) => sim.content.modules[sim.world.get(m, ModuleC)!.def]?.console === 'helm') as number;
const seatedBy = (sim: Sim): number => operatorOf(sim, helmOf(sim));
const roleOf = (sim: Sim, id: number): string | undefined => sim.world.get(id, CrewC)?.role;
/** A new game after the power system has run once (modules start unpowered at tick 0). */
const fresh = (): Sim => {
  const sim = newGame(1, content);
  run(sim, 5);
  return sim;
};
const neighbour = (sim: Sim): string => {
  const e = (galaxyIndex(sim.galaxy).adjacent.get(START_NODE) ?? [])[0]!;
  return e.a === START_NODE ? e.b : e.a;
};

describe('ftl.charge', () => {
  it('sends the pilot to the helm and charges the drive outside combat, then frees them', () => {
    const sim = fresh();
    const ship = homeShip(sim);
    expect(sim.sector.inCombat).toBe(false);
    run(sim, 200); // power settles; nobody mans the helm without an order
    expect(sim.world.get(ship, CombatC)!.ftl).toBe(0);
    expect(ftlStatus(sim, ship)).toMatchObject({ state: 'idle', blocker: null, ordered: false });

    sim.enqueue({ type: 'ftl.charge', ship });
    run(sim, 2);
    expect(['heading', 'charging']).toContain(ftlStatus(sim, ship)!.state);
    run(sim, 400);
    expect(roleOf(sim, seatedBy(sim))).toBe('role.pilot');
    expect(ftlStatus(sim, ship)).toMatchObject({ state: 'charging', ordered: true });
    expect(sim.world.get(ship, CombatC)!.ftl).toBeGreaterThan(0);
    run(sim, 20 * (FTL_CHARGE_SEC + 5));
    expect(sim.world.get(ship, CombatC)!.ftl).toBe(FTL_CHARGE_SEC);
    expect(ftlStatus(sim, ship)).toMatchObject({ state: 'ready', ordered: false });
    run(sim, 5);
    expect(seatedBy(sim)).toBe(0);
    expect(sim.world.query(JobC).filter((j) => sim.world.get(j, JobC)!.kind === 'operate')).toHaveLength(0);
  });

  it('falls back to any crew member when no pilot is free', () => {
    const sim = fresh();
    const ship = homeShip(sim);
    for (const id of sim.world.query(CrewC)) if (roleOf(sim, id) === 'role.pilot') sim.world.add(id, DraftedC, {} as never);
    sim.enqueue({ type: 'ftl.charge', ship });
    run(sim, 600);
    const who = seatedBy(sim);
    expect(who).not.toBe(0);
    expect(roleOf(sim, who)).not.toBe('role.pilot');
    expect(sim.world.get(ship, CombatC)!.ftl).toBeGreaterThan(0);
  });

  it('rejects with a reason when the helm is unpowered, and cancel frees the pilot', () => {
    const sim = fresh();
    const ship = homeShip(sim);
    sim.world.get(helmOf(sim), ModuleC)!.enabled = false;
    run(sim, 5);
    expect(ftlStatus(sim, ship)!.blocker).toBe('helmOffline');
    sim.enqueue({ type: 'ftl.charge', ship });
    expect(run(sim, 1).some((e) => e.type === 'command.rejected' && e.reason === 'helmOffline')).toBe(true);
    sim.world.get(helmOf(sim), ModuleC)!.enabled = true;
    run(sim, 5);
    sim.enqueue({ type: 'ftl.charge', ship });
    run(sim, 400);
    expect(seatedBy(sim)).not.toBe(0);
    const stored = sim.world.get(ship, CombatC)!.ftl;
    sim.enqueue({ type: 'ftl.cancelCharge', ship });
    run(sim, 10);
    expect(seatedBy(sim)).toBe(0);
    expect(ftlStatus(sim, ship)).toMatchObject({ state: 'idle', ordered: false });
    expect(sim.world.get(ship, CombatC)!.ftl).toBeGreaterThanOrEqual(stored);
    expect([...sim.world.query(CrewC)].some((c) => sim.world.has(c, AssignmentC) && sim.world.get(sim.world.get(c, AssignmentC)!.jobId, JobC)?.kind === 'operate')).toBe(false);
  });

  it('flies a queued jump when the charge covers the route', () => {
    const sim = fresh();
    const ship = homeShip(sim);
    giveItems(sim, 'item.fuel', 50);
    const to = neighbour(sim);
    sim.enqueue({ type: 'ftl.charge', ship, jump: [to] });
    const events = run(sim, 20 * (FTL_CHARGE_SEC + 40));
    expect(events.some((e) => e.type === 'galaxy.hyperspace')).toBe(true);
    expect(sim.galaxy.travel?.route[1] ?? sim.galaxy.current).toBe(to);
    expect(sim.world.get(ship, CombatC)?.ftlOrder ?? null).toBeNull();
  });

  it('survives a save and load mid-charge', () => {
    const sim = fresh();
    const ship = homeShip(sim);
    sim.enqueue({ type: 'ftl.charge', ship });
    run(sim, 500);
    const mid = sim.world.get(ship, CombatC)!.ftl;
    expect(mid).toBeGreaterThan(0);
    const copy = deserialize(serialize(sim), content);
    expect(ftlStatus(copy, ship)).toMatchObject({ state: 'charging', ordered: true });
    run(copy, 100);
    expect(copy.world.get(ship, CombatC)!.ftl).toBeGreaterThan(mid);
    expect(seatedBy(copy)).not.toBe(0);
  });
});
