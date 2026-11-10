import type { UiAlert, UiCombat, UiCrew, UiFtl, UiGoals, UiModule, UiShipCombat, UiSnapshot, UiStats, UiStock, UiStory, UiTrade } from '../ui/api';
import type { UiDeploy, UiStarmap } from '../ui/starmapApi';
import { TICK_HZ } from '../sim/time';

/** A store as the UI reads it; the playtest API reads each once per call. */
export interface Source<T> {
  subscribe(run: (value: T) => void): () => void;
}

/** The slice of the UI api the playtest API reads: only what the player can see on screen. */
export interface PlaySources {
  snapshot: Source<UiSnapshot>;
  crew: Source<UiCrew[]>;
  hostiles: Source<UiCrew[]>;
  modules: Source<UiModule[]>;
  stock: Source<UiStock[]>;
  stats: Source<UiStats>;
  combat: Source<UiCombat>;
  ftl: Source<UiFtl | null>;
  story: Source<UiStory>;
  trade: Source<UiTrade>;
  alerts: Source<UiAlert[]>;
  goals: Source<UiGoals | null>;
  deploy: Source<UiDeploy | null>;
  starmap: Source<UiStarmap>;
}

export function read<T>(s: Source<T>): T {
  let v: T | undefined;
  s.subscribe((x) => (v = x))();
  return v as T;
}

export type PlayScreen = 'game' | 'combat' | 'starmap' | 'hyperspace' | 'deploy' | 'decision' | 'gameover';

export interface PlayState {
  screen: PlayScreen;
  /** Game time in seconds and in sim ticks (20 per second). */
  t: number;
  tick: number;
  paused: boolean;
  speed: 0 | 1 | 2 | 3;
  /** The text of a dialog or panel covering the game (Esc menu, ...), when one is open. */
  dialog?: string;
  decision: { title: string; text: string; choices: { id: string; label: string; enabled: boolean; note?: string }[] } | null;
  ship: {
    name: string;
    /** Hull and module integrity, percent. */
    hull: number;
    shields: { layers: number; max: number };
    evasion: number;
    credits: number;
    fuel: number | null;
    power: { supply: number; demand: number };
    food: { units: number; hoursLeft: number | null };
    /** Average oxygen of the rooms crew are in (kPa), or null. */
    o2: number | null;
    heat: number;
    ftl: { state: string; charge: number; max: number; blocker: string | null } | null;
    stock: { item: string; n: number }[];
  };
  /** Modules of the player's ship that are damaged, off or unpowered (capped). `status`: off (switched off), idle, unpowered, destroyed, ok (damaged only). */
  modules: { id: number; name: string; hp: string; status: string }[];
  /** The rest, healthy and running, counted by name. */
  modulesOk: Record<string, number>;
  weapons: { id: number; name: string; charge: number; mode: string; ammo: number | null; powered: boolean; target: string | null }[];
  consoles: { name: string; operator: string | null }[];
  incoming: { name: string; eta: number }[];
  crew: { id: number; name: string; role: string; where: string; hp: string; doing: string; rest: number; hunger: number | null; mood: number | null; flags: string[] }[];
  /** Ships in the node that are hostile or listed at battle stations, with what the combat panel shows of them. */
  enemies: {
    id: number; name: string; faction: string; state: string; hostile: boolean; hull: number; shields: string; ftl: string;
    weapons: { name: string; charge: number; eta: number | null; stalled: boolean }[];
    modules: string[];
  }[];
  /** Enemy crew standing on a grid with yours (boarders). */
  boarders: { id: number; name: string; where: string; hp: string }[];
  /** Ships and stations in reach to hail, and the open urgent alerts. */
  nearby: { id: number; name: string; kind: string; hail: string }[];
  alerts: { id: number; text: string }[];
  goals: { act: string; todo: string[] } | null;
  /** The hyperspace trip under way (or halted: noFuel, interdicted, event, story): its phase, the node it is leaving and the one it heads for. */
  travel: { phase: string; from: string; to: string; hopsLeft: number } | null;
}

export interface StateOptions {
  src: PlaySources;
  tick: number;
  starmapOpen: boolean;
  lost: string | null;
  dialog?: string;
}

const MODULE_CAP = 24;
const ENEMY_MODULE_CAP = 8;
const CREW_CAP = 16;
const STOCK_CAP = 10;
const pct = (v: number) => Math.round(v * 100);
const r1 = (v: number) => Math.round(v * 10) / 10;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function moduleStatus(m: UiModule): string {
  if (m.hp <= 0) return 'destroyed';
  if (!m.enabled) return 'off';
  if (m.idle) return 'idle';
  return m.powered || m.power >= 0 ? 'ok' : 'unpowered';
}

function enemyOf(e: UiShipCombat): PlayState['enemies'][number] {
  return {
    id: e.ship, name: e.name, faction: e.faction, state: e.state, hostile: !e.neutral, hull: pct(e.integrity),
    shields: `${e.shield.layers}/${e.shield.max}`, ftl: `${r1(e.ftl)}/${r1(e.ftlMax)}`,
    weapons: (e.charges ?? []).map((w) => ({ name: w.name, charge: pct(w.charge), eta: w.eta === null ? null : r1(w.eta), stalled: w.stalled || w.destroyed })),
    modules: e.modules.slice(0, ENEMY_MODULE_CAP).map((m) => `${m.id} ${m.name} ${m.hp}/${m.maxHp}${m.powered ? '' : ' off'}`),
  };
}

