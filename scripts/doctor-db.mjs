#!/usr/bin/env node
import { existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(command, args, options = {}) {
  const baseOptions = {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  };

  if (process.platform === 'win32') {
    return execFileSync([command, ...args].join(' '), {
      ...baseOptions,
      shell: true,
    }).trim();
  }

  return execFileSync(command, args, baseOptions).trim();
}

function printStep(label, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` - ${detail}` : ''}`);
}

console.log('DomainScout AI database doctor');

let failures = 0;

try {
  run(npx, ['prisma', 'validate'], {
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/domainscout',
    },
  });
  printStep('Prisma schema validates', true);
} catch (error) {
  failures += 1;
  printStep('Prisma schema validates', false);
  if (error?.message) console.log(error.message);
  const stderr = error?.stderr?.toString?.() ?? '';
  if (stderr) console.log(stderr);
}

const migrationsPath = 'prisma/migrations';
if (existsSync(migrationsPath)) {
  const migrations = readdirSync(migrationsPath, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  printStep('Migration directory exists', migrations.length > 0, `${migrations.length} migration(s)`);
  if (migrations.length === 0) failures += 1;
} else {
  failures += 1;
  printStep('Migration directory exists', false);
}

if (process.env.DATABASE_URL) {
  printStep('DATABASE_URL is configured', true);
} else {
  printStep('DATABASE_URL is configured', false, 'required for db:status, db:deploy, db:seed, and worker processing');
}

if (process.argv.includes('--status')) {
  if (!process.env.DATABASE_URL) {
    failures += 1;
    printStep('Prisma migration status', false, 'DATABASE_URL is missing');
  } else {
    try {
      const output = run(npx, ['prisma', 'migrate', 'status']);
      printStep('Prisma migration status', true);
      console.log(output);
    } catch (error) {
      failures += 1;
      printStep('Prisma migration status', false);
      if (error?.message) console.log(error.message);
      const stderr = error?.stderr?.toString?.() ?? '';
      if (stderr) console.log(stderr);
    }
  }
}

if (failures > 0) {
  console.log('\nDatabase readiness checks failed.');
  process.exit(1);
}

console.log('\nDatabase readiness checks passed.');
