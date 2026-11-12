/**
 * Integration bridge from the native, still-authoritative structural Builder to
 * the shared architectural model, BEFORE thinning/furnishing. V12's bay
 * requirements and V13's independent-public-access rule are evaluated against
 * the SAME geometry that will be furnished, rather than a second floorplan.
 *
 * This does not attempt to repair missing frontage with unsafe new doors.
 */
import type { Builder } from './builder';
import { roleOfLetter } from './canvas';
import { deptOf } from './stationDepartments';
import { StationArchitecturePlan, type StationArchitectureReport, type StationRegionKind } from './stationArchitecturePlan';
import type { RoomRole } from './types';

export interface StationStructuralFeedback {
  report: StationArchitectureReport;
  /** Exact spatial problems. These are planner instructions, not automatic patches. */
  edits: { region: string; kind: 'move-or-deepen-bay' | 'add-public-frontage' | 'connect-public-circulation' | 'revise-wall-boundary'; detail: string }[];
  /** A smaller score is better. Does not replace required visual approval. */
  accessPenalty: number;
  departmentAccess: StationDepartmentAccess;
}

/** Import actual native Builder labels, including chunk-specific roles, losslessly. */
export function architectureOfBuilder(b: Builder): StationArchitecturePlan {
  const { rows, labels } = b.cv.crop();
  const byKey = new Map(b.parts.map((part) => [part.key, part.spec]));
  const roles: { id: string; role: string; kind?: StationRegionKind; department?: string; requirementId?: string }[] = b.cv.labels.map((l, i) => {
    const role: RoomRole = b.chunkRoles.get(`${l.chunk}:${l.letter}`) ?? roleOfLetter(l.letter) ?? 'cargo';
    const kind: StationRegionKind = role === 'hall' ? 'corridor'
      : role === 'plaza' || role === 'garden' || role === 'drill' ? 'court'
        : role === 'dock' ? 'dock' : 'room';
    const spec = byKey.get(l.chunk) ?? b.chunkSpecs.get(`${l.chunk}:${l.letter}`);
    const department = spec?.dept ?? deptOf({ role, w: 1, h: 1, mods: [] });
    return { id: `builder:${i}`, role, kind, ...(kind === 'room' ? { department } : {}), ...(kind === 'room' && spec ? { requirementId: `builder-input:${i}` } : {}) };
  });
  const plan = StationArchitecturePlan.fromTilemap(rows, labels, roles);
  for (let i = 0; i < b.cv.labels.length; i++) {
    const label = b.cv.labels[i];
    if (!label || roles[i]?.kind !== 'room') continue;
    const spec = byKey.get(label.chunk) ?? b.chunkSpecs.get(`${label.chunk}:${label.letter}`);
    if (spec) plan.addRequirement({ id: `builder-input:${i}`, role: spec.role, width: spec.w, height: spec.h,
      modules: spec.mods, ...(spec.dept ? { department: spec.dept } : {}), rectangularCore: true });
  }
  return plan;
}

export interface StationDepartmentAccess {
  /** Every disconnected department neighborhood requires its own public entrance. */
  neighborhoods: number;
  accessibleNeighborhoods: number;
  departments: number;
  inaccessible: { department: string; rooms: string[]; reason: string }[];
  publicComponents: number;
}

/**
 * V12/V13 department-level rule. Inside a department, cabins may connect
 * internally, but public access to that neighborhood may NOT require passing
 * through an unrelated department. Multiple disconnected neighborhoods of the
 * same function are assessed separately. This does not erase per-room checks.
 */
export function departmentAccessOf(plan: StationArchitecturePlan): StationDepartmentAccess {
  const ids = new Map(plan.regions.map((r) => [r.id, r]));
  const adjacent = new Map<string, Set<string>>();
  const link = (a: string, b: string): void => {
    if (!adjacent.has(a)) adjacent.set(a, new Set());
    adjacent.get(a)?.add(b);
  };
  for (const p of plan.portals) { link(p.a, p.b); link(p.b, p.a); }
  const isPublic = (id: string): boolean => {
    const r = ids.get(id);
    return !!r && r.access === 'public' && (r.kind === 'corridor' || r.kind === 'court');
  };
  const groups: string[][] = [], seenPublic = new Set<string>();
  for (const region of plan.regions.filter((r) => isPublic(r.id))) {
    if (seenPublic.has(region.id)) continue;
    const group = [region.id]; seenPublic.add(region.id);
    for (let i = 0; i < group.length; i++) for (const b of adjacent.get(group[i] as string) ?? []) {
      if (isPublic(b) && !seenPublic.has(b)) { seenPublic.add(b); group.push(b); }
    }
    groups.push(group);
  }
  // Identify main public system by occupied floor area, not arbitrary label ID.
  groups.sort((a, b) => b.reduce((sum, id) => sum + (ids.get(id)?.tiles.length ?? 0), 0)
    - a.reduce((sum, id) => sum + (ids.get(id)?.tiles.length ?? 0), 0));
  const main = new Set(groups[0] ?? []);
  const deptOfRegion = (id: string): string | null => ids.get(id)?.department ?? null;
  const roomRegions = plan.regions.filter((r) => r.kind === 'room');
  const visited = new Set<string>(), inaccessible: StationDepartmentAccess['inaccessible'] = [];
  let neighborhoods = 0, accessibleNeighborhoods = 0;
  for (const region of roomRegions) {
    if (visited.has(region.id)) continue;
    const dept = deptOfRegion(region.id) ?? region.role ?? 'unknown';
    const group = [region.id]; visited.add(region.id);
    for (let i = 0; i < group.length; i++) for (const b of adjacent.get(group[i] as string) ?? []) {
      if (ids.get(b)?.kind === 'room' && deptOfRegion(b) === dept && !visited.has(b)) {
        visited.add(b); group.push(b);
      }
    }
    neighborhoods++;
    const directPrimary = group.some((id) => [...(adjacent.get(id) ?? [])].some((next) => main.has(next)));
    if (directPrimary) accessibleNeighborhoods++;
    else inaccessible.push({ department: dept, rooms: group, reason: 'no direct entrance to main public circulation; requires bay/route revision' });
  }
  return { neighborhoods, accessibleNeighborhoods, departments: new Set(roomRegions.map((r) => r.department ?? r.role)).size,
    inaccessible, publicComponents: groups.length };
}

