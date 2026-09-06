import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const locations = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/locations' }),
  schema: z.object({
    name: z.string(),
    addressLine: z.string(),
    cityStateZip: z.string(),
    region: z.string(),
    phone: z.string(),
    fax: z.string().optional(),
    email: z.email(),
    hours: z.string(),
    slug: z.string().optional(),
    coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
    seoTitle: z.string(),
    seoDescription: z.string(),
    /** Fayetteville is the exception on the live site. */
    acceptsMedicaid: z.boolean().default(true),
    /** Lets a future office be added before it's ready to go live. */
    draft: z.boolean().default(false),
  }),
});

const offers = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/offers' }),
  schema: z.object({
    headline: z.string(),
    /** One-line teaser for location pages and other compact bands. */
    summary: z.string(),
    expires: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
});

const doctors = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/doctors' }),
  schema: z.object({
    name: z.string(),
    credentials: z.string().optional(),
    slug: z.string().optional(),
    draft: z.boolean().default(false),
    role: z.string().optional(),
    locations: z.array(z.string()).optional(),
    specialties: z.array(z.string()).optional(),
    shortBio: z.string().optional(),
    photo: z.string().optional(),
    seoTitle: z.string(),
    seoDescription: z.string(),
  }),
});

export const collections = { locations, doctors, offers };
