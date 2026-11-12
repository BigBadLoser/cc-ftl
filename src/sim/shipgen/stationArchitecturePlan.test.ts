import { describe, expect, it } from 'vitest';
import { StationArchitecturePlan, architectureOfGenerated, type StationRegion } from './stationArchitecturePlan';

function rectangle(id: string, kind: StationRegion['kind'], x0: number, y0: number, w: number, h: number): StationRegion {
  const tiles = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) tiles.push({ x, y });
  return { id, kind, tiles, access: kind === 'corridor' || kind === 'court' ? 'public' : 'restricted' };
}

const fixture = (): StationArchitecturePlan => {
  const p = new StationArchitecturePlan(18, 11);
  p.addRegion(rectangle('hold', 'room', 2, 3, 4, 5));
  p.addRegion(rectangle('gallery', 'corridor', 7, 3, 3, 5));
  p.addRegion(rectangle('office', 'room', 11, 3, 4, 5));
  p.addPortal({ id: 'hold-entrance', a: 'hold', b: 'gallery', tile: { x: 6, y: 5 }, kind: 'door', width: 1 });
  p.addPortal({ id: 'office-entrance', a: 'office', b: 'gallery', tile: { x: 10, y: 5 }, kind: 'door', width: 1 });
  p.addAnchor({ id: 'gallery-top', kind: 'street-junction', tile: { x: 8, y: 3 }, regionId: 'gallery' });
  p.addAnchor({ id: 'gallery-bottom', kind: 'street-junction', tile: { x: 8, y: 7 }, regionId: 'gallery' });
  p.addRoute({ id: 'gallery-main', kind: 'local', from: 'gallery-top', to: 'gallery-bottom', width: 1,
    path: [3, 4, 5, 6, 7].map((y) => ({ x: 8, y })) });
  return p;
};

