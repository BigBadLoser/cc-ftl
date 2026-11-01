import type { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import type { ItemDef } from '../sim/registry';
import type { Atlas } from './assets/loader';
import { createCrewView } from './crewView';
import { createDamageView } from './damageView';
import { createAtmosphere } from './fx/atmosphere';
import { createParticles } from './fx/particles';
import { createFxView } from './fxView';
import { createGridView, type CutawayMode, type GridView } from './gridView';
import { createItemView } from './itemView';
import { createJobView } from './jobView';
import { createSiteView } from './siteView';
import type { RegionLayers } from './worldLayers';
import { ModuleC } from '../sim/modules/components';
import { createModuleView, shipHasPower, type ModuleDefs } from './moduleView';
import { wallLevel } from './tiles';
import { createRoofView } from './roofView';
import { createRockRoofView } from './rockRoofView';
import { createRuinView } from './ruinView';
import { createEggSacView } from './eggSacView';
import { createJamMarks } from './jamMarks';
import { ShipC } from '../sim/combat/components';
import type { Livery } from './roofPlating';
import { ROOF_H, wallTopPx } from './heights';
import { createTargetMarks } from './targetMarks';
import { crewHidden } from './regionRules';
import { createTurretView } from './turretView';
import { DEFAULT_BEAM_LOOK, type BeamLook } from './beamArt';

export interface ShipSceneOptions {
  world: World;
  atlas: Atlas;
  modules: ModuleDefs;
  items: Readonly<Record<string, ItemDef>>;
  /** The region's layers in the shared world stack (`WorldStack.region`); the scene owns and disposes them. */
  layers: RegionLayers;
  roofed: boolean;
  /** Roof livery (scheme and registry seed); none = plain plating. */
  livery?: Livery | null;
  /** The seconds of air in a full suit tank. */
  suitAirSec?(): number;
  /** Look of the ship's structural beams; default civil. */
  beamLook?: BeamLook;
}

/** One ship grid with all its views (tiles, modules, items, crew, fx): a region decorator of the shared world stack. */
export interface ShipScene {
  readonly grid: Grid;
  readonly layers: RegionLayers;
  readonly view: GridView;
  update(dt: number): void;
  /** Roofed ships hide their interior: roof over the rooms, full-height walls, no crew or items. */
  setRoofed(roofed: boolean): void;
  isRoofed(): boolean;
  /** True if crew standing on tile (x, y) are hidden: an interior tile of this region while it is roofed (§5). */
  hidesCrewAt(x: number, y: number): boolean;
  /** The user's wall-height mode (a roofed ship always draws full-height walls). */
  setCutaway(mode: CutawayMode): void;
  /** Outline targetable modules (and the `targeted` module ids) with roof-height diamonds. */
  setMarks(show: boolean, targeted: ReadonlySet<number>): void;
  setSelectedCrew(ids: readonly number[]): void;
  /** Crew under a region-local art point, with its feet's art y (the nearest to the viewer wins across regions). */
  pickCrew(ax: number, ay: number): { id: number; y: number } | null;
  /** Where a crew member's feet are drawn in this scene's art frame (smoothed like the sprite), or null. */
  crewPos(id: number): { x: number; y: number; h: number } | null;
  pickModule(ax: number, ay: number): number | null;
  /** Module construction sites that are stuck, and the selected one (job ids). */
  setSites(blocked: ReadonlySet<number>, selected: number | null): void;
  /** Module construction site (job id) whose ghost covers a region-local art point, or null. */
  pickSite(ax: number, ay: number): number | null;
  /** Display objects drawn, for the debug stats. */
  sprites(): number;
  dispose(): void;
}

export function createShipScene(grid: Grid, o: ShipSceneOptions): ShipScene {
  const { world, atlas, modules, items } = o;
  const L = o.layers;
  let roofed = o.roofed;
  let cutaway: CutawayMode = 'auto';
  let emergency = false;
  let marksOn = false;
  let wreckEmergency = false;
  let wreckTick = 0;
  let targeted: ReadonlySet<number> = new Set();
  const inside = () => (roofed ? null : { grid });
  const view = createGridView(grid, atlas, L, { emergency: () => emergency, overlayWorld: { world, modules }, beamLook: () => o.beamLook ?? DEFAULT_BEAM_LOOK });
  const crewView = createCrewView(world, atlas, L, {
    target: () => ({ shipId: grid.id, ox: grid.x0, oy: grid.y0 }),
    hidden: (x, y) => crewHidden(grid, roofed, x, y),
    emergency: () => emergency,
    moduleAt: (x, y) => {
      const id = grid.inBounds(x, y) ? grid.get('module', x, y) : 0;
      const m = id ? world.get(id, ModuleC) : undefined;
      const def = m && modules[m.def];
      return m && def ? { m, def } : null;
    },
    light: (x, y) => (grid.inBounds(x, y) ? grid.get('light', x, y) : 0),
    suitAirSec: o.suitAirSec,
    weaponArt: (item) => items[item]?.hand?.art,
  });
  const jobView = createJobView(world, atlas, L, { target: inside });
  const siteView = createSiteView(world, atlas, L, modules, { target: inside });
  const moduleView = createModuleView(world, atlas, L, modules, { target: () => ({ grid }), emergency: () => emergency, roofed: () => roofed, level: () => wallLevel(roofed ? 'up' : cutaway), ruin: () => world.get(grid.id, ShipC)?.ruin, livery: () => o.livery ?? null });
  const ruinView = createRuinView(grid, atlas, L, world, modules, () => wreckEmergency, view);
  const jamMarks = createJamMarks(grid, atlas, L);
  const sacView = createEggSacView(grid, world, atlas, L, (x, y, wall) => view.tintAt(x, y, wall));
  const itemView = createItemView(world, atlas, L, items, { target: inside, emergency: () => emergency });
  const fxView = createFxView(atlas, L, { target: inside });
  const particles = createParticles(atlas, L);
  const atmosphere = createAtmosphere(world, particles, modules, { target: () => ({ grid }) });
  const turretView = createTurretView(world, atlas, L, grid, modules);
  const roof = createRoofView(grid, atlas, L, world, modules, o.livery ?? null);
  // A dug outpost is roofed with rock, not plating (PLACEHOLDER, rockRoofView.ts).
  // It sits in the fx layer, and while it is on the region's own tile and entity layers hide: the rock around the base is drawn
  // by the asteroid's view, which lies under them, so anything of the base left showing would cut through the rock.
  const rockRoof = world.get(grid.id, ShipC)?.outpost?.style === 'dug' ? createRockRoofView(grid, atlas, L, L.fx) : null;
  const showRoof = (on: boolean) => {
    roof.setVisible(on && !rockRoof);
    rockRoof?.setVisible(on);
    if (rockRoof) for (const c of [L.floor, L.under, L.decal, L.sorted]) c.visible = !on;
  };
  const wallHeight = () => wallTopPx(roofed ? 'up' : cutaway);
  const damage = createDamageView(grid, L, wallHeight);
  const marks = createTargetMarks(grid, world, modules, L.marks);
  const applyMode = () => {
    view.setCutaway(roofed ? 'up' : cutaway, !roofed);
    ruinView.setLevel(wallLevel(roofed ? 'up' : cutaway));
    ruinView.setRoofed(roofed);
  };
  applyMode();
  showRoof(roofed);
  turretView.setRoofed(roofed);

  return {
    grid,
    layers: L,
    view,
    update(dt) {
      rockRoof?.update();
      // region culling re-shows every layer when the region comes into view: keep the base hidden under its rock roof
      if (rockRoof && roofed) for (const c of [L.floor, L.under, L.decal, L.sorted]) c.visible = false;
      // A wreck shows only emergency lighting (the sim scales its lights down), so dark tiles pulse red.
      emergency = shipHasPower(world, modules, grid) === false || world.get(grid.id, ShipC)?.state === "wreck";
      if (world.get(grid.id, ShipC)?.ruin && (wreckTick++ & 15) === 0) {
        wreckEmergency = false;
        for (const id of world.query(ModuleC)) {
          const m = world.get(id, ModuleC);
          if (m && modules[m.def]?.light && grid.inBounds(m.x, m.y) && m.powered && m.hp > 0) wreckEmergency = true;
        }
      }
      view.update();
      ruinView.update();
      jamMarks.update();
      sacView.update();
      moduleView.update();
      siteView.update();
      itemView.update();
      fxView.update();
      atmosphere.update(dt);
      particles.update(dt);
      jobView.update();
      crewView.update();
      roof.update();
      turretView.update();
      damage.update();
      marks.update(marksOn, targeted, roofed ? ROOF_H : 0);
    },
    setRoofed(r) {
      roofed = r;
      applyMode();
      showRoof(r);
      turretView.setRoofed(r);
    },
    isRoofed: () => roofed,
    hidesCrewAt: (x, y) => crewHidden(grid, roofed, x, y),
    setCutaway(m) {
      cutaway = m;
      applyMode();
    },
    setMarks(show, t) {
      marksOn = show;
      targeted = t;
    },
    setSelectedCrew: (ids) => crewView.setSelectedCrew(ids),
    crewPos: (id) => crewView.spritePos(id),
    pickCrew: (ax, ay) => {
      // Crew (aliens included) and live egg sacs (attack targets): the one nearest the viewer wins. Hidden when roofed.
      const c = crewView.pick(ax, ay);
      const s = roofed ? null : sacView.pick(ax, ay);
      return c && s ? (s.y > c.y ? s : c) : (c ?? s);
    },
    pickModule: (ax, ay) => moduleView.pick(ax, ay),
    setSites: (blocked, selected) => siteView.setMarks(blocked, selected),
    pickSite: (ax, ay) => (roofed ? null : siteView.pick(ax, ay)),
    sprites: () => particles.count() + L.floor.children.reduce((n, c) => n + c.children.length, 0) + L.sorted.children.length + L.decal.children.length,
    dispose() {
      rockRoof?.dispose();
      marks.dispose();
      damage.dispose();
      roof.dispose();
      ruinView.dispose();
      jamMarks.dispose();
      sacView.dispose();
      turretView.dispose();
      crewView.dispose();
      moduleView.dispose();
      siteView.dispose();
      itemView.dispose();
      fxView.dispose();
      particles.dispose();
      jobView.dispose();
      view.dispose();
      L.dispose();
    },
  };
}
