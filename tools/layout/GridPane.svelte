<script lang="ts">
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { onWheel } from './attach';
	import { panned, scaleOf, toTile, zoomed, type Box } from './camera';
	import { sameTarget, targetAt, tilesOf } from './design';
	import { diffMarks, drawMoves } from './diffDraw';
	import { drawGrid, type Mark } from './gridDraw';
	import { dpr, lab } from './lab.svelte';
	import ShipSettings from './ShipSettings.svelte';
	import PinMarkers from './PinMarkers.svelte';
	import { moduleIndex, moveModule, PAINT_CHAR, resizeRoom, roomRect, stroke, type Layout, type PaintTool, type Rect, type StrokeTool, type Tile } from './layout';

	type Edge = 'n' | 's' | 'e' | 'w';
	type Mode =
		| { k: 'pan'; x: number; y: number }
		| { k: 'paint'; last: Tile; tool: StrokeTool; erase: boolean; base: Layout; tiles: Tile[]; room: number | undefined }
		| { k: 'room'; a: Tile }
		| { k: 'edge'; id: number; edge: Edge; base: Layout; rect: Rect }
		| { k: 'move'; id: number; grab: Tile; x: number; y: number; moved: boolean };

	let canvas: HTMLCanvasElement;
	let box = $state<Box>({ w: 800, h: 500 });
	let mode: Mode | null = null;
	/** In Side by side each grid gets half the pane; every pointer position is read against one half. */
	const side = $derived(lab.compare && lab.tab === 'side');
	const paneBox = $derived<Box>(side ? { w: box.w / 2, h: box.h } : box);
	$effect(() => { lab.gridBox = paneBox; });
	let cursor = $state('crosshair');
	let space = $state(false);
	/** The tile under the pointer (null when it is off the grid or a gesture other than a stroke is under way), and whether the right button is held. */
	let pointer = $state.raw<Tile | null>(null);
	let erasing = $state(false);

	const marks = $derived.by((): Mark[] => {
		const d = lab.design;
		if (!d) return [];
		if (lab.compare) return [...(lab.tab === 'overlay' && lab.diff ? diffMarks(d, lab.diff) : []), { tiles: lab.flag, color: 'rgba(255,70,70,1)' }];
		// the hovered-room overlay is for picking: it stays out of the way of a paint tool
		const out: Mark[] = [
			{ tiles: tilesOf(d, lab.selected), color: 'rgba(255,196,64,1)' },
			...(lab.tool === 'select' ? [{ tiles: tilesOf(d, lab.hover), color: 'rgba(80,220,255,1)' }] : []),
			{ tiles: lab.flag, color: 'rgba(255,70,70,1)' },
		];
		// the tile the active tool will affect under the pointer (a room drag shows its rectangle instead; a module its ghost)
		if (pointer && lab.tool !== 'select' && lab.tool !== 'module' && lab.tool !== 'note' && !lab.drag) out.push({ tiles: [pointer], color: erasing ? 'rgba(255,90,90,1)' : 'rgba(255,255,255,1)', fill: false });
		if (lab.ghost) out.push({ tiles: lab.ghostTiles(), color: lab.ghost.error ? 'rgba(255,70,70,1)' : 'rgba(90,255,120,1)' });
		const r = lab.drag;
		if (r) {
			const t: Tile[] = [];
			for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) t.push([x, y]);
			out.push({ tiles: t, color: r.ok ? 'rgba(80,220,255,1)' : 'rgba(255,70,70,1)' });
		}
		return out;
	});

	$effect(() => {
		const d = lab.design;
		const r = dpr();
		canvas.width = Math.max(1, Math.round(box.w * r));
		canvas.height = Math.max(1, Math.round(box.h * r));
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.setTransform(r, 0, 0, r, 0, 0);
		if (!d) { ctx.clearRect(0, 0, box.w, box.h); return; }
		if (side && lab.originalDesign) {
			// two grids, one camera: the original on the left, the edited design on the right
			const half = paneBox.w;
			ctx.save();
			ctx.beginPath();
			ctx.rect(0, 0, half, box.h);
			ctx.clip();
			drawGrid(ctx, lab.originalDesign, lab.view, r, paneBox, lab.layers, []);
			ctx.restore();
			ctx.save();
			ctx.translate(half, 0);
			ctx.beginPath();
			ctx.rect(0, 0, half, box.h);
			ctx.clip();
			drawGrid(ctx, d, lab.view, r, paneBox, lab.layers, marks);
			ctx.restore();
			ctx.fillStyle = 'rgba(255,255,255,0.25)';
			ctx.fillRect(half - 0.5, 0, 1, box.h);
			return;
		}
		const shown = lab.compare && lab.tab === 'generated' && lab.originalDesign ? lab.originalDesign : d;
		drawGrid(ctx, shown, lab.view, r, box, lab.layers, marks);
		if (lab.compare && lab.tab === 'overlay' && lab.diff) drawMoves(ctx, lab.diff, lab.view, r, box);
	});

	const observe = (el: HTMLElement) => {
		const ro = new ResizeObserver(() => {
			const first = !lab.sized;
			lab.sized = true;
			box = { w: el.clientWidth, h: el.clientHeight };
			lab.gridBox = box;
			if (first) lab.fit();
		});
		ro.observe(el);
		return () => ro.disconnect();
	};

	const local = (e: MouseEvent): { x: number; y: number } => {
		const r = canvas.getBoundingClientRect();
		const x = e.clientX - r.left;
		return { x: side && x >= paneBox.w ? x - paneBox.w : x, y: e.clientY - r.top };
	};
	/** The tile under the pointer (and its exact position in tile units). */
	function at(e: MouseEvent): { tile: Tile; fx: number; fy: number } {
		const p = local(e);
		const t = toTile('grid', lab.view, dpr(), paneBox, p.x, p.y);
		return { tile: [Math.round(t.x), Math.round(t.y)], fx: t.x, fy: t.y };
	}
	const pick = (tile: Tile) => (lab.design ? targetAt(lab.design, tile[0], tile[1]) : null);

	/** The edge of the selected rectangular room under the pointer, if any. */
	function edgeAt(fx: number, fy: number): { id: number; edge: Edge; rect: Rect } | null {
		const l = lab.layout, s = lab.selected;
		if (lab.tool !== 'select' || !l || s?.kind !== 'room') return null;
		const r = roomRect(l, s.id);
		if (!r?.filled) return null;
		const tol = Math.max(0.3, 6 / scaleOf(lab.view.zoom, dpr()));
		const x0 = r.x - 0.5, x1 = r.x + r.w - 0.5, y0 = r.y - 0.5, y1 = r.y + r.h - 0.5;
		const inX = fx > x0 - tol && fx < x1 + tol, inY = fy > y0 - tol && fy < y1 + tol;
		if (inY && Math.abs(fx - x0) < tol) return { id: s.id, edge: 'w', rect: r };
		if (inY && Math.abs(fx - x1) < tol) return { id: s.id, edge: 'e', rect: r };
		if (inX && Math.abs(fy - y0) < tol) return { id: s.id, edge: 'n', rect: r };
		if (inX && Math.abs(fy - y1) < tol) return { id: s.id, edge: 's', rect: r };
		return null;
	}
	function resized(r: Rect, edge: Edge, [tx, ty]: Tile): Rect {
		if (edge === 'w') { const x = Math.min(tx, r.x + r.w - 1); return { ...r, x, w: r.x + r.w - x }; }
		if (edge === 'e') return { ...r, w: Math.max(1, tx - r.x + 1) };
		if (edge === 'n') { const y = Math.min(ty, r.y + r.h - 1); return { ...r, y, h: r.y + r.h - y }; }
		return { ...r, h: Math.max(1, ty - r.y + 1) };
	}
	function line(a: Tile, b: Tile): Tile[] {
		const out: Tile[] = [];
		const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
		for (let i = 0; i <= n; i++) out.push([Math.round(a[0] + ((b[0] - a[0]) * i) / n), Math.round(a[1] + ((b[1] - a[1]) * i) / n)]);
		return out;
	}
	const isPaint = (t: string): t is PaintTool => t in PAINT_CHAR;
	const room = (): number | undefined => (lab.selected?.kind === 'room' ? lab.selected.id : undefined);

	function down(e: PointerEvent) {
		canvas.setPointerCapture(e.pointerId);
		const { tile, fx, fy } = at(e);
		const l = lab.layout;
		const tool = lab.tool;
		// the right button erases what the active tool paints (a note: the one under the pointer); the select tool pans with it
		const erase = e.button === 2 && tool !== 'select';
		if ((e.button !== 0 && !erase) || space || !l || lab.compare) { mode = { k: 'pan', x: e.clientX, y: e.clientY }; return; }
		erasing = erase;
		if (erase && tool === 'note') { lab.erasePinAt(fx, fy); return; }
		if (isPaint(tool) || (erase && (tool === 'room' || tool === 'module'))) {
			lab.begin();
			// A stroke is applied from the layout it began on, with every tile so far (not tile by tile on the last result): the hull it frees is judged once.
			const first = room();
			lab.step(() => stroke(l, tool as StrokeTool, erase, [tile], first));
			mode = { k: 'paint', last: tile, tool: tool as StrokeTool, erase, base: l, tiles: [tile], room: first };
		} else if (tool === 'note') {
			// a note goes where the pointer is (Alt: free, not attached to what is there)
			lab.addPin(fx, fy, e.altKey);
		} else if (tool === 'room') {
			mode = { k: 'room', a: tile };
			lab.drag = { x: tile[0], y: tile[1], w: 1, h: 1, ok: false };
		} else if (tool === 'module') {
			const g = lab.ghost;
			if (g && !g.error) lab.placeModule(g.def, g.x, g.y, g.rot);
		} else {
			const edge = edgeAt(fx, fy);
			if (edge) { lab.begin(); mode = { k: 'edge', id: edge.id, edge: edge.edge, base: l, rect: edge.rect }; return; }
			const t = pick(tile);
			const choose = (): void => { if (!sameTarget(lab.selected, t)) lab.select(t); };
			const m = t?.kind === 'module' ? l.modules[moduleIndex(l, t.id)] : undefined;
			if (t?.kind === 'module' && m) mode = { k: 'move', id: t.id, grab: [tile[0] - m.x, tile[1] - m.y], x: m.x, y: m.y, moved: false };
			else mode = { k: 'pan', x: e.clientX, y: e.clientY };
			choose();
		}
	}
	function move(e: PointerEvent) {
		const { tile, fx, fy } = at(e);
		const m = mode;
		pointer = !lab.compare && (!m || m.k === 'paint') ? tile : null;
		if (m?.k === 'pan') {
			lab.view = panned('grid', lab.view, dpr(), e.clientX - m.x, e.clientY - m.y);
			m.x = e.clientX;
			m.y = e.clientY;
			return;
		}
		if (m?.k === 'paint') {
			const tiles = line(m.last, tile);
			m.last = tile;
			m.tiles.push(...tiles);
			lab.step(() => stroke(m.base, m.tool, m.erase, m.tiles, m.room));
			return;
		}
		if (m?.k === 'room') {
			const x = Math.min(m.a[0], tile[0]), y = Math.min(m.a[1], tile[1]);
			const w = Math.abs(tile[0] - m.a[0]) + 1, h = Math.abs(tile[1] - m.a[1]) + 1;
			lab.drag = { x, y, w, h, ok: w >= 2 && h >= 2 };
			return;
		}
		if (m?.k === 'edge') {
			const next = resized(m.rect, m.edge, tile);
			lab.step(() => resizeRoom(m.base, m.id, next));
			return;
		}
		if (m?.k === 'move') {
			const cur = lab.layout?.modules[moduleIndex(lab.layout, m.id)];
			if (!cur) return;
			const x = tile[0] - m.grab[0], y = tile[1] - m.grab[1];
			if (!m.moved && x === cur.x && y === cur.y) return;
			m.moved = true;
			m.x = x;
			m.y = y;
			lab.moving = m.id;
			lab.rot = lab.ghost?.rot ?? cur.rot;
			lab.aim(cur.def, x, y, lab.rot);
			return;
		}
		if (lab.compare) return;
		// no gesture: hover, the ghost, the cursor
		if (lab.tool === 'module') lab.aim(lab.armed, tile[0], tile[1]);
		lab.setHover(pick(tile));
		cursor = lab.tool !== 'select' ? 'crosshair' : edgeAt(fx, fy)?.edge === 'e' || edgeAt(fx, fy)?.edge === 'w' ? 'ew-resize' : edgeAt(fx, fy) ? 'ns-resize' : 'default';
	}
	function up() {
		const m = mode;
		mode = null;
		erasing = false;
		if (m?.k === 'paint' || m?.k === 'edge') lab.end();
		else if (m?.k === 'room') {
			const r = lab.drag;
			lab.drag = null;
			const l = lab.layout;
			if (r?.ok && l) {
				const id = lab.drawRoom(r, lab.role);
				if (id !== null) lab.select({ kind: 'room', id });
			}
		} else if (m?.k === 'move') {
			const g = lab.ghost;
			if (m.moved && g && !g.error) lab.edit((cur) => { const i = moduleIndex(cur, m.id); return i >= 0 ? moveModule(cur, i, g.x, g.y, g.rot) : cur; });
			lab.ghost = null;
			lab.moving = null;
		}
	}
	function cancel() {
		pointer = null;
		erasing = false;
		if (mode?.k === 'paint' || mode?.k === 'edge') lab.end();
		mode = null;
		lab.drag = null;
		lab.ghost = null;
		lab.moving = null;
		lab.setHover(null);
	}
	function wheel(e: WheelEvent) {
		e.preventDefault();
		const p = local(e);
		lab.view = zoomed('grid', lab.view, dpr(), paneBox, p.x, p.y, -e.deltaY);
	}
	const keys = (e: KeyboardEvent) => { if (e.code === 'Space') space = e.type === 'keydown'; };
