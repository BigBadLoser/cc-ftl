import { describe, expect, it } from 'vitest';
import { DraftedC, ItemStackC, JobC, NeedsC, Struct, TraitsC, VehicleC, type ContentRegistry, type Sim } from '../../sim';
import { content } from '../index';
import { AwayC, SiteRunC } from '../../sim/away/components';
import { SuitC } from '../../sim/eva/components';
import { boardCrew } from '../../sim/vehicles/lifecycle';
import { StagingC } from '../../sim/items/components';
import { stagedStacks, stagedUnits, stageAdd } from '../../sim/items/staging';
import { crateUnits, spillItems } from '../../sim/items/stacks';
import { shipGrid } from '../../sim/regions';
import { LOAD_CRATE_SEC } from '../../sim/tuning';
import { cargoCount } from '../../sim/vehicles/cargo';
import { crewOn, landed, play } from './awayFixture';
import { of } from './salvageEvaFixture';

/** The staging zone of an away site (#286 slice 3, docs/ARCHITECTURE.md "Staging"): the party gathers loot there, the shuttle loads it. */

const SCRAP = 'item.scrap_hull';
/** The game's content with a trait that makes a walker very slow (for a haul still under way when a trip leaves). */
const SLOW: ContentRegistry = {
  ...content,
  traits: { ...content.traits, 'trait.slowtest': { name: 'Slow', flavour: '', kind: 'tradeoff', weight: 0, rollable: false, short: '', effect: '', modifiers: [{ stat: 'moveSpeed', op: 'mul', value: 0.05 }] } },
};
const zoneOf = (sim: Sim, wreck: number): { x: number; y: number }[] => sim.world.get(wreck, StagingC)?.tiles ?? [];
const cargo = (sim: Sim, shuttle: number): number => cargoCount(sim.world.get(shuttle, VehicleC)!);
const phase = (sim: Sim, shuttle: number): string | undefined => sim.world.get(shuttle, SiteRunC)?.phase;

/** Loose loot on the wreck, on its floor tile farthest from the zone (not in it). */
function lootNearZone(sim: Sim, wreck: number, units: number): void {
  const g = shipGrid(sim, wreck)!;
  const zone = zoneOf(sim, wreck);
  let best = { x: 0, y: 0, d: -1 };
  for (let y = g.y0; y < g.y0 + g.height; y++) {
    for (let x = g.x0; x < g.x0 + g.width; x++) {
      if (g.get('struct', x, y) !== Struct.Floor || zone.some((t) => t.x === x && t.y === y)) continue;
      const d = Math.hypot(x - zone[0]!.x, y - zone[0]!.y);
      if (d > best.d) best = { x, y, d };
    }
  }
  spillItems(sim, wreck, best.x, best.y, SCRAP, units);
}

/**
 * The party landed, and the fixture's sealed hull holed beside the hatch spot (its wall corner by the shuttle comes down to floor), so the
 * floor inside is in reach from outside and the zone can be laid there.
 */
function staged(c?: ContentRegistry): ReturnType<typeof landed> {
  const l = landed(3, c);
  const g = shipGrid(l.sim, l.wreck)!;
  g.set('struct', g.x0 + 1, g.y0 + g.height - 3, Struct.Floor);
  g.set('struct', g.x0 + 1, g.y0 + g.height - 2, Struct.Floor);
  play(l.sim, 20 * 6, () => zoneOf(l.sim, l.wreck).length > 1);
  return l;
}

/** Hold every crew member at home (drafted): nobody there would take a seat. */
function holdHome(sim: Sim, home: number): void {
  for (const c of crewOn(sim, home)) sim.world.add(c, DraftedC, { target: null });
}

