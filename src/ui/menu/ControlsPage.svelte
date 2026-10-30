<script lang="ts">
  import { onDestroy } from 'svelte';
  import { KeyBadge } from '../kit';
  import { ACTION_BY_ID, ACTIONS, chordLabel, chordOf, KEY_GROUPS, keymap, SLOTS, type ActionId, type KeyGroup } from '../keymap';

  /**
   * Rebind keys: click a slot, press a key. Esc cancels, Delete or Backspace clears the slot. A key another action already uses asks
   * whether to swap (that action gets this slot's old key) or cancel. Reset per group or everything.
   */
  let { onCapture }: { onCapture: (on: boolean) => void } = $props();

  let listening = $state<{ id: ActionId; slot: number } | null>(null);
  let clash = $state<{ id: ActionId; slot: number; chord: string; with: ActionId[] } | null>(null);

  const labelOf = (id: string) => ACTION_BY_ID.get(id)?.label ?? id;
  const groups = KEY_GROUPS.map((g) => ({ ...g, actions: ACTIONS.filter((a) => a.group === g.id) }));

  function listen(id: ActionId, slot: number) {
    clash = null;
    listening = { id, slot };
    onCapture(true);
    window.addEventListener('keydown', onKey, true);
  }
  function stop() {
    listening = null;
    onCapture(false);
    window.removeEventListener('keydown', onKey, true);
  }
  function onKey(e: KeyboardEvent) {
    const l = listening;
    if (!l) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.code === 'Escape') return stop();
    if (e.code === 'Backspace' || e.code === 'Delete') {
      keymap.bind(l.id, l.slot, null);
      return stop();
    }
    const chord = chordOf(e);
    if (!chord) return; // a lone Shift: wait for the key
    if (chord === 'Escape' || chord === 'Shift+Escape') return stop();
    const others = keymap.conflicts(l.id, chord);
    if (others.length) clash = { ...l, chord, with: others };
    else keymap.bind(l.id, l.slot, chord);
    stop();
  }
  function swap() {
    if (clash) keymap.bind(clash.id, clash.slot, clash.chord, true);
    clash = null;
  }
  const reset = (g?: KeyGroup) => {
    clash = null;
    keymap.reset(g);
  };
  onDestroy(stop);
</script>

<div class="controls" data-testid="controls">
  <p class="hint">Click a key to change it, then press the new key. <KeyBadge tone="dim" size="sm">Esc</KeyBadge> cancels, <KeyBadge tone="dim" size="sm">Del</KeyBadge> clears.</p>
  {#each groups as g (g.id)}
    <section>
      <header>
        <h4>{g.label}</h4>
        <button class="reset" data-testid="keys-reset-{g.id}" onclick={() => reset(g.id)}>Reset</button>
      </header>
      {#each g.actions as a (a.id)}
        <div class="row" class:clashing={clash?.id === a.id} data-testid="key-{a.id}">
          <span class="label">{a.label}</span>
          <span class="slots">
            {#each Array.from({ length: SLOTS }, (_, i) => i) as i (i)}
              {@const chord = $keymap[a.id]?.[i]}
              {@const on = listening?.id === a.id && listening.slot === i}
              <button
                class="slot"
                class:on
                class:unset={!chord}
                disabled={a.fixed || (!chord && i > ($keymap[a.id]?.length ?? 0))}
                title={a.fixed ? 'Esc always opens and closes the menu' : 'Click, then press a key'}
                onclick={() => listen(a.id, i)}
              >
                {#if on}<span class="wait">Press a key…</span>{:else if chord}<KeyBadge tone="light" size="sm">{chordLabel(chord)}</KeyBadge>{:else}<span class="dash">—</span>{/if}
              </button>
            {/each}
          </span>
        </div>
        {#if clash?.id === a.id}
          <div class="clash" role="alert" data-testid="key-clash">
            <span><KeyBadge tone="light" size="sm">{chordLabel(clash.chord)}</KeyBadge> is already <b>{clash.with.map(labelOf).join(', ')}</b>.</span>
            <button onclick={() => (clash = null)}>Cancel</button>
            <button class="interact" data-testid="key-swap" onclick={swap}>Swap</button>
          </div>
        {/if}
      {/each}
    </section>
  {/each}
  <footer><button class="interact" data-testid="keys-reset-all" onclick={() => reset()}>Reset all to defaults</button></footer>
</div>

<style>
  .controls {
    display: grid;
    gap: var(--sp-3);
    padding: var(--sp-1) 0;
  }
  .hint {
    margin: 0;
    font-size: 13px;
    color: var(--dim);
  }
  section {
    display: grid;
    gap: 2px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--line);
    padding-bottom: 2px;
    margin-bottom: 2px;
  }
  h4 {
    margin: 0;
    font: 600 13px var(--head-font);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--dim);
  }
  .reset {
    min-height: 0;
    height: 22px;
    padding: 0 8px;
    font: 600 11px var(--head-font);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--dim);
    background: transparent;
    border-color: transparent;
  }
  .reset:hover {
    color: var(--text);
    border-color: var(--line-hi);
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: 30px;
  }
  .row.clashing .label {
    color: var(--text);
  }
  .label {
    flex: 1;
    font-size: 14px;
    color: var(--rest);
  }
  .slots {
    display: flex;
    gap: var(--sp-1);
  }
  .slot {
    width: 104px;
    min-height: 0;
    height: 28px;
    padding: 0 4px;
    display: inline-grid;
    place-items: center;
    background: var(--panel-2);
    border: 1px solid var(--line);
  }
  .slot:hover:not(:disabled) {
    border-color: var(--cyan);
  }
  .slot.on {
    border-color: var(--cyan);
    background: var(--panel-3);
  }
  .slot:disabled {
    opacity: 0.55;
  }
  .wait {
    font: 600 12px var(--head-font);
    letter-spacing: 0.04em;
    color: var(--cyan);
  }
  .dash {
    color: var(--dim);
  }
  .clash {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 6px var(--sp-2);
    margin: 2px 0 4px;
    border: 1px solid var(--hud-bar, var(--line-hi));
    background: var(--panel-2);
    font-size: 13px;
  }
  .clash span {
    flex: 1;
  }
  .clash button {
    min-height: 28px;
    font: 600 12px var(--head-font);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  footer button {
    min-height: 32px;
    font: 600 13px var(--head-font);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  footer {
    display: flex;
    justify-content: flex-end;
  }
</style>
