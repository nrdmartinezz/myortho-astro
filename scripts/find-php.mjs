import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const phpIni = path.join(root, 'scripts', 'php', 'php.ini');
const cacert = path.join(root, 'scripts', 'php', 'cacert.pem');

const wingetPhp = path.join(
  process.env.LOCALAPPDATA ?? '',
  'Microsoft',
  'WinGet',
  'Packages',
  'PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe',
  'php.exe',
);

function tryWhich() {
  try {
    const out = execSync('where php', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const first = out.split(/\r?\n/).find(Boolean);
    if (first && existsSync(first.trim())) return first.trim();
  } catch {
    // not on PATH yet
  }
  return null;
}

export function findPhpBin() {
  if (process.env.PHP_BIN && existsSync(process.env.PHP_BIN)) {
    return process.env.PHP_BIN;
  }

  const fromPath = tryWhich();
  if (fromPath) return fromPath;

  if (existsSync(wingetPhp)) return wingetPhp;

  throw new Error(
    'PHP not found. Install with: winget install --id PHP.PHP.8.4 --source winget\n' +
      'Then restart your terminal, or set PHP_BIN to the full path to php.exe.',
  );
}

export function phpArgs() {
  const args = ['-c', phpIni];
  if (existsSync(cacert)) {
    args.push('-d', `curl.cainfo=${cacert}`);
    args.push('-d', `openssl.cafile=${cacert}`);
  }
  return args;
}

export function phpCommand(extraArgs = []) {
  const bin = findPhpBin();
  return [bin, ...phpArgs(), ...extraArgs];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(findPhpBin());
}
