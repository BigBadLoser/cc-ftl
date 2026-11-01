import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defaultTheme } from '@sveltepress/theme-default';
import { sveltepress } from '@sveltepress/vite';
import { defineConfig } from 'vite';

// The wiki always lives beneath the playable game in the same Pages artifact.
// SvelteKit 3 reads its configuration through the SveltePress Vite plugin.
export default defineConfig({
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
