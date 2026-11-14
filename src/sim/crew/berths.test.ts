import { describe, expect, it } from 'vitest';
import { homeShip, stampShip } from '../combat/ships';
import { ModuleC } from '../modules/components';
import type { ContentRegistry, ModuleDef } from '../registry';
import { Sim } from '../sim';
import { claimBed, claimedBed, releaseBedClaim } from '../ai/task';
import { auditReservations } from '../ai/audit';
import { bedOwnersSystem } from '../systems/bedOwners';
import { findFreeBed } from './beds';
import { berthHolders, berthOf, freeBerth } from './berths';
import { BedOwnerC, CrewC, NeedsC, PathC, PositionC, PrioritiesC } from './components';

const rows = ['#########', '#___#___#', '#___D___#', '#___#___#', '#########'];
const prio = { firefighting: 4, medical: 4, operating: 4, repair: 4, construction: 4, hauling: 4, refining: 4, crafting: 4, research: 4, cooking: 4, farming: 4, patrol: 4 };
const bunk = { name: 'Bunk', footprint: [1, 2], maxHp: 10, power: 0, bed: true, berths: 2 } as unknown as ModuleDef;
const bed = { name: 'Bed', footprint: [1, 1], maxHp: 10, power: 0, bed: true } as unknown as ModuleDef;
const content: ContentRegistry = {
  ships: { 'ship.t': { name: 't', rows } },
  roles: { 'role.engineer': { name: 'E', priorities: prio } },
  modules: { 'module.bunk': bunk, 'module.bed': bed },
  species: { 'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6 } },
  crewNames: ['A', 'B', 'C'],
  items: {},
  recipes: {},
  structCosts: {},
};

function make(): Sim {
  const sim = new Sim(7, content);
  stampShip(sim, content.ships['ship.t']!, { faction: 'player', state: 'prize', x: 0, y: 0 });
  return sim;
}
function crew(sim: Sim, x: number, y: number): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'role.engineer', species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { x, y, toX: x, toY: y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, prio);
  sim.world.add(id, NeedsC, { rest: 100 });
  return id;
}
function put(sim: Sim, def: string, x: number, y: number): number {
  const id = sim.world.createEntity();
  sim.world.add(id, ModuleC, { def, x, y, rot: 0, hp: 10, enabled: true, powered: false, powerPriority: 0, reservedBy: 0 } as never);
  return id;
}
const m = (sim: Sim, id: number) => sim.world.get(id, ModuleC)!;

describe('berths', () => {
  it('two crew claim one bunk on different berths, a third is sent to another bed, and release frees the berth they held', () => {
    const sim = make();
    const b = put(sim, 'module.bunk', 2, 1);
    const single = put(sim, 'module.bed', 6, 1);
    const [a, c, d] = [crew(sim, 1, 1), crew(sim, 1, 2), crew(sim, 1, 3)];
    claimBed(sim, a, b);
    claimBed(sim, c, b);
    expect([berthOf(bunk, m(sim, b), a), berthOf(bunk, m(sim, b), c)]).toEqual([0, 1]);
    expect(berthHolders(bunk, m(sim, b))).toEqual([a, c]);
    expect(freeBerth(bunk, m(sim, b))).toBe(-1);
    expect(auditReservations(sim).problems).toEqual([]); // each berth has its own lifeline
    // The bunk is full: the next search goes to the single bed.
    const plan = findFreeBed(sim, homeShip(sim), { x: 1, y: 3 });
    expect(plan?.bed).toBe(single);
    claimBed(sim, d, single);
    // The lower berth is freed first: its next claimant takes it, the upper one is untouched.
    releaseBedClaim(sim, a);
    expect(berthOf(bunk, m(sim, b), c)).toBe(1);
    expect(freeBerth(bunk, m(sim, b))).toBe(0);
    expect(claimedBed(sim, c)).toBe(b);
  });

  it('ownership is per berth: two owners share a bunk, the third gets the next bed, and each keeps their own berth', () => {
    const sim = make();
    const b = put(sim, 'module.bunk', 2, 1);
    const single = put(sim, 'module.bed', 6, 1);
    const ids = [crew(sim, 1, 1), crew(sim, 1, 2), crew(sim, 1, 3)];
    bedOwnersSystem(sim);
    const owned = ids.map((id) => sim.world.get(id, BedOwnerC));
    expect(owned.map((o) => o?.bed)).toEqual([b, b, single]);
    expect([owned[0]?.berth ?? 0, owned[1]?.berth ?? 0]).toEqual([0, 1]);
    // The owner of the upper berth sleeps there even when the lower one is free: their own berth first.
    claimBed(sim, ids[1]!, b);
    expect(berthOf(bunk, m(sim, b), ids[1]!)).toBe(1);
    // The pass is stable: nothing changes on the next one.
    sim.tick += 20;
    bedOwnersSystem(sim);
    expect(ids.map((id) => sim.world.get(id, BedOwnerC))).toEqual(owned);
  });

  it('a one-berth bed saves as before: no extra fields', () => {
    const sim = make();
    const single = put(sim, 'module.bed', 6, 1);
    const a = crew(sim, 1, 1);
    claimBed(sim, a, single);
    expect(m(sim, single).reservedBy).toBe(a);
    expect(m(sim, single)).not.toHaveProperty('reservedMore');
  });
});

