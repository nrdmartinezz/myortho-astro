import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureCaBundle } from './ensure-cacert.mjs';
import { findPhpBin, phpArgs } from './find-php.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const toolsDir = path.join(root, 'tools');
const apiDir = path.join(root, 'public', 'api');
const vendorDir = path.join(apiDir, 'vendor');
const phpmailerDir = path.join(vendorDir, 'phpmailer', 'phpmailer');
const composerPhar = path.join(toolsDir, 'composer.phar');
const cacert = path.join(root, 'scripts', 'php', 'cacert.pem');
const PHPMailer_VERSION = 'v6.10.0';

function curlDownload(url, dest) {
  const result = spawnSync('curl', ['-fsSL', '-o', dest, url], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`curl failed downloading ${url}`);
  }
}

function runPhp(args, cwd = root) {
  return spawnSync(findPhpBin(), [...phpArgs(), ...args], {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      SSL_CERT_FILE: cacert,
      COMPOSER_CAFILE: cacert,
    },
  });
}

function installPhpmailerViaCurl() {
  console.log(`Vendoring PHPMailer ${PHPMailer_VERSION} via curl…`);
  mkdirSync(vendorDir, { recursive: true });

  const archive = path.join(toolsDir, 'phpmailer.tar.gz');
  curlDownload(
    `https://github.com/PHPMailer/PHPMailer/archive/refs/tags/${PHPMailer_VERSION}.tar.gz`,
    archive,
  );

  const extractParent = 'public/api/vendor/phpmailer';
  rmSync(path.join(root, extractParent, 'phpmailer'), { recursive: true, force: true });
  rmSync(path.join(root, extractParent, `PHPMailer-${PHPMailer_VERSION.slice(1)}`), {
    recursive: true,
    force: true,
  });
  mkdirSync(path.join(root, extractParent), { recursive: true });

  const archiveRel = 'tools/phpmailer.tar.gz';
  const tar = spawnSync('tar', ['xzf', archiveRel, '-C', extractParent], {
    cwd: root,
    stdio: 'inherit',
  });
  if (tar.status !== 0) process.exit(tar.status ?? 1);

  const extractedName = `PHPMailer-${PHPMailer_VERSION.slice(1)}`;
  const mv = spawnSync('mv', [`${extractParent}/${extractedName}`, `${extractParent}/phpmailer`], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  if (mv.status !== 0) process.exit(mv.status ?? 1);

  writeFileSync(
    path.join(vendorDir, 'autoload.php'),
    `<?php
spl_autoload_register(static function (string $class): void {
    $prefix = 'PHPMailer\\\\PHPMailer\\\\';
    if (!str_starts_with($class, $prefix)) return;
    $file = __DIR__ . '/phpmailer/phpmailer/src/' . substr($class, strlen($prefix)) . '.php';
    if (is_readable($file)) require $file;
});
`,
  );

  console.log('PHPMailer vendored successfully.');
}

mkdirSync(toolsDir, { recursive: true });
await ensureCaBundle();

const autoload = path.join(vendorDir, 'autoload.php');
if (existsSync(autoload) && existsSync(phpmailerDir)) {
  console.log('PHPMailer already installed.');
  process.exit(0);
}

if (!existsSync(composerPhar)) {
  console.log('Downloading Composer…');
  curlDownload('https://getcomposer.org/download/latest-stable/composer.phar', composerPhar);
}

console.log('Installing PHPMailer…');
const composer = runPhp([composerPhar, 'install', '--no-dev', '--working-dir=public/api']);

if (composer.status !== 0 || !existsSync(autoload)) {
  console.log('Composer install failed (often SSL on corporate networks). Using curl fallback…');
  installPhpmailerViaCurl();
} else {
  console.log('PHPMailer installed via Composer.');
}

console.log('Done.');
