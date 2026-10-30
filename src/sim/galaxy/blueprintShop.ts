import type { Sim } from '../sim';
import type { ModuleDef } from '../registry';
import { blueprintVenue, isKnown, learn } from '../modules/blueprints';
import { portOf, portsAt } from './portIndex';
import type { Port } from './ports';
import { standing, tierOf } from './standing';
import { strHash, unit } from './hash';
import { nodeOf } from './state';

/** Blueprint price = the def's base price x (1 + BLUEPRINT_PRICE_PER_DANGER x the station's danger tier), rounded. */
export const BLUEPRINT_PRICE_PER_DANGER = 0.15;

/** The odds that a station stocks a blueprint outside its owner's speciality (inside it: always). An owner with no blueprint speciality stocks everything. */
export const OFF_SPECIALITY_STOCK = 0.7;

/** A blueprint for sale at a port. */
export interface BlueprintOffer {
  def: string;
  name: string;
  tier: number;
  price: number;
  known: boolean;
}

/** The station type of a port's structure when it lists the blueprints service (research stations and military stations), else null. */
function venue(sim: Sim, port: Port): 'research' | 'military' | null {
  const s = nodeOf(sim, port.node)?.structures[Number(port.id.slice(port.id.indexOf('#') + 1))];
  const d = s && sim.content.galaxy?.structures[s.def];
  return d?.services?.includes('blueprints') && (d.station === 'research' || d.station === 'military') ? d.station : null;
}

type Shelf = 'sold' | 'gated';

/**
 * The blueprints a port could sell, each `sold` or `gated`. Research stations sell the non-defence modules, military stations the defence ones
 * (`blueprintVenue`); trading stations and dens sell none. Only those whose `minDanger` its node's danger tier reaches (Mk II from the middle
 * tiers, Mk III only deep), and none from a hostile faction. The owner's speciality weights the shelf: a blueprint of one of its categories is
 * always stocked, the others with odds OFF_SPECIALITY_STOCK (a fixed roll per port and def, so the shelf is the same on every visit). An owner
 * with a `gate` (the navy's best defence gear) sells a gated tier only to a standing of at least the gate's number.
 */
function shelf(sim: Sim, port: Port): { def: string; d: ModuleDef; state: Shelf }[] {
  const kind = venue(sim, port);
  if (!kind || tierOf(sim, port.owner) === 'hostile') return [];
  const danger = nodeOf(sim, port.node)?.danger ?? 0;
  const spec = sim.content.galaxy?.factions[port.owner]?.specialities;
  const out: { def: string; d: ModuleDef; state: Shelf }[] = [];
  for (const [def, d] of Object.entries(sim.content.modules)) {
    if (!d.blueprint || danger < d.blueprint.minDanger || blueprintVenue(d) !== kind) continue;
    const category = d.category ?? 'utility';
    if (spec?.blueprints && !spec.blueprints.includes(category) && unit(sim.seed, strHash(`${port.id}|${def}`), 79) >= OFF_SPECIALITY_STOCK) continue;
    const need = spec?.gate?.[category]?.[d.blueprint.tier];
    out.push({ def, d, state: need !== undefined && standing(sim, port.owner) < need ? 'gated' : 'sold' });
  }
  return out;
}

const offerOf = (sim: Sim, port: Port, def: string, d: ModuleDef): BlueprintOffer => {
  if (!d.blueprint) throw new Error(`${def} has no blueprint`);
  const danger = nodeOf(sim, port.node)?.danger ?? 0;
  return { def, name: d.name, tier: d.blueprint.tier, price: Math.round(d.blueprint.price * (1 + BLUEPRINT_PRICE_PER_DANGER * danger)), known: isKnown(sim, def) };
};

const byTier = (a: BlueprintOffer, b: BlueprintOffer): number => a.tier - b.tier || (a.def < b.def ? -1 : 1);

/** The blueprints a port sells now (see `shelf`). */
export const portBlueprints = (sim: Sim, port: Port): BlueprintOffer[] =>
  shelf(sim, port).filter((s) => s.state === 'sold').map((s) => offerOf(sim, port, s.def, s.d)).sort(byTier);

/** The blueprints the port stocks but holds back until the player's standing with its owner is higher. */
export const gatedBlueprints = (sim: Sim, port: Port): BlueprintOffer[] =>
  shelf(sim, port).filter((s) => s.state === 'gated').map((s) => offerOf(sim, port, s.def, s.d)).sort(byTier);

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
