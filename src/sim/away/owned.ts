import { CrewC, DeadC, DraftedC, JobC, PositionC, type Crew } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { releaseAirHolds } from '../eva/airLedger';
import { AirHoldsC, EvaFloatC, SuitC, type AirHold } from '../eva/components';
import { destroyJob } from '../items/stacks';
import { AirlockC } from '../modules/airlock';
import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';
import { AwayC, AwaySiteC, SiteRunC, type Away, type SitePhase } from './components';

/**
 * Away-owned transient state (docs/ARCHITECTURE.md "Away sites and the air drive", "Ownership", #286). Every hold or flag the away code
 * puts on crew, jobs or shuttles has an owner, and ends one way: this sweep releases it once its owner (the reason it was set for) is
 * gone. Code elsewhere sets these and moves them on (a passenger sent out loses `ride`, a lift gives a fresh `AwayC`), but never has to
 * remember to clear them: a run that ends, a party member who dies or comes aboard, a trip that leaves or is called off, all leave the
 * clean-up here. `awayLeaks` is the same rules as a pure audit: a tick after the sweep it must find nothing (tests check it every tick).
 *
 * | State | Owner | Released when |
 * | `AwayC` (party, pickup requester) | the run of `vehicle`, else the site | dead, or neither the run nor the site's claim stands |
 * | `Drafted.away` (the hold for a float) | the float (`EvaFloatC`) | no float: the draft ends, or stays the player's if they gave an order |
 * | `Suit.vehicle` of a party member | the drift out of the hatch | landed (on a tile, not floating) |
 * | `Away.landing` | the drift out | landed |
 * | `Away.lastCall` | the run's 'depart' phase | the phase ends, or they are aboard |
 * | `Away.ride` of a member still out | the run's 'depart' phase | the phase ends (aboard, a rider keeps it until sent out again) |
 * | `Away.pickup` | a shuttle answering their request | they are aboard (or floating in) |
 * | `Away.downAt` | their being down out on the site | back on their feet, or aboard |
 * | `Away.home` of a member out | coming aboard | out on a tile and not floating |
 * | `SiteRun.returnBy`, `AirHoldsC` | the trip away from the site | the run is beside the site again, or gone |
 * | an `AirHold` | a party member out, a source | they left the party or came aboard; the source is gone |
 * | `SiteRun.boardedAt`, `held` | the stop at home ('board') | the stop ends |
 * | a `passage` job | the run serving its site | the run no longer serves it |
 */

/** Phases in which the shuttle is beside its site (or its pickup): the trip-away state has no use. */
const BESIDE: ReadonlySet<SitePhase> = new Set(['stay', 'depart', 'recall', 'pickup']);

/** True while the crew member stands on a tile, not floating to or from a shuttle (landed, on the site or anywhere). */
const onTile = (sim: Sim, c: number): boolean => sim.world.has(c, PositionC) && !sim.world.has(c, EvaFloatC);
const aboard = (sim: Sim, c: number): boolean => !sim.world.has(c, PositionC);
const phaseOf = (sim: Sim, a: Away): SitePhase | undefined => sim.world.get(a.vehicle, SiteRunC)?.phase;

/** One kind of owned state: what holds it now with its owner gone, and how it is let go. */
interface Rule {
  name: string;
  find(sim: Sim): number[];
  release(sim: Sim, id: number): void;
}

/** A rule over party members' `AwayC` flags. */
function flag(name: keyof Away, stale: (sim: Sim, c: number, a: Away) => boolean): Rule {
  return {
    name: `away.${name}`,
    find: (sim) => sim.world.query(AwayC).filter((c) => {
      const a = sim.world.get(c, AwayC)!;
      return a[name] !== undefined && stale(sim, c, a);
    }),
    release: (sim, c) => {
      const a = sim.world.get(c, AwayC);
      if (a) delete a[name];
    },
  };
}

/** True if the hold no longer has a reason: its crew member left the owner's party or came aboard, or its source is gone. */
function staleHold(sim: Sim, owner: number, h: AirHold): boolean {
  const a = sim.world.get(h.crew, AwayC);
  const source = h.kind === 'airlock' ? sim.world.has(h.id, AirlockC) : sim.world.has(h.id, VehicleC);
  return !a || a.vehicle !== owner || sim.world.has(h.crew, DeadC) || aboard(sim, h.crew) || !source;
}

