import { getCollection, type CollectionEntry } from 'astro:content';
import type { Entry as LocationEntry } from './locations';

export type Entry = CollectionEntry<'doctors'>;

/** Drafts render in `dev` and disappear from production builds. */
export async function getPublished(): Promise<Entry[]> {
  const entries = await getCollection('doctors', ({ data }) => {
    return import.meta.env.DEV || data.draft !== true;
  });

  return entries.sort((a, b) => a.data.name.localeCompare(b.data.name));
}

/** Doctors declare the offices they visit by location display name, not slug. */
export function atLocation(all: Entry[], locationName: string): Entry[] {
  return all.filter((entry) => entry.data.locations?.includes(locationName));
}

/** Resolve a doctor's location names to published location entries. */
export function resolveLocations(doctor: Entry, allLocations: LocationEntry[]): LocationEntry[] {
  const names = doctor.data.locations ?? [];
  return allLocations.filter((location) => names.includes(location.data.name));
}

/** Same location first, then alphabetical. */
export function related(all: Entry[], current: Entry, limit = 3): Entry[] {
  return all
    .filter((entry) => entry.id !== current.id)
    .sort((a, b) => {
      const aMatch = a.data.locations?.some((loc) => current.data.locations?.includes(loc)) ? 1 : 0;
      const bMatch = b.data.locations?.some((loc) => current.data.locations?.includes(loc)) ? 1 : 0;
      return bMatch - aMatch;
    })
    .slice(0, limit);
}
