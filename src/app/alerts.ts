import { CrewC, ModuleC, PositionC, ShipC, roomTiles, type Grid, type Sim, type SimEvent } from '../sim';
import type { UiAlert, UiAlertKind } from '../ui/api';
import { createStore, type Readable } from './store';

const MAX = 6;
const EXPIRE_MS = 45000;

export interface Alerts {
  list: Readable<UiAlert[]>;
  onEvents(events: SimEvent[]): void;
  dismiss(id: number): void;
  get(id: number): UiAlert | undefined;
}

/** Turns sim events into a short, deduplicated, dismissable alert queue (UI-side only; never feeds the sim). */
export function createAlerts(sim: Sim): Alerts {
  const store = createStore<UiAlert[]>([]);
  const keys = new Map<number, string>();
  let nextId = 1;

  const crewName = (id: number) => sim.world.get(id, CrewC)?.name ?? 'Crew';
  const crewAt = (id: number) => {
    const p = sim.world.get(id, PositionC);
    return p ? { x: p.x, y: p.y } : null;
  };
  const roomCentre = (grid: Grid | undefined, room: number) => {
    const tiles = grid ? roomTiles(grid).get(room) : undefined;
    if (!grid || !tiles?.length) return null;
    let sx = 0;
    let sy = 0;
    for (const i of tiles) {
      sx += i % grid.width;
      sy += Math.floor(i / grid.width);
    }
    return { x: sx / tiles.length, y: sy / tiles.length };
  };
  const shipName = (gridId: number) => [...sim.world.query(ShipC)].map((id) => sim.world.get(id, ShipC)).find((s) => s?.gridId === gridId);
  const reactorAt = () => {
    for (const id of sim.world.query(ModuleC)) {
      const m = sim.world.get(id, ModuleC);
      if (m && (sim.content.modules[m.def]?.power ?? 0) > 0) return { x: m.x, y: m.y };
    }
    return null;
  };

  /** Hostile ships and their crew raise no alerts of their own. */
  const foreign = (e: SimEvent): boolean => {
    if (e.type === 'fire.started' || e.type === 'hull.breach' || e.type === 'power.shortage' || e.type === 'o2.low') return e.gridId !== 1;
    if (e.type === 'crew.downed' || e.type === 'crew.died' || e.type === 'crew.rescued') {
      const g = sim.world.get(e.crew, PositionC)?.gridId;
      return g !== undefined && g !== 1;
    }
    return false;
  };

  function describe(e: SimEvent): { kind: UiAlertKind; key: string; text: string; at: UiAlert['at'] } | null {
    if (foreign(e)) return null;
    switch (e.type) {
      case 'fire.started': return { kind: e.type, key: `f${e.room}`, text: 'Fire!', at: { x: e.x, y: e.y } };
      case 'hull.breach': return { kind: e.type, key: `b${e.room}`, text: 'Hull breach', at: roomCentre(sim.grids.get(e.gridId), e.room) };
      case 'power.shortage': return { kind: e.type, key: 'p', text: `Power shortage (${Math.round(e.supply)}/${Math.round(e.demand)})`, at: reactorAt() };
      case 'o2.low': return { kind: e.type, key: `o${e.room}`, text: 'Low oxygen', at: roomCentre(sim.grids.get(e.gridId), e.room) };
      case 'crew.downed': return { kind: e.type, key: `d${e.crew}`, text: `${crewName(e.crew)} is down`, at: crewAt(e.crew) };
      case 'crew.died': return { kind: e.type, key: `x${e.crew}`, text: `${crewName(e.crew)} died`, at: crewAt(e.crew) };
      case 'crew.rescued': return { kind: e.type, key: `r${e.crew}`, text: `${crewName(e.crew)} rescued`, at: crewAt(e.crew) };
      case 'job.missingMaterials':
        return { kind: e.type, key: `m${e.x},${e.y}`, text: `Missing ${sim.content.items[e.item]?.name ?? e.item}`, at: { x: e.x, y: e.y } };
      case 'storage.full':
        return { kind: e.type, key: `s${e.x},${e.y}`, text: `Storage full (${sim.content.items[e.item]?.name ?? e.item})`, at: { x: e.x, y: e.y } };
      case 'production.done':
        return { kind: e.type, key: `pd${e.module}`, text: `${sim.content.recipes[e.recipe]?.name ?? 'Batch'} done`, at: { x: e.x, y: e.y } };
      case 'combat.started': return { kind: e.type, key: 'cs', text: 'Hostile ship in range: combat!', at: null };
      case 'module.destroyed': {
        const s = shipName(e.gridId);
        if (s?.faction !== 'player') return null;
        return { kind: e.type, key: `md${e.moduleId}`, text: `${sim.content.modules[e.def]?.name ?? 'Module'} destroyed`, at: null };
      }
      case 'ship.destroyed': {
        const s = shipName(e.gridId);
        return s?.faction === 'player'
          ? { kind: 'ship.lost', key: 'sl', text: 'Your ship is destroyed', at: null }
          : { kind: e.type, key: `sd${e.gridId}`, text: `${s?.name ?? 'Ship'} destroyed`, at: null };
      }
      case 'ship.fled': return { kind: e.type, key: `sf${e.gridId}`, text: `${shipName(e.gridId)?.name ?? 'Ship'} jumped away`, at: null };
      default: return null;
    }
  }

  const remove = (id: number) => {
    keys.delete(id);
    store.update((l) => l.filter((a) => a.id !== id));
  };

  return {
    list: store,
    get: (id) => store.get().find((a) => a.id === id),
    dismiss: remove,
    onEvents(events) {
      for (const e of events) {
        const d = describe(e);
        if (!d) continue;
        for (const [id, k] of keys) if (k === d.key) remove(id);
        const id = nextId++;
        keys.set(id, d.key);
        store.update((l) => [{ id, kind: d.kind, text: d.text, at: d.at }, ...l].slice(0, MAX));
        setTimeout(() => remove(id), EXPIRE_MS);
      }
      for (const id of [...keys.keys()]) if (!store.get().some((a) => a.id === id)) keys.delete(id);
    },
  };
}
