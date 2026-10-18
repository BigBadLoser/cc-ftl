import { Builder, type Part } from './builder';
import { chunkWidth, doorRows } from './canvas';
import { Composer } from './compose';
import { cargoSpec, dockSpec, engineSpec, reactorSpec, shuffle, type RoomSpec, type ShipPlan } from './plan';
import type { Rng } from '../rng';
import { hall, nose, pairUp, pickNose, stern } from './topoNavy';
import { runLen } from './topoParts';
import type { FactionDef, HullFamilyDef, SectionKind } from './types';

/**
 * Navy composer: the ship is a sequence of standard functional SECTIONS (command, batteries, core, habitat, cargo,
 * hangar, drive), each a mirrored assembly whose own contents set its depth and width, joined by frame bulkheads.
 * The hull outline is the sum of the sections; the family sets proportions; the order is chosen by constraints with
 * seeded slack, and revised when a section does not fit its depth or a bulkhead port finds no counterpart.
 */

interface SectionPlan {
  kind: SectionKind;
  top: RoomSpec[];
  bottom: RoomSpec[];
  sponson: boolean;
  /** Enclosed sections (hangar deck, citadel): compartments on the axis, passages around them. */
  centre?: RoomSpec[];
  /** Enclosed sections: rooms outboard of the passages, port and starboard. */
  extra?: [RoomSpec[], RoomSpec[]];
}

const LETTER: Record<SectionKind, string> = { command: 'C', battery: 'B', core: 'K', habitat: 'H', cargo: 'Q', hangar: 'G', drive: 'D' };

/** Split a plan into sections; rooms are paired port/starboard. */
function sectionsOf(rng: Rng, fam: HullFamilyDef, plan: ShipPlan): SectionPlan[] {
  const out: SectionPlan[] = [];
  const [gn, gs] = pairUp(plan.weapons);
  for (let i = 0; i < gn.length;) {
    const cols = rng.int(fam.batteryCols[0], fam.batteryCols[1]);
    out.push({ kind: 'battery', top: gn.slice(i, i + cols), bottom: gs.slice(i, i + cols), sponson: rng.chance(fam.sponsonChance) });
    i += cols;
  }
  const group = (kind: SectionKind, specs: RoomSpec[]): void => {
    const [n, s] = pairUp(specs);
    const per = Math.max(1, fam.sectionRooms);
    const parts = Math.ceil(n.length / per);
    for (let k = 0; k < parts; k++) {
      const a = Math.floor((k * n.length) / parts);
      const z = Math.floor(((k + 1) * n.length) / parts);
      out.push({ kind, top: n.slice(a, z), bottom: s.slice(a, z), sponson: false });
    }
  };
  const core = [...(plan.core ? [plan.core] : []), ...plan.shields];
  const crew = [...plan.quarters, ...plan.support, dockSpec(), dockSpec()];
  if (fam.merge) group('core', [...core, ...crew, ...plan.cargo]);
  else {
    if (fam.citadel && core.length > 0) out.push({ kind: 'core', top: [], bottom: [], sponson: false, centre: core, extra: pairUp(crew.splice(0, 4)) });
    else group('core', core);
    if (plan.hangars.length === 0) {
      group('habitat', crew);
      group('cargo', plan.cargo);
    }
  }
  // Carriers: the hangar deck is the broad heart of the ship, holds and crew decks outboard of it.
  if (plan.hangars.length > 0) out.push({ kind: 'hangar', top: [], bottom: [], sponson: false, centre: plan.hangars, extra: pairUp(fam.merge ? [] : [...crew, ...plan.cargo]) });
  return out;
}

/** Order the middle sections: hangars amidships, batteries spread fore and aft, core between them, stores aft. */
function arrange(rng: Rng, mid: SectionPlan[]): SectionPlan[] {
  let best = mid;
  let bestScore = -Infinity;
  for (let t = 0; t < 16; t++) {
    const o = shuffle(rng, [...mid]);
    let score = rng.next() * 2;
    const n = o.length;
    o.forEach((s, i) => {
      const pos = n > 1 ? i / (n - 1) : 0.5;
      if (s.kind === 'hangar') score -= Math.abs(pos - 0.5) * 6;
      if (s.kind === 'cargo' || s.kind === 'habitat') score += pos * 2;
      if (s.kind === 'battery' && o[i + 1]?.kind === 'battery') score -= 2.5;
      if (s.kind === 'core' && o[i - 1]?.kind === 'battery' && o[i + 1]?.kind === 'battery') score += 2;
    });
    if (o[0]?.kind === 'battery') score += 1.5;
    if (score > bestScore) { bestScore = score; best = o; }
  }
  return best;
}

