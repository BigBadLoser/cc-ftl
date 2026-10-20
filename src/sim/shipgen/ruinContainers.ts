import { rotatedSize } from '../modules/footprint';
import { modTiles, put } from './ruinGrid';
import type { RuinContainer, RuinCtx } from './ruinTypes';

/**
 * Containers in a derelict are their own pieces. `tearStage` runs first: some are torn off the frame and drift near
 * the wreck (their tiles leave the hull; they come out in `meta.containers` as bodies the spawn path creates).
 * `stockStage` runs after the systems stage has rolled every survivor's hp: destroyed ones lost their stock, damaged
 * ones may be breached (stock spilled into space, some or all), the rest stayed sealed and full.
 * Coordinates are ship-local; a torn container's x, y is its centre (it may lie outside the template's rectangle).
 */
export function tearStage(c: RuinCtx): void {
  const combat = c.meta.cause === 'combat';
  const pTear = combat ? 0.1 + 0.35 * c.intensity : 0.05 + 0.25 * c.intensity;
  const keep: boolean[] = c.modules.map(() => true);
  c.modules.forEach((m, i) => {
    if (!c.defs[m.def]?.container || !c.rng.chance(pTear)) return;
    tearOff(c, i);
    keep[i] = false;
  });
  c.modules = c.modules.filter((_, i) => keep[i]);
}

/**
 * Tear template module `i` (a container) off the hull: its tiles become space and it is recorded as a torn body
 * drifting a few tiles out from where it hung. The caller drops it from `c.modules`. A container cut off by a shear
 * (`structureStage`) comes out the same way, not lost.
 */
export function tearOff(c: RuinCtx, i: number): void {
  const m = c.modules[i];
  const def = m && c.defs[m.def];
  if (!m || !def?.container) return;
  const [w, h] = rotatedSize(def, m.rot);
  const x0 = m.x + w / 2, y0 = m.y + h / 2;
  // Pushed off along the line from the wreck's centre, a few tiles clear of where it hung, still drifting slowly.
  const a = Math.atan2(y0 - c.height / 2, x0 - c.width / 2) + (c.rng.next() - 0.5) * 0.9;
  const off = 2 + Math.max(w, h) / 2 + c.rng.next() * 5;
  const speed = 0.03 + c.rng.next() * 0.08;
  for (const t of modTiles(c, i)) put(c, t.x, t.y, '.');
  c.meta.containers.push({
    def: m.def, rot: m.rot, fate: 'torn', x: round2(x0 + Math.cos(a) * off), y: round2(y0 + Math.sin(a) * off),
    vx: round2(Math.cos(a) * speed), vy: round2(Math.sin(a) * speed), spin: round2((c.rng.next() - 0.5) * 0.2),
    hp: round2(0.3 + c.rng.next() * 0.6),
    // Torn loose, the shell mostly held: some stock lost through the ripped clamp side.
    stock: (m.stock ?? []).map((s) => ({ item: s.item, count: Math.floor(s.count * (0.4 + c.rng.next() * 0.6)) })).filter((s) => s.count > 0),
  });
}

export function stockStage(c: RuinCtx): void {
  for (const r of c.meta.modules) {
    const m = c.modules[r.index];
    if (!m || !c.defs[m.def]?.container) continue;
    let fate: RuinContainer['fate'] = 'sealed';
    if (r.state === 'destroyed') fate = 'destroyed';
    else if (r.state === 'damaged' && c.rng.chance(0.6)) fate = 'breached';
    if (fate === 'destroyed') delete m.stock;
    else if (fate === 'breached') {
      const left = (m.stock ?? []).map((s) => ({ item: s.item, count: Math.floor(s.count * c.rng.next() * 0.5) })).filter((s) => s.count > 0);
      if (left.length > 0) m.stock = left; else delete m.stock;
      r.art = `${c.defs[m.def]?.asset ?? m.def}.damaged`;
    }
    if (fate === 'destroyed') r.art = `${c.defs[m.def]?.asset ?? m.def}.destroyed`;
    const [w, h] = rotatedSize(c.defs[m.def] as NonNullable<(typeof c.defs)[string]>, m.rot);
    c.meta.containers.push({
      def: m.def, rot: m.rot, fate, index: r.index, x: m.x + w / 2, y: m.y + h / 2, vx: 0, vy: 0, spin: 0, hp: r.hp,
      stock: (m.stock ?? []).map((s) => ({ ...s })),
    });
  }
}

const round2 = (v: number): number => Math.round(v * 100) / 100;
