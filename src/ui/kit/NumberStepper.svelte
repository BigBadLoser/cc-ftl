<script lang="ts">
  import { onDestroy } from 'svelte';
  import { parseEntry, stepValue, type StepSpec } from './numberStepper';

  /** A value with - / + buttons and typed entry. Controlled: the parent owns `value` and updates it from `onChange`. */
  let { value, onChange, min = 0, max = 9999, step = 1, label = 'Amount', decTestId, incTestId, valueTestId, disabled = false }: {
    value: number; onChange: (v: number) => void; min?: number; max?: number;
    /** A fixed step, or `(value, dir) => next` for steps that grow with the value. */
    step?: StepSpec; label?: string; decTestId?: string; incTestId?: string; valueTestId?: string; disabled?: boolean;
  } = $props();

  let draft = $state<string | null>(null); // text while the field is being typed in
  let held: { cur: number; delay: ReturnType<typeof setTimeout> | null; rep: ReturnType<typeof setInterval> | null } | null = null;

  function bump(dir: 1 | -1, from: number): number {
    const next = stepValue(from, dir, step, min, max);
    if (next !== from) onChange(next);
    return next;
  }
  /** Pointer press: step once, then repeat while held (long press). Keyboard activation arrives as a click with detail 0. */
  function down(dir: 1 | -1) {
    if (disabled) return;
    stop();
    const h = { cur: bump(dir, value), delay: null as ReturnType<typeof setTimeout> | null, rep: null as ReturnType<typeof setInterval> | null };
    held = h;
    h.delay = setTimeout(() => { h.rep = setInterval(() => (h.cur = bump(dir, h.cur)), 90); }, 420);
  }
  function stop() {
    if (!held) return;
    if (held.delay) clearTimeout(held.delay);
    if (held.rep) clearInterval(held.rep);
    held = null;
  }
  function key(e: MouseEvent, dir: 1 | -1) {
    if (e.detail === 0 && !disabled) bump(dir, value);
  }
  function commit() {
    if (draft === null) return;
    const v = parseEntry(draft, value, min, max);
    draft = null;
    if (v !== value) onChange(v);
  }
  onDestroy(stop);
</script>

<span class="ns" role="group" aria-label={label}>
  <button type="button" aria-label="Less" data-testid={decTestId} disabled={disabled || value <= min} onpointerdown={() => down(-1)} onpointerup={stop} onpointerleave={stop} onpointercancel={stop} onclick={(e) => key(e, -1)}>&minus;</button>
  <input type="text" inputmode="numeric" aria-label={label} data-testid={valueTestId} {disabled} value={draft ?? String(value)}
    oninput={(e) => (draft = e.currentTarget.value)} onblur={commit}
    onkeydown={(e) => { if (e.key === 'Enter') { commit(); e.currentTarget.blur(); } else if (e.key === 'Escape') { draft = null; e.currentTarget.blur(); } else if (e.key === 'ArrowUp') { e.preventDefault(); bump(1, value); } else if (e.key === 'ArrowDown') { e.preventDefault(); bump(-1, value); } e.stopPropagation(); }} />
  <button type="button" aria-label="More" data-testid={incTestId} disabled={disabled || value >= max} onpointerdown={() => down(1)} onpointerup={stop} onpointerleave={stop} onpointercancel={stop} onclick={(e) => key(e, 1)}>+</button>
</span>

<style>
  .ns { display: inline-flex; align-items: center; gap: 4px; }
  button { touch-action: manipulation; }
  input { box-sizing: border-box; width: 3.4em; min-height: 40px; padding: 0 4px; text-align: center; background: var(--panel-2); color: var(--text); border: 1px solid var(--line); border-radius: 0; font: inherit; font-weight: 700; -webkit-user-select: text; user-select: text; }
  input:hover { border-color: var(--line-hi); }
  input:focus-visible, button:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
  input:disabled { opacity: 0.4; }
</style>
