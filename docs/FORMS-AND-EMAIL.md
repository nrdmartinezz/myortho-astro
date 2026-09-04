# Forms and email

Contact forms POST to a PHP handler on the same domain (`/api/submit.php`).
No Formspree, no client SMTP credentials required by default.

## How it works

```
Browser form
  → reCAPTCHA v3 token attached (client)
  → POST /api/submit.php (JSON via fetch)
  → honeypot + reCAPTCHA verified (server)
  → HTML templates rendered
  → PHPMailer sends notification to team
  → optional autoreply to submitter
  → redirect to /thank-you/
```

**Frontend** (`src/config/site.ts`):

- `formEndpoint: '/api/submit.php'` — blank disables all forms
- `recaptchaSiteKey` — public reCAPTCHA v3 key (secret lives in PHP config)

**Backend** (`public/api/`):

| Path               | Role                                |
| ------------------ | ----------------------------------- |
| `submit.php`       | Form handler                        |
| `lib/mailer.php`   | PHPMailer, templates, rate limiting |
| `templates/*.html` | Branded HTML emails                 |
| `config.local.php` | Local dev secrets (gitignored)      |

On deploy, Astro copies `public/api/` into `dist/api/`. CI runs `composer install` in
`public/api/` before build so PHPMailer lands in `vendor/`.

## Server config (production)

Create a secrets file **outside `public_html`** so FTP deploys never overwrite it:

```
~/private/site-mail.php
```

Rename per client project (e.g. `peninsula-pavers-mail.php`) and update the first path in
`public/api/lib/mailer.php`.

Copy from [`public/api/config.example.php`](../public/api/config.example.php). The handler
also reads `public/api/config.local.php` if present (local dev only — do not rely on this
in production).

### Required keys

| Key                | Purpose                                         |
| ------------------ | ----------------------------------------------- |
| `recaptcha_secret` | Google reCAPTCHA v3 secret                      |
| `notify_to`        | Where lead notifications go (string or array)   |
| `from_email`       | From address on outbound mail                   |
| `from_name`        | From display name                               |
| `site_url`         | Optional — used in email templates              |
| `site_phone`       | Optional — display phone in email footer        |
| `site_phone_href`  | Optional — tel: link for phone (`+15550104477`) |
| `timezone`         | Optional — defaults to `America/New_York`       |

### Optional SMTP

By default mail sends via **PHP `mail()`** on the host (WordPress-style). No mailbox
password needed.

To use authenticated SMTP instead (better deliverability on some hosts), set all three:

```php
'smtp_host' => 'mail.example.com',
'smtp_user' => 'leads@example.com',
'smtp_pass' => '...',
```

If any SMTP field is blank, the handler falls back to `mail()`.

### Multiple notification recipients

```php
'notify_to' => 'owner@example.com, sales@example.com',
// or
'notify_to' => ['owner@example.com', 'sales@example.com'],
```

All addresses receive the internal notification. Invalid entries are skipped.

## Per-form settings

Each form sends a hidden `form_type` field. The starter ships with `contact` only.

Configure per form under the `forms` key:

```php
'forms' => [
    'contact' => [
        'notification' => 'notification-contact.html',
        'autoreply' => 'autoreply.html',
        'subject' => 'New enquiry — Example Co',
        'autoreply_subject' => 'We received your message — Example Co',
        'send_autoreply' => true,
    ],
],
```

| Key                 | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `notification`      | Template file for the team email                         |
| `autoreply`         | Template file for the customer email                     |
| `subject`           | Team notification subject line                           |
| `autoreply_subject` | Customer autoreply subject line                          |
| `send_autoreply`    | `true` to send customer confirmation (default **false**) |

A global `'send_autoreply' => true/false` at the top level applies when a form does not
override it.

### Template resolution

For each email kind (`notification` or `autoreply`), the handler picks a template in order:

1. Explicit filename in `forms[form_type][notification|autoreply]`
2. Convention: `templates/notification-{form_type}.html` if the file exists
3. Fallback: `templates/notification.html` or `templates/autoreply.html`

### Template placeholders

**Notification** (`notification.html`):

