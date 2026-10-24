<script lang="ts">
  import type { UiApi, UiModule } from './api';
  import PanelHead from './PanelHead.svelte';
  import { Segmented } from './kit';

  let { api, m, mods, onBack }: { api: UiApi; m: UiModule; mods: UiModule[]; onBack: () => void } = $props();
  /** Every power consumer of the ship in the order the power system serves them (lower number first, ties by id). */
  const order = $derived.by(() => {
    const groups = new Map<string, { key: string; prio: number; name: string; n: number; draw: number; me: boolean; dark: boolean }>();
    for (const x of mods.filter((y) => y.power < 0).sort((a, b) => a.powerPriority - b.powerPriority || a.id - b.id)) {
      const key = `${x.powerPriority}|${x.name}`;
      const g = groups.get(key) ?? { key, prio: x.powerPriority, name: x.name, n: 0, draw: 0, me: false, dark: false };
      g.n++;
      g.draw += -x.power;
      g.me ||= x.id === m.id;
      g.dark ||= !x.powered && x.enabled;
      groups.set(key, g);
    }
    return [...groups.values()];
  });
  const supply = $derived(mods.filter((x) => x.enabled && x.hp > 0 && x.power > 0).reduce((n, x) => n + x.power, 0));
</script>

<div data-testid="power-panel">
  <PanelHead icon="power" title="Power: {m.name}" sub="{-m.power} draw" {onBack} backTitle="Back to module" backTestId="power-back" />
  <p class="hint">When the ship is short of power, modules are served from number 1 up and the rest go dark. Supply now: {supply}.</p>
  <div class="row">
    <span class="lbl">Power order</span>
    <Segmented label="Power order" testId="power-order" value={String(m.powerPriority)}
      onChange={(v) => api.dispatch({ type: 'module.setPowerPriority', id: m.id, powerPriority: Number(v) })}
      options={[1, 2, 3, 4, 5].map((p) => ({ value: String(p), label: String(p), testId: `power-order-${p}` }))} />
  </div>
  <h3>Ship order</h3>
  <ol data-testid="power-list">
    {#each order as g (g.key)}
      <li class:me={g.me} class:dark={g.dark}>
        <b>{g.prio}</b><span class="nm">{g.name}{g.n > 1 ? ` ×${g.n}` : ''}</span><span class="d">{g.draw}</span>
      </li>
    {/each}
  </ol>
</div>

<style>
  .hint { margin: 6px 0; color: var(--dim); font-size: 12px; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; }
  .lbl { color: var(--dim); }
  h3 { margin: 10px 0 4px; font-size: 13px; color: var(--cyan); }
  ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 260px; overflow-y: auto; }
  li { display: grid; grid-template-columns: 22px 1fr auto; gap: 6px; padding: 2px 6px; background: var(--panel-2); border: 1px solid transparent; }
  li.me { border-color: var(--cyan); }
  li.dark { color: #ff9a9a; }
  li b { color: var(--cyan); font-weight: 600; }
  .d { color: var(--dim); }
</style>
