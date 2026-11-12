import type { Builder } from './builder';
import { letterOf } from './canvas';
import type { RoomSpec } from './plan';
import { StationArchitecturePlan, type StationPoint } from './stationArchitecturePlan';
import { deptOf } from './stationDepartments';

/**
 * Experimental replacement for bandArcs (NOT a room-by-room angular cut).
 *
 * 1. Reserve complete department neighborhoods, with program-sized frontage and depth.
 * 2. Place the source-sized, axis-aligned rectangular cores INSIDE those neighborhoods.
 * 3. Assign remaining curved perimeter floor to its neighboring cores and compile
 *    one shared wall layer, including doors onto the EXISTING public ring.
 *
 * All three steps operate on a common StationArchitecturePlan. This is not a
 * standalone floorplan generator; its committed rooms go through native fitOut.
 * No fallback to angular room slicing is allowed in the opt-in mode.
 */
export interface NeighborhoodEnvelope {
  id: string;
  department: string;
  arc: readonly [number, number];
  /** Outer radial depth, excluding the existing ring wall. */
  depth: number;
  requirements: readonly RoomSpec[];
  requiredArea: number;
  frontageDemand: number;
}

export interface NeighborhoodResult {
  envelopes: NeighborhoodEnvelope[];
  plan: StationArchitecturePlan;
  roomCount: number;
  directPublicDoors: number;
  /** Every individual room has a portal path to its bay's public frontage. */
  roomsWithAccess: number;
  /** Every bay has its own entrance onto the ring. */
  baysWithPublicFrontage: number;
  /** Number of floor tiles incorporated in the completed structural bays. */
  inhabitedFloor: number;
  /** Native source dimensions are deliberately NOT relaxed. */
  rectangularCores: number;
}

