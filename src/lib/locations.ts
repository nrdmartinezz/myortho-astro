import { getCollection, type CollectionEntry } from 'astro:content';

export type Entry = CollectionEntry<'locations'>;

/** Drafts render in `dev` and disappear from production builds. */
export async function getPublished(): Promise<Entry[]> {
  const entries = await getCollection('locations', ({ data }) => {
    return import.meta.env.DEV || data.draft !== true;
  });

  return entries.sort((a, b) => a.data.name.localeCompare(b.data.name));
}

/** Same region first, then alphabetical. */
export function related(all: Entry[], current: Entry, limit = 3): Entry[] {
  return all
    .filter((entry) => entry.id !== current.id)
    .sort((a, b) => {
      const aMatch = a.data.region === current.data.region ? 1 : 0;
      const bMatch = b.data.region === current.data.region ? 1 : 0;
      return bMatch - aMatch;
    })
    .slice(0, limit);
}