/** Validate secrets when their feature is used, without exposing their values. */
export function requireSecret(name: 'SESSION_SECRET' | 'CRON_SECRET'): string {
  const value = process.env[name];
  if (!value || value.trim().length < 32 || /change-this|your[_-]|fallback-key/i.test(value)) {
    throw new Error(`${name} muss als eigener zufälliger Schlüssel mit mindestens 32 Zeichen konfiguriert sein.`);
  }
  return value;
}
