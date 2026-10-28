import type { UiDeploy, UiJumpWarnings, UiStarArt, UiStarmap, UiStarMarket, UiStarRoute } from './starmapApi';
import type { CreateStarmapGpu } from './starmapGpu';
import type { Command, WorkCategory } from '../sim';

/** Minimal store contract (Svelte-compatible) so ui need not import app internals. */
export interface Subscribable<T> {
  subscribe(run: (value: T) => void): () => void;
}

export interface UiSnapshot {
  tick: number;
  speed: 0 | 1 | 2 | 3;
  paused: boolean;
  entityCount: number;
  fps: number;
  frameMs: number;
  tickMs: number;
  seed: number;
  zoom: number;
  sprites: number;
}

/** The game session: a notice shown once on start (an old save could not be loaded), and why the game was lost (null while it goes on). */
export interface UiSession {
  notice: string | null;
  lost: string | null;
}

/** The tutorial goal chain: act `act` of `acts`, its title, what finishing it pays (a short line), and its goals. */
export interface UiGoals {
  act: number;
  acts: number;
  title: string;
  reward: string;
  goals: { id: string; title: string; text: string; done: boolean }[];
}

/**
 * The ship cannot pay for any jump (null while it can). `canCall`: no fuel on sale here, so a distress call is allowed; `blocker` otherwise says why not
 * ('fuelOnSale': buy it at the station). `pending`: a tug is on its way, `turnsLeft` turns off. `fuel` / `unit` / `total` is the tug's offer.
 */
export interface UiStranded {
  need: number;
  have: number;
  canCall: boolean;
  blocker: string;
  pending: { turnsLeft: number } | null;
  fuel: number;
  unit: number;
  total: number;
  credits: number;
}

/** A loose stack on a floor tile. */
export interface UiStack {
  item: string;
  name: string;
  count: number;
  /** A delivery crate: its job (for `jobs.openCrate`), what it holds and where it goes. */
  crate: { job: number; title: string; to: string } | null;
}

export interface UiInspect {
  /** The ship (ShipC entity id) the tile belongs to: the `ship` of tile commands. */
  ship: number;
  /** Its grid number, for the readout only. */
  grid: number;
  /** Sector tile (what commands take). */
  x: number;
  y: number;
  /** The same tile in its ship's local tiles (from the grid's top-left), for the readouts. */
  local: { x: number; y: number };
  /** The loose item stack on the tile, or null. */
  stack: UiStack | null;
  structName: string;
  room: number;
  fields: { name: string; value: number }[];
  /** A player job on the tile (forcing a door...), with its progress, or null. */
  job: { kind: string; progress: number; work: number } | null;
  selected: boolean;
}

export interface UiCrew {
  id: number;
  name: string;
  role: string;
  activity: string;
  /** 0..100, 100 = fully rested. */
  rest: number;
  /** 0..100, 100 = fed; null for crew that never eat (robots, enemies). */
  hunger: number | null;
  /** Mood 0..100 with its reasons (label and points, biggest first) and what it does to work; null for crew without moods. */
  mood: { value: number; factors: { label: string; value: number }[]; workMult: number } | null;
  drafted: boolean;
  /** A machine (a robot: a mover run by the AI core, not crew proper): the crew bar leaves it out. */
  mechanical: boolean;
  /** Human-readable current job, or null. */
  job: string | null;
  priorities: Record<WorkCategory, number>;
  /** The role's default priorities (for "differs from role" marks and reset). */
  defaults: Record<WorkCategory, number>;
  hp: number;
  maxHp: number;
  dead: boolean;
  /** Present while downed: seconds until bleed-out and whether stabilized in a bed. */
  downed: { bleed: number; stabilized: boolean } | null;
  /** Name of the crew member carrying this one, or null. */
  carriedBy: string | null;
  carrying: { item: string; count: number } | null;
  /** Which side: the player's crew, or hostile crew standing on a grid the player's crew is on. */
  side: 'player' | 'enemy';
  /** Ship they stand on (ShipC entity id; 0 = aboard a shuttle), and a label for where they are. */
  ship: number;
  where: string;
  /** Not on the home ship. */
  away: boolean;
  /** Wielded hand weapon, or null for bare hands. */
  weapon: { item: string; name: string; ranged: boolean; damage: number; range: number } | null;
  /** Hand weapons in storage on their grid that they could fetch. */
  arms: { item: string; name: string; count: number }[];
  surrendered: boolean;
  prisoner: boolean;
  inert: boolean;
  fight: UiFight | null;
  /** The EVA suit being worn: seconds of air left of `max`, and whether the tank is low or the wearer is outside on the hull. Null when not suited. */
  /** Needs no air, so never wears a suit (robots). */
  airless: boolean;
  /** The hovering shuttle this suited crew member came out of (they can float back to it), or null. */
  evaShuttle: number | null;
  suit: { air: number; max: number; low: boolean; outside: boolean } | null;
  /** The nearest airlock on their grid with a free suit (to put one on), the suits free there and the airlock's tile; null when none or they cannot wear one. */
  suitAt: { id: number; free: number } | null;
}

export interface UiFight {
  mode: 'idle' | 'engage' | 'flee';
  /** Shoots hostiles on its own (drafted crew). */
  engage: boolean;
  target: string | null;
  targetId: number;
  /** The player ordered this target. */
  ordered: boolean;
  /** Seconds until the next attack, and the weapon's cooldown. */
  cooldown: number;
  cooldownMax: number;
  /** Cover against its current target, or null with no target in sight. */
  cover: 'none' | 'partial' | 'full' | null;
}

