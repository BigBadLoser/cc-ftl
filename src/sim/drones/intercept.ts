import { BodyC, type Body } from '../body';
import { ProjectileC, ShipC } from '../combat/components';
import { chipShuttle, droneThreats, incomingShots, shipCentre, shuttleThreat, underThreat } from '../combat/intercept';
import { shipById } from '../combat/ships';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { VehicleC } from '../vehicles/components';
import { DroneC, type Drone, type DroneTarget } from './components';
import { damageDrone } from './damage';
import { steer } from './space';
import type { DroneJobDef } from './types';
import type { Candidate, KindRules } from './work';

type Intercept = Extract<DroneJobDef, { kind: 'intercept' }>;

/** How fast a drone circles, as a share of its flight speed (it can always catch up with its own orbit point). */
const ORBIT_PACE = 0.8;

/**
 * The defence drone's job (DESIGN.md "Drones"): while its ship is under threat (a ship at war with it is in play), circle the ship `gap`
 * tiles off its rectangle and shoot what is already hostile and in range. Every drone on the job shares one target (its ship), so the
 * claim rule does not apply. What may be shot is the shared rule of the ship's defences (combat/intercept.ts), so a drone never provokes.
 */
export const intercept: KindRules<Intercept> = {
  where: 'space',
  shared: true,
  candidates(sim, ship) {
    const c = shipCentre(sim, ship);
    if (!c || sim.world.get(ship, ShipC)?.state !== 'active' || !underThreat(sim, ship)) return [];
    return [{ kind: 'intercept', id: ship, x: Math.floor(c.x), y: Math.floor(c.y), rank: 0 } satisfies Candidate];
  },
  valid: (sim, ship) => sim.world.get(ship, ShipC)?.state === 'active' && underThreat(sim, ship),
  work(sim, id, d, t, job) {
    const b = sim.world.get(id, BodyC);
    if (!b) return 'done';
    orbit(sim, id, d, b, t, job);
    fire(sim, id, d, b, job);
    return 'working';
  },
};

/**
 * One tick round the ship's orbit (an ellipse `gap` tiles off its rectangle). The ship's guards share it evenly: each holds its own place
 * (by id among the drones on the job), and the places turn round the ship at ORBIT_PACE of a drone's speed; a drone off its place flies to it.
 */
function orbit(sim: Sim, id: number, d: Drone, b: Body, t: DroneTarget, job: Intercept): void {
  const s = shipById(sim, t.id);
  if (!s) return;
  const speed = sim.content.drones?.[d.def]?.speed ?? 1;
  const cx = s.x + s.width / 2, cy = s.y + s.height / 2;
  const a = s.width / 2 + job.gap, e = s.height / 2 + job.gap;
  const guards = sim.world.query(DroneC).filter((g) => {
    const o = sim.world.get(g, DroneC);
    return !!o && o.ship === d.ship && o.space && o.state === 'out' && o.target?.kind === 'intercept';
  });
  const k = Math.max(0, guards.indexOf(id));
  const turn = (sim.tick * speed * ORBIT_PACE) / TICK_HZ / ((a + e) / 2);
  const angle = turn + (2 * Math.PI * k) / Math.max(1, guards.length);
  steer(b, cx + Math.cos(angle) * a, cy + Math.sin(angle) * e, speed);
}

/** Take a shot when the gun is ready: an incoming shot at its ship first, then the nearest enemy drone, then the nearest enemy shuttle. */
function fire(sim: Sim, id: number, d: Drone, b: Body, job: Intercept): void {
  if (d.cool > 0) {
    d.cool--;
    return;
  }
  const ship = d.ship;
  const near = (x: number, y: number): number => Math.hypot(x - b.x, y - b.y);
  const ready = (): void => {
    d.cool = Math.round(job.fireSec * TICK_HZ);
  };
  const shot = nearest(incomingShots(sim, ship), (pid) => {
    const p = sim.world.get(pid, ProjectileC);
    return p ? near(p.x, p.y) : Infinity;
  }, job.range);
  const p = shot && sim.world.get(shot, ProjectileC);
  if (shot && p) {
    ready();
    b.heading = Math.atan2(p.y - b.y, p.x - b.x);
    if (sim.rng.chance(job.hitChance)) {
      sim.events.emit({ type: 'projectile.intercepted', projectile: shot, weapon: p.weapon, ship, by: id });
      sim.world.destroyEntity(shot);
    } else sim.events.emit({ type: 'drone.fired', drone: id, x: p.x, y: p.y, hit: false });
    return;
  }
  const enemy = droneThreats(sim, ship, b.x, b.y, job.range)[0];
  const eb = enemy && sim.world.get(enemy, BodyC);
  if (enemy && eb) {
    ready();
    b.heading = Math.atan2(eb.y - b.y, eb.x - b.x);
    sim.events.emit({ type: 'drone.fired', drone: id, x: eb.x, y: eb.y, hit: true });
    damageDrone(sim, enemy, job.droneDamage, 'drone');
    return;
  }
  const shuttles = sim.world.query(VehicleC).filter((vid) => shuttleThreat(sim, ship, vid, b.x, b.y, job.range));
  const vid = nearest(shuttles, (v) => {
    const vb = sim.world.get(v, BodyC);
    return vb ? near(vb.x, vb.y) : Infinity;
  }, job.range);
  const vb = vid && sim.world.get(vid, BodyC);
  if (!vid || !vb) return;
  ready();
  b.heading = Math.atan2(vb.y - b.y, vb.x - b.x);
  sim.events.emit({ type: 'drone.fired', drone: id, x: vb.x, y: vb.y, hit: true });
  chipShuttle(sim, vid, job.shuttleDamage);
}

/** The id with the least `dist` within `range`, lowest id on ties; 0 when none is in range. */
function nearest(ids: readonly number[], dist: (id: number) => number, range: number): number {
  let best = 0, bestD = range;
  for (const id of ids) {
    const dd = dist(id);
    if (dd <= bestD && (dd < bestD || !best || id < best)) [best, bestD] = [id, dd];
  }
  return best;
}
