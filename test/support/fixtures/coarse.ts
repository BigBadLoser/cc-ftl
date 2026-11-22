/**
 * The coarse tier's pace, measured on the map a player really has: a walker explores outward with the real lazy frontier (`ensureAround`, one chunk ring
 * per arrival) while coarse ticks run, so the generated map grows as it would in play. Shared by the fast guard and the slow sweep.
 */
import { stepCoarse } from '../../../src/sim/galaxy/coarse';
import { sectorOwners } from '../../../src/sim/galaxy/control';
import { nodesWithin } from '../../../src/sim/galaxy/graph';
import { ensureAround, galaxyIndex, START_NODE } from '../../../src/sim/galaxy/state';
import { FLEET_AREA_HOPS } from '../../../src/sim/galaxy/tuning';
import { COARSE_TURNS } from '../../../src/sim/galaxy/tuningCoarse';
import { newGame } from '../../../src/sim/newGame';
import type { Sim } from '../../../src/sim/sim';
import { content } from '../../../src/content';

export interface Pace {
  /** Generated sectors at the end of the run. */
  sectors: number;
  /** Flips per 100 coarse ticks inside the player's region (the sectors with a node within FLEET_AREA_HOPS of where the player is), after the opening ticks. */
  region: number;
  /** Flips per 100 coarse ticks galaxy-wide over the same ticks. */
  galaxy: number;
  /** Ticks where the player's region saw two or more flips at once: a player looking twice would see two changes nearby. */
  doubles: number;
  /** Share of all flips that handed a sector back to the faction it had lost it to within RETAKE_TICKS ticks (ping-pong). */
  retakes: number;
}

/** A retake within this many coarse ticks of the flip it undoes is ping-pong. */
export const RETAKE_TICKS = 20;
/** Jumps the walking player makes per coarse tick (a turn is a jump, a coarse tick is 8 turns), and the ticks left out at the start (the opening land grab). */
export const JUMPS_PER_TICK = COARSE_TURNS;
export const OPENING_TICKS = 25;

/** Walks outward: each call jumps along the shortest way to the generated node farthest from the start, growing the frontier as it goes. */
class Walker {
  readonly route = [START_NODE];
  constructor(readonly sim: Sim) {
    ensureAround(sim, START_NODE);
  }

  get at(): string {
    return this.route[this.route.length - 1] as string;
  }

  jump(count: number): void {
    const { sim } = this;
    const home = galaxyIndex(sim.galaxy).nodes.get(START_NODE) as NonNullable<ReturnType<ReturnType<typeof galaxyIndex>['nodes']['get']>>;
    const far = (id: string): number => {
      const n = galaxyIndex(sim.galaxy).nodes.get(id) as typeof home;
      return Math.hypot(n.x - home.x, n.y - home.y);
    };
    for (let left = count; left > 0; ) {
      const index = galaxyIndex(sim.galaxy);
      const prev = new Map<string, string>([[this.at, '']]);
      for (let ring = [this.at]; ring.length; ) {
        const next: string[] = [];
        for (const id of ring) {
          for (const e of index.adjacent.get(id) ?? []) {
            const o = e.a === id ? e.b : e.a;
            if (prev.has(o)) continue;
            prev.set(o, id);
            next.push(o);
          }
        }
        ring = next.sort();
      }
      const goal = [...prev.keys()].sort((a, b) => far(b) - far(a) || (a < b ? -1 : 1))[0] as string;
      if (goal === this.at) return;
      const way: string[] = [];
      for (let at = goal; at !== this.at; at = prev.get(at) as string) way.unshift(at);
      for (const id of way.slice(0, left)) {
        this.route.push(id);
        ensureAround(sim, id);
        left--;
      }
    }
  }
}

/** A new game with the player at the start, exploring: `jumps` jumps out before any coarse tick (what a player has after the first session). */
export function exploredWorld(seed: number, jumps: number): { sim: Sim; walker: Walker } {
  const sim = newGame(seed, content);
  const walker = new Walker(sim);
  walker.jump(jumps);
  return { sim, walker };
}

/**
 * Play `ticks` coarse ticks: each one the player makes JUMPS_PER_TICK more jumps outward, then the tick runs (no fleets: the pressure is the fronts' own).
 * Counts flips after OPENING_TICKS, in the player's region and galaxy-wide.
 */
export function measurePace(sim: Sim, walker: Walker, ticks: number): Pace {
  let prev = sectorOwners(sim);
  const last = new Map<string, { tick: number; from: string | null }>();
  let all = 0;
  let near = 0;
  let doubles = 0;
  let flips = 0;
  let retakes = 0;
  for (let n = 1; n <= ticks; n++) {
    walker.jump(JUMPS_PER_TICK);
    sim.galaxy.current = walker.at;
    sim.galaxy.turn = n * COARSE_TURNS;
    stepCoarse(sim, sim.galaxy.turn);
    const index = galaxyIndex(sim.galaxy);
    const area = nodesWithin(sim, walker.at, FLEET_AREA_HOPS);
    const region = new Set([...index.sectors.values()].filter((s) => s.nodes.some((id) => area.has(id))).map((s) => s.id));
    const now = sectorOwners(sim);
    const changed = [...now].filter(([id, o]) => prev.has(id) && prev.get(id) !== o).map(([id]) => id);
    for (const id of changed) {
      const l = last.get(id);
      flips++;
      if (l && n - l.tick <= RETAKE_TICKS && now.get(id) === l.from) retakes++;
      last.set(id, { tick: n, from: prev.get(id) ?? null });
    }
    if (n > OPENING_TICKS) {
      all += changed.length;
      const k = changed.filter((id) => region.has(id)).length;
      near += k;
      if (k > 1) doubles++;
    }
    prev = now;
  }
  const per100 = (x: number): number => Math.round((x / (ticks - OPENING_TICKS)) * 1000) / 10;
  return { sectors: prev.size, region: per100(near), galaxy: per100(all), doubles, retakes: flips ? Math.round((retakes / flips) * 100) / 100 : 0 };
}
