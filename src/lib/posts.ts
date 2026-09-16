/**
 * Shared query helpers for the Tooth Wisdom blog.
 * Blocks stay props-only, so pages query here and pass results down.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import type { PostItem } from '../components/blocks/PostGrid.astro';

export type Entry = CollectionEntry<'posts'>;

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' });

export function hrefFor(entry: Entry): string {
  return `/blog/${entry.id}/`;
}

/** Drafts render in `dev` and disappear from production builds. */
export async function getPublished(): Promise<Entry[]> {
  const entries = await getCollection('posts', ({ data }) => {
    return import.meta.env.DEV || data.draft !== true;
  });

  return entries.sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf());
}

export function toPostItem(entry: Entry): PostItem {
  return {
    title: entry.data.title,
    body: entry.data.description,
    href: hrefFor(entry),
    date: dateFormat.format(entry.data.publishDate),
    dateTime: entry.data.publishDate.toISOString().slice(0, 10),
    tag: entry.data.category,
    image: entry.data.heroImage,
    imageAlt: entry.data.heroImageAlt,
  };
}

export function readingTime(body: string | undefined): string {
  const words = (body ?? '').trim().split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

/** Same category first, then most recent. */
export function related(all: Entry[], current: Entry, limit = 3): Entry[] {
  return all
    .filter((entry) => entry.id !== current.id)
    .sort((a, b) => {
      const aMatch = a.data.category === current.data.category ? 1 : 0;
      const bMatch = b.data.category === current.data.category ? 1 : 0;
      return bMatch - aMatch;
    })
    .slice(0, limit);
}
