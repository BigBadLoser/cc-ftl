import { mirrorBlock, type Block, type Side } from './arranger';
import { station, tower } from './civilBlocks';
import { civil, shuffle } from './civilKit';
import { dockBlock } from './navyBlocks';
import { no, type Ctx } from './navyKit';
import type { RoomSpec } from './plan';
import { fullRooms, placeRoot, reactorOf, roomsOf, reactorRooms } from './stationKit';
import { crossStation, spineStation } from './stationShapes';

/**
 * Line and branch station layouts:
 *   spine  a long spine with pods on stubs both sides (mining, depots)
 *   cross  four arms from a core, docks at the arm ends
 *   tree   modules (quad stations and towers) grown branch-wise from a core, airlocks hung off the branches
 */

function spine(c: Ctx): boolean {
  const o = { stubs: c.rng.pick([0.3, 0.6, 0.9]), reach: c.rng.int(2, 5) };
  c.parts.push(`stubs ${o.stubs}/${o.reach}`);
  return placeRoot(c, civil(spineStation(c.rng, c.plan.command, fullRooms(c), o), 'command', 'spine station'), 'spine');
}

function cross(c: Ctx): boolean {
  return placeRoot(c, civil(crossStation(c.rng, c.plan.command, fullRooms(c), c.rng.pick([0, 0.3, 0.6])), 'command', 'cross station'), 'cross');
}

/** Tree: a quad core, then branches (quads or towers of two to four rooms) on whatever grew last, mostly. */
function tree(c: Ctx): boolean {
  const all = shuffle(c.rng, [...roomsOf(c).filter((r) => r.role !== 'dock'), ...reactorRooms(c.plan.reactors, reactorOf(c.plan))]);
  const docks = 2 + roomsOf(c).filter((r) => r.role === 'dock').length;
  const root = civil(station(c.rng, [c.plan.command, ...all.splice(0, 3)]), 'command', 'tree core');
  if (!root) return no(c, 'tree core');
  const ids = [c.A.placeRoot(root)];
  while (all.length > 0) {
    const k = Math.min(all.length, c.rng.int(2, 4));
    const group: RoomSpec[] = all.splice(0, k);
    const blk = c.rng.chance(0.5) && group.length <= 4 ? civil(station(c.rng, group), 'habitat', 'tree quad') : civil(tower(c.rng, group), 'habitat', 'tree tower');
    if (!blk) return no(c, 'branch');
    // Grow off the newest blocks mostly: a branching tree, not a blob round the core.
    const hosts = [...ids.slice(-3).reverse(), ...shuffle(c.rng, ids)];
    let id: number | null = null;
    for (const host of hosts) {
      for (const side of shuffle(c.rng, ['n', 's', 'w', 'e'] as Side[])) {
        const b = side === 'n' && blk.label.includes('tower') ? mirrorBlock(blk) : blk;
        id = c.A.attach(host, b, { side, align: 'any', doors: 1 });
        if (id !== null) break;
      }
      if (id !== null) break;
    }
    if (id === null) return no(c, 'branch fit');
    ids.push(id);
  }
  for (let k = 0; k < docks; k++) {
    let ok = false;
    for (const host of shuffle(c.rng, ids)) {
      const side = c.rng.chance(0.5) ? 'n' : 's';
      const lock: Block = side === 'n' ? dockBlock(c.rng) : mirrorBlock(dockBlock(c.rng)); // as the stack station's airlocks
      if (c.A.attach(host, lock, { side, align: 'any', doors: 1 }) !== null) { ok = true; break; }
    }
    if (!ok) return no(c, 'tree dock');
  }
  c.parts.push(`branches ${ids.length}`);
  return true;
}

export const STATION_LAYOUTS = { spine, cross, tree };
