# Hosting (cPanel)

Everything runs on your own infrastructure. The only external service is GitHub
(source + CI); form delivery is handled by the self-hosted PHP mailer under
`public/api/` (see `docs/FORMS-AND-EMAIL.md`).

## URL shape — decided once, do not change casually

`astro.config.mjs` pins these together:

```js
trailingSlash: 'always',
build: { format: 'directory' },
```

That produces `/about/index.html`, which Apache serves at `/about/` via
`DirectoryIndex` with no redirect. Changing one without the other breaks URLs,
generates redirect chains, and splits your log analytics between two paths for
the same page.

**The 404 is the exception:** Astro emits it flat as `dist/404.html`, not
`dist/404/index.html`. `.htaccess` points `ErrorDocument` at `/404.html`.

## First-time server setup

Two cPanel hosts, two GitHub Environments — never one shared FTP account.

**Staging** is `https://site.myorthodontistnc.com`. Every push to `main` deploys here.
**Production** is `https://myorthodontistnc.com`. It deploys only when you run the
workflow by hand. Do not point production FTP at the live document root until you
are ready to replace WordPress.

For each host:

1. Create the domain or subdomain in cPanel; note the document root
   (addon domains are often `~/site.myorthodontistnc.com/` rather than a folder
   under `public_html/`).
2. Issue the SSL certificate (AutoSSL) **before** the first deploy — `.htaccess`
   force-redirects to HTTPS and will loop against a missing certificate.
3. Create an FTP account **scoped to that document root** (trailing slash on the
   home directory). Staging and production must not share an account.
4. **First staging deploy overwrites whatever currently lives on
   `site.myorthodontistnc.com`** (the Elementor preview). Confirm that is intended.

### GitHub Environments

Create Environments named `staging` and `production` under
Settings → Environments. Put secrets and variables **on the environment**, not at
repository level. If FTP secrets already exist as repo secrets, move them onto the
environments and delete the repo copies so a job cannot pick up the wrong target.

Environment variables (`vars`):

| Variable         | `staging`                           | `production`                   |
| ---------------- | ----------------------------------- | ------------------------------ |
| `SITE_URL`       | `https://site.myorthodontistnc.com` | `https://myorthodontistnc.com` |
| `ALLOW_INDEXING` | `false`                             | `true`                         |

Environment secrets:

| Secret           | Value                                  |
| ---------------- | -------------------------------------- |
| `FTP_HOST` | cPanel FTP hostname                    |
| `FTP_USER` | The scoped FTP account for that host   |
| `FTP_PW`   | Its password                           |

The FTP account home must already be the document root — the workflow
uploads to `./`. Prefer **Environment secrets** for these three (especially
`FTP_PW`); variables work but are visible to anyone with write access.

On `production`, enable required reviewers so a promote cannot run without
approval. Leave production FTP unconfigured (or aimed at an unused directory)
until WordPress cutover.

`SITE_URL` is the build-time origin: canonicals, Open Graph, schema, and the
sitemap all follow it. `ALLOW_INDEXING=false` forces `noindex`, emits a
`Disallow: /` robots.txt, and skips analytics tags.

## Deploying

`.github/workflows/deploy.yml`:

- **Push to `main`** → environment `staging` → FTPS to `site.myorthodontistnc.com`.
- **Actions → Deploy → Run workflow** → choose `staging` or `production`. The
  dropdown defaults to `staging`.

Each run: install → `verify` → PHPMailer → `build` (with that environment's
`SITE_URL` / `ALLOW_INDEXING`) → FTP upload of `dist/`. A type error or malformed
frontmatter fails in CI instead of shipping.

### Promote to live (after staging looks right)

1. Open the Deploy workflow → Run workflow → target `production`.
2. Approve the environment if reviewers are required.
3. Confirm the live hostname, HTTPS, forms, and that `robots.txt` allows indexing.

Until cutover, a production run would overwrite the live WordPress site. Do not
flip `main` to auto-deploy production until that cutover is deliberate.

Manual fallback:

```bash
SITE_URL=https://site.myorthodontistnc.com ALLOW_INDEXING=false npm run build
```

Then upload the contents of `dist/`.

## Forms & email (PHP mailer)

Contact forms POST to `public/api/submit.php`, which Astro copies to `dist/api/` at build.
Delivery is server-side — no third-party form service. Full reference: `docs/FORMS-AND-EMAIL.md`.

Server setup, once per site:

1. **Secrets file, outside the document root.** Copy `public/api/config.example.php` to
   `~/private/site-mail.php` (rename per client, then update the first path in
   `public/api/lib/mailer.php`). The mailer walks three directories up from
   `api/lib/mailer.php`, so an addon-domain docroot of `~/site.myorthodontistnc.com/`
   still resolves to `~/private/site-mail.php`. Keeping it outside the web root means
   an FTP deploy never overwrites or exposes it. Set at least `recaptcha_secret`,
   `notify_to`, `from_email`, and `from_name`. Mail sends via PHP `mail()` by default;
   set `smtp_host`/`smtp_user`/`smtp_pass` for authenticated SMTP (better
   deliverability on some hosts). Staging forms return a graceful error until this
   file exists on that host.
2. **PHPMailer.** The deploy workflow runs `composer install --no-dev --working-dir=public/api`
   before the build, so `vendor/` ships inside `dist/api/`. If you deploy manually, run that
   command first. Composer must be available on the machine that builds.
3. **reCAPTCHA v3 (optional).** Put the site key in `src/config/site.ts` (`recaptchaSiteKey`) and
   the matching secret in the server config (`recaptcha_secret`); add the domain in the Google
   reCAPTCHA admin.
4. **Verify.** After deploy, submit each form on the live site and confirm the notification lands
   (check spam). A missing/incomplete server config returns a graceful "Form is temporarily
   unavailable" instead of sending. If mail lands in spam, configure SPF/DKIM in
   cPanel → Email Deliverability.

## What `.htaccess` does

Lives at `public/.htaccess`, so it ends up at the document root:

- Forces HTTPS and non-www (swap two lines to prefer www)
- Adds trailing slashes in one hop so `mod_dir` cannot chain a second redirect
- `ErrorDocument 404 /404.html`
- gzip and brotli for text assets
- Immutable, one-year caching for fingerprinted assets; `must-revalidate` for HTML
  — without that split, a deploy is invisible until caches expire
- `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, HSTS

## Analytics from server logs

Log analytics is the baseline measurement layer. It costs the page nothing: no
JavaScript, no consent prompt, no ad-blocker loss.

Raw logs live under `~/logs/` (cPanel → Raw Access). Enable log archiving so they
survive the monthly rotation.

```bash
goaccess ~/logs/example.com-ssl_log \
  --log-format=COMBINED \
  --ignore-panel=REFERRING_SITES \
  --exclude-ip=YOUR.OFFICE.IP \
  -o ~/public_html/_reports/index.html
```

Cron it monthly, and protect `_reports/` with cPanel's Directory Privacy.

Two things the build does to keep reports honest, both worth preserving:

- **Stable URLs.** Changing `trailingSlash` splits one page across two log paths.
- **Clean 404s and redirects.** A redirect chain shows up as two hits.

Filter out asset paths (`/_astro/`) and known bots in the GoAccess config, and set
a log retention period.

**Limits worth naming before a client asks:** logs answer _how much traffic and to
which pages_, not _what people did on the page_. No scroll depth, no in-page events,
no cross-device attribution. When a client runs paid ads and needs conversion
attribution, add GA4/Meta/Bing tags in `src/config/site.ts` — that is what they are
for.