/** A placed module, for the inspector and the debug panel. */
export interface UiModule {
  id: number;
  /** The ship it is on (ShipC entity id): the `ship` of module commands. */
  ship: number;
  def: string;
  name: string;
  /** Sector tile of the top-left footprint tile (what commands take). */
  x: number;
  y: number;
  /** The same tile in its ship's local tiles, for the readouts. */
  local: { x: number; y: number };
  hp: number;
  maxHp: number;
  powerPriority: number;
  enabled: boolean;
  powered: boolean;
  /** Units per second: positive supplies, negative draws. */
  power: number;
  /** Holds items (has a storage panel). */
  storage: boolean;
  /** Crafts recipes (has a production panel). */
  crafting: boolean;
  /** A research module (the inspector opens the research panel). */
  research: boolean;
  /** Robot bay state (null for other modules). */
  bay: UiRobotBay | null;
  /** Airlocks: EVA suits stowed now and in a full complement (null for other modules). */
  suits: { stowed: number; max: number } | null;
}

/** A stat line of a module in the research panel; `delta` is against the tier below ("+2", "-2 s"), `good` when that is an improvement. */
export interface UiResearchStat {
  label: string;
  value: string;
  delta: string | null;
  good: boolean;
}

/**
 * One node of the research tree: a module the ship starts with (a root, `project` false) or a project unlocking one. `parents` are node ids
 * (prerequisites, drawn to its left). Status: known; open (every prerequisite known or queued: the only nodes that can be picked);
 * queued / active (`pos` is its place in the queue); locked.
 */
export interface UiResearchNode {
  id: string;
  name: string;
  band: string;
  parents: string[];
  project: boolean;
  status: 'known' | 'open' | 'queued' | 'active' | 'locked';
  pos: number | null;
  /** The module def the node is about (its art, footprint, stats). */
  module: string;
  /** "Power · 2x3". */
  sub: string;
  stats: UiResearchStat[];
  cost: (UiCost & { have: number })[];
  /** Work time at one worker with no science. */
  seconds: number;
  progress: number;
  /** Placement overrides from the project (see `ResearchDef.col`). */
  col?: number;
  row?: number;
}

export interface UiResearch {
  /** The ship the commands take. */
  ship: number;
  /** Research modules that can work, and crew standing at them now. */
  labs: number;
  workers: number;
  bands: { id: string; name: string }[];
  nodes: UiResearchNode[];
  /** Project ids in queue order (the first is the active one once paid). */
  queue: string[];
}

export interface UiRobotBay {
  /** The robot that calls this bay home. */
  occupant: { id: number; name: string; role: string; charging: boolean; charge: number; hp: number; maxHp: number } | null;
  /** Assembly under way: progress 0..1, and whether it still waits for materials. */
  assembling: { role: string; name: string; progress: number; waiting: boolean; cost: UiCost[] } | null;
  /** Robot types this bay can build. */
  options: { role: string; name: string; seconds: number; cost: (UiCost & { have: number })[] }[];
}

/** An item amount with its display name. */
/** A module under construction (a blueprint job): what it needs, who works on it, and why it is stuck (if it is). */
export interface UiSite {
  /** The job entity id (selection key). */
  id: number;
  ship: number;
  def: string;
  name: string;
  /** Sector tile of the top-left footprint tile (what commands take), and the same in the ship's local tiles. */
  x: number;
  y: number;
  local: { x: number; y: number };
  w: number;
  h: number;
  /** 0..1 */
  frac: number;
  /** Seconds of work left at the builder's speed (hauling not counted), or null with nobody able to build. */
  etaSec: number | null;
  state: 'blocked' | 'waiting' | 'building';
  /** Why it is stuck ('' when it is not): "Missing 6 metal", "Nobody can reach the site". */
  reason: string;
  materials: { item: string; name: string; need: number; delivered: number; inTransit: number; missing: number }[];
  builders: { id: number; name: string }[];
  haulers: { id: number; name: string }[];
}

export interface UiCost {
  item: string;
  name: string;
  count: number;
}

export interface UiItemDef {
  id: string;
  name: string;
  stackSize: number;
  /** Crew can eat it. */
  food: boolean;
}

export interface UiRecipe {
  id: string;
  name: string;
  /** Module def id of the station. */
  station: string;
  inputs: UiCost[];
  outputs: UiCost[];
  /** Seconds of work at work speed 1. */
  seconds: number;
}

/** Where an item sprite sits in a sheet, for CSS icons. */
export interface UiIcon {
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sheetW: number;
  sheetH: number;
}

/** Ship-wide totals of one item. */
export interface UiStock {
  item: string;
  name: string;
  floor: number;
  stored: number;
  carried: number;
}

export interface UiStorage {
  id: number;
  capacity: number;
  /** Accepted item ids, or null for everything. */
  filter: string[] | null;
  stacks: { item: string; count: number }[];
}

export interface UiOrder {
  recipe: string;
  name: string;
  mode: 'count' | 'keep';
  target: number;
  done: number;
  /** 'keep' orders: units in stock of the first output. */
  have: number;
  /** Inputs of one batch that are not in stock in the needed amount (item names). */
  missing: string[];
  /** The order the station is working on now. */
  active: boolean;
}

export interface UiFab {
  id: number;
  orders: UiOrder[];
  /** Craft job now, or null. */
  job: { name: string; progress: number; phase: 'materials' | 'power' | 'crafting' | 'ready' } | null;
}

