import { CombatC, ShipC } from '../combat/components';
import { dropAims } from '../combat/stations';
import type { Sim } from '../sim';
import { headHome } from './agenda';
import type { Engagement } from '../combat/engagementTypes';
import { engagements, sideIn, sideShips } from './engagements';
import { sendOff } from './fleetShips';
import { report } from './news';
import { owe } from './portIndex';
import type { Fleet } from './types';

/**
 * A ship taken in a fight between NPC ships (#603: NPCs treat each other as they would the player). `captureSystem` calls this when a boarding
 * party of the other side holds the bridge of a subdued ship. The ship changes hands as one taken by the player would: it leaves its fleet (its port
 * owes a replacement, as for any ship lost) and joins the captor's fleet as its prize under the captor's colours (its descriptor moves, so the
 * galaxy faction follows: heat.ts `factionOfShip`), on the captor's side of the fight; the captor heads home with it. The news says "X took Y", and
 * the fight records the side that lost a ship this way (`Engagement.taken`), so its end reads as a capture.
 */
export function takeShip(sim: Sim, ship: number, captor: number): void {
  const e = engagements(sim).find((x) => {
    const a = sideIn(sim, x, ship);
    const b = sideIn(sim, x, captor);
    return a >= 0 && b >= 0 && a !== b;
  });
  const s = sim.world.get(ship, ShipC);
  const by = sim.world.get(captor, ShipC);
  if (!e || !s || !by) return;
  const lose = sideIn(sim, e, ship) as 0 | 1;
  const win = lose === 0 ? 1 : 0;
  const fleets = (side: 0 | 1): Fleet[] => e.fleets[side].map((id) => sim.galaxy.fleets.find((f) => f.id === id)).filter((f): f is Fleet => !!f);
  const from = fleets(lose).find((f) => f.ships.some((c) => c.ship === ship));
  const to = fleets(win).find((f) => f.ships.some((c) => c.ship === captor)) ?? fleets(win)[0];
  const contact = from?.ships.find((c) => c.ship === ship);
  const name = contact?.name ?? s.name;
  e.members[lose] = e.members[lose].filter((m) => m.ship !== ship);
  if (!e.taken?.includes(lose)) (e.taken ??= []).push(lose);
  s.faction = by.faction;
  if (from && contact) {
    from.ships = from.ships.filter((c) => c !== contact);
    owe(sim, from.home, from.faction, from.role, contact.size ?? 'small', sim.galaxy.turn);
  }
  if (to && contact) {
    const prize = { ...contact, id: sim.galaxy.nextFleet++, faction: to.faction, ship };
    to.ships.push(prize);
    e.members[win].push({ ship, contact: prize.id });
    headHome(sim, to);
  } else {
    e.members[win].push({ ship });
  }
  delete s.yielded; // settled: it was taken, and its beaten crew stay aboard as captives who never give it up again (`Ship.taken`)
  s.taken = true;
  // The ship is on the captor's side now: neither aims at the other any more (#609 review), even while the node is otherwise in combat.
  const side = new Set(e.members[win].map((m) => m.ship));
  for (const id of side) {
    if (id === ship) continue;
    dropAims(sim, id, (t) => t === ship);
    const c = sim.world.get(id, CombatC);
    if (c?.prey === ship) delete c.prey;
  }
  dropAims(sim, ship, (t) => side.has(t));
  const own = sim.world.get(ship, CombatC);
  if (own?.prey !== undefined && side.has(own.prey)) delete own.prey;
  report(sim, { node: e.node, kind: 'taken', who: e.names[win], faction: e.factions[win], foe: name, foeFaction: e.factions[lose] }, sim.galaxy.turn);
  sim.galaxy.rev++;
}

/**
 * A ship beaten in a fight between NPC ships yields (`Ship.yielded`, set by the same shipState rule as for the player: crew all subdued, no foe
 * boarding it), and its foe answers as the player would, by its faction's habit (`GalaxyFactionDef.takesPrizes`): a pirate takes the ship as its
 * prize, crew aboard (`takeShip`); anyone else lets it go, and its fleet jumps away (`sendOff`), so the fight ends with the foe the winner. Only in
 * meetings: in an aid fight the yielding ship attacked the player, who answers it.
 */
export function answerYields(sim: Sim, e: Engagement): void {
  if (e.kind !== 'meeting') return;
  for (const side of [0, 1] as const) {
    const foe = side === 0 ? 1 : 0;
    for (const id of sideShips(sim, e, side)) {
      const s = sim.world.get(id, ShipC);
      const captor = sideShips(sim, e, foe)[0];
      if (!s?.yielded || captor === undefined) continue;
      delete s.yielded;
      if (sim.content.galaxy?.factions[e.factions[foe]]?.takesPrizes) {
        takeShip(sim, id, captor);
        continue;
      }
      const own = e.fleets[side].map((x) => sim.galaxy.fleets.find((f) => f.id === x)).find((f) => f?.ships.some((c) => c.ship === id));
      if (own) sendOff(sim, own);
    }
  }
}
