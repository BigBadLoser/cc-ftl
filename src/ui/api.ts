import type { UiDeploy, UiJumpWarnings, UiStarmap, UiStarRoute } from './starmapApi';
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

/** A loose stack on a floor tile. */
export interface UiStack {
  item: string;
  name: string;
  count: number;
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
  priority: number;
  enabled: boolean;
  powered: boolean;
  /** Units per second: positive supplies, negative draws. */
  power: number;
  /** Holds items (has a storage panel). */
  storage: boolean;
  /** Crafts recipes (has a production panel). */
  crafting: boolean;
  /** Robot bay state (null for other modules). */
  bay: UiRobotBay | null;
  /** Airlocks: EVA suits stowed now and in a full complement (null for other modules). */
  suits: { stowed: number; max: number } | null;
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
export interface UiCost {
  item: string;
  name: string;
  count: number;
}

export interface UiItemDef {
  id: string;
  name: string;
  stackSize: number;
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
}

export interface UiStats {
  supply: number;
  demand: number;
  /** Average O2 (kPa) of rooms with crew in them, or null when nobody is inside one. */
  o2: number | null;
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
  | 'outpost.discovered' | 'ship.provoked' | 'mining.waiting' | 'mining.done';

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
  target: { ship: number; moduleId: number; label: string } | null;
  modules: UiShipModule[];
}

export interface UiCombat {
  inCombat: boolean;
  player: (UiShipCombat & { weapons: UiWeapon[]; consoles: UiConsole[] }) | null;
  /** Hostile ships (not fled), nearest first. */
  enemies: UiShipCombat[];
}

/** A crew member as the shuttle panel lists them. `boarding` is the vehicle they are walking to (0 = none). */
export interface UiShuttleCrew {
  id: number;
  name: string;
  role: string;
  boarding: number;
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
  /** Module id of its home bay. */
  bay: number;
  /** Crew can climb in or out here right now (stowed in the bay, or docked). */
  boardable: boolean;
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
}

export interface UiTradeOffer {
  id: number;
  give: { item: string; count: number }[];
  get: { item: string; count: number }[];
  barter: boolean;
  /** > 0 the player pays, < 0 they pay. */
  balance: number;
}

/** A ship or station the player can hail. */
export interface UiTradePartner {
  /** The trader entity: the ShipC entity of a ship, a plain trader entity for a station (no ship). Also the UI key of the node. */
  id: number;
  name: string;
  kind: 'ship' | 'station';
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
  out: { courier: string; error: string };
  in: { courier: string; error: string };
  /** Units a shuttle hold takes. */
  holdCap: number;
  offer: UiTradeOffer | null;
  distance: number;
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
/** 'dig' / 'level' work rock mass (dig: Floor, level: Ground); 'claim' drags a base rectangle onto an asteroid. */
export type UiBuildKind = 'wall' | 'floor' | 'door' | 'module' | 'dig' | 'level' | 'claim';
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
}

export type UiCutaway = 'auto' | 'up' | 'down';

export interface UiError {
  message: string;
  stack: string;
  time: number;
}

/** Everything the UI may call or observe; built in main.ts. */
export interface UiApi {
  snapshot: Subscribable<UiSnapshot>;
  errors: Subscribable<UiError[]>;
  inspect: Subscribable<UiInspect | null>;
  crew: Subscribable<UiCrew[]>;
  /** Hostile crew on grids the player's crew stand on. */
  hostiles: Subscribable<UiCrew[]>;
  /** Center the camera on a crew member wherever they are. */
  focusCrew(id: number): void;
  /** Order drafted crew (the selected one, else all) to attack a hostile crew member. */
  attack(target: number): void;
  /** Selected crew id, or null (tile selection is reported through `inspect`). */
  selectedCrew: Subscribable<number | null>;
  tool: Subscribable<UiToolState>;
  modules: Subscribable<UiModule[]>;
  moduleDefs: UiModuleDef[];
  items: UiItemDef[];
  recipes: UiRecipe[];
  /** Build cost per struct kind ('floor', 'wall', 'door'). */
  structCosts: Record<string, UiCost[]>;
  /** Icon frames by item id; fills in once the asset manifest is loaded. */
  itemIcons: Subscribable<Record<string, UiIcon>>;
  stock: Subscribable<UiStock[]>;
  storages: Subscribable<UiStorage[]>;
  fabs: Subscribable<UiFab[]>;
  selectedModule: Subscribable<number | null>;
  selectModule(id: number | null): void;
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
  /** Credits, hailable ships and stations, and the running deliveries. */
  trade: Subscribable<UiTrade>;
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
  /** Show a ship in the combat overlay rectangle (null hides it). */
  setCombatView(view: { ship: number; rect: UiRect } | null): void;
  /** Which target brackets the combat view draws over the enemy's modules (module ids; 0/absent = none). */
  setCombatMarks(marks: { shipTarget?: number; overrides: number[]; hover?: number; arming: boolean }): void;
  /** Module (0 = hull) at a page position inside the combat view, or null if outside the ship. */
  pickCombat(x: number, y: number): { moduleId: number } | null;
  /** Roof hostile ships (default) or show their interior. */
  setRoofEnemies(on: boolean): void;
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
  /** Select a crew member (null clears) and optionally center the camera on them. */
  selectCrew(id: number | null, focus?: boolean): void;
  setCutaway(mode: UiCutaway): void;
  setOverlay(field: string | null): void;
  dispatch(cmd: Command): void;
  setSpeed(speed: 0 | 1 | 2 | 3): void;
  togglePause(): void;
  clearErrors(): void;
  buildRepro(): string;
  /** Called once with the game canvas so the app layer can attach the renderer. */
  attachCanvas(canvas: HTMLCanvasElement): void;
  throwTestError(): void;
}
