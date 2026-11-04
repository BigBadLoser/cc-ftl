import { ALT, BodyC, type Body } from '../body';
import { IonC } from '../combat/components';
import { ModuleC } from '../modules/components';
import { isTileWalkable } from '../modules/walk';
import { shipGrid } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { DRONE_PATH_TRIES, DRONE_SCAN_TICKS, EMPTY_CHARGE_MULT } from '../tuning';
import { freeSlot, isDroneBay, slotTile, wreckDrone } from './bay';
import { DroneC, type Drone } from './components';
import { arrived, bodyTile, fly, planFlight } from './flight';
import type { DroneDef } from './types';
import { candidatesFor, stillWanted, targetKey, workOn } from './work';

/** Per-tick shared state of the drone pass: claimed targets, and per ship its cap and how many drones are out. */
export interface DronePass {
  claims: Set<string>;
  cap: Map<number, number>;
  out: Map<number, number>;
}

/**
 * One tick of one drone (the drone system, in id order). Knocked out (no core, ion) it drops where it is. Docked it charges and, once charged
 * and with a free core slot, leaves for the first target its job list finds. Out it flies to the target and works it, then takes the next
 * or flies home; low on battery it flies home. Home it docks in its slot (or any free one on its ship) and charges.
 */
export function runDrone(sim: Sim, id: number, pass: DronePass): void {
  const d = sim.world.get(id, DroneC) as Drone;
  const b = sim.world.get(id, BodyC) as Body;
  const def = sim.content.drones?.[d.def];
  if (!def) return;
  if (d.hp <= 0) return wreckDrone(sim, id);
  if (d.bay && !isDroneBay(sim, d.bay)) {
    if (d.state === 'docked') return wreckDrone(sim, id); // lost with its bay
    d.bay = 0;
  }
  // Knocked out: no live core, or ion on the drone (or on the bay it sits in).
  const ion = d.state === 'docked' ? sim.world.get(d.bay, IonC) : undefined;
  if (ion && ion.until > d.stunUntil) {
    d.stunUntil = ion.until;
    sim.events.emit({ type: 'drone.stunned', drone: id, until: ion.until });
  }
  const inert = (pass.cap.get(d.ship) ?? 0) === 0;
  if (inert !== d.inert) {
    d.inert = inert;
    sim.events.emit({ type: inert ? 'drone.inert' : 'drone.active', drone: id });
  }
  if (d.inert || d.stunUntil > sim.tick) return knockedOut(d, b, pass);
  d.stunUntil = 0;

  if (d.state === 'docked') return docked(sim, id, d, b, def, pass);
  const working = d.state === 'out' && !!d.target && d.steps.length === 0;
  d.charge = Math.max(0, d.charge - (def.charge.drainPerSec * (working ? def.charge.workMult : 1)) / TICK_HZ);
  b.alt = ALT.drone;
  if (d.state === 'out' && d.charge < def.charge.lowBelow) goHome(d, pass);
  if (d.state === 'out') return out(sim, id, d, b, def, pass);
  home(sim, id, d, b, def);
}

/** Dropped to the deck (or sitting dark on its pad): it lets its target go. */
function knockedOut(d: Drone, b: Body, pass: DronePass): void {
  if (d.target) pass.claims.delete(targetKey(d.target));
  d.target = null;
  d.steps = [];
  d.work = 0;
  if (d.state === 'docked') {
    b.alt = ALT.dronePad;
    return;
  }
  b.alt = 0; // a flying drone drops; once it is back up it looks for work again (or goes home)
}

function docked(sim: Sim, id: number, d: Drone, b: Body, def: DroneDef, pass: DronePass): void {
  const at = slotTile(sim, d.bay, d.slot);
  b.x = at.x + 0.5;
  b.y = at.y + 0.5;
  b.alt = ALT.dronePad;
  const bay = sim.world.get(d.bay, ModuleC);
  const rate = (bay && sim.content.modules[bay.def]?.droneBay?.chargePerSec) ?? 0;
  if (bay?.powered) d.charge = Math.min(100, d.charge + rate / TICK_HZ);
  if (d.charge < def.charge.launchAbove || (pass.out.get(d.ship) ?? 0) >= (pass.cap.get(d.ship) ?? 0)) return;
  if ((sim.tick + id) % DRONE_SCAN_TICKS !== 0 || !pickTarget(sim, d, b, def, pass)) return;
  d.state = 'out';
  pass.out.set(d.ship, (pass.out.get(d.ship) ?? 0) + 1);
  sim.events.emit({ type: 'drone.launched', drone: id, ship: d.ship });
}

