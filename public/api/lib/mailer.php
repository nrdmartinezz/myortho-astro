<?php

declare(strict_types=1);

use PHPMailer\PHPMailer\Exception as MailException;
use PHPMailer\PHPMailer\PHPMailer;

require_once dirname(__DIR__) . '/vendor/autoload.php';

function loadMailConfig(): array
{
    $paths = [
        dirname(__DIR__, 3) . '/private/site-mail.php',
        __DIR__ . '/../config.local.php',
    ];

    foreach ($paths as $path) {
        if (is_readable($path)) {
            $config = require $path;
            if (is_array($config)) {
                return $config;
            }
        }
    }

    return [];
}

function renderTemplate(string $filename, array $vars): string
{
    $filename = sanitizeTemplateFilename($filename);
    $path = dirname(__DIR__) . '/templates/' . $filename;
    if (!is_readable($path)) {
        throw new RuntimeException('Email template not found: ' . $filename);
    }

    $html = file_get_contents($path);
    if ($html === false) {
        throw new RuntimeException('Could not read template: ' . $filename);
    }

    foreach ($vars as $key => $value) {
        $html = str_replace('{{' . $key . '}}', (string) $value, $html);
    }

    return $html;
}

function sanitizeTemplateFilename(string $filename): string
{
    $basename = basename($filename);
    if (!preg_match('/^[a-zA-Z0-9._-]+\.html$/', $basename)) {
        throw new RuntimeException('Invalid template filename.');
    }

    return $basename;
}

/**
 * Pick notification/autoreply template for a form.
 * 1. Explicit mapping in config forms[form_type][notification|autoreply]
 * 2. Convention: {kind}-{form_type}.html if the file exists
 * 3. Fallback: {kind}.html
 */
function resolveTemplateForForm(array $config, string $formType, string $kind): string
{
    if (!in_array($kind, ['notification', 'autoreply'], true)) {
        throw new RuntimeException('Unknown template kind.');
    }

    $forms = $config['forms'] ?? [];
    if (!empty($forms[$formType][$kind])) {
        return sanitizeTemplateFilename((string) $forms[$formType][$kind]);
    }

    $convention = sanitizeTemplateFilename("{$kind}-{$formType}.html");
    if (is_readable(dirname(__DIR__) . '/templates/' . $convention)) {
        return $convention;
    }

    return sanitizeTemplateFilename("{$kind}.html");
}

/** @return list<string> */
function allowedFormTypes(array $config): array
{
    $configured = array_keys($config['forms'] ?? []);

    return array_values(array_unique(array_merge(
        ['contact', 'refer-a-friend', 'doctor-referral'],
        $configured,
    )));
}

/** @return list<string> */
function requiredFieldsForForm(string $formType): array
{
    return match ($formType) {
        'refer-a-friend' => ['name', 'email', 'phone', 'friend_name', 'friend_phone', 'location'],
        'doctor-referral' => [
            'patient_first_name',
            'patient_last_name',
            'email',
            'date_of_birth',
            'parent_name',
            'home_phone',
            'referring_dentist_name',
            'referring_dentist_phone',
            'reason_for_referral',
            'cleared_for_treatment',
            'location',
        ],
        default => ['name', 'email', 'message'],
    };
}

/** Extra POST keys allowed into email templates. Never include recipient addresses. */
function extraFieldKeys(): array
{
    return [
        'friend_name',
        'friend_phone',
        'friend_email',
        'location',
        'patient_first_name',
        'patient_last_name',
        'date_of_birth',
        'parent_name',
        'insurance_carrier',
        'insurance_policy',
        'home_phone',
        'cell_phone',
        'referring_dentist_name',
        'referring_dentist_phone',
        'referring_dentist_email',
        'reason_for_referral',
        'last_exam',
        'last_cleaning',
        'pan_fmx',
        'cleared_for_treatment',
    ];
}

/** @return array<string, string> */
function loadLocationEmails(): array
{
    $path = dirname(__DIR__) . '/location-emails.php';
    if (!is_readable($path)) {
        return [];
    }

    $map = require $path;

    return is_array($map) ? $map : [];
}

function officeEmailForLocation(string $location): string
{
    if ($location === '') {
        return '';
    }

    $map = loadLocationEmails();
    $email = trim((string) ($map[$location] ?? ''));

    return filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : '';
}

/**
 * Referral forms go To the selected office and CC notify_to.
 * Unknown location (or any other form) goes To notify_to only.
 *
 * @return array{to: list<string>, cc: list<string>}
 */
function notificationRecipients(array $config, string $formType, string $location): array
{
    $central = parseEmailList($config['notify_to'] ?? '');

    if (!in_array($formType, ['refer-a-friend', 'doctor-referral'], true)) {
        return ['to' => $central, 'cc' => []];
    }

    $office = officeEmailForLocation($location);
    if ($office === '') {
        return ['to' => $central, 'cc' => []];
    }

    $cc = array_values(array_filter(
        $central,
        static fn(string $email) => strcasecmp($email, $office) !== 0,
    ));

    return ['to' => [$office], 'cc' => $cc];
}

