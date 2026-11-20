/**
 * Applies the pending migrations at startup.
 *
 * A database created before migrations existed (built with `prisma db push`) is not empty and has no
 * migration history: Prisma answers P3005. Its schema already equals the baseline, so the baseline is
 * recorded as applied and the remaining migrations run normally. A new empty database runs them all.
 */
const { spawnSync } = require('child_process');

const BASELINE = '20261120000000_baseline';

function prisma(args) {
    const result = spawnSync('npx', ['prisma', ...args], { encoding: 'utf8' });
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    return { code: result.status, output: `${result.stdout}\n${result.stderr}` };
}

let deploy = prisma(['migrate', 'deploy']);

if (deploy.code !== 0 && deploy.output.includes('P3005')) {
    console.log(`[migrate] existing database without history: recording ${BASELINE} as applied`);
    const resolved = prisma(['migrate', 'resolve', '--applied', BASELINE]);
    if (resolved.code !== 0) process.exit(resolved.code || 1);
    deploy = prisma(['migrate', 'deploy']);
}

process.exit(deploy.code === null ? 1 : deploy.code);
