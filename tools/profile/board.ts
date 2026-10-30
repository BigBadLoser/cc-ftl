/**
 * Board recorder (docs/CREW_AI.md section 7.4): serialise what a job scheduler sees at one tick as plain JSON, so a candidate scheduler can be replayed
 * offline on identical input next to the reference. Read-only over the sim.
 *
 * Contents: per ship the rectangle and four nav layers (struct, jam, thin air, blocked-by-module, run-length encoded over the ship's rectangle, row
 * major), every job, every crew member (position, activity, priorities, assignment, flags, suit), the suit stock of every airlock and the reservations
 * (jobs by crew, beds by crew). The `meta` (scenario, seed, tick) also lets the exact state be rebuilt by running the scenario to that tick.
 */
import {
  AssignmentC, BedClaimC, CarryingC, CrewC, DraftedC, EatC, JobC, ModuleC, PathC, PositionC, PrioritiesC, ShipC, shipGrid, shipIds, shipIdOf,
  EVA_THIN_AIR_BELOW, freeSuits, airlockSuits, hasSuitAir, isSuited, type Sim,
} from '../../src/sim';
import { AirlockC } from '../../src/sim/modules/airlock';
import { walkInfo, OPEN_KEY } from '../../src/sim/modules/walk';
import { isIncapacitated } from '../../src/sim/crew/helpers';
import { isOffDuty } from '../../src/sim/fight/relations';

export interface BoardMeta {
  scenario: string;
  seed: number;
  tick: number;
  note?: string;
}

/** Run-length encoding as a flat `[value, count, value, count, ...]` array. */
export function rle(values: ArrayLike<number>): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i] as number;
    if (out.length && out[out.length - 2] === v) out[out.length - 1]!++;
    else out.push(v, 1);
  }
  return out;
}

export function unrle(pairs: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < pairs.length; i += 2) for (let k = 0; k < (pairs[i + 1] as number); k++) out.push(pairs[i] as number);
  return out;
}

export interface Board {
  format: 'cc-ftl-board/1';
  meta: BoardMeta;
  ships: {
    id: number; faction: string; x: number; y: number; w: number; h: number;
    /** Row-major over (x, y, w, h), run-length encoded (see `unrle`). thin: o2 below EVA_THIN_AIR_BELOW; blocked: a solid module covers the tile. */
    layers: { struct: number[]; jam: number[]; thin: number[]; blocked: number[] };
  }[];
  thinAirBelow: number;
  jobs: ({ id: number; ship: number } & Record<string, unknown>)[];
  crew: {
    id: number; name: string; role: string; ship: number; x: number; y: number; toX: number; toY: number; activity: string; pathLen: number;
    priorities: Record<string, number>; job: number; drafted: boolean; incapacitated: boolean; offDuty: boolean; suited: boolean; suitAir: boolean; eating: boolean; bed: number; carrying: string | null;
  }[];
  airlocks: { id: number; ship: number; suits: number; freeSuits: number }[];
  reservations: { jobs: { job: number; crew: number }[]; beds: { module: number; crew: number }[] };
}

export function dumpBoard(sim: Sim, meta: BoardMeta): Board {
  const ships: Board['ships'] = [];
  for (const id of shipIds(sim)) {
    const s = sim.world.get(id, ShipC)!;
    const g = shipGrid(sim, id);
    if (!g?.has('struct')) continue;
    const struct = g.load('struct');
    const jam = g.has('jam') ? g.load('jam') : new Float64Array(struct.length);
    const o2 = g.has('o2') ? g.load('o2') : null;
    const mods = g.has('module') ? g.load('module') : null;
    const thin = new Uint8Array(struct.length), blocked = new Uint8Array(struct.length);
    const info = new Map<number, ReturnType<typeof walkInfo>>();
    for (let i = 0; i < struct.length; i++) {
      if (o2 && (o2[i] as number) < EVA_THIN_AIR_BELOW) thin[i] = 1;
      const m = mods ? (mods[i] as number) : 0;
      if (!m) continue;
      let w = info.get(m);
      if (!w) info.set(m, (w = walkInfo(sim, m)));
      const x = g.x0 + (i % g.width), y = g.y0 + Math.floor(i / g.width);
      if (w.solid && !w.open.has(y * OPEN_KEY + x)) blocked[i] = 1;
    }
    ships.push({ id, faction: s.faction, x: g.x0, y: g.y0, w: g.width, h: g.height, layers: { struct: rle(struct), jam: rle(jam), thin: rle(thin), blocked: rle(blocked) } });
  }
  const jobs: Board['jobs'] = [];
  const reservedJobs: { job: number; crew: number }[] = [];
  for (const id of [...sim.world.query(JobC)].sort((a, b) => a - b)) {
    const j = sim.world.get(id, JobC)!;
    jobs.push({ id, ship: shipIdOf(sim, j), ...JSON.parse(JSON.stringify(j)) });
    if (j.reservedBy) reservedJobs.push({ job: id, crew: j.reservedBy });
  }
  const crew: Board['crew'] = [];
  for (const id of [...sim.world.query(CrewC, PositionC, PrioritiesC, PathC)].sort((a, b) => a - b)) {
    const c = sim.world.get(id, CrewC)!, p = sim.world.get(id, PositionC)!;
    const carry = sim.world.get(id, CarryingC);
    crew.push({
      id, name: c.name, role: c.role, ship: shipIdOf(sim, p), x: p.x, y: p.y, toX: p.toX, toY: p.toY, activity: c.activity, pathLen: sim.world.get(id, PathC)!.steps.length,
      priorities: { ...sim.world.get(id, PrioritiesC)! }, job: sim.world.get(id, AssignmentC)?.jobId ?? 0, drafted: sim.world.has(id, DraftedC),
      incapacitated: isIncapacitated(sim, id), offDuty: isOffDuty(sim, id), suited: isSuited(sim, id), suitAir: hasSuitAir(sim, id), eating: sim.world.has(id, EatC),
      bed: sim.world.get(id, BedClaimC)?.bed ?? 0, carrying: carry ? `${carry.item}x${carry.count}` : null,
    });
  }
  const airlocks: Board['airlocks'] = [];
  for (const id of [...sim.world.query(AirlockC)].sort((a, b) => a - b)) {
    const m = sim.world.get(id, ModuleC);
    const g = m && shipGrid(sim, shipIdOf(sim, m));
    airlocks.push({ id, ship: g ? g.id : 0, suits: airlockSuits(sim, id), freeSuits: freeSuits(sim, id) });
  }
  const beds: { module: number; crew: number }[] = [];
  for (const id of [...sim.world.query(ModuleC)].sort((a, b) => a - b)) {
    const m = sim.world.get(id, ModuleC)!;
    if (m.reservedBy) beds.push({ module: id, crew: m.reservedBy });
  }
  return { format: 'cc-ftl-board/1', meta, ships, thinAirBelow: EVA_THIN_AIR_BELOW, jobs, crew, airlocks, reservations: { jobs: reservedJobs, beds } };
}
