import { rotatedSize } from '../modules/footprint';
import { at, modTiles, put } from './ruinGrid';
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
  const speed = 0.03 + c.rng.next() * 0.08;
  for (const t of modTiles(c, i)) put(c, t.x, t.y, '.');
  // Out along the line until it is clear of the wreck and of every container torn off before it (a tile apart).
  let off = 2 + Math.max(w, h) / 2 + c.rng.next() * 4;
  let x = x0 + Math.cos(a) * off, y = y0 + Math.sin(a) * off;
  for (let n = 0; n < 40 && !clear(c, x, y, w, h); n++) {
    off += 1;
    x = x0 + Math.cos(a) * off;
    y = y0 + Math.sin(a) * off;
  }
  c.meta.containers.push({
    def: m.def, rot: m.rot, clamp: m.clamp ?? 'n', fate: 'torn', x: round2(x), y: round2(y),
    vx: round2(Math.cos(a) * speed), vy: round2(Math.sin(a) * speed), spin: round2((c.rng.next() - 0.5) * 0.2),
    hp: round2(0.3 + c.rng.next() * 0.6),
    // Torn loose, the shell mostly held: some stock lost through the ripped clamp side.
    stock: (m.stock ?? []).map((s) => ({ item: s.item, count: Math.floor(s.count * (0.4 + c.rng.next() * 0.6)) })).filter((s) => s.count > 0),
  });
}

export function stockStage(c: RuinCtx): void {
  // Scrapper boxes were second-hand to begin with: breached more often, and the sealed ones are often patch jobs.
  const scrap = c.origin.includes('scrapper');
  for (const r of c.meta.modules) {
    const m = c.modules[r.index];
    if (!m || !c.defs[m.def]?.container) continue;
    let fate: RuinContainer['fate'] = 'sealed';
    if (r.state === 'destroyed') fate = 'destroyed';
    else if (r.state === 'damaged' && c.rng.chance(scrap ? 0.85 : 0.6)) fate = 'breached';
    else if (scrap && r.state === 'intact' && c.rng.chance(0.3)) fate = 'breached';
    const patched = scrap && fate === 'sealed' && c.rng.chance(0.4);
    if (patched) { r.hp = Math.min(r.hp, 0.45); r.state = 'damaged'; r.salvage = 'repair'; r.art = `${c.defs[m.def]?.asset ?? m.def}.patched`; }
    if (fate === 'destroyed') delete m.stock;
    else if (fate === 'breached') {
      // A holed shell reads as damaged (under half hp) whatever the systems roll gave it.
      r.hp = Math.min(r.hp, 0.45);
      if (r.state === 'intact') { r.state = 'damaged'; r.salvage = 'repair'; }
      const left = (m.stock ?? []).map((s) => ({ item: s.item, count: Math.floor(s.count * c.rng.next() * 0.5) })).filter((s) => s.count > 0);
      if (left.length > 0) m.stock = left; else delete m.stock;
      r.art = `${c.defs[m.def]?.asset ?? m.def}.damaged`;
    }
    if (fate === 'destroyed') r.art = `${c.defs[m.def]?.asset ?? m.def}.destroyed`;
    const [w, h] = rotatedSize(c.defs[m.def] as NonNullable<(typeof c.defs)[string]>, m.rot);
    c.meta.containers.push({
      def: m.def, rot: m.rot, clamp: m.clamp ?? 'n', fate, index: r.index, x: m.x + w / 2, y: m.y + h / 2, vx: 0, vy: 0, spin: 0, hp: r.hp, ...(patched ? { patched } : {}),
      stock: (m.stock ?? []).map((s) => ({ ...s })),
    });
  }
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** True if a box `w` x `h` centred on (x, y), plus a tile all round, touches no structure and no other torn container. */
function clear(c: RuinCtx, x: number, y: number, w: number, h: number): boolean {
  const x0 = x - w / 2 - 1, x1 = x + w / 2 + 1, y0 = y - h / 2 - 1, y1 = y + h / 2 + 1;
  for (let ty = Math.floor(y0); ty < Math.ceil(y1); ty++) for (let tx = Math.floor(x0); tx < Math.ceil(x1); tx++) if (at(c, tx, ty) !== '.') return false;
  return c.meta.containers.every((k) => {
    if (k.fate !== 'torn') return true;
    const [kw, kh] = rotatedSize(c.defs[k.def] as NonNullable<(typeof c.defs)[string]>, k.rot);
    return x1 <= k.x - kw / 2 || x0 >= k.x + kw / 2 || y1 <= k.y - kh / 2 || y0 >= k.y + kh / 2;
  });
}
