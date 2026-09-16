<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/lib/mailer.php';

function jsonError(int $status, string $message): never
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonSuccess(): never
{
    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
    exit;
}

function postedString(string $key): string
{
    return trim((string) ($_POST[$key] ?? ''));
}

function displayValue(string $value): string
{
    return $value !== '' ? $value : '—';
}

function assertValidEmail(string $value, bool $required): void
{
    if ($value === '') {
        if ($required) {
            jsonError(400, 'Please enter a valid email address.');
        }

        return;
    }

    if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
        jsonError(400, 'Please enter a valid email address.');
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError(405, 'Method not allowed.');
}

$config = loadMailConfig();
if ($config === [] || empty($config['recaptcha_secret']) || empty($config['from_email']) || parseEmailList($config['notify_to'] ?? '') === []) {
    error_log('Form mail config missing or incomplete.');
    jsonError(503, 'Form is temporarily unavailable.');
}

$remoteIp = getClientIp();
if (!checkRateLimit($remoteIp, $config)) {
    jsonError(429, 'Too many submissions. Please try again later.');
}

// Honeypot — silently accept so bots think they succeeded.
if (!empty($_POST['_gotcha'])) {
    jsonSuccess();
}

$recaptchaToken = $_POST['g-recaptcha-response'] ?? '';
$minScore = (float) ($config['recaptcha_min_score'] ?? 0.5);
if (!verifyRecaptcha($recaptchaToken, $config['recaptcha_secret'], $minScore, $remoteIp)) {
    jsonError(400, 'Verification failed. Please refresh and try again.');
}

$formType = postedString('form_type');
if (!in_array($formType, allowedFormTypes($config), true)) {
    jsonError(400, 'Invalid form submission.');
}

foreach (requiredFieldsForForm($formType) as $field) {
    if (postedString($field) === '') {
        jsonError(400, 'Please fill in all required fields.');
    }
}

assertValidEmail(postedString('email'), true);
assertValidEmail(postedString('friend_email'), false);
assertValidEmail(postedString('referring_dentist_email'), false);

$formMail = getFormMailSettings($config, $formType);
$fromName = (string) ($config['from_name'] ?? 'Site');

$name = postedString('name');
$email = postedString('email');
$phone = postedString('phone');
$message = postedString('message');
$hearAbout = postedString('hear_about_us');
$service = postedString('service');
$location = postedString('location');
$reason = postedString('reason_for_referral');

if ($formType === 'doctor-referral') {
    $name = trim(postedString('patient_first_name') . ' ' . postedString('patient_last_name'));
    $phone = postedString('home_phone');
    if ($message === '' && $reason !== '') {
        $message = $reason;
    }
}

$services = [];
if (isset($_POST['services']) && is_array($_POST['services'])) {
    $rawServices = $_POST['services'];
} elseif (isset($_POST['services'])) {
    $rawServices = [$_POST['services']];
} else {
    $rawServices = [];
}

foreach ($rawServices as $item) {
    $item = trim((string) $item);
    if ($item !== '') {
        $services[] = $item;
    }
}

$formSource = $formMail['source_label'];

$servicesDisplay = '—';
if ($services !== []) {
    $servicesDisplay = implode(', ', $services);
} elseif ($service !== '') {
    $servicesDisplay = $service;
} elseif ($location !== '') {
    $servicesDisplay = $location;
}

$hearAboutDisplay = displayValue($hearAbout);
$phoneDisplay = displayValue($phone);
$messageDisplay = displayValue($message);

$timezone = (string) ($config['timezone'] ?? 'America/New_York');
$submittedAt = (new DateTimeImmutable('now', new DateTimeZone($timezone)))->format('M j, Y g:i A T');

$subjectLine = $formMail['subject'];
if (in_array($formType, ['refer-a-friend', 'doctor-referral'], true) && $location !== '') {
    $subjectLine .= " — {$location}";
}

$autoreplySubject = $formMail['autoreply_subject'];

$replyTo = $email;
$replyToName = $name;
if ($formType === 'doctor-referral') {
    $dentistEmail = postedString('referring_dentist_email');
    if ($dentistEmail !== '') {
        $replyTo = $dentistEmail;
        $replyToName = postedString('referring_dentist_name');
    }
}

$templateVars = [
    'subject_line' => escapeHtml($subjectLine),
    'name' => escapeHtml($name),
    'email' => escapeHtml($email),
    'email_raw' => $email,
    'phone' => escapeHtml($phoneDisplay),
    'services' => escapeHtml($servicesDisplay),
    'hear_about_us' => escapeHtml($hearAboutDisplay),
    'message' => escapeHtml($messageDisplay),
    'form_source' => escapeHtml($formSource),
    'submitted_at' => escapeHtml($submittedAt),
    'sender_ip' => escapeHtml($remoteIp),
    'site_name' => escapeHtml($fromName),
    'site_url' => escapeHtml((string) ($config['site_url'] ?? '')),
    'site_phone' => escapeHtml((string) ($config['site_phone'] ?? '')),
    'site_phone_href' => escapeHtml((string) ($config['site_phone_href'] ?? '')),
];

foreach (extraFieldKeys() as $key) {
    $templateVars[$key] = escapeHtml(displayValue(postedString($key)));
}

$templateVars['friend_email_raw'] = postedString('friend_email');
$templateVars['referring_dentist_email_raw'] = postedString('referring_dentist_email');

$recipients = notificationRecipients($config, $formType, $location);
$toName = officeEmailForLocation($location) !== '' ? $location : $fromName;

try {
    $notificationTemplate = resolveTemplateForForm($config, $formType, 'notification');
    $notificationHtml = renderTemplate($notificationTemplate, $templateVars);

    sendMail(
        $config,
        $recipients['to'],
        $toName,
        $subjectLine,
        $notificationHtml,
        $replyTo,
        $replyToName,
        $recipients['cc'],
    );

    if ($formMail['send_autoreply']) {
        $autoreplyTemplate = resolveTemplateForForm($config, $formType, 'autoreply');
        $autoreplyHtml = renderTemplate($autoreplyTemplate, [
            'name' => escapeHtml($name),
            'site_name' => escapeHtml($fromName),
            'site_phone' => escapeHtml((string) ($config['site_phone'] ?? '')),
            'site_phone_href' => escapeHtml((string) ($config['site_phone_href'] ?? '')),
        ]);

        sendMail(
            $config,
            $email,
            $name,
            $autoreplySubject,
            $autoreplyHtml,
            parseEmailList($config['notify_to'])[0],
            $fromName,
        );
    }
} catch (Throwable $e) {
    error_log('Form submission error: ' . $e->getMessage());
    jsonError(500, 'Something went wrong sending your message. Please call us instead.');
}

jsonSuccess();
