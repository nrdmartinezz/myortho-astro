<?php
/**
 * Copy to config.local.php for local testing, or to ~/private/site-mail.php
 * on the server (outside public_html). Rename the private file per client project
 * (e.g. peninsula-pavers-mail.php) and update the path in lib/mailer.php.
 * Never commit real credentials.
 *
 * Mail transport: uses PHP mail() by default (like WordPress). Set smtp_host, smtp_user,
 * and smtp_pass to switch to authenticated SMTP — useful when mail() deliverability is poor.
 */
return [
    'recaptcha_secret' => 'YOUR_RECAPTCHA_SECRET_KEY',
    'notify_to' => 'leads@example.com',
    // Or as an array:
    // 'notify_to' => ['owner@example.com', 'sales@example.com'],
    'from_email' => 'noreply@example.com',
    'from_name' => 'Example Business',
    'site_url' => 'https://example.com',
    'site_phone' => '(555) 010-4477',
    'site_phone_href' => '+15550104477',
    'timezone' => 'America/New_York',

    // Optional SMTP — leave blank to use PHP mail() on the host.
    'smtp_host' => '',
    'smtp_port' => 587,
    'smtp_user' => '',
    'smtp_pass' => '',

    // Copy these keys into ~/private/site-mail.php for MyOrthodontist:
    // notify_to info@myorthodontistnc.com, from_name MyOrthodontist,
    // from_email on myorthodontistnc.com, site_phone 1-800-MY-ORTHO,
    // site_phone_href +18006967846. Leave SMTP blank to use PHP mail().
    'forms' => [
        'contact' => [
            'subject' => 'New enquiry — MyOrthodontist',
            'notification' => 'notification-contact.html',
            'autoreply' => 'autoreply.html',
            'autoreply_subject' => 'We received your message — MyOrthodontist',
            'send_autoreply' => true,
        ],
        'refer-a-friend' => [
            'subject' => 'New friend referral',
            'notification' => 'notification-refer-a-friend.html',
            'autoreply' => 'autoreply-refer-a-friend.html',
            'autoreply_subject' => 'We received your referral — MyOrthodontist',
            'send_autoreply' => true,
        ],
        'doctor-referral' => [
            'subject' => 'New doctor referral',
            'notification' => 'notification-doctor-referral.html',
            'autoreply' => 'autoreply-doctor-referral.html',
            'autoreply_subject' => 'We received your referral — MyOrthodontist',
            'send_autoreply' => true,
        ],
    ],

    'recaptcha_min_score' => 0.5,
    'rate_limit_seconds' => 60,
    'rate_limit_max' => 5,
];
