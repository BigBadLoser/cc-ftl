<script lang="ts">
	import Trash from '@lucide/svelte/icons/trash-2';
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { NAMES } from '../shipgen/labels';
	import Field from './Field.svelte';
	import { lab } from './lab.svelte';
	import { roomRect, setRole } from './layout';
	import { liveRoom, moduleOf } from './design';
	import type { Problem } from './problems';

	const sel = $derived(lab.selected);
	const room = $derived(sel?.kind === 'room' ? lab.design && liveRoom(lab.design, sel.id) : undefined);
	const mod = $derived(sel?.kind === 'module' ? lab.design && moduleOf(lab.design, sel.id) : undefined);
	const rect = $derived(sel?.kind === 'room' && lab.layout ? roomRect(lab.layout, sel.id) : null);
	const roles = $derived([...new Set([...Object.keys(NAMES), 'hall', ...(lab.layout?.rooms.map((r) => r.role) ?? [])])].map((r) => ({ value: r, label: NAMES[r] ?? (r === 'hall' ? 'corridor' : r) })));
	const doors = $derived.by(() => {
		const l = lab.layout;
		if (!l || sel?.kind !== 'room') return 0;
		let n = 0;
		for (let y = 0; y < l.height; y++) for (let x = 0; x < l.width; x++) {
			if (l.cells[y]?.[x] !== 'D') continue;
			if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => l.roomOf[(y + (dy as number)) * l.width + x + (dx as number)] === sel.id)) n++;
		}
		return n;
	});

	function retype(role: string) {
		if (sel?.kind === 'room') lab.edit((l) => setRole(l, sel.id, role));
	}
	function split(axis: 'h' | 'v') {
		if (sel?.kind !== 'room') return;
		const id = sel.id;
		const made = lab.splitRoomAt(id, axis);
		if (made !== null) lab.selected = { kind: 'room', id: made };
	}
	function remove() {
		lab.removeSelected();
	}
	function show(p: Problem) {
		if (p.module !== undefined) lab.selected = { kind: 'module', id: p.module };
		else lab.selected = null;
		lab.flag = p.tiles;
		const t = p.tiles[0];
		if (t) lab.view = { ...lab.view, cx: t[0], cy: t[1] };
	}
</script>

<ScrollArea class="size-full">
	<div class="flex flex-col gap-3 p-3">
		{#if room && sel?.kind === 'room'}
			<div class="flex items-center justify-between">
				<span class="text-sm font-medium">Room {sel.id}</span>
				<Button variant="ghost" size="icon-xs" aria-label="Delete room" onclick={remove}><Trash /></Button>
			</div>
			<Field label="Type" value={room.role} options={roles} onchange={retype} />
			<div class="grid grid-cols-3 gap-2 text-sm">
				<span class="text-muted-foreground">Tiles</span><span class="col-span-2">{room.tiles}</span>
				<span class="text-muted-foreground">Size</span><span class="col-span-2">{rect ? `${rect.w} x ${rect.h}${rect.filled ? '' : ' (irregular)'}` : '-'}</span>
				<span class="text-muted-foreground">Doors</span><span class="col-span-2">{doors}</span>
			</div>
			<div class="flex gap-2">
				<Button variant="outline" size="sm" disabled={!rect?.filled} onclick={() => split('h')}>Split across</Button>
				<Button variant="outline" size="sm" disabled={!rect?.filled} onclick={() => split('v')}>Split down</Button>
			</div>
		{:else if mod && sel?.kind === 'module'}
			<div class="flex items-center justify-between">
				<span class="text-sm font-medium">{mod.name}</span>
				<div class="flex gap-1">
					<Button variant="ghost" size="icon-xs" aria-label="Rotate" onclick={() => lab.rotateSelected()}><RotateCw /></Button>
					<Button variant="ghost" size="icon-xs" aria-label="Delete module" onclick={remove}><Trash /></Button>
				</div>
			</div>
			<div class="grid grid-cols-3 gap-2 text-sm">
				<span class="text-muted-foreground">Code</span><span class="col-span-2 font-mono">{mod.code || 'lamp'}</span>
				<span class="text-muted-foreground">At</span><span class="col-span-2">{mod.x}, {mod.y}</span>
				<span class="text-muted-foreground">Turn</span><span class="col-span-2">{mod.rot * 90} deg</span>
				<span class="text-muted-foreground">Size</span><span class="col-span-2">{mod.w} x {mod.h}</span>
			</div>
		{:else}
			<span class="text-sm text-muted-foreground">Select a room or a module.</span>
		{/if}

		<Separator />
		<div class="flex items-center justify-between">
			<span class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Checks</span>
			<Badge variant={lab.problems.length ? 'destructive' : 'secondary'}>{lab.problems.length ? lab.problems.length : 'all clear'}</Badge>
		</div>
		<div class="flex flex-col gap-0.5">
			{#each lab.problems.slice(0, 40) as p, i (i)}
				<button class="rounded-md px-1.5 py-1 text-left text-xs hover:bg-muted" onclick={() => show(p)}>{p.text}</button>
			{/each}
			{#if lab.problems.length > 40}<span class="text-xs text-muted-foreground">and {lab.problems.length - 40} more</span>{/if}
		</div>
	</div>
</ScrollArea>
