import { Container, Graphics } from 'pixi.js';
import { drones } from '../../src/content/drones';
import { paintDrone, type DroneLook } from '../../src/render/droneView';
import { ALT } from '../../src/sim/body';
import type { LabCell, LabPanel } from './panel';

/**
 * `?panel=drones`: the PLACEHOLDER drones (src/render/droneView.ts `paintDrone`, the game's own drawing), one row per drone type, one cell
 * per state: flying, working, docked on its pad, low battery, ion-stunned, inert (no AI core). `types=drone.repair,drone.medic` picks rows.
 */
const STATES: { label: string; look: (kind: string, work: string) => Partial<DroneLook> }[] = [
  { label: 'flying', look: () => ({}) },
  { label: 'working', look: (_k, w) => ({ working: w }) },
  { label: 'docked', look: () => ({ alt: ALT.dronePad, hover: false }) },
  { label: 'low battery', look: () => ({ battery: 'low' }) },
  { label: 'flat battery', look: () => ({ battery: 'flat' }) },
  { label: 'ion stunned', look: () => ({ alt: 0, down: true, stunned: true, hover: false }) },
  { label: 'inert (no core)', look: () => ({ alt: 0, down: true, hover: false }) },
];

export const dronesPanel: LabPanel = {
  id: 'drones',
  title: 'Drones (placeholder)',
  zoom: 1,
  help: `types=${Object.keys(drones).join(',')}`,
  cells({ params }) {
    const types = (params.get('types') ?? Object.keys(drones).join(',')).split(',').filter((k) => k in drones) as (keyof typeof drones)[];
    const cells: LabCell[] = [];
    for (const id of types) {
      const def = drones[id];
      const kind = def.jobs[0]?.kind ?? 'repair';
      STATES.forEach((st, i) => {
        cells.push({
          label: st.label,
          note: def.name,
          w: 200,
          h: 220,
          at: 0.4,
          loop: 2,
          newRow: i === 0,
          mount(root: Container) {
            const floor = new Graphics().poly([100, 150, 164, 182, 100, 214, 36, 182]).fill(0x2a323a);
            const shadow = new Graphics(), beam = new Graphics(), body = new Graphics();
            const g = new Container();
            g.position.set(100, 182);
            g.addChild(shadow, beam, body);
            root.addChild(floor, g);
            const look: DroneLook = { tint: def.tint, kind, alt: ALT.drone, down: false, stunned: false, battery: 'ok', working: null, hover: true, ...st.look(kind, kind) };
            return (t) => paintDrone({ shadow, beam, body }, look, t, 1);
          },
        });
      });
    }
    return cells;
  },
};
