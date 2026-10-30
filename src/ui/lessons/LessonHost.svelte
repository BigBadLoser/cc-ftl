<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiAiming, UiApi, UiCombat, UiSignal } from '../api';
  import type { Rect } from '../combat/panelPlace';
  import CoachMark from './CoachMark.svelte';
  import { LESSONS } from './defs';
  import { LessonEngine, type LessonView, type Speed } from './engine';
  import { lessonPrefs, type LessonPrefs } from './prefs';
  import { resolveTarget, type ScreenRect } from './targets';
  import type { LessonCtx } from './types';

  /**
   * Runs the lessons (issue #203): builds the context from the UI's snapshots, feeds the engine every frame with the sim events and commands
   * since the last one, and shows the open step as a coach mark. `?lessons=reset` forgets the seen lessons on load; `?lessons=off` turns them
   * off for this page load (headless screenshots).
   */
  let { api }: { api: UiApi } = $props();
  let view = $state<LessonView | null>(null);
  let rect = $state<ScreenRect | null>(null);
  let obstacles = $state<Rect[]>([]);
  /** Set on mount (the card only shows once it runs). */
  const ref: { engine: LessonEngine | null } = { engine: null };

  onMount(() => {
    const flag = new URLSearchParams(location.search).get('lessons');
    if (flag === 'reset') lessonPrefs.reset();
    const prefs: LessonPrefs = flag === 'off' ? { ...lessonPrefs, enabled: () => false } : lessonPrefs;

    let combat: UiCombat = { inCombat: false, player: null, enemies: [] };
    let aiming: UiAiming | null = null;
    let speed: Speed = 0;
    let busy = false;
    const pending: UiSignal[] = [];
    // The game's own time controls: the same path as the pause key.
    const eng = new LessonEngine(LESSONS, { speed: () => speed, setSpeed: (s) => api.setSpeed(s) }, prefs);
    ref.engine = eng;

    const unsubs = [
      api.combat.subscribe((c) => (combat = c)),
      api.aiming.subscribe((a) => (aiming = a)),
      api.snapshot.subscribe((s) => (speed = s.speed)),
      api.story.subscribe((s) => (busy = !!s.active)),
      api.onSignal((s) => pending.push(s)),
      eng.subscribe((v) => (view = v)),
    ];

    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const ctx: LessonCtx = { combat, aiming, busy };
      eng.update(ctx, performance.now(), pending.splice(0));
      const t = eng.current?.step.target;
      const r = t ? resolveTarget(t, { ctx, api, doc: document }) : null;
      if (!sameRect(r, rect)) rect = r;
      if (eng.current) obstacles = anchoredOthers(r);
    };
    raf = requestAnimationFrame(frame);

    // While a lesson is open the speed keys are the lesson's (it restores the speed on close); Enter is Got it.
    const onKey = (e: KeyboardEvent) => {
      const v = eng.current;
      if (!v) return;
      if (e.key === ' ' || e.key === '1' || e.key === '2' || e.key === '3') {
        e.preventDefault();
        e.stopImmediatePropagation();
      } else if (e.key === 'Enter' && v.step.advance === 'gotIt') {
        e.preventDefault();
        e.stopImmediatePropagation();
        eng.gotIt();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
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
  <CoachMark {view} {rect} {obstacles} onGotIt={() => ref.engine?.gotIt()} onDismiss={() => ref.engine?.dismiss()} />
{/if}
