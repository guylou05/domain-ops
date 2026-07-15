import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const staticRoot = join(process.cwd(), '.next', 'static');
function positiveBudget(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number.`);
  return value;
}

const maxChunkBytes = positiveBudget('PERF_MAX_JS_CHUNK_BYTES', 250000);
const maxCompressedJsBytes = positiveBudget('PERF_MAX_COMPRESSED_JS_BYTES', 300000);
const maxCssBytes = positiveBudget('PERF_MAX_CSS_BYTES', 50000);

if (!existsSync(staticRoot)) throw new Error('No .next production output found. Run npm run build first.');

function filesWithin(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesWithin(path) : [path];
  });
}

const files = filesWithin(staticRoot);
const javascript = files.filter((path) => path.endsWith('.js'));
const stylesheets = files.filter((path) => path.endsWith('.css'));
const largestChunk = javascript.map((path) => ({ path, bytes: statSync(path).size })).sort((a, b) => b.bytes - a.bytes)[0];
const compressedJsBytes = javascript.reduce((total, path) => total + gzipSync(readFileSync(path)).length, 0);
const cssBytes = stylesheets.reduce((total, path) => total + statSync(path).size, 0);

console.log('DomainScout AI performance budget');
console.log(`JavaScript chunks: ${javascript.length}`);
console.log(`Largest JavaScript chunk: ${largestChunk?.bytes ?? 0} bytes (${largestChunk ? relative(process.cwd(), largestChunk.path) : 'none'}) / ${maxChunkBytes}`);
console.log(`Compressed JavaScript total: ${compressedJsBytes} bytes / ${maxCompressedJsBytes}`);
console.log(`CSS total: ${cssBytes} bytes / ${maxCssBytes}`);

const failures = [];
if ((largestChunk?.bytes ?? 0) > maxChunkBytes) failures.push('largest JavaScript chunk');
if (compressedJsBytes > maxCompressedJsBytes) failures.push('compressed JavaScript total');
if (cssBytes > maxCssBytes) failures.push('CSS total');
if (failures.length) throw new Error(`Performance budget exceeded: ${failures.join(', ')}.`);
console.log('Performance budgets passed.');
