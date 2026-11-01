<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiFtl, UiModule } from './api';
  import PanelHead from './PanelHead.svelte';
  import PowerPanel from './PowerPanel.svelte';
  import TabbedInspector from './inspector/TabbedInspector.svelte';
  import { moduleTabs, type ModuleTabProps } from './module/moduleTabs';

  /** The module inspector: the tabbed inspector with the module tabs (module/moduleTabs.ts), or the Power order sub-view. */
  let { api, onBack, onResearch }: { api: UiApi; onBack: () => void; onResearch?: () => void } = $props();
  let mods = $state<UiModule[]>([]);
  let sel = $state<number | null>(null);
  /** The Power… sub-view of the selected module; closes when another module is selected. */
  let powerOpen = $state(false);
  $effect(() => { void sel; powerOpen = false; });
  let ftl = $state<UiFtl | null>(null);
  const m = $derived(mods.find((x) => x.id === sel));
  const tabProps = $derived<ModuleTabProps | null>(m ? { api, m, ftl, onResearch, onPower: () => (powerOpen = true) } : null);

  onMount(() => {
    const a = api.modules.subscribe((v) => (mods = v));
    const b = api.selectedModule.subscribe((s) => (sel = s));
    const c = api.ftl.subscribe((v) => (ftl = v));
    return () => (a(), b(), c());
  });
</script>

{#if m && powerOpen && m.power < 0}
  <PowerPanel {api} {m} {mods} onBack={() => (powerOpen = false)} />
{:else if m && tabProps}
  <div data-testid="module-inspector">
    <TabbedInspector tabs={moduleTabs} props={tabProps}>
      {#snippet head()}<PanelHead icon="module" title={m.name} sub="{m.local.x},{m.local.y}" {onBack} />{/snippet}
    </TabbedInspector>
  </div>
{/if}
