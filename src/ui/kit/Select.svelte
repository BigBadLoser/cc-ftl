<script lang="ts">
  import { Select } from 'bits-ui';
  import type { KitOption } from './types';

  /** A single-choice dropdown. Options may carry a dim sub-label and be disabled; the list opens as a dark sharp panel. */
  let { options, value, onChange, placeholder = 'Select…', label = 'Choice', testId, disabled = false }: {
    options: KitOption[]; value: string; onChange: (v: string) => void; placeholder?: string; label?: string; testId?: string; disabled?: boolean;
  } = $props();
  const current = $derived(options.find((o) => o.value === value));
</script>

<Select.Root type="single" {value} onValueChange={(v) => v !== value && onChange(v)} items={options.map((o) => ({ value: o.value, label: o.label, disabled: o.disabled }))} {disabled}>
  <Select.Trigger class="kit-sel-trigger" aria-label={label} data-testid={testId}>
    <span class="v" class:ph={!current}>{current?.label ?? placeholder}{#if current?.sub}<small>{current.sub}</small>{/if}</span>
    <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true"><path d="M0 0h10L5 6z" fill="currentColor" /></svg>
  </Select.Trigger>
  <Select.Portal>
    <Select.Content class="kit-sel-content" sideOffset={2} collisionPadding={8}>
      <Select.Viewport class="kit-sel-viewport">
        {#each options as o (o.value)}
          <Select.Item value={o.value} label={o.label} disabled={o.disabled} class="kit-sel-item" data-testid={o.testId}>
            {#snippet children({ selected })}
              <span class="t">{o.label}</span>
              {#if o.sub}<small>{o.sub}</small>{/if}
              {#if selected}<i aria-hidden="true">&#10003;</i>{/if}
            {/snippet}
          </Select.Item>
        {/each}
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
</Select.Root>

<style>
  :global(.kit-sel-trigger) { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 40px; min-width: 96px; max-width: 100%; padding: 0 10px; background: var(--panel-2); color: var(--text); border: 1px solid var(--line); border-radius: 0; font: inherit; text-align: left; cursor: pointer; }
  :global(.kit-sel-trigger:hover) { border-color: var(--line-hi); }
  :global(.kit-sel-trigger[data-state='open']) { border-color: var(--cyan); background: var(--panel-3); }
  :global(.kit-sel-trigger[data-disabled]) { opacity: 0.4; cursor: default; }
  :global(.kit-sel-trigger:focus-visible) { outline: 2px solid var(--focus); outline-offset: 1px; }
  :global(.kit-sel-trigger) .v { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  :global(.kit-sel-trigger) .ph { color: var(--dim); }
  :global(.kit-sel-trigger) small, :global(.kit-sel-item) small { margin-left: 6px; color: var(--dim); font-size: 12px; }
  :global(.kit-sel-content) { z-index: 50; box-sizing: border-box; min-width: var(--bits-select-anchor-width); max-width: calc(100vw - 16px); max-height: min(320px, var(--bits-select-content-available-height, 320px)); overflow-y: auto; background: var(--panel); border: 1px solid var(--line-hi); border-radius: 0; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6); touch-action: pan-y; }
  :global(.kit-sel-viewport) { padding: 2px; }
  :global(.kit-sel-item) { display: flex; align-items: center; gap: 4px; min-height: 40px; padding: 0 10px; color: var(--text); cursor: pointer; outline: none; }
  :global(.kit-sel-item) .t { flex: 1; min-width: 0; }
  :global(.kit-sel-item[data-highlighted]) { background: var(--panel-3); box-shadow: inset 2px 0 0 var(--cyan); }
  :global(.kit-sel-item[data-selected]) { color: #fff; }
  :global(.kit-sel-item[data-disabled]) { opacity: 0.4; cursor: default; }
  :global(.kit-sel-item) i { color: var(--cyan); font-style: normal; }
</style>
