import { getEntry, type CollectionEntry } from 'astro:content';

export type Entry = CollectionEntry<'specialOffers'>;

/** The site-wide current special. Undefined if the entry is missing. */
export async function getCurrent(): Promise<Entry | undefined> {
  return getEntry('specialOffers', 'current-special');
}
