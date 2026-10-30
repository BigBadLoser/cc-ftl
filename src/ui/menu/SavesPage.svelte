<script lang="ts">
  import type { UiApi, UiSaveSlot } from '../api';

  /**
   * Save: write this game to a named slot (the autosave is the game's own). Load: pick the autosave or a slot; the page reloads into it.
   * Overwriting, loading and deleting ask first, inline on the row.
   */
  let { api, mode }: { api: UiApi; mode: 'save' | 'load' } = $props();
  let slots = $derived<UiSaveSlot[]>(api.saves.list());
  const shown = $derived(mode === 'save' ? slots.filter((s) => !s.auto) : slots.filter((s) => s.meta));
  /** The row waiting for a yes, and what for. */
  let ask = $state<{ id: string; what: 'overwrite' | 'load' | 'delete' } | null>(null);
  let names = $state<Record<string, string>>({});
  let note = $state<{ text: string; bad: boolean } | null>(null);

  const slotNo = (id: string) => slots.filter((s) => !s.auto).findIndex((s) => s.id === id) + 1;
  const nameOf = (s: UiSaveSlot) => names[s.id] ?? s.meta?.name ?? `Slot ${slotNo(s.id)}`;
  const when = (ms: number) =>
    ms ? new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  function save(s: UiSaveSlot) {
    const name = nameOf(s).trim() || `Slot ${slotNo(s.id)}`;
    const ok = api.saves.save(s.id, name);
    note = ok ? { text: `Saved to “${name}”.`, bad: false } : { text: 'Saving failed: the browser refused the write (storage full or blocked).', bad: true };
    ask = null;
    slots = api.saves.list();
  }
  function remove(s: UiSaveSlot) {
    const ok = api.saves.remove(s.id);
    note = ok ? { text: 'Save deleted.', bad: false } : { text: 'Could not delete the save.', bad: true };
    ask = null;
    slots = api.saves.list();
  }
</script>

<div class="saves" data-testid="saves-{mode}">
  {#each shown as s (s.id)}
    <div class="slot" class:empty={!s.meta} data-testid="slot-{s.id}">
      <div class="info">
        {#if mode === 'save'}
          <input class="name" aria-label="Save name" value={nameOf(s)} maxlength="40" oninput={(e) => (names = { ...names, [s.id]: e.currentTarget.value })} />
        {:else}
          <b>{s.auto ? 'Autosave' : s.meta?.name}</b>
        {/if}
        <small>{#if s.meta}{[`Turn ${s.meta.turn}`, s.meta.node, when(s.meta.savedAt)].filter(Boolean).join(' · ')}{:else}Empty{/if}</small>
      </div>
      <div class="acts" class:asking={ask?.id === s.id}>
        {#if ask?.id === s.id}
          <span class="q">{ask.what === 'overwrite' ? 'Overwrite?' : ask.what === 'delete' ? 'Delete?' : 'Unsaved progress is lost. Load?'}</span>
          <button onclick={() => (ask = null)}>No</button>
          <button class="interact" data-testid="slot-yes" onclick={() => (ask?.what === 'overwrite' ? save(s) : ask?.what === 'delete' ? remove(s) : api.saves.load(s.id))}>Yes</button>
        {:else if mode === 'save'}
          <button class="interact" data-testid="slot-save" onclick={() => (s.meta ? (ask = { id: s.id, what: 'overwrite' }) : save(s))}>Save</button>
        {:else}
          {#if !s.auto}<button class="quiet" onclick={() => (ask = { id: s.id, what: 'delete' })}>Delete</button>{/if}
          <button class="interact" data-testid="slot-load" onclick={() => (ask = { id: s.id, what: 'load' })}>Load</button>
        {/if}
      </div>
    </div>
  {:else}
    <p class="none">No saves yet.</p>
  {/each}
  {#if note}<p class="note" class:bad={note.bad} role="status">{note.text}</p>{/if}
  {#if mode === 'save'}<p class="hint">The game also autosaves every 30 seconds.</p>{/if}
</div>

<style>
  .saves {
    display: grid;
    gap: var(--sp-2);
    padding: var(--sp-1) 0;
  }
  .slot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-2) var(--sp-2) var(--sp-2) var(--sp-3);
    border: 1px solid var(--line);
    background: var(--panel-2);
  }
  .info {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 2px;
  }
  .info b {
    font: 600 15px var(--head-font);
    letter-spacing: 0.04em;
  }
  small {
    color: var(--dim);
    font-size: 12px;
  }
  .empty small {
    font-style: italic;
  }
  .name {
    font: 600 15px var(--head-font);
    letter-spacing: 0.04em;
    color: var(--text);
    background: var(--track);
    border: 1px solid var(--line);
    padding: 4px 6px;
    min-width: 0;
  }
  .name:focus {
    outline: none;
    border-color: var(--cyan);
  }
  .acts {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    flex: none;
  }
  .acts button {
    min-height: 34px;
    font: 600 13px var(--head-font);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .quiet {
    background: transparent;
    border-color: transparent;
    color: var(--dim);
  }
  .acts.asking {
    flex-basis: 100%;
    justify-content: flex-end;
  }
  .q {
    font-size: 12px;
    color: var(--text);
  }
  .note {
    margin: 0;
    font-size: 13px;
    color: var(--rest);
  }
  .note.bad {
    color: var(--red);
  }
  .hint,
  .none {
    margin: 0;
    font-size: 12px;
    color: var(--dim);
  }
</style>
