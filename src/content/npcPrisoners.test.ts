import { describe, expect, it } from 'vitest';
import { shipCrew } from '../sim/capture/control';
import { ShipC } from '../sim/combat/components';
import { CrewC, PositionC } from '../sim/crew/components';
import { surrender } from '../sim/fight/surrender';
import { AllegianceC, PrisonerC } from '../sim/fight/components';
import { isPlayersPrisoner } from '../sim/fight/relations';
import { engagements } from '../sim/galaxy/engagements';
import { ModuleC } from '../sim/modules/components';
import { accessTile, footprintTiles } from '../sim/modules/footprint';
import { footprintBlockedByCrew, placementError, removeModule, spawnModule } from '../sim/modules/spawn';
import { shipGrid, shipIdOf } from '../sim/regions';
import { Struct } from '../sim/structure';
import { deserialize, serialize } from '../sim/save';
import type { Sim } from '../sim/sim';
import { StasisWheelC } from '../sim/stasis/components';
import { pickWheel } from '../sim/stasis/jobs';
import { slabPlace } from '../sim/stasis/query';
import { TICK_HZ } from '../sim/time';
import { heldPrisoners, prisonerOffer } from '../sim/capture/offers';
import { fight, shipOf } from '../../test/support/content';
import { run } from '../../test/support/run';
import { content } from './index';

/**
 * NPC captors take prisoners into their own stasis wheel (#615): the prisoner path is generalised by who holds them (`Prisoner.holder`), so the taker
 * of a ship seals its beaten crew and carts them to a wheel with the same jobs and stasis loading the player's crew use. NPC hulls have no wheel
 * in normal play yet, so the tests place one.
 */

const WHEEL = 'module.stasis_wheel';

/** Furniture a wheel may displace: the test clears it to make room on a crowded hull. */
const FURNITURE = /^module\.(light|chair|bed|storage_locker|storage_rack|storage_pallet|mess_table)$/;

/**
 * Put a stasis wheel on `ship`, as near `near` as there is a 3x3 patch of floor holding nothing but furniture (removed) off every other module's access
 * tile, and one a walk from `near` reaches (`pickWheel`).
 */
function addWheel(sim: Sim, ship: number, near: { x: number; y: number }): number {
  const at = sim.world.get(ship, ShipC)!;
  const def = content.modules[WHEEL];
  const grid = shipGrid(sim, ship)!;
  const mods = sim.world.query(ModuleC).filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === ship);
  const defOf = (id: number): (typeof content.modules)[typeof WHEEL] => content.modules[sim.world.get(id, ModuleC)!.def as typeof WHEEL];
  const key = (t: { x: number; y: number }): string => `${t.x},${t.y}`;
  const access = new Set(mods.map((id) => {
    const m = sim.world.get(id, ModuleC)!;
    const a = accessTile(defOf(id), m.x, m.y, m.rot);
    return a ? key(a) : '';
  }));
  const spots: { x: number; y: number; rot: number; over: number[]; d: number }[] = [];
  for (let y = at.y; y < at.y + at.height; y++) {
    for (let x = at.x; x < at.x + at.width; x++) {
      for (const rot of [0, 1, 2, 3]) {
      const tiles = footprintTiles(def, x, y, rot);
      const mine = tiles.map(key);
      if (mine.some((t) => access.has(t)) || tiles.some((t) => grid.get('struct', t.x, t.y) !== Struct.Floor)) continue;
      const over = mods.filter((id) => {
        const m = sim.world.get(id, ModuleC)!;
        return footprintTiles(defOf(id), m.x, m.y, m.rot).some((t) => mine.includes(key(t)));
      });
      if (over.every((id) => FURNITURE.test(sim.world.get(id, ModuleC)!.def))) spots.push({ x, y, rot, over, d: Math.hypot(x - near.x, y - near.y) });
      }
    }
  }
  for (const s of spots.sort((a, b) => a.d - b.d)) {
    for (const id of s.over) removeModule(sim, id);
    if (placementError(sim, ship, WHEEL, s.x, s.y, s.rot) !== null || footprintBlockedByCrew(sim, ship, WHEEL, s.x, s.y, s.rot)) continue;
    const wheel = spawnModule(sim, WHEEL, s.x, s.y, s.rot);
    if (pickWheel(sim, ship, near)) return wheel;
    removeModule(sim, wheel);
  }
  throw new Error(`no room for a reachable wheel: ${spots.length} spots, near ${JSON.stringify(near)}, first ${JSON.stringify(spots.slice(0, 3))}`);
}

