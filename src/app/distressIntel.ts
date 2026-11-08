import type { Sim } from '../sim';
import type { SceneShip, SceneSpec } from '../sim/scene/types';

/**
 * What a scan of a ship in trouble reads (DESIGN.md "Distress freighter"): its hull, what is broken and the failing system's clock, its cargo, and
 * whether raiders are on it or coming (the scene's hostile ships: there from the start, or due late). True to the spec the scene opens with.
 */
const itemName = (sim: Sim, id: string): string => sim.content.items[id]?.name ?? id;
const moduleName = (sim: Sim, d: { def?: string; category?: string }): string => (d.def ? sim.content.modules[d.def]?.name ?? d.def : d.category ?? 'Systems');

export function distressRows(sim: Sim, spec: SceneSpec, s: SceneShip, owner: string): { label: string; value: string }[] {
  const failing = s.damage?.find((d) => d.failing);
  const other = (s.damage ?? []).filter((d) => !d.failing);
  const clock = spec.timers.find((t) => t.ship !== undefined && t.ship === s.tag && t.due === 'wreck');
  const raiders = spec.ships.filter((o) => o !== s && o.stance === 'hostile');
  const late = raiders.filter((o) => o.arriveAfter !== undefined);
  const near = raiders.length - late.length;
  const soonest = late.reduce((m, o) => Math.min(m, o.arriveAfter as number), Infinity);
  return [
    { label: 'Transponder', value: owner },
    { label: 'Hull', value: s.family ? `${s.family[0]?.toUpperCase()}${s.family.slice(1)} class, drifting` : 'Drifting' },
    ...(failing ? [{ label: 'Failing', value: `${moduleName(sim, failing)} at ${failing.pct}%${clock ? `, about ${Math.round(clock.afterSec / 10) * 10} s to breach` : ''}` }] : []),
    ...(other.length ? [{ label: 'Damage', value: other.map((d) => `${moduleName(sim, d)} at ${d.pct}%`).join(', ') }] : []),
    { label: 'Crew aboard', value: s.crew === undefined ? 'Unclear' : String(s.crew) },
    { label: 'Cargo', value: (s.cargo ?? []).length ? (s.cargo ?? []).map((q) => itemName(sim, q.item)).join(', ') : 'Empty hold' },
    {
      label: 'Raiders',
      value: near > 0 ? `${near === 1 ? 'A hostile ship' : `${near} hostile ships`} on it now` : late.length ? `Jump signatures inbound, about ${Math.round(soonest / 10) * 10} s out` : 'None on the scope',
    },
  ];
}
