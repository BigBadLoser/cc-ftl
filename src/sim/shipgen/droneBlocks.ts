import type { Block } from './arranger';
import { blockFrom, hallBlock, localBuilder, type LocalPort } from './blocks';
import type { ModuleDef } from '../registry';
import { cargoSpec, type RoomSpec, type ShipPlan } from './plan';
import type { Rng } from '../rng';
import type { AccessKind, RoomRole } from './types';

/**
 * Drone vocabulary: dense machinery, not rooms. Sealed pods whose interior is exactly their module's footprint
 * (serviced from outside), robot crawlways one tile wide, solid beams that carry pods, a small processing room.
 */

const sides = (w: number, h: number, access: AccessKind, multi = false): LocalPort[] => [
  { id: 'n', side: 'n', x: 1, y: 0, len: w - 2, access, multi }, { id: 's', side: 's', x: 1, y: h - 1, len: w - 2, access, multi },
  { id: 'w', side: 'w', x: 0, y: 1, len: h - 2, access, multi }, { id: 'e', side: 'e', x: w - 1, y: 1, len: h - 2, access, multi },
];

/** A sealed pod: walls around exactly the footprint of what it holds. */
export function sealedPod(rng: Rng, kind: string, spec: RoomSpec): Block {
  const b = localBuilder(rng);
  b.place({ x: 0, y: 0, w: spec.w + 2, h: spec.h + 2 }, spec.role, { ...spec, sealed: true });
  return blockFrom(b, kind, `${kind}`, 'external', sides(spec.w + 2, spec.h + 2, 'external'));
}

/** Pod specs for everything the plan mounts outside: guns, PD, shields, reactor banks, engines. */
export function podSpecs(plan: ShipPlan, defs: Record<string, ModuleDef>): { mounts: RoomSpec[]; reactors: RoomSpec[]; engines: RoomSpec[] } {
  const fp = (id: string): [number, number] => (defs[id]?.footprint ?? [2, 2]) as [number, number];
  const pod = (role: RoomRole, id: string): RoomSpec => { const [w, h] = fp(id); return { role, mods: [id], w, h, sealed: true }; };
  const mounts = [
    ...plan.weapons.flatMap((s) => s.mods.map((m) => pod('weapons', m))),
    ...plan.pd.flatMap((s) => s.mods.map((m) => pod('weapons', m))),
    ...plan.shields.flatMap((s) => s.mods.map((m) => pod('shields', m))),
  ];
  const reactors: RoomSpec[] = [];
  for (let left = plan.reactors; left > 0; left -= 2) {
    const k = Math.min(2, left);
    reactors.push({ role: 'reactor', mods: Array<string>(k).fill('module.reactor'), w: 2 * k, h: 2, sealed: true });
  }
  const engines = Array.from({ length: plan.engines }, () => ({ role: 'engine' as const, mods: ['module.engine'], w: 4, h: 4, sealed: true }));
  return { mounts, reactors, engines };
}

/** A robot crawlway: one tile wide; its long sides carry several mounts. */
export function crawl(rng: Rng, len: number, horiz: boolean): Block {
  const blk = hallBlock(rng, len, 1, horiz, 'robot');
  for (const p of blk.ports) if (horiz ? p.side === 'n' || p.side === 's' : p.side === 'e' || p.side === 'w') p.multi = true;
  return { ...blk, kind: 'crawl', label: 'crawl' };
}

/** The processing room: AI core and the weapons console, entered by crawlway. */
export function coreRoom(rng: Rng, plan: ShipPlan, w = 5, h = 3): Block {
  const b = localBuilder(rng);
  const spec = { ...plan.command, w, h };
  const y = h % 2 === 0 ? -h / 2 - 1 : -2 - (h - 3) / 2;
  b.place({ x: 0, y, w: w + 2, h: h + 2 }, 'core', spec);
  return blockFrom(b, 'core', 'core', 'robot', sides(w + 2, h + 2, 'robot').map((p) => ({ ...p, y: p.y + y })));
}

/** A small store reached from a crawlway. */
export function storeRoom(rng: Rng, n: number): Block {
  const b = localBuilder(rng);
  const spec = { ...cargoSpec(n), w: Math.max(2, n), h: 2 };
  b.place({ x: 0, y: 0, w: spec.w + 2, h: 4 }, 'cargo', spec);
  return blockFrom(b, 'cargo', 'store', 'robot', sides(spec.w + 2, 4, 'robot'));
}

/** A solid beam (truss) `len` long and `thick` wide; mounts ride on its long sides, its ends join structure. */
export function beam(rng: Rng, len: number, thick: number, horiz: boolean): Block {
  const b = localBuilder(rng);
  const w = horiz ? len : thick;
  const h = horiz ? thick : len;
  b.cv.stamp(Array.from({ length: h }, () => '='.repeat(w)), 0, 0, 'beam');
  const ports: LocalPort[] = horiz
    ? [
      { id: 'w', side: 'w', x: 0, y: 0, len: thick, access: 'external' }, { id: 'e', side: 'e', x: w - 1, y: 0, len: thick, access: 'external' },
      { id: 'n', side: 'n', x: 0, y: 0, len, access: 'external', multi: true }, { id: 's', side: 's', x: 0, y: h - 1, len, access: 'external', multi: true },
    ]
    : [
      { id: 'n', side: 'n', x: 0, y: 0, len: thick, access: 'external' }, { id: 's', side: 's', x: 0, y: h - 1, len: thick, access: 'external' },
      { id: 'w', side: 'w', x: 0, y: 0, len, access: 'external', multi: true }, { id: 'e', side: 'e', x: w - 1, y: 0, len, access: 'external', multi: true },
    ];
  return blockFrom(b, 'beam', 'beam', 'external', ports);
}
