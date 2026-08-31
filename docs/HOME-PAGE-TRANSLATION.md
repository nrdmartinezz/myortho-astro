# Homepage translation: site.myorthodontistnc.com → Astro

Flat marketing homepage only. **`src/pages/index.astro` is the home page** — the existing
`Hero` block there is already correct and should not be changed during translation work.
Everything below the hero is assembled from props-only blocks. Header/footer stay in
`BaseLayout` (driven by `navigation.ts` / `site.ts`).

Source: [site.myorthodontistnc.com](https://site.myorthodontistnc.com) (Elementor / Hello).

---

## Principles

1. **Compose, don’t recreate Elementor.** Map each live band to an existing block in
   `src/components/blocks/`. Prefer props + tokens over one-off markup.
2. **`Section > Container > content`.** Background and rhythm live on `Section`;
   layout width/align on `Container`. Never bake band styling into page markup.
3. **Blocks stay props-only.** Location pills come from `getPublished()` in the page
   frontmatter, then get passed in — blocks never query collections.
4. **Assets through `astro:assets`.** Images live under `src/images/` and go through
   `<Image>` / block image props (AVIF/WebP, explicit widths).
5. **Out of scope for this flat page:** interior routes (service detail, blog posts,
   patient forms pages), Gravity Forms → keep Formspree via `ContactBlock`, full visual
   pixel-match of Elementor animations/carousels.

---

## Live band → Astro block map

| #   | Live section (Elementor)                                                 | Astro block(s)                                              | Data source                                                            | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Site header / mega nav                                                   | `Header` + `MegaMenu` / `MobileNav`                         | `navigation.ts`                                                        | Already partially wired for Treatments / About / Resources. Footer groups still demo — align in a follow-up.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 1   | Hero (“Reveal the Beautiful Smile…”) + location pills + CTAs             | `Hero` in `index.astro`                                     | Copy + `locations` collection                                          | **Already correct — do not modify.** Translation starts at the first block below `<Hero />`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 1b  | Trust chips under hero (Board Certified / In-Network / Free Consults)    | Omit for v1 **or** `Hero` `bullets` later                   | —                                                                      | Not in the current hero; add only if requested.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2   | Stats strip (14+ / 25+ / 100K+ / 100%)                                   | `Stats`                                                     | Hardcoded                                                              | Four-up; `background="base"` or `muted` to alternate after inverse hero.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 3   | “3 Reasons Why People Choose MyOrthodontist”                             | `ProcessSteps` (`numbered`) **or** `ServicesGrid` columns=3 | Hardcoded                                                              | Live layout is three equal cards with long body copy. Use `ProcessSteps` with `numbered` for the “3” framing, or `ServicesGrid` if cards read better. CTAs below → `ActionButton`s via a following `CTABanner`/`FeatureSplit` actions, or append actions to the block header area by stacking a small `CTABanner` with `background` matching. **v1:** `ProcessSteps` + compact action row via `CTABanner` (`background="base"`, tight spacing) or reuse reasons as `ServicesGrid` and put CTAs in a sibling `FeatureSplit` without image. Simplest: `ServicesGrid` + actions on a following muted strip. |
| 4   | “Crafting Smiles With Innovation” (6 services)                           | `ServicesGrid` (`columns={3}`)                              | Hardcoded + `src/images/services/*`                                    | Live cards have **eyebrow + image + title + body + Learn More**. Extend `ServicesGrid` item shape with optional `eyebrow`, `image`, `ctaLabel`. Links stub to future `/services/...` or existing treatment URLs from nav.                                                                                                                                                                                                                                                                                                                                                                                |
| 5   | “We Accept Your Insurance”                                               | `FeatureSplit` (copy + bullets + CTAs)                      | Hardcoded                                                              | Image side can use practice photo (`about-practice-care.webp`) or omit for text-heavy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 5b  | Insurance micro-stats (10+ plans / 0% interest / $0 down / Free consult) | `Stats`                                                     | Hardcoded                                                              | Stack immediately under 5 with matching background so rhythm seam collapses, **or** different background to keep full pad.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 5c  | Carrier logos                                                            | `LogoCloud`                                                 | `src/images/insurance/*`                                               | Aetna, Ameritas, Cigna, Delta Dental, DenteMax, Guardian, Humana, MetLife, Principal, United Healthcare.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 6   | “Walk Into Our Offices or Schedule a Virtual Consult”                    | `FeatureSplit`                                              | Locations list from collection; image `foundation/virtual-consult.jpg` | Bullets = office names linking to `/locations/{slug}/`. Actions: Book + Virtual.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7   | “Everything You Need In One Place” (patient hub)                         | `ServicesGrid` (`columns={2}` or `4`)                       | Hardcoded                                                              | Forms / Financial / Virtual / FAQs. Icons via `lucide:*`. Hrefs to existing nav targets where they exist (`/insurance/`, `/faqs/`, etc.).                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 8   | “What Our Patients Are Saying”                                           | `Testimonials`                                              | Hardcoded (3 reviews from live)                                        | Optional body line for “4.9 / 5.0 Google Reviews”.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 9   | Mid-page CTA (“Join over 100,000…”)                                      | `CTABanner`                                                 | Hardcoded                                                              | `background="brand"` or `inverse`; Schedule + Call actions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 10  | Happy Tooth Foundation                                                   | `FeatureSplit`                                              | Copy + `foundation/happy-tooth.jpg`                                    | Eyebrow “Community Initiative”; CTA “Get More Information” → `/about/foundation/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 11  | “Latest Posts & Smile Tips”                                              | **Defer collection** — flat teaser via `ServicesGrid`       | Hardcoded 3 posts from live                                            | Full blog = copy `_templates/collection/` → `posts` later (`docs/ADDING-A-COLLECTION.md`). Flat page hardcodes titles/dates/excerpts/hrefs to production post URLs **or** `#` until posts exist. Prefer external absolute URLs only if this deploy isn’t hosting the blog yet.                                                                                                                                                                                                                                                                                                                           |
| 12  | Contact                                                                  | `ContactBlock`                                              | `site.ts` + location names as select options                           | Pass `services={locationNames}` as the preferred-location select (label copy differs — optional small prop rename later). Live Gravity Form fields map to Formspree fields.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 13  | Site footer                                                              | `Footer`                                                    | `navigation.ts` + `site.ts`                                            | Replace demo Services footer links with real Treatments / Locations / Company groups.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

---

## Recommended `index.astro` stack (top → bottom)

```
BaseLayout
  Hero                    # already in index.astro — leave as-is
  Stats                   # 2 — practice numbers
  ServicesGrid            # 3 — three reasons (or ProcessSteps)
  CTA strip               # complimentary consult / contact (optional CTABanner base)
  ServicesGrid            # 4 — six treatments (with images)
  FeatureSplit            # 5 — insurance copy
  Stats                   # 5b — financing numbers
  LogoCloud               # 5c — carriers
  FeatureSplit            # 6 — offices + virtual (reverse optional)
  ServicesGrid            # 7 — patient resources
  Testimonials            # 8
  CTABanner               # 9
  FeatureSplit            # 10 — foundation
  ServicesGrid            # 11 — blog teasers (temporary)
  ContactBlock            # 12
```

Background rhythm (alternate `base` / `muted` / `brand` / `inverse`) so adjacent same-bg
bands collapse correctly per `RESPONSIVE-RULES.md` / global seam rule.

---

## Config & identity checklist (not page blocks, but required)

| File                       | Live-site truth                                                                                                                     | Status                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `src/config/site.ts`       | Name, phone `1-800-MY-ORTHO`, hours Mon–Fri 8–5, schema → prefer `Dentist` or keep `LocalBusiness`, fix NAP away from Columbus demo | Partially done — address/email still demo   |
| `astro.config.mjs` `site`  | Production origin (not the Elementor staging host)                                                                                  | Confirm                                     |
| `tokens/color.json`        | Brand navy `#003B6A` / accent lime `#A1B829` already present                                                                        | Mostly aligned                              |
| `src/config/navigation.ts` | Primary mega tree matches live IA                                                                                                   | Mostly done; footer still demo              |
| Logo / favicon             | `myorthodontist-logo.png` in `src/images/`                                                                                          | Wire into Header if still using placeholder |
| `formspreeId`              | Replace Gravity Forms                                                                                                               | Empty until Formspree form created          |

---

## Block gaps (extend only when composition isn’t enough)

| Need                               | Decision                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| Service cards with photo + eyebrow | **Done** — `ServicesGrid` items accept optional `image`, `eyebrow`, `ctaLabel`      |
| Contact “Preferred Location”       | **Done** — `ContactBlock` `selectLabel` / `selectName` (home passes location names) |
| Hero trust chips                   | v1 uses `Hero` `bullets` for Board Certified / In-Network / Free Consults           |
| Blog index/detail/RSS              | Out of flat-page scope — add `posts` collection when ready                          |
| Map of 14 offices                  | `MapEmbed` optional under locations feature split; not on live home as a single map |
| Reviews carousel                   | Static `Testimonials` grid is enough; no Swiper island                              |

Do **not** add a page-builder abstraction or Elementor shortcode shim.

---

## Asset inventory (pulled from staging)

```
src/images/hero-bg.jpg
src/images/about-practice-care.webp
src/images/services/{metal-ceramic-braces,spark-clear-aligners,carriere,brius,virtual-dental-monitoring,smile-360}.jpg
src/images/insurance/{Aetna,Ameritas,Cigna,Delta-Dental,DenteMax,Guardian,Humana,MetLife,Principal,United-Healthcare}.png
src/images/foundation/{happy-tooth,virtual-consult}.jpg
```

---

## Implementation order

1. Document this map (this file). ✅
2. Extend `ServicesGrid` for optional images/eyebrows. ✅
3. Rewrite `index.astro` to the stack above with live copy. ✅
4. Align `site.ts` NAP/hours/schema and footer nav. ✅ (Formspree ID still blank)
5. Visual check at 1920 / 768 / 375; fix rhythm/contrast via tokens or block props only.
6. Later: `posts` collection, interior pages, Formspree ID, analytics IDs.

---

## Explicit non-goals

- Pixel-perfect Elementor motion, sticky column tricks, or Swiper carousels
- Porting WordPress plugins (Gravity Forms, Elementor Pro)
- Building every linked interior URL in the same pass
- Editing generated `theme.css` by hand
