#!/usr/bin/env node
// Publishes an over-the-air update (JavaScript and assets only) to installed store builds.
// Usage: npm run update -- "Kurze Beschreibung der Änderung" [--platform ios|android] [--rollout 25]
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
const option = name => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args.splice(index, 2)[1] : undefined;
};
const platform = option('platform') ?? 'all';
const rollout = option('rollout');
const message = args.join(' ').trim();

function fail(text) {
  console.error(`Abgebrochen: ${text}`);
  process.exit(1);
}

if (!message) fail('Bitte eine Beschreibung angeben, z. B. npm run update -- "Coach: Tastatur schließt nach dem Senden".');
if (!['all', 'ios', 'android'].includes(platform)) fail('--platform muss ios, android oder all sein.');
if (rollout && !/^(100|[1-9]\d?)$/.test(rollout)) fail('--rollout muss eine Prozentzahl von 1 bis 100 sein.');

// The API URL is inlined into the bundle; never ship a local development address to every user.
const dotenv = existsSync(join(root, '.env')) ? readFileSync(join(root, '.env'), 'utf8') : '';
const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? dotenv.match(/^EXPO_PUBLIC_API_URL\s*=\s*"?([^"\n]+)"?/m)?.[1] ?? '').trim();
let host = '';
try { host = new URL(apiUrl).hostname; } catch { /* reported below */ }
if (!apiUrl.startsWith('https://') || !host || host === 'localhost' || /^(\d+\.){3}\d+$/.test(host) || host.endsWith('.local')) {
  fail(`EXPO_PUBLIC_API_URL ist keine öffentliche HTTPS-Adresse: "${apiUrl}".`);
}

const status = spawnSync('git', ['status', '--porcelain', '--', '.'], { cwd: root, encoding: 'utf8' });
if (status.stdout.trim()) console.warn('Hinweis: apps/mobile enthält nicht committete Änderungen; sie werden mit ausgeliefert.\n');

console.log(`Update für ${platform} an Kanal production (API ${apiUrl})${rollout ? `, Rollout ${rollout} %` : ''}: ${message}\n`);

// Bundle locally with the API URL set explicitly: `eas update --environment` does not read .env files.
const env = { ...process.env, EXPO_PUBLIC_API_URL: apiUrl };
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
const exported = spawnSync('npx', ['expo', 'export', '--clear', '--platform', platform, '--output-dir', 'dist'], { cwd: root, stdio: 'inherit', env });
if (exported.status !== 0) fail('Bundle konnte nicht erstellt werden.');

// Never publish a bundle that cannot reach the API.
const bundles = readdirSync(join(dist, '_expo/static/js'), { recursive: true })
  .filter(file => /\.(hbc|js)$/.test(file)).map(file => join(dist, '_expo/static/js', file));
const platforms = platform === 'all' ? ['ios', 'android'] : [platform];
for (const name of platforms) {
  const files = bundles.filter(file => file.includes(`/${name}/`));
  if (!files.length || !files.every(file => readFileSync(file).includes(host))) fail(`Im ${name}-Bundle fehlt die API-Adresse ${host}.`);
}
console.log(`API-Adresse in ${platforms.join(' und ')} geprüft.\n`);

const result = spawnSync('npx', [
  '--yes', 'eas-cli@27.11.0', 'update',
  '--channel', 'production', '--environment', 'production',
  '--platform', platform, '--message', message,
  '--skip-bundler', '--input-dir', 'dist', '--non-interactive',
  ...(rollout ? ['--rollout-percentage', rollout] : []),
], { cwd: root, stdio: 'inherit', env });
process.exit(result.status ?? 1);
