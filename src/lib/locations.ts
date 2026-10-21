import { getCollection, type CollectionEntry } from 'astro:content';
import { nearest, type Place } from './geo';

export type Entry = CollectionEntry<'locations'>;

/** Drafts render in `dev` and disappear from production builds. */
export async function getPublished(): Promise<Entry[]> {
  const entries = await getCollection('locations', ({ data }) => {
    return import.meta.env.DEV || data.draft !== true;
  });

  return entries.sort((a, b) => a.data.name.localeCompare(b.data.name));
}

/** Other offices, nearest first. Offices without coordinates follow, by name. */
export function related(all: Entry[], current: Entry, limit?: number): Entry[] {
  const others = all.filter((entry) => entry.id !== current.id);
  const origin = current.data.coordinates;
  if (!origin) {
    const named = [...others].sort((a, b) =>
      a.data.name.localeCompare(b.data.name, 'en', { sensitivity: 'base' }),
    );
    return limit === undefined ? named : named.slice(0, limit);
  }

  const places: Array<Place & { entry: Entry }> = [];
  const missing: Entry[] = [];
  for (const entry of others) {
    const coordinates = entry.data.coordinates;
    if (!coordinates) {
      missing.push(entry);
      continue;
    }
    places.push({
      id: entry.id,
      name: entry.data.name,
      lat: coordinates.lat,
      lng: coordinates.lng,
      entry,
    });
  }
  missing.sort((a, b) => a.data.name.localeCompare(b.data.name, 'en', { sensitivity: 'base' }));

  const ranked = nearest(origin, places, { excludeId: current.id, limit }).map(
    (place) => place.entry,
  );
  const combined = [...ranked, ...missing];
  return limit === undefined ? combined : combined.slice(0, limit);
}
