import { describe, expect, it } from 'vitest';
import { CrewC, ItemStackC, JobC, ModuleC, PositionC, StorageC, TICK_HZ, homeShip, newGame, placementError, shipGrid, siteIds, siteStatus, storageAdd, totalStock, type Sim } from '../../sim';
import { content } from '../index';

interface Rig { sim: Sim; ship: number; crate: number; crew: number[] }

/** A fresh game with `builders` crew able to build and a site spot for `def`; the first crate holds its whole cost. */
function rig(def: string, builders = 1, stocked = true): Rig & { at: { x: number; y: number } } {
  const sim = newGame(4, content);
  const ship = homeShip(sim);
  const g = shipGrid(sim, ship)!;
  const crate = [...sim.world.query(StorageC)].sort((a, b) => a - b)[0]!;
  for (const id of sim.world.query(StorageC)) (sim.world.get(id, StorageC)!).stacks = [];
  if (stocked) for (const q of content.modules[def as 'module.pod_bay'].cost) storageAdd(sim, crate, q.item, q.count);
  const crew = [...sim.world.query(CrewC)];
  crew.slice(builders).forEach((c) => sim.enqueue({ type: 'crew.setPriority', id: c, category: 'construction', value: 0 }));
  let at: { x: number; y: number } | null = null;
  for (let y = g.y0 + g.height - 1; y >= g.y0 && !at; y--) for (let x = g.x0 + g.width - 1; x >= g.x0 && !at; x--) if (!placementError(sim, ship, def, x, y, 0)) at = { x, y };
  return { sim, ship, crate, crew, at: at! };
}
const run = (sim: Sim, ticks: number) => { for (let i = 0; i < ticks; i++) { sim.step(); sim.events.drain(); } };
const place = (r: Rig & { at: { x: number; y: number } }, def: string) => {
  r.sim.enqueue({ type: 'job.buildModule', ship: r.ship, def, x: r.at.x, y: r.at.y, rot: 0 });
  run(r.sim, 1);
  return siteIds(r.sim)[0]!;
};

