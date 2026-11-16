/**
 * Cable look study scene (#514, dev only): the game's renderer over a sim that is never stepped. `?layer=base` stamps prefab
 * hull modules joined by frame (Beam) tiles; served with a preview asset base whose beam ids alias the cable study's sprites,
 * the frame draws as the cable with the game's own depth order and hull art. `?layer=ground` stamps flat asteroid ground over
 * the same area, for compositing under the base shot (the frame tiles stand over space in the base sim).
 * `roof=1` roofs the base (the hull from outside).
 */
import { content } from '../../src/content';
import { createRenderer } from '../../src/render/scene';
import { Sim, shipGrid, spawnShip } from '../../src/sim';
import { stampAsteroid } from '../../src/sim/asteroids/place';
import { Struct } from '../../src/sim/structure';
import { roomsSystem } from '../../src/sim/systems/rooms';
import { lightingSystem } from '../../src/sim/systems/lighting';
import { powerSystem } from '../../src/sim/systems/power';

export const ROWS = [
  '.................',
  '.#####.......####',
  '.#___#.......#__#',
  '.#___#=======#__#',
  '.#___#...=...#__#',
  '.#####...=...####',
  '.........=.......',
  '......#######....',
  '......#_____#....',
  '......#_____#....',
  '......#######....',
];
const O = 8;
const q = new URLSearchParams(location.search);
const sim = new Sim(1, content);
let ship: number | null = null;
if (q.get('layer') === 'ground') {
  const w = ROWS[0]!.length + 6, h = ROWS.length + 6;
  const struct = new Uint8Array(w * h).fill(Struct.Ground);
  stampAsteroid(sim, { kind: 'big', seed: 3, coverage: 'open', mass: 0, w, h, struct, ore: new Uint8Array(w * h), amt: new Uint8Array(w * h), parts: [{ x: 0, y: 0, w, h }] }, O - 3, O - 3);
} else {
  ship = spawnShip(sim, { name: 'cable mock', rows: ROWS, crew: [] }, { faction: 'player', x: O, y: O });
  roomsSystem(sim);
  powerSystem(sim);
  lightingSystem(sim);
  // lit as a powered base (the mock has no reactor or lamps): every tile of the region at a lamp's level
  const sg = shipGrid(sim, ship)!;
  for (let y = 0; y < sg.height; y++) for (let x = 0; x < sg.width; x++) sg.set('light', sg.x0 + x, sg.y0 + y, Number(q.get('light') ?? 230));
}
const c = document.getElementById('c') as HTMLCanvasElement;
const r = await createRenderer(c, 'high', sim.world, content);
r.setSector(sim.sector.grid);
const g = ship !== null ? shipGrid(sim, ship) : null;
if (g) r.setGrid(g);
r.showBackdrop(false);
r.setWorldGrid(false);
r.setRoofPlayer(q.get('roof') === '1');
r.resize();
const zoom = Number(q.get('zoom') ?? 1);
for (let i = 0; i < 24 && r.info().zoom < zoom - 1e-9; i++) r.zoomAt(1.2, 0, 0);
for (let i = 0; i < 24 && r.info().zoom > zoom + 1e-9; i++) r.zoomAt(1 / 1.2, 0, 0);
r.focusTile(O + Number(q.get('fx') ?? 8.5), O + Number(q.get('fy') ?? 5));
const loop = (): void => { r.render(1); requestAnimationFrame(loop); };
requestAnimationFrame(loop);
await r.whenArtReady();
(window as unknown as { __ready: boolean }).__ready = true;
