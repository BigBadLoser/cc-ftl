import type { Encounter, Fleet, Sim } from '../../sim';
import { peekGenerated, warmContact } from '../../sim/galaxy/arrivals';
import { Rng } from '../../sim/rng';
import type { UiHail } from '../../ui/starmapApi';
import { speakerOf } from './speaker';

/**
 * The adapter from an interdiction (an `Encounter` of kind 'interdict': pirates, raiders, a route guard or hunters stopping the trip) to the comms
 * window's data: the captain, their demand, the fleet's lead ship as the hologram and the fleet's strength. It only reads the sim.
 */

/** Why they stopped you: sent after you, holding up their own route, or out raiding. */
export type InterdictMotive = 'hunter' | 'toll' | 'raid';

export function motiveOf(sim: Sim, f: Fleet): InterdictMotive {
  if (f.hunt) return 'hunter';
  return sim.content.galaxy?.factions[f.faction]?.guardsRoutes ? 'toll' : 'raid';
}

/** The demand, per faction (falling back to the faction kind, then any). `{you}` is how they address the player. Each has two lines. */
type Lines = readonly (readonly [string, string])[];
const THREATS: Record<string, Partial<Record<InterdictMotive, Lines>>> = {
  pirates: {
    raid: [
      ['Cut your drive, {you}. You are carrying more than you need.', 'Pay up or we take it off your wreck.'],
      ['Nice hull you have there. Shame if it got holes in it.', 'Credits, now. Or we start cutting.'],
    ],
  },
  raiders: {
    raid: [
      ['This lane belongs to the clans tonight. Power down and open your hold.', 'Run if you like. We enjoy a chase.'],
      ['{you}, you are boxed in. Nobody is coming for you out here.', 'Pay the clans, or feed them.'],
    ],
  },
  cartel: {
    toll: [
      ['You are flying a Cartel route without a pass, {you}. There is a toll for that.', 'Pay it and nobody gets hurt. Refuse, and we make an example.'],
      ['Every ship on this route pays the Cartel. You are no exception.', 'The toll is fair. The alternative is not.'],
    ],
  },
  zealots: {
    raid: [
      ['The Signal sees you, {you}. Your ship is unclean.', 'Make your offering, or be cleansed.'],
      ['You fly where the Signal is heard. Kneel, or burn.', 'An offering may yet spare you.'],
    ],
  },
  mercenaries: {
    raid: [
      ['Nothing personal, {you}. A job is a job.', 'Make us a better offer than the one we have, and we were never here.'],
    ],
  },
  rogue: {
    raid: [['UNREGISTERED VESSEL. YOU ARE IN A CONTROLLED ZONE. YIELD.', 'COMPLIANCE IS OPTIONAL. SURVIVAL IS NOT.']],
    hunter: [['VESSEL IDENTIFIED. TARGET ACQUIRED.', 'TRANSFER RESOURCES OR BE DISASSEMBLED.']],
  },
};
const HUNTER: Lines = [
  ['There you are, {you}. We have been following your wake for days.', 'There is a price on you. Beat it, or come quietly.'],
  ['{you}. You made enemies, and they paid us well to find you.', 'Make it worth our while to lose you again.'],
];
const ANY: Lines = [['Cut your drive, {you}, and stand by.', 'Pay, or we take what we want.']];

/** What they say once answered, by outcome (`EncounterResult.outcome`). */
const REPLIES: Record<InterdictMotive, Record<string, string>> = {
  raid: {
    bribed: 'Pleasure doing business. Fly safe, now.',
    evaded: 'Slippery. Next time, Captain.',
    evadeFailed: 'Nice try. Now we do this the hard way.',
    fought: 'Your funeral. Weapons free!',
  },
  toll: {
    bribed: 'Toll received. The route is yours. Mind you keep paying.',
    evaded: 'You will be back on our routes. They all come back.',
    evadeFailed: 'You had your chance to pay. Now you pay in hull plating.',
    fought: 'Bad for business, Captain. Yours, not ours.',
  },
  hunter: {
    bribed: 'Lost you in the nebula. Shame. Do not let us find you twice.',
    evaded: 'Run, then. The contract does not expire.',
    evadeFailed: 'Got you. Bring them down, alive if it is easy.',
    fought: 'Dead or alive pays the same. Open fire.',
  },
};
const MACHINE_REPLIES: Record<string, string> = {
  bribed: 'RESOURCES ACCEPTED. PASSAGE GRANTED.',
  evaded: 'TARGET LOST. RECALCULATING.',
  evadeFailed: 'EVASION FAILED. ENGAGING.',
  fought: 'HOSTILE INTENT CONFIRMED. ENGAGING.',
};

