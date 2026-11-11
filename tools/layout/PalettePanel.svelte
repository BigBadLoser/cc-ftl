<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
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
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { content } from '../../src/content';
	import type { ModuleDef } from '../../src/sim';
	import { isLamp, moduleCode, NAMES } from '../shipgen/labels';
	import { docks } from './dock.svelte';
	import { roleTint } from '../shipgen/labels';
	import { lab, type Tool } from './lab.svelte';
	import { setRole } from './layout';

	const tools: { id: string; label: string; icon: Component; off?: boolean }[] = [
		{ id: 'select', label: 'Select (V)', icon: MousePointer2 },
		{ id: 'floor', label: 'Floor (F)', icon: Grid2x2 },
		{ id: 'wall', label: 'Interior wall (W)', icon: BrickWall },
		{ id: 'door', label: 'Door (D)', icon: DoorOpen },
		{ id: 'space', label: 'Erase to space (E)', icon: Eraser },
		{ id: 'room', label: 'Draw a room (G)', icon: SquareDashed },
		{ id: 'module', label: 'Place a module (M)', icon: Box },
		{ id: 'note', label: 'Pin a note (N; Alt: free)', icon: StickyNote },
	];
	const css = (c: readonly number[]): string => `rgb(${c[0]},${c[1]},${c[2]})`;
	const defs = Object.entries(content.modules as Record<string, ModuleDef>)
		.filter(([, d]) => !isLamp(d))
		.map(([id, d]) => ({ id, name: d.name, code: moduleCode(d.name) }))
		.sort((a, b) => a.name.localeCompare(b.name));
		const rooms = $derived((lab.design?.rooms ?? []).filter((r) => r.tiles > 0).reduce((m, r) => m.set(r.role, (m.get(r.role) ?? 0) + 1), new Map<string, number>()));
	const placed = $derived((lab.design?.modules ?? []).reduce((m, x) => m.set(x.def, (m.get(x.def) ?? 0) + 1), new Map<string, number>()));
	const roleTypes = $derived(allRoles());

	/** Every room type the lab knows, with its colour: the new-room type, and what a selected room can become. */
	function allRoles() {
		return [...Object.keys(NAMES), 'hall'].filter((r, i, all) => all.indexOf(r) === i).map((r) => ({ role: r, name: r === 'hall' ? 'corridor' : NAMES[r] ?? r, color: css(roleTint(r)) }));
	}
	function pickRoom(role: string) {
		lab.role = role;
		const s = lab.selected;
		if (s?.kind === 'room') lab.edit((l) => setRole(l, s.id, role));
	}
	function pickModule(def: string) {
		lab.arm(def);
	}
</script>

<ScrollArea class="size-full">
	<div class="flex flex-col gap-3 p-3">
		<div class="flex items-center justify-between">
			<span class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Paint</span>
			<Badge variant="secondary">{lab.tool}</Badge>
		</div>
		<ToggleGroup.Root type="single" value={lab.tool} onValueChange={(v) => v && lab.setTool(v as Tool)} variant="outline" size="sm" spacing={1} class="flex-wrap justify-start">
			{#each tools as t (t.id)}
				{@const Icon = t.icon}
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<ToggleGroup.Item {...props} value={t.id} aria-label={t.label} disabled={t.off}><Icon /></ToggleGroup.Item>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content>{t.label}</Tooltip.Content>
				</Tooltip.Root>
			{/each}
		</ToggleGroup.Root>

		<Separator />
		<Collapsible.Root open={docks.state.groups.modules} onOpenChange={(open) => docks.dispatch({ type: 'group', group: 'modules', open })}>
			<Collapsible.Trigger class="flex w-full items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
				{#if docks.state.groups.modules}<ChevronDown class="size-3.5" />{:else}<ChevronRight class="size-3.5" />{/if}Modules
			</Collapsible.Trigger>
			<Collapsible.Content class="pt-2">
				<Command.Root class="rounded-lg border">
					<Command.Input placeholder="Search modules" />
					<Command.List class="max-h-72">
						<Command.Empty>No module found.</Command.Empty>
						<Command.Group>
							{#each defs as d (d.id)}
								<Command.Item value="{d.name} {d.code}" data-checked={lab.armed === d.id} onSelect={() => pickModule(d.id)}>
									<span class="w-6 shrink-0 font-mono text-xs font-semibold">{d.code}</span>
									<span class="flex-1 truncate">{d.name}</span>
									<span class="text-xs text-muted-foreground">{placed.get(d.id) ?? ''}</span>
								</Command.Item>
							{/each}
						</Command.Group>
					</Command.List>
				</Command.Root>
			</Collapsible.Content>
		</Collapsible.Root>

		<Separator />
		<Collapsible.Root open={docks.state.groups.rooms} onOpenChange={(open) => docks.dispatch({ type: 'group', group: 'rooms', open })}>
			<Collapsible.Trigger class="flex w-full items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
				{#if docks.state.groups.rooms}<ChevronDown class="size-3.5" />{:else}<ChevronRight class="size-3.5" />{/if}Room types
			</Collapsible.Trigger>
			<Collapsible.Content class="pt-2">
				<div class="flex flex-col gap-0.5">
					{#each roleTypes as r (r.role)}
						<button class="flex items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-muted {lab.role === r.role ? 'bg-muted' : ''}" onclick={() => pickRoom(r.role)}>
							<span class="size-3 shrink-0 rounded-sm" style="background:{r.color}"></span>
							<span class="flex-1 truncate">{NAMES[r.role] ?? r.name}</span>
							<span class="text-xs text-muted-foreground">{rooms.get(r.role) ?? ''}</span>
						</button>
					{:else}
						<span class="text-sm text-muted-foreground">Import a design.</span>
					{/each}
				</div>
			</Collapsible.Content>
		</Collapsible.Root>
	</div>
</ScrollArea>