const RULES: readonly Rule[] = [
  {
    name: 'away',
    find: (sim) => sim.world.query(AwayC).filter((c) => {
      const a = sim.world.get(c, AwayC)!;
      return sim.world.has(c, DeadC) || (!sim.world.get(a.vehicle, SiteRunC) && sim.world.get(a.site, AwaySiteC)?.vehicle !== a.vehicle);
    }),
    release: (sim, c) => sim.world.remove(c, AwayC),
  },
  {
    name: 'drafted.away',
    find: (sim) => sim.world.query(DraftedC).filter((c) => !!sim.world.get(c, DraftedC)!.away && !sim.world.has(c, EvaFloatC)),
    release: (sim, c) => {
      const d = sim.world.get(c, DraftedC)!;
      // A draft the player gave an order to meanwhile is theirs (Codex 4449530810): only the away mark goes.
      if (d.target !== null) return void delete d.away;
      sim.world.remove(c, DraftedC);
      const crew = sim.world.get(c, CrewC) as Crew | undefined;
      if (crew?.activity === 'drafted') crew.activity = 'idle';
    },
  },
  {
    name: 'suit.vehicle',
    find: (sim) => sim.world.query(AwayC, SuitC).filter((c) => sim.world.get(c, SuitC)!.vehicle !== undefined && onTile(sim, c)),
    release: (sim, c) => void delete sim.world.get(c, SuitC)!.vehicle,
  },
  flag('landing', (sim, c) => onTile(sim, c)),
  flag('lastCall', (sim, c, a) => aboard(sim, c) || phaseOf(sim, a) !== 'depart'),
  flag('ride', (sim, c, a) => onTile(sim, c) && phaseOf(sim, a) !== 'depart'),
  flag('pickup', (sim, c) => !onTile(sim, c)),
  flag('downAt', (sim, c) => aboard(sim, c) || !isIncapacitated(sim, c)),
  flag('home', (sim, c) => onTile(sim, c)),
  {
    name: 'siteRun.returnBy',
    find: (sim) => sim.world.query(SiteRunC).filter((id) => {
      const r = sim.world.get(id, SiteRunC)!;
      return r.returnBy !== undefined && BESIDE.has(r.phase);
    }),
    release: (sim, id) => void delete sim.world.get(id, SiteRunC)!.returnBy,
  },
  {
    name: 'siteRun.board',
    find: (sim) => sim.world.query(SiteRunC).filter((id) => {
      const r = sim.world.get(id, SiteRunC)!;
      return r.phase !== 'board' && (r.boardedAt !== undefined || r.held !== undefined);
    }),
    release: (sim, id) => {
      const r = sim.world.get(id, SiteRunC)!;
      delete r.boardedAt;
      delete r.held;
    },
  },
  {
    name: 'airHolds',
    find: (sim) => sim.world.query(AirHoldsC).filter((id) => {
      const r = sim.world.get(id, SiteRunC);
      return !r || BESIDE.has(r.phase) || sim.world.get(id, AirHoldsC)!.holds.some((h) => staleHold(sim, id, h));
    }),
    release: (sim, id) => {
      const r = sim.world.get(id, SiteRunC);
      releaseAirHolds(sim, id, (h) => !!r && !BESIDE.has(r.phase) && !staleHold(sim, id, h));
    },
  },
  {
    name: 'passage',
    find: (sim) => sim.world.query(JobC).filter((j) => {
      const job = sim.world.get(j, JobC)!;
      return job.kind === 'passage' && sim.world.get(job.target ?? 0, SiteRunC)?.site !== job.site;
    }),
    release: (sim, j) => destroyJob(sim, j),
  },
];

/** Release every piece of away-owned state whose owner is gone (in rule order: party membership first, as the other rules read it). */
export function releaseOwned(sim: Sim): void {
  for (const rule of RULES) for (const id of [...rule.find(sim)].sort((a, b) => a - b)) rule.release(sim, id);
}

/** The audit: each piece of away-owned state that has outlived its owner, as `rule:entity` (pure; empty right after `releaseOwned`). */
export function awayLeaks(sim: Sim): string[] {
  return RULES.flatMap((rule) => rule.find(sim).map((id) => `${rule.name}:${id}`)).sort();
}
