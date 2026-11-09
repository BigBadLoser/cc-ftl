import type { UiLook, UiTradePartner } from './api';
import type { CommsLine } from './comms/types';

/**
 * The services an open comms channel offers, each with its own contact. Every partner (station or ship) has the channel itself ('station':
 * dock control on a station, the bridge on a ship); the rest come from what the partner really has.
 */
export type ServiceId = 'station' | 'trade' | 'jobs' | 'crew' | 'blueprints' | 'yard';

export interface Service {
  id: ServiceId;
  label: string;
  /** The right-hand note on the service button ("2 posted"). */
  note: string;
  /** Trade opens its own window (and the panel closes) instead of showing content here. */
  opens?: boolean;
}

export interface Contact { name: string; title: string; look: UiLook }

const FIRST = ['Hana', 'Orin', 'Mira', 'Tove', 'Dax', 'Ines', 'Kofi', 'Lena', 'Brek', 'Yuri', 'Sana', 'Mox'];
const LAST = ['Voss', 'Kade', 'Lund', 'Okoro', 'Reyes', 'Hale', 'Tran', 'Ivanov', 'Quill', 'Mbeki', 'Arden', 'Sato'];
const TITLE: Record<ServiceId, { title: string; role: string }> = {
  station: { title: 'Dock control', role: 'role.security' }, trade: { title: 'Quartermaster', role: 'role.engineer' }, jobs: { title: 'Job broker', role: 'role.pilot' },
  crew: { title: 'Recruiter', role: 'role.medic' }, blueprints: { title: 'Archivist', role: 'role.scientist' }, yard: { title: 'Yard master', role: 'role.engineer' },
};
const ORDER: ServiceId[] = ['station', 'trade', 'jobs', 'crew', 'blueprints', 'yard'];

/** On a ship the channel is its bridge: the captain answers. */
const BRIDGE = { title: 'Captain', role: 'role.pilot' };

/** The person at a service: the same one every time for this partner (name and face come from its id). */
export function contactFor(partner: number, id: ServiceId, ship = false): Contact {
  const k = partner * 31 + ORDER.indexOf(id) * 7 + 3;
  const t = ship && id === 'station' ? BRIDGE : TITLE[id];
  return { name: `${FIRST[k % FIRST.length]} ${LAST[(k >> 2) % LAST.length]}`, title: t.title, look: { species: 'species.human', role: t.role, appearanceSeed: k } };
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/**
 * The services this partner has, with a note drawn from its real state. The job board belongs to a station's port; crew for hire shows wherever
 * someone is hiring out (always listed on a station, which keeps a roster). A partner that has not answered offers only the channel itself.
 */
export function servicesFor(p: UiTradePartner, jobs: number, hire: number): Service[] {
  const i = p.info;
  const out: Service[] = [p.station ? { id: 'station', label: 'Station', note: 'dock control' } : { id: 'station', label: 'Bridge', note: 'captain' }];
  if (!p.station && p.hail !== 'answered') return out;
  if (p.trades) out.push({ id: 'trade', label: 'Trade', note: 'opens trade', opens: true });
  if (p.station) out.push({ id: 'jobs', label: 'Jobs', note: jobs ? `${jobs} posted` : 'none posted' });
  if (p.station || hire) out.push({ id: 'crew', label: 'Crew', note: hire ? `${hire} for hire` : 'nobody' });
  if (i?.services.includes('Blueprints')) out.push({ id: 'blueprints', label: 'Blueprints', note: `${i.blueprints.filter((b) => !b.known).length} new` });
  if (i?.yard) out.push({ id: 'yard', label: 'Shipyard', note: 'hull expansion' });
  return out;
}

/** The narration and the contact's quote for a service, drawn from the station's real state. */
export function linesFor(id: ServiceId, p: UiTradePartner, c: Contact, jobs: number, hire: number): CommsLine[] {
  const i = p.info;
  const say = (text: string): CommsLine => ({ kind: 'speech', speaker: c.name, text });
  const nar = (text: string): CommsLine => ({ kind: 'narration', text });
  switch (id) {
    case 'station':
      if (!p.station) return shipLines(p, c);
      return [nar(`${p.name} answers. Dock control comes on the line.`), say(i?.alarm ? `Alarm is up: ${i.alarm}. Keep your hands off the guns.` : `${plural(i?.docks ?? 0, 'dock')} working, ${plural(i?.guns ?? 0, 'gun')} on the ring. Behave and we get along.`)];
    case 'trade':
      return [nar('The quartermaster opens the ledger.'), say(`${plural(p.lines.filter((l) => l.theirs > 0).length, 'line')} on the shelves. Tell me what you need.`)];
    case 'jobs':
      return [nar(`${p.name} routes you to the job board.`), say(jobs ? `${plural(jobs, 'run')} on the board. Read the terms before you take one.` : 'Nothing posted. Check back when the traffic turns over.')];
    case 'crew':
      return [nar('The recruiter looks up from a stack of files.'), say(hire ? `${plural(hire, 'hand')} looking for a berth. Pay up front, shuttle brings them over.` : 'Nobody on the roster today.')];
    case 'blueprints':
      return [nar('The archivist keeps one eye on the vault door.'), say((i?.blueprints.length ?? 0) ? 'Plans for sale. Not many places still have these.' : 'The vault is empty for now.')];
    default:
      return [nar('The yard master walks you through the dock.'), say(`We lay hull plates at ${i?.yard?.price.credits ?? 0} credits and ${i?.yard?.price.metal ?? 0} metal a tile. Plan it from the build tools.`)];
  }
}

/** Why a refused hail was refused, as the channel tells it. */
export const REFUSAL: Record<string, string> = {
  hostile: 'They have no interest in talking to you.', weaponsHot: 'Their guns are on you: they will not talk.',
  silent: 'No answer. Nobody is aboard to hear.', noTrade: 'They have nothing to trade.',
  barred: 'You refused their inspectors: they will not deal with you for a while.',
};

/** A ship's bridge on the channel: calling, the refusal, or the captain's greeting drawn from what they carry. */
function shipLines(p: UiTradePartner, c: Contact): CommsLine[] {
  if (p.hail === 'none') return [{ kind: 'narration', text: `Hailing ${p.name}...` }];
  if (p.hail === 'refused') return [{ kind: 'narration', text: REFUSAL[p.reason] ?? 'They refuse to talk.' }];
  const goods = p.lines.filter((l) => l.theirs > 0).length;
  return [
    { kind: 'narration', text: `${p.name} answers. The captain comes on the line.` },
    { kind: 'speech', speaker: c.name, text: p.trades ? `Trading, are we? ${plural(goods, 'line')} in the hold, if the price is right.` : 'Say what you want and keep your guns cold.' },
  ];
}
