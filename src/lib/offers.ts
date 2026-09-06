import { getCollection, type CollectionEntry } from 'astro:content';

export type Entry = CollectionEntry<'offers'>;

/** The published current special, or `undefined` if it is drafted in production. */
export async function getCurrentOffer(): Promise<Entry | undefined> {
  const entries = await getCollection('offers', ({ data }) => {
    return import.meta.env.DEV || data.draft !== true;
  });

  return entries.find((entry) => entry.id === 'current') ?? entries[0];
}