describe('away sites: the staging zone (#286 slice 3)', () => {
  it('the site keeps a zone of floor tiles beside the drop-off point, and the party hauls loose loot into it', () => {
    const { sim, wreck } = staged();
    const zone = zoneOf(sim, wreck);
    expect(zone.length).toBeGreaterThan(0);
    const grid = shipGrid(sim, wreck)!;
    for (const t of zone) expect(grid.get('ship', t.x, t.y)).toBe(wreck);
    lootNearZone(sim, wreck, 12);
    const all = play(sim, 20 * 120, (a) => of(a, 'item.hauled').some((e) => e.to === 'zone'));
    expect(of(all, 'item.hauled').filter((e) => e.ship === wreck).every((e) => e.to === 'zone')).toBe(true);
  });

  it('a full staging stack overflows to the next tile of the zone', () => {
    const { sim, wreck } = staged();
    const zone = zoneOf(sim, wreck);
    expect(zone.length).toBeGreaterThan(1);
    const max = sim.content.items[SCRAP]!.stackSize;
    expect(stageAdd(sim, wreck, SCRAP, max + 7)).toBe(max + 7);
    const counts = stagedStacks(sim, wreck).map((id) => sim.world.get(id, ItemStackC)!.count);
    expect(counts).toEqual([max, 7]);
    const second = sim.world.get(stagedStacks(sim, wreck)[1]!, ItemStackC)!;
    expect({ x: second.x, y: second.y }).toEqual(zone[1]);
  });

  it('while the shuttle is at the site it loads the zone into its hold one crate every LOAD_CRATE_SEC', () => {
    const { sim, home, wreck, shuttle } = staged();
    holdHome(sim, home);
    for (const c of crewOn(sim, wreck)) sim.world.get(c, NeedsC)!.rest = 100;
    const before = cargo(sim, shuttle);
    stageAdd(sim, wreck, SCRAP, 30);
    const crate = crateUnits(sim, SCRAP);
    // The first crate goes in within LOAD_CRATE_SEC (the loading clock runs from the shuttle's arrival), the next exactly that later.
    const step = Math.round(LOAD_CRATE_SEC * 20);
    play(sim, step + 1, () => cargo(sim, shuttle) > before);
    expect(phase(sim, shuttle)).toBe('stay');
    expect(cargo(sim, shuttle) - before).toBe(crate);
    play(sim, step - 1);
    expect(cargo(sim, shuttle) - before).toBe(crate);
    play(sim, 1);
    expect(cargo(sim, shuttle) - before).toBe(2 * crate);
    expect(stagedUnits(sim, wreck)).toBe(30 - 2 * crate);
  });

  it('staging goes on while the shuttle is away from the site', () => {
    const { sim, wreck, shuttle, party } = staged();
    const [tired] = party as [number];
    sim.world.get(tired, NeedsC)!.rest = 22; // a trip home of their own
    play(sim, 20 * 300, () => phase(sim, shuttle) === 'home');
    expect(phase(sim, shuttle)).toBe('home');
    for (const j of sim.world.query(JobC)) if (sim.world.get(j, JobC)!.kind === 'deconstruct') sim.world.destroyEntity(j); // free hands
    lootNearZone(sim, wreck, 10);
    const all = play(sim, 20 * 120, (a) => of(a, 'item.hauled').some((e) => e.to === 'zone') || phase(sim, shuttle) === 'stay');
    expect(of(all, 'item.hauled').filter((e) => e.to === 'zone').length).toBeGreaterThan(0);
    expect(phase(sim, shuttle)).not.toBe('stay'); // staged before the shuttle was back
  });

  it('no trip waits on a haul or drops it: a load on its way into the zone is delivered after the shuttle has left', () => {
    const { sim, wreck, shuttle, party } = staged(SLOW);
    lootNearZone(sim, wreck, 8);
    play(sim, 20 * 120, () => sim.world.query(JobC).some((j) => sim.world.get(j, JobC)!.haul?.phase === 'deliver'));
    const haul = sim.world.query(JobC).find((j) => sim.world.get(j, JobC)!.haul?.phase === 'deliver')!;
    expect(haul).toBeDefined();
    const hauler = sim.world.get(haul, JobC)!.reservedBy;
    sim.world.add(hauler, TraitsC, { ids: ['trait.slowtest'] }); // a long walk with the load: the trip falls due meanwhile
    // A trip falls due now (a passenger aboard at the end of a need: urgent) and leaves with the haul under way.
    const [other] = party.filter((c) => c !== hauler) as [number];
    sim.world.remove(other, SuitC);
    boardCrew(sim, other, shuttle);
    sim.world.get(other, AwayC)!.home = true;
    sim.world.get(other, NeedsC)!.hunger = 5;
    const all = play(sim, 20 * 300, (a) => of(a, 'away.departed').some((e) => e.home) && of(a, 'item.hauled').some((e) => e.to === 'zone' && e.crew === hauler));
    const left = all.findIndex((e) => e.type === 'away.departed' && e.home && e.vehicle === shuttle);
    const delivered = all.findIndex((e) => e.type === 'item.hauled' && e.to === 'zone' && e.crew === hauler);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(delivered).toBeGreaterThan(left); // the trip did not wait for it, and the load still got there
  });

  it('a batch trip waits until the shuttle has loaded what the zone holds', () => {
    const { sim, home, wreck, shuttle } = staged();
    holdHome(sim, home);
    stageAdd(sim, wreck, SCRAP, 30);
    sim.world.get(shuttle, SiteRunC)!.lastTrip = sim.tick - 20 * 301; // the trip timeout: a batch trigger once anyone waits aboard
    const party = crewOn(sim, wreck);
    sim.world.get(party[0]!, NeedsC)!.hunger = 34; // due home, not urgent
    const all = play(sim, 20 * 200, (a) => of(a, 'away.departed').some((e) => e.home));
    expect(of(all, 'away.departed').some((e) => e.home)).toBe(true);
    expect(stagedUnits(sim, wreck)).toBe(0);
    expect(cargo(sim, shuttle)).toBeGreaterThanOrEqual(30);
  });
});