/** Raiders against traders, the trader (optionally with a wheel) beaten and taken: the sim just after the take, with the trader's crew and its id. */
function taken(wheel: boolean): { sim: Sim; trader: number; wheel: number; crew: number[] } {
  const { sim, fa, fb } = fight(['raiders', 'raider'], ['traders', 'trader'], { raiders: 10 });
  run(sim, 1);
  const trader = shipOf(fb);
  const crew = shipCrew(sim, trader);
  const w = wheel ? addWheel(sim, trader, sim.world.get(crew[0] as number, PositionC) as { x: number; y: number }) : 0;
  run(sim, 3 * TICK_HZ);
  sim.sector.inCombat = true;
  for (const c of crew) surrender(sim, c);
  run(sim, 2 * TICK_HZ, { until: (s) => engagements(s).length === 0 });
  expect(fa.ships.map((c) => c.ship)).toContain(trader);
  // The captor's prize crew: one of its own, aboard (the yield path takes a ship with no boarders on it; a boarding party, once it holds the bridge, stays aboard the same way).
  const own = sim.world.get(shipCrew(sim, shipOf(fa))[0] as number, AllegianceC)?.faction;
  const at = sim.world.get(crew[0] as number, PositionC) as { x: number; y: number };
  sim.enqueue({ type: 'debug.spawnCrew', ship: trader, x: at.x, y: at.y, role: 'role.crew', ...(own ? { faction: own } : {}) });
  run(sim, 1);
  return { sim, trader, wheel: w, crew };
}

const sealedIn = (sim: Sim, crew: number[]): number => crew.filter((c) => slabPlace(sim, c)?.kind === 'wheel').length;

describe('NPC captors and their prisoners', () => {
  it('a captor that took a ship with a wheel seals the beaten crew and stows them in it', () => {
    const { sim, wheel, crew } = taken(true);
    expect(crew.length).toBeGreaterThan(0);
    for (const c of crew) expect(sim.world.get(c, PrisonerC)).toMatchObject({ holder: 'raiders', from: 'traders' });
    run(sim, 60 * TICK_HZ, { until: (s) => sealedIn(s, crew) >= 2 });
    expect(sealedIn(sim, crew)).toBeGreaterThanOrEqual(2); // one prize crew member at a time: the rest are still to come
    for (const c of crew.filter((x) => slabPlace(sim, x))) expect(slabPlace(sim, c)).toMatchObject({ kind: 'wheel', wheel });
  });

  it('with no wheel the captives stay aboard the prize, unsealed', () => {
    const { sim, trader, crew } = taken(false);
    run(sim, 30 * TICK_HZ);
    for (const c of crew) {
      expect(sim.world.has(c, PrisonerC)).toBe(true);
      expect(slabPlace(sim, c)).toBeNull();
      expect(shipIdOf(sim, sim.world.get(c, PositionC))).toBe(trader);
    }
  });

  it('with every slot of its wheel taken the captives stay aboard too', () => {
    const { sim, wheel, trader, crew } = taken(true);
    (sim.world.get(wheel, StasisWheelC) as { slots: number[] }).slots.fill(1); // ten full slabs already
    run(sim, 30 * TICK_HZ);
    for (const c of crew) {
      expect(slabPlace(sim, c)).toBeNull();
      expect(shipIdOf(sim, sim.world.get(c, PositionC))).toBe(trader);
    }
  });

  it('are not the player\'s prisoners: no deals, no release, no seal mark, and a save round trip keeps who holds them', () => {
    const { sim, crew } = taken(true);
    const [c] = crew as [number];
    expect(isPlayersPrisoner(sim, c)).toBe(false);
    expect(heldPrisoners(sim)).toEqual([]); // the player's list
    expect(prisonerOffer(sim, 0, c)).toMatchObject({ ok: false, reason: 'notPrisoner' });
    sim.enqueue({ type: 'prisoner.release', crew: c });
    sim.enqueue({ type: 'prisoner.seal', crew: c, on: false });
    run(sim, 1);
    expect(sim.world.has(c, CrewC) && sim.world.has(c, PrisonerC)).toBe(true);
    run(sim, 60 * TICK_HZ, { until: (s) => sealedIn(s, crew) >= 1 });
    const copy = deserialize(serialize(sim), content);
    expect(copy.world.get(c, PrisonerC)).toMatchObject({ holder: 'raiders' });
    run(sim, 20 * TICK_HZ);
    run(copy, 20 * TICK_HZ);
    expect(serialize(copy)).toEqual(serialize(sim));
  });
});
