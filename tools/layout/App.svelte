<script lang="ts">
	import Import from '@lucide/svelte/icons/download';
	import Redo from '@lucide/svelte/icons/redo-2';
	import Undo from '@lucide/svelte/icons/undo-2';
	import GitCompare from '@lucide/svelte/icons/git-compare';
	import Maximize from '@lucide/svelte/icons/maximize';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { describe } from './design';
	import { docks } from './dock.svelte';
	import { ladder } from './camera';
	import { dpr, lab, type Tool } from './lab.svelte';
	import SaveCase from './SaveCase.svelte';
	import SourcePicker from './SourcePicker.svelte';
	import Workspace from './Workspace.svelte';

	let open = $state(false);
	const TOOLS: Record<string, Tool> = { v: 'select', f: 'floor', w: 'wall', d: 'door', b: 'beam', e: 'space', g: 'room', m: 'module', n: 'note' };
	/** Shortcuts: tools by letter, 0 fits the design, R turns the ghost or the selected module, Delete removes the selection, Esc drops the tool, Ctrl+Z undoes (with Shift: redoes). */
	function keys(e: KeyboardEvent) {
		if ((e.target as HTMLElement | null)?.closest('input, textarea, [role=combobox]')) return;
		const k = e.key.toLowerCase();
		if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) lab.redo(); else lab.undo(); }
		else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); lab.redo(); }
		else if (e.ctrlKey || e.metaKey || e.altKey) return;
		else if (k === 'c') lab.toggleCompare();
		else if (lab.compare && k !== 'c' && k !== '0' && k !== 'escape') return;
		else if (k === 'r') lab.rotate();
		else if (k === '0') lab.fit();
		else if (k === 'delete' || k === 'backspace') lab.removeSelected();
		else if (k === 'escape') { lab.setTool('select'); lab.armed = null; lab.ghost = null; }
		else if (TOOLS[k]) lab.setTool(TOOLS[k] as Tool);
	}
	const hint = $derived(lab.design ? describe(lab.design, lab.hover ?? lab.selected) : '');
	lab.import(lab.source);
	// A hook for scripted screenshots and agents: import by query (`?station=station.trading&size=hub&seed=3`).
	const q = new URLSearchParams(location.search);
	// A saved case by its slug (`?case=mock-furnishing`, tools/layout/cases/<slug>.json).
	// `&view=cx,cy,step`: centre the view on a tile at a zoom step (0 the furthest out), for scripted shots of one spot.
	const at = (): void => {
		const v = q.get('view')?.split(',').map(Number);
		if (!v || v.length < 3) return;
		const levels = ladder(dpr());
		lab.view = { cx: v[0] as number, cy: v[1] as number, zoom: levels[Math.min(levels.length - 1, v[2] as number)] as number };
	};
	if (q.has('case')) void lab.loadCaseNamed(q.get('case') as string).then(() => setTimeout(at, 1500));
	else if (q.has('station') || q.has('faction') || q.has('starter')) {
		const kind = q.has('station') ? 'station' : q.has('faction') ? 'faction' : 'starter';
		lab.import({ ...lab.source, kind, id: q.get(kind) as string, size: q.get('size') ?? 'station', layout: q.get('layout') ?? '', family: q.get('family') ?? '', seed: Number(q.get('seed') ?? 1), depth: Number(q.get('depth') ?? 4) });
	}
</script>

<svelte:window onkeydown={keys} />
<Tooltip.Provider delayDuration={300}>
	<div class="flex h-screen flex-col bg-background text-foreground">
		<header class="flex h-11 shrink-0 items-center gap-3 border-b bg-card px-3">
			<span class="text-sm font-semibold tracking-wide uppercase">Layout lab</span>
			<Separator orientation="vertical" class="h-5" />
			<Badge variant="secondary" class="max-w-96 truncate">{lab.design?.label ?? 'nothing imported'}</Badge>
			{#if lab.design}
				<span class="text-xs text-muted-foreground">{lab.design.width} x {lab.design.height} · {lab.design.rooms.filter((r) => r.tiles > 0).length} rooms · {lab.design.modules.length} modules</span>
				{#if lab.problems.length}<Badge variant="destructive">{lab.problems.length} {lab.problems.length === 1 ? 'problem' : 'problems'}</Badge>{/if}
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
			<SaveCase />
			<Button variant="ghost" size="icon-sm" aria-label="Undo" disabled={!lab.canUndo} onclick={() => lab.undo()}><Undo /></Button>
			<Button variant="ghost" size="icon-sm" aria-label="Redo" disabled={!lab.canRedo} onclick={() => lab.redo()}><Redo /></Button>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant={lab.compare ? 'secondary' : 'ghost'} size="icon-sm" aria-label="Compare" aria-pressed={lab.compare} onclick={() => lab.toggleCompare()}><GitCompare /></Button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content>Compare with the generated design (C)</Tooltip.Content>
			</Tooltip.Root>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant="ghost" size="icon-sm" aria-label="Fit" onclick={() => lab.fit()}><Maximize /></Button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content>Fit the design (0)</Tooltip.Content>
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
