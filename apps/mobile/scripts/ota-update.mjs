#!/usr/bin/env node
// Publishes a signed over-the-air update (JavaScript and assets only) to installed store builds.
// Usage: npm run update -- "Kurze Beschreibung der Änderung" [--platform ios|android] [--rollout 25]
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
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
const keyPath = process.env.EXPO_UPDATES_PRIVATE_KEY ?? join(homedir(), '.dorfduesen-updates-signing/private-key.pem');

function fail(text) {
  console.error(`Abgebrochen: ${text}`);
  process.exit(1);
}

if (!message) fail('Bitte eine Beschreibung angeben, z. B. npm run update -- "Coach: Tastatur schließt nach dem Senden".');
if (!['all', 'ios', 'android'].includes(platform)) fail('--platform muss ios, android oder all sein.');
if (rollout && !/^(100|[1-9]\d?)$/.test(rollout)) fail('--rollout muss eine Prozentzahl von 1 bis 100 sein.');
if (!existsSync(keyPath)) fail(`Signaturschlüssel fehlt: ${keyPath}`);

// The API URL is inlined into the bundle; never ship a local development address to every user.
const env = existsSync(join(root, '.env')) ? readFileSync(join(root, '.env'), 'utf8') : '';
const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? env.match(/^EXPO_PUBLIC_API_URL\s*=\s*"?([^"\n]+)"?/m)?.[1] ?? '').trim();
let host = '';
try { host = new URL(apiUrl).hostname; } catch { /* reported below */ }
if (!apiUrl.startsWith('https://') || !host || host === 'localhost' || /^(\d+\.){3}\d+$/.test(host) || host.endsWith('.local')) {
  fail(`EXPO_PUBLIC_API_URL ist keine öffentliche HTTPS-Adresse: "${apiUrl}".`);
}

const status = spawnSync('git', ['status', '--porcelain', '--', '.'], { cwd: root, encoding: 'utf8' });
if (status.stdout.trim()) console.warn('Hinweis: apps/mobile enthält nicht committete Änderungen; sie werden mit ausgeliefert.\n');

console.log(`Update für ${platform} an Kanal production (API ${apiUrl})${rollout ? `, Rollout ${rollout} %` : ''}: ${message}\n`);
const result = spawnSync('npx', [
  '--yes', 'eas-cli@27.11.0', 'update',
  '--channel', 'production', '--environment', 'production',
  '--platform', platform, '--message', message,
  '--private-key-path', keyPath, '--non-interactive',
  ...(rollout ? ['--rollout-percentage', rollout] : []),
], { cwd: root, stdio: 'inherit' });
process.exit(result.status ?? 1);
