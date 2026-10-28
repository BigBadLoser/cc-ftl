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
        title: 'CC-FTL Wiki',
        description: 'Gameplay guides, ship systems, and equipment reference for CC-FTL.',
      },
      theme: defaultTheme({
        logo: '/favicon.svg',
        github: 'https://github.com/BigBadLoser/cc-ftl',
        navbar: [
          { title: 'Guides', to: '/guides/getting-started/' },
          { title: 'Mechanics', to: '/mechanics/power/' },
          { title: 'Reference', to: '/reference/modules/' },
          { title: 'Play CC-FTL', to: 'https://bigbadloser.github.io/cc-ftl/' },
        ],
        sidebar: {
          enabled: true,
          roots: ['/guides/', '/mechanics/', '/reference/'],
        },
        themeColor: {
          primary: '#5899cd',
          primaryDeep: '#2c6699',
          hover: '#89c5ed',
          light: '#e5eaf2',
          dark: '#111825',
          gradient: { start: '#568dc6', end: '#82b1ce' },
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
