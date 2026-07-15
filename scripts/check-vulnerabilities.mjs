import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const exceptionDocument = JSON.parse(readFileSync('security/audit-exceptions.json', 'utf8'));
const exceptions = new Map(exceptionDocument.exceptions.map((exception) => [exception.id, exception]));
if (exceptions.size !== exceptionDocument.exceptions.length) throw new Error('Audit exception IDs must be unique.');
const npmCli = process.env.npm_execpath;
const audit = npmCli
  ? spawnSync(process.execPath, [npmCli, 'audit', '--json'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  : spawnSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, shell: process.platform === 'win32' });
if (!audit.stdout) throw new Error(`npm audit produced no report: ${audit.error?.message ?? audit.stderr ?? 'unknown error'}`);
const report = JSON.parse(audit.stdout);
if (report.error) throw new Error(`npm audit failed: ${report.error.summary ?? report.error.message ?? 'unknown registry error'}`);
const advisories = new Map();

for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vulnerability.via ?? []) {
    if (typeof via !== 'object' || !via.url) continue;
    const id = via.url.split('/').pop();
    advisories.set(id, { id, package: via.name, severity: via.severity, title: via.title });
  }
}

const failures = [];
const today = new Date();
const counts = report.metadata?.vulnerabilities ?? {};
if ((counts.critical ?? 0) > 0 || (counts.high ?? 0) > 0) failures.push('npm audit reported a high or critical vulnerability');
for (const exception of exceptions.values()) {
  const reviewedAt = new Date(`${exception.reviewedOn}T00:00:00Z`);
  const expiryDate = new Date(`${exception.expiresOn}T00:00:00Z`);
  const expiresAt = new Date(`${exception.expiresOn}T23:59:59Z`);
  if (!Number.isFinite(reviewedAt.getTime())) failures.push(`${exception.id} exception requires a valid reviewedOn date`);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt < today) failures.push(`${exception.id} exception expired on ${exception.expiresOn}`);
  if (expiryDate.getTime() - reviewedAt.getTime() > 90 * 24 * 60 * 60 * 1000) failures.push(`${exception.id} exception exceeds the 90-day review window`);
  if (!String(exception.rationale ?? '').trim()) failures.push(`${exception.id} exception requires a rationale`);
}
for (const advisory of advisories.values()) {
  if (advisory.severity === 'high' || advisory.severity === 'critical') {
    failures.push(`${advisory.id} (${advisory.package}) is ${advisory.severity}; high and critical findings cannot be excepted`);
    continue;
  }
  if (advisory.severity !== 'moderate') continue;
  const exception = exceptions.get(advisory.id);
  if (!exception) {
    failures.push(`${advisory.id} (${advisory.package}) is moderate and has no reviewed exception`);
    continue;
  }
  if (exception.package !== advisory.package) failures.push(`${advisory.id} exception package does not match ${advisory.package}`);
  if (exception.severity !== advisory.severity) failures.push(`${advisory.id} exception severity does not match ${advisory.severity}`);
}

console.log(`npm audit: critical=${counts.critical ?? 0}, high=${counts.high ?? 0}, moderate=${counts.moderate ?? 0}, low=${counts.low ?? 0}`);
for (const advisory of advisories.values()) {
  const exception = exceptions.get(advisory.id);
  console.log(`${advisory.id} ${advisory.package} ${advisory.severity}${exception ? ` excepted until ${exception.expiresOn}` : ''}`);
}
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  throw new Error(`Vulnerability policy failed with ${failures.length} issue(s).`);
}
console.log('Vulnerability policy passed.');
