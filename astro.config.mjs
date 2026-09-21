import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';

const blogRedirects = JSON.parse(
  readFileSync(new URL('./src/data/wp-blog-redirects.json', import.meta.url), 'utf8'),
);

const EXCLUDED_FROM_SITEMAP = ['/thank-you/', '/styleguide/', '/request-consult/'];
const PRODUCTION_ORIGIN = 'https://myorthodontistnc.com';

const siteUrl = (process.env.SITE_URL ?? PRODUCTION_ORIGIN).replace(/\/$/, '');
const allowIndexing =
  process.env.ALLOW_INDEXING === 'true' ||
  (process.env.ALLOW_INDEXING !== 'false' && siteUrl === PRODUCTION_ORIGIN);

// Staging builds pass ALLOW_INDEXING=false; local/production default to indexable
// when the origin is the live domain. Exposed so pages can force noindex.
process.env.PUBLIC_ALLOW_INDEXING = allowIndexing ? 'true' : 'false';

// https://astro.build/config
export default defineConfig({
  site: siteUrl,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  redirects: {
    ...blogRedirects,
    '/request-consult/': 'https://forms.formlync.com/myorthodontist/register',
  },
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
  },
});
