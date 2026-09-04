import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cacertPath = path.join(__dirname, 'php', 'cacert.pem');
const CACERT_URL = 'https://curl.se/ca/cacert.pem';

function curlDownload(url, dest) {
  const result = spawnSync('curl', ['-fsSL', '-o', dest, url], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`curl failed downloading ${url}`);
  }
}

export async function ensureCaBundle() {
  if (existsSync(cacertPath)) return cacertPath;
  curlDownload(CACERT_URL, cacertPath);
  return cacertPath;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  ensureCaBundle().then((p) => console.log(p));
}