const TAU = Math.PI * 2;
const DIR4: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIR8: readonly (readonly [number, number])[] = [...DIR4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
const key = (x: number, y: number): string => `${x},${y}`;
const from = (k: string): [number, number] => k.split(',').map(Number) as [number, number];
const angle = (x: number, y: number): number => ((Math.atan2(y, x) % TAU) + TAU) % TAU;
const inside = (a: number, start: number, end: number): boolean => {
  let theta = a;
  while (theta < start) theta += TAU;
  return theta >= start && theta < end;
};
const roomDept = (r: RoomSpec): string => r.dept ?? deptOf(r);
const area = (r: RoomSpec): number => r.w * r.h;
const footprint = (r: RoomSpec): number => Math.max(r.w, r.h) + 2;

/** Keep the native band program's modular quarters decomposition, without adopting its angular cutting. */
function cabinProgram(r: RoomSpec): RoomSpec[] {
  const beds = r.mods.filter((m) => m === 'module.bed').length;
  if (!r.cabins || r.role !== 'quarters' || beds < 2) return [r];
  const others = r.mods.filter((m) => m !== 'module.bed');
  return Array.from({ length: beds }, (_, i): RoomSpec => ({ ...r, mods: ['module.bed', ...(i === 0 ? others : [])],
    w: i === 0 && others.length > 0 ? 3 : 2, h: 4, cabin: true, cabins: false }));
}

/**
 * Allocate whole neighborhoods to an arc BEFORE looking for individual rooms.
 * Allocation is weighted by both area and minimum public frontage, not merely
 * per-room circumference. The output explicitly describes program-sized bays.
 */
export function planNeighborhoodEnvelopes(
  rooms: readonly RoomSpec[], arcs: readonly (readonly [number, number])[], R: number, baseDepth: number,
): NeighborhoodEnvelope[] {
  if (!rooms.length || !arcs.length) return [];
  const lengths = arcs.map(([a, z]) => Math.max(0, z - a));
  const total = lengths.reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  // Allocate complete room programs to the existing dock-free arcs, never a
  // fraction of a requirement across a dock bank.
  const bins: RoomSpec[][] = arcs.map(() => []);
  const weights = rooms.map((r) => Math.max(area(r) / Math.max(baseDepth - 1, 3), footprint(r)) + 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let index = 0, taken = 0, wanted = 0;
  for (let a = 0; a < arcs.length; a++) {
    wanted += (lengths[a] as number) / total * totalWeight;
    while (index < rooms.length && (a === arcs.length - 1 || taken + (weights[index] as number) * 0.5 <= wanted)) {
      (bins[a] as RoomSpec[]).push(rooms[index] as RoomSpec);
      taken += weights[index] as number;
      index++;
    }
  }
  const out: NeighborhoodEnvelope[] = [];
  for (let a = 0; a < arcs.length; a++) {
    const rs = bins[a] as RoomSpec[];
    if (!rs.length) continue;
    // Re-group within the arc by DEPARTMENT. This does not partition an arc
    // into rooms. Same-department requirements share one structural bay.
    const groups: { dept: string; rooms: RoomSpec[] }[] = [];
    for (const r of rs) {
      const dept = roomDept(r);
      if (groups[groups.length - 1]?.dept === dept) (groups[groups.length - 1] as { dept: string; rooms: RoomSpec[] }).rooms.push(r);
      else groups.push({ dept, rooms: [r] });
    }
    const [start, end] = arcs[a] as readonly [number, number];
    const gp = groups.map((g) => {
      const width = g.rooms.reduce((n, r) => n + footprint(r), 0);
      const floor = g.rooms.reduce((n, r) => n + area(r) + 4, 0);
      // Depth is a BAY decision: varied by the program's room dimensions,
      // not an arbitrary per-room radial slice.
      const minDepth = Math.max(...g.rooms.map((r) => Math.min(r.w, r.h) + 2));
      // A rectangular core at 45 degrees needs more radial depth than
      // min(width,height). Reserve enough bay depth at the intended angle.
      const d = Math.max(7, Math.min(18, Math.max(baseDepth, minDepth)));
      const need = Math.max(width * 1.25 + 3, floor / Math.max(d - 2, 3));
      return { ...g, depth: d, need };
    });
    const weight = gp.reduce((n, g) => n + g.need, 0);
    let cursor = start;
    gp.forEach((g, j) => {
      const until = j === gp.length - 1 ? end : cursor + (end - start) * g.need / weight;
      const at = (cursor + until) / 2;
      const radial = Math.max(...g.rooms.map((r) => Math.min(
        r.w * Math.abs(Math.cos(at)) + r.h * Math.abs(Math.sin(at)),
        r.h * Math.abs(Math.cos(at)) + r.w * Math.abs(Math.sin(at)))));
      const depth = Math.min(18, Math.max(g.depth, Math.ceil(radial) + 4));
      out.push({ id: `bay:${a}:${j}:${g.dept}`, department: g.dept, arc: [cursor, until], depth,
        requirements: g.rooms, requiredArea: g.rooms.reduce((n, r) => n + area(r), 0),
        frontageDemand: g.rooms.reduce((n, r) => n + footprint(r), 0) });
      cursor = until;
    });
  }
  return out;
}


interface LocalGallery { bay: string; tiles: [number, number][]; ringDoor: [number, number] }

/**
 * A department's public frontage may continue into a short local aisle. The
 * aisle is selected from a real cardinal run anchored on the existing main
 * ring; it is NOT a cosmetic line stamped through private rooms afterward.
 * It reserves its floor and one-wall clearance before room cores are packed.
 */
function localGallery(b: Builder, ring: number, bay: NeighborhoodEnvelope, mask: Set<string>): LocalGallery | null {
  if (bay.requirements.length < 3) return null;
  const middle = (bay.arc[0] + bay.arc[1]) / 2;
  const alongX = Math.abs(Math.cos(middle)) >= Math.abs(Math.sin(middle));
  const dx = alongX ? Math.sign(Math.cos(middle)) : 0;
  const dy = alongX ? 0 : Math.sign(Math.sin(middle));
  const starters = [...mask].map(from).filter(([x, y]) => ringPortal(b, ring, x, y).length > 0);
  let best: LocalGallery | null = null, score = -Infinity;
  for (const [sx, sy] of starters) {
    const tiles: [number, number][] = [];
    for (let t = 0; t < bay.depth - 2; t++) {
      const x = sx + dx * t, y = sy + dy * t;
      if (!mask.has(key(x, y))) break;
      tiles.push([x, y]);
    }
    if (tiles.length < 5) continue;
    const entry = ringPortal(b, ring, sx, sy)[0];
    if (!entry) continue;
    const theta = angle(sx, sy);
    const error = Math.abs(Math.atan2(Math.sin(theta - middle), Math.cos(theta - middle)));
    const v = tiles.length - error * 6;
    if (v > score) { score = v; best = { bay: bay.id, tiles, ringDoor: entry }; }
  }
  return best;
}

/** One-tile partition around a local aisle; all rooms remain beyond that wall. */
function reserveGallery(mask: Set<string>, gallery: LocalGallery): Set<string> {
  const out = new Set(mask);
  for (const [x, y] of gallery.tiles) {
    out.delete(key(x, y));
    for (const [dx, dy] of DIR8) out.delete(key(x + dx, y + dy));
  }
  return out;
}
interface Core { x: number; y: number; w: number; h: number; room: number; spec: RoomSpec; doors: [number, number][] }
const coreKeys = (r: Pick<Core, 'x' | 'y' | 'w' | 'h'>): string[] => {
  const out: string[] = [];
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) out.push(key(x, y));
  return out;
};

/** Room floor tile with a legal, one-tile wall between this floor and ring floor. */
function ringPortal(b: Builder, ring: number, x: number, y: number): [number, number][] {
  const out: [number, number][] = [];
  for (const [dx, dy] of DIR4) {
    const wx = x + dx, wy = y + dy;
    if (b.cv.at(wx, wy) === '#' && b.cv.at(wx + dx, wy + dy) === '_' && b.cv.labelAt(wx + dx, wy + dy) === ring)
      out.push([wx, wy]);
  }
  return out;
}

/**
 * Greedy constrained room-core packing IN TWO DIMENSIONS inside an already
 * chosen department envelope. A candidate is an actual rectangular footprint,
 * not an angular share. A direct ring wall is reserved before placing it.
 */
function packCores(
  b: Builder, ring: number, mask: Set<string>, specs: readonly RoomSpec[], arc: readonly [number, number],
): Core[] | null {
  const ks = [...mask].map(from);
  if (ks.length === 0) return null;
  const x0 = Math.min(...ks.map((p) => p[0])), x1 = Math.max(...ks.map((p) => p[0]));
  const y0 = Math.min(...ks.map((p) => p[1])), y1 = Math.max(...ks.map((p) => p[1]));
  const order = specs.map((spec, i) => ({ spec, i })).sort((a, z) =>
    Number(!!z.spec.pinned) - Number(!!a.spec.pinned) || area(z.spec) - area(a.spec) || a.i - z.i);
  const forbidden = new Set<string>();
  const found: Core[] = [];
  const total = specs.reduce((n, r) => n + footprint(r), 0);
  let assignedFrontage = 0;
  for (const { spec, i } of order) {
    const prefer = arc[0] + (arc[1] - arc[0]) * (assignedFrontage + footprint(spec) * 0.5) / total;
    assignedFrontage += footprint(spec);
    const dimensions: [number, number][] = spec.w === spec.h ? [[spec.w, spec.h]] : [[spec.w, spec.h], [spec.h, spec.w]];
    let best: { core: Core; score: number } | null = null;
    for (const [w, h] of dimensions) {
      for (let y = y0; y + h - 1 <= y1; y++) for (let x = x0; x + w - 1 <= x1; x++) {
        const rect = { x, y, w, h };
        const cells = coreKeys(rect);
        if (cells.some((k) => !mask.has(k) || forbidden.has(k))) continue;
        const doors = cells.flatMap((k) => ringPortal(b, ring, ...from(k)));
        // A shaped frontage extension may connect an interior rectangular core
        // to the ring; direct core contact is preferred but not mandatory.
        const mid = angle(x + (w - 1) / 2, y + (h - 1) / 2);
        const diff = Math.abs(Math.atan2(Math.sin(mid - prefer), Math.cos(mid - prefer)));
        const distance = Math.min(...cells.map((k) => {
          const [cx, cy] = from(k);
          return Math.abs(Math.hypot(cx, cy));
        }));
        // Strongest pressure: actual access and compact neighborhood packing.
        const score = diff * 10 + distance * 0.005 - Math.min(doors.length, 4) * 0.20;
        if (best === null || score < best.score) best = { core: { ...rect, spec, room: i, doors }, score };
      }
    }
    if (!best) return null;
    found.push(best.core);
    for (const k of coreKeys(best.core)) {
      const [x, y] = from(k);
      for (const [dx, dy] of DIR8) forbidden.add(key(x + dx, y + dy));
      forbidden.add(k);
    }
  }
  return found.sort((a, z) => a.room - z.room);
}

/** Assign curving remainder to anchored cores, avoiding any invented maintenance strip. */
function partitionNeighborhood(mask: Set<string>, cores: readonly Core[]): Map<number, [number, number][]> | null {
  const coreOwner = new Map<string, number>();
  for (const c of cores) for (const k of coreKeys(c)) coreOwner.set(k, c.room);
  const owned = new Map<string, number>();
  for (const k of mask) {
    const core = coreOwner.get(k);
    if (core !== undefined) { owned.set(k, core); continue; }
    const [x, y] = from(k);
    let best = Infinity, owner = -1;
    for (const c of cores) {
      const dx = Math.max(c.x - x, 0, x - (c.x + c.w - 1));
      const dy = Math.max(c.y - y, 0, y - (c.y + c.h - 1));
      const d = dx + dy + 0.02 * (dx * dx + dy * dy);
      if (d < best) { best = d; owner = c.room; }
    }
    if (owner < 0) return null;
    owned.set(k, owner);
  }
  // Reserve a single wall on shared region interfaces, preferentially from
  // noncore tiles. Never erode the source-sized rectangular cores.
  const wall = new Set<string>();
  for (const [k, i] of owned) {
    const [x, y] = from(k);
    for (const [dx, dy] of DIR4) {
      const other = key(x + dx, y + dy), j = owned.get(other);
      if (j === undefined || j === i) continue;
      if (coreOwner.has(k) && !coreOwner.has(other)) wall.add(other);
      else if (coreOwner.has(other) && !coreOwner.has(k)) wall.add(k);
      else if (!coreOwner.has(k) && !coreOwner.has(other) && i > j) wall.add(k);
    }
  }
  // Curving outside is sealed by the shared-wall compiler; it should not be
  // padded with a second wall or a maintenance corridor.
  const floor = new Map<number, [number, number][]>();
  for (const [k, i] of owned) {
    if (wall.has(k)) continue;
    const [x, y] = from(k);
    floor.set(i, [...(floor.get(i) ?? []), [x, y]]);
  }
  // Each resulting region must be cardinal-connected, and retain its exact
  // rectangular core. Disconnected wings are not valid usable floor.
  for (const c of cores) {
    const tiles = floor.get(c.room) ?? [];
    const mine = new Set(tiles.map(([x, y]) => key(x, y)));
    if (coreKeys(c).some((k) => !mine.has(k))) return null;
    const stack = [key(c.x, c.y)], seen = new Set(stack);
    while (stack.length) {
      const [x, y] = from(stack.pop() as string);
      for (const [dx, dy] of DIR4) {
        const k = key(x + dx, y + dy);
        if (mine.has(k) && !seen.has(k)) { seen.add(k); stack.push(k); }
      }
    }
    if (seen.size !== mine.size) return null;
  }
  return floor;
}

/**
 * Construct the BUILT bay from room cores rather than filling the whole angular
 * placement window. The window remains a collision/search constraint only.
 *
 * A short continuous, inhabited ring frontage connects into individual
 * rectangular industrial masses; their exposed boundaries form the hull.
 * A minimal 4-connected trunk attaches each core to that frontage. Leftover
 * search-space tiles remain void, never silently assigned to oversized rooms.
 */
export function constructProgramBayFootprint(
  search: ReadonlySet<string>, cores: readonly Pick<Core, 'x' | 'y' | 'w' | 'h'>[], ringRadius: number,
): Set<string> | null {
  if (!cores.length) return null;
  const kept = new Set<string>();
  const frontage: string[] = [];
  for (const k of search) {
    const [x, y] = from(k);
    // These connected frontage cells give an inhabited curve without an
    // oversized pie-shaped room extending all the way to the radius limit.
    if (Math.hypot(x, y) < ringRadius + 4) {
      kept.add(k);
      frontage.push(k);
    }
  }
  if (!frontage.length) return null;
  const coreCells = cores.map(coreKeys);
  for (const cells of coreCells) for (const k of cells) {
    if (!search.has(k)) return null;
    kept.add(k);
    const [x, y] = from(k);
    // Two-tile apron permits stepped exterior wall transitions; this is
    // shell geometry, not an unbounded room-growth algorithm.
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++)
      if (Math.abs(dx) + Math.abs(dy) <= 2 && search.has(key(x + dx, y + dy)))
        kept.add(key(x + dx, y + dy));
  }
  // Multi-source shortest path back from ring frontage. Keep only the
  // terminal path for each room, rather than a full radial wedge of floor.
  const prev = new Map<string, string | null>();
  const queue = [...frontage];
  for (const k of queue) prev.set(k, null);
  for (let qi = 0; qi < queue.length; qi++) {
    const [x, y] = from(queue[qi] as string);
    for (const [dx, dy] of DIR4) {
      const next = key(x + dx, y + dy);
      if (!search.has(next) || prev.has(next)) continue;
      prev.set(next, queue[qi] as string);
      queue.push(next);
    }
  }
  for (const cells of coreCells) {
    // Choose the shortest connection from this core to the shared frontage.
    let best: string | null = null, distance = Infinity;
    for (const k of cells) {
      if (!prev.has(k)) continue;
      let n = 0, at: string | null = k;
      while (at && n < distance) { n++; at = prev.get(at) ?? null; }
      if (n < distance) { best = k; distance = n; }
    }
    if (!best) return null;
    let at: string | null = best;
    while (at !== null) {
      kept.add(at);
      const [x, y] = from(at);
      // One-cell side clearance for a legal private-frontage connection.
      for (const [dx, dy] of DIR4) if (search.has(key(x + dx, y + dy))) kept.add(key(x + dx, y + dy));
      at = prev.get(at) ?? null;
    }
  }
  return kept;
}

