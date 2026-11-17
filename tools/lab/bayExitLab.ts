import { content } from '../../src/content';
import { createRenderer } from '../../src/render/scene';
import { ALT, BodyC } from '../../src/sim/body';
import { ModuleC, shipGrid } from '../../src/sim';
import { VehicleC } from '../../src/sim/vehicles/components';
import { spawnVehicle } from '../../src/sim/vehicles/lifecycle';
import { launchVehicle, stowVehicle } from '../../src/sim/vehicles/transitions';
import { ORIGIN } from '../layout/camera';
import { addModule, newModule, type Layout } from '../layout/layout';
import { blankLayout } from '../layout/source';
import { buildWorld } from '../layout/world';

/**
 * A pod and a shuttle leaving and entering their bays through the floor doors, on a ship section (`?panel=bay-exit`), through the game's own
 * renderer (the real podView, shuttleView and bay art). The page never ticks the sim: `window.__bx.frame(kind, mode, t)` sets the animation
 * clock to `t` seconds (kind `pod` | `shuttle`, mode `launch` | `land`), puts the craft where its flight has it at `t` and draws one frame; the GIF
 * script (tools/lab/bayExitGif.js) calls it per frame. `?kind=pod&mode=launch&t=2` draws one still.
 */
const ROWS = [
  '##############################',
  ...Array.from({ length: 16 }, () => '#____________________________#'),
  '##############################',
];
const SPEED = 4;
const W = 900, H = 520;

function layout(): Layout {
  let l: Layout = { ...blankLayout(ROWS[0]?.length ?? 1, ROWS.length), name: 'Bay exit section', cells: [...ROWS] };
  l = addModule(l, newModule('module.pod_bay', 21, 2, 0));
  l = addModule(l, newModule('module.vehicle_bay', 20, 8, 0));
  // power and light, so the section is lit as in play
  l = addModule(l, newModule('module.reactor', 2, 2, 0));
  for (const [x, y] of [[8, 3], [14, 3], [8, 9], [14, 9], [8, 14], [14, 14], [20, 14], [26, 5], [26, 11], [27, 15]] as const) l = addModule(l, newModule('module.light', x, y, 0));
  return l;
}

export async function mountBayExitLab(target: HTMLElement, params: URLSearchParams): Promise<void> {
  // the animation clock is faked so every frame is exact
  let fake = 1e6;
  let locked = false;
  const realNow = performance.now.bind(performance);
  performance.now = () => (locked ? fake : realNow());
  const world = buildWorld(layout());
  if (!world) throw new Error('the section did not stand');
  const { sim, ship } = world;
  const bays = [...sim.world.query(ModuleC)].filter((id) => ['module.pod_bay', 'module.vehicle_bay'].includes(sim.world.get(id, ModuleC)?.def ?? ''));
  const bayOf = (def: string): number => bays.find((id) => sim.world.get(id, ModuleC)?.def === def) as number;
  const craft = {
    pod: spawnVehicle(sim, 'vehicle.mining_pod', bayOf('module.pod_bay')),
    shuttle: spawnVehicle(sim, 'vehicle.shuttle', bayOf('module.vehicle_bay')),
  };
  const bayId = { pod: bayOf('module.pod_bay'), shuttle: bayOf('module.vehicle_bay') };
  const live = document.createElement('div');
  live.style.cssText = `position:relative;width:${W}px;height:${H}px;background:#07090d`;
  const sheet = document.createElement('style');
  sheet.textContent = '.bx-live{position:absolute;inset:0;width:100%;height:100%}';
  document.head.appendChild(sheet);
  const canvas = document.createElement('canvas');
  canvas.className = 'bx-live';
  live.appendChild(canvas);
  target.appendChild(live);
  document.body.style.background = '#0b0f16';
  for (const e of [document.documentElement, document.body]) { e.style.height = 'auto'; e.style.overflow = 'visible'; }
  const r = await createRenderer(canvas, 'high', sim.world, content);
  r.setSector(sim.sector.grid);
  const grid = shipGrid(sim, ship);
  if (grid) r.setGrid(grid);
  r.setBackdrop({ seed: 7, density: 0.25, body: null, bodyHash: 0 });
  r.setWorldGrid(false);
  r.setCutaway('up');
  r.setRoofPlayer(false);
  r.resize();
  const zoom = Number(params.get('zoom') ?? 0.7);
  for (let i = 0; i < 24 && r.info().zoom < zoom - 1e-9; i++) r.zoomAt(1.2, 0, 0);
  for (let i = 0; i < 24 && r.info().zoom > zoom + 1e-9; i++) r.zoomAt(1 / 1.2, 0, 0);

  const centre = (bay: number): { x: number; y: number } => {
    const m = sim.world.get(bay, ModuleC);
    const def = content.modules[m?.def as keyof typeof content.modules] as { footprint: [number, number] };
    return { x: (m?.x ?? 0) + def.footprint[0] / 2, y: (m?.y ?? 0) + def.footprint[1] / 2 };
  };
  let ready = false;
  /** Put the chosen craft where `t` seconds into its launch or landing has it, and draw one frame. */
  async function frame(kind: 'pod' | 'shuttle', mode: 'launch' | 'land', t: number): Promise<void> {
    fake = 1e6 + t * 1000;
    const id = craft[kind];
    const v = sim.world.get(id, VehicleC);
    const b = sim.world.get(id, BodyC);
    if (!v || !b) return;
    r.focusTile(ORIGIN + (kind === 'pod' ? 25 : 24), ORIGIN + (kind === 'pod' ? 3.5 : 10));
    const c = centre(bayId[kind]);
    const edge = ORIGIN + ROWS[0]!.length;
    if (mode === 'launch') {
      const t0 = 0.3;
      if (t >= t0 && v.state === 'stowed') launchVehicle(sim, id, v);
      if (v.state === 'flying') {
        b.alt = ALT.cruise;
        [b.x, b.y, b.heading] = [c.x + SPEED * (t - t0), c.y, 0];
      }
    } else {
      const startX = edge + 5;
      const x = startX - SPEED * t;
      if (v.state === 'stowed' && t < 0.01) { v.state = 'flying'; v.dest = { type: 'bay' }; b.alt = ALT.cruise; }
      if (v.state === 'flying') {
        [b.x, b.y, b.heading] = [Math.max(c.x, x), c.y, Math.PI];
        b.alt = ALT.cruise;
        if (x <= c.x) { [b.x, b.y] = [c.x, c.y]; stowVehicle(sim, id, v); v.dest = null; }
      }
    }
    // art loads on its own clock: draw once, let anything it asked for arrive on the real clock, then draw the frame for real
    locked = true;
    r.render(1 / 20);
    locked = false;
    for (let i = 0; i < (ready ? 2 : 30); i++) { await new Promise((res) => setTimeout(res, ready ? 10 : 40)); }
    await r.whenArtReady();
    ready = true;
    locked = true;
    r.render(1 / 20);
  }
  (window as unknown as { __bx: unknown }).__bx = { frame, reset(kind: 'pod' | 'shuttle') {
    // back to the start: stowed in the bay (the animation clock restarts with a fresh craft state)
    const id = craft[kind];
    const v = sim.world.get(id, VehicleC);
    if (v) { v.state = 'stowed'; v.dest = null; }
  } };
  const kind = params.get('kind') as 'pod' | 'shuttle' | null;
  if (kind) await frame(kind, (params.get('mode') ?? 'launch') as 'launch' | 'land', Number(params.get('t') ?? 0));
}