/** A module the build menu offers. */
export interface UiModuleDef {
  id: string;
  name: string;
  w: number;
  h: number;
  power: number;
  cost: UiCost[];
  /** Build catalog tab. */
  category: 'structure' | 'power' | 'systems' | 'life' | 'production' | 'storage' | 'defence' | 'utility';
  description: string;
  /** Access tile (offset from the footprint's top-left at rotation 0), or null. */
  access: [number, number] | null;
  /** Facts for the popover besides cost: power, operator, shield layers, capacity... */
  facts: { label: string; value: string; tone?: 'warn' }[];
  /** Tier name ("Mk I", "Mk II", "Mk III") of a module that comes in tiers, else null. */
  tier: string | null;
  /** The tier family's id (the Mk I id) for a tiered module, else null. */
  family: string | null;
  /** Locked: its blueprint is not known yet. */
  locked?: boolean;
  /** Where to get the blueprint ("Blueprint: research stations"), or null for a basic module. */
  lockHint: string | null;
}

/** A module's art rendered to an image (see render/moduleThumb). */
export interface UiThumb {
  url: string;
  w: number;
  h: number;
  /** Centre of the footprint's front tile inside the image. */
  ax: number;
  ay: number;
}

/** Crew food: units of food in stock, how many crew eat, rations used per hour at the current rate and hours left (null with no eaters). */
export interface UiFood {
  units: number;
  eaters: number;
  perHour: number;
  hours: number | null;
}

/** The player's notoriety (sim galaxy/heat.ts): wanted by the law from `wantedAt`; `hunters` names the factions with a hunter fleet out; clearing it at a pirate den costs `clearCost` (`clearBlocker` says why not, when not). */
export interface UiHeat {
  notoriety: number;
  wanted: boolean;
  wantedAt: number;
  hunters: string[];
  clearCost: number;
  clearBlocker: string | null;
}

/**
 * A station job (sim galaxy/jobs.ts) as the board shows it: an offer (`id` null) or one the player holds. `where` is the delivery's destination or the
 * bounty target's node, `hops` how many jumps away it is (null when out of the known map), `here` that the player is there; `ready` that a delivery's crate is aboard.
 */
/** A ship's fighting strength as the job card shows it: working guns, shield layers, size (interior area). */
export interface UiStrength {
  guns: number;
  shields: number;
  hull: number;
}
/** How a target compares with the player's ship. */
export type UiStrengthRead = 'outmatched' | 'even' | 'weaker';

export interface UiJob {
  key: string;
  id: number | null;
  kind: 'delivery' | 'bounty' | 'survey';
  issuer: string;
  title: string;
  detail: string;
  reward: number;
  turnsLeft: number;
  where: string;
  hops: number | null;
  here: boolean;
  ready: boolean;
  /** Bounty only: the target ship's strength (what it is generated with when you arrive) and how it compares with yours. */
  target: { strength: UiStrength; read: UiStrengthRead | null } | null;
}

/** A finished bounty or survey that can be handed in at the station the player is at. */
export interface UiClaim {
  id: number;
  kind: 'bounty' | 'survey';
  issuer: string;
  title: string;
  reward: number;
  here: boolean;
}

/** The job board: offers at the node the player is at (`here` its name, null when jobs cannot be taken now: in hyperspace or an event grid), and the jobs they hold (at most `max`). */
export interface UiJobs {
  here: string | null;
  offers: UiJob[];
  active: UiJob[];
  /** Finished bounties and surveys the station here takes in (never kept on screen anywhere else). */
  handIn: UiClaim[];
  max: number;
  /** The player's own ship, for comparing with a bounty target. */
  mine: UiStrength | null;
}

export interface UiStats {
  supply: number;
  demand: number;
  food: UiFood;
  heat: UiHeat;
  /** Average O2 (kPa) of rooms with crew in them, or null when nobody is inside one. */
  o2: number | null;
  /** Ship size (interior area) against what the working engines carry: the ship panel's "Size N / M" (interior area). */
  hull: { tiles: number; capacity: number };
}

/** One option of an open decision. `reasons` explain why it is greyed out; `odds` is the skill check, if any. */
export interface UiStoryChoice {
  id: string;
  label: string;
  hint: string | null;
  enabled: boolean;
  reasons: string[];
  odds: { pct: number; label: string } | null;
  /** Items it spends, e.g. "20x Scrap". */
  cost: string[];
}

/** The event system as the UI sees it: the open decision (the game pauses on it) and the last result. */
export interface UiStory {
  active: { event: string; title: string; text: string; choices: UiStoryChoice[] } | null;
  last: { tick: number; title: string; choice: string; success: boolean | null; text: string; lines: string[] } | null;
}

export type UiAlertKind =
  | 'fire.started' | 'hull.breach' | 'power.shortage' | 'o2.low' | 'crew.downed' | 'crew.died' | 'crew.rescued'
  | 'job.missingMaterials' | 'storage.full' | 'production.done'
  | 'suit.airLow' | 'suit.airOut' | 'crew.starving' | 'crew.moodLow'
  | 'story.notice' | 'story.lead' | 'trade'
  | 'combat.started' | 'module.destroyed' | 'ship.destroyed' | 'ship.fled' | 'ship.lost' | 'creatures.aboard' | 'station.alarm'
  | 'outpost.discovered' | 'ship.provoked' | 'mining.waiting' | 'mining.done' | 'galaxy.encounter' | 'galaxy.incoming' | 'galaxy.incomingHostile' | 'transfer';

export type UiLogKind =
  | 'fire' | 'breach' | 'crew.downed' | 'crew.died' | 'crew.rescued' | 'module.destroyed' | 'combat' | 'ship.disabled' | 'ship.destroyed'
  | 'ship.fled' | 'ship.captured' | 'hail' | 'trade' | 'production' | 'container' | 'story' | 'lost';

