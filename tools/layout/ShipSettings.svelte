<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import { lab } from './lab.svelte';
	import { factionList, kindOf, liverySwatch, originText, renameShip, resizeGrid, setFaction, setKind } from './ship';

	const layout = $derived(lab.layout);
	const current = $derived(layout?.origin?.gen.faction ?? '');
	const list = $derived.by(() => {
		const all = factionList();
		// a station import's origin is a station kind: shown as the current value, not a pick
		return current && !all.some((f) => f.id === current) ? [...all, { id: current, name: current.replace(/^station\./, '') }] : all;
	});
	const shown = $derived(current ? (list.find((f) => f.id === current)?.name ?? current) : 'None (player ship)');
	let w = $state(0), h = $state(0), error = $state('');
	$effect(() => { w = layout?.width ?? 0; h = layout?.height ?? 0; error = ''; });
	const swatch = (id: string): string => { const [a, b] = liverySwatch(id); return `linear-gradient(135deg, ${a} 50%, ${b} 50%)`; };

	let open = $state(false);
	let card: HTMLElement | undefined = $state();
	/** Click-away and Esc close it; a pick in the faction list (portalled out of the card) is not a click away. */
	function away(e: PointerEvent) {
		const t = e.target as HTMLElement | null;
		if (open && card && t && !card.contains(t) && !t.closest('[data-slot^=select]')) open = false;
	}
	function esc(e: KeyboardEvent) { if (open && e.key === 'Escape') { open = false; e.stopPropagation(); } }

	function resize() {
		if (!layout) return;
		const r = resizeGrid(layout, Number(w), Number(h));
		if ('error' in r) { error = r.error; return; }
		error = '';
		lab.edit(() => r.layout);
	}
</script>

<svelte:window onpointerdown={away} onkeydown={esc} />
<!-- The title is the card's header: closed, plain text in place; open, the same text sits at the same spot and the card grows round it. -->
<div bind:this={card} class="pointer-events-auto relative {open ? '-mt-1.5 -ml-2.5 w-80 rounded-lg border bg-popover px-2.5 py-1.5 text-popover-foreground shadow-sm' : ''}">
	<button class="flex items-center gap-1 text-xs tracking-wide text-muted-foreground uppercase hover:text-foreground" aria-label="Ship settings" aria-expanded={open} onclick={() => (open = !open)}>
		Grid{lab.design ? ` · ${lab.design.label}` : ''}<ChevronDown class="size-3 transition-transform {open ? 'rotate-180' : ''}" />
	</button>
	{#if open && layout}
		<div class="mt-2.5 flex flex-col gap-3 pb-1.5">
			<div class="grid grid-cols-[4.5rem_1fr] items-center gap-x-3 gap-y-2.5">
				<Label for="ship-name">Name</Label>
				<Input id="ship-name" value={layout.name} onchange={(e) => { const v = e.currentTarget.value; lab.edit((l) => renameShip(l, v)); }} />
				<Label>Faction</Label>
				<Select.Root type="single" value={current} onValueChange={(v) => lab.edit((l) => setFaction(l, v || null))}>
					<Select.Trigger class="w-full">
						{#if current}<span class="size-3 shrink-0 rounded-sm" style="background:{swatch(current)}"></span>{/if}{shown}
					</Select.Trigger>
					<Select.Content class="max-h-72">
						<Select.Item value="" label="None (player ship)">None (player ship)</Select.Item>
						{#each list as f (f.id)}
							<Select.Item value={f.id} label={f.name}><span class="size-3 shrink-0 rounded-sm" style="background:{swatch(f.id)}"></span>{f.name}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<Label>Kind</Label>
				<ToggleGroup.Root type="single" value={kindOf(layout)} onValueChange={(v) => v && lab.edit((l) => setKind(l, v as 'ship' | 'station'))} variant="outline" size="sm" class="w-full">
					{#each ['ship', 'station'] as k (k)}
						<ToggleGroup.Item value={k} class="flex-1 capitalize text-muted-foreground hover:bg-muted/40 hover:text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground">{k}</ToggleGroup.Item>
					{/each}
				</ToggleGroup.Root>
				<Label>Grid</Label>
				<div class="flex items-center gap-1.5">
					<Input type="number" bind:value={w} class="w-16" aria-label="Width" />
					<span class="text-muted-foreground">×</span>
					<Input type="number" bind:value={h} class="w-16" aria-label="Height" />
					<Button variant="outline" size="sm" onclick={resize}>Resize</Button>
				</div>
			</div>
			{#if error}<span class="text-xs text-destructive">{error}</span>{/if}
			{#if originText(layout)}<span class="text-xs text-muted-foreground">Imported from {originText(layout)}</span>{/if}
		</div>
	{/if}
</div>
