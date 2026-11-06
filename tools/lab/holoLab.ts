/**
 * The station hologram panel (`?panel=holo`, #332 step 3): the four `starmap.holo.<kind>` sprites neutral at 1x and 3x, with
 * their anchors, then as the station panel shows them (cyan filter and scanlines on the sensor screen's dark background),
 * each beside its 48 px starmap icon and the scaled-up icon the panel draws today.
 *   &src=/.cache/holo-preview/   where to read holo.png + holo.json when the manifest has no `starmap.holo.*` yet
 *                                (written by tools/blender/review/holo_preview.py)
 * The filter is a copy of `i.holo` in src/ui/StationSensors.svelte until the sprites are wired and it moves to shared code.
 */
const KINDS = ['station_trade', 'station_military', 'station_research', 'den'] as const;
const HOLO_FILTER = 'grayscale(1) brightness(1.5) sepia(1) hue-rotate(150deg) saturate(3) opacity(0.9)';
const SCREEN_BG = '#04080b';

interface Frame { x: number; y: number; w: number; h: number; points?: Record<string, [number, number]> }
interface Sheet { src: string; w: number; h: number; frames: Record<string, Frame> }

async function image(src: string): Promise<HTMLImageElement> {
  const im = new Image();
  im.src = src;
  await im.decode();
  return im;
}

/** Every sheet's frames from the game manifest, plus the preview sheet's (its frames win when the manifest has none). */
async function sheets(preview: string): Promise<(id: string) => { sheet: Sheet; f: Frame } | undefined> {
  const base = `${import.meta.env.BASE_URL}assets/1x/`;
  const m = await (await fetch(`${base}manifest.json`)).json() as {
    sheets: Record<string, { image: string }>;
    assets: Record<string, { sheet: string; frame: Frame; points?: Record<string, [number, number]> }>;
  };
  const bySheet = new Map<string, Sheet>();
  const out = new Map<string, { sheet: Sheet; f: Frame }>();
  for (const [id, a] of Object.entries(m.assets)) {
    if (!id.startsWith('starmap.struct.') && !id.startsWith('starmap.holo.')) continue;
    let s = bySheet.get(a.sheet);
    if (!s) {
      const im = await image(`${base}${m.sheets[a.sheet]?.image ?? ""}`);
      s = { src: im.src, w: im.naturalWidth, h: im.naturalHeight, frames: {} };
      bySheet.set(a.sheet, s);
    }
    out.set(id, { sheet: s, f: { ...a.frame, points: a.points } });
  }
  if (!KINDS.every((k) => out.has(`starmap.holo.${k}`))) {
    try {
      const j = await (await fetch(`${preview}holo.json`)).json() as { frames: Record<string, Frame> };
      const im = await image(`${preview}holo.png?t=${Date.now()}`);
      const s: Sheet = { src: im.src, w: im.naturalWidth, h: im.naturalHeight, frames: j.frames };
      for (const [id, f] of Object.entries(j.frames)) out.set(id, { sheet: s, f });
    } catch { /* no preview: those cells say so */ }
  }
  return (id) => out.get(id);
}

/** A frame as an element `k` times its pixels (pixelated). */
function sprite(get: Awaited<ReturnType<typeof sheets>>, id: string, k: number, filter = ''): HTMLElement {
  const e = document.createElement('i');
  const r = get(id);
  if (!r) {
    e.textContent = `no ${id}`;
    return e;
  }
  const { sheet, f } = r;
  e.style.cssText = `display:block;position:relative;width:${f.w * k}px;height:${f.h * k}px;image-rendering:pixelated;`
    + `background:url(${sheet.src}) -${f.x * k}px -${f.y * k}px / ${sheet.w * k}px ${sheet.h * k}px no-repeat;${filter ? `filter:${filter};` : ''}`;
  return e;
}

function cell(label: string, ...kids: HTMLElement[]): HTMLElement {
  const c = document.createElement('div');
  c.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
  const l = document.createElement('div');
  l.innerHTML = `<b style="color:#e6eef6">${label}</b>`;
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;gap:10px;align-items:center;';
  body.append(...kids);
  c.append(l, body);
  return c;
}

function row(title: string, ...cells: HTMLElement[]): HTMLElement {
  const r = document.createElement('section');
  r.style.cssText = 'margin:0 12px 18px;';
  r.innerHTML = `<div style="color:#8fa3b8;margin-bottom:6px">${title}</div>`;
  const g = document.createElement('div');
  g.style.cssText = 'display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end;';
  g.append(...cells);
  r.append(g);
  return r;
}

/** The sensor screen's look: dark background, the sprite through the filter, scanlines over it. */
function screen(...kids: HTMLElement[]): HTMLElement {
  const s = document.createElement('div');
  s.style.cssText = `position:relative;display:flex;gap:14px;align-items:center;padding:14px;background:${SCREEN_BG};`;
  s.append(...kids);
  const scan = document.createElement('i');
  scan.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,0,0,0.3) 3px 4px);';
  s.append(scan);
  return s;
}

/** The anchors on a sprite drawn k times: a dot and its name. */
function anchored(get: Awaited<ReturnType<typeof sheets>>, id: string, k: number): HTMLElement {
  const e = sprite(get, id, k);
  for (const [name, [x, y]] of Object.entries(get(id)?.f.points ?? {})) {
    const d = document.createElement('i');
    d.style.cssText = `position:absolute;left:${x * k - 3}px;top:${y * k - 3}px;width:6px;height:6px;border-radius:50%;background:#ff5a4a;`;
    const t = document.createElement('span');
    t.textContent = name;
    t.style.cssText = `position:absolute;left:${x * k + 5}px;top:${y * k - 7}px;font-size:10px;color:#ffb0a8;text-shadow:0 0 2px #000,0 0 2px #000;`;
    e.append(d, t);
  }
  return e;
}

export async function mountHoloLab(target: HTMLElement, params: URLSearchParams): Promise<void> {
  const get = await sheets(params.get('src') ?? '/.cache/holo-preview/');
  const id = (k: string) => `starmap.holo.${k}`;
  const icon = (k: string) => `starmap.struct.${k}`;
  const neutral = '#2a2f37';
  const on = (bg: string, ...kids: HTMLElement[]) => {
    const w = document.createElement('div');
    w.style.cssText = `display:flex;gap:10px;align-items:center;padding:8px;background:${bg};`;
    w.append(...kids);
    return w;
  };
  target.style.paddingTop = '12px';
  target.append(
    row('Neutral, 1x (128 x 96, the size the sensor screen draws)', ...KINDS.map((k) => cell(k, on(neutral, sprite(get, id(k), 1))))),
    row('Neutral, 3x nearest-neighbour', ...KINDS.map((k) => cell(k, on(neutral, sprite(get, id(k), 3))))),
    row('Through the panel\'s filter and scanlines: the 48 px starmap icon, today\'s panel (the icon scaled to 128), the hologram',
      ...KINDS.map((k) => cell(k, screen(sprite(get, icon(k), 1, HOLO_FILTER), sprite(get, icon(k), 128 / 48, HOLO_FILTER),
        sprite(get, id(k), 1, HOLO_FILTER))))),
    row('Through the filter, 3x', ...KINDS.map((k) => cell(k, screen(sprite(get, id(k), 3, HOLO_FILTER))))),
    row('Starmap icon (48 px, neutral) beside the hologram with its anchors (3x)',
      ...KINDS.map((k) => cell(k, on(neutral, sprite(get, icon(k), 2), anchored(get, id(k), 3))))),
  );
}
