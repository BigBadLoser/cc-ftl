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
import { createModuleView, shipHasPower, type ModuleDefs } from './moduleView';
import { createRoofView, ROOF_H } from './roofView';
import { createTargetMarks } from './targetMarks';

export interface ShipSceneOptions {
  world: World;
  atlas: Atlas;
  modules: ModuleDefs;
  items: Readonly<Record<string, ItemDef>>;
  /** Blurred glow halos (Quality High); only worth it on the player's ship. */
  halos: boolean;
  roofed: boolean;
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
    light: () => ({ data: grid.raw('light'), width: grid.width }),
  });
  const jobView = createJobView(world, atlas, L, { target: inside });
  const moduleView = createModuleView(world, atlas, L, modules, { target: inside, emergency: () => emergency });
  const itemView = createItemView(world, atlas, L, items, { target: inside, emergency: () => emergency });
  const fxView = createFxView(atlas, L, { target: inside });
  const particles = createParticles(atlas, L);
  const atmosphere = createAtmosphere(world, particles, modules, { target: () => ({ grid }) });
  const roof = createRoofView(grid, atlas, L, world, modules);
  const wallHeight = () => (roofed ? ROOF_H : cutaway === 'up' ? ROOF_H : 6);
  const damage = createDamageView(grid, L, wallHeight);
  const marks = createTargetMarks(grid, world, modules, L);
  const applyMode = () => view.setCutaway(roofed ? 'up' : cutaway);
  applyMode();
  roof.setVisible(roofed);

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
      damage.update();
      marks.update(marksOn, targeted, roofed ? ROOF_H : 0);
    },
    setRoofed(r) {
      roofed = r;
      applyMode();
      roof.setVisible(r);
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
