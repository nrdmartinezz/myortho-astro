# astro-business-starter

Static business-site starter: Astro 5 + Tailwind CSS v4, token-driven theming, an accessible
header, and full SEO output. Builds to plain HTML for cPanel/Apache hosting.

Three pages ship (`/`, `/404`, `/thank-you/`). Everything else — about, services, contact, legal,
a blog — is added per project from the block library. There is no CMS and no content collection
until a project needs one.

---

## Populate before you build

| File                                         | What goes in it                                          |            |
| -------------------------------------------- | -------------------------------------------------------- | ---------- |
| `src/config/site.ts`                         | Business name, NAP, hours, socials, schema.org type      | required   |
| `src/config/navigation.ts`                   | Nav tree, header CTA, footer and legal links             | required   |
| `tokens/*.json`                              | Replace the demo brand — theme regenerates on next build | required   |
| `public/favicon.svg` + `src/assets/logo.svg` | Client marks                                             | required   |
| `public/robots.txt`                          | Point the `Sitemap:` line at the real domain             | required   |
| `astro.config.mjs` → `site`                  | Production origin, no trailing slash                     | required   |
| `site.ts` → `formEndpoint`                   | PHP form handler path (default `/api/submit.php`)        | required   |
| `site.ts` → `recaptchaSiteKey`               | reCAPTCHA v3 site key — see `docs/FORMS-AND-EMAIL.md`    | optional   |
| `site.ts` → `analytics` / `verification`     | Per-platform IDs — blank means that vendor ships nothing | optional   |
| `.github/workflows/deploy.yml`               | FTP host/path secrets                                    | to publish |
| `_templates/collection/`                     | Copy only if the site needs a blog or similar            | optional   |

## Commands

| Command              | Does                                                     |
| -------------------- | -------------------------------------------------------- |
| `npm run dev`        | Generates the theme, then starts the dev server on :4321 |
| `npm run build`      | Generates the theme, then builds to `dist/`              |
| `npm run verify`     | Generates the theme, then `astro check` + Prettier check |
| `npm run format`     | Writes Prettier formatting                               |
| `npm run audit`      | Lighthouse CI + pa11y against the built site             |
| `npm run audit:deps` | OSV vulnerability report for `package-lock.json`         |
| `npm run php:check`  | Verify a local PHP binary is found                       |
| `npm run php:install`| Install PHPMailer into `public/api/vendor/` (Composer)   |
| `npm run php:serve`  | Serve built `dist/` with PHP so `/api/submit.php` runs   |
| `npm run php:dev`    | `build` + `php:install` + `php:serve` in one step        |

Build the style guide into a production bundle with `STYLEGUIDE=1 npm run build`.

## Docs

| Doc                           | Covers                                             |
| ----------------------------- | -------------------------------------------------- |
| `docs/NEW-PROJECT.md`         | The order to work in when starting a client site   |
| `docs/THEMING.md`             | Tokens, the generated theme, rebranding            |
| `docs/RESPONSIVE-RULES.md`    | Desktop-first defaults for tablet and mobile       |
| `docs/ADDING-A-COLLECTION.md` | Adding a blog or similar, if the project needs one |
| `docs/HOSTING.md`             | cPanel setup, deploy secrets, log analytics        |
| `docs/FORMS-AND-EMAIL.md`     | Contact form + self-hosted PHP SMTP mailer setup   |
| `docs/DESIGNER-BRIEF.md`      | Hand to a designer when Figma is involved          |

## Theming

`tokens/*.json` is the only committed source of design values. `src/styles/theme.css` is
**generated** from it on every `dev`, `build`, and `verify`, and is gitignored — never edit it.

Tokens map straight onto Tailwind v4 namespaces, so `color.brand.500` becomes `--color-brand-500`
and yields `bg-brand-500`. Semantic aliases (`surface`, `ink`, `line`) point at the raw scales, so
a rebrand usually means editing the brand ramp alone.

There is **no override stylesheet**. If one place needs a different value, that is a component-level
decision — a prop or a local class — not a global escape hatch.

Tokens can come from a Figma library via Tokens Studio, from another tool's export, or from editing
the JSON by hand. The pipeline cannot tell the difference.

## Layout model

Every block is `Section > Container > content`:

- **`Section`** — full viewport width. Owns background, vertical rhythm, semantic tag.
- **`Container`** — `max-w-page` (1350px), centred, with gutters. Owns content arrangement.

Adjacent `Section`s sharing a background collapse the seam automatically (see `global.css`), so
stacked bands read as one flow while a colour change keeps its full padding.

Responsive is **desktop-first** using Tailwind `max-*` variants. See `docs/RESPONSIVE-RULES.md`.

## Deploying

Static output in `dist/` uploads as-is. `public/.htaccess` handles HTTPS, non-www, trailing
slashes, compression, cache headers, and the 404. `trailingSlash: 'always'` + `build.format:
'directory'` are pinned together — changing one without the other breaks URLs on Apache.

## Forms & email

Contact forms POST to a self-hosted PHP handler on the same domain (`public/api/submit.php`) —
no Formspree, no third-party form service. Full reference: `docs/FORMS-AND-EMAIL.md`.

- **Client config** (`src/config/site.ts`): `formEndpoint` (defaults to `/api/submit.php`; blank
  disables all forms) and optional `recaptchaSiteKey` (reCAPTCHA v3 public key).
- **Server secrets** (not in git): copy `public/api/config.example.php` to a file **outside
  `public_html`** — `~/private/site-mail.php` — and set `recaptcha_secret`, `notify_to`,
  `from_email`, and `from_name`. Update the first path in `public/api/lib/mailer.php` if you rename
  it. Mail sends via PHP `mail()` by default; set `smtp_host`/`smtp_user`/`smtp_pass` for
  authenticated SMTP.
- **Dependencies**: PHPMailer installs into `public/api/vendor/` via `composer install`. CI
  (`.github/workflows/deploy.yml`) runs this automatically before the build; run it manually for
  local testing.
- **Local testing**: needs PHP 8.x — `npm run php:dev` builds, installs PHPMailer, and serves
  `dist/` so `/api/submit.php` executes. Copy `config.example.php` to `public/api/config.local.php`
  for dev secrets (gitignored).
- **Adding a form**: mark the `<form>` with `data-site-form` + `action={site.formEndpoint}`, add a
  hidden `form_type`, and (optionally) a `forms.<type>` block in the mail config. `RecaptchaV3` and
  `SiteFormHandler` are mounted globally in `BaseLayout.astro`.