type Built = { asm: number; east: number; hall: Part } | string;

/** A band section: a 2-wide hall on the axis, its rooms side by side above and (mirrored) below it. */
function band(c: Composer, sp: SectionPlan, x0: number, depth: number): Built {
  const b = c.b;
  const all = [...sp.top, ...sp.bottom];
  if (!sp.sponson && all.some((s) => s.h > depth)) return `shallow:${sp.kind}`;
  const inner = (s: RoomSpec): RoomSpec => (sp.sponson ? hall(s.w, 1) : { ...s, h: depth });
  const top = sp.top.map(inner);
  const bottom = sp.bottom.map(inner);
  const W = Math.max(3, runLen(top) - 2, runLen(bottom) - 2);
  const id = c.begin(sp.kind, `${sp.kind} ${sp.top.map((s) => s.role[0]).join('')}`, 'human');
  const h = b.place({ x: x0, y: -2, w: W + 2, h: 4 }, 'hall');
  if (!h) return 'clash';
  const nt = b.strip(h, 'n', top, x0);
  const ns = b.strip(h, 's', bottom, x0);
  c.end();
  if (sp.sponson) {
    // Guns in sponsons grafted outboard of a gun gallery, mirrored.
    for (const [side, parts, specs] of [['n', nt.parts, sp.top], ['s', ns.parts, sp.bottom]] as const) {
      parts.forEach((p, i) => {
        const spec = specs[i];
        if (!spec) return;
        const sid = c.begin('sponson', `sponson ${spec.role[0]}`, 'human');
        b.attach(p, side, spec, 0);
        c.end();
        c.join('graft', id, sid);
      });
    }
  }
  return { asm: id, east: x0 + W + 1, hall: h };
}

/**
 * Enclosed section (hangar deck, citadel): compartments on the axis, passages above and below them, transverse halls
 * at both ends (the bulkhead ports stay on the axis rows), rooms outboard of the passages.
 */
function enclosed(c: Composer, sp: SectionPlan, x0: number, depth: number): Built {
  const b = c.b;
  const centre = [...(sp.centre ?? [])];
  let hc = Math.max(2, ...centre.map((s) => s.h));
  if (hc % 2 === 1) hc++;
  const [n, s] = sp.extra ?? [[], []];
  // The deck runs as long as its outboard rooms; spare length on the axis becomes a stores bay.
  let L = Math.max(runLen(centre), runLen(n), runLen(s));
  if (L - runLen(centre) === 1) L += 2;
  if (L > runLen(centre)) centre.push({ ...cargoSpec(2), w: L - runLen(centre) - 1, h: hc });
  const top = -hc / 2 - 3;
  const id = c.begin(sp.kind, `${sp.kind} ${centre.map((s) => s.role[0]).join('')}`, 'human');
  const tw = b.place({ x: x0, y: top, w: 3, h: hc + 6 }, 'hall');
  const pt = b.place({ x: x0 + 2, y: top, w: L, h: 3 }, 'hall');
  const pb = b.place({ x: x0 + 2, y: hc / 2, w: L, h: 3 }, 'hall');
  if (!tw || !pt || !pb) return 'clash';
  b.door(tw, pt);
  b.door(tw, pb);
  let x = x0 + 2;
  for (const s of centre) {
    const p = b.place({ x, y: -hc / 2 - 1, w: s.w + 2, h: hc + 2 }, s.role, { ...s, h: hc });
    if (p) { b.door(pt, p); b.door(pb, p); }
    x += s.w + 1;
  }
  const te = b.place({ x: x0 + 2 + L - 1, y: top, w: 3, h: hc + 6 }, 'hall');
  if (!te) return 'clash';
  b.door(pt, te);
  b.door(pb, te);
  b.strip(pt, 'n', n.map((r) => ({ ...r, h: Math.max(r.h, depth) })), x0 + 2);
  b.strip(pb, 's', s.map((r) => ({ ...r, h: Math.max(r.h, depth) })), x0 + 2);
  c.end();
  return { asm: id, east: te.x + 2, hall: te };
}

