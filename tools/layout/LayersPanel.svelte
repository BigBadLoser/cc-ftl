<script lang="ts">
	import { Label } from '$lib/components/ui/label/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { keyOf, LAYER_LABELS, type Layers } from './gridDraw';
	import { lab } from './lab.svelte';

	const key = $derived(lab.design ? keyOf(lab.design) : null);
	const names = Object.keys(LAYER_LABELS) as (keyof Layers)[];
</script>

<ScrollArea class="size-full">
	<div class="flex flex-col gap-3 p-3">
		<span class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Layers</span>
		{#each names as n (n)}
			<div class="flex items-center justify-between">
				<Label for="layer-{n}">{LAYER_LABELS[n]}</Label>
				<Switch id="layer-{n}" size="sm" checked={lab.layers[n]} onCheckedChange={(v) => (lab.layers[n] = v)} />
			</div>
		{/each}
		<Separator />
		<span class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Key</span>
		{#if key}
			<div class="flex flex-col gap-1">
				{#each key.rooms as r (r.role)}
					<div class="flex items-center gap-2 text-sm">
						<span class="size-3 shrink-0 rounded-sm" style="background:{r.color}"></span>{r.name}
					</div>
				{/each}
			</div>
			<Separator />
			<div class="flex flex-col gap-1">
				{#each key.codes as c (c.code)}
					<div class="flex items-center gap-2 text-sm"><span class="w-6 font-mono text-xs font-semibold">{c.code}</span>{c.name}</div>
				{/each}
				{#if key.lamps}<div class="flex items-center gap-2 text-sm"><span class="w-6 text-center text-yellow-300">•</span>lamp</div>{/if}
			</div>
		{/if}
	</div>
</ScrollArea>
