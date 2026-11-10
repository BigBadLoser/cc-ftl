<script lang="ts">
	import Import from '@lucide/svelte/icons/download';
	import Maximize from '@lucide/svelte/icons/maximize';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { describe } from './design';
	import { docks } from './dock.svelte';
	import { lab } from './lab.svelte';
	import SourcePicker from './SourcePicker.svelte';
	import Workspace from './Workspace.svelte';

	let open = $state(false);
	const hint = $derived(lab.design ? describe(lab.design, lab.hover ?? lab.selected) : '');
	lab.import(lab.source);
	// A hook for scripted screenshots and agents: import by query (`?station=station.trading&size=hub&seed=3`).
	const q = new URLSearchParams(location.search);
	if (q.has('station') || q.has('faction') || q.has('starter')) {
		const kind = q.has('station') ? 'station' : q.has('faction') ? 'faction' : 'starter';
		lab.import({ ...lab.source, kind, id: q.get(kind) as string, size: q.get('size') ?? 'station', layout: q.get('layout') ?? '', family: q.get('family') ?? '', seed: Number(q.get('seed') ?? 1), depth: Number(q.get('depth') ?? 4) });
	}
</script>

<Tooltip.Provider delayDuration={300}>
	<div class="flex h-screen flex-col bg-background text-foreground">
		<header class="flex h-11 shrink-0 items-center gap-3 border-b bg-card px-3">
			<span class="text-sm font-semibold tracking-wide uppercase">Layout lab</span>
			<Separator orientation="vertical" class="h-5" />
			<Badge variant="secondary" class="max-w-96 truncate">{lab.design?.label ?? 'nothing imported'}</Badge>
			{#if lab.design}
				<span class="text-xs text-muted-foreground">{lab.design.width} x {lab.design.height} · {lab.design.rooms.length} rooms · {lab.design.modules.length} modules</span>
				{#if lab.design.problems.length}<Badge variant="destructive" title={lab.design.problems.join('\n')}>{lab.design.problems.length} problems</Badge>{/if}
			{/if}
			{#if lab.error}<Badge variant="destructive" class="max-w-96 truncate">{lab.error}</Badge>{/if}
			<span class="flex-1 truncate text-center text-xs text-muted-foreground">{hint}</span>
			<Popover.Root bind:open>
				<Popover.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant="outline" size="sm"><Import /> Import</Button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content align="end" class="w-auto"><SourcePicker done={() => (open = false)} /></Popover.Content>
			</Popover.Root>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant="ghost" size="icon-sm" aria-label="Fit" onclick={() => lab.fit()}><Maximize /></Button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content>Fit the design</Tooltip.Content>
			</Tooltip.Root>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant="ghost" size="icon-sm" aria-label="Reset panels" onclick={() => docks.dispatch({ type: 'reset' })}><RotateCcw /></Button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content>Reset the panel arrangement</Tooltip.Content>
			</Tooltip.Root>
		</header>
		<main class="min-h-0 flex-1"><Workspace /></main>
	</div>
</Tooltip.Provider>
