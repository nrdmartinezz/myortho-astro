import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';

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
    '/uncategorized/your-childs-dental-health-journey-a-step-by-step-guide-from-myorthodontist-in-fayetteville-nc/':
      '/blog/your-childs-dental-health-journey-a-step-by-step-guide-from-myorthodontist-in-fayetteville-nc/',
    '/uncategorized/dental-sealants-a-simple-step-to-shield-your-childs-smile-from-cavities/':
      '/blog/dental-sealants-a-simple-step-to-shield-your-childs-smile-from-cavities/',
    '/uncategorized/more-than-just-sugar-how-hidden-acids-in-your-childs-diet-threaten-their-enamel/':
      '/blog/more-than-just-sugar-how-hidden-acids-in-your-childs-diet-threaten-their-enamel/',
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