describe('station architectural integration contract', () => {
  it('compiles one shared wall per boundary and no perimeter maintenance gap', () => {
    const p = fixture();
    const g = p.compile();
    expect(g.rows[5]?.[5]).toBe('_');
    expect(g.rows[5]?.[6]).toBe('D');
    expect(g.rows[5]?.[7]).toBe('_');
    expect(g.rows[5]?.[1]).toBe('#'); // exterior is THE hold's wall
    expect(g.rows[5]?.[0]).toBe('.'); // vacuum immediately outside; no padded strip
    const shared = g.boundaries.filter((w) => w.at.x === 6 && w.at.y === 5);
    expect(shared).toHaveLength(1);
    expect(shared[0]?.horizontal).toEqual(['hold', 'gallery']);
    const audit = p.audit();
    expect(audit.rooms).toBe(2);
    expect(audit.directPublicRoomAccess).toBe(2);
    expect(audit.allRoomReachability).toBe(2);
    expect(audit.exteriorComponents).toBe(1);
    expect(audit.wallSlabs).toBe(0);
    expect(audit.diagonalLeaks).toBe(0);
    expect(audit.issues).toHaveLength(0);
  });

  it('preserves finished game tilemaps exactly and recovers real room/door graph', () => {
    const p = fixture(), compiled = p.compile();
    const ids = compiled.regionIds.map((id) => ({ id, role: id === 'gallery' ? 'hall' : 'cargo' }));
    const imported = StationArchitecturePlan.fromTilemap(compiled.rows, compiled.owner, ids);
    expect(imported.snapshot().rows).toEqual(compiled.rows);
    expect(imported.portals).toHaveLength(2);
    const audit = imported.audit();
    expect(audit.rooms).toBe(2);
    expect(audit.directPublicRoomAccess).toBe(2);
    expect(audit.wallSlabs).toBe(0);
  });

  it('rejects overlapping regions, invalid ports and ungrounded named streets', () => {
    const p = new StationArchitecturePlan(20, 20);
    p.addRegion(rectangle('a', 'room', 3, 3, 4, 4));
    expect(() => p.addRegion(rectangle('b', 'room', 6, 6, 4, 4))).toThrow(/overlap/);
    p.addRegion(rectangle('hall', 'corridor', 8, 3, 4, 4));
    p.addPortal({ id: 'bad', a: 'a', b: 'hall', tile: { x: 5, y: 5 }, kind: 'door', width: 1 });
    expect(() => p.compile()).toThrow(/shared wall/);
  });

  it('checks EACH named route, even if the combined corridor network is connected elsewhere', () => {
    const p = new StationArchitecturePlan(14, 14);
    p.addRegion(rectangle('ring', 'corridor', 3, 3, 8, 8));
    p.addAnchor({ id: 'rim', regionId: 'ring', kind: 'ring-junction', tile: { x: 5, y: 3 } });
    p.addAnchor({ id: 'core', regionId: 'ring', kind: 'court', tile: { x: 5, y: 10 } });
    p.addRoute({ id: 'bad-spoke', kind: 'spoke', from: 'rim', to: 'core', width: 1,
      path: [{ x: 5, y: 3 }, { x: 5, y: 4 }, { x: 5, y: 6 }, { x: 5, y: 7 }, { x: 5, y: 8 }, { x: 5, y: 9 }, { x: 5, y: 10 }] });
    expect(p.validateRoutes().some((i) => i.detail.includes('skips'))).toBe(true);
  });

  it('rejects V13-style one-tile mid-span corridor jogs', () => {
    const p = new StationArchitecturePlan(20, 20);
    p.addRegion(rectangle('hall', 'corridor', 3, 3, 15, 15));
    const path = [
      { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 7, y: 4 },
      { x: 7, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 }, { x: 10, y: 5 },
    ];
    p.addAnchor({ id: 'source', regionId: 'hall', tile: path[0] as { x: number; y: number }, kind: 'street-junction' });
    p.addAnchor({ id: 'target', regionId: 'hall', tile: path[path.length - 1] as { x: number; y: number }, kind: 'street-junction' });
    p.addRoute({ id: 'main', kind: 'local', from: 'source', to: 'target', width: 1, path });
    expect(p.validateRoutes().some((i) => i.detail.includes('short internal corridor jog'))).toBe(true);
  });

  it('rejects unsupported 2x2 wall slabs rather than silently thinning them', () => {
    const p = new StationArchitecturePlan(13, 13);
    const tiles = [];
    for (let y = 2; y <= 9; y++) for (let x = 2; x <= 9; x++) {
      if (x >= 5 && x <= 6 && y >= 5 && y <= 6) continue; // an illegal 2x2 internal hole
      tiles.push({ x, y });
    }
    p.addRegion({ id: 'a', kind: 'room', access: 'restricted', tiles });
    const report = p.audit();
    expect(report.wallSlabs).toBeGreaterThan(0);
    expect(report.issues.some((i) => i.code === 'wall-slab')).toBe(true);
  });

  it('checks the actual rectangular core of a room, not its total area', () => {
    const p = new StationArchitecturePlan(20, 20);
    // 20 cells of floor, but no clear 4x4 core due to an L-shaped footprint.
    const tiles = [...Array.from({ length: 9 }, (_, x) => ({ x: x + 2, y: 2 })),
      ...Array.from({ length: 9 }, (_, y) => ({ x: 2, y: y + 3 }))];
    p.addRegion({ id: 'machine', kind: 'room', access: 'restricted', tiles, requirementId: 'required-machine' });
    p.addRequirement({ id: 'required-machine', role: 'industry', width: 4, height: 4,
      modules: ['module.refinery'], rectangularCore: true });
    const report = p.audit();
    expect(report.sourceRequirements).toBe(1);
    expect(report.fittedRequirements).toBe(0);
    expect(report.issues.some((i) => i.code === 'room-clearance')).toBe(true);
  });

  it('compiles physical 3-tile-wide concourse doors without overlapping the shared wall', () => {
    const p = new StationArchitecturePlan(15, 15);
    p.addRegion(rectangle('dock', 'dock', 3, 3, 3, 7));
    p.addRegion(rectangle('concourse', 'corridor', 7, 3, 3, 7));
    p.addPortal({ id: 'bank', a: 'dock', b: 'concourse', kind: 'door', width: 3,
      tile: { x: 6, y: 5 }, tiles: [{ x: 6, y: 5 }, { x: 6, y: 6 }, { x: 6, y: 7 }] });
    const rows = p.compile().rows;
    expect(rows[5]?.[6]).toBe('D');
    expect(rows[6]?.[6]).toBe('D');
    expect(rows[7]?.[6]).toBe('D');
    expect(p.audit().doors).toBe(3);
  });

  it('shows precisely which rooms lack any public entrance', () => {
    const p = new StationArchitecturePlan(19, 12);
    p.addRegion(rectangle('hall', 'corridor', 2, 3, 3, 5));
    p.addRegion(rectangle('public-room', 'room', 6, 3, 3, 5));
    p.addRegion(rectangle('isolated-room', 'room', 12, 3, 3, 5));
    p.addPortal({ id: 'accessible', a: 'hall', b: 'public-room', tile: { x: 5, y: 5 }, width: 1, kind: 'door' });
    const result = p.audit();
    expect(result.directPublicRoomAccess).toBe(1);
    expect(result.issues).toContainEqual({ code: 'no-direct-access', detail: 'isolated-room' });
    expect(result.issues).toContainEqual({ code: 'unreachable-room', detail: 'isolated-room' });
  });
});

