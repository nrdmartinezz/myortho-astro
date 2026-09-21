#!/usr/bin/env node
/**
 * Pulls published Tooth Wisdom posts from the live WordPress REST API into
 * src/content/posts/*.mdx. Existing slugs are skipped unless --force.
 *
 *   node scripts/import-wp-posts.mjs
 *   node scripts/import-wp-posts.mjs --limit 5 --dry-run
 *   node scripts/import-wp-posts.mjs --force
 *
 * Writes:
 *   src/content/posts/{slug}.mdx
 *   src/images/posts/{slug}/…
 *   src/data/wp-blog-redirects.json
 *   src/data/blog-import-review.md
 */
import { access, mkdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const WP_ORIGIN = 'https://myorthodontistnc.com';
const UA = { 'User-Agent': 'MyOrthodontistNC-blog-import/1.0' };

const POSTS_DIR = join('src', 'content', 'posts');
const IMAGES_DIR = join('src', 'images', 'posts');
const REDIRECTS_FILE = join('src', 'data', 'wp-blog-redirects.json');
const REVIEW_FILE = join('src', 'data', 'blog-import-review.md');

const CATEGORIES = {
  invisalign: 'Invisalign',
  braces: 'Braces',
  adult: 'Adult Care',
  kids: 'Kids & Family',
  oral: 'Oral Health',
};

const PAGE_MAP = {
  '/about/': '/about/',
  '/about-myorthodontist/': '/about/',
  '/adult-orthodontics/': '/braces-for-adults/',
  '/braces/': '/types-of-braces/',
  '/contact/': '/contact/',
  '/contact-us/': '/contact/',
  '/contents/virtual-care/': '/virtual-care/',
  '/deals/denta/': '/special-offers/',
  '/deals/dental/': '/special-offers/',
  '/early-treatment/': '/braces-for-children/',
  '/insurance-and-financing/': '/insurance/',
  '/invisalign/': '/types-of-invisalign/',
  '/invisalign-for-adults/': '/invisalign-for-adults/',
  '/invisalign-for-teens/': '/invisalign-for-teens/',
  '/locations/': '/locations/',
  '/meet-doctors/': '/doctors/',
  '/new-patients/': '/your-first-visit/',
  '/new-patients/faqs/': '/faqs/',
  '/new-patients/insurance/': '/insurance/',
  '/new-patients/meet-doctors/': '/doctors/',
  '/new-patients/what-to-expect/': '/your-first-visit/',
  '/orthodontic-care/': '/resources/',
  '/orthodontics/braces/': '/types-of-braces/',
  '/orthodontics/invisalign/': '/types-of-invisalign/',
  '/request-consult/': 'https://forms.formlync.com/myorthodontist/register',
  '/service-page/braces/': '/types-of-braces/',
  '/spark-clear-aligners/': '/services/',
  '/special-offers/': '/special-offers/',
  '/virtual-care/': '/virtual-care/',
};

const LOCATION_MAP = {
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
};

const DOCTOR_MAP = {
  '/doctors/larry-j-moray-dds/': '/doctors/larry-j-moray/',
};

const EXT_FROM_TYPE = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const FORCE = args.has('--force');
const SKIP_IMAGES = args.has('--skip-images');
const limitArg = process.argv.find((value, i, all) => all[i - 1] === '--limit');
const LIMIT = limitArg ? Number(limitArg) : Infinity;

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
});
turndown.use(gfm);
turndown.addRule('dropEmptyParagraphs', {
  filter: (node) => node.nodeName === 'P' && !node.textContent.trim() && !node.querySelector('img'),
  replacement: () => '',
});

const review = {
  skippedExisting: [],
  written: [],
  missingHero: [],
  failedImages: [],
  leftoverShortcodes: [],
  unmappedLinks: new Map(),
  offTopic: [],
  duplicates: [],
  errors: [],
};