/** One happening in the event log (history, not an ongoing state like an alert). */
export interface UiLogEntry {
  id: number;
  /** Sim tick it happened on. */
  tick: number;
  kind: UiLogKind;
  tone: 'info' | 'good' | 'warn' | 'bad';
  text: string;
  /** How many times in a row this happened (same text as the entry before). */
  count: number;
}

/** A weapon module of the player's ship. */
export interface UiWeapon {
  id: number;
  name: string;
  /** 0..1. */
  charge: number;
  /** Missiles in stock for ammo weapons, null for weapons that use none. */
  ammo: number | null;
  ion: boolean;
  powered: boolean;
  /** Own target label, or null when it uses the ship-wide one. */
  target: string | null;
  /** Module id of the own target (0 = whole ship or none). */
  targetModuleId: number;
  /** A blind tile aim (sector tile), or null. */
  targetTile: { x: number; y: number } | null;
}

/** A console of the player's ship and who runs it. */
export interface UiConsole {
  id: number;
  kind: 'weapons' | 'shields' | 'helm';
  name: string;
  operator: string | null;
  powered: boolean;
}

/** A module of a ship in combat, for target lists. */
export interface UiShipModule {
  id: number;
  name: string;
  kind: 'weapon' | 'shield' | 'engine' | 'other';
  hp: number;
  maxHp: number;
  ion: boolean;
}

export interface UiShipCombat {
  /** ShipC entity id: the key of the ship everywhere in the UI and in commands. */
  ship: number;
  name: string;
  /** Sector tile of the ship's top-left corner (a tile aim is shown relative to it). */
  x: number;
  y: number;
  state: 'active' | 'disabled' | 'wreck' | 'fled' | 'prize';
  /** A dormant hostile (pirate den) not yet provoked: listed (it can be targeted) but it does not light the hostiles button. */
  dormant?: boolean;
  /** 0..1 hull and module integrity. */
  integrity: number;
  shield: { layers: number; max: number; /** 0..1 toward the next layer. */ progress: number };
  /** 0..1 chance a shot misses. */
  evasion: number;
  hold: boolean;
  /** FTL charge seconds and the seconds needed to flee. */
  ftl: number;
  ftlMax: number;
  /** Ship-wide target, with a label. */
  target: { ship: number; moduleId: number; label: string; tile?: { x: number; y: number } } | null;
  modules: UiShipModule[];
}

/** The player's FTL drive and its charge order (the starmap's and the ship panel's Charge FTL button). */
export interface UiFtl {
  /** ShipC entity id: the `ship` of `ftl.charge`. */
  ship: number;
  /** idle, ordered but nobody seated yet, a crew member walking to the helm, charging at the helm, or full. */
  state: 'idle' | 'waiting' | 'heading' | 'charging' | 'ready';
  /** Why the drive cannot charge now (null = it can). */
  blocker: 'noShip' | 'notActive' | 'noHelm' | 'helmOffline' | 'noEngines' | 'noCrewAboard' | null;
  charge: number;
  max: number;
  /** A charge order stands, and a jump is queued behind it. */
  ordered: boolean;
  queued: boolean;
  /** The crew member heading to or sitting at the helm. */
  pilot: string | null;
}

/** "Target in view" is armed: the next left-click on an enemy ship in the main view aims `weapon` (a weapon module id; null = every weapon). */
export interface UiAiming {
  weapon: number | null;
}

export interface UiCombat {
  inCombat: boolean;
  player: (UiShipCombat & { weapons: UiWeapon[]; consoles: UiConsole[]; /** Why the weapons are not firing ("No targets", "Weapons console unmanned"), null while they are. */ idle: string | null }) | null;
  /** Hostile ships (not fled), nearest first. */
  enemies: UiShipCombat[];
}

/** A crew member as the shuttle panel lists them. `boarding` is the vehicle they are walking to (0 = none). */
export interface UiShuttleCrew {
  id: number;
  name: string;
  role: string;
  boarding: number;
  /** The ship (ShipC entity) the crew member stands on, 0 while aboard a vehicle. */
  ship: number;
}

export interface UiShuttle {
  id: number;
  name: string;
  state: 'stowed' | 'flying' | 'docked';
  hp: number;
  maxHp: number;
  /** Passenger seats (the pilot is extra). */
  capacity: number;
  pilot: UiShuttleCrew | null;
  passengers: UiShuttleCrew[];
  destination: 'dock' | 'bay' | 'hover' | null;
  /** Name of the ship it hovers beside, or null. */
  hoverShip: string | null;
  /** EVA suits aboard, and whether crew can go out now (hovering, a suit free, passengers aboard). */
  suits: number;
  canEva: boolean;
  /** Name of the ship it is docked at, or null. */
  dockShip: string | null;
  /** The trade run it is on (status text and the partner's name), or null. */
  trade: { status: string; partner: string } | null;
  /** The base-logistics run it is on (status text and the destination region's name), or null. */
  ferry: { status: string; to: string } | null;
  /** Units its hold takes. */
  cargo: number;
  /** Free for a new base run (idle, not a pod, no trade run). */
  ferryFree: boolean;
  /** Module id of its home bay. */
  bay: number;
  /** Crew can climb in or out here right now (stowed in the bay, or docked). */
  boardable: boolean;
  /** The ship whose floor crew board from (the boarding tile's): the home ship's bay, or the ship it is docked at. 0 if not boardable. */
  boardShip: number;
}