/** Compose a navy ship of the family. Returns the composer (holding the builder) and a profile, or null. */
export function composeNavy(rng: Rng, f: FactionDef, fam: HullFamilyDef, plan: ShipPlan): { c: Composer; profile: string; revisions: number } | null {
  const b = new Builder(rng, -1);
  const front = pickNose(b, f, plan);
  const secs = sectionsOf(rng, fam, plan);
  const depth: Partial<Record<SectionKind, number>> = {};
  for (const k of Object.keys(fam.depth) as SectionKind[]) {
    const r = fam.depth[k] as readonly [number, number];
    depth[k] = rng.int(r[0], r[1]);
  }
  let order = arrange(rng, secs);
  for (let rev = 0; rev < 8; rev++) {
    b.reset();
    b.axis2 = -1;
    const c = new Composer(b);
    const fail = (why: string): void => {
      if (why.startsWith('shallow:')) { const k = why.slice(8) as SectionKind; depth[k] = (depth[k] ?? 3) + 1; } else order = arrange(rng, secs);
    };
    const noseId = c.begin('command', 'command', 'human');
    if (!nose(b, front, 0)) return null;
    const dr = doorRows(front.c, 'last');
    c.end({ x: -(chunkWidth(front.c) - 1), y: -1 - (dr[0] ?? 0), w: chunkWidth(front.c), h: front.c.rows.length });
    let prev = noseId;
    let x = 0;
    let prevHall: Part | null = null;
    let why = '';
    const profile = ['C'];
    for (const sp of order) {
      const d = depth[sp.kind] ?? 3;
      const r = sp.centre ? enclosed(c, sp, x, d) : band(c, sp, x, d);
      if (typeof r === 'string') { why = r; break; }
      if (!c.bulkhead(prev, r.asm, x, [-1, 0], 'human')) { why = 'port'; break; }
      profile.push(`${LETTER[sp.kind]}${sp.centre ? `e${sp.centre.length}` : d}${sp.sponson ? 's' : ''}`);
      prev = r.asm;
      prevHall = r.hall;
      x = r.east;
    }
    if (why) { fail(why); continue; }
    const drive = rng.pick(fam.drive);
    if (drive === 'pods') {
      // Engine pods flush with the stern: engines outboard in the last column, reactors inboard, mirrored.
      // A power section (reactors, a narrow neck) ahead of the engine pods.
      const k = Math.ceil(plan.engines / 2);
      const r = Math.ceil(plan.reactors / 2);
      const power: SectionPlan = { kind: 'drive', top: [reactorSpec(r)], bottom: [reactorSpec(r)], sponson: false };
      const pw = band(c, power, x, 3);
      if (typeof pw === 'string' || !c.bulkhead(prev, pw.asm, x, [-1, 0], 'human')) { fail('port'); continue; }
      const pods: SectionPlan = { kind: 'drive', top: [engineSpec(k, 'ns')], bottom: [engineSpec(k, 'ns')], sponson: false };
      const built = band(c, pods, pw.east, 4 * k + 1);
      if (typeof built === 'string' || !c.bulkhead(pw.asm, built.asm, pw.east, [-1, 0], 'human')) { fail('port'); continue; }
      profile.push(`R${2 * r}`, `P${2 * k}`);
      return { c, profile: profile.join(' '), revisions: rev };
    }
    const driveId = c.begin('drive', `drive ${plan.engines}E ${plan.reactors}R`, 'human');
    const st = stern(b, x, prevHall ? [prevHall] : [], plan.engines, plan.reactors);
    c.end();
    if (st.length === 0) { fail('clash'); continue; }
    if (!c.bulkhead(prev, driveId, x, [-1, 0], 'human')) { fail('port'); continue; }
    profile.push(`D${plan.engines}`);
    return { c, profile: profile.join(' '), revisions: rev };
  }
  return null;
}
