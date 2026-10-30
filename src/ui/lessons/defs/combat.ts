import { anyOf, onCommand, onEvent, when } from '../conditions';
import { moduleTarget, uiTarget } from '../targets';
import type { LessonCtx, LessonDef } from '../types';

/** The enemy the combat view shows (the same pick as CombatHud). */
const enemyOf = (ctx: LessonCtx) => ctx.combat.enemies.find((e) => e.state === 'active' || e.state === 'disabled') ?? ctx.combat.enemies[0];
/** An enemy module worth aiming at: a weapon, else shields, else anything still standing. */
const enemyModule = (ctx: LessonCtx): number | null => {
  const mods = enemyOf(ctx)?.modules.filter((m) => m.hp > 0) ?? [];
  return (mods.find((m) => m.kind === 'weapon') ?? mods.find((m) => m.kind === 'shield') ?? mods[0])?.id ?? null;
};
const fighting = (ctx: LessonCtx) => ctx.combat.inCombat && !!ctx.combat.player && !!enemyOf(ctx);

/** The steps' lines in the instructor's voice. */
export const CREW_VOICE = {
  pick: 'Weapons are yours. Press [Q] or grab a card.',
  aim: 'Now click a part of their ship to aim. Guns or shields first.',
  enemy: "That's them up there: hull, shields, and a bar for each gun. When a bar fills, it fires.",
  modes: "Missiles sit on HOLD to save ammo, waiting for your aim or a volley [V]. [Shift]+[Q] or a right-click flips a weapon to AUTO, which fires whenever it's charged. [H] holds them all.",
  heat: 'Watch the heat. At 100% we lock up. [G] vents it, but drops our shields.',
  shields: 'Each shield layer takes one shot, then recharges. Keep a pilot at the helm and we dodge some.',
  flee: "If it goes bad, the pilot charges the drive. When it's full, [F] gets us out.",
};
/** The same steps, goal first (the user's earlier pick). */
export const GOAL_FIRST = {
  pick: 'To fire, first pick a weapon: press [Q] or click its card.',
  aim: 'To hurt them where it counts, click one of their modules. Weapons and shields are good first targets.',
  enemy: "To see what's coming, watch their card: hull, shields, and a bar for each gun that fires when full.",
  modes: "To save ammo or time a strike, put a weapon on HOLD with [Shift]+[Q] or a right-click; it waits for an aim or a volley [V]. AUTO fires whenever it's charged. [H] holds them all. Missiles start on HOLD.",
  heat: 'To avoid locking up, keep heat under 100%. [G] vents it, at the cost of your shields.',
  shields: 'To survive their fire, keep shields up: each layer blocks one shot, then recharges. Keep a pilot at the helm to dodge.',
  flee: 'To escape, wait for the drive to charge, then press [F].',
} satisfies typeof CREW_VOICE;
/** Which voice the lesson speaks in: swap to GOAL_FIRST to switch back. */
const TEXT: typeof CREW_VOICE = CREW_VOICE;

/** The first fight: the combat strip, from picking a weapon to fleeing. */
export const combatLesson = {
  id: 'lesson.combat',
  title: 'Combat',
  speaker: 'speaker.tactical',
  trigger: anyOf(onEvent('combat.started'), when(fighting)),
  // The camera frames the enemy and its art loads first.
  delay: 1500,
  while: when(fighting),
  steps: [
    {
      title: 'Pick a weapon',
      text: TEXT.pick,
      target: uiTarget('combat.weapons'),
      advance: when((ctx) => ctx.aiming?.weapon != null),
    },
    {
      title: 'Aim',
      text: TEXT.aim,
      target: moduleTarget(enemyModule),
      advance: onCommand('combat.setTarget', (c, ctx) => c.ship === ctx.combat.player?.ship && (c.weaponId !== null || c.targetModuleId > 0 || !!c.targetTile)),
    },
    {
      title: 'The enemy',
      text: TEXT.enemy,
      target: uiTarget('combat.enemy'),
      advance: 'gotIt',
    },
    {
      title: 'Firing modes',
      text: TEXT.modes,
      target: uiTarget('combat.weapons'),
      advance: 'gotIt',
    },
    {
      title: 'Heat',
      text: TEXT.heat,
      target: uiTarget('combat.heat'),
      advance: 'gotIt',
    },
    {
      title: 'Shields and evasion',
      text: TEXT.shields,
      target: uiTarget('combat.status'),
      advance: 'gotIt',
    },
    {
      title: 'Flee',
      text: TEXT.flee,
      target: uiTarget('combat.flee'),
      advance: 'gotIt',
    },
  ],
} satisfies LessonDef;
