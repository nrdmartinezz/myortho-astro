#!/usr/bin/env node
/**
 * Stamps a new Tooth Wisdom blog post with valid frontmatter.
 * Run with `npm run new:entry`.
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';

const COLLECTION = 'posts';
const DIR = join('src', 'content', COLLECTION);

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const rl = createInterface({ input: process.stdin, output: process.stdout });

const title = (await rl.question('Title: ')).trim();
if (!title) {
  console.error('A title is required.');
  process.exit(1);
}

const description = (await rl.question('Description: ')).trim();
const slug = slugify((await rl.question(`Slug (${slugify(title)}): `)) || title);
rl.close();

const file = join(DIR, `${slug}.mdx`);

try {
  await access(file);
  console.error(`${file} already exists.`);
  process.exit(1);
} catch {
  // Not existing is the expected path.
}

const frontmatter = [
  '---',
  `title: ${JSON.stringify(title)}`,
  `description: ${JSON.stringify(description)}`,
  `publishDate: ${new Date().toISOString().slice(0, 10)}`,
  'draft: true',
  'author: MyOrthodontist',
  'tags: []',
  '---',
  '',
  'Write here.',
  '',
].join('\n');

await mkdir(DIR, { recursive: true });
await writeFile(file, frontmatter, 'utf8');

console.log(`✓ ${file}`);
console.log('  draft: true — it will render in dev and stay out of production until you flip it.');
