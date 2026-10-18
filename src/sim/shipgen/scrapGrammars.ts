import { mirrorBlock, type Block, type Side } from './arranger';
import { hallBlock } from './blocks';
import { Builder } from './builder';
import { storeRoom } from './droneBlocks';
import { podBlock } from './navyBlocks';
import { jobs, no, type Ctx } from './navyKit';
import { cargoSpec, weaponSpec, type RoomSpec } from './plan';
import { droneCluster, freighterHold, habitat, miningTug, navyBattery, navyBow, navyDrive } from './scrapBlocks';
import { pickNose } from './topoNavy';
import type { FactionDef, ScrapGrammar } from './types';

/**
 * Scrapper grammars: ships welded together from salvaged donor sections on the shared 2D arranger. A big anchor
 * donor, others grafted wall to wall on any face (a short improvised tube only when nothing fits flush), drives
 * where their engines face open space, extra engines strapped on, crates bolted to whatever wall is free.
 */

const flip = (b: Block, side: Side): Block => (side === 's' ? mirrorBlock(b) : b);
const OPP: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' };

/** Graft `child` onto one of `hosts` on one of `sides`: flush first, then through a short scrap tube. */
function graft(c: Ctx, hosts: number[], child: Block, sides: Side[], label: string, flipForSouth = false): number | null {
  for (const tube of [false, true]) {
    for (const h of hosts) {
      for (const side of sides) {
        const blk = flipForSouth ? flip(child, side) : child;
        if (!blk.ports.some((p) => p.side === OPP[side])) continue;
        if (!tube) {
          const id = c.A.attach(h, blk, { side, align: 'any', kind: 'graft' });
          if (id !== null) { c.parts.push(label); return id; }
          continue;
        }
        const t = hallBlock(c.rng, c.rng.int(1, 3), c.rng.int(1, 2), side === 'e' || side === 'w', 'human');
        const tid = c.A.attach(h, { ...t, donor: 'scrap', label: 'scrap: tube' }, { side, align: 'any', kind: 'graft' });
        if (tid === null) continue;
        const id = c.A.attach(tid, blk, { side, align: 'mid', kind: 'graft' });
        if (id !== null) { c.parts.push(`${label} (tube)`); return id; }
      }
    }
  }
  return null;
}

/** Strap extra engines on free outer walls whose east side is open; bolt crates on. */
function improvise(c: Ctx, engines: number, crates: number): boolean {
  const ids = [...Array(c.A.placed.length).keys()];
  for (let k = 0; k < engines; k++) {
    let ok = false;
    for (const id of ids.reverse()) {
      for (const side of ['n', 's'] as const) {
        const pod = side === 'n' ? podBlock(c.rng, 1) : mirrorBlock(podBlock(c.rng, 1));
        if (c.A.attach(id, { ...pod, donor: 'scrap', label: 'scrap: strapped engine' }, { side, align: 'end', kind: 'graft', doors: 1 }) !== null) { ok = true; break; }
      }
      if (ok) break;
    }
    if (!ok) return no(c, 'strapped engine');
    c.parts.push('strapped engine');
  }
  for (let k = 0; k < crates; k++) {
    const side = c.rng.pick(['n', 's'] as const);
    const crate = { ...flip(storeRoom(c.rng, 2), side === 'n' ? 'n' : 's'), donor: 'scrap', label: 'scrap: crates' };
    for (const id of [...Array(c.A.placed.length).keys()].sort(() => 0)) if (c.A.attach(id, crate, { side, align: 'any', kind: 'graft', doors: 1 }) !== null) { c.parts.push('crates'); break; }
  }
  return true;
}

interface Donors {
  hold: Block;
  hab: Block;
  guns: Block | null;
  battery: Block | null;
  bow: Block | null;
  drive: Block;
  tug: Block | null;
  strapped: number;
}