export interface UiShuttleAirlock {
  id: number;
  /** ShipC entity id of the ship it is on, and that ship's name. */
  shipId: number;
  ship: string;
  working: boolean;
  /** Another shuttle is docked or headed there. */
  busy: boolean;
  /** The airlock's tile in its ship's local tiles (readout only). */
  x: number;
  y: number;
}

/** A captured ship. `value` is the hull value estimate (prizeValue); `crewAboard` counts the player's crew still on it (scuttling needs none). */
export interface UiPrize {
  /** ShipC entity id. */
  ship: number;
  name: string;
  from: string;
  value: number;
  prisoners: { id: number; name: string; role: string; hp: number; maxHp: number; state: 'downed' | 'surrendered' }[];
  crewAboard: number;
}

/** One item row of the trade window: stock on both sides and the unit prices. */
export interface UiTradeLine {
  item: string;
  name: string;
  /** Units in the trader's stock / in the player's storage. */
  theirs: number;
  mine: number;
  /** Credits per unit: what they charge the player, and what they pay the player. */
  sell: number;
  buy: number;
  /** Sold as surplus (older, middle-grade gear: a military depot's). */
  surplus?: boolean;
  /** Contraband: only a black market takes it, and navy and corporation scans confiscate it. */
  contraband?: boolean;
}

/** A station's black-market services (sim blackmarket/): shown at the top of its trade window. */
export interface UiMarketServices {
  /** The set names ("Back-room dealer"), the share of value it pays for contraband (0.7 = 70%) and the fence rate when it has a fence (else null). */
  names: string[];
  contrabandRate: number;
  fence: number | null;
  /** Nobody starts a fight at its node, until someone breaks the truce. */
  truce: boolean;
  /** The truce is broken and the player is banned here. */
  banned: boolean;
  /** It has shady crew for hire. */
  shadyCrew: boolean;
}

export interface UiTradeOffer {
  id: number;
  give: { item: string; count: number }[];
  get: { item: string; count: number }[];
  barter: boolean;
  /** > 0 the player pays, < 0 they pay. */
  balance: number;
}

/** A person for hire aboard a station (sim galaxy/recruit.ts): `skills` are the role's, `cost` in credits, `coming` while the player's shuttle is fetching them. */
export interface UiRecruit {
  key: string;
  name: string;
  species: string;
  role: string;
  skills: string[];
  cost: number;
  coming: boolean;
  /** A black market's shady crew: the extra levels (already in `skills`) over the role's own. */
  shady?: number;
}

/** A module blueprint a station sells (sim galaxy/blueprintShop.ts). */
export interface UiBlueprint {
  def: string;
  name: string;
  tier: number;
  price: number;
  known: boolean;
  w: number;
  h: number;
  /** One line of what it does better than Mk I. */
  blurb: string;
}

/** A ship or station the player can hail. */
/** What a player wants to know about a station before dealing with it (stations only). */
export interface UiStationInfo {
  /** Owning faction and the player's standing with it; null for a station without a port. */
  owner: { name: string; tier: 'friendly' | 'neutral' | 'hostile' } | null;
  /** Plain services ('Trade', 'Fuel', 'Repair'). */
  services: string[];
  jobs: number;
  hire: number;
  /** Blueprints on sale here (empty without the service). */
  blueprints: UiBlueprint[];
  /** The port id `blueprint.buy` takes (empty without a port). */
  blueprintPort: string;
  market: UiStarMarket | null;
  /** Notable stock in a few words ("Mk II shield gens", "Cheap fuel"). */
  hints: string[];
  /** Working airlocks to dock at. */
  docks: number;
  guns: number;
  /** Shield layers. */
  shields: number;
  /** Why the alarm is up, or null while calm. */
  alarm: string | null;
  /** The shipyard this station runs (hull expansion), or null. */
  yard: UiYardService | null;
}

/** What a station's shipyard offers. `price` is per tile now (the node's danger and the tier's multiplier included). */
export interface UiYardService {
  /** 'station' or 'hub'. */
  size: string;
  /** Hull tiles one visit builds. */
  cap: number;
  price: { credits: number; metal: number };
  /** The ship's size (interior area) against what its engines carry. */
  hull: { tiles: number; capacity: number };
}

/** The ship's planned outer hull (the build tools' Hull plan), checked: what can be built from the ship, what floats, what is in the way, the floor it shuts in. */
export interface UiHullPlan {
  /** The ship the plan belongs to (the `ship` of `hull.plan`), 0 when there is none. */
  ship: number;
  tiles: { x: number; y: number }[];
  connected: { x: number; y: number }[];
  loose: { x: number; y: number }[];
  blocked: { x: number; y: number }[];
  floor: { x: number; y: number }[];
  /** Tiles of the plan (with the floor it shuts in) that would leave part of the ship narrower than 3 tiles; empty when the plan is fine. */
  bad: { x: number; y: number }[];
  /** Hull tiles now and with every reachable planned tile built, against the engines' capacity. */
  hull: { now: number; afterAll: number; capacity: number };
}

/** What a yard would build of the plan on this visit, and for how much. `error` is the sim's reason code, `errorText` the sentence. */
export interface UiYardQuote {
  station: number;
  error: string | null;
  errorText: string;
  /** Tiles turned into hull now (outline plus floor), the floor they enclose, tiles planned in all, and tiles left for a later yard. */
  buy: number;
  floor: number;
  /** Tiles the quick planning pass trusses (outside the cap), and its fee in credits (part of `price`). */
  truss: number;
  fee: number;
  planned: number;
  rest: number;
  price: { credits: number; metal: number };
  afford: { credits: boolean; metal: boolean };
  cap: number;
  hull: { before: number; after: number; capacity: number };
}

