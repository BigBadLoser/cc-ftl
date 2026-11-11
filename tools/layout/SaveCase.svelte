<script lang="ts">
	import Save from '@lucide/svelte/icons/save';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { lab } from './lab.svelte';

	let open = $state(false);
	let name = $state('');
	let status = $state('');
	let failed = $state(false);
	const path = $derived(lab.casePath(name));

	async function save() {
		try {
			status = `Saved ${await lab.saveCase(name)}`;
			failed = false;
		} catch (e) {
			status = e instanceof Error ? e.message : String(e);
			failed = true;
		}
	}
</script>

<Dialog.Root bind:open onOpenChange={(o) => { if (o) status = ''; }}>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" size="sm" disabled={!lab.design}><Save /> Save</Button>
		{/snippet}
	</Dialog.Trigger>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Save a feedback case</Dialog.Title>
			<Dialog.Description>The original design, your edit, the notes and the change list go into one JSON file in the repo.</Dialog.Description>
		</Dialog.Header>
		<div class="flex flex-col gap-3">
			<div class="flex flex-col gap-1.5">
				<Label for="case-name">Name</Label>
				<Input id="case-name" placeholder="wider corridors" bind:value={name} />
			</div>
			<div class="flex flex-col gap-1 text-xs text-muted-foreground">
				<span>Source: {lab.provenance ? `${lab.provenance.spec || 'blank grid'} · ${lab.provenance.generator}` : ''}</span>
				<span class="font-mono break-all">{path}</span>
				<span>{lab.pins.length} {lab.pins.length === 1 ? 'note' : 'notes'} · {lab.changes.length} {lab.changes.length === 1 ? 'change' : 'changes'}</span>
			</div>
			{#if status}<p class="text-sm {failed ? 'text-destructive' : ''}">{status}</p>{/if}
		</div>
		<Dialog.Footer>
			<Button disabled={!name.trim()} onclick={save}>Save</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
