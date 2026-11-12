/**
 * Canonical station floorplan contract (architectural integration, phase 1).
 *
 * The geometry owns floor regions and door portals. A single compiler owns ALL
 * interior and exterior wall tiles; neither rooms nor the hull add a second wall
 * layer. The reader can also import the existing shipgen tile format without
 * modifying it, allowing the legacy generator to be audited and compared.
 *
 * This is a low-level representation, not a replacement station generator.
 * See docs/STATION_ARCHITECTURE_INTEGRATION.md for the staged migration plan.
 */

export interface StationPoint { x: number; y: number }
export type StationRegionKind = 'room' | 'corridor' | 'court' | 'dock' | 'service' | 'unassigned';
export type StationAccess = 'public' | 'restricted' | 'service';
export type StationRouteKind = 'ring' | 'spoke' | 'dock' | 'local';

export interface StationRoomRequirement {
  id: string;
  role: string;
  width: number;
  height: number;
  modules: readonly string[];
  department?: string;
  optional?: boolean;
  /** Tapering may use extra floor, but these rectangular dimensions must remain clear. */
  rectangularCore: boolean;
}

export interface StationRegion {
  id: string;
  kind: StationRegionKind;
  role?: string;
  department?: string;
  access: StationAccess;
  /** Explicit floor tiles. These must be disjoint between regions. */
  tiles: readonly StationPoint[];
  /** Original room requirement, when this is a specific planned room. */
  requirementId?: string;
}

export interface StationAnchor {
  id: string;
  tile: StationPoint;
  /** Where the anchor belongs in the architectural plan. */
  regionId: string;
  kind: 'court' | 'ring-junction' | 'dock-junction' | 'street-junction' | 'room-entrance';
}

export interface StationPortal {
  id: string;
  a: string;
  b: string;
  tile: StationPoint;
  /** Exact physical aperture tiles (mandatory for width >1). */
  tiles?: readonly StationPoint[];
  kind: 'door' | 'arch';
  /** Width is the number of physical aperture tiles, not a style label. */
  width: number;
}

export interface StationRoute {
  id: string;
  kind: StationRouteKind;
  /** IDs of explicit plan anchors rather than arbitrary coordinates. */
  from: string;
  to: string;
  /** Cardinal-connected CENTERLINE, including both endpoint tiles. */
  path: readonly StationPoint[];
  /** Required clear walking width. 1 local, 2 ring, 3 dock concourse. */
  width: 1 | 2 | 3;
}

export interface StationBoundary {
  at: StationPoint;
  /** Opposite-side ownership. Missing owner means outside a floor region. */
  horizontal: readonly [string | null, string | null];
  vertical: readonly [string | null, string | null];
  /** True when exposed to flood-filled exterior space; internal walls can be shared. */
  exterior: boolean;
  door: boolean;
}

export interface StationGeometry {
  rows: string[];
  owner: Int32Array;
  regionIds: string[];
  boundaries: StationBoundary[];
  origin: StationPoint;
}

export interface StationArchitectureIssue {
  code: 'overlap' | 'outside' | 'portal' | 'route' | 'unclaimed-floor' | 'unconnected-region'
    | 'unreachable-room' | 'no-direct-access' | 'wall-slab' | 'diagonal-leak' | 'exterior-gap'
    | 'not-sealed' | 'disconnected-hull' | 'missing-room' | 'room-clearance' | 'invalid-region'
    | 'public-network-split' | 'no-independent-access';
  detail: string;
  at?: StationPoint;
}

export interface StationArchitectureReport {
  regions: number;
  rooms: number;
  sourceRequirements: number;
  fittedRequirements: number;
  floorTiles: number;
  wallTiles: number;
  doors: number;
  externalHullTiles: number;
  roomHullContactTiles: number;
  /** Exterior hull wall tiles with adjacent room floor on their inside. */
  roomHullFrontage: number;
  /** Hull tiles whose interior side is a void instead of usable floor. */
  exposedInteriorGapTiles: number;
  directPublicRoomAccess: number;
  independentPublicRoomAccess: number;
  publicNetworkComponents: number;
  allRoomReachability: number;
  totalRooms: number;
  exteriorComponents: number;
  wallSlabs: number;
  diagonalLeaks: number;
  issues: StationArchitectureIssue[];
}