/** The player's yard order: running, or just ended. `status` says what is happening. */
export interface UiYardOrder {
  id: number;
  station: number;
  live: boolean;
  phase: string;
  status: string;
  built: number;
  total: number;
  price: { credits: number; metal: number };
  /** Why it ended early, in words, or ''. */
  reason: string;
  /** The floor and wall tiles still to build (empty once the order has ended), for the overlay. */
  floor: { x: number; y: number }[];
  walls: { x: number; y: number }[];
}

/** The hull plan, a yard's quote for it (for the station panel that is open: null otherwise) and the order under way. */
export interface UiYard {
  plan: UiHullPlan;
  quote: UiYardQuote | null;
  order: UiYardOrder | null;
}

export interface UiTradePartner {
  /** The trader entity: the ShipC entity of a ship, a plain trader entity for a station (no ship). Also the UI key of the node. */
  id: number;
  name: string;
  kind: 'ship' | 'station';
  /** A station (an immobile ship with a trader): it gets its own panel. */
  station: boolean;
  /** Trader kind ('Freighter'), or '' if it has no trade profile. */
  role: string;
  trades: boolean;
  hail: 'none' | 'answered' | 'refused';
  /** Why a refused hail was refused ('hostile', 'weaponsHot', 'silent', 'noTrade'). */
  reason: string;
  wallet: number;
  rep: number;
  lines: UiTradeLine[];
  /** How a delivery would go: who flies ('them' | 'you') or the reject code that stops it, for goods going out / coming in. */
  out: { courier: string; error: string; cap: number };
  in: { courier: string; error: string; cap: number };
  offer: UiTradeOffer | null;
  distance: number;
  /** People for hire aboard (stations only), and the reject code that would stop a hiring run now ('' if it can go). */
  recruits: UiRecruit[];
  hireError: string;
  /** Stations only. */
  info?: UiStationInfo;
  /** Black-market services the station carries, or absent. */
  market?: UiMarketServices;
}

export interface UiTradeDeal {
  id: number;
  ship: number;
  partner: string;
  phase: string;
  status: string;
  courier: string;
  give: string;
  get: string;
  balance: number;
  barter: boolean;
  vehicle: number;
  live: boolean;
  cancellable: boolean;
  flying: boolean;
  /** A multi-trip order: the trip now running, how many there are, and the trips already settled ('' if none stopped early). */
  trip: { n: number; of: number; stopped: string } | null;
}

export interface UiTrade {
  credits: number;
  partners: UiTradePartner[];
  deals: UiTradeDeal[];
}

/** A derelict (a ruined wreck with no crew), for its panel and node tile. */
export interface UiDerelict {
  /** Where it came from: its faction, e.g. 'scrapper'. */
  kind: string;
  cause: 'combat' | 'decay';
  /** 0..1 overall integrity. */
  hull: number;
  /** Average air on its decks: vacuum, thin or breathable. */
  air: 'vacuum' | 'thin' | 'breathable';
  /** A power source still running (emergency lights) or nothing. */
  power: 'emergency' | 'off';
  /** Doors still jammed. */
  jammed: number;
}

export interface UiShuttles {
  shuttles: UiShuttle[];
  /** Airlocks of other ships a shuttle can dock at. */
  airlocks: UiShuttleAirlock[];
  /** Ships a shuttle can hover beside: ShipC entity id (the UI key and the `vehicle.hover` command's `ship`) and name. */
  targets: { ship: number; name: string; derelict?: UiDerelict }[];
  /** Crew on the player's ship who could climb in. */
  roster: UiShuttleCrew[];
  /** The player's vehicle bays (module ids) and whether each is empty. */
  bays: { id: number; empty: boolean }[];
  /** The player's regions shuttles can run cargo and crew between (the home ship first, then claimed bases), with the stock in each region's storage. Empty with only the home ship. */
  regions: { id: number; name: string; home: boolean; stock: { item: string; name: string; count: number }[] }[];
  /** Logistics transfer orders, oldest first. */
  transfers: UiTransfer[];
  /** A shuttle is free to take a "go to base" order right now. */
  ferryReady: boolean;
}

/** One logistics order: what is left to move between two regions, and what it is doing. */
export interface UiTransfer {
  id: number;
  from: string;
  to: string;
  items: { item: string; name: string; count: number }[];
  total: number;
  moved: number;
  trips: number;
  /** 'queued' | 'boarding' | 'underway' | 'blocked' (blocked is shown in the warning colour). */
  state: string;
  status: string;
  /** Queued by the game (salvage), not by the player. */
  auto: boolean;
}

/** Where the combat overlay shows the enemy ship, in CSS px relative to the page. */
export interface UiRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface UiAlert {
  id: number;
  kind: UiAlertKind;
  text: string;
  /** Where the camera goes when tapped, or null if unknown. */
  at: { x: number; y: number } | null;
  /** Event notices: the sim notice id (tap opens its lead when `lead`), and a title shown above the text. */
  notice?: { id: number; lead: boolean; title: string };
}

export interface UiLegend {
  label: string;
  minLabel: string;
  maxLabel: string;
  /** CSS colours, low to high. */
  gradient: string[];
}