/** What the strength word means in the readout's tone. */
const STATUS: Record<InterdictMotive, string> = { hunter: 'Hunting you', toll: 'Route toll', raid: 'Hostile' };

export function pirateHailOf(sim: Sim, e: Encounter, threat: string): UiHail {
  const f = sim.galaxy.fleets.find((x) => x.id === e.fleet);
  const c = f?.ships[0];
  const faction = sim.content.galaxy?.factions[e.faction];
  if (!f || !c) return goneHail(e, faction?.name ?? e.faction);
  warmContact(sim, c);
  const gen = peekGenerated(sim, c)?.template.name;
  const machine = faction?.kind === 'rogue';
  const sp = speakerOf({ contact: c }, gen, faction?.kind);
  const ship = c.name ?? gen ?? 'raider';
  const fname = faction?.name ?? e.faction;
  const motive = motiveOf(sim, f);
  const table = THREATS[e.faction] ?? THREATS[faction?.kind ?? ''] ?? {};
  const pool = (motive === 'hunter' && !machine ? undefined : table[motive]) ?? (motive === 'hunter' ? HUNTER : undefined) ?? table.raid ?? table.toll ?? ANY;
  const [demand, warning] = new Rng((c.seed ^ 0x1d2a3b) >>> 0).pick(pool);
  const fill = (s: string): string => s.replace('{you}', 'Captain');
  const caller = machine ? ship : sp.name;
  const more = e.ships > 1 ? ` with ${e.ships - 1} more behind it` : '';
  return {
    caller: {
      name: caller, role: machine ? '' : 'Captain of the', ship: machine ? fname : ship, faction: `${fname} · ${motive === 'hunter' ? 'hunters' : e.role}`,
      swatch: 'var(--red)', status: { label: STATUS[motive], tone: 'red' },
    },
    look: machine ? null : sp.look,
    transcript: [
      { kind: 'narration', text: `${machine ? ship : `The ${ship}`} drags you out of the jump${more} and opens a channel.` },
      { kind: 'speech', speaker: caller, text: fill(demand) },
      { kind: 'speech', speaker: caller, text: fill(warning) },
    ],
    holo: { faction: c.faction, shipgen: c.shipgen, seed: c.seed, depth: c.depth },
    hullTitle: `${fname.toUpperCase()} ${motive === 'hunter' ? 'HUNTER' : e.role.toUpperCase()}`,
    readout: [
      { label: 'Transponder', value: sp.tag ? `${fname} · ${sp.tag}` : fname, wide: true },
      { label: 'Ships', value: String(e.ships) },
      { label: 'Strength', value: threat },
    ],
    replies: machine ? MACHINE_REPLIES : REPLIES[motive],
    title: 'Interdiction',
    subtitle: `${fname} ${motive === 'hunter' ? 'hunters' : e.role} · halted in hyperspace`,
    hostile: true,
  };
}

/** The fleet left before the answer: the channel is dead, so the window still opens (the trip is halted until it is answered) with static. */
function goneHail(e: Encounter, fname: string): UiHail {
  return {
    caller: { name: e.name, faction: `${fname} · ${e.role}`, swatch: 'var(--red)', status: { label: 'Signal lost', tone: 'dim' } },
    look: null, holo: null, hullTitle: fname.toUpperCase(),
    transcript: [{ kind: 'narration', text: 'The channel is dead. Whoever stopped you is gone.' }],
    readout: [{ label: 'Ships', value: String(e.ships) }],
    replies: {},
    title: 'Interdiction', subtitle: `${fname} · halted in hyperspace`, hostile: true,
  };
}
