import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defaultTheme } from '@sveltepress/theme-default';
import { sveltepress } from '@sveltepress/vite';
import { defineConfig } from 'vite';
import type { AtRule, Result, Root } from 'postcss';
import { fileURLToPath } from 'node:url';

// The wiki always lives beneath the playable game in the same Pages artifact.
// SvelteKit 3 reads its configuration through the SveltePress Vite plugin.
// The wiki theme styles every table and blockquote (its page-content rules and global UnoCSS rules). Game panels
// (<GamePanel>, `.game-ui`) bring the game's own look, so every such wiki rule skips anything inside one. Svelte-scoped
// rules (`.svelte-…`, the game components' own) are left alone.
const ELEMENTS = /(^|[\s>+~(])(table|thead|tbody|tfoot|tr|th|td|blockquote)(?![\w-])/;
const gameSrc = fileURLToPath(new URL('../src/', import.meta.url));
const keepThemeOffGamePanels = {
  postcssPlugin: 'keep-theme-off-game-panels',
  Once(root: Root, { result }: { result: Result }) {
    const from = result.opts.from ?? '';
    if (from.startsWith(gameSrc)) return; // the game's own styles
    // Component styles are compiled by Svelte after this, which scopes plain selectors: mark ours global there.
    const skip = /\.svelte\.vite-preprocess\.css$/.test(from) ? ':not(:global(.game-ui *))' : ':not(.game-ui *)';
    root.walkRules((rule) => {
      if (rule.selector.includes('.game-ui')) return;
      if (rule.parent?.type === 'atrule' && /keyframes/.test((rule.parent as AtRule).name)) return;
      if (!rule.selectors.some((sel) => ELEMENTS.test(sel))) return;
      rule.selectors = rule.selectors.map((sel) => {
        if (!ELEMENTS.test(sel)) return sel;
        const pseudo = sel.search(/::[\w-]+$/);
        return pseudo < 0 ? sel + skip : sel.slice(0, pseudo) + skip + sel.slice(pseudo);
      });
    });
  },
};

export default defineConfig({
  css: { postcss: { plugins: [keepThemeOffGamePanels] } },
  // One Svelte for the wiki and the game's components it embeds (the repo root has its own copy): snippets cross between them (SignalComms).
  resolve: { dedupe: ['svelte'] },
  // The game's UI kit imports bits-ui (and its Svelte helpers) from the repo root's node_modules; SSR must compile it, not load it as plain Node.
  ssr: { noExternal: ['bits-ui', 'svelte-toolbelt', 'runed'] },
  plugins: [
    sveltepress({
      siteConfig: {
        title: 'Wiki',
        description: 'Guides to ships, crew, equipment, and survival.',
      },
      theme: defaultTheme({
        logo: '/favicon.svg',
        github: 'https://github.com/BigBadLoser/cc-ftl',
        navbar: [
          { title: 'Guides', to: '/guides/first-hour/' },
          { title: 'Mechanics', to: '/mechanics/power/' },
          { title: 'Reference', to: '/reference/modules/' },
          { title: "What's new", to: '/whats-new/' },
        ],
        // Keep generated reference entries in the searchable catalog, not the sidebar.
        // The auto-sidebar grouped each index under an identical title,
        // producing "Ship modules / Ship modules" and "Items / Items".
        sidebar: {
          '/guides/': [
            { title: 'Your first hour', to: '/guides/first-hour/' },
            { title: 'Controls', to: '/guides/controls/' },
          ],
          '/mechanics/': [
            { title: 'Power and reactors', to: '/mechanics/power/' },
            { title: 'Air and door vents', to: '/mechanics/air/' },
            { title: 'Crew', to: '/mechanics/crew/' },
            { title: 'Mood, relationships and breaks', to: '/mechanics/mood/' },
            { title: 'Food and farming', to: '/mechanics/food/' },
            { title: 'Drones', to: '/mechanics/drones/' },
            { title: 'Ship combat', to: '/mechanics/combat/' },
            { title: 'Boarding and crew fights', to: '/mechanics/boarding/' },
            { title: 'Travel and encounters', to: '/mechanics/encounters/' },
            { title: 'Salvage and derelicts', to: '/mechanics/salvage/' },
            { title: 'Stations and trading', to: '/mechanics/trading/' },
            { title: 'Contraband and inspections', to: '/mechanics/inspections/' },
          ],
          '/reference/': [
            { title: 'Reference overview', to: '/reference/' },
            { title: 'Ship modules', to: '/reference/modules/' },
            { title: 'Items and resources', to: '/reference/items/' },
            { title: 'Weapons', to: '/reference/weapons/' },
            { title: 'Vehicles', to: '/reference/vehicles/' },
            { title: 'Production recipes', to: '/reference/recipes/' },
            { title: 'Factions', to: '/reference/factions/' },
            { title: 'Research', to: '/reference/research/' },
          ],
        },
        // The game's cyan accent (src/ui/theme.css --cyan; --heat-low as the deep shade) and steel near-blacks.
        themeColor: {
          primary: '#36d4ff',
          primaryDeep: '#1b8fb3',
          hover: '#8fe6ff',
          light: '#e4e9ee',
          dark: '#06080a',
          gradient: { start: '#36d4ff', end: '#8fe6ff' },
        },
      }),
      svelteKitOptions: {
        preprocess: [vitePreprocess()],
        adapter: adapter({ pages: 'dist', assets: 'dist', fallback: '404.html' }),
        paths: { base: '/cc-ftl/wiki', relative: false },
        prerender: { entries: ['*'] },
      },
    }),
  ],
});
