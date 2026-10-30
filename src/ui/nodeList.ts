import type { UiCombat, UiPrize, UiShuttles, UiTrade } from './api';
import type { FILES } from './tablerIcons';

type IconName = keyof typeof FILES;

export type NodeKind = 'hostile' | 'prize' | 'station' | 'ship' | 'derelict';
export interface NodeEntry { ship: number; name: string; kind: NodeKind }

export const NODE_ICONS: Record<NodeKind, IconName> = { hostile: 'skull', prize: 'prize', station: 'station', ship: 'ship', derelict: 'derelict' };

/** Every other ship or station in the node, once, with the most specific kind winning. Keyed by entity id (a station's is its trader's). Shared by the node strip and the off-screen markers. */
export function nodeEntries(d: { trade: UiTrade; prizes: UiPrize[]; combat: UiCombat; shuttles: UiShuttles }): NodeEntry[] {
  const out: NodeEntry[] = [];
  const home = d.combat.player?.ship ?? 0;
  const add = (ship: number, name: string, kind: NodeKind) => {
    if (ship !== home && ship !== 0 && !out.some((o) => o.ship === ship)) out.push({ ship, name, kind });
  };
  for (const t of d.shuttles.targets) if (t.derelict) add(t.ship, t.name, 'derelict');
  for (const p of d.prizes) add(p.ship, p.name, 'prize');
  for (const e of d.combat.enemies) add(e.ship, e.name, 'hostile');
  for (const p of d.trade.partners) add(p.id, p.name, p.station ? 'station' : p.kind);
  for (const t of d.shuttles.targets) add(t.ship, t.name, 'ship');
  return out;
}
