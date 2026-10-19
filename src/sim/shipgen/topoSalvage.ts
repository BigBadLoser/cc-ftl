import type { Builder, Part } from './builder';
import { cargoSpec, dockSpec, engineSpec, reactorSpec, shuffle, type RoomSpec, type ShipPlan } from './plan';
import { runLen, strutE } from './topoParts';
import type { FactionDef } from './types';

/**
 * Salvage assemblies: sections of different build (each with its own corridor width, room depth and spacing) joined
 * by narrow offset connectors, a cockpit at the front, a tug block at the back, engines strapped on where they face
 * open space, and crates bolted on.
 */

interface Section {
  kind: string;
  specs: RoomSpec[];
}

/** Group the plan's rooms into salvaged sections by what they hold. */
function sections(b: Builder, plan: ShipPlan): Section[] {
  const out: Section[] = [];
  const guns = [...plan.weapons, ...plan.shields];
  const holds = [...plan.hangars, ...plan.cargo];
  const hab = [...plan.quarters, ...plan.support, ...(plan.core ? [plan.core] : [])];
  const extra = Math.max(0, plan.size - 1);
  // Bigger ships: split the groups into more sections.
  const chop = (kind: string, specs: RoomSpec[], parts: number): void => {
    const per = Math.ceil(specs.length / parts);
    for (let i = 0; i < specs.length; i += per) out.push({ kind, specs: specs.slice(i, i + per) });
  };
  chop('gundeck', guns, 1 + (extra > 1 ? 1 : 0));
  chop('freighter', holds, 1 + (extra > 0 ? 1 : 0));
  chop('habitat', hab, 1);
  shuffle(b.rng, out);
  return out.filter((s) => s.specs.length > 0);
}

/** Build one section west of nothing: its own corridor at (x, y) with rooms in its own style. Returns its corridor. */
function buildSection(b: Builder, s: Section, x: number, row: number): { corr: Part; parts: Part[] } | null {
  const cw = s.kind === 'freighter' ? 2 : s.kind === 'habitat' ? 1 : b.rng.int(1, 2);
  const gap = s.kind === 'gundeck' ? (): number => b.rng.int(0, 2) : undefined;
  const depth = s.kind === 'habitat' ? 3 : undefined;
  const oneSided = s.kind === 'gundeck' && b.rng.chance(0.4);
  const n: RoomSpec[] = [];
  const so: RoomSpec[] = [];
  for (const sp of s.specs) (oneSided || b.rng.chance(0.5) ? n : so).push(depth ? { ...sp, h: Math.max(sp.h, depth) } : sp);
  const len = Math.max(runLen(n, gap ? 2 : 0), runLen(so, gap ? 2 : 0), 4);
  const corr = b.place({ x, y: row - 1 - b.rng.int(0, cw - 1), w: len, h: cw + 2 }, 'hall');
  if (!corr) return null;
  const skew = (): number => b.rng.int(0, 1);
  const pn = b.strip(corr, 'n', n, corr.x + skew(), { ...(gap ? { gap } : {}) });
  const ps = b.strip(corr, 's', so, corr.x + skew(), { ...(gap ? { gap } : {}) });
  return { corr, parts: [...pn.parts, ...ps.parts] };
}

export function salvage(b: Builder, f: FactionDef, plan: ShipPlan): string | null {
  const [s0, s1] = f.architecture.strutLength;
  // Cockpit: the command room on its own, maybe a gun blister bolted to one side.
  const cockpit = b.room(plan.command, 0, 0);
  if (!cockpit) return null;
  const all: Part[] = [cockpit];
  let prev: Part = cockpit;
  const secs = sections(b, plan);
  const styles: string[] = [];
  for (const s of secs) {
    const row = b.rng.int(prev.y + 1, prev.y + prev.h - 2);
    const conn = strutE(b, prev, row, b.rng.int(s0, s1));
    if (!conn) return null;
    all.push(conn);
    const built = buildSection(b, s, conn.x + conn.w - 1, row);
    if (!built) return null;
    b.door(conn, built.corr);
    all.push(built.corr, ...built.parts);
    styles.push(s.kind);
    prev = built.corr;
  }
  // Tug block: a patched reactor room, the engine room behind it.
  const row = b.rng.int(prev.y + 1, prev.y + prev.h - 2);
  const conn = strutE(b, prev, row, b.rng.int(s0, s1));
  if (!conn) return null;
  const strapped = Math.min(plan.engines - 1, b.rng.int(0, plan.engines - 1));
  const tugEngines = plan.engines - strapped;
  const rs = reactorSpec(plan.reactors);
  const reactor = b.place({ x: conn.x + conn.w - 1, y: row - 1 - b.rng.int(0, rs.h - 1), w: rs.w + 2, h: rs.h + 2 }, 'reactor', rs);
  if (!reactor) return null;
  b.door(conn, reactor);
  const es = engineSpec(tugEngines, 'w');
  const er = b.place({ x: reactor.x + reactor.w - 1, y: reactor.y - b.rng.int(0, es.h - 2), w: es.w + 2, h: es.h + 2 }, 'engine', es);
  if (!er) return null;
  b.door(reactor, er);
  // Strapped-on engines: pods on outer walls whose east side faces open space.
  let strappedOk = 0;
  const hosts = all.filter((p) => p.role !== 'hall' && p.role !== 'bridge' && p.role !== 'dock');
  for (let i = 0; i < strapped; i++) {
    for (const host of shuffle(b.rng, [...hosts])) {
      const e = engineSpec(1, 'ns');
      const side = b.rng.chance(0.5) ? 'n' : 's';
      const x = host.x + host.w - 1 - (e.w + 1);
      const y = side === 'n' ? host.y - e.h - 1 : host.y + host.h - 1;
      const r = { x, y, w: e.w + 2, h: e.h + 2 };
      if (!b.fits(r) || !b.clearEast(r.x + r.w - 1, r.y + 1, r.y + r.h - 2)) continue;
      const p = b.place(r, 'engine', e);
      if (p && b.door(host, p)) { strappedOk++; break; }
    }
  }
  // Bolt-ons: a crate locker or two and the docking port on whatever outer wall takes them.
  const bolts = [dockSpec(), ...(b.rng.chance(0.6) ? [cargoSpec(2)] : [])];
  for (const spec of bolts) {
    for (const host of shuffle(b.rng, [...all])) {
      if (spec.role === 'dock' && host.role !== 'hall' && host.role !== 'cargo') continue;
      const side = b.rng.chance(0.5) ? 'n' : 's';
      const along = b.rng.int(0, Math.max(0, host.w - spec.w - 2));
      const r = side === 'n' ? { x: host.x + along, y: host.y - spec.h - 1, w: spec.w + 2, h: spec.h + 2 } : { x: host.x + along, y: host.y + host.h - 1, w: spec.w + 2, h: spec.h + 2 };
      if (!b.fits(r)) continue;
      const p = b.place(r, spec.role, spec);
      if (p && b.door(host, p)) break;
    }
  }
  return `salvage: cockpit+${styles.join('+')}+tug, ${strappedOk} strapped`;
}
