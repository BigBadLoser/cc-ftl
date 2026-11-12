import type { BranchRule, Recipe } from '../sim/shipgen/assembly/recipe';

/**
 * Station recipes for the assembly model (docs/STATION_ASSEMBLY.md): what a station is composed of and how its parts
 * stand to each other. Two structures so far, each in a few variations made by changing parameters only.
 */

/** A harbour: one of the quay's forms, tapering inland or (on a ring) as one block. */
const harbour = (form: 'quay' | 'gatehouse' | 'basin', shape: 'taper' | 'block' = 'taper'): NonNullable<BranchRule['quay']> => ({ form, wide: 5, pitch: 7, customs: 7, shape });

/**
 * A scrapper's tree: small modules of whatever rooms came to hand, each on a short stub off one already there; the dock
 * block first, the machinery as one gated module. `mix` false keeps a module to one department.
 */
const scrap = (name: string, o: { rooms: [number, number]; stub: [number, number]; spacing: number; mix: boolean; quarters?: Recipe['quarters']; braces?: number; jog?: [number, number]; cross?: 'any'; harbour?: 'gatehouse' | 'basin' }): Recipe => {
  const section = { rooms: o.rooms, cross: o.cross ?? true };
  const takes = ['commons', 'market', 'freight', 'works', 'habitation', 'defence'] as const;
  return {
    name,
    root: { kind: 'core' },
    spacing: o.spacing,
    ...(o.quarters ? { quarters: o.quarters } : {}),
    ...(o.braces ? { braces: o.braces } : {}),
    branches: [
      { takes: ['harbour'], per: 'together', host: { on: 'section' }, neck: 0, docks: true, quay: harbour(o.harbour ?? 'quay'), section: { rooms: [2, 6], cross: true }, link: 0 },
      o.mix
        ? { takes, per: 'together', mix: true, host: { on: 'section' }, neck: o.stub, ...(o.jog ? { jog: o.jog } : {}), section, link: 0 }
        : { takes, per: 'department', host: { on: 'section' }, neck: o.stub, ...(o.jog ? { jog: o.jog } : {}), section, link: 0, most: 1 },
      { takes: ['secure'], per: 'together', host: { on: 'section' }, neck: 0, gated: true, section: { rooms: [3, 8], cap: true }, link: 0 },
    ],
  };
};

/**
 * A compound: an inhabited ring or arc with a substantial industrial block joined to it. The secure rooms are the gated
 * far end of that block (one mass, its machinery behind a gate) or stand on the arc's other tip; the harbour is a dock
 * block on the rim.
 */
const compound = (name: string, o: {
  outline: 'disc' | 'square'; inner: boolean; gap?: { side: 'n' | 'e' | 's' | 'w'; from: number };
  works: ('n' | 'e' | 's' | 'w')[] | 'tip'; secure: 'behind' | 'tip'; dock: ('n' | 'e' | 's' | 'w')[]; neck: number; rowDepth: number; quarters?: Recipe['quarters']; quay?: BranchRule['quay'];
}): Recipe => ({
  name,
  ...(o.quarters ? { quarters: o.quarters } : {}),
  root: { kind: 'ring', takes: ['habitation', 'defence', 'commons', 'market'], outline: o.outline, cut: 2, inner: o.inner, ...(o.gap ? { gap: o.gap } : {}) },
  spacing: 2,
  branches: [
    { takes: ['works', 'freight'], per: 'together', host: o.works === 'tip' ? { on: 'tip' } : { on: 'rim', prefer: o.works }, neck: o.neck, section: { rooms: [4, 8], rowDepth: o.rowDepth, even: true }, link: 0 },
    { takes: ['secure'], per: 'together', host: o.secure === 'tip' ? { on: 'tip' } : { on: 'after', rule: 0 }, neck: 0, gated: true, section: { rooms: [3, 8], rowDepth: o.secure === 'tip' ? 6 : o.rowDepth, even: true, cap: true }, link: 0 },
    { takes: ['harbour'], per: 'together', host: { on: 'rim', prefer: o.dock, roll: true }, neck: 0, docks: true, ...(o.quay ? { quay: o.quay } : {}), section: { rooms: [2, 6] }, link: 0 },
  ],
});

/**
 * A spine: the harbour at the head of a wide main street, habitation with the commons and the guns along it, the
 * machinery behind a gate at its tail. Between the parts the street runs through a hall and steps to one side; the
 * works and the freight are wings off the halls' flanks. The works wing is a line: the refineries, the ore store, and
 * the pod deck across its end.
 */
