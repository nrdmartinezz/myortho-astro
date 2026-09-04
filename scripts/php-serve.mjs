import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPhpBin, phpArgs } from './find-php.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const port = process.env.PHP_PORT ?? '8080';

if (!existsSync(distDir)) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

if (!existsSync(path.join(distDir, 'api', 'submit.php'))) {
  console.error('dist/api/submit.php not found. Run `npm run build` and `npm run php:install`.');
  process.exit(1);
}

console.log(`Serving dist/ at http://localhost:${port}`);
console.log('Test forms at http://localhost:' + port + '/');
console.log('API endpoint: http://localhost:' + port + '/api/submit.php');
console.log('Press Ctrl+C to stop.\n');

const result = spawnSync(findPhpBin(), [...phpArgs(), '-S', `localhost:${port}`, '-t', distDir], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 0);
