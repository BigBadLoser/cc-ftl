<script lang="ts">
  import { keymap } from '../keymap';
  import { isTypingTarget, modalOpen } from '../keys';
  import { onMount } from 'svelte';
  import type { UiAiming, UiApi, UiCombat, UiSignal } from '../api';
  import type { Rect } from '../combat/panelPlace';
  import CoachMark from './CoachMark.svelte';
  import { LESSONS } from './defs';
  import { LessonEngine, type LessonView, type Speed } from './engine';
  import { lessonPrefs, type LessonPrefs } from './prefs';
  import { SPEAKERS, type SpeakerDef } from './speakers';
  import { resolveTarget, type ScreenRect } from './targets';
  import type { LessonCtx } from './types';

  /**
   * Runs the lessons (issue #203): builds the context from the UI's snapshots, feeds the engine every frame with the sim events and commands
   * since the last one, and shows the open step as a coach mark. `?lessons=reset` forgets the seen lessons on load; `?lessons=off` turns them
   * off for this page load (headless screenshots).
   */
  /** `busy`: something the App shows over the game (the bug report) that owns the speed; lessons wait until it closes. */
  let { api, busy: uiBusy = false }: { api: UiApi; busy?: boolean } = $props();
  let view = $state<LessonView | null>(null);
  let rect = $state<ScreenRect | null>(null);
  let obstacles = $state<Rect[]>([]);
  /** The open step's speaker (a step overrides its lesson) and their portrait, polled until its sheets have loaded. */
  const speaker = $derived<SpeakerDef | null>(view ? SPEAKERS[view.step.speaker ?? view.lesson.speaker ?? ('' as never)] ?? null : null);
  let face = $state<string | null>(null);
  /** Set on mount (the card only shows once it runs). */
  const ref: { engine: LessonEngine | null } = { engine: null };

  onMount(() => {
    const flag = new URLSearchParams(location.search).get('lessons');
    if (flag === 'reset') lessonPrefs.reset();
    const prefs: LessonPrefs = flag === 'off' ? { ...lessonPrefs, enabled: () => false } : lessonPrefs;

    let combat: UiCombat = { inCombat: false, player: null, enemies: [] };
    let aiming: UiAiming | null = null;
    let speed: Speed = 0;
    let storyBusy = false;
    // The window is in the background: no lesson opens while the player is away (the background pause owns the clock then).
    let away = false;
    const onBlur = () => (away = true);
    const onFocus = () => (away = false);
    const pending: UiSignal[] = [];
    // The game's own time controls: the same path as the pause key.
    const eng = new LessonEngine(LESSONS, { speed: () => speed, setSpeed: (s) => api.setSpeed(s) }, prefs);
    ref.engine = eng;

    const unsubs = [
      api.combat.subscribe((c) => (combat = c)),
      api.aiming.subscribe((a) => (aiming = a)),
      api.snapshot.subscribe((s) => (speed = s.speed)),
      api.story.subscribe((s) => (storyBusy = !!s.active)),
      api.onSignal((s) => pending.push(s)),
      eng.subscribe((v) => (view = v)),
    ];

    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const ctx: LessonCtx = { combat, aiming, busy: storyBusy || uiBusy || away };
      eng.update(ctx, performance.now(), pending.splice(0));
      const t = eng.current?.step.target;
      const r = t ? resolveTarget(t, { ctx, api, doc: document }) : null;
      if (!sameRect(r, rect)) rect = r;
      if (eng.current) obstacles = anchoredOthers(r);
      const sp: SpeakerDef | null = speaker;
      const f = sp ? ((sp.portrait ? api.portraitArt(sp.portrait) : null) ?? api.lookPortrait(sp.look)) : null;
      if (f !== face) face = f;
    };
    raf = requestAnimationFrame(frame);

    // While a lesson is open the speed keys are the lesson's (it restores the speed on close); Enter is Got it.
    const onKey = (e: KeyboardEvent) => {
      const v = eng.current;
      // Typing in a text field (the bug report, a name) keeps its keys.
      if (!v || uiBusy || modalOpen() || isTypingTarget(e)) return;
      if ((['game.pause', 'game.speed1', 'game.speed2', 'game.speed3'] as const).some((id) => keymap.matches(e, id))) {
        e.preventDefault();
        e.stopImmediatePropagation();
      } else if (keymap.matches(e, 'ui.confirm') && v.step.advance === 'gotIt') {
        e.preventDefault();
        e.stopImmediatePropagation();
        eng.gotIt();
      }
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey, true);
      unsubs.forEach((u) => u());
    };
  });

  const sameRect = (a: ScreenRect | null, b: ScreenRect | null) =>
    a === b || (!!a && !!b && Math.round(a.x0) === Math.round(b.x0) && Math.round(a.y0) === Math.round(b.y0) && Math.round(a.x1) === Math.round(b.x1) && Math.round(a.y1) === Math.round(b.y1));

  /** Every other anchored HUD piece (and the top-right column): the card goes where it covers none of them. */
  function anchoredOthers(target: ScreenRect | null): Rect[] {
    const out: Rect[] = [];
    for (const n of document.querySelectorAll('[data-lesson], .rcol')) {
      const r = n.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const o = { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom };
      if (!sameRect(o, target)) out.push(o);
    }
    return obstacles.length === out.length && obstacles.every((x, i) => sameRect(x, out[i]!)) ? obstacles : out;
  }
</script>

{#if view}
  <CoachMark {view} {speaker} {face} {rect} {obstacles} onGotIt={() => ref.engine?.gotIt()} onDismiss={() => ref.engine?.dismiss()} />
{/if}
