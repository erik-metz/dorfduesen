#!/usr/bin/env node
// Uploads an Android App Bundle to a Google Play track via the Play Developer API.
// Usage: node scripts/play-upload.mjs [--check] [--track internal] [--aab path] [--key path]
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const checkOnly = args.includes('--check');
const track = option('track', 'internal');
const keyPath = option('key', process.env.PLAY_SERVICE_ACCOUNT ?? join(homedir(), '.dorfduesen-android-signing/play-service-account.json'));
const aabPath = option('aab', new URL('../android/app/build/outputs/bundle/release/app-release.aab', import.meta.url).pathname);
const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
const packageName = app.android.package;
const api = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}`;

async function accessToken() {
  const key = JSON.parse(readFileSync(keyPath, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: key.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: key.token_uri, iat: now, exp: now + 3600,
  })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');
  const response = await fetch(key.token_uri, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Token request failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

const token = await accessToken();
async function call(url, init = {}) {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } });
  const text = await response.text();
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${url.replace(api, '')} → ${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

const edit = await call(`${api}/edits`, { method: 'POST' });
try {
  if (checkOnly) {
    const { tracks } = await call(`${api}/edits/${edit.id}/tracks`);
    for (const item of tracks ?? []) {
      console.log(`${item.track}: ${(item.releases ?? []).map(r => `${r.name ?? '?'} [${r.versionCodes?.join(',')}] ${r.status}`).join('; ') || '-'}`);
    }
    console.log(`Access to ${packageName} OK.`);
  } else {
    const bundle = await call(`${api.replace('/androidpublisher/', '/upload/androidpublisher/')}/edits/${edit.id}/bundles?uploadType=media`, {
      method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: readFileSync(aabPath),
    });
    console.log(`Uploaded versionCode ${bundle.versionCode}`);
    await call(`${api}/edits/${edit.id}/tracks/${track}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track, releases: [{ name: `${bundle.versionCode} (${app.version})`, versionCodes: [String(bundle.versionCode)], status: 'completed' }] }),
    });
    await call(`${api}/edits/${edit.id}:commit`, { method: 'POST' });
    console.log(`Released ${bundle.versionCode} (${app.version}) to ${track}.`);
  }
} finally {
  if (checkOnly) await call(`${api}/edits/${edit.id}`, { method: 'DELETE' }).catch(() => {});
}
