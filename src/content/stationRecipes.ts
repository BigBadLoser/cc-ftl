import type { BranchRule, Recipe, Roll } from '../sim/shipgen/assembly/recipe';

/**
 * Station recipes for the assembly model (docs/STATION_ASSEMBLY.md): what a station is composed of and how its parts
 * stand to each other. Two structures so far, each in a few variations made by changing parameters only.
 */

/** A harbour: one of the quay's forms, tapering inland or (on a ring) as one block. */
const harbour = (form: 'quay' | 'gatehouse' | 'basin' | 'head', shape: 'taper' | 'block' | 'face' = 'taper'): NonNullable<BranchRule['quay']> => ({ form, wide: 5, pitch: 7, customs: 7, shape });

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
  outline: 'disc' | 'square'; cut?: { flat: number }; inner: boolean | 'street'; gap?: { side: 'n' | 'e' | 's' | 'w'; from: number };
  works: ('n' | 'e' | 's' | 'w')[] | 'tip'; secure: 'behind' | 'tip' | ('n' | 'e' | 's' | 'w')[]; dock: ('n' | 'e' | 's' | 'w')[]; neck: number; rowDepth: number; quarters?: Recipe['quarters']; quay?: BranchRule['quay'];
  /** Departments that stand on the street through the ring's middle (the labs down a research arc's spine), not in the works block. */
  spine?: ('works' | 'freight')[];
  /** What the works block takes (default the works and the freight): a habitation block instead, its crew's quarters, when the works are on the spine. */
  block?: ('works' | 'freight' | 'habitation')[];
  /** Gun batteries in the corners: one bay a corner, as big as the curve. */
  battery?: boolean;
}): Recipe => ({
  name,
  ...(o.quarters ? { quarters: o.quarters } : {}),
  // A 'disc' is no longer the stepped lattice ring (the user: "it's the lattice and the gaps it's leaving"): a square
  // cut to eight sides with its corners rounded, as the bazaar's.
  root: { kind: 'ring', takes: [...(o.block?.includes('habitation') ? [] : ['habitation' as const]), 'defence', 'commons', 'market', ...(o.spine ?? [])], ...(o.outline === 'disc' ? { outline: 'square', cut: 'octagon', round: true } : { outline: 'square', cut: o.cut ?? 2 }), inner: o.inner, ...(o.spine ? { street: o.spine } : {}), ...(o.battery ? { battery: true } : {}), ...(o.gap ? { gap: o.gap } : {}) },
  spacing: 2,
  branches: [
    { takes: (o.block ?? ['works', 'freight']).filter((d) => !o.spine?.includes(d as 'works')), per: 'together', host: o.works === 'tip' ? { on: 'tip' } : { on: 'rim', prefer: o.works }, neck: o.neck, section: { rooms: [4, 8], rowDepth: o.rowDepth, even: true }, link: 0 },
    // `secure` as sides: the machinery is a wing of its own on the rim there, so the one long wing is two shorter ones.
    { takes: ['secure'], per: 'together', host: o.secure === 'tip' ? { on: 'tip' } : o.secure === 'behind' ? { on: 'after', rule: 0 } : { on: 'rim', prefer: o.secure }, neck: 0, gated: true, section: { rooms: [3, 8], rowDepth: o.secure === 'tip' ? 6 : o.rowDepth, even: true, cap: true }, link: 0 },
    { takes: ['harbour'], per: 'together', host: { on: 'rim', prefer: o.dock, roll: true }, neck: 0, docks: true, ...(o.quay ? { quay: o.quay } : {}), section: { rooms: [2, 10] }, link: 0 },
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
const bazaar = (name: string, o: { outline: 'disc' | 'square'; cut: number | 'octagon'; court: number; round?: boolean }): Recipe => ({
  name,
  root: { kind: 'ring', takes: ['habitation', 'defence', 'commons', 'works'], outline: o.outline, cut: o.cut, ...(o.round ? { round: true } : {}), inner: false, hub: { court: o.court, arm: 7, slab: 7, market: ['market'], spokes: ['habitation', 'works'], gated: ['secure'] } },
  spacing: 2,
  branches: [
    { takes: ['harbour'], per: 'together', host: { on: 'rim', prefer: ['w', 'e'], roll: true }, neck: 0, docks: true, quay: harbour('quay', 'face'), section: { rooms: [2, 6] }, link: 0 },
    { takes: ['freight'], per: 'together', host: { on: 'rim', prefer: ['e', 'w'] }, neck: 0, section: { rooms: [2, 4], rowDepth: 8, even: true }, link: 0 },
  ],
});

/**
 * PROTOTYPE. A harbour crescent: a rounded square open to the west, rooms in two rows along its promenade, and a pier
 * from the east side out through the basin with the harbour at its end. The machinery is gated off the back, and the
 * crew sleeps two to a cabin, the cabins in the band with the rest. Where the freight stands is the variation:
 *   pier    the pier is the two warehouses; the stalls stand on the promenade's inner side, facing the basin
 *   foot    the warehouses at the pier's foot, the stalls beyond them
 *   behind  the pier is a market street, a warehouse behind the stalls on either side
 */
const crescent = (name: string, o: { cut: number | 'octagon' | { flat: number }; from: number; freight: 'pier' | 'foot' | 'behind' }): Recipe => {
  const stalls: BranchRule = { takes: o.freight === 'behind' ? ['market', 'freight'] : ['market'], per: 'together', host: o.freight === 'foot' ? { on: 'after', rule: 0 } : { on: 'spoke', side: ['e'] }, neck: 0, section: { rooms: [8, 30], rowDepth: o.freight === 'behind' ? 3 : 4, even: true, ...(o.freight === 'behind' ? { behind: ['freight'] } : {}) }, link: 0 };
  const sheds: BranchRule = { takes: ['freight'], per: 'together', host: { on: 'spoke', side: ['e'] }, neck: 0, section: { rooms: [2, 4], rowDepth: 8, even: true }, link: 0 };
  const pier = o.freight === 'pier' ? [sheds] : o.freight === 'foot' ? [sheds, stalls] : [stalls];
  const root: Extract<Recipe['root'], { kind: 'ring' }> = { kind: 'ring', takes: o.freight === 'pier' ? ['market', 'commons', 'defence', 'works', 'habitation'] : ['commons', 'defence', 'works', 'habitation'], outline: 'square', cut: o.cut, round: true, shoulders: true, inner: 'rows', noses: 'weapons', ...(o.freight === 'pier' ? { waterfront: ['market'] } : {}), gap: { side: 'w', from: o.from } };
  const branches = (pier: BranchRule[]): BranchRule[] => [
    ...pier,
    { takes: ['harbour'], per: 'together', host: { on: 'after', rule: pier.length - 1 }, neck: 0, docks: true, quay: harbour('head'), section: { rooms: [2, 6], rowDepth: 4 }, link: 0 },
    { takes: ['secure'], per: 'together', host: { on: 'rim', prefer: ['e'] }, neck: 0, gated: true, section: { rooms: [3, 8], rowDepth: 7, even: true, cap: true }, link: 0 },
  ];
  return {
    name,
    root,
    quarters: { barracks: [2, 2] },
    spacing: 2,
    branches: branches(pier),
    // At hub size the pier foot's warehouses would double the pier's length: they stand on the basin floor against the
    // east side instead, either side of the pier, and the pier carries the stalls and the harbour (mock P2).
    ...(o.freight === 'foot' ? { sizes: { hub: { root: { ...root, takes: [...root.takes, 'freight'], inboard: { takes: ['freight'], face: 'e' } }, branches: branches([{ ...stalls, host: { on: 'spoke', side: ['e'] } }]) } } } : {}),
  };
};

/**
 * A star fort (the military's: the square with bastions did not hold up at size): a parade hall at the centre, four
 * arms off it on short necks, their streets three wide (the harbour north, the works and freight east, the barracks south, the machinery west
 * behind a gate) and a gun battery in each corner between two arms, pointing out (fort.ts).
 */
const fort = (name: string, o: { hall: Roll; neck: number; rowDepth: number }): Recipe => ({
  name,
  root: { kind: 'fort', takes: ['defence'], hall: o.hall, neck: o.neck },
  quarters: { barracks: [6, 8], singles: 4 },
  spacing: 2,
  branches: [
    { takes: ['harbour'], per: 'together', host: { on: 'rim', prefer: ['n'] }, neck: 0, docks: true, quay: harbour('head'), section: { rooms: [2, 10], width: 3 }, link: 0 },
    { takes: ['works', 'freight', 'defence', 'market'], per: 'together', host: { on: 'rim', prefer: ['e'] }, neck: 0, section: { rooms: [4, 8], rowDepth: o.rowDepth, even: true, width: 3 }, link: 0 },
    { takes: ['habitation', 'commons'], per: 'together', host: { on: 'rim', prefer: ['s'] }, neck: 0, section: { rooms: [4, 8], rowDepth: o.rowDepth, even: true, width: 3 }, link: 0 },
    { takes: ['secure'], per: 'together', host: { on: 'rim', prefer: ['w'] }, neck: 0, gated: true, section: { rooms: [3, 8], rowDepth: o.rowDepth, even: true, width: 3, cap: true }, link: 0 },
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
    compound('ring, works block with the machinery behind a gate', { outline: 'disc', inner: 'street', works: ['s'], secure: ['n'], dock: ['w', 'e'], neck: 0, rowDepth: 9, quay: harbour('head') }),
    compound('half ring: works on one tip, machinery on the other', { outline: 'disc', inner: 'street', gap: { side: 'e', from: 4 }, works: 'tip', secure: 'tip', dock: ['w'], neck: 0, rowDepth: 7, quay: harbour('head') }),
    compound('half ring: works down the spine, quarters on one tip, machinery on the other', { outline: 'disc', inner: 'street', spine: ['works'], block: ['habitation', 'freight'], gap: { side: 'e', from: 4 }, works: 'tip', secure: 'tip', dock: ['w'], neck: 0, rowDepth: 7, quay: harbour('head') }),
    compound('ring with barracks (a works crew)', { outline: 'disc', inner: 'street', battery: true, works: ['s'], secure: ['n'], dock: ['w', 'e'], neck: 0, rowDepth: 9, quarters: { barracks: [6, 8], singles: 4 }, quay: harbour('head') }),
    // The faces as wide as the wings, so a wing meets the bastions either side of it with no gap.
    compound('square with bastions', { outline: 'square', cut: { flat: 3 }, inner: 'street', battery: true, works: ['e'], secure: ['w'], dock: ['n', 's'], neck: 0, rowDepth: 7, quay: harbour('head') }),
  ],
  fort: [
    fort('star fort: parade hall, four arms, a battery in each corner', { hall: 7, neck: 4, rowDepth: 6 }),
  ],
  crescent: [
    crescent('freight pier, stalls on the waterfront', { cut: 5, from: 20, freight: 'pier' }),
    crescent('warehouses at the pier foot, stalls beyond', { cut: 5, from: 20, freight: 'foot' }),
    crescent('market street, a warehouse behind the stalls either side', { cut: 5, from: 20, freight: 'behind' }),
  ],
  bazaar: [
    bazaar('market court and spokes, round corners', { outline: 'square', cut: 'octagon', round: true, court: 14 }),
  ],
} as const satisfies Record<string, readonly Recipe[]>;
