<script lang="ts">
	import Eye from '@lucide/svelte/icons/eye';
	import InspectIcon from '@lucide/svelte/icons/scan-search';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import type { Component } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { dockOpen, floating, panelsIn, TITLES, type Dock, type PanelId } from './dock';
	import { docks } from './dock.svelte';
	import FloatWindow from './FloatWindow.svelte';
	import GridPane from './GridPane.svelte';
	import InspectorPanel from './InspectorPanel.svelte';
	import LayersPanel from './LayersPanel.svelte';
	import PalettePanel from './PalettePanel.svelte';
	import PanelFrame from './PanelFrame.svelte';
	import PreviewPane from './PreviewPane.svelte';

	const icons: Record<PanelId, Component> = { palette: PaletteIcon, layers: LayersIcon, inspector: InspectIcon, preview: Eye };
	const s = $derived(docks.state);
	const left = $derived(dockOpen(s, 'left'));
	const right = $derived(dockOpen(s, 'right'));
	const bottom = $derived(dockOpen(s, 'bottom'));
	/** A closed dock (all its panels collapsed) leaves a rail of buttons that bring them back. */
	const rail = (d: Dock): PanelId[] => (dockOpen(s, d) ? [] : panelsIn(s, d));
	let area = $state({ w: 800, h: 500 });

	function size(dock: Dock) {
		return (pct: number) => {
			if (Math.abs(pct - docks.state.sizes[dock]) > 0.2) docks.dispatch({ type: 'size', dock, size: pct });
		};
	}
	const measure = (el: HTMLElement) => {
		const ro = new ResizeObserver(() => (area = { w: el.clientWidth, h: el.clientHeight }));
		ro.observe(el);
		return () => ro.disconnect();
	};
</script>

{#snippet body(id: PanelId)}
	{#if id === 'palette'}<PalettePanel />{:else if id === 'layers'}<LayersPanel />{:else if id === 'inspector'}<InspectorPanel />{:else}<PreviewPane />{/if}
{/snippet}

{#snippet railButtons(d: Dock)}
	{#each rail(d) as id (id)}
		{@const Icon = icons[id]}
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="ghost" size="icon" aria-label="Show {TITLES[id]}" onclick={() => docks.dispatch({ type: 'collapse', id, collapsed: false })}><Icon /></Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content side={d === 'left' ? 'right' : d === 'right' ? 'left' : 'top'}>{TITLES[id]}</Tooltip.Content>
		</Tooltip.Root>
	{/each}
{/snippet}

{#snippet stack(d: Dock)}
	<div class="flex size-full min-h-0 min-w-0 {d === 'bottom' ? 'flex-row' : 'flex-col'} divide-border {d === 'bottom' ? 'divide-x' : 'divide-y'}">
		{#each panelsIn(s, d) as id (id)}
			<PanelFrame {id}>{@render body(id)}</PanelFrame>
		{/each}
	</div>
{/snippet}

<div class="flex size-full min-h-0">
	{#if rail('left').length}<div class="flex w-10 shrink-0 flex-col items-center gap-1 border-r bg-card py-1">{@render railButtons('left')}</div>{/if}
	<div class="min-w-0 flex-1">
		{#key `${left}${right}`}
			<Resizable.PaneGroup direction="horizontal">
				{#if left}
					<Resizable.Pane id="left" order={1} defaultSize={s.sizes.left} minSize={10} maxSize={45} onResize={size('left')}>{@render stack('left')}</Resizable.Pane>
					<Resizable.Handle />
				{/if}
				<Resizable.Pane id="middle" order={2} minSize={30}>
					<div class="flex size-full flex-col">
						<div class="min-h-0 flex-1">
							{#key bottom}
								<Resizable.PaneGroup direction="vertical">
									<Resizable.Pane id="grid" order={1} minSize={25}>
										<div class="relative size-full overflow-hidden" {@attach measure}>
											<GridPane />
											{#each floating(s) as id (id)}
												<FloatWindow {id} bounds={area}>{@render body(id)}</FloatWindow>
											{/each}
										</div>
									</Resizable.Pane>
									{#if bottom}
										<Resizable.Handle />
										<Resizable.Pane id="bottom" order={2} defaultSize={s.sizes.bottom} minSize={12} maxSize={60} onResize={size('bottom')}>{@render stack('bottom')}</Resizable.Pane>
									{/if}
								</Resizable.PaneGroup>
							{/key}
						</div>
						{#if rail('bottom').length}<div class="flex h-10 shrink-0 items-center gap-1 border-t bg-card px-1">{@render railButtons('bottom')}</div>{/if}
					</div>
				</Resizable.Pane>
				{#if right}
					<Resizable.Handle />
					<Resizable.Pane id="right" order={3} defaultSize={s.sizes.right} minSize={10} maxSize={45} onResize={size('right')}>{@render stack('right')}</Resizable.Pane>
				{/if}
			</Resizable.PaneGroup>
		{/key}
	</div>
	{#if rail('right').length}<div class="flex w-10 shrink-0 flex-col items-center gap-1 border-l bg-card py-1">{@render railButtons('right')}</div>{/if}
</div>
