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
import { createLayers, type Layers } from './layers';
import { ModuleC } from '../sim/modules/components';
import { createModuleView, shipHasPower, type ModuleDefs } from './moduleView';
import { wallLevel } from './tiles';
import { createRoofView } from './roofView';
import type { Livery } from './roofPlating';
import { ROOF_H, wallTopPx } from './heights';
import { createTargetMarks } from './targetMarks';
import { createTurretView } from './turretView';

export interface ShipSceneOptions {
  world: World;
  atlas: Atlas;
  modules: ModuleDefs;
  items: Readonly<Record<string, ItemDef>>;
  /** Blurred glow halos (Quality High); only worth it on the player's ship. */
  halos: boolean;
  roofed: boolean;
  /** Roof livery (scheme and registry seed); none = plain plating. */
  livery?: Livery | null;
  /** Sector position of a grid's top-left tile (crew floating between ships), and the seconds of air in a full suit tank. */
  shipPos?(gridId: number): { x: number; y: number } | null;
  suitAirSec?(): number;
}

/** One ship grid with all its views (tiles, modules, items, crew, fx), in its own layer stack. */
export interface ShipScene {
  readonly grid: Grid;
  readonly layers: Layers;
  readonly view: GridView;
  update(dt: number): void;
  /** Roofed ships hide their interior: roof over the rooms, full-height walls, no crew or items. */
  setRoofed(roofed: boolean): void;
  isRoofed(): boolean;
  /** The user's wall-height mode (a roofed ship always draws full-height walls). */
  setCutaway(mode: CutawayMode): void;
  /** Outline targetable modules (and the `targeted` module ids) with roof-height diamonds. */
  setMarks(show: boolean, targeted: ReadonlySet<number>): void;
  setSelectedCrew(id: number | null): void;
  pickCrew(ax: number, ay: number): number | null;
  pickModule(ax: number, ay: number): number | null;
  /** Display objects drawn, for the debug stats. */
  sprites(): number;
  dispose(): void;
}

export function createShipScene(grid: Grid, o: ShipSceneOptions): ShipScene {
  const { world, atlas, modules, items } = o;
  const L = createLayers(o.halos);
  let roofed = o.roofed;
  let cutaway: CutawayMode = 'auto';
  let emergency = false;
  let marksOn = false;
  let targeted: ReadonlySet<number> = new Set();
  const inside = () => (roofed ? null : { grid });
  const view = createGridView(grid, atlas, L, { emergency: () => emergency, overlayWorld: { world, modules } });
  const crewView = createCrewView(world, atlas, L, {
    target: () => (roofed ? null : { grid, gridId: grid.id }),
    emergency: () => emergency,
    moduleAt: (x, y) => {
      const id = grid.inBounds(x, y) ? grid.get('module', x, y) : 0;
      const m = id ? world.get(id, ModuleC) : undefined;
      const def = m && modules[m.def];
      return m && def ? { m, def } : null;
    },
    light: () => ({ data: grid.raw('light'), width: grid.width }),
    shipPos: o.shipPos,
    suitAirSec: o.suitAirSec,
  });
  const jobView = createJobView(world, atlas, L, { target: inside });
  const moduleView = createModuleView(world, atlas, L, modules, { target: () => ({ grid }), emergency: () => emergency, roofed: () => roofed, level: () => wallLevel(roofed ? 'up' : cutaway) });
  const itemView = createItemView(world, atlas, L, items, { target: inside, emergency: () => emergency });
  const fxView = createFxView(atlas, L, { target: inside });
  const particles = createParticles(atlas, L);
  const atmosphere = createAtmosphere(world, particles, modules, { target: () => ({ grid }) });
  const turretView = createTurretView(world, atlas, L, grid, modules);
  const roof = createRoofView(grid, atlas, L, world, modules, o.livery ?? null);
  const wallHeight = () => wallTopPx(roofed ? 'up' : cutaway);
  const damage = createDamageView(grid, L, wallHeight);
  const marks = createTargetMarks(grid, world, modules, L);
  const applyMode = () => view.setCutaway(roofed ? 'up' : cutaway, !roofed);
  applyMode();
  roof.setVisible(roofed);
  turretView.setRoofed(roofed);

  return {
    grid,
    layers: L,
    view,
    update(dt) {
      emergency = shipHasPower(world, modules, grid.id) === false;
      view.update();
      moduleView.update();
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
      roof.setVisible(r);
      turretView.setRoofed(r);
    },
    isRoofed: () => roofed,
    setCutaway(m) {
      cutaway = m;
      applyMode();
    },
    setMarks(show, t) {
      marksOn = show;
      targeted = t;
    },
    setSelectedCrew: (id) => crewView.setSelectedCrew(id),
    pickCrew: (ax, ay) => crewView.pick(ax, ay),
    pickModule: (ax, ay) => moduleView.pick(ax, ay),
    sprites: () => particles.count() + L.floor.children.length + L.sorted.children.length + L.decal.children.length,
    dispose() {
      marks.dispose();
      damage.dispose();
      roof.dispose();
      turretView.dispose();
      crewView.dispose();
      moduleView.dispose();
      itemView.dispose();
      fxView.dispose();
      particles.dispose();
      jobView.dispose();
      view.dispose();
      L.world.destroy({ children: true });
    },
  };
}