describe('construction sites', () => {
  it('reports progress and time left that shrink as the builder works', () => {
    const r = rig('module.pod_bay');
    const id = place(r, 'module.pod_bay');
    const first = siteStatus(r.sim, id)!;
    expect(first.frac).toBe(0);
    expect(first.materials.map((m) => m.need)).toEqual([28, 12, 4]);
    let last = first;
    let prog = 0;
    for (let i = 0; i < 20 * 60 && siteIds(r.sim).length; i++) {
      run(r.sim, 1);
      const s = siteStatus(r.sim, id);
      if (s && s.frac > 0.5) { last = s; break; }
    }
    prog = last.frac;
    expect(prog).toBeGreaterThan(0.5);
    expect(last.builders.length).toBe(1);
    // seconds left = ticks left / (speed * tick rate): about half of the 18 s of work
    expect(last.etaSec).toBeGreaterThan(5);
    expect(last.etaSec).toBeLessThan(11);
    expect(last.materials.every((m) => m.missing === 0)).toBe(true);
  });

  it('says which material is missing when the stock is short', () => {
    const r = rig('module.pod_bay', 1, false);
    storageAdd(r.sim, r.crate, 'item.metal', 20);
    storageAdd(r.sim, r.crate, 'item.electronics', 12);
    storageAdd(r.sim, r.crate, 'item.polymer', 4);
    const id = place(r, 'module.pod_bay');
    run(r.sim, TICK_HZ * 60);
    const s = siteStatus(r.sim, id)!;
    expect(s.block).toEqual({ kind: 'noStock', item: 'item.metal', count: 8 });
    expect(s.frac).toBe(0);
  });

  it('is blocked with no builder who may construct', () => {
    const r = rig('module.pod_bay', 0);
    const id = place(r, 'module.pod_bay');
    expect(siteStatus(r.sim, id)!.block).toEqual({ kind: 'noBuilder' });
  });

  it('cancel drops the delivered materials back on the floor', () => {
    const r = rig('module.pod_bay');
    const id = place(r, 'module.pod_bay');
    for (let i = 0; i < 20 * 40 && !siteStatus(r.sim, id)!.materials.every((m) => m.missing === 0); i++) run(r.sim, 1);
    expect(siteStatus(r.sim, id)!.materials.every((m) => m.missing === 0)).toBe(true);
    const before = ['item.metal', 'item.electronics', 'item.polymer'].map((i) => totalStock(r.sim, i));
    expect(before).toEqual([0, 0, 0]);
    r.sim.enqueue({ type: 'job.cancel', ship: r.ship, x: r.at.x, y: r.at.y });
    run(r.sim, 2);
    expect(r.sim.world.get(id, JobC)).toBeUndefined();
    expect(['item.metal', 'item.electronics', 'item.polymer'].map((i) => totalStock(r.sim, i))).toEqual([28, 12, 4]);
    expect([...r.sim.world.query(ItemStackC)].length).toBeGreaterThan(0);
  });

  it('a lone builder finishes a pod bay in about 30 s of game time, hauling included', () => {
    const r = rig('module.pod_bay');
    place(r, 'module.pod_bay');
    let ticks = 0;
    while (siteIds(r.sim).length && ticks < TICK_HZ * 120) { run(r.sim, 1); ticks++; }
    const sec = ticks / TICK_HZ;
    expect(sec).toBeGreaterThan(15);
    expect(sec).toBeLessThan(35);
    expect([...r.sim.world.query(ModuleC)].some((m) => r.sim.world.get(m, ModuleC)?.def === 'module.pod_bay')).toBe(true);
  });

  it('an idle crew member standing on the site steps off so the module can finish', () => {
    const r = rig('module.pod_bay', 4);
    const id = place(r, 'module.pod_bay');
    const idler = r.crew[3]!;
    const p = r.sim.world.get(idler, PositionC)!;
    r.sim.enqueue({ type: 'crew.setPriority', id: idler, category: 'construction', value: 0 });
    p.x = p.toX = r.at.x + 1;
    p.y = p.toY = r.at.y + 1;
    let ticks = 0;
    while (r.sim.world.get(id, JobC) && ticks < TICK_HZ * 80) { run(r.sim, 1); ticks++; }
    expect(r.sim.world.get(id, JobC)).toBeUndefined();
    expect(ticks / TICK_HZ).toBeLessThan(40);
  });

  it('a chained haul counts as in transit for every stop and drops the delivered bundle at the next', () => {
    const r = rig('module.pod_bay');
    for (const q of content.modules['module.pod_bay'].cost) storageAdd(r.sim, r.crate, q.item, q.count);
    // both sites exist before the first planning pass, so one trip can serve both
    const [fw, fh] = content.modules['module.pod_bay'].footprint;
    const g = shipGrid(r.sim, r.ship)!;
    let at2: { x: number; y: number } | null = null;
    for (let y = g.y0 + g.height - 1; y >= g.y0 && !at2; y--) {
      for (let x = g.x0 + g.width - 1; x >= g.x0 && !at2; x--) {
        const apart = x + fw <= r.at.x || x >= r.at.x + fw || y + fh <= r.at.y || y >= r.at.y + fh;
        if (apart && !placementError(r.sim, r.ship, 'module.pod_bay', x, y, 0)) at2 = { x, y };
      }
    }
    for (const at of [r.at, at2!]) r.sim.enqueue({ type: 'job.buildModule', ship: r.ship, def: 'module.pod_bay', x: at.x, y: at.y, rot: 0 });
    run(r.sim, 1);
    expect(siteIds(r.sim).length).toBe(2);
    let chained = 0;
    let advanced = 0;
    const dst = new Map<number, number>();
    for (let i = 0; i < TICK_HZ * 60 && siteIds(r.sim).length === 2; i++) {
      run(r.sim, 1);
      for (const jid of r.sim.world.query(JobC)) {
        const h = r.sim.world.get(jid, JobC)!.haul;
        if (!h) continue;
        if (dst.has(jid) && dst.get(jid) !== h.dst.id) { advanced++; expect(h.extra).toBeUndefined(); }
        dst.set(jid, h.dst.id);
        for (const t of h.then ?? []) {
          chained++;
          const s = siteStatus(r.sim, t.job)!;
          expect(s.block?.kind).not.toBe('noStock');
          expect(s.materials.find((m) => m.item === h.item)!.inTransit).toBeGreaterThan(0);
        }
      }
    }
    expect(chained).toBeGreaterThan(0);
    expect(advanced).toBeGreaterThan(0);
  });
});
