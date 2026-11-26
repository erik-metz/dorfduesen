#!/usr/bin/env node
// Publishes an over-the-air update (JavaScript and assets only) to installed store builds.
// Usage: npm run update -- "Kurze Beschreibung der Änderung" [--platform ios|android] [--rollout 25] [--dry-run]
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Runtime versions (fingerprints) of the store builds that receive updates.
// Until the next native build the fingerprint still contains both platforms' build numbers:
// iOS build 17 was archived while app.json had Android versionCode 4, so iOS updates are
// published with that value temporarily. Remove `appJsonVersionCode` once both platforms
// are rebuilt from the same commit with the fingerprint.config.js described in README.md.
const TARGETS = {
  android: { build: 'Android versionCode 5', fingerprint: '4094cb518aecf5c6c3dc1cb62c97ee2365980475' },
  ios: { build: 'iOS Build 17', fingerprint: '91f81341f9532ecc0f5a103a02e5b61916f12ccf', appJsonVersionCode: 4 },
};

const root = new URL('..', import.meta.url).pathname;
const appJsonPath = join(root, 'app.json');
const args = process.argv.slice(2);
const option = name => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args.splice(index, 2)[1] : undefined;
};
const dryRunIndex = args.indexOf('--dry-run');
const dryRun = dryRunIndex >= 0;
if (dryRun) args.splice(dryRunIndex, 1);
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

const env = { ...process.env, EXPO_PUBLIC_API_URL: apiUrl };
const dist = join(root, 'dist');
const originalAppJson = readFileSync(appJsonPath, 'utf8');
let appJsonChanged = false;
function restoreAppJson() {
  if (!appJsonChanged) return;
  writeFileSync(appJsonPath, originalAppJson);
  appJsonChanged = false;
}
process.on('exit', restoreAppJson);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { restoreAppJson(); process.exit(130); });

function fingerprint(name) {
  const result = spawnSync('npx', ['expo-updates', 'fingerprint:generate', '--platform', name], { cwd: root, encoding: 'utf8', env });
  try { return JSON.parse(result.stdout).hash; } catch { return null; }
}

function publish(name) {
  const target = TARGETS[name];
  if (target.appJsonVersionCode !== undefined) {
    const config = JSON.parse(originalAppJson);
    config.expo.android.versionCode = target.appJsonVersionCode;
    appJsonChanged = true;
    writeFileSync(appJsonPath, `${JSON.stringify(config, null, 2)}\n`);
  }
  try {
    // An update for a runtime version that no installed build has reaches nobody.
    const hash = fingerprint(name);
    if (hash !== target.fingerprint) {
      fail(`Fingerprint für ${name} ist ${hash ?? 'unbekannt'}, ${target.build} erwartet ${target.fingerprint}. `
        + 'Native Änderungen brauchen einen neuen Store-Build; danach TARGETS in scripts/ota-update.mjs anpassen.');
    }
    console.log(`\n${name}: Fingerprint ${hash.slice(0, 8)}… passt zu ${target.build}.`);
    console.log(`Update für ${name} an Kanal production (API ${apiUrl})${rollout ? `, Rollout ${rollout} %` : ''}: ${message}\n`);

    // Bundle locally with the API URL set explicitly: `eas update --environment` does not read .env files.
    rmSync(dist, { recursive: true, force: true });
    const exported = spawnSync('npx', ['expo', 'export', '--clear', '--platform', name, '--output-dir', 'dist'], { cwd: root, stdio: 'inherit', env });
    if (exported.status !== 0) fail(`${name}-Bundle konnte nicht erstellt werden.`);

    // Never publish a bundle that cannot reach the API.
    const files = readdirSync(join(dist, '_expo/static/js'), { recursive: true })
      .filter(file => /\.(hbc|js)$/.test(file) && file.includes(`${name}/`)).map(file => join(dist, '_expo/static/js', file));
    if (!files.length || !files.every(file => readFileSync(file).includes(host))) fail(`Im ${name}-Bundle fehlt die API-Adresse ${host}.`);
    console.log(`API-Adresse im ${name}-Bundle geprüft.\n`);
    if (dryRun) { console.log(`Probelauf: ${name} wird nicht veröffentlicht.`); return; }

    const result = spawnSync('npx', [
      '--yes', 'eas-cli@27.11.0', 'update',
      '--channel', 'production', '--environment', 'production',
      '--platform', name, '--message', message,
      '--skip-bundler', '--input-dir', 'dist', '--non-interactive',
      ...(rollout ? ['--rollout-percentage', rollout] : []),
    ], { cwd: root, stdio: 'inherit', env });
    if (result.status !== 0) fail(`Veröffentlichung für ${name} fehlgeschlagen.`);
  } finally {
    restoreAppJson();
  }
}

for (const name of platform === 'all' ? ['android', 'ios'] : [platform]) publish(name);
console.log('\nFertig.');
