import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// npm audit hangs on the registry bulk endpoint for this tree. OSV is the
// same advisory data (GHSA/CVE) without that request.

const OSV_BATCH = 'https://api.osv.dev/v1/querybatch';
const OSV_VULN = 'https://api.osv.dev/v1/vulns/';
const BATCH_SIZE = 100;
const REQUEST_MS = 30_000;

const LEVELS = ['info', 'low', 'moderate', 'high', 'critical'];
const CVSS_TO_LEVEL = (score) => {
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'moderate';
  if (score > 0) return 'low';
  return 'info';
};

const args = new Set(process.argv.slice(2));
const omitDev = args.has('--omit=dev');
const levelArg = [...args].find((flag) => flag.startsWith('--audit-level='));
const failLevel = levelArg?.slice('--audit-level='.length) ?? 'high';

if (failLevel !== 'none' && !LEVELS.includes(failLevel)) {
  console.error(`Unknown --audit-level=${failLevel}. Use ${LEVELS.join('|')}|none.`);
  process.exit(2);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
}

async function main() {
  const lockPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package-lock.json');
  const lock = JSON.parse(await readFile(lockPath, 'utf8'));

  const packages = [];
  const seen = new Set();

  for (const [path, meta] of Object.entries(lock.packages ?? {})) {
    if (!path || !meta.version || meta.link) continue;
    if (omitDev && meta.dev) continue;

    const name = meta.name ?? nameFromNodeModulesPath(path);
    const key = `${name}@${meta.version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    packages.push({ name, version: meta.version, dev: Boolean(meta.dev) });
  }

  packages.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

  const batchResults = [];
  for (let i = 0; i < packages.length; i += BATCH_SIZE) {
    const slice = packages.slice(i, i + BATCH_SIZE);
    const payload = {
      queries: slice.map(({ name, version }) => ({
        package: { name, ecosystem: 'npm' },
        version,
      })),
    };
    const body = await postJson(OSV_BATCH, payload);
    const rows = body.results ?? [];
    if (rows.length !== slice.length) {
      throw new Error(`OSV querybatch returned ${rows.length} rows for ${slice.length} packages.`);
    }
    batchResults.push(...rows);
  }

  const vulnIds = new Set();
  for (const row of batchResults) {
    for (const vuln of row.vulns ?? []) vulnIds.add(vuln.id);
  }

  const details = new Map();
  await Promise.all(
    [...vulnIds].map(async (id) => {
      details.set(id, await getJson(`${OSV_VULN}${encodeURIComponent(id)}`));
    }),
  );

  const findings = [];
  for (const [index, pkg] of packages.entries()) {
    const vulns = (batchResults[index].vulns ?? [])
      .map((ref) => details.get(ref.id))
      .filter(Boolean)
      .map((vuln) => ({ id: vuln.id, summary: vuln.summary ?? vuln.id, level: severityOf(vuln) }))
      .sort(
        (a, b) => LEVELS.indexOf(b.level) - LEVELS.indexOf(a.level) || a.id.localeCompare(b.id),
      );

    if (vulns.length) findings.push({ ...pkg, vulns });
  }

  const failAt = failLevel === 'none' ? Infinity : LEVELS.indexOf(failLevel);
  let failing = 0;

  if (!findings.length) {
    console.log(`No known vulnerabilities in ${packages.length} packages.`);
    process.exit(0);
  }

  for (const finding of findings) {
    const where = finding.dev ? ' [dev]' : '';
    console.log(`${finding.name}@${finding.version}${where}`);
    for (const vuln of finding.vulns) {
      if (LEVELS.indexOf(vuln.level) >= failAt) failing += 1;
      console.log(`  ${vuln.level.toUpperCase().padEnd(9)} ${vuln.id}  ${vuln.summary}`);
      console.log(`            https://osv.dev/vulnerability/${vuln.id}`);
    }
    console.log('');
  }

  console.log(
    `${findings.length} packages, ${[...vulnIds].length} advisories (${packages.length} scanned).`,
  );

  process.exit(failing > 0 ? 1 : 0);
}

function nameFromNodeModulesPath(path) {
  const parts = path.split('node_modules/').filter(Boolean);
  return parts.at(-1).replace(/\/$/, '');
}

function severityOf(vuln) {
  const labelled = vuln.database_specific?.severity;
  if (typeof labelled === 'string') {
    const level = labelled.toLowerCase();
    if (LEVELS.includes(level)) return level;
  }

  for (const entry of vuln.severity ?? []) {
    const numeric = Number.parseFloat(entry.score);
    if (Number.isFinite(numeric)) return CVSS_TO_LEVEL(numeric);

    const fromVector = entry.score?.match(/\/(\d+(?:\.\d+)?)$/);
    if (fromVector) return CVSS_TO_LEVEL(Number.parseFloat(fromVector[1]));
  }

  return 'info';
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_MS),
  });
  if (!response.ok) {
    throw new Error(`${url} responded ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_MS) });
  if (!response.ok) {
    throw new Error(`${url} responded ${response.status} ${response.statusText}`);
  }
  return response.json();
}
