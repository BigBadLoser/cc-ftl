<script lang="ts">
  import { tip } from './tip';
  import type { DecisionOption } from './types';

  /** The one decision bar of every window (comms, jump confirm, event card): up to 3 options, each option a button side by side (label left, a short note right); a lone option sits on the left at half width, where the confirm goes (wider if its label needs it), so it never stretches the full width. The `primary` one has the cyan edge. Calls `onpick(id)`. */
  let { options, onpick, busy = false }: { options: DecisionOption[] /* at most 3 */; onpick: (id: string) => void; busy?: boolean } = $props();
  /** Cancel is always the right-hand button: `cancel`-flagged options go last, the rest keep their order. */
  const ordered = $derived([...options.filter((o) => !o.cancel), ...options.filter((o) => o.cancel)]);
</script>

<div class="decisions" class:lone={options.length === 1} style:grid-template-columns={options.length === 1 ? 'minmax(50%, max-content)' : undefined}>
  {#each ordered as o (o.id)}
    <button class:primary={o.primary} disabled={o.disabled || busy} use:tip={{ text: o.reason }} data-testid={o.testId ?? 'comms-decision'} data-choice={o.id} onclick={() => onpick(o.id)}>
      <span class="l">{o.label}</span>{#if o.note}<small>{o.note}</small>{/if}
    </button>
  {/each}
</div>

<style>
  .decisions { display: grid; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--line); }
  .decisions:first-child { border-top: 0; }
  .lone { justify-content: start; }
  /* Side by side, each button as wide as its label wants; when they don't all fit they shrink together and the labels wrap, never spilling out of the window. */
  .decisions:not(.lone) { display: flex; }
  .decisions:not(.lone) > button { flex: 1 1 auto; min-width: 0; }
  button { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 9px 12px; min-height: 0; border: 1px solid var(--line-hi); border-radius: 0; background: transparent; color: var(--text); cursor: pointer; text-align: left; }
  button.primary { border-color: var(--cyan); color: var(--cyan); background: rgba(54, 212, 255, 0.08); }
  button:hover:not(:disabled) { background: rgba(255, 255, 255, 0.05); }
  button.primary:hover:not(:disabled) { background: rgba(54, 212, 255, 0.16); }
  button:disabled { opacity: 0.5; cursor: default; }
  .l { font: 700 15px var(--head-font); letter-spacing: 0.1em; text-transform: uppercase; }
  small { font-size: 12px; color: var(--dim); }
</style>