function out(sim: Sim, id: number, d: Drone, b: Body, def: DroneDef, pass: DronePass): void {
  const job = d.target && def.jobs.find((j) => j.kind === d.target?.kind);
  if (d.target && (!job || !stillWanted(sim, d.ship, d.target, job))) dropTarget(d, pass);
  if (!d.target && !pickTarget(sim, d, b, def, pass)) return goHome(d, pass);
  const t = d.target;
  const j = t && def.jobs.find((x) => x.kind === t.kind);
  if (!t || !j) return goHome(d, pass);
  if (d.steps.length > 0 || !arrived(b, t.x, t.y)) {
    const last = d.steps[d.steps.length - 1] ?? bodyTile(b);
    if ((last.x !== t.x || last.y !== t.y) && !planFlight(sim, d, b, t.x, t.y)) return dropTarget(d, pass); // the patient moved off
    if (!fly(d, b, speedOf(d, def), (x, y) => openTile(sim, d.ship, x, y))) d.steps = [];
    return;
  }
  if (workOn(sim, id, d, t, j) === 'done') dropTarget(d, pass);
}

function home(sim: Sim, id: number, d: Drone, b: Body, def: DroneDef): void {
  if (!d.bay) {
    const slot = freeSlot(sim, d.ship);
    if (!slot) return; // nowhere to dock: it hovers and waits
    [d.bay, d.slot] = [slot.bay, slot.slot];
    d.steps = [];
  }
  const at = slotTile(sim, d.bay, d.slot);
  if (d.steps.length === 0 && arrived(b, at.x, at.y)) {
    d.state = 'docked';
    b.alt = ALT.dronePad;
    sim.events.emit({ type: 'drone.docked', drone: id, bay: d.bay });
    return;
  }
  const last = d.steps[d.steps.length - 1];
  if ((!last || last.x !== at.x || last.y !== at.y) && !planFlight(sim, d, b, at.x, at.y)) return;
  if (!fly(d, b, speedOf(d, def), (x, y) => openTile(sim, d.ship, x, y))) d.steps = [];
}

/** A flat battery crawls (the robots' EMPTY_CHARGE_MULT). */
const speedOf = (d: Drone, def: DroneDef): number => def.speed * (d.charge <= 0 ? EMPTY_CHARGE_MULT : 1);

function openTile(sim: Sim, ship: number, x: number, y: number): boolean {
  const grid = shipGrid(sim, ship);
  return !!grid && isTileWalkable(sim, grid, x, y, false, true);
}

function dropTarget(d: Drone, pass: DronePass): void {
  if (d.target) pass.claims.delete(targetKey(d.target));
  d.target = null;
  d.steps = [];
  d.work = 0;
}

function goHome(d: Drone, pass: DronePass): void {
  dropTarget(d, pass);
  d.state = 'home';
}

/**
 * The first job in the def's list with a free target the drone can fly to: nearest first (a downed patient before a scratched one), up to
 * DRONE_PATH_TRIES flight plans per job. Claims it and plans the route. False when there is nothing to do.
 */
function pickTarget(sim: Sim, d: Drone, b: Body, def: DroneDef, pass: DronePass): boolean {
  const from = bodyTile(b);
  for (const job of def.jobs) {
    const cands = candidatesFor(sim, d.ship, job).filter((c) => !pass.claims.has(targetKey(c)));
    if (cands.length === 0) continue;
    const dist = (c: { x: number; y: number }) => Math.max(Math.abs(c.x - from.x), Math.abs(c.y - from.y)) * 10 + Math.min(Math.abs(c.x - from.x), Math.abs(c.y - from.y)) * 4;
    cands.sort((p, q) => p.rank - q.rank || dist(p) - dist(q) || p.id - q.id || p.y - q.y || p.x - q.x);
    for (const c of cands.slice(0, DRONE_PATH_TRIES)) {
      if (!planFlight(sim, d, b, c.x, c.y)) continue;
      d.target = { kind: c.kind, id: c.id, x: c.x, y: c.y };
      d.work = 0;
      pass.claims.add(targetKey(d.target));
      return true;
    }
  }
  return false;
}