</script>

<svelte:window onkeydown={keys} onkeyup={keys} />
<div class="relative size-full bg-background" {@attach observe}>
	<canvas
		bind:this={canvas}
		class="block size-full touch-none"
		style="width:{box.w}px;height:{box.h}px;cursor:{space ? 'grab' : cursor}"
		{@attach onWheel(wheel)}
		oncontextmenu={(e) => e.preventDefault()}
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointerleave={cancel}
	></canvas>
	{#if lab.compare}
		<div class="absolute top-2 left-1/2 -translate-x-1/2">
			<Tabs.Root value={lab.tab} onValueChange={(v) => (lab.tab = v as typeof lab.tab)}>
				<Tabs.List>
					<Tabs.Trigger value="generated">Generated</Tabs.Trigger>
					<Tabs.Trigger value="edited">Edited</Tabs.Trigger>
					<Tabs.Trigger value="overlay">Overlay</Tabs.Trigger>
					<Tabs.Trigger value="side">Side by side</Tabs.Trigger>
				</Tabs.List>
			</Tabs.Root>
		</div>
		{#if side}
			<div class="pointer-events-none absolute top-12 left-3 text-xs tracking-wide text-muted-foreground uppercase">Generated</div>
			<div class="pointer-events-none absolute top-12 text-xs tracking-wide text-muted-foreground uppercase" style="left:{paneBox.w + 12}px">Edited</div>
		{/if}
	{/if}
	<div class="pointer-events-none absolute inset-y-0" style="left:{side ? paneBox.w : 0}px;width:{paneBox.w}px"><PinMarkers space="grid" box={paneBox} /></div>
	<div class="absolute top-2 left-3"><ShipSettings /></div>
</div>
