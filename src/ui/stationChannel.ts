import type { UiLook, UiTradePartner } from './api';
import type { CommsLine } from './comms/types';

/** The services a station panel offers, each with its own contact on the open channel. */
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

/** The person at a service: the same one every time for this station (name and face come from its id). */
export function contactFor(station: number, id: ServiceId): Contact {
  const k = station * 31 + ORDER.indexOf(id) * 7 + 3;
  const t = TITLE[id];
  return { name: `${FIRST[k % FIRST.length]} ${LAST[(k >> 2) % LAST.length]}`, title: t.title, look: { species: 'species.human', role: t.role, appearanceSeed: k } };
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** The services this station has, with a note drawn from its real state. */
export function servicesFor(p: UiTradePartner, jobs: number, hire: number): Service[] {
  const i = p.info;
  const out: Service[] = [{ id: 'station', label: 'Station', note: 'dock control' }];
  if (p.trades) out.push({ id: 'trade', label: 'Trade', note: 'opens trade', opens: true });
  out.push({ id: 'jobs', label: 'Jobs', note: jobs ? `${jobs} posted` : 'none posted' });
  out.push({ id: 'crew', label: 'Crew', note: hire ? `${hire} for hire` : 'nobody' });
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
