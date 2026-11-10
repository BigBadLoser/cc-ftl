<script lang="ts">
	import * as Select from '$lib/components/ui/select/index.js';
	import { Label } from '$lib/components/ui/label/index.js';

	/** A labelled Select over `options` ({ value, label }); `none` adds a first "any" entry for the empty value. */
	let { label, value = $bindable(), options, none, onchange }: { label: string; value: string; options: { value: string; label: string }[]; none?: string; onchange?: (v: string) => void } = $props();
	const all = $derived(none ? [{ value: '', label: none }, ...options] : options);
	const shown = $derived(all.find((o) => o.value === value)?.label ?? value);
</script>

<div class="flex flex-col gap-1.5">
	<Label>{label}</Label>
	<Select.Root type="single" bind:value onValueChange={onchange}>
		<Select.Trigger class="w-full">{shown}</Select.Trigger>
		<Select.Content class="max-h-72">
			{#each all as o (o.value)}<Select.Item value={o.value} label={o.label}>{o.label}</Select.Item>{/each}
		</Select.Content>
	</Select.Root>
</div>