const DIR4: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIR8: readonly (readonly [number, number])[] = [...DIR4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
const cellKey = (p: StationPoint): string => `${p.x},${p.y}`;
const isFloor = (c: string): boolean => c === '_';
const isWall = (c: string): boolean => c === '#';
const isSolid = (c: string): boolean => c === '#' || c === 'D';

export class StationArchitecturePlan {
  readonly requirements: StationRoomRequirement[] = [];
  readonly regions: StationRegion[] = [];
  readonly portals: StationPortal[] = [];
  readonly anchors: StationAnchor[] = [];
  readonly routes: StationRoute[] = [];
  private readonly regionIndex = new Map<string, number>();
  private readonly owners: Int32Array;
  /** Imported legacy geometry only. A newly authored plan always compiles its walls. */
  private sourceRows: string[] | null = null;

  constructor(readonly width: number, readonly height: number, readonly origin: StationPoint = { x: 0, y: 0 }) {
    if (width < 3 || height < 3 || width > 220 || height > 220) throw new Error(`invalid station grid ${width}x${height}`);
    this.owners = new Int32Array(width * height).fill(-1);
  }

  private index(p: StationPoint): number {
    const x = p.x - this.origin.x, y = p.y - this.origin.y;
    return x < 0 || x >= this.width || y < 0 || y >= this.height ? -1 : y * this.width + x;
  }

  private point(i: number): StationPoint {
    return { x: (i % this.width) + this.origin.x, y: Math.floor(i / this.width) + this.origin.y };
  }

  private character(rows: readonly string[], p: StationPoint): string {
    return rows[p.y - this.origin.y]?.[p.x - this.origin.x] ?? '.';
  }

  ownerAt(p: StationPoint): string | null {
    const index = this.index(p);
    return index < 0 || (this.owners[index] ?? -1) < 0 ? null : (this.regions[this.owners[index] as number]?.id ?? null);
  }

  addRequirement(requirement: StationRoomRequirement): void {
    if (this.requirements.some((r) => r.id === requirement.id)) throw new Error(`duplicate room requirement ${requirement.id}`);
    if (requirement.width < 1 || requirement.height < 1) throw new Error(`invalid footprint ${requirement.id}`);
    this.requirements.push(requirement);
  }

  addRegion(region: StationRegion): void {
    if (this.regionIndex.has(region.id)) throw new Error(`duplicate region ${region.id}`);
    if (region.tiles.length === 0) throw new Error(`empty region ${region.id}`);
    const indices: number[] = [];
    const seen = new Set<number>();
    for (const tile of region.tiles) {
      const i = this.index(tile);
      if (i < 0) throw new Error(`region ${region.id} outside grid at ${cellKey(tile)}`);
      if ((this.owners[i] ?? -1) >= 0) throw new Error(`floor overlap: ${region.id} and ${this.regions[this.owners[i] as number]?.id} at ${cellKey(tile)}`);
      if (seen.has(i)) throw new Error(`duplicate floor tile ${cellKey(tile)} in ${region.id}`);
      seen.add(i);
      indices.push(i);
    }
    const idx = this.regions.length;
    this.regions.push(region);
    this.regionIndex.set(region.id, idx);
    for (const i of indices) this.owners[i] = idx;
  }

  addPortal(portal: StationPortal): void {
    if (!this.regionIndex.has(portal.a) || !this.regionIndex.has(portal.b) || portal.a === portal.b)
      throw new Error(`portal ${portal.id} has unknown or identical owners`);
    if (this.portals.some((p) => p.id === portal.id)) throw new Error(`duplicate portal ${portal.id}`);
    if (portal.width < 1 || portal.width > 3) throw new Error(`invalid portal width ${portal.id}`);
    if (portal.width > 1 && portal.tiles?.length !== portal.width)
      throw new Error(`portal ${portal.id} needs ${portal.width} explicit aperture tiles`);
    if (portal.tiles && (portal.tiles.length !== portal.width || cellKey(portal.tile) !== cellKey(portal.tiles[0] as StationPoint)))
      throw new Error(`portal ${portal.id} has inconsistent aperture coordinates`);
    if (portal.kind === 'door' && this.index(portal.tile) < 0) throw new Error(`portal outside grid ${portal.id}`);
    this.portals.push(portal);
  }

  addAnchor(anchor: StationAnchor): void {
    if (this.anchors.some((a) => a.id === anchor.id)) throw new Error(`duplicate anchor ${anchor.id}`);
    if (!this.regionIndex.has(anchor.regionId)) throw new Error(`anchor ${anchor.id} has unknown region`);
    if (this.ownerAt(anchor.tile) !== anchor.regionId) throw new Error(`anchor ${anchor.id} is not on its floor region`);
    this.anchors.push(anchor);
  }

  addRoute(route: StationRoute): void {
    if (this.routes.some((r) => r.id === route.id)) throw new Error(`duplicate route ${route.id}`);
    if (!route.from || !route.to || route.path.length < 2) throw new Error(`unnamed/unbounded route ${route.id}`);
    this.routes.push(route);
  }

  /**
   * Authoritative boundary compiler. Room/hall floor is stamped only once; wall
   * candidates are the eight-neighbour outer boundary of the UNION of floor.
   * Shared walls therefore cannot be duplicated and require no perimeter margin.
   * Geometry that needs a 2x2 slab is reported by audit and should be replanned,
   * rather than hidden by deleting a necessary sealing tile.
   */
  compile(): StationGeometry {
    const out = new Array<string>(this.width * this.height).fill('.');
    for (let i = 0; i < out.length; i++) if ((this.owners[i] ?? -1) >= 0) out[i] = '_';
    for (let i = 0; i < out.length; i++) {
      if (out[i] !== '.') continue;
      const p = this.point(i);
      for (const [dx, dy] of DIR8) {
        const j = this.index({ x: p.x + dx, y: p.y + dy });
        if (j >= 0 && (this.owners[j] ?? -1) >= 0) { out[i] = '#'; break; }
      }
    }
    for (const portal of this.portals) {
      const aperture = portal.tiles ?? [portal.tile];
      if (aperture.length !== portal.width) throw new Error(`portal ${portal.id} has incorrect width`);
      for (let j = 1; j < aperture.length; j++) {
        const prev = aperture[j - 1] as StationPoint, next = aperture[j] as StationPoint;
        if (Math.abs(prev.x - next.x) + Math.abs(prev.y - next.y) !== 1)
          throw new Error(`portal ${portal.id} aperture is not cardinal-contiguous`);
      }
      for (const p of aperture) {
        const i = this.index(p);
        const lr = [this.ownerAt({ x: p.x - 1, y: p.y }), this.ownerAt({ x: p.x + 1, y: p.y })];
        const ud = [this.ownerAt({ x: p.x, y: p.y - 1 }), this.ownerAt({ x: p.x, y: p.y + 1 })];
        const joins = ([a, b]: (string | null)[]): boolean => a !== null && b !== null && new Set([a, b]).has(portal.a) && new Set([a, b]).has(portal.b);
        if (portal.kind === 'arch') {
          if (i < 0 || out[i] !== '_' || !DIR4.some(([dx, dy]) => this.ownerAt({ x: p.x + dx, y: p.y + dy }) === (this.ownerAt(p) === portal.a ? portal.b : portal.a)))
            throw new Error(`arch ${portal.id} must be floor touching the other region`);
          continue;
        }
        if (i < 0 || out[i] !== '#') throw new Error(`door ${portal.id} does not occupy a shared wall at ${cellKey(p)}`);
        if (![lr, ud].some(joins)) throw new Error(`door ${portal.id} does not join ${portal.a} to ${portal.b}`);
        out[i] = 'D';
      }
    }
    return this.geometry(out);
  }

  /** Import the EXISTING generator's exact tile rows; don't rewrite its walls or doors. */
  static fromTilemap(rows: readonly string[], roomOf: ArrayLike<number>, labels: readonly { id: string; role?: string; kind?: StationRegionKind; access?: StationAccess; department?: string; requirementId?: string }[]): StationArchitecturePlan {
    const height = rows.length, width = Math.max(...rows.map((r) => r.length));
    if (roomOf.length !== width * height) throw new Error(`roomOf ${roomOf.length}, expected ${width * height}`);
    const plan = new StationArchitecturePlan(width, height);
    const groups = new Map<number, StationPoint[]>();
    const loose: StationPoint[] = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (!isFloor(rows[y]?.[x] ?? '.')) continue;
      const i = y * width + x;
      const owner = roomOf[i] ?? -1;
      if (owner < 0) { loose.push({ x, y }); continue; }
      (groups.get(owner) ?? groups.set(owner, []).get(owner) as StationPoint[]).push({ x, y });
    }
    for (const [i, tiles] of groups) {
      const r = labels[i];
      const role = r?.role;
      const kind = r?.kind ?? (role === 'hall' ? 'corridor' : role === 'plaza' || role === 'garden' || role === 'drill' ? 'court' : role === 'dock' ? 'dock' : 'room');
      plan.addRegion({ id: r?.id ?? `legacy:${i}`, tiles, kind, ...(role ? { role } : {}), access: r?.access ?? (kind === 'corridor' || kind === 'court' ? 'public' : kind === 'dock' ? 'service' : 'restricted'), ...(r?.department ? { department: r.department } : {}), ...(r?.requirementId ? { requirementId: r.requirementId } : {}) });
    }
    // Missing room labels are not silently assigned to a neighboring room.
    if (loose.length > 0) plan.addRegion({ id: 'unassigned-floor', kind: 'unassigned', access: 'service', tiles: loose });
    const doorSet = new Set<string>();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (rows[y]?.[x] !== 'D') continue;
      const p = { x, y };
      const pairs = [
        [plan.ownerAt({ x: x - 1, y }), plan.ownerAt({ x: x + 1, y })],
        [plan.ownerAt({ x, y: y - 1 }), plan.ownerAt({ x, y: y + 1 })],
      ];
      for (const [a, b] of pairs) {
        if (!a || !b || a === b) continue;
        const id = `legacy-door:${x},${y}:${a}:${b}`;
        if (doorSet.has(id)) continue;
        doorSet.add(id);
        plan.addPortal({ id, a, b, tile: p, kind: 'door', width: 1 });
      }
    }
    // Open shared floor boundaries (archways) are explicit graph links too.
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (rows[y]?.[x] !== '_') continue;
      const a = plan.ownerAt({ x, y });
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        if (rows[y + dy]?.[x + dx] !== '_') continue;
        const b = plan.ownerAt({ x: x + dx, y: y + dy });
        if (!a || !b || a === b) continue;
        plan.addPortal({ id: `legacy-arch:${x},${y}:${dx},${dy}`, a, b, tile: pAt(x, y), kind: 'arch', width: 1 });
      }
    }
    plan.sourceRows = Array.from({ length: height }, (_, y) => (rows[y] ?? '').padEnd(width, '.'));
    return plan;
  }

  /** Imported rows remain the truth until all planning stages have migrated. */
  snapshot(): StationGeometry {
    if (!this.sourceRows) return this.compile();
    return this.geometry(this.sourceRows.join('').split(''));
  }

  /** Validate explicit named routes, regardless of overall graph connectivity. */
  validateRoutes(rows: readonly string[] = this.snapshot().rows): StationArchitectureIssue[] {
    const issues: StationArchitectureIssue[] = [];
    for (const route of this.routes) {
      const first = route.path[0] as StationPoint, last = route.path[route.path.length - 1] as StationPoint;
      const from = this.anchors.find((a) => a.id === route.from);
      const to = this.anchors.find((a) => a.id === route.to);
      if (!from || !to || cellKey(first) !== cellKey(from.tile) || cellKey(last) !== cellKey(to.tile)) {
        issues.push({ code: 'route', detail: `${route.id} endpoints do not match named anchors` }); continue;
      }
      // V13 rule: only terminal door approaches may be one or two tiles long.
      // A one-tile jog between turns in a main corridor is not acceptable.
      const segments: { dx: number; dy: number; length: number }[] = [];
      for (let i = 1; i < route.path.length; i++) {
        const a = route.path[i - 1] as StationPoint, b = route.path[i] as StationPoint;
        const dx = b.x - a.x, dy = b.y - a.y;
        if (Math.abs(dx) + Math.abs(dy) !== 1) break; // reported below
        const lastSegment = segments[segments.length - 1];
        if (lastSegment && lastSegment.dx === dx && lastSegment.dy === dy) lastSegment.length++;
        else segments.push({ dx, dy, length: 1 });
      }
      if (segments.slice(1, -1).some((segment) => segment.length < 3))
        issues.push({ code: 'route', detail: `${route.id} has a short internal corridor jog` });
      for (let i = 0; i < route.path.length; i++) {
        const p = route.path[i] as StationPoint;
        if (!isFloor(this.character(rows, p))) {
          issues.push({ code: 'route', detail: `${route.id} crosses non-floor`, at: p }); break;
        }
        if (i > 0) {
          const prev = route.path[i - 1] as StationPoint;
          if (Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y) !== 1) {
            issues.push({ code: 'route', detail: `${route.id} skips a cardinal tile`, at: p }); break;
          }
        }
        // For straight middle segments, ensure clear perpendicular floor width.
        if (i <= 0 || i === route.path.length - 1 || route.width === 1) continue;
        const prev = route.path[i - 1] as StationPoint, next = route.path[i + 1] as StationPoint;
        if (prev.x !== next.x && prev.y !== next.y) continue; // turns use their junction area
        const delta = prev.x === next.x ? [1, 0] as const : [0, 1] as const;
        const a = this.character(rows, { x: p.x - delta[0], y: p.y - delta[1] });
        const b = this.character(rows, { x: p.x + delta[0], y: p.y + delta[1] });
        if (route.width === 3 && !(isFloor(a) && isFloor(b)) || route.width === 2 && !(isFloor(a) || isFloor(b))) {
          issues.push({ code: 'route', detail: `${route.id} ${route.width}-wide clearance missing`, at: p }); break;
        }
      }
    }
    return issues;
  }

  /** Build an explicit boundary graph, including outer-hull classification. */
  private geometry(chars: readonly string[]): StationGeometry {
    const rows: string[] = [];
    for (let y = 0; y < this.height; y++) rows.push(chars.slice(y * this.width, (y + 1) * this.width).join(''));
    const outside = this.outsideVoid(rows);
    const boundaries: StationBoundary[] = [];
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const ch = rows[y]?.[x] ?? '.';
      if (!isSolid(ch)) continue;
      const p = { x: x + this.origin.x, y: y + this.origin.y };
      const side = (dx: number, dy: number): string | null => this.ownerAt({ x: p.x + dx, y: p.y + dy });
      const exterior = DIR4.some(([dx, dy]) => {
        const q = this.index({ x: p.x + dx, y: p.y + dy });
        return q < 0 || outside.has(q);
      });
      boundaries.push({ at: p, horizontal: [side(-1, 0), side(1, 0)], vertical: [side(0, -1), side(0, 1)], exterior, door: ch === 'D' });
    }
    return { rows, owner: new Int32Array(this.owners), regionIds: this.regions.map((r) => r.id), boundaries, origin: { ...this.origin } };
  }

  /** Cardinal flood from outside the nominal tilemap; all disconnected void pockets remain explicit. */
  private outsideVoid(rows: readonly string[]): Set<number> {
    const visited = new Set<number>();
    const queue: number[] = [];
    const visit = (x: number, y: number): void => {
      if (x < 0 || y < 0 || x >= this.width || y >= this.height || rows[y]?.[x] !== '.') return;
      const k = y * this.width + x;
      if (visited.has(k)) return;
      visited.add(k); queue.push(k);
    };
    for (let x = 0; x < this.width; x++) { visit(x, 0); visit(x, this.height - 1); }
    for (let y = 0; y < this.height; y++) { visit(0, y); visit(this.width - 1, y); }
    for (let i = 0; i < queue.length; i++) {
      const k = queue[i] as number, x = k % this.width, y = Math.floor(k / this.width);
      for (const [dx, dy] of DIR4) visit(x + dx, y + dy);
    }
    return visited;
  }

  audit(): StationArchitectureReport {
    const g = this.snapshot(), rows = g.rows, issues: StationArchitectureIssue[] = [];
    const at = (x: number, y: number): string => rows[y]?.[x] ?? '.';
    const outside = this.outsideVoid(rows);
    const isPublic = (r: StationRegion): boolean => r.kind === 'corridor' || r.kind === 'court' || r.access === 'public';
    const links = new Map<string, Set<string>>();
    for (const r of this.regions) links.set(r.id, new Set());
    for (const p of this.portals) {
      links.get(p.a)?.add(p.b);
      links.get(p.b)?.add(p.a);
    }
    const sources = this.regions.filter(isPublic).map((r) => r.id);
    const reachable = new Set(sources), queue = [...sources];
    for (let i = 0; i < queue.length; i++) for (const next of links.get(queue[i] as string) ?? []) {
      if (!reachable.has(next)) { reachable.add(next); queue.push(next); }
    }
    // V13's independent-access principle: public routes may traverse only
    // public regions; a back route through someone's cabin or secured room
    // does not join two disconnected public corridor components.
    const publicRegionIds = new Set(this.regions.filter(isPublic).map((r) => r.id));
    const componentOf = new Map<string, number>();
    const publicGroups: string[][] = [];
    for (const source of sources) {
      if (componentOf.has(source)) continue;
      const component = publicGroups.length;
      const members = [source]; componentOf.set(source, component);
      for (let i = 0; i < members.length; i++) for (const next of links.get(members[i] as string) ?? []) {
        if (publicRegionIds.has(next) && !componentOf.has(next)) { componentOf.set(next, component); members.push(next); }
      }
      publicGroups.push(members);
    }
    const primaryPublic = publicGroups.length === 0 ? -1 : publicGroups.map((g) =>
      g.reduce((n, id) => n + (this.regions[this.regionIndex.get(id) as number]?.tiles.length ?? 0), 0))
      .reduce((best, count, i, values) => count > (values[best] ?? 0) ? i : best, 0);
    if (publicGroups.length > 1) issues.push({ code: 'public-network-split', detail: `${publicGroups.length} independent public corridor components` });
    let independent = 0;
    let direct = 0, all = 0, rooms = 0;
    for (const r of this.regions) {
      if (r.kind !== 'room') continue;
      rooms++;
      if (reachable.has(r.id)) all++; else issues.push({ code: 'unreachable-room', detail: r.id });
      if ([...(links.get(r.id) ?? [])].some((id) => isPublic(this.regions[this.regionIndex.get(id) as number] as StationRegion))) direct++;
      else issues.push({ code: 'no-direct-access', detail: r.id });
      const accessibleFromMain = [...(links.get(r.id) ?? [])].some((id) => componentOf.get(id) === primaryPublic && primaryPublic >= 0);
      if (accessibleFromMain) independent++;
      else issues.push({ code: 'no-independent-access', detail: r.id });
    }
    // Real capacity is evaluated against exact rectangular clear cores, not area.
    let fittedRequirements = 0;
    for (const requirement of this.requirements) {
      const assigned = this.regions.filter((r) => r.requirementId === requirement.id);
      if (assigned.length !== 1) {
        issues.push({ code: 'missing-room', detail: `${requirement.id}: ${assigned.length} assigned regions` });
        continue;
      }
      const region = assigned[0] as StationRegion;
      const tiles = new Set(region.tiles.map(cellKey));
      const hasRect = (w: number, h: number): boolean => region.tiles.some((p) => {
        for (let y = p.y; y < p.y + h; y++) for (let x = p.x; x < p.x + w; x++) {
          if (!tiles.has(`${x},${y}`)) return false;
        }
        return true;
      });
      if (!requirement.rectangularCore || hasRect(requirement.width, requirement.height) || hasRect(requirement.height, requirement.width)) {
        fittedRequirements++;
      } else issues.push({ code: 'room-clearance', detail: `${requirement.id} requires ${requirement.width}x${requirement.height} clear floor` });
    }
    // One semantic region cannot secretly be two islands with an identical label.
    for (const region of this.regions) {
      const tiles = new Set(region.tiles.map(cellKey));
      const first = region.tiles[0];
      if (!first) continue;
      const visited = new Set([cellKey(first)]), q = [first];
      for (let i = 0; i < q.length; i++) {
        const p = q[i] as StationPoint;
        for (const [dx, dy] of DIR4) {
          const other = { x: p.x + dx, y: p.y + dy }, k = cellKey(other);
          if (tiles.has(k) && !visited.has(k)) { visited.add(k); q.push(other); }
        }
      }
      if (visited.size !== tiles.size) issues.push({ code: 'invalid-region', detail: `${region.id} has ${tiles.size - visited.size} disconnected floor tiles` });
    }
    let wallSlabs = 0, diagonalLeaks = 0;
    for (let y = 0; y < this.height - 1; y++) for (let x = 0; x < this.width - 1; x++) {
      if (isWall(at(x, y)) && isWall(at(x + 1, y)) && isWall(at(x, y + 1)) && isWall(at(x + 1, y + 1))) {
        wallSlabs++; issues.push({ code: 'wall-slab', detail: '2x2 solid wall', at: { x: x + this.origin.x, y: y + this.origin.y } });
      }
      // A diagonal floor pair needs at least one orthogonal protective wall/door.
      for (const [a, b, c, d] of [
        [[x, y], [x + 1, y + 1], [x + 1, y], [x, y + 1]],
        [[x + 1, y], [x, y + 1], [x, y], [x + 1, y + 1]],
      ]) {
        if (at(...a as [number, number]) !== '_' || at(...b as [number, number]) !== '_') continue;
        if (at(...c as [number, number]) === '.' || at(...d as [number, number]) === '.') {
          diagonalLeaks++; issues.push({ code: 'diagonal-leak', detail: 'diagonal floor meets open void', at: { x: x + this.origin.x, y: y + this.origin.y } });
        }
      }
    }
    let hullFront = 0, hullGap = 0, hull = 0;
    const exteriorTiles: number[] = [];
    for (const b of g.boundaries) {
      if (!b.exterior) continue;
      const k = this.index(b.at);
      exteriorTiles.push(k);
      hull++;
      const owners = [...b.horizontal, ...b.vertical].filter((id): id is string => id !== null);
      if (owners.some((id) => this.regions[this.regionIndex.get(id) as number]?.kind === 'room')) hullFront++;
      // An exterior hull segment that faces *interior empty* space is suspicious:
      // it may be a court (intentional) or a padding strip (not intentional).
      const x = b.at.x, y = b.at.y;
      if (DIR4.some(([dx, dy]) => {
        const p = { x: x + dx, y: y + dy };
        const j = this.index(p);
        return j >= 0 && at(p.x - this.origin.x, p.y - this.origin.y) === '.' && !outside.has(j);
      })) hullGap++;
    }
    // Match V2's proven hull traversal: exposed boundary tiles may be linked
    // through interior/shared walls. Counting exposed-only components would
    // incorrectly classify a large articulated wheel as many disjoint hulls.
    const allWalls = new Set(g.boundaries.map((b) => this.index(b.at)));
    const seenWalls = new Set<number>();
    let exteriorComponents = 0;
    for (const k of exteriorTiles) {
      if (seenWalls.has(k)) continue;
      exteriorComponents++;
      const q = [k]; seenWalls.add(k);
      for (let i = 0; i < q.length; i++) {
        const v = q[i] as number, x = v % this.width, y = Math.floor(v / this.width);
        for (const [dx, dy] of DIR4) {
          const nx = x + dx, ny = y + dy, n = ny * this.width + nx;
          if (nx >= 0 && ny >= 0 && nx < this.width && ny < this.height && allWalls.has(n) && !seenWalls.has(n)) {
            seenWalls.add(n); q.push(n);
          }
        }
      }
    }
    if (exteriorComponents !== 1) issues.push({ code: 'disconnected-hull', detail: `${exteriorComponents} exterior hull networks` });
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      if (at(x, y) !== '_') continue;
      if (DIR4.some(([dx, dy]) => outside.has((y + dy) * this.width + x + dx))) {
        issues.push({ code: 'not-sealed', detail: 'floor directly exposed to outside vacuum', at: { x: x + this.origin.x, y: y + this.origin.y } });
      }
    }
    issues.push(...this.validateRoutes(rows));
    return {
      regions: this.regions.length, rooms, sourceRequirements: this.requirements.length, fittedRequirements, floorTiles: this.owners.filter((n) => n >= 0).length,
      wallTiles: g.boundaries.length, doors: g.boundaries.filter((b) => b.door).length,
      externalHullTiles: hull, roomHullContactTiles: hullFront,
      roomHullFrontage: hull ? hullFront / hull : 0, exposedInteriorGapTiles: hullGap,
      directPublicRoomAccess: direct, independentPublicRoomAccess: independent, publicNetworkComponents: publicGroups.length,
      allRoomReachability: all, totalRooms: rooms,
      exteriorComponents, wallSlabs, diagonalLeaks, issues,
    };
  }
}

