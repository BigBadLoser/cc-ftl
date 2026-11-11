<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import Field from './Field.svelte';
	import { lab } from './lab.svelte';
	import { SIZES, factions, familiesOf, layoutsOf, stations, starters, type Source, type SourceKind } from './source';

	let { done }: { done: () => void } = $props();
	let s = $state<Source>({ ...lab.source });
	const opt = (xs: string[], strip = ''): { value: string; label: string }[] => xs.map((v) => ({ value: v, label: v.replace(strip, '') }));
	const kinds: { value: SourceKind; label: string }[] = [
		{ value: 'blank', label: 'Blank grid' },
		{ value: 'station', label: 'Generated station' },
		{ value: 'faction', label: 'Generated ship (faction)' },
		{ value: 'starter', label: 'Starter ship template' },
	];
	const families = $derived(opt(familiesOf(s.id)));
	const layouts = $derived(opt(layoutsOf(s.id, s.size), 'station'));

	// a kind change picks that kind's first id; an id or size change drops a family or layout that no longer exists
	function setKind(k: string) {
		if (k === s.kind) return;
		s.kind = k as SourceKind;
		s.id = k === 'blank' ? '' : k === 'station' ? (stations()[0] as string) : k === 'faction' ? (factions()[0] as string) : (starters()[0] as { id: string }).id;
		s.family = '';
		s.layout = '';
	}
	$effect(() => {
		if (s.kind === 'faction' && s.family && !families.some((f) => f.value === s.family)) s.family = '';
		if (s.kind === 'station' && s.layout && !layouts.some((l) => l.value === s.layout)) s.layout = '';
	});
	const num = (e: Event, min: number): number => Math.max(min, Math.floor(Number((e.currentTarget as HTMLInputElement).value) || 0));
	let cases = $state<string[]>([]);
	let caseError = $state('');
	onMount(() => { lab.listCases().then((l) => (cases = l)).catch(() => (caseError = 'The case list needs the dev server.')); });
	async function open(slug: string) {
		try { await lab.loadCaseNamed(slug); done(); } catch (e) { caseError = e instanceof Error ? e.message : String(e); }
	}
	function go() {
		lab.import({ ...s });
		done();
	}
</script>

<div class="flex w-72 flex-col gap-3">
	<Field label="Source" value={s.kind} options={kinds} onchange={setKind} />
	{#if s.kind === 'station'}
		<Field label="Station" bind:value={s.id} options={opt(stations(), 'station.')} />
		<div class="grid grid-cols-2 gap-2">
			<Field label="Size" bind:value={s.size} options={opt([...SIZES])} />
			<Field label="Layout" bind:value={s.layout} options={layouts} none="any" />
		</div>
	{:else if s.kind === 'faction'}
		<Field label="Faction" bind:value={s.id} options={opt(factions(), 'faction.')} />
		<Field label="Hull family" bind:value={s.family} options={families} none="any" />
	{:else}
		<Field label="Template" bind:value={s.id} options={starters().map((t) => ({ value: t.id, label: t.name }))} />
	{/if}
	{#if s.kind === 'station' || s.kind === 'faction'}
		<div class="grid grid-cols-2 gap-2">
			<div class="flex flex-col gap-1.5">
				<Label for="seed">Seed</Label>
				<Input id="seed" type="number" value={s.seed} oninput={(e) => (s.seed = num(e, 0))} />
			</div>
			{#if s.kind === 'faction'}
				<div class="flex flex-col gap-1.5">
					<Label for="depth">Depth</Label>
					<Input id="depth" type="number" value={s.depth} oninput={(e) => (s.depth = num(e, 0))} />
				</div>
			{/if}
		</div>
	{/if}
	<Button onclick={go}>Import</Button>
	<Separator />
	<div class="flex flex-col gap-1.5">
		<Label>Saved cases</Label>
		<div class="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
			{#each cases as c (c)}
				<button class="rounded-md px-1.5 py-1 text-left font-mono text-xs break-all hover:bg-muted" onclick={() => open(c)}>{c}</button>
			{:else}
				<span class="text-xs text-muted-foreground">{caseError || 'None saved yet.'}</span>
			{/each}
		</div>
	</div>
</div>
