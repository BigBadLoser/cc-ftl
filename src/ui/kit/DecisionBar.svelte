<script lang="ts">
  import { tip } from './tip';
  import type { DecisionOption } from './types';

  /** The one decision bar of every window (comms, jump confirm, event card): up to 3 options, each option a full-width button side by side (label left, a short note right). The `primary` one has the cyan edge. Calls `onpick(id)`. */
  let { options, onpick, busy = false }: { options: DecisionOption[] /* at most 3 */; onpick: (id: string) => void; busy?: boolean } = $props();
</script>

<div class="decisions" style:grid-template-columns={`repeat(${Math.max(1, options.length)}, 1fr)`}>
  {#each options as o (o.id)}
    <button class:primary={o.primary} disabled={o.disabled || busy} use:tip={{ text: o.reason }} data-testid={o.testId ?? 'comms-decision'} data-choice={o.id} onclick={() => onpick(o.id)}>
      <span class="l">{o.label}</span>{#if o.note}<small>{o.note}</small>{/if}
    </button>
  {/each}
</div>

<style>
  .decisions { display: grid; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--line); }
  .decisions:first-child { border-top: 0; }
  button { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 9px 12px; min-height: 0; border: 1px solid var(--line-hi); border-radius: 0; background: transparent; color: var(--text); cursor: pointer; text-align: left; }
  button.primary { border-color: var(--cyan); color: var(--cyan); background: rgba(54, 212, 255, 0.08); }
  button:hover:not(:disabled) { background: rgba(255, 255, 255, 0.05); }
  button.primary:hover:not(:disabled) { background: rgba(54, 212, 255, 0.16); }
  button:disabled { opacity: 0.5; cursor: default; }
  .l { font: 700 15px var(--head-font); letter-spacing: 0.1em; text-transform: uppercase; }
  small { font-size: 12px; color: var(--dim); }
</style>