function pAt(x: number, y: number): StationPoint { return { x, y }; }

/** Import the *actual finished and furnished* generated station without guessing room labels. */
export function architectureOfGenerated(result: {
  template: { rows: readonly string[] };
  roomOf: Int16Array;
  rooms: readonly { id: number; role: string }[];
}): StationArchitecturePlan {
  return StationArchitecturePlan.fromTilemap(result.template.rows, result.roomOf,
    result.rooms.map((r) => ({ id: `room:${r.id}`, role: r.role })));
}

/** The complete, immutable input room program before architectural fitting. */
export function requirementsOfStationPlan(p: {
  command: { role: string; w: number; h: number; mods: string[]; dept?: string };
  weapons: { role: string; w: number; h: number; mods: string[]; dept?: string }[];
  shields: { role: string; w: number; h: number; mods: string[]; dept?: string }[];
  core: { role: string; w: number; h: number; mods: string[]; dept?: string } | null;
  pd: { role: string; w: number; h: number; mods: string[]; dept?: string }[];
  quarters: { role: string; w: number; h: number; mods: string[]; dept?: string }[];
  cargo: { role: string; w: number; h: number; mods: string[]; dept?: string }[];
  hangars: { role: string; w: number; h: number; mods: string[]; dept?: string }[];
  support: { role: string; w: number; h: number; mods: string[]; dept?: string }[];
}): StationRoomRequirement[] {
  const roomList = [p.command, ...p.weapons, ...p.shields, ...(p.core ? [p.core] : []), ...p.pd,
    ...p.quarters, ...p.cargo, ...p.hangars, ...p.support];
  return roomList.map((r, i) => ({
    id: `input:${i}`, role: r.role, width: r.w, height: r.h,
    modules: [...r.mods], ...(r.dept ? { department: r.dept } : {}), rectangularCore: true,
  }));
}
