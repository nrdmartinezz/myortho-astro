import type { APIRoute } from 'astro';

import { allowIndexing, site } from '../config/site';

export const GET: APIRoute = () => {
  const body = allowIndexing
    ? [
        'User-agent: *',
        'Allow: /',
        '',
        'Disallow: /thank-you/',
        'Disallow: /styleguide/',
        '',
        `Sitemap: ${site.url}/sitemap-index.xml`,
        '',
      ].join('\n')
    : ['User-agent: *', 'Disallow: /', ''].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