function getFormMailSettings(array $config, string $formType): array
{
    $fromName = (string) ($config['from_name'] ?? 'Site');

    $defaults = [
        'contact' => [
            'source_label' => 'Contact form',
            'subject' => "New enquiry — {$fromName}",
            'autoreply_subject' => "We received your message — {$fromName}",
            'send_autoreply' => false,
        ],
        'refer-a-friend' => [
            'source_label' => 'Refer a friend',
            'subject' => 'New friend referral',
            'autoreply_subject' => "We received your referral — {$fromName}",
            'send_autoreply' => false,
        ],
        'doctor-referral' => [
            'source_label' => 'Doctor referral',
            'subject' => 'New doctor referral',
            'autoreply_subject' => "We received your referral — {$fromName}",
            'send_autoreply' => false,
        ],
    ];

    $base = $defaults[$formType] ?? [
        'source_label' => $formType,
        'subject' => "New submission — {$fromName}",
        'autoreply_subject' => "Thank you for contacting {$fromName}",
        'send_autoreply' => false,
    ];

    $custom = $config['forms'][$formType] ?? [];
    $merged = array_merge($base, array_intersect_key($custom, $base));

    if (array_key_exists('send_autoreply', $custom)) {
        $merged['send_autoreply'] = (bool) $custom['send_autoreply'];
    } elseif (array_key_exists('send_autoreply', $config)) {
        $merged['send_autoreply'] = (bool) $config['send_autoreply'];
    } else {
        $merged['send_autoreply'] = false;
    }

    return $merged;
}

function escapeHtml(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** SMTP when host, user, and password are set; otherwise PHP mail() (WordPress-style). */
function usesSmtp(array $config): bool
{
    return !empty($config['smtp_host'])
        && !empty($config['smtp_user'])
        && !empty($config['smtp_pass']);
}

function configureMailer(PHPMailer $mail, array $config): void
{
    $mail->CharSet = PHPMailer::CHARSET_UTF8;

    if (usesSmtp($config)) {
        $mail->isSMTP();
        $mail->Host = $config['smtp_host'];
        $mail->SMTPAuth = true;
        $mail->Username = $config['smtp_user'];
        $mail->Password = $config['smtp_pass'];
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = (int) ($config['smtp_port'] ?? 587);
        return;
    }

    $mail->isMail();
}

/** @return list<string> */
function parseEmailList(string|array $value): array
{
    $raw = is_array($value) ? $value : preg_split('/\s*,\s*/', trim($value));

    $emails = [];
    foreach ($raw as $item) {
        $item = trim((string) $item);
        if ($item !== '' && filter_var($item, FILTER_VALIDATE_EMAIL)) {
            $emails[] = $item;
        }
    }

    return $emails;
}

function sendMail(
    array $config,
    string|array $to,
    string $toName,
    string $subject,
    string $htmlBody,
    ?string $replyTo = null,
    ?string $replyToName = null,
    string|array|null $cc = null,
): void {
    $mail = new PHPMailer(true);
    $recipients = parseEmailList($to);

    if ($recipients === []) {
        throw new RuntimeException('No valid recipient addresses.');
    }

    try {
        configureMailer($mail, $config);

        $mail->setFrom($config['from_email'], $config['from_name']);
        foreach ($recipients as $index => $address) {
            $mail->addAddress($address, $index === 0 ? $toName : '');
        }

        if ($cc !== null) {
            foreach (parseEmailList($cc) as $address) {
                if (!in_array($address, $recipients, true)) {
                    $mail->addCC($address);
                }
            }
        }

        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body = $htmlBody;
        $mail->AltBody = strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $htmlBody));

        if ($replyTo) {
            $mail->addReplyTo($replyTo, $replyToName ?? '');
        }

        $mail->send();
    } catch (MailException $e) {
        error_log('PHPMailer error: ' . $mail->ErrorInfo);
        throw new RuntimeException('Failed to send email.');
    }
}

function getClientIp(): string
{
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $parts = explode(',', (string) $_SERVER['HTTP_X_FORWARDED_FOR']);
        $ip = trim($parts[0]);
        if (filter_var($ip, FILTER_VALIDATE_IP)) {
            return $ip;
        }
    }

    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if ($ip !== '' && filter_var($ip, FILTER_VALIDATE_IP)) {
        return $ip;
    }

    return 'unknown';
}

function checkRateLimit(string $ip, array $config): bool
{
    $window = (int) ($config['rate_limit_seconds'] ?? 60);
    $max = (int) ($config['rate_limit_max'] ?? 5);
    $dir = sys_get_temp_dir() . '/site-forms-rate-limit';

    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        return true;
    }

    $file = $dir . '/' . hash('sha256', $ip);
    $now = time();
    $hits = [];

    if (is_readable($file)) {
        $raw = file_get_contents($file);
        if ($raw !== false) {
            $hits = array_filter(
                array_map('intval', explode("\n", trim($raw))),
                static fn(int $ts) => ($now - $ts) < $window,
            );
        }
    }

    if (count($hits) >= $max) {
        return false;
    }

    $hits[] = $now;
    file_put_contents($file, implode("\n", $hits), LOCK_EX);

    return true;
}

function verifyRecaptcha(string $token, string $secret, float $minScore, string $remoteIp): bool
{
    if ($token === '') {
        return false;
    }

    $response = file_get_contents('https://www.google.com/recaptcha/api/siteverify?' . http_build_query([
        'secret' => $secret,
        'response' => $token,
        'remoteip' => $remoteIp,
    ]));

    if ($response === false) {
        return false;
    }

    $result = json_decode($response, true);
    if (!is_array($result) || empty($result['success'])) {
        return false;
    }

    return (float) ($result['score'] ?? 0) >= $minScore;
}
