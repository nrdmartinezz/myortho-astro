<?php
/**
 * Save this file on the server as ~/private/site-mail.php, outside the
 * document root. public/api/lib/mailer.php reads that path. An FTP deploy
 * does not update it.
 *
 * Before replacing the live file, copy the existing recaptcha_secret into
 * the value below. The placeholder will turn the forms off.
 *
 * What each address receives:
 * - notify_to: every practice notification. Contact forms are sent here.
 *   Referral forms are sent to the selected office (location-emails.php)
 *   and this address is copied.
 * - bcc: hidden copy of that same practice notification. The office and the
 *   person who submitted do not see this address. Leave '' to send none.
 * - from_email: the From address on both the practice notification and the
 *   confirmation to the person who submitted.
 *
 * Mail uses PHP mail() when the SMTP fields are blank.
 */
return [
    'recaptcha_secret' => 'YOUR_RECAPTCHA_SECRET_KEY',
    'notify_to' => 'info@myorthodontistnc.com',
    // Hidden copy of the practice notification. Comma-separated, or an array.
    'bcc' => 'nate@newpatientgroup.com, verifybu@webpro.com',
    'from_email' => 'info@myorthodontistnc.com',
    'from_name' => 'MyOrthodontist',
    'site_url' => 'https://myorthodontistnc.com',
    'site_phone' => '1-800-MY-ORTHO',
    'site_phone_href' => '+18006967846',
    'timezone' => 'America/New_York',

    'smtp_host' => '',
    'smtp_port' => 587,
    'smtp_user' => '',
    'smtp_pass' => '',

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