function decodeEntities(value) {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lsquo;|&rsquo;|&#8217;/g, "'")
    .replace(/&mdash;|&#8212;/g, '—')
    .replace(/&ndash;|&#8211;/g, '–')
    .replace(/&hellip;|&#8230;/g, '…')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .replace(/\[&hellip;\]|\[\.\.\.\]|…\s*$/g, '')
    .trim();
}

function withSlash(path) {
  const clean = path.replace(/\/{2,}/g, '/');
  if (!clean.startsWith('/')) return `/${clean}/`;
  return clean.endsWith('/') ? clean : `${clean}/`;
}

function rewritePath(pathname) {
  if (pathname === '/' || pathname === '') return '/';
  const path = withSlash(pathname.replace(/\/index\.php/i, ''));

  if (path.startsWith('/blog/')) return path;
  if (path.startsWith('/uncategorized/')) return `/blog/${path.slice('/uncategorized/'.length)}`;

  if (PAGE_MAP[path]) return PAGE_MAP[path];
  if (LOCATION_MAP[path]) return LOCATION_MAP[path];
  if (DOCTOR_MAP[path]) return DOCTOR_MAP[path];

  const locationMatch = path.match(
    /^\/(?:locations?|orthodontic-offices)\/([a-z0-9-]+?)(?:-nc)?\/$/,
  );
  if (locationMatch) return `/locations/${locationMatch[1]}/`;

  const doctorMatch = path.match(/^\/doctors\/([a-z0-9-]+?)(?:-dds|-dmd)?\/$/);
  if (doctorMatch) return `/doctors/${doctorMatch[1]}/`;

  return null;
}

function rewriteHref(href, slug) {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return href;
  }

  let url;
  try {
    url = new URL(href, WP_ORIGIN);
  } catch {
    return href;
  }

  const host = url.hostname.replace(/^www\./, '');
  if (host !== 'myorthodontistnc.com') return href;

  const mapped = rewritePath(url.pathname);
  if (mapped) {
    if (mapped.startsWith('http')) return mapped;
    return `${mapped}${url.hash}`;
  }

  const original = `${url.pathname}${url.search}${url.hash}`;
  const list = review.unmappedLinks.get(original) ?? [];
  list.push(slug);
  review.unmappedLinks.set(original, list);
  return href;
}

function assignCategory({ title, slug, tags, html }) {
  const head = `${title} ${slug} ${tags.join(' ')}`.toLowerCase();
  const body = stripTags(html).toLowerCase();

  if (/invisalign/.test(head)) return CATEGORIES.invisalign;
  if (/\bbraces?\b/.test(head)) return CATEGORIES.braces;
  if (/child|children|\bkids?\b|teen|toddler|baby|infant|pediatric|phase.?1|sealant/.test(head)) {
    return CATEGORIES.kids;
  }
  if (/\badults?\b/.test(head)) return CATEGORIES.adult;

  if (/invisalign|clear aligner/.test(body)) return CATEGORIES.invisalign;
  if (/\bbraces?\b|retainer|bracket/.test(body)) return CATEGORIES.braces;
  if (/child|children|\bkids?\b|teen|toddler|baby|infant|pediatric|phase.?1|sealant/.test(body)) {
    return CATEGORIES.kids;
  }
  if (/\badults?\b/.test(body)) return CATEGORIES.adult;
  return CATEGORIES.oral;
}

function toDescription(excerpt, html) {
  const text = stripTags(excerpt || '') || stripTags(html);
  if (text.length <= 200) return text;
  const window = text.slice(0, 200);
  const sentence = window.match(/^[\s\S]+?[.!](?:\s|$)/);
  if (sentence && sentence[0].trim().length >= 80) return sentence[0].trim();
  return `${window.replace(/\s+\S*$/, '')}…`;
}

function offTopicReasons({ title, slug }) {
  const hay = `${title} ${slug}`.toLowerCase();
  const ortho = /orthodont|braces|invisalign|aligner|retainer/.test(hay);
  const reasons = [];
  const checks = [
    [/abscess/, 'abscessed tooth / infection'],
    [/toothache|tooth pain|home remed/, 'toothache / home remedies'],
    [/tooth replacement|dental implant|denture|\bbridges?\b|partial denture/, 'tooth replacement'],
    [/\bgum disease\b|gingivitis|periodont/, 'gum / periodontal'],
    [/canker/, 'canker sores'],
    [/heart disease|diabetes|sepsis/, 'systemic / medical'],
    [/cosmetic dentistr|veneer|dental crown|amalgam|oral surgery|dentist near me|find a dentist/, 'general / cosmetic dentistry'],
    [/teeth whitening|plaque|cavity|cavities|tooth decay|chipped tooth|tooth loss|tooth enamel/, 'general dentistry'],
  ];
  for (const [pattern, label] of checks) {
    if (pattern.test(hay)) reasons.push(ortho ? `${label} (title also mentions ortho)` : label);
  }
  return reasons;
}

function titleTokens(title) {
  const stop = new Set([
    'a',
    'an',
    'the',
    'and',
    'or',
    'to',
    'for',
    'of',
    'in',
    'your',
    'you',
    'how',
    'why',
    'what',
    'with',
    'from',
    'about',
    'complete',
    'guide',
    'myorthodontist',
  ]);
  return decodeEntities(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stop.has(word));
}

function jaccard(a, b) {
  const left = new Set(a);
  const right = new Set(b);
  let inter = 0;
  for (const item of left) if (right.has(item)) inter += 1;
  const union = left.size + right.size - inter;
  return union ? inter / union : 0;
}

function findDuplicates(posts) {
  const pairs = [];
  for (let i = 0; i < posts.length; i += 1) {
    for (let j = i + 1; j < posts.length; j += 1) {
      const score = jaccard(titleTokens(posts[i].title), titleTokens(posts[j].title));
      if (score >= 0.65) {
        pairs.push({ a: posts[i], b: posts[j], score });
      }
    }
  }
  return pairs.sort((x, y) => y.score - x.score);
}

function preprocessHtml(html, slug) {
  let out = html;
  out = out.replace(/<!--[\s\S]*?-->/g, '');
  out = out.replace(/<script[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style[\s\S]*?<\/style>/gi, '');
  out = out.replace(/\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/gi, '$1');
  out = out.replace(/\[hr[^\]]*\]/gi, '');
  out = out.replace(/\[brace_painter[^\]]*\]/gi, '');
  out = out.replace(/(^|>)([^<]{2,200})<\/h([2-6])>/g, '$1<h$3>$2</h$3>');
  out = out.replace(/<span[^>]*>/gi, '').replace(/<\/span>/gi, '');
  out = out.replace(/<hr\b[^>]*>/gi, '');
  out = out.replace(/<img\b[^>]*class="[^"]*emoji[^"]*"[^>]*>/gi, (tag) => {
    const alt = tag.match(/alt=(["'])(.*?)\1/i);
    return alt?.[2] ?? '';
  });
  out = out.replace(/\s(border|cellpadding|cellspacing|width|height|align)=(["'])(.*?)\2/gi, '');

  out = out.replace(/href=(["'])(.*?)\1/gi, (_, quote, href) => {
    return `href=${quote}${rewriteHref(decodeEntities(href), slug)}${quote}`;
  });

  return out;
}

function safeFileName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function fetchJson(url, attempt = 1) {
  const res = await fetch(url, { headers: UA });
  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    return fetchJson(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return { data: await res.json(), headers: res.headers };
}

async function fetchAllPosts() {
  const first = await fetchJson(`${WP_ORIGIN}/wp-json/wp/v2/posts?per_page=100&page=1`);
  const pages = Number(first.headers.get('X-WP-TotalPages') || 1);
  const all = [...first.data];
  for (let page = 2; page <= pages; page += 1) {
    const next = await fetchJson(`${WP_ORIGIN}/wp-json/wp/v2/posts?per_page=100&page=${page}`);
    all.push(...next.data);
    process.stdout.write(`  fetched page ${page}/${pages}\n`);
  }
  return all;
}

async function fetchTags() {
  try {
    const { data } = await fetchJson(`${WP_ORIGIN}/wp-json/wp/v2/tags?per_page=100&_fields=id,name`);
    return new Map(data.map((tag) => [tag.id, decodeEntities(tag.name)]));
  } catch {
    return new Map();
  }
}

async function downloadImage(url, dest) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const type = (res.headers.get('content-type') || '').split(';')[0].trim();
  if (!type.startsWith('image/')) throw new Error(`not an image (${type}) ${url}`);
  await mkdir(dirname(dest), { recursive: true });
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  return type;
}

function extFor(url, type) {
  if (EXT_FROM_TYPE[type]) return EXT_FROM_TYPE[type];
  const fromUrl = extname(new URL(url).pathname).toLowerCase();
  return EXT_FROM_TYPE[`image/${fromUrl.slice(1)}`] || fromUrl || '.jpg';
}

async function saveFeatured(mediaId, slug) {
  if (SKIP_IMAGES || !mediaId) return null;
  const { data } = await fetchJson(
    `${WP_ORIGIN}/wp-json/wp/v2/media/${mediaId}?_fields=source_url,alt_text,mime_type`,
  );
  if (!data?.source_url) return null;
  const type = data.mime_type;
  const ext = extFor(data.source_url, type);
  const dest = join(IMAGES_DIR, slug, `hero${ext}`);
  if (!DRY_RUN) await downloadImage(data.source_url, dest);
  return {
    path: `../../images/posts/${slug}/hero${ext}`,
    alt: decodeEntities(data.alt_text || ''),
  };
}

async function localizeImages(html, slug) {
  if (SKIP_IMAGES) return html;
  const matches = [...html.matchAll(/<img\b[^>]*src=(["'])(.*?)\1[^>]*>/gi)];
  let out = html;
  let index = 1;
  for (const match of matches) {
    const src = decodeEntities(match[2]);
    let url;
    try {
      url = new URL(src, WP_ORIGIN);
    } catch {
      continue;
    }
    if (!/wp-content\/uploads/i.test(url.pathname) && url.hostname.replace(/^www\./, '') !== 'myorthodontistnc.com') {
      continue;
    }
    const base = safeFileName(url.pathname.split('/').pop() || `image-${index}`) || `image-${index}`;
    const destNoExt = join(IMAGES_DIR, slug, `${String(index).padStart(2, '0')}-${base.replace(/\.[a-z0-9]+$/i, '')}`);
    try {
      if (DRY_RUN) {
        const ext = extname(url.pathname) || '.jpg';
        const relative = `../../images/posts/${slug}/${String(index).padStart(2, '0')}-${base.replace(/\.[a-z0-9]+$/i, '')}${ext}`;
        out = out.replaceAll(match[2], relative);
      } else {
        const type = await downloadImage(url.href, `${destNoExt}.tmp`);
        const ext = extFor(url.href, type);
        const dest = `${destNoExt}${ext}`;
        const { rename } = await import('node:fs/promises');
        await rename(`${destNoExt}.tmp`, dest);
        const relative = `../../images/posts/${slug}/${dest.split('/').pop()}`;
        out = out.replaceAll(src, relative);
        out = out.replaceAll(match[2], relative);
      }
      index += 1;
    } catch (error) {
      review.failedImages.push(`${slug}: ${url.href} (${error.message})`);
    }
  }
  return out;
}

function leftoverTableToMarkdown(table) {
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
    [...row[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) =>
      stripTags(cell[1]).replace(/\|/g, '\\|'),
    ),
  );
  if (!rows.length) return stripTags(table);
  const width = Math.max(...rows.map((row) => row.length));
  const padded = rows.map((row) => {
    while (row.length < width) row.push('');
    return row;
  });
  const header = padded[0];
  const body = padded.slice(1);
  return [
    '',
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
    '',
  ].join('\n');
}

function toMarkdown(html) {
  let markdown = turndown
    .turndown(html)
    .replace(/<table\b[\s\S]*?<\/table>/gi, leftoverTableToMarkdown)
    .replace(/<img\b[^>]*>/gi, (tag) => {
      if (/class="[^"]*emoji/i.test(tag)) {
        return tag.match(/alt=(["'])(.*?)\1/i)?.[2] ?? '';
      }
      const src = tag.match(/src=(["'])(.*?)\1/i)?.[2];
      const alt = tag.match(/alt=(["'])(.*?)\1/i)?.[2] ?? '';
      return src ? `![${alt}](${src})` : '';
    })
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  return markdown;
}

function yamlValue(value) {
  return JSON.stringify(value);
}

function renderMdx({ title, description, publishDate, updatedDate, category, hero, body }) {
  const lines = [
    '---',
    `title: ${yamlValue(title)}`,
    `description: ${yamlValue(description)}`,
    `publishDate: ${publishDate}`,
  ];
  if (updatedDate && updatedDate !== publishDate) lines.push(`updatedDate: ${updatedDate}`);
  lines.push('draft: true');
  lines.push('author: MyOrthodontist');
  lines.push(`category: ${yamlValue(category)}`);
  if (hero) {
    lines.push(`heroImage: ${yamlValue(hero.path)}`);
    if (hero.alt) lines.push(`heroImageAlt: ${yamlValue(hero.alt)}`);
  }
  lines.push('---', '', body, '');
  return lines.join('\n');
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function writeReview(allPosts) {
  const lines = [
    '# Blog import review',
    '',
    'Generated by `scripts/import-wp-posts.mjs`. Draft posts stay out of production until `draft` is flipped.',
    '',
    `Imported: **${review.written.length}**. Skipped existing: **${review.skippedExisting.length}**.`,
    '',
    '## Off-topic / general dentistry',
    '',
  ];

  if (review.offTopic.length === 0) lines.push('_None flagged._', '');
  else {
    for (const item of review.offTopic) {
      lines.push(`- \`${item.slug}\` — ${item.title} — ${item.reasons.join('; ')}`);
    }
    lines.push('');
  }

  lines.push('## Near-duplicates', '');
  if (review.duplicates.length === 0) lines.push('_None flagged._', '');
  else {
    for (const pair of review.duplicates) {
      lines.push(
        `- \`${pair.a.slug}\` ↔ \`${pair.b.slug}\` (${Math.round(pair.score * 100)}% title overlap) — ${pair.a.title} / ${pair.b.title}`,
      );
    }
    lines.push('');
  }

  lines.push('## Missing hero image', '');
  if (review.missingHero.length === 0) lines.push('_None._', '');
  else {
    for (const slug of review.missingHero) lines.push(`- \`${slug}\``);
    lines.push('');
  }

  lines.push('## Failed image downloads', '');
  if (review.failedImages.length === 0) lines.push('_None._', '');
  else {
    for (const item of review.failedImages) lines.push(`- ${item}`);
    lines.push('');
  }

  lines.push('## Unmapped internal WordPress links', '');
  if (review.unmappedLinks.size === 0) lines.push('_None._', '');
  else {
    const sorted = [...review.unmappedLinks.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [href, slugs] of sorted) {
      lines.push(`- \`${href}\` (${slugs.length}) — ${[...new Set(slugs)].slice(0, 5).join(', ')}`);
    }
    lines.push('');
  }

  lines.push('## Leftover shortcodes', '');
  if (review.leftoverShortcodes.length === 0) lines.push('_None._', '');
  else {
    for (const item of review.leftoverShortcodes) lines.push(`- ${item}`);
    lines.push('');
  }

  if (review.errors.length) {
    lines.push('## Errors', '');
    for (const item of review.errors) lines.push(`- ${item}`);
    lines.push('');
  }

  lines.push('## Existing posts left untouched', '');
  if (review.skippedExisting.length === 0) lines.push('_None._', '');
  else {
    for (const slug of review.skippedExisting) lines.push(`- \`${slug}\``);
    lines.push('');
  }

  lines.push(`_Source archive: ${allPosts.length} published WordPress posts._`, '');
  return lines.join('\n');
}

const dateOnly = (iso) => iso.slice(0, 10);

async function main() {
  process.stdout.write('Fetching WordPress posts…\n');
  const [wpPosts, tagNames] = await Promise.all([fetchAllPosts(), fetchTags()]);
  const posts = wpPosts.slice(0, LIMIT);

  const catalog = wpPosts.map((post) => ({
    slug: post.slug,
    title: decodeEntities(post.title.rendered),
  }));
  review.duplicates = findDuplicates(catalog);

  const redirects = {};
  for (const post of wpPosts) {
    const path = withSlash(new URL(post.link).pathname);
    if (path.startsWith('/uncategorized/')) {
      redirects[path] = `/blog/${post.slug}/`;
    }
  }

  for (const post of posts) {
    const slug = post.slug;
    const dest = join(POSTS_DIR, `${slug}.mdx`);
    const title = decodeEntities(post.title.rendered);

    if (
      !FORCE &&
      ((await exists(dest)) || (await exists(join(POSTS_DIR, `${slug}.mdx`))))
    ) {
      review.skippedExisting.push(slug);
      process.stdout.write(`  skip ${slug}\n`);
      continue;
    }

    try {
      const tags = (post.tags || []).map((id) => tagNames.get(id)).filter(Boolean);
      const description = toDescription(post.excerpt?.rendered, post.content.rendered);
      const category = assignCategory({
        title,
        slug,
        tags,
        html: post.content.rendered,
      });
      const reasons = offTopicReasons({ title, slug, html: post.content.rendered });
      if (reasons.length) review.offTopic.push({ slug, title, reasons });

      let html = preprocessHtml(post.content.rendered, slug);
      html = await localizeImages(html, slug);
      const leftover = html.match(/\[[a-z][^\]]{0,80}\]/gi);
      if (leftover) review.leftoverShortcodes.push(`${slug}: ${leftover.slice(0, 3).join(', ')}`);

      const body = toMarkdown(html);
      let hero = null;
      try {
        hero = await saveFeatured(post.featured_media, slug);
      } catch (error) {
        review.failedImages.push(`${slug} hero: ${error.message}`);
      }
      if (!hero) review.missingHero.push(slug);

      const mdx = renderMdx({
        title,
        description,
        publishDate: dateOnly(post.date),
        updatedDate: dateOnly(post.modified),
        category,
        hero,
        body,
      });

      if (!DRY_RUN) {
        await mkdir(POSTS_DIR, { recursive: true });
        await writeFile(dest, mdx, 'utf8');
      }
      review.written.push(slug);
      process.stdout.write(`  ${DRY_RUN ? 'dry' : 'write'} ${slug}\n`);
    } catch (error) {
      review.errors.push(`${slug}: ${error.message}`);
      process.stderr.write(`  ERROR ${slug}: ${error.message}\n`);
    }
  }

  const reviewMd = writeReview(wpPosts);
  if (!DRY_RUN) {
    await mkdir(dirname(REDIRECTS_FILE), { recursive: true });
    await writeFile(REDIRECTS_FILE, `${JSON.stringify(redirects, null, 2)}\n`);
    await writeFile(REVIEW_FILE, reviewMd);
  }

  process.stdout.write(`\nWrote ${review.written.length} posts.`);
  process.stdout.write(` Skipped ${review.skippedExisting.length} existing.`);
  process.stdout.write(` Redirects: ${Object.keys(redirects).length}.`);
  process.stdout.write(` Review: ${REVIEW_FILE}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
