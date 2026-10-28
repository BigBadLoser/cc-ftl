/**
 * The translation table: how each component's coordinates move when an entity changes frame (sector tiles to a packet's
 * ship-local tiles on lift, and back at a new offset on stamp). One entry per component name, `null` for components with no
 * coordinates. `translate.test.ts` fails when a declared component has no entry, so a new component must be classified here.
 * Velocities (`ContainerC.vx`), headings and ship-local art data (`ShipC.ruin`) are not positions and do not move.
 */

type Xy = { x: number; y: number };
type Shift = (c: Record<string, unknown>, dx: number, dy: number) => void;

const keys = (...pairs: [string, string][]): Shift => (c, dx, dy) => {
  for (const [kx, ky] of pairs) {
    if (typeof c[kx] === 'number') c[kx] = (c[kx] as number) + dx;
    if (typeof c[ky] === 'number') c[ky] = (c[ky] as number) + dy;
  }
};
const xy = keys(['x', 'y']);
const point = (p: Xy | null | undefined, dx: number, dy: number): void => {
  if (p) {
    p.x += dx;
    p.y += dy;
  }
};

export const TRANSLATE: Record<string, Shift | null> = {
  position: keys(['x', 'y'], ['toX', 'toY']),
  path: (c, dx, dy) => (c.steps as Xy[]).forEach((s) => point(s, dx, dy)),
  module: xy,
  job: xy,
  itemStack: xy,
  drafted: (c, dx, dy) => {
    point(c.target as Xy | null, dx, dy);
    point(c.planned as Xy | undefined, dx, dy);
  },
  body: xy,
  evaFloat: keys(['sx', 'sy']),
  ship: xy,
  projectile: keys(['x0', 'y0'], ['x1', 'y1'], ['x', 'y']),
  eat: xy,
  fighter: (c, dx, dy) => point(c.goal as Xy | undefined, dx, dy),
  eggSac: xy,
  nest: xy,
  alien: keys(['homeX', 'homeY']),
  marker: xy,
  yardCrew: null,
  hullPlan: (c, dx, dy) => (c.tiles as Xy[]).forEach((t) => point(t, dx, dy)),
  hullHits: (c, dx, dy) => (c.hits as Xy[]).forEach((h) => point(h, dx, dy)),
  miningPod: (c, dx, dy) => {
    point(c.target as Xy | null, dx, dy);
    (c.tiles as Xy[] | null)?.forEach((t) => point(t, dx, dy));
  },
  asteroid: (c, dx, dy) => {
    xy(c, dx, dy);
    (c.parts as Xy[]).forEach((r) => point(r, dx, dy));
  },
  station: (c, dx, dy) => [...(c.courts as Xy[]), ...(c.posts as Xy[])].forEach((t) => point(t, dx, dy)),
  // No coordinates:
  airlock: null, deploy: null, combat: null, weapon: null, pointDefense: null, ion: null, captureProgress: null, prize: null,
  container: null, allegiance: null, equip: null, equipOrder: null, emergencyArm: null, stowOrder: null, surrendered: null, prisoner: null, skillXp: null,
  implants: null, storage: null, carrying: null, production: null, crew: null, priorities: null, needs: null,
  assignment: null, health: null, downed: null, dead: null, carried: null, bedClaim: null, mood: null, suit: null,
  trader: null, coreRaider: null, coreRaid: null, coreLink: null, inert: null, stun: null, wreck: null, hacked: null, robotBay: null, fabricator: null,
  vehicle: null, ferry: null, transfer: null, salvageWatch: null, vehicleBay: null, aboard: null, embarkOrder: null, boarder: null, stationCrew: null, forHire: null, stationAlarm: null, wanted: null, research: null,
};

/** A deep copy of one entity's components with every coordinate moved by (dx, dy). Components are plain JSON data. */
export function translated(data: Record<string, unknown>, dx: number, dy: number): Record<string, unknown> {
  const out = JSON.parse(JSON.stringify(data)) as Record<string, Record<string, unknown>>;
  if (dx === 0 && dy === 0) return out;
  for (const [name, c] of Object.entries(out)) {
    const shift = TRANSLATE[name];
    if (shift === undefined) throw new Error(`translated: component "${name}" has no translation table entry`);
    if (shift) shift(c, dx, dy);
  }
  return out;
}
