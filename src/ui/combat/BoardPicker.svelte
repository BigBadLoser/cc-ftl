<script lang="ts">
  import Icon from '../Icon.svelte';
  import { ActionButton, Chips, Dialog, KeyBadge } from '../kit';
  import { holdModal } from '../keys';
  import { keyLabel, keymap } from '../keymap';
  import type { UiApi } from '../api';
  import type { BoardPlan } from './boardPlan';
  import './steel.css';

  /**
   * The BOARD party picker (issue #205): which shuttle, which crew (the first one picked flies it) and which airlock of the enemy ship.
   * Confirm sends one `boarding.launch`; the sim walks the crew to the bay, flies the shuttle and steps the passengers out. The game keeps
   * running behind it, as it does behind the flee confirmation.
   */
  let { api, plan, enemyName, open, onClose }: { api: UiApi; plan: BoardPlan; enemyName: string; open: boolean; onClose: () => void } = $props();
  $effect(() => {
    if (open) return holdModal();
  });

  let shuttle = $state(0);
  let airlock = $state(0);
  let picked = $state<number[]>([]);
  // Fresh each time it opens: the first free shuttle and airlock, and the first able crew (up to three) in roster order.
  $effect(() => {
    if (!open) return;
    shuttle = plan.shuttles.find((s) => !s.reason)?.id ?? 0;
    airlock = plan.airlocks[0]?.id ?? 0;
    picked = plan.crew.filter((c) => !c.reason).slice(0, 3).map((c) => c.id);
  });
  const chosen = $derived(plan.shuttles.find((s) => s.id === shuttle));
  const seats = $derived(chosen?.seats ?? 0);
  const toggle = (id: number) => (picked = picked.includes(id) ? picked.filter((x) => x !== id) : picked.length < seats ? [...picked, id] : picked);
  const why = $derived(
    !chosen || chosen.reason ? 'Pick a shuttle'
      : !airlock ? 'Pick an airlock'
        : picked.length < 2 ? 'Pick a pilot and at least one boarder'
          : picked.length > seats ? 'Too many for the seats' : null,
  );
  const go = () => {
    if (why) return;
    api.dispatch({ type: 'boarding.launch', vehicle: shuttle, crew: picked, airlock });
    onClose();
  };
</script>

<Dialog {open} onOpenChange={(o) => { if (!o) onClose(); }} title="Board {enemyName}" testId="board-picker">
  <div class="body steel">
    {#if plan.shuttles.length > 1}
      <div class="sec">Shuttle</div>
      <Chips label="Shuttle" testId="board-shuttles" deselect={false} value={String(shuttle)} onChange={(v: string) => v && (shuttle = Number(v))}
        options={plan.shuttles.map((s) => ({ value: String(s.id), label: s.name, sub: s.reason ?? `${s.seats} seats`, disabled: !!s.reason, title: s.reason ?? undefined }))} />
    {:else if chosen}
      <p class="one"><Icon name="shuttle" size={16} /><b>{chosen.name}</b><span>{chosen.reason ?? `${seats} seats`}</span></p>
    {/if}

    <div class="sec">Party <span class="n" data-testid="board-seats">{picked.length}/{seats}</span><small>first picked flies</small></div>
    <ul class="crew" data-testid="board-crew">
      {#each plan.crew as c (c.id)}
        {@const at = picked.indexOf(c.id)}
        <li class:off={!!c.reason}>
          <label title={c.reason ?? ''}>
            <input type="checkbox" checked={at >= 0} disabled={!!c.reason || (at < 0 && picked.length >= seats)} onchange={() => toggle(c.id)} data-testid="board-crew-{c.id}" />
            <span class="nm">{c.name}</span><small>{c.role}</small>
            <span class="role">{at === 0 ? 'pilot' : at > 0 ? 'boarder' : c.reason ?? ''}</span>
            <span class="hp" style:--w="{Math.round(c.hp * 100)}%"><i></i></span>
          </label>
        </li>
      {/each}
    </ul>

    <div class="sec">Airlock on {enemyName}</div>
    <Chips label="Airlock" testId="board-airlocks" deselect={false} value={String(airlock)} onChange={(v: string) => v && (airlock = Number(v))}
      options={plan.airlocks.map((a) => ({ value: String(a.id), label: `Airlock ${a.x},${a.y}`, testId: `board-airlock-${a.id}` }))} />

    <div class="two">
      <button class="act" data-testid="board-cancel" onclick={onClose}>Cancel</button>
      <ActionButton tone="go" disabled={!!why} title={why ?? 'Launch the boarding party'} testid="board-go" onclick={go}>
        <Icon name="shuttle" size={18} />Launch<KeyBadge tone="dim" size="sm" padX={5}>{keyLabel($keymap, 'ui.confirm')}</KeyBadge>
      </ActionButton>
    </div>
    {#if why}<p class="why" data-testid="board-why">{why}</p>{/if}
  </div>
</Dialog>

<style>
  :global(.kit-card[data-testid='board-picker']) { background: #0b0e11; border-color: #3a424a; border-radius: 0; width: min(420px, calc(100vw - 32px)); }
  :global(.kit-card[data-testid='board-picker'] .kit-card-title) { font: 700 15px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .body { display: grid; gap: 8px; margin-top: 8px; background: transparent; }
  .sec { font: 600 11px/1 var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); margin-top: 4px; display: flex; gap: 8px; align-items: baseline; }
  .sec .n { color: var(--text); }
  .sec small { margin-left: auto; letter-spacing: 0.04em; text-transform: none; }
  .one { margin: 0; display: flex; gap: 8px; align-items: center; font-size: 14px; }
  .one span { color: var(--dim); }
  .crew { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; max-height: 220px; overflow: auto; }
  .crew li { background: #11151a; }
  .crew input { accent-color: var(--green); }
  .crew li.off { opacity: 0.45; }
  .crew label { display: grid; grid-template-columns: 18px minmax(0, 1fr) auto 64px 46px; gap: 8px; align-items: center; padding: 6px 8px; font-size: 14px; cursor: pointer; }
  .crew small { color: var(--dim); font-size: 11px; }
  .role { font: 600 11px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; color: var(--dim); text-align: right; }
  .hp { display: block; height: 6px; background: var(--track, #080a0c); }
  .hp i { display: block; height: 100%; width: var(--w); background: var(--health-good); }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px; height: 38px; }
  .act { background: #11151a; border-color: var(--cyan); font: 600 13px var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; }
  .why { margin: 0; font-size: 12px; color: var(--amber); }
</style>
