import { spawnSync } from 'node:child_process';
import { findPhpBin, phpArgs } from './find-php.mjs';

const result = spawnSync(findPhpBin(), [...phpArgs(), '-v'], { stdio: 'inherit' });
process.exit(result.status ?? 0);