/** Identify why a geometric candidate lacks a legal entrance; no door punched through other rooms. */
export function structuralFeedback(plan: StationArchitecturePlan): StationStructuralFeedback {
  const report = plan.audit();
  const departmentAccess = departmentAccessOf(plan);
  const edits: StationStructuralFeedback['edits'] = [];
  const missingDirect = new Set(report.issues.filter((i) => i.code === 'no-direct-access').map((i) => i.detail));
  const missingIndependent = new Set(report.issues.filter((i) => i.code === 'no-independent-access').map((i) => i.detail));
  const walls = plan.snapshot().boundaries.filter((b) => !b.door);
  for (const region of plan.regions.filter((r) => r.kind === 'room')) {
    if (!missingDirect.has(region.id) && !missingIndependent.has(region.id)) continue;
    // For each physically legal wall between this room and a public circulation
    // region, see whether a real (not hypothetical) door already exists.
    const publicWall = walls.some((b) => {
      const ids = new Set([...b.horizontal, ...b.vertical].filter((x): x is string => x !== null));
      return ids.has(region.id) && [...ids].some((id) => id !== region.id &&
        plan.regions.some((r) => r.id === id && r.access === 'public' && (r.kind === 'corridor' || r.kind === 'court')));
    });
    if (!publicWall) edits.push({ region: region.id, kind: 'add-public-frontage', detail: 'no legal shared wall with public corridor: change bay/route geometry' });
    else if (missingDirect.has(region.id)) edits.push({ region: region.id, kind: 'move-or-deepen-bay', detail: 'public frontage exists but lacks a legal named door; plan a portal, respecting security' });
    else edits.push({ region: region.id, kind: 'connect-public-circulation', detail: 'room entrance does not reach the primary public network without crossing private rooms' });
  }
  for (const issue of report.issues) if (issue.code === 'wall-slab' || issue.code === 'diagonal-leak') {
    edits.push({ region: `${issue.at?.x ?? '?'}:${issue.at?.y ?? '?'}`, kind: 'revise-wall-boundary', detail: issue.detail });
  }
  // Primary architectural score penalizes inaccessible rooms and broken public
  // topology, NOT total area or the size of a preselected ring. Wall slabs at
  // this stage are tracked separately, as thinWalls() still runs at fit-out.
  const missing = departmentAccess.neighborhoods - departmentAccess.accessibleNeighborhoods;
  const split = Math.max(0, departmentAccess.publicComponents - 1);
  return { report, departmentAccess, edits, accessPenalty: missing * 4 + split * 10 };
}

export interface StationConstructionResult {
  /** Exact rows that the game's room fitting must consume. */
  rows: string[];
  changedWalls: number;
  changedDoors: number;
  /** No silent deletion/creation of room or corridor floor is permitted. */
  changedFloor: number;
  report: StationArchitectureReport;
}

/**
 * Canonical physical wall construction stage, between the original layout's
 * `thinWalls` preparation and `fitOut`. Compiles from actual labeled room floor
 * and portal ownership; the emitted rows then become fitOut's source of truth.
 * This is opt-in until it has been shown to preserve program and gameplay.
 */
export function compileStationConstruction(
  rows: readonly string[], roomOf: Int16Array, roles: readonly string[],
): StationConstructionResult {
  const architectural = StationArchitecturePlan.fromTilemap(rows, roomOf, roles.map((role, i) => ({ id: `room:${i}`, role })));
  const emitted = architectural.compile().rows;
  let changedWalls = 0, changedDoors = 0, changedFloor = 0;
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < (rows[y]?.length ?? 0); x++) {
    const before = rows[y]?.[x] ?? '.', after = emitted[y]?.[x] ?? '.';
    if (before === after) continue;
    if ((before === '_') !== (after === '_')) changedFloor++;
    else if (before === 'D' || after === 'D') changedDoors++;
    else changedWalls++;
  }
  if (changedFloor !== 0) throw new Error(`architecture compiler changed ${changedFloor} labeled floor tiles`);
  return { rows: emitted, changedWalls, changedDoors, changedFloor, report: architectural.audit() };
}

/** The source program's explicit module counts are a hard invariant, even if candidate ranking changes extra furnishing. */
export function sourceModuleDeficits(
  requirements: readonly { modules: readonly string[] }[],
  placed: readonly { def: string }[],
): { def: string; needed: number; found: number }[] {
  const wanted = new Map<string, number>(), actual = new Map<string, number>();
  for (const requirement of requirements) for (const def of requirement.modules)
    wanted.set(def, (wanted.get(def) ?? 0) + 1);
  for (const m of placed) actual.set(m.def, (actual.get(m.def) ?? 0) + 1);
  return [...wanted].filter(([def, amount]) => (actual.get(def) ?? 0) < amount)
    .map(([def, needed]) => ({ def, needed, found: actual.get(def) ?? 0 }));
}