export type UiTool = 'select' | 'build' | 'deconstruct' | 'cancel';
/** 'dig' / 'level' / 'finish' work rock mass (dig: Floor, level: Ground, finish: RockWall); 'claim' drags a base rectangle onto an asteroid; 'mine' drags a rectangle over ore (the ore tiles in it go to the mining pods in `pods`, or every pod when empty). */
export type UiBuildKind = 'wall' | 'floor' | 'door' | 'module' | 'dig' | 'level' | 'finish' | 'claim' | 'mine' | 'hull';
/** A mining pod of the player's (VehicleC with a mining laser). */
export interface UiPod {
  id: number;
  name: string;
  state: 'stowed' | 'flying' | 'docked';
  /** Mining order phase ('waiting' = no free pilot yet), or null with no order. */
  phase: 'launching' | 'outbound' | 'mining' | 'returning' | 'unloading' | 'waiting' | null;
  /** Asteroid it mines (0 = none). */
  asteroid: number;
  pilot: string | null;
  hold: number;
  cap: number;
  trips: number;
  /** Based on the player's home ship (not a claimed base). */
  home: boolean;
}

/** An asteroid or asteroid field in the node, with the ore left in it. */
export interface UiAsteroid {
  id: number;
  kind: 'big' | 'field';
  coverage: 'open' | 'mixed' | 'dense';
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  ore: { name: string; item: string; units: number; color: string }[];
  /** Pods mining it now. */
  pods: number;
}

export interface UiMining {
  asteroids: UiAsteroid[];
  pods: UiPod[];
}

export interface UiToolState {
  tool: UiTool;
  build: UiBuildKind;
  /** Module def chosen in the Modules build tab, or null. */
  moduleDef: string | null;
  /** Quarter turns clockwise for module placement. */
  rot: number;
  /** The 'mine' tool: pod ids the painted ore is ordered to (empty = every pod). */
  pods?: number[];
  /** The 'hull' tool (the outer hull plan's brushes). */
  hull?: {
    /** The brush: a rectangle (dragged out, at least 3x3) or a straight line (0, 45 or 90 degrees) that cuts the plan. */
    brush: 'rect' | 'line';
    /** Take planned tiles out instead of putting them in. */
    erase: boolean;
    /** Mirror every stroke across the ship's long axis. */
    mirror: boolean;
    /** The tool's report for the bar while dragging: why the stroke would not apply, or ''. */
    note?: string;
  };
}

export type UiCutaway = 'auto' | 'up' | 'down';

export interface UiError {
  message: string;
  stack: string;
  time: number;
}

