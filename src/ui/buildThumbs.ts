import type { UiApi, UiThumb } from './api';

/** Cache of module thumbnails. Sheets load lazily, so wanted thumbs are retried until the renderer has them; `onChange` fires when new ones arrive. */
export function createThumbs(api: UiApi, onChange: () => void) {
  const have = new Map<string, UiThumb>();
  const wanted = new Set<string>();
  const tryAll = () => {
    let got = false;
    for (const k of wanted) {
      if (have.has(k)) continue;
      const [def, rot] = k.split('|') as [string, string];
      const t = api.moduleThumb(def, Number(rot));
      if (t) { have.set(k, t); got = true; }
    }
    if (got) onChange();
  };
  return {
    /** The thumb now, or undefined while it loads. Asking registers it for retry. */
    get(def: string, rot = 0): UiThumb | undefined {
      const k = `${def}|${rot}`;
      wanted.add(k);
      return have.get(k);
    },
    start() {
      const timer = setInterval(tryAll, 250);
      setTimeout(tryAll, 0);
      return () => clearInterval(timer);
    },
  };
}