/** Cut the donors for this ship from the plan: who carries the bridge, guns, crew, stores, engines. */
function donors(c: Ctx, f: FactionDef): Donors | null {
  const j = jobs(c.plan);
  const withBow = c.rng.chance(0.6);
  const bow = withBow ? navyBow(c.rng, pickNose(new Builder(c.rng), f, c.plan)) : null;
  const mounts = c.plan.weapons.flatMap((s) => s.mods);
  // Drone pods are sealed, so their interior is exactly the mount's footprint; navy rooms keep a walkway.
  const droneGuns = mounts.filter((_, i) => i % 2 === 0).map((m): RoomSpec => {
    const [w, h] = (c.defs[m]?.footprint ?? [2, 2]) as [number, number];
    return { role: 'weapons', mods: [m], w, h, sealed: true };
  });
  const navyGuns = mounts.filter((_, i) => i % 2 === 1).map((m) => weaponSpec(c.defs, [m]));
  const crates = j.stores.reduce((t, r) => t + r.mods.length, 0);
  const hold = freighterHold(c.rng, c.plan.hangars, Math.max(4, crates), j.core);
  const crew = j.crew.filter((r) => r.role !== 'dock');
  const docks = j.crew.filter((r) => r.role === 'dock');
  const hi = crew.findIndex((r) => r.role !== 'quarters');
  const hub = crew.splice(hi >= 0 ? hi : 0, 1)[0] ?? c.plan.command;
  const top = [...(withBow || hub === c.plan.command ? [] : [c.plan.command]), ...crew.filter((_, i) => i % 2 === 0), ...docks.slice(0, 1)];
  const hab = habitat(c.rng, hub, top, [...crew.filter((_, i) => i % 2 === 1), ...docks.slice(1)]);
  // A third builder's work is always aboard: the mining tug comes along when no drone guns do.
  const useTug = droneGuns.length === 0 || (c.plan.engines >= 2 && c.rng.chance(0.6));
  const strapped = Math.max(0, c.plan.engines - 1 - (useTug ? 1 : 0));
  const drive = navyDrive(c.rng, 1, c.plan.reactors);
  const tug = useTug ? miningTug(c.rng, cargoSpec(2)) : null;
  const cluster = droneGuns.length > 0 ? droneCluster(c.rng, droneGuns) : null;
  const battery = navyGuns.length > 0 ? navyBattery(c.rng, navyGuns) : null;
  if (!hold || !hab || !drive) return null;
  return { hold, hab, guns: cluster, battery, bow, drive, tug, strapped: c.plan.engines > 1 ? strapped : 0 };
}

/** Heap: a freighter hold at the heart, the other donors welded on around it wherever they fit. */
function heap(c: Ctx, f: FactionDef): boolean {
  const d = donors(c, f);
  if (!d) return no(c, 'donors');
  const root = c.A.placeRoot(d.hold);
  c.parts.push('hold');
  if (graft(c, [root], d.drive, ['e'], 'navy drive') === null) return no(c, 'drive');
  if (d.bow && graft(c, [root], d.bow, ['w'], 'navy bow') === null) return no(c, 'bow');
  const habSide = c.rng.pick(['n', 's'] as const);
  const hab = graft(c, [root], d.hab, [habSide, OPP[habSide]], 'habitat');
  if (hab === null) return no(c, 'habitat');
  const all = (): number[] => [...Array(c.A.placed.length).keys()];
  if (d.guns && graft(c, [root, hab, ...all()], d.guns, ['n', 's'], 'drone guns', true) === null) return no(c, 'drone guns');
  if (d.battery && graft(c, [hab, root, ...all()], d.battery, ['w', 'e', 'n', 's'], 'navy battery') === null) return no(c, 'battery');
  if (d.tug && graft(c, [hab, ...all()], d.tug, ['e', 'n', 's'], 'mining tug') === null) return no(c, 'tug');
  return improvise(c, d.strapped, c.rng.int(1, 3));
}

/** Raft: two big donors welded side by side lengthways (hold and habitat), drives on both, the rest on the edges. */
function raft(c: Ctx, f: FactionDef): boolean {
  const d = donors(c, f);
  if (!d) return no(c, 'donors');
  const root = c.A.placeRoot(d.hold);
  c.parts.push('hold');
  const hab = c.A.attach(root, d.hab, { side: 'n', align: c.rng.pick(['start', 'end', 'any'] as const), kind: 'graft' });
  if (hab === null) return no(c, 'raft weld');
  c.parts.push('habitat (welded)');
  if (graft(c, [root], d.drive, ['e'], 'navy drive') === null) return no(c, 'drive');
  if (d.tug && graft(c, [hab], d.tug, ['e'], 'mining tug') === null && graft(c, [hab, root], d.tug, ['n', 's'], 'mining tug') === null) return no(c, 'tug');
  const all = (): number[] => [...Array(c.A.placed.length).keys()];
  if (d.bow && graft(c, [root, hab], d.bow, ['w'], 'navy bow') === null) return no(c, 'bow');
  if (d.guns && graft(c, [hab, root, ...all()], d.guns, ['n', 's'], 'drone guns', true) === null) return no(c, 'drone guns');
  if (d.battery && graft(c, [root, ...all()], d.battery, ['s', 'w', 'n', 'e'], 'navy battery') === null) return no(c, 'battery');
  return improvise(c, d.strapped, c.rng.int(1, 3));
}

export const SCRAP_GRAMMARS: Record<ScrapGrammar, (c: Ctx, f: FactionDef) => boolean> = { heap, raft };