/** Planning and construction are transactional: nothing is stamped on failure. */
export function buildNeighborhoodBand(
  b: Builder, R: number, ring: number, rooms: readonly RoomSpec[], baseDepth: number,
  arcs: readonly (readonly [number, number])[], geometry: 'sector' | 'programBay' = 'sector',
): NeighborhoodResult | null {
  if (!rooms.length) return null;
  const expanded = rooms.flatMap(cabinProgram);
  const envelopes = planNeighborhoodEnvelopes(expanded, arcs, R, baseDepth);
  if (envelopes.length === 0) return null;
  const allRooms: { spec: RoomSpec; tiles: [number, number][]; bay: string; core: Core }[] = [];
  const localGalleries: LocalGallery[] = [];
  for (const bay of envelopes) {
    const mask = new Set<string>();
    const M = Math.ceil(R + bay.depth + 3);
    // Floor radius is decided by the NEIGHBORHOOD, so large bay depths modify
    // the actual outer silhouette; rooms cannot enlarge it individually.
    for (let y = -M; y <= M; y++) for (let x = -M; x <= M; x++) {
      const d = Math.hypot(x, y);
      if (d < R + 1.5 || d > R + bay.depth + 0.5 || b.cv.at(x, y) !== '.') continue;
      if (inside(angle(x, y), bay.arc[0], bay.arc[1])) mask.add(key(x, y));
    }
    const proposedGallery = localGallery(b, ring, bay, mask);
    let chosen: { cores: Core[]; floor: Map<number, [number, number][]>; gallery: LocalGallery | null } | null = null;
    for (const gallery of [proposedGallery, null]) {
      if (!gallery && proposedGallery === null && chosen) break;
      const usable = gallery ? reserveGallery(mask, gallery) : mask;
      const cores = packCores(b, ring, usable, bay.requirements, bay.arc);
      if (!cores) continue;
      const footprint = geometry === 'programBay' ? constructProgramBayFootprint(usable, cores, R) : usable;
      if (!footprint) continue;
      const floor = partitionNeighborhood(footprint, cores);
      if (!floor) continue;
      chosen = { cores, floor, gallery };
      break;
    }
    if (!chosen) return null;
    if (chosen.gallery) localGalleries.push(chosen.gallery);
    for (const c of chosen.cores) allRooms.push({ spec: c.spec, tiles: chosen.floor.get(c.room) ?? [], bay: bay.id, core: c });
  }
  // Construct a single physical room-boundary model BEFORE touching Builder.
  // The canonical plan controls all new floor and portals, including the ring's
  // existing public floor; it cannot silently change station-owned inboard rooms.
  const M = Math.ceil(R + Math.max(...envelopes.map((e) => e.depth)) + 5);
  const plan = new StationArchitecturePlan(2 * M + 1, 2 * M + 1, { x: -M, y: -M });
  const ringTiles: StationPoint[] = [];
  for (let y = -M; y <= M; y++) for (let x = -M; x <= M; x++)
    if (b.cv.at(x, y) === '_' && b.cv.labelAt(x, y) === ring) ringTiles.push({ x, y });
  if (!ringTiles.length) return null;
  plan.addRegion({ id: 'ring:public', kind: 'corridor', access: 'public', role: 'hall', tiles: ringTiles });
  for (const gallery of localGalleries) {
    const id = `bay-public:${gallery.bay}`;
    plan.addRegion({ id, kind: 'corridor', access: 'public', role: 'hall',
      tiles: gallery.tiles.map(([x, y]) => ({ x, y })) });
    const [x, y] = gallery.ringDoor;
    plan.addPortal({ id: `bay-ring:${gallery.bay}`, a: 'ring:public', b: id,
      tile: { x, y }, kind: 'door', width: 1 });
  }
  const doors: [number, number][] = localGalleries.map((g) => g.ringDoor);
  const galleryFloor = new Map<string, string>();
  for (const gallery of localGalleries) for (const [x, y] of gallery.tiles)
    galleryFloor.set(key(x, y), `bay-public:${gallery.bay}`);
  const floorOwner = new Map<string, number>();
  for (const [i, r] of allRooms.entries()) for (const [x, y] of r.tiles) floorOwner.set(key(x, y), i);
  for (const [i, r] of allRooms.entries()) {
    const id = `neighborhood-room:${i}`, reqId = `neighborhood-program:${i}`;
    plan.addRequirement({ id: reqId, role: r.spec.role, width: r.spec.w, height: r.spec.h,
      modules: r.spec.mods, department: roomDept(r.spec), rectangularCore: true });
    plan.addRegion({ id, kind: 'room', access: 'restricted', role: r.spec.role, department: roomDept(r.spec),
      requirementId: reqId, tiles: r.tiles.map(([x, y]) => ({ x, y })) });
  }
  // A public-facing bay has its own independent entrance. Interior rooms may
  // reach that entrance through same-DEPARTMENT partitions, but never through
  // an unrelated department. The V13 rule is a topology constraint, not an
  // after-the-fact door repair.
  const reached = new Set<number>();
  const baysWithAccess = new Set(localGalleries.map((g) => g.bay));
  let publicDoors = localGalleries.length;
  for (const [i, r] of allRooms.entries()) {
    const candidates = r.tiles.flatMap(([x, y]) => ringPortal(b, ring, x, y));
    const coreCandidates = coreKeys(r.core).flatMap((k) => ringPortal(b, ring, ...from(k)));
    const galleryCandidates: { tile: [number, number]; owner: string }[] = [];
    for (const [x, y] of r.tiles) for (const [dx, dy] of DIR4) {
      const owner = galleryFloor.get(key(x + 2 * dx, y + 2 * dy));
      if (owner && !floorOwner.has(key(x + dx, y + dy)))
        galleryCandidates.push({ tile: [x + dx, y + dy], owner });
    }
    const direct = [...coreCandidates, ...candidates].find(([x, y]) => !doors.some(([dx, dy]) => dx === x && dy === y));
    const galleryDoor = galleryCandidates.find(({ tile: [x, y] }) => !doors.some(([dx, dy]) => dx === x && dy === y));
    if (!direct && !galleryDoor) continue;
    const [x, y] = direct ?? (galleryDoor as { tile: [number, number] }).tile;
    doors.push([x, y]);
    plan.addPortal({ id: `public-frontage:${i}`, a: direct ? 'ring:public' : (galleryDoor as { owner: string }).owner,
      b: `neighborhood-room:${i}`, tile: { x, y }, kind: 'door', width: 1 });
    reached.add(i);
    baysWithAccess.add(r.bay);
    publicDoors++;
  }
  if (baysWithAccess.size !== envelopes.length) return null;
  // Connected intra-department rooms get an explicit portal across a legal
  // one-cell partition. This is never a cross-department bypass.
  for (let pass = 0; pass < allRooms.length && reached.size < allRooms.length; pass++) {
    let advanced = false;
    for (const [i, r] of allRooms.entries()) {
      if (reached.has(i)) continue;
      const spots: { tile: [number, number]; next: number }[] = [];
      for (const [x, y] of r.tiles) for (const [dx, dy] of DIR4) {
        const j = floorOwner.get(key(x + 2 * dx, y + 2 * dy));
        const other = j === undefined ? undefined : allRooms[j];
        if (j === undefined || j === i || !reached.has(j) || other?.bay !== r.bay) continue;
        const wx = x + dx, wy = y + dy;
        if (floorOwner.has(key(wx, wy)) || b.cv.at(wx, wy) === '_') continue;
        if (doors.some(([px, py]) => px === wx && py === wy)) continue;
        spots.push({ tile: [wx, wy], next: j });
      }
      if (!spots.length) continue;
      const { tile: [x, y], next } = spots[Math.floor(spots.length / 2)] as { tile: [number, number]; next: number };
      doors.push([x, y]);
      plan.addPortal({ id: `internal-frontage:${i}`, a: `neighborhood-room:${i}`, b: `neighborhood-room:${next}`,
        tile: { x, y }, kind: 'door', width: 1 });
      reached.add(i);
      advanced = true;
    }
    if (!advanced) break;
  }
  if (reached.size !== allRooms.length) return null;
  let emitted: string[];
  try { emitted = plan.compile().rows; } catch { return null; }
  // The plan is authoritative for room floor, wall and door locations; merge
  // only those tiles, preserving pre-existing rotunda/ring/spoke/system tiles.
  const stampRows: { rows: string[]; x: number; y: number; key: string; spec: RoomSpec }[] = [];
  for (const [i, room] of allRooms.entries()) {
    const xs = room.tiles.map(([x]) => x), ys = room.tiles.map(([, y]) => y);
    const minX = Math.min(...xs) - 1, maxX = Math.max(...xs) + 1;
    const minY = Math.min(...ys) - 1, maxY = Math.max(...ys) + 1;
    const footprint = new Set(room.tiles.map(([x, y]) => key(x, y)));
    const rows: string[] = [];
    for (let y = minY; y <= maxY; y++) {
      let line = '';
      for (let x = minX; x <= maxX; x++) {
        if (footprint.has(key(x, y))) { line += letterOf(room.spec.role); continue; }
        const value = emitted[y + M]?.[x + M] ?? '.';
        // The shared compiler knows about all rooms. Do not write its ring or
        // neighbor floor into the current room's letter-specific stamp.
        const isBoundary = DIR8.some(([dx, dy]) => footprint.has(key(x + dx, y + dy)));
        line += isBoundary && (value === '#' || value === 'D') ? '#' : '.';
      }
      rows.push(line);
    }
    stampRows.push({ rows, x: minX, y: minY, key: `neighborhood:${room.bay}:${i}`, spec: room.spec });
  }
  for (const gallery of localGalleries) {
    const xs = gallery.tiles.map(([x]) => x), ys = gallery.tiles.map(([, y]) => y);
    const minX = Math.min(...xs) - 1, maxX = Math.max(...xs) + 1;
    const minY = Math.min(...ys) - 1, maxY = Math.max(...ys) + 1;
    const set = new Set(gallery.tiles.map(([x, y]) => key(x, y)));
    const rows: string[] = [];
    for (let y = minY; y <= maxY; y++) {
      let line = '';
      for (let x = minX; x <= maxX; x++) {
        if (set.has(key(x, y))) { line += letterOf('hall'); continue; }
        const value = emitted[y + M]?.[x + M] ?? '.';
        line += DIR8.some(([dx, dy]) => set.has(key(x + dx, y + dy))) && (value === '#' || value === 'D') ? '#' : '.';
      }
      rows.push(line);
    }
    stampRows.push({ rows, x: minX, y: minY, key: `neighborhood:public:${gallery.bay}`, spec: { role: 'hall', mods: [], w: 1, h: 1 } });
  }
  // Preflight ALL tiles against Canvas's own collision semantics, including
  // walls from other neighborhoods. Commit only after this validation.
  const usedFloor = new Set([...allRooms.flatMap((r) => r.tiles.map(([x, y]) => key(x, y))),
    ...localGalleries.flatMap((g) => g.tiles.map(([x, y]) => key(x, y)))]);
  for (const stamp of stampRows) for (let dy = 0; dy < stamp.rows.length; dy++) for (let dx = 0; dx < (stamp.rows[dy]?.length ?? 0); dx++) {
    const cell = stamp.rows[dy]?.[dx];
    if (cell === '.') continue;
    const x = stamp.x + dx, y = stamp.y + dy, old = b.cv.at(x, y);
    if (cell === '#' && old === '_' && !usedFloor.has(key(x, y))) return null;
    if (cell !== '#' && (old !== '.' || !usedFloor.has(key(x, y)))) return null;
  }
  for (const s of stampRows) {
    if (!b.cv.stamp(s.rows, s.x, s.y, s.key)) throw new Error(`preflight disagreed on ${s.key}`);
    b.parts.push({ x: s.x, y: s.y, w: s.rows[0]?.length ?? 0, h: s.rows.length, key: s.key,
      role: s.spec.role, spec: s.spec });
  }
  for (const [x, y] of doors) b.cv.setDoor(x, y);
  return { envelopes, plan, roomCount: allRooms.length, directPublicDoors: publicDoors,
    roomsWithAccess: reached.size, baysWithPublicFrontage: baysWithAccess.size,
    inhabitedFloor: allRooms.reduce((n, r) => n + r.tiles.length, 0), rectangularCores: allRooms.length };
}