import { architectureOfBuilder, compileStationConstruction, departmentAccessOf, structuralFeedback } from './stationStructuralIntegration';
import { Builder } from './builder';
import { Rng } from '../rng';

describe('native structural integration and department-level access', () => {
  it('distinguishes department access from requiring public doors on every cabin', () => {
    const p = new StationArchitecturePlan(20, 12);
    p.addRegion({ ...rectangle('public', 'corridor', 2, 3, 3, 5), access: 'public' });
    p.addRegion({ ...rectangle('cabin-a', 'room', 6, 3, 3, 5), department: 'habitation' });
    p.addRegion({ ...rectangle('cabin-b', 'room', 10, 3, 3, 5), department: 'habitation' });
    p.addRegion({ ...rectangle('secure-core', 'room', 14, 3, 3, 5), department: 'secure' });
    p.addPortal({ id: 'lobby', kind: 'door', width: 1, tile: { x: 5, y: 5 }, a: 'public', b: 'cabin-a' });
    p.addPortal({ id: 'cabin-door', kind: 'door', width: 1, tile: { x: 9, y: 5 }, a: 'cabin-a', b: 'cabin-b' });
    p.addPortal({ id: 'bad-private-entrance', kind: 'door', width: 1, tile: { x: 13, y: 5 }, a: 'cabin-b', b: 'secure-core' });
    const access = departmentAccessOf(p);
    expect(access.neighborhoods).toBe(2);
    expect(access.accessibleNeighborhoods).toBe(1);
    expect(access.inaccessible[0]?.department).toBe('secure');
    expect(p.audit().directPublicRoomAccess).toBe(1);
    const feedback = structuralFeedback(p);
    expect(feedback.departmentAccess.neighborhoods).toBe(2);
    expect(feedback.departmentAccess.accessibleNeighborhoods).toBe(1);
    expect(feedback.accessPenalty).toBe(4);
  });

  it('makes the canonical boundary compiler a pre-furnishing station emitter, without changing room floor', () => {
    const p = fixture(), g = p.compile();
    const roles = g.regionIds.map((id) => id === 'gallery' ? 'hall' : 'cargo');
    const result = compileStationConstruction(g.rows, new Int16Array(g.owner), roles);
    expect(result.rows).toEqual(g.rows);
    expect(result.changedFloor).toBe(0);
    expect(result.changedWalls).toBe(0);
    expect(result.changedDoors).toBe(0);
    expect(result.report.rooms).toBe(2);
  });

  it('carries native Builder room dimensions and departments into the shared plan before fit-out', () => {
    const b = new Builder(new Rng(13));
    const hall = b.place({ x: -1, y: -1, w: 5, h: 8 }, 'hall');
    expect(hall === null).toBe(false);
    const spec = { role: 'quarters' as const, w: 4, h: 6, mods: ['module.bed'], dept: 'habitation' as const };
    const room = b.attach(hall as NonNullable<typeof hall>, 'e', spec, 0);
    expect(room === null).toBe(false);
    const plan = architectureOfBuilder(b);
    expect(plan.requirements).toHaveLength(1);
    expect(plan.requirements[0]?.width).toBe(4);
    expect(plan.requirements[0]?.height).toBe(6);
    expect(plan.regions.filter((r) => r.kind === 'room')[0]?.department).toBe('habitation');
    expect(plan.audit().fittedRequirements).toBe(1);
    expect(departmentAccessOf(plan).accessibleNeighborhoods).toBe(1);
  });
});

import { sourceModuleDeficits } from './stationStructuralIntegration';
describe('source-program preservation', () => {
  it('catches omitted mandatory modules even when optional furnishings vary', () => {
    const source = [{ modules: ['module.bed', 'module.bed', 'module.lifeSupport'] }];
    expect(sourceModuleDeficits(source, [{ def: 'module.bed' }, { def: 'module.chair' }])).toEqual([
      { def: 'module.bed', needed: 2, found: 1 },
      { def: 'module.lifeSupport', needed: 1, found: 0 },
    ]);
    expect(sourceModuleDeficits(source, [{ def: 'module.bed' }, { def: 'module.bed' }, { def: 'module.lifeSupport' }, { def: 'module.chair' }])).toEqual([]);
  });
});
