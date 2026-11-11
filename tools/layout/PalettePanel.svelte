<script lang="ts">
	import Box from '@lucide/svelte/icons/box';
	import DoorOpen from '@lucide/svelte/icons/door-open';
	import Eraser from '@lucide/svelte/icons/eraser';
	import Grid2x2 from '@lucide/svelte/icons/grid-2x2';
	import MousePointer2 from '@lucide/svelte/icons/mouse-pointer-2';
	import SquareDashed from '@lucide/svelte/icons/square-dashed';
	import StickyNote from '@lucide/svelte/icons/sticky-note';
	import BrickWall from '@lucide/svelte/icons/brick-wall';
	import type { Component } from 'svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { content } from '../../src/content';
	import type { ModuleDef } from '../../src/sim';
	import { isLamp, moduleCode, NAMES } from '../shipgen/labels';
	import { keyOf } from './gridDraw';
	import { lab } from './lab.svelte';

	const tools: { id: string; label: string; icon: Component }[] = [
		{ id: 'select', label: 'Select', icon: MousePointer2 },
		{ id: 'floor', label: 'Floor', icon: Grid2x2 },
		{ id: 'wall', label: 'Wall', icon: BrickWall },
		{ id: 'door', label: 'Door', icon: DoorOpen },
		{ id: 'space', label: 'Space (erase)', icon: Eraser },
		{ id: 'room', label: 'Room', icon: SquareDashed },
		{ id: 'module', label: 'Module', icon: Box },
		{ id: 'note', label: 'Note', icon: StickyNote },
	];
	const defs = Object.entries(content.modules as Record<string, ModuleDef>)
		.filter(([, d]) => !isLamp(d))
		.map(([id, d]) => ({ id, name: d.name, code: moduleCode(d.name) }))
		.sort((a, b) => a.name.localeCompare(b.name));
	const key = $derived(lab.design ? keyOf(lab.design) : null);
	const rooms = $derived((lab.design?.rooms ?? []).reduce((m, r) => m.set(r.role, (m.get(r.role) ?? 0) + 1), new Map<string, number>()));
	const placed = $derived((lab.design?.modules ?? []).reduce((m, x) => m.set(x.def, (m.get(x.def) ?? 0) + 1), new Map<string, number>()));
	const roleTypes = $derived((key?.rooms ?? []));

	function pickRoom(role: string) {
		const r = lab.design?.rooms.find((x) => x.role === role);
		if (r) lab.select({ kind: 'room', id: r.id });
	}
	function pickModule(def: string) {
		const m = lab.design?.modules.find((x) => x.def === def);
		if (m) lab.select({ kind: 'module', index: m.index });
	}
</script>

<ScrollArea class="size-full">
	<div class="flex flex-col gap-3 p-3">
		<div class="flex items-center justify-between">
			<span class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Paint</span>
			<Badge variant="secondary">editing comes later</Badge>
		</div>
		<ToggleGroup.Root type="single" value="select" disabled variant="outline" size="sm" spacing={1} class="flex-wrap justify-start">
			{#each tools as t (t.id)}
				{@const Icon = t.icon}
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<ToggleGroup.Item {...props} value={t.id} aria-label={t.label}><Icon /></ToggleGroup.Item>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content>{t.label}</Tooltip.Content>
				</Tooltip.Root>
			{/each}
		</ToggleGroup.Root>

		<Separator />
		<span class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Room types</span>
		<div class="flex flex-col gap-0.5">
			{#each roleTypes as r (r.role)}
				<button class="flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-muted" onclick={() => pickRoom(r.role)}>
					<span class="size-3 shrink-0 rounded-sm" style="background:{r.color}"></span>
					<span class="flex-1 truncate">{NAMES[r.role] ?? r.name}</span>
					<span class="text-xs text-muted-foreground">{rooms.get(r.role) ?? ''}</span>
				</button>
			{:else}
				<span class="text-sm text-muted-foreground">Import a design.</span>
			{/each}
		</div>

		<Separator />
		<span class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Modules</span>
		<Command.Root class="rounded-lg border">
			<Command.Input placeholder="Search modules" />
			<Command.List class="max-h-72">
				<Command.Empty>No module found.</Command.Empty>
				<Command.Group>
					{#each defs as d (d.id)}
						<Command.Item value="{d.name} {d.code}" onSelect={() => pickModule(d.id)}>
							<span class="w-6 shrink-0 font-mono text-xs font-semibold">{d.code}</span>
							<span class="flex-1 truncate">{d.name}</span>
							<span class="text-xs text-muted-foreground">{placed.get(d.id) ?? ''}</span>
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</div>
</ScrollArea>
