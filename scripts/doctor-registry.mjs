#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const proxyKeys = ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'npm_config_http_proxy', 'npm_config_https_proxy'];
const activeProxies = proxyKeys.filter((key) => process.env[key]);

console.log('DomainScout AI registry doctor');
console.log(`Node: ${process.version}`);
try {
  const npmVersion = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
  console.log(`npm: ${npmVersion}`);
} catch {
  console.log('npm: unavailable');
}

if (activeProxies.length > 0) {
  console.log('\nProxy-related environment variables detected:');
  for (const key of activeProxies) console.log(`- ${key}=${process.env[key]}`);
  console.log('\nIf npm install returns E403 for public packages, unset these variables or configure an authorized proxy.');
} else {
  console.log('\nNo proxy-related environment variables detected.');
}

const packages = ['next', 'react', '@prisma/client', 'zod'];
let failures = 0;
for (const pkg of packages) {
  try {
    const version = execFileSync('npm', ['view', pkg, 'version', '--registry=https://registry.npmjs.org/'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, npm_config_registry: 'https://registry.npmjs.org/' },
    }).trim();
    console.log(`✓ ${pkg}@${version}`);
  } catch (error) {
    failures += 1;
    const stderr = error?.stderr?.toString?.() ?? '';
    console.log(`✗ ${pkg}: registry check failed`);
    if (stderr.includes('E403') || stderr.includes('403 Forbidden')) {
      console.log('  npm reported 403 Forbidden. This is usually a registry/proxy policy problem, not an application code problem.');
    }
  }
}

if (failures > 0) {
  console.log('\nRecommended recovery commands:');
  console.log('  unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY npm_config_http_proxy npm_config_https_proxy');
  console.log('  npm config set registry https://registry.npmjs.org/');
  console.log('  npm cache verify');
  console.log('  npm install');
  process.exit(1);
}

console.log('\nRegistry access looks healthy. You can run npm install.');