/** Everything the UI may call or observe; built in main.ts. */
export interface UiApi {
  session: Subscribable<UiSession>;
  /** Throw this game away and start a new one (reloads the page). */
  newGame: () => void;
  /** Go back to the last save, from before the loss (reloads the page). */
  loadLastSave: () => void;
  dismissNotice: () => void;
  snapshot: Subscribable<UiSnapshot>;
  errors: Subscribable<UiError[]>;
  inspect: Subscribable<UiInspect | null>;
  crew: Subscribable<UiCrew[]>;
  /** Hostile crew on grids the player's crew stand on. */
  hostiles: Subscribable<UiCrew[]>;
  /** Center the camera on a crew member wherever they are. */
  focusCrew(id: number): void;
  /** Order the selected drafted crew to attack a hostile crew member. */
  attack(target: number): void;
  /** Selected crew id, or null (tile selection is reported through `inspect`). With several selected it is null: see `selectedGroup`. */
  selectedCrew: Subscribable<number | null>;
  /** Every selected crew member (click, box, shift-add). */
  selectedGroup: Subscribable<number[]>;
  /** The player's shuttle picked in the world, or null. */
  selectedShuttle: Subscribable<number | null>;
  /** The selection box being dragged (canvas px), or null. */
  selectBox: Subscribable<{ x0: number; y0: number; x1: number; y1: number } | null>;
  /** The order menu open at a canvas position, or null; `pickContext` runs a choice (null closes). */
  contextMenu: Subscribable<{ x: number; y: number; items: { id: string; label: string }[] } | null>;
  pickContext(id: string | null): void;
  tool: Subscribable<UiToolState>;
  modules: Subscribable<UiModule[]>;
  moduleDefs: Subscribable<UiModuleDef[]>;
  items: UiItemDef[];
  recipes: UiRecipe[];
  /** Build cost per struct kind ('floor', 'wall', 'door'). */
  structCosts: Record<string, UiCost[]>;
  /** Icon frames by item id; fills in once the asset manifest is loaded. */
  itemIcons: Subscribable<Record<string, UiIcon>>;
  /** The starmap's sprites, once loaded (null until then, or without the sheet: the map draws its code shapes). */
  starmapArt: Subscribable<UiStarArt | null>;
  /** Make the starmap's GPU view (Pixi) inside an element: the map content is drawn by it, the screen keeps the camera and panels. */
  createStarmapGpu: CreateStarmapGpu;
  stock: Subscribable<UiStock[]>;
  storages: Subscribable<UiStorage[]>;
  fabs: Subscribable<UiFab[]>;
  research: Subscribable<UiResearch>;
  selectedModule: Subscribable<number | null>;
  selectModule(id: number | null): void;
  /** Module construction sites, and the selected one (a job id). */
  sites: Subscribable<UiSite[]>;
  jobs: Subscribable<UiJobs>;
  /** The tutorial goal chain (null when finished or skipped). */
  goals: Subscribable<UiGoals | null>;
  /** Stranded without fuel (null when the ship can jump). */
  stranded: Subscribable<UiStranded | null>;
  selectedSite: Subscribable<number | null>;
  selectSite(id: number | null): void;
  /** Another ship or station picked from the node strip; the selection panel drills into it. */
  selectedShip: Subscribable<number | null>;
  /** Select another ship (ShipC entity id) or station (its trader entity id) and move the camera to a ship (null clears). A station has no ship, so no camera move. */
  selectShip(ship: number | null): void;
  stats: Subscribable<UiStats>;
  alerts: Subscribable<UiAlert[]>;
  /** Recent happenings, newest first. */
  log: Subscribable<UiLogEntry[]>;
  /** The open event decision and the last result. */
  story: Subscribable<UiStory>;
  /** The starmap view's data, and a route preview to a node (path, fuel, next jump's charge, blocker). */
  starmap: Subscribable<UiStarmap>;
  planRoute(to: string): UiStarRoute | null;
  /** The starmap screen opened or closed: it builds its data then, and the world view stops rendering behind it. */
  setStarmapOpen(open: boolean): void;
  /** The deploy picker's data while the ship waits to be placed, a spot's gap-rule error (null = valid), and what a jump would leave behind. */
  deploy: Subscribable<UiDeploy | null>;
  deployCheck(x: number, y: number): string | null;
  jumpWarnings(ship: number): UiJumpWarnings;
  /** Pick an option of the open decision and resume play. */
  chooseStory(choice: string): void;
  combat: Subscribable<UiCombat>;
  /** The FTL drive and its charge order (null when the ship is not on the map). */
  ftl: Subscribable<UiFtl | null>;
  /** Credits, hailable ships and stations, and the running deliveries. */
  trade: Subscribable<UiTrade>;
  /** The hull plan, the quote of the station whose panel is open (see `watchYard`) and the player's yard order. */
  yard: Subscribable<UiYard>;
  /** Quote this station's yard in `yard` (0 stops). */
  watchYard(station: number): void;
  shuttles: Subscribable<UiShuttles>;
  prizes: Subscribable<UiPrize[]>;
  /** Asteroids in the node and the player's mining pods. */
  mining: Subscribable<UiMining>;
  /** Asteroid picked by clicking its rock or from the node strip (null = none). */
  selectedAsteroid: Subscribable<number | null>;
  /** Select an asteroid and move the camera to it (null clears). */
  selectAsteroid(id: number | null): void;
  /** Center the camera on a shuttle (any state). */
  focusShuttle(id: number): void;
  /** Show a ship in the combat panel's view canvas (null hides it): the renderer draws into it every frame. */
  setCombatView(view: { ship: number; canvas: HTMLCanvasElement } | null): void;
  /** Which target brackets the combat view draws over the enemy's modules (module ids; 0/absent = none). */
  setCombatMarks(marks: { shipTarget?: number; overrides: number[]; hover?: number; arming: boolean }): void;
  /** Module (0 = hull) at a page position inside the combat view, or null if outside the ship. */
  pickCombat(x: number, y: number): { moduleId: number } | null;
  /** The armed "Target in view" aim, or null. */
  aiming: Subscribable<UiAiming | null>;
  setAiming(a: UiAiming | null): void;
  /** Roof hostile ships (default) or show their interior. */
  setRoofEnemies(on: boolean): void;
  /** Show the player's ship with its roof on (view from outside). */
  setRoofPlayer(on: boolean): void;
  /** Frame the player's ship and a hostile ship (or only the player's ship) in the camera. */
  focusFight(ship: number | null): void;
  /** Spawn a raider about 30 tiles from the player's ship. */
  spawnRaider(boarders?: boolean): void;
  /** Spawn a procedurally generated enemy of a faction id (random faction if omitted) where a raider would go. */
  spawnGenerated(faction?: string): void;
  /** Generate a station of a kind ('station.trading'...) and size east of everything in the node, and frame it. */
  spawnStation(kind: string, size: 'outpost' | 'station' | 'hub'): void;
  /** Overlay ids offered by the picker, in order. */
  overlayList: { id: string; label: string }[];
  overlayLegend(id: string): UiLegend | null;
  dismissAlert(id: number): void;
  /** Move the camera to an alert's location. */
  focusAlert(id: number): void;
  /** Brief message (e.g. a rejected command), or null. */
  toast: Subscribable<string | null>;
  setTool(state: Partial<UiToolState>): void;
  /** Portrait (PNG data URL, whole art px: show it pixelated) of a crew member, or null while their sheets load. */
  portrait(id: number): string | null;
  /** A module def's game art at a rotation, or null while its sheets load (`w` 0: no art). */
  moduleThumb(def: string, rot: number): UiThumb | null;
  /** Why the module being placed cannot go at the cursor (a placement error), with its screen position near the ghost, or null. */
  placeHint: Subscribable<{ x: number; y: number; text: string; ok?: boolean } | null>;
  /** Select a crew member (null clears) and optionally center the camera on them. */
  selectCrew(id: number | null, focus?: boolean): void;
  setCutaway(mode: UiCutaway): void;
  setOverlay(field: string | null): void;
  dispatch(cmd: Command): void;
  setSpeed(speed: 0 | 1 | 2 | 3): void;
  togglePause(): void;
  clearErrors(): void;
  buildRepro(): string;
  /** The in-game bug report: the context shown in the dialog, the pre-filled GitHub issue link, and the save and screenshot files. */
  bugReport: {
    context(): string;
    issue(draft: { title: string; what: string; expected: string }): { url: string; trimmed: boolean };
    saveJson(): string;
    screenshot(): Promise<Blob | null>;
  };
  /** Called once with the game canvas so the app layer can attach the renderer. */
  attachCanvas(canvas: HTMLCanvasElement): void;
  throwTestError(): void;
}
