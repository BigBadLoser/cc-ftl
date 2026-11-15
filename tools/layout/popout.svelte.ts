import { decodeLayout, encodeLayout, type LayoutJson } from './cases';
import { designFromLayout, type Target } from './design';
import { lab } from './lab.svelte';

/**
 * The preview popped out into a window of its own (a second monitor): the window is this page in `?popout` mode,
 * running its own preview, kept in step over a BroadcastChannel. The lab sends what the preview shows (the design's
 * layout, the view, the layers, the marks, the pins); the window sends back what the user does in it (pan and zoom,
 * hover, a click to select), which the lab applies as if done in its own preview pane.
 */

const CHANNEL = 'layout-lab-preview';
type Shown = Pick<typeof lab, 'view' | 'layers' | 'selected' | 'hover' | 'flag' | 'pins'>;
type ToWindow = { kind: 'design'; layout: LayoutJson | null; label: string } | { kind: 'state'; state: Shown };
type ToLab = { kind: 'hello' } | { kind: 'view'; view: typeof lab.view } | { kind: 'hover'; t: Target | null } | { kind: 'select'; t: Target | null };

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Open (or bring forward) the preview window. */
export function popOut(): void {
  window.open(`${location.pathname}?popout=1`, CHANNEL, 'width=1280,height=800')?.focus();
}

/** In the lab: serve the preview window for as long as the page lives. */
export function servePopout(): void {
  const ch = new BroadcastChannel(CHANNEL);
  const post = (m: ToWindow): void => ch.postMessage(m);
  const sendDesign = (): void => { const d = lab.previewDesign; post({ kind: 'design', layout: d ? encodeLayout(d.layout) : null, label: d?.label ?? '' }); };
  const state = (): Shown => plain({ view: lab.view, layers: lab.layers, selected: lab.selected, hover: lab.hover, flag: lab.flag, pins: lab.pins });
  ch.onmessage = (e: MessageEvent<ToLab>) => {
    const m = e.data;
    if (m.kind === 'hello') { sendDesign(); post({ kind: 'state', state: state() }); }
    else if (m.kind === 'view') { if (!same(m.view, lab.view)) lab.view = m.view; }
    else if (m.kind === 'hover') lab.setHover(lab.toEdited(m.t));
    else if (m.kind === 'select') lab.select(lab.toEdited(m.t));
  };
  $effect.root(() => {
    $effect(() => { void lab.previewDesign; sendDesign(); });
    $effect(() => { post({ kind: 'state', state: state() }); });
  });
}

/** In the window: mirror the lab, and pass the user's pan, zoom, hover and clicks back to it. */
export function joinPopout(): void {
  const ch = new BroadcastChannel(CHANNEL);
  const post = (m: ToLab): void => ch.postMessage(m);
  // What the lab last sent, so applying it is not sent back as the user's own doing.
  let echo: Shown | null = null;
  ch.onmessage = (e: MessageEvent<ToWindow>) => {
    const m = e.data;
    if (m.kind === 'design') {
      lab.design = m.layout ? designFromLayout(decodeLayout(m.layout), m.label) : null;
      document.title = `Preview: ${m.label || 'layout lab'}`;
    } else {
      echo = m.state;
      lab.view = m.state.view;
      lab.layers = m.state.layers;
      lab.selected = m.state.selected;
      lab.hover = m.state.hover;
      lab.flag = m.state.flag;
      lab.pins = m.state.pins;
    }
  };
  // The preview pane writes the view, the hover and (through select) the selection: those go to the lab instead.
  const setHover = lab.setHover.bind(lab);
  lab.select = (t) => post({ kind: 'select', t });
  lab.setHover = (t) => { if (!same(t, echo?.hover ?? null)) { setHover(t); post({ kind: 'hover', t }); } };
  $effect.root(() => {
    $effect(() => { const v = plain(lab.view); if (!same(v, echo?.view)) post({ kind: 'view', view: v }); });
  });
  post({ kind: 'hello' });
}