| Placeholder           | Content                               |
| --------------------- | ------------------------------------- |
| `{{subject_line}}`    | Email subject                         |
| `{{name}}`            | Submitter name                        |
| `{{email}}`           | Submitter email (escaped)             |
| `{{email_raw}}`       | Submitter email (for `mailto:` links) |
| `{{phone}}`           | Phone or em dash                      |
| `{{services}}`        | Selected services or em dash          |
| `{{hear_about_us}}`   | Referral source or em dash            |
| `{{message}}`         | Message body                          |
| `{{form_source}}`     | Human-readable form label             |
| `{{submitted_at}}`    | Timestamp                             |
| `{{sender_ip}}`       | Submitter IP address                  |
| `{{site_name}}`       | Business name from config             |
| `{{site_url}}`        | Site URL from config                  |
| `{{site_phone}}`      | Phone display string                  |
| `{{site_phone_href}}` | Phone tel: href                       |

**Autoreply** (`autoreply.html`):

| Placeholder           | Content              |
| --------------------- | -------------------- |
| `{{name}}`            | Submitter name       |
| `{{site_name}}`       | Business name        |
| `{{site_phone}}`      | Phone display string |
| `{{site_phone_href}}` | Phone tel: href      |

Use inline CSS — email clients strip `<style>` blocks inconsistently.

## Form surfaces

| `form_type` | Component            | Notification template       |
| ----------- | -------------------- | --------------------------- |
| `contact`   | `ContactBlock.astro` | `notification-contact.html` |

Shared client-side wiring: `RecaptchaV3.astro` + `SiteFormHandler.astro` in `BaseLayout.astro`.

### Adding a new form

1. Add `data-site-form` and `action={site.formEndpoint}` to the `<form>`.
2. Include `<input type="hidden" name="form_type" value="your-type" />`.
3. Add a `forms.your-type` entry in the mail config (or rely on defaults).
4. Optionally add `templates/notification-your-type.html`.

## reCAPTCHA

Register a v3 key pair in [Google reCAPTCHA admin](https://www.google.com/recaptcha/admin).
Add the client domain to allowed domains.

- **Site key** → `recaptchaSiteKey` in `src/config/site.ts`
- **Secret key** → `recaptcha_secret` in the PHP config file

## Local testing

Requires PHP 8.x locally. Project scripts wrap the WinGet/cPanel PHP binary and a project
`php.ini`:

```bash
npm run php:check     # verify PHP is found
npm run php:install   # install PHPMailer (Composer or curl fallback)
npm run build         # copy public/api/ into dist/
npm run php:serve     # serve dist/ at http://localhost:8080
npm run php:dev       # build + install + serve
```

Copy `config.example.php` → `config.local.php` and fill in secrets. Test forms at
`http://localhost:8080/` — the API endpoint is `/api/submit.php` on the same origin.

`mail()` usually does not send real email from a Windows dev machine. For local SMTP testing,
fill in the optional SMTP fields in `config.local.php`.

## Production checklist

1. Create `~/private/site-mail.php` on the server (rename per client — update `lib/mailer.php`).
2. Set `recaptcha_secret`, `notify_to`, `from_email`, `from_name`.
3. Configure `forms` — templates, subjects, autoreply per form.
4. Deploy via CI (push to `main`) — PHPMailer installs automatically.
5. Submit each form on the live site; confirm notifications arrive in inbox (not spam).
6. If deliverability is poor, enable SMTP or configure SPF/DKIM in cPanel → Email Deliverability.

## Security

- Secrets never ship in git (`config.local.php` is gitignored).
- Honeypot field `_gotcha` — bots get a fake success response.
- reCAPTCHA v3 verified server-side (score threshold configurable via `recaptcha_min_score`).
- Rate limiting by IP (`rate_limit_seconds`, `rate_limit_max`).
- Template filenames sanitized — no path traversal.

## Troubleshooting

| Symptom                           | Likely cause                                                    |
| --------------------------------- | --------------------------------------------------------------- |
| "Form is temporarily unavailable" | Missing or incomplete PHP config on server                      |
| "Verification failed"             | reCAPTCHA secret mismatch or domain not allowed                 |
| Notification never arrives        | `mail()` blocked on host — try SMTP                             |
| Lands in spam                     | SPF/DKIM not configured; use domain From address                |
| 500 on submit                     | Check cPanel error log; PHPMailer `vendor/` missing — re-deploy |
