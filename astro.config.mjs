import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';

const blogRedirects = JSON.parse(
  readFileSync(new URL('./src/data/wp-blog-redirects.json', import.meta.url), 'utf8'),
);

const bookHref = 'https://forms.formlync.com/myorthodontist/register';

/** Old WordPress page, location, and doctor URLs. Identity paths are omitted. */
const legacyRedirects = {
  '/about-myorthodontist/': '/about/',
  '/adult-braces/': '/braces-for-adults/',
  '/adult-orthodontics/': '/braces-for-adults/',
  '/braces/': '/types-of-braces/',
  '/carriere-motion-3d/': '/carrier-motion/',
  '/charitable-giving/': '/about/foundation/',
  '/contact-us/': '/contact/',
  '/contents/virtual-care/': '/virtual-care/',
  '/deals/denta/': '/special-offers/',
  '/deals/dental/': '/special-offers/',
  '/early-treatment/': '/braces-for-children/',
  '/emergency-orthodontic-care/': '/orthodontic-emergencies/',
  '/forms/': '/patient/',
  '/free-consultation/': bookHref,
  '/insurance-and-financing/': '/insurance/',
  '/invisalign/': '/types-of-invisalign/',
  '/meet-doctors/': '/doctors/',
  '/new-patients/': '/your-first-visit/',
  '/new-patients/faqs/': '/faqs/',
  '/new-patients/insurance/': '/insurance/',
  '/new-patients/meet-doctors/': '/doctors/',
  '/new-patients/what-to-expect/': '/your-first-visit/',
  '/orthodontic-care/': '/resources/',
  '/orthodontics/braces/': '/types-of-braces/',
  '/orthodontics/invisalign/': '/types-of-invisalign/',
  '/service-page/braces/': '/types-of-braces/',
  '/spark-clear-aligners/': '/services/',
  '/teen-braces/': '/braces-for-teens/',
  '/what-to-expect/': '/your-first-visit/',
  '/location/burgaw-nc/': '/locations/burgaw/',
  '/location/chapel-hill-nc/': '/locations/chapel-hill/',
  '/location/rocky-mount-nc/': '/locations/rocky-mount/',
  '/locations/cary-nc/': '/locations/cary/',
  '/locations/chapel-hill-nc/': '/locations/chapel-hill/',
  '/locations/concord-nc/': '/locations/concord/',
  '/locations/durham-nc/': '/locations/durham/',
  '/locations/greensboro-nc/': '/locations/greensboro/',
  '/locations/mount-airy-nc/': '/locations/mount-airy/',
  '/locations/raleigh-nc/': '/locations/raleigh/',
  '/locations/roanoke-rapids/': '/locations/roanoke-rapids/',
  '/locations/sanford-nc/': '/locations/sanford/',
  '/locations/wake-forest-nc/': '/locations/wake-forest/',
  '/orthodontic-offices/chapel-hill-nc/': '/locations/chapel-hill/',
  '/orthodontic-offices/durham-nc/': '/locations/durham/',
  '/doctors/larry-j-moray-dds/': '/doctors/larry-j-moray/',
};

const EXCLUDED_FROM_SITEMAP = [
  '/thank-you/',
  '/styleguide/',
  '/request-consult/',
  '/patient-portal/',
  '/book-appointment/',
];
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
    ...legacyRedirects,
    '/request-consult/': bookHref,
    '/book-appointment/': bookHref,
    '/patient-portal/': 'https://moray.cloud9ortho.com/portal/LoginAccount/Login',
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