const spine = (name: string, o: { street: number; body: [number, number]; rowDepth?: number; wings: [number, number]; stub: [number, number]; hall?: { length: [number, number]; wide: [number, number]; shift: [number, number] }; braces?: number; quarters?: Recipe['quarters']; quay?: BranchRule['quay'] }): Recipe => ({
  name,
  root: { kind: 'core' },
  spacing: 2,
  ...(o.braces ? { braces: o.braces } : {}),
  ...(o.quarters ? { quarters: o.quarters } : {}),
  branches: [
    { takes: ['harbour'], per: 'together', host: { on: 'section' }, neck: 0, docks: true, ...(o.quay ? { quay: o.quay } : {}), section: { rooms: [2, 6], cross: true, width: o.street }, link: 0 },
    {
      takes: ['habitation', 'commons', 'market', 'defence'], per: 'together', host: { on: 'after', rule: 0 }, neck: o.hall?.length ?? 0, link: o.hall?.length ?? 0,
      ...(o.hall ? { hall: { wide: o.hall.wide, shift: o.hall.shift } } : {}),
      section: { rooms: o.body, cross: 'any', width: o.street, ...(o.rowDepth ? { rowDepth: o.rowDepth, even: true } : {}) },
    },
    { takes: ['secure'], per: 'together', host: { on: 'after', rule: 1 }, neck: 0, gated: true, section: { rooms: [3, 8], cap: true }, link: 0 },
    { takes: ['works', 'freight'], per: 'department', host: { on: 'flank' }, neck: o.stub, section: { rooms: o.wings, cross: ['end', 'inner'], cap: 'hangar', far: ['cargo'] }, link: 0 },
  ],
});

/**
 * A bazaar: a ring with a market court at its centre, a spoke from the court to the ring on each axis, the stalls
 * round the court and the machinery along the spokes, open ground between them. On the main axis the
 * harbour stands on one side of the ring and the warehouses with the workshop on the other; the ring's band is cabins, the mess, guns.
 */
const bazaar = (name: string, o: { outline: 'disc' | 'square'; cut: number | 'octagon'; court: number }): Recipe => ({
  name,
  root: { kind: 'ring', takes: ['habitation', 'defence', 'commons'], outline: o.outline, cut: o.cut, inner: true, hub: { court: o.court, arm: 7, market: ['market'], spokes: ['secure'] } },
  spacing: 2,
  branches: [
    { takes: ['harbour'], per: 'together', host: { on: 'rim', prefer: ['w', 'e'], roll: true }, neck: 0, docks: true, quay: harbour('quay', 'block'), section: { rooms: [2, 6] }, link: 0 },
    { takes: ['freight', 'works'], per: 'together', host: { on: 'rim', prefer: ['e', 'w'] }, neck: 0, section: { rooms: [2, 4], rowDepth: 8, even: true }, link: 0 },
  ],
});

export const stationRecipes = {
  tree: [
    scrap('off centre: jogged stubs, passages anywhere', { rooms: [2, 4], stub: [3, 5], spacing: 2, mix: false, quarters: { barracks: [6, 8], singles: 3 }, braces: 0.9, jog: [0, 5], cross: 'any' }),
    scrap('off centre, mixed modules on longer stubs', { rooms: [2, 4], stub: [4, 7], spacing: 3, mix: true, quarters: { barracks: [6, 8], singles: 3 }, braces: 0.9, jog: [0, 6], cross: 'any', harbour: 'gatehouse' }),
    scrap('before: straight stubs, passages midway', { rooms: [2, 4], stub: [2, 4], spacing: 2, mix: false, quarters: { barracks: [6, 8], singles: 3 }, braces: 0.9, harbour: 'basin' }),
  ],
  spine: [
    spine('halls between the parts, the street stepping aside', { street: 3, body: [6, 8], wings: [3, 4], stub: [2, 4], hall: { length: [6, 8], wide: [8, 10], shift: [2, 4] }, braces: 0.9, quay: harbour('quay') }),
    spine('smaller halls, bigger steps', { street: 3, body: [5, 7], wings: [3, 4], stub: [2, 4], hall: { length: [4, 6], wide: [6, 8], shift: [3, 6] }, braces: 0.9, quay: harbour('gatehouse') }),
    spine('before: one straight street', { street: 3, body: [6, 8], wings: [3, 4], stub: [2, 4], braces: 0.9, quay: harbour('basin') }),
  ],
  compound: [
    compound('ring, works block with the machinery behind a gate', { outline: 'disc', inner: true, works: ['s', 'n'], secure: 'behind', dock: ['w', 'e'], neck: 0, rowDepth: 9, quay: harbour('quay', 'block') }),
    compound('arc open to the south, works off its back', { outline: 'disc', inner: true, gap: { side: 's', from: 12 }, works: ['n'], secure: 'behind', dock: ['w', 'e'], neck: 0, rowDepth: 8, quay: harbour('gatehouse', 'block') }),
    compound('half ring: works on one tip, machinery on the other', { outline: 'disc', inner: true, gap: { side: 'e', from: 4 }, works: 'tip', secure: 'tip', dock: ['w'], neck: 0, rowDepth: 7, quay: harbour('basin', 'block') }),
    compound('ring with barracks (a works crew)', { outline: 'disc', inner: false, works: ['s', 'n'], secure: 'behind', dock: ['w', 'e'], neck: 0, rowDepth: 9, quarters: { barracks: [6, 8], singles: 4 }, quay: harbour('gatehouse', 'block') }),
    compound('square with bastions', { outline: 'square', inner: true, works: ['e', 'w'], secure: 'behind', dock: ['w', 'n', 's', 'e'], neck: 0, rowDepth: 8, quay: harbour('basin', 'block') }),
  ],
  bazaar: [
    bazaar('market court and spokes in a stepped ring', { outline: 'disc', cut: 2, court: 14 }),
    bazaar('the same in an octagon', { outline: 'square', cut: 'octagon', court: 14 }),
  ],
} as const satisfies Record<string, readonly Recipe[]>;
