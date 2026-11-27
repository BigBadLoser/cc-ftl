<script lang="ts">
  import type { UiApi, UiCrew } from '../api';
  import type { UiCrewDetail, UiBodyPart, UiOperationOption } from '../crewDetailApi';
  import Icon from '../Icon.svelte';
  import { tip } from '../kit';
  import InjuryCard from './InjuryCard.svelte';
  import OperationPicker from './OperationPicker.svelte';
  import PartActionCard from './PartActionCard.svelte';

  /**
   * The crew Health tab (#601; the approved round-6 mock). OVERALL and CAPACITIES on the left and the whole BODY on the right
   * (ten parts in a fixed order, each with its state; a hover card per injured part). One alert colour: red is "needs care now"; plain text is white and
   * anything fine is grey; a fitted implant is cyan (the one place cyan is used). Under the body, the surgery queue (✕ takes one off) and its picker (#311).
   */
  let { api, c, d }: { api: UiApi; c: UiCrew; d: UiCrewDetail | null } = $props();
  const h = $derived(d?.body ?? null);
  let picking = $state<string | null>(null);
  let root = $state<HTMLElement | null>(null);
  const ACTION_ICON = { fit: 'replace', repair: 'repair', amputate: 'amputate' } as const;
  let pickKind = $state<UiOperationOption['kind'] | null>(null);
  /** The card beside a row's action button: the part, its operation and where it sits. */
  let card = $state<{ part: string; kind: UiOperationOption['kind']; left: number; top: number } | null>(null);
  const cardPart = $derived(card ? (h?.parts.find((p) => p.id === card!.part) ?? null) : null);
  const openPicker = (part: string | null, kind: UiOperationOption['kind'] | null = null): void => {
    pickKind = kind;
    picking = part ?? h?.parts[0]?.id ?? null;
    card = null;
  };
  function openCard(e: MouseEvent, p: UiBodyPart): void {
    if (p.action?.kind === 'heals') return;
    const inspector = (e.currentTarget as HTMLElement).closest('[data-testid="crew-inspector"]') ?? root;
    card = card?.part === p.id ? null : { part: p.id, kind: p.action!.kind, left: (inspector?.getBoundingClientRect().right ?? 0) + 8, top: (e.currentTarget as HTMLElement).getBoundingClientRect().top - 6 };
  }
</script>

{#snippet glyph(p: { icon: UiBodyPart['icon']; mirror: boolean })}
  <span class="gl" class:mirror={p.mirror}><Icon name={p.icon} size={13} /></span>
{/snippet}

{#if h}
  <div class="health" bind:this={root} data-testid="crew-health">
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
          {#snippet rich()}{#if p.card}<InjuryCard card={p.card} part={p.name} onQueue={null} />{/if}{/snippet}
          <div class="row part {p.tone}" class:gap={p.gap} data-testid="part-{p.id}">
            <div class="info" use:tip={p.card ? { rich, side: 'right', focus: true } : null}>
            <span class="name">{@render glyph(p)}{p.name}</span>
            <span class="state">{#if p.implant}<span class="cyber" data-testid="implant-{p.id}">{p.implant}</span>{#if p.state}, {/if}{/if}{p.state}{#if p.more} <small>+{p.more}</small>{/if}</span>
            </div>
            <span class="slot">
              {#if p.action?.kind === 'heals'}<span class="heals" data-testid="heals-{p.id}" use:tip={{ text: 'Heals on its own' }}><Icon name="heals" size={13} /></span>
              {:else if p.action}<button class="act interact" data-part-action data-testid="act-{p.id}" aria-label={p.action.label} use:tip={{ text: `${p.action.label} ${p.name.toLowerCase()}` }} onclick={(e) => openCard(e, p)}><Icon name={ACTION_ICON[p.action.kind]} size={13} /></button>{/if}
            </span>
          </div>
        {/each}
        {#if h.operations}
          <div class="ops-head"><h4>Operations</h4><button class="link" data-testid="ops-queue" onclick={() => openPicker(null)}>Other operation…</button></div>
          {#each h.operations.queue as q (q.id)}
            <div class="row plain queued">
              <span class="name">{@render glyph(q)}<span class="lbl">{q.label}</span></span>
              <span class="state fine">{q.status} <button class="x" disabled={!h.operations.live} aria-label="Cancel" data-testid="op-cancel-{q.id}" onclick={() => api.dispatch({ type: 'crew.cancelOperation', id: c.id, op: q.id })}>✕</button></span>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
  {#if h.operations && card && cardPart}
    <PartActionCard part={cardPart} kind={card.kind} ops={h.operations} left={card.left} top={card.top} onClose={() => (card = null)}
      onQueue={(item) => { api.dispatch({ type: 'crew.queueOperation', id: c.id, kind: card!.kind, part: card!.part, ...(item ? { item } : {}) }); card = null; }}
      onOther={() => openPicker(card!.part, card!.kind)} />
  {/if}
  {#if h.operations && picking && root}
    <OperationPicker ops={h.operations} bind:part={picking} kind={pickKind} anchor={root} onClose={() => (picking = null)}
      onQueue={(kind, part, item) => { api.dispatch({ type: 'crew.queueOperation', id: c.id, kind, part, ...(item ? { item } : {}) }); picking = null; }} />
  {/if}
{/if}

<style>
  .health { font-size: var(--fs-body); color: var(--text); }
  .cols { display: grid; grid-template-columns: 170px 1fr; }
  .left { padding-right: 12px; border-right: 1px solid var(--line); }
  .right { padding-left: 12px; min-width: 0; }
  h4 { margin: 0 0 4px; color: var(--dim); font: 600 var(--fs-label) var(--head-font); letter-spacing: var(--ls-label); text-transform: uppercase; }
  h4.gapped { margin-top: 14px; }
  .row { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 24px; white-space: nowrap; }
  .row.fine { color: var(--dim); }
  /* Red marks only what needs care now: the Bleeding row and an injury's state. A part's name stays white (grey when fine). */
  .row.alert:not(.part), .part.alert .state { color: var(--red); }
  .row.gap { margin-top: 8px; }
  .part { cursor: default; }
  .part:hover { background: var(--panel-2); }
  .name { display: flex; align-items: center; gap: 7px; min-width: 0; }
  .gl { color: var(--dim); display: inline-flex; }
  .gl.mirror { transform: scaleX(-1); }
  .part .state { flex: 1; }
  .state { overflow: hidden; text-overflow: ellipsis; text-align: right; }
  .state small { color: var(--dim); font-size: var(--fs-small); }
  .state.fine { color: var(--dim); }
  .cyber { color: var(--cyan); }
  .queued .name { flex: 1 1 auto; }
  .queued .state { flex: none; }
  .lbl { overflow: hidden; text-overflow: ellipsis; }
  .ops-head { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }
  .ops-head h4 { margin: 0; }
  .info { flex: 1; min-width: 0; display: flex; justify-content: space-between; align-items: center; gap: 8px; align-self: stretch; }
  .slot { flex: none; display: inline-flex; justify-content: center; width: 22px; }
  .heals { display: inline-flex; color: var(--dim); opacity: 0.6; }
  button.act { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; min-width: 0; min-height: 0; padding: 0; color: var(--cyan); }
  button.link { min-height: 0; min-width: 0; padding: 0; border: 0; background: none; color: var(--cyan); font-size: var(--fs-small); }
  button.x { min-height: 0; min-width: 0; padding: 0 2px; border: 0; background: none; color: var(--dim); font-size: 11px; }
</style>
