import { getEntry, type CollectionEntry } from 'astro:content';

export type Entry = CollectionEntry<'specialOffers'>;

/** The site-wide current special. Undefined if the entry is missing. */
export async function getCurrent(): Promise<Entry | undefined> {
  return getEntry('specialOffers', 'current-special');
}

const pad = (value: number) => String(value).padStart(2, '0');

/** Always show offer dates as MM/DD/YYYY, even if stored day-first or as a Date. */
export function formatExpiration(value: string | Date | undefined): string | undefined {
  if (value == null || value === '') return undefined;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${pad(value.getMonth() + 1)}/${pad(value.getDate())}/${value.getFullYear()}`;
  }

  const raw = String(value).trim();
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return raw;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = match[3];

  // 30/09/2026 is unambiguously day/month — flip it for US display.
  if (first > 12 && second <= 12) {
    return `${pad(second)}/${pad(first)}/${year}`;
  }

  return `${pad(first)}/${pad(second)}/${year}`;
}
