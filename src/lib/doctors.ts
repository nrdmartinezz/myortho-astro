import { getCollection, type CollectionEntry } from 'astro:content';
import type { Entry as LocationEntry } from './locations';

export type Entry = CollectionEntry<'doctors'>;

/** Final word of the display name, after a leading "Dr." */
export function lastName(name: string): string {
  const withoutTitle = name.replace(/^(dr|drs)\.?\s+/i, '').trim();
  return withoutTitle.split(/\s+/).at(-1) ?? name;
}

export interface ProfileCopy {
  /** False when the body is not an optional education list plus an about section. */
  structured: boolean;
  education: string[];
  about: string[];
}

/**
 * Doctor pages place the education list beside the photo and the about
 * paragraphs under their own heading. Bios are plain paragraphs; anything
 * else keeps the rendered MDX.
 */
export function profileCopy(body: string | undefined): ProfileCopy {
  const source = body?.replace(/\r\n/g, '\n').trim() ?? '';
  if (!source) return { structured: true, education: [], about: [] };

  const match = source.match(/^(?:## Education\n+([\s\S]*?)\n+)?## About\n+([\s\S]+)$/);
  if (!match) return { structured: false, education: [], about: [] };

  const education = match[1] === undefined ? [] : educationItems(match[1]);
  if (!education) return { structured: false, education: [], about: [] };

  const about = aboutParagraphs(match[2]);
  if (!about) return { structured: false, education: [], about: [] };

  return { structured: true, education, about };
}

function educationItems(block: string): string[] | null {
  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0 || lines.some((line) => !/^[-*] /.test(line))) return null;
  return lines.map((line) => line.replace(/^[-*] /, '').trim());
}

function aboutParagraphs(block: string): string[] | null {
  if (/^#{1,6}\s|^[-*]\s|^\d+\.\s|[*_`[\]]/m.test(block)) return null;
  const paragraphs = block
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
  return paragraphs.length > 0 ? paragraphs : null;
}

/** Owner first, staff by last name, locum tenens last. */
function sortRank(entry: Entry): number {
  if (entry.data.role === 'President/Founder') return 0;
  if (/locum tenens/i.test(entry.data.role ?? '')) return 2;
  return 1;
}

/** Drafts render in `dev` and disappear from production builds. */
export async function getPublished(): Promise<Entry[]> {
  const entries = await getCollection('doctors', ({ data }) => {
    return import.meta.env.DEV || data.draft !== true;
  });

  return entries.sort((a, b) => {
    const rank = sortRank(a) - sortRank(b);
    if (rank !== 0) return rank;
    return lastName(a.data.name).localeCompare(lastName(b.data.name), 'en', {
      sensitivity: 'base',
    });
  });
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