function crewFlags(c: UiCrew): string[] {
  const f: string[] = [];
  if (c.dead) f.push('dead');
  if (c.downed) f.push(c.downed.stabilized ? 'downed (stable)' : `downed (${Math.round(c.downed.bleed)}s to live)`);
  if (c.broke) f.push(c.broke);
  if (c.drafted) f.push('drafted');
  if (c.away) f.push('away');
  if (c.suit?.low) f.push('suit air low');
  return f;
}

/** The player's view of the game as plain data, under about 4 KB. Reads the UI's own stores, so it holds only what the screen shows. */
export function buildState(o: StateOptions): PlayState {
  const { src } = o;
  const snap = read(src.snapshot);
  const combat = read(src.combat);
  const story = read(src.story).active;
  const map = read(src.starmap);
  const stock = read(src.stock);
  const stats = read(src.stats);
  const ftl = read(src.ftl);
  const mine = combat.player;
  const crew = read(src.crew);
  const mods = read(src.modules);
  const goals = read(src.goals);

  const screen: PlayScreen = o.lost ? 'gameover'
    : story ? 'decision'
    : read(src.deploy) ? 'deploy'
    : map.state === 'hyperspace' ? 'hyperspace'
    : o.starmapOpen ? 'starmap'
    : combat.inCombat ? 'combat' : 'game';

  const rows = mods.map((m) => ({ id: m.id, name: m.name, hp: `${Math.round(m.hp)}/${Math.round(m.maxHp)}`, status: moduleStatus(m), healthy: m.hp >= m.maxHp && ['ok', 'idle'].includes(moduleStatus(m)) }));
  const modulesOk: Record<string, number> = {};
  for (const m of rows) if (m.healthy) modulesOk[m.name] = (modulesOk[m.name] ?? 0) + 1;
  const trade = read(src.trade);
  const fuel = stock.filter((s) => s.item === 'item.fuel');

  return {
    screen, t: r1(o.tick / TICK_HZ), tick: o.tick, paused: snap.paused, speed: snap.speed,
    ...(o.dialog ? { dialog: o.dialog } : {}),
    decision: story ? {
      title: story.title, text: clip(story.text, 400),
      choices: story.choices.map((c) => ({ id: c.id, label: c.label, enabled: c.enabled, ...(c.reasons[0] ?? c.hint ? { note: clip(c.reasons[0] ?? c.hint ?? '', 80) } : {}) })),
    } : null,
    ship: {
      name: mine?.name ?? '', hull: pct(mine?.integrity ?? 0), shields: { layers: mine?.shield.layers ?? 0, max: mine?.shield.max ?? 0 }, evasion: pct(mine?.evasion ?? 0),
      credits: trade.credits, fuel: fuel.length ? fuel.reduce((n, s) => n + s.floor + s.stored, 0) : null,
      power: { supply: r1(stats.supply), demand: r1(stats.demand) }, food: { units: stats.food.units, hoursLeft: stats.food.hours === null ? null : r1(stats.food.hours) },
      o2: stats.o2 === null ? null : r1(stats.o2), heat: mine ? r1(mine.heat.value) : 0,
      ftl: ftl ? { state: ftl.state, charge: r1(ftl.charge), max: r1(ftl.max), blocker: ftl.blocker } : null,
      stock: stock.map((s) => ({ item: s.name, n: s.floor + s.stored + s.carried })).filter((s) => s.n > 0).slice(0, STOCK_CAP),
    },
    modules: rows.filter((m) => !m.healthy).slice(0, MODULE_CAP).map((m) => ({ id: m.id, name: m.name, hp: m.hp, status: m.status })),
    modulesOk,
    weapons: (mine?.weapons ?? []).map((w) => ({ id: w.id, name: w.short, charge: pct(w.charge), mode: w.mode, ammo: w.ammo, powered: w.powered, target: w.target })),
    consoles: (mine?.consoles ?? []).map((c) => ({ name: c.name, operator: c.operator })),
    incoming: (mine?.incoming ?? []).map((i) => ({ name: i.name, eta: r1(i.eta) })),
    crew: crew.filter((c) => c.side === 'player').slice(0, CREW_CAP).map((c) => ({
      id: c.id, name: c.name, role: c.role, where: c.where, hp: `${Math.round(c.hp)}/${Math.round(c.maxHp)}`, doing: c.job ?? c.activity,
      rest: Math.round(c.rest), hunger: c.hunger === null ? null : Math.round(c.hunger), mood: c.mood ? Math.round(c.mood.value) : null, flags: crewFlags(c),
    })),
    enemies: combat.enemies.map(enemyOf),
    boarders: read(src.hostiles).filter((c) => !c.dead).slice(0, 8).map((c) => ({ id: c.id, name: c.name, where: c.where, hp: `${Math.round(c.hp)}/${Math.round(c.maxHp)}` })),
    nearby: trade.partners.slice(0, 8).map((p) => ({ id: p.id, name: p.name, kind: p.role ? `${p.kind} (${p.role})` : p.kind, hail: p.hail })),
    alerts: read(src.alerts).slice(0, 6).map((a) => ({ id: a.id, text: clip(a.text, 100) })),
    goals: goals ? { act: goals.title, todo: goals.goals.filter((g) => !g.done).slice(0, 3).map((g) => clip(g.text || g.title, 120)) } : null,
    travel: map.travel ? { phase: map.travel.phase, from: map.travel.names[map.travel.at] ?? '', to: map.travel.names[map.travel.at + 1] ?? '', hopsLeft: map.travel.route.length - 1 - map.travel.at } : null,
  };
}
