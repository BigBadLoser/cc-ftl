<script lang="ts">
  import type { UiCrewDetail, UiBodyPart } from '../crewDetailApi';
  import Icon from '../Icon.svelte';
  import { tip } from '../kit';
  import InjuryCard from './InjuryCard.svelte';
  import OperationPicker from './OperationPicker.svelte';

  /**
   * The crew Health tab (#601; the approved round-6 mock). A summary sentence, then OVERALL and CAPACITIES on the left and the whole BODY on the right
   * (ten parts in a fixed order, each with its state; a hover card per injured part). One alert colour: red is "needs care now"; plain text is white and
   * anything fine is grey. Under the body, the surgery queue and its picker, drawn only when the crew detail API has operations (slice 2, #311).
   */
  let { d }: { d: UiCrewDetail | null } = $props();
  const h = $derived(d?.body ?? null);
  let picking = $state<string | null>(null);
  let root = $state<HTMLElement | null>(null);
  const openPicker = (part: string | null): void => void (picking = part ?? h?.parts[0]?.id ?? null);
</script>

{#snippet glyph(p: { icon: UiBodyPart['icon']; mirror: boolean })}
  <span class="gl" class:mirror={p.mirror}><Icon name={p.icon} size={13} /></span>
{/snippet}

{#if h}
  <div class="health" bind:this={root} data-testid="crew-health">
    <p class="sum" class:fine={h.summary.fine} data-testid="health-summary">{#if h.summary.alert}<span class="alert">{h.summary.alert}</span>{/if}{h.summary.alert && h.summary.text ? ' ' : ''}{h.summary.text}</p>
    <div class="cols">
      <div class="left">
        <h4>Overall</h4>
        <div class="row"><span>Health</span><span>{h.hpPct}%</span></div>
        {#if h.bleeding}<div class="row alert" data-testid="health-bleeding"><span>Bleeding</span><span>{h.bleeding}</span></div>{/if}
        <h4 class="gapped">Capacities</h4>
        {#each h.capacities as c (c.key)}
          <div class="row {c.tone}" data-testid="cap-{c.key}"><span>{c.name}</span><span>{c.pct}%</span></div>
        {/each}
      </div>
      <div class="right">
        <h4>Body</h4>
        {#each h.parts as p (p.id)}
          {#snippet rich()}{#if p.card}<InjuryCard card={p.card} part={p.name} onQueue={h.operations ? () => openPicker(p.id) : null} />{/if}{/snippet}
          <div class="row part {p.tone}" class:gap={p.gap} data-testid="part-{p.id}" use:tip={p.card ? { rich, side: 'right', focus: true } : null}>
            <span class="name">{@render glyph(p)}{p.name}</span>
            <span class="state">{p.state}{#if p.more} <small>+{p.more}</small>{/if}</span>
          </div>
        {/each}
        {#if h.operations}
          <div class="ops-head"><h4>Operations</h4><button class="small" data-testid="ops-queue" onclick={() => openPicker(null)}>+ Queue operation</button></div>
          {#each h.operations.queue as q (q.id)}
            <div class="row plain queued">
              <span class="name">{@render glyph(q)}<span class="lbl">{q.label}</span></span>
              <span class="state fine">{q.status} <button class="x" disabled={!h.operations.live} aria-label="Cancel">✕</button></span>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
  {#if h.operations && picking && root}
    <OperationPicker ops={h.operations} bind:part={picking} anchor={root} onClose={() => (picking = null)} />
  {/if}
{/if}

<style>
  .health { font-size: var(--fs-body); color: var(--text); }
  .sum { margin: -2px -10px 10px; padding: 0 10px 10px; border-bottom: 1px solid var(--line); font-size: 14px; }
  .sum.fine { color: var(--dim); }
  .alert { color: var(--red); }
  .cols { display: grid; grid-template-columns: 170px 1fr; }
  .left { padding-right: 12px; border-right: 1px solid var(--line); }
  .right { padding-left: 12px; min-width: 0; }
  h4 { margin: 0 0 4px; color: var(--dim); font: 600 var(--fs-label) var(--head-font); letter-spacing: var(--ls-label); text-transform: uppercase; }
  h4.gapped { margin-top: 14px; }
  .row { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 24px; white-space: nowrap; }
  .row.fine { color: var(--dim); }
  .row.alert, .row.alert .state { color: var(--red); }
  .row.gap { margin-top: 8px; }
  .part { cursor: default; }
  .part:hover { background: var(--panel-2); }
  .name { display: flex; align-items: center; gap: 7px; min-width: 0; }
  .gl { color: var(--dim); display: inline-flex; }
  .gl.mirror { transform: scaleX(-1); }
  .state { overflow: hidden; text-overflow: ellipsis; text-align: right; }
  .state small { color: var(--dim); font-size: var(--fs-small); }
  .state.fine { color: var(--dim); }
  .queued .name { flex: 1 1 auto; }
  .queued .state { flex: none; }
  .lbl { overflow: hidden; text-overflow: ellipsis; }
  .ops-head { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }
  .ops-head h4 { margin: 0; }
  button.small { min-height: 22px; padding: 0 8px; font-size: var(--fs-small); }
  button.x { min-height: 0; min-width: 0; padding: 0 2px; border: 0; background: none; color: var(--dim); font-size: 11px; }
</style>
