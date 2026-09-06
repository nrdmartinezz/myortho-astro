import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';

const EXCLUDED_FROM_SITEMAP = ['/thank-you/', '/styleguide/'];

// https://astro.build/config
export default defineConfig({
  site: 'https://myorthodontistnc.com',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    mdx(),
    icon(),
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        return !EXCLUDED_FROM_SITEMAP.some((excluded) => path.startsWith(excluded));
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    // Windows + a Documents/OneDrive path: watching node_modules (and friends)
    // can sit silent for tens of seconds and look like a hang. Keep the
    // predev logs on screen so startup isn't a blank wait.
    clearScreen: false,
    server: {
      watch: {
        ignored: ['**/.git/**', '**/node_modules/**', '**/dist/**', '**/.astro/**'],
      },
    },
  },
});
