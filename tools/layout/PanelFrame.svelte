<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Move from '@lucide/svelte/icons/move';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { growOf, TITLES, type Dock, type PanelId } from './dock';
	import { docks } from './dock.svelte';

	let { id, children, drag }: { id: PanelId; children: Snippet; drag?: (e: PointerEvent) => void } = $props();
	const p = $derived(docks.state.panels[id]);
	const places: { place: Dock | 'float'; label: string }[] = [
		{ place: 'left', label: 'Dock left' },
		{ place: 'right', label: 'Dock right' },
		{ place: 'bottom', label: 'Dock bottom' },
		{ place: 'float', label: 'Float' },
	];
</script>

<section class="flex min-h-0 min-w-0 flex-col bg-card text-card-foreground {p.collapsed ? 'flex-none' : 'flex-1'}" style={p.collapsed ? '' : `flex-grow:${growOf(docks.state, id)}`} data-panel={id}>
	<header role="presentation" class="flex h-8 shrink-0 items-center gap-1 px-1.5 {drag ? 'cursor-grab touch-none active:cursor-grabbing' : ''}" onpointerdown={drag}>
		<Button variant="ghost" size="icon-xs" aria-label={p.collapsed ? 'Expand' : 'Collapse'} onclick={() => docks.dispatch({ type: 'collapse', id })} onpointerdown={(e) => e.stopPropagation()}>
			{#if p.collapsed}<ChevronRight />{:else}<ChevronDown />{/if}
		</Button>
		<span class="flex-1 truncate text-xs font-medium tracking-wide uppercase select-none">{TITLES[id]}</span>
		<DropdownMenu.Root>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<DropdownMenu.Trigger {...props} onpointerdown={(e: PointerEvent) => e.stopPropagation()}>
							{#snippet child({ props: tp })}
								<Button {...tp} variant="ghost" size="icon-xs" aria-label="Move panel"><Move /></Button>
							{/snippet}
						</DropdownMenu.Trigger>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content>Move panel</Tooltip.Content>
			</Tooltip.Root>
			<DropdownMenu.Content align="end">
				{#each places as o (o.place)}
					<DropdownMenu.Item disabled={p.place === o.place} onclick={() => (o.place === 'float' ? docks.dispatch({ type: 'float', id }) : docks.dispatch({ type: 'dock', id, dock: o.place as Dock }))}>
						{o.label}
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</header>
	<Separator />
	{#if !p.collapsed}
		<div class="min-h-0 flex-1">{@render children()}</div>
	{/if}
</section>
