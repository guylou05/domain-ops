import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const lockfile = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const failures = [];
const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const sections = ['dependencies', 'devDependencies', 'optionalDependencies'];

if (manifest.private !== true) failures.push('package.json must declare private: true');
if (!exactVersion.test(manifest.version ?? '')) failures.push('package.json must declare an exact project version');
if (!/^npm@\d+\.\d+\.\d+$/.test(manifest.packageManager ?? '')) failures.push('packageManager must pin an exact npm version');
if (manifest.devEngines?.packageManager?.name !== 'npm') failures.push('devEngines must enforce npm as the package manager');
if (manifest.devEngines?.packageManager?.onFail !== 'error') failures.push('devEngines must reject the wrong npm version');
if (manifest.engines?.npm !== manifest.devEngines?.packageManager?.version) failures.push('engines.npm must match the supported npm range');
if (manifest.engines?.node !== manifest.devEngines?.runtime?.version) failures.push('engines.node must match the enforced Node runtime');
if (lockfile.lockfileVersion !== 3) failures.push('package-lock.json must use lockfileVersion 3');

let directCount = 0;
for (const section of sections) {
  for (const [name, version] of Object.entries(manifest[section] ?? {})) {
    directCount += 1;
    if (!exactVersion.test(version)) failures.push(`${section}.${name} must use an exact version, found ${version}`);
    if (lockfile.packages?.['']?.[section]?.[name] !== version) failures.push(`${section}.${name} does not match the lockfile root`);
    const locked = lockfile.packages?.[`node_modules/${name}`];
    if (!locked) failures.push(`${section}.${name} is missing from package-lock.json`);
    else if (locked.version !== version) failures.push(`${section}.${name} resolves to ${locked.version}, expected ${version}`);
  }
}

let registryPackages = 0;
for (const [path, entry] of Object.entries(lockfile.packages ?? {})) {
  if (!path.startsWith('node_modules/') || entry.link) continue;
  registryPackages += 1;
  if (!String(entry.resolved ?? '').startsWith('https://registry.npmjs.org/')) failures.push(`${path} is not resolved from the npm registry`);
  if (!String(entry.integrity ?? '').startsWith('sha512-')) failures.push(`${path} is missing SHA-512 integrity metadata`);
}

for (const [dependency, allowed] of Object.entries(manifest.allowScripts ?? {})) {
  const separator = dependency.lastIndexOf('@');
  const name = dependency.slice(0, separator);
  const version = dependency.slice(separator + 1);
  if (!name || !exactVersion.test(version) || allowed !== true) failures.push(`allowScripts contains an invalid approval: ${dependency}`);
  if (lockfile.packages?.[`node_modules/${name}`]?.version !== version) failures.push(`allowScripts approval is stale or missing from the lockfile: ${dependency}`);
}

const digest = /@sha256:[a-f0-9]{64}$/;
let containerReferences = 0;
for (const file of ['Dockerfile', 'docker-compose.yml']) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const dockerFrom = line.match(/^FROM\s+(\S+)/)?.[1];
    const composeImage = line.match(/^\s*image:\s*(\S+)/)?.[1];
    const reference = dockerFrom && !dockerFrom.includes('/') && !dockerFrom.includes(':') ? null : dockerFrom ?? composeImage;
    if (!reference) continue;
    containerReferences += 1;
    if (!digest.test(reference)) failures.push(`${file} contains an unpinned image: ${reference}`);
  }
}

function filesWithin(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesWithin(path) : [path];
  });
}

let actionReferences = 0;
for (const file of filesWithin('.github/workflows').filter((path) => /\.ya?ml$/.test(path))) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const workflowImage = line.match(/^\s*image:\s*(\S+)/)?.[1];
    if (workflowImage) {
      containerReferences += 1;
      if (!digest.test(workflowImage)) failures.push(`${file} contains an unpinned image: ${workflowImage}`);
    }
    const action = line.match(/^\s*uses:\s*([^\s#]+)/)?.[1];
    if (!action || action.startsWith('./') || action.startsWith('docker://')) continue;
    actionReferences += 1;
    const revision = action.split('@').pop() ?? '';
    if (!/^[a-f0-9]{40}$/.test(revision)) failures.push(`${file} contains an action not pinned to a commit SHA: ${action}`);
  }
}

console.log(`Supply-chain policy: ${directCount} exact direct dependencies, ${registryPackages} integrity-checked registry packages, ${containerReferences} digest-pinned images, ${actionReferences} SHA-pinned actions.`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  throw new Error(`Supply-chain policy failed with ${failures.length} issue(s).`);
}
console.log('Supply-chain manifest and lockfile policy passed.');
