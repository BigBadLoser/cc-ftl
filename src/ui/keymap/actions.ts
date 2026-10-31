/**
 * Every key the game answers to, in one place: the single source of truth for key handlers, the Controls page and the key badges in
 * lessons and on buttons. A key is a chord string: an optional `Shift+` and a `KeyboardEvent.code` (`KeyQ`, `Digit1`, `Space`, `ArrowUp`):
 * physical keys, so bindings survive keyboard layouts. Players rebind them in the Esc menu (bindings.ts keeps their choices).
 */
export const KEY_GROUPS = [
  { id: 'time', label: 'Time' },
  { id: 'camera', label: 'Camera' },
  { id: 'screens', label: 'Screens' },
  { id: 'crew', label: 'Crew and build' },
  { id: 'combat', label: 'Combat' },
  { id: 'menus', label: 'Menus' },
  { id: 'debug', label: 'Debug' },
] as const;

export type KeyGroup = (typeof KEY_GROUPS)[number]['id'];

/**
 * When an action's handler runs (see LIVE_WITH in bindings.ts):
 * - `global`: always (App keys, camera keys).
 * - `world`: the main view, in a fight or not (app/input.ts forwards Draft with no combat guard: drafting crew in a fight is real play).
 * - `build`: while a build tool is open, which never happens in a fight (a fight drops the tools and the tool bar is hidden).
 * - `combat`: during a fight (the combat strip, CombatHud).
 * Two actions on one key conflict when their contexts can be live together, unless one lists the other in `shares`: a deliberate double
 * use, such as R drafting crew, rotating a module and picking weapon 4 (the combat strip lets R fall through when there is no fourth weapon).
 */
export type KeyContext = 'global' | 'world' | 'build' | 'combat';

export interface ActionDef {
  id: string;
  group: KeyGroup;
  label: string;
  /** Default chords, primary first (at most two). */
  keys: readonly string[];
  context: KeyContext;
  /** Not rebindable (Esc). */
  fixed?: boolean;
  shares?: readonly string[];
}

const a = <I extends string>(id: I, group: KeyGroup, label: string, keys: string[], context: KeyContext = 'global', more: Partial<ActionDef> = {}) =>
  ({ id, group, label, keys, context, ...more }) as ActionDef & { id: I };

export const ACTIONS = [
  a('game.pause', 'time', 'Pause / resume', ['Space']),
  a('game.speed1', 'time', 'Speed 1×', ['Digit1']),
  a('game.speed2', 'time', 'Speed 2×', ['Digit2']),
  a('game.speed3', 'time', 'Speed 3×', ['Digit3']),

  a('cam.up', 'camera', 'Pan up', ['KeyW', 'ArrowUp'], 'global', { shares: ['combat.weapon2'] }),
  a('cam.down', 'camera', 'Pan down', ['KeyS', 'ArrowDown']),
  a('cam.left', 'camera', 'Pan left', ['KeyA', 'ArrowLeft']),
  a('cam.right', 'camera', 'Pan right', ['KeyD', 'ArrowRight']),
  a('cam.zoomIn', 'camera', 'Zoom in', ['Equal', 'NumpadAdd']),
  a('cam.zoomOut', 'camera', 'Zoom out', ['Minus', 'NumpadSubtract']),

  a('view.starmap', 'screens', 'Starmap', ['KeyM']),

  a('crew.draft', 'crew', 'Draft / stand down selected crew', ['KeyR'], 'world', { shares: ['build.rotate', 'combat.weapon4'] }),
  a('build.rotate', 'crew', 'Rotate module', ['KeyR'], 'build', { shares: ['crew.draft'] }),
  a('build.rotateBack', 'crew', 'Rotate module back', ['Shift+KeyR'], 'build'),

  a('combat.weapon1', 'combat', 'Select weapon 1', ['KeyQ'], 'combat'),
  a('combat.weapon2', 'combat', 'Select weapon 2', ['KeyW'], 'combat', { shares: ['cam.up'] }),
  a('combat.weapon3', 'combat', 'Select weapon 3', ['KeyE'], 'combat'),
  a('combat.weapon4', 'combat', 'Select weapon 4', ['KeyR'], 'combat', { shares: ['crew.draft'] }),
  a('combat.mode1', 'combat', 'Weapon 1: AUTO / HOLD', ['Shift+KeyQ'], 'combat'),
  a('combat.mode2', 'combat', 'Weapon 2: AUTO / HOLD', ['Shift+KeyW'], 'combat'),
  a('combat.mode3', 'combat', 'Weapon 3: AUTO / HOLD', ['Shift+KeyE'], 'combat'),
  a('combat.mode4', 'combat', 'Weapon 4: AUTO / HOLD', ['Shift+KeyR'], 'combat'),
  a('combat.volley', 'combat', 'Fire volley', ['KeyV'], 'combat'),
  a('combat.holdAll', 'combat', 'Hold all weapons', ['KeyH'], 'combat'),
  a('combat.vent', 'combat', 'Vent heat', ['KeyG'], 'combat'),
  a('combat.flee', 'combat', 'Flee', ['KeyF'], 'combat'),
  a('combat.board', 'combat', 'Board the enemy ship (party picker)', ['KeyB'], 'combat'),
  a('combat.swap', 'combat', 'Swap main view and inset', ['Tab'], 'combat'),

  a('ui.confirm', 'menus', 'Confirm (Got it, Deploy)', ['Enter']),
  a('ui.menu', 'menus', 'Cancel / menu', ['Escape'], 'global', { fixed: true }),

  a('debug.panel', 'debug', 'Debug panel', ['Backquote']),
  a('debug.profiler', 'debug', 'Profiler panel', ['F3']),
] as const satisfies readonly ActionDef[];

export type ActionId = (typeof ACTIONS)[number]['id'];

export const ACTION_BY_ID: ReadonlyMap<string, ActionDef> = new Map(ACTIONS.map((x) => [x.id, x]));

/** The four weapon slots' select and mode actions, in slot order. */
export const WEAPON_ACTIONS = ['combat.weapon1', 'combat.weapon2', 'combat.weapon3', 'combat.weapon4'] as const satisfies readonly ActionId[];
export const MODE_ACTIONS = ['combat.mode1', 'combat.mode2', 'combat.mode3', 'combat.mode4'] as const satisfies readonly ActionId[];
