import type { Sim } from '../sim';
import { isKnown, learn } from '../modules/blueprints';
import { portOf, portsAt } from './portIndex';
import type { Port } from './ports';
import { tierOf } from './standing';
import { nodeOf } from './state';

/** Blueprint price = the def's base price x (1 + BLUEPRINT_PRICE_PER_DANGER x the station's danger tier), rounded. */
export const BLUEPRINT_PRICE_PER_DANGER = 0.15;

/** A blueprint for sale at a port. */
export interface BlueprintOffer {
  def: string;
  name: string;
  tier: number;
  price: number;
  known: boolean;
}

/** Whether the port's structure lists the blueprints service. */
function sells(sim: Sim, port: Port): boolean {
  const s = nodeOf(sim, port.node)?.structures[Number(port.id.slice(port.id.indexOf('#') + 1))];
  return !!s && !!sim.content.galaxy?.structures[s.def]?.services?.includes('blueprints');
}

/** The blueprints a port sells: those whose `minDanger` its node's danger tier reaches (Mk II from the middle tiers, Mk III only deep). None from a hostile faction. */
export function portBlueprints(sim: Sim, port: Port): BlueprintOffer[] {
  if (!sells(sim, port) || tierOf(sim, port.owner) === 'hostile') return [];
  const danger = nodeOf(sim, port.node)?.danger ?? 0;
  const out: BlueprintOffer[] = [];
  for (const [def, d] of Object.entries(sim.content.modules)) {
    if (!d.blueprint || danger < d.blueprint.minDanger) continue;
    out.push({ def, name: d.name, tier: d.blueprint.tier, price: Math.round(d.blueprint.price * (1 + BLUEPRINT_PRICE_PER_DANGER * danger)), known: isKnown(sim, def) });
  }
  return out.sort((a, b) => a.tier - b.tier || (a.def < b.def ? -1 : 1));
}

const reject = (sim: Sim, reason: string): void => void sim.events.emit({ type: 'command.rejected', command: 'blueprint.buy', reason });

/**
 * `blueprint.buy`: pay for a blueprint at a port of the player's node. Rejected: `notHere`, `noOffer` (the port does not sell it),
 * `alreadyKnown`, `cantAfford`.
 */
export function buyBlueprint(sim: Sim, portId: string, def: string): void {
  if (sim.sector.state !== 'active' || sim.galaxy.event) return reject(sim, 'notHere');
  const port = portOf(sim, portId);
  if (!port || !portsAt(sim, sim.galaxy.current).some((p) => p.id === port.id)) return reject(sim, 'notHere');
  const offer = portBlueprints(sim, port).find((o) => o.def === def);
  if (!offer) return reject(sim, 'noOffer');
  if (offer.known) return reject(sim, 'alreadyKnown');
  if (sim.trade.credits < offer.price) return reject(sim, 'cantAfford');
  sim.trade.credits -= offer.price;
  learn(sim, def);
  sim.events.emit({ type: 'blueprint.bought', def, port: portId, cost: offer.price });
}
