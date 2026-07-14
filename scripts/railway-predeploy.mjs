import { spawnSync } from 'node:child_process';

function run(command, args, options = {}) {
  console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32', ...options });
  return result.status ?? 1;
}

const recoveryMigration = '20260714200000_initial';

console.log(`Checking whether ${recoveryMigration} needs Railway migration recovery.`);
const recoveryStatus = run('npx', ['prisma', 'migrate', 'resolve', '--rolled-back', recoveryMigration]);

if (recoveryStatus === 0) {
  console.log(`Marked ${recoveryMigration} as rolled back; continuing with migration deploy.`);
} else {
  console.log(`No rollback marker applied for ${recoveryMigration}; continuing with migration deploy.`);
}

const deployStatus = run('npx', ['prisma', 'migrate', 'deploy']);
process.exit(deployStatus);
