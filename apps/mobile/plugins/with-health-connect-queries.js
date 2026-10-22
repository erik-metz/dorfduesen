const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

/** Health Connect's provider availability is queried through package visibility. */
module.exports = function withHealthConnectQueries(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    if (!manifest.queries) manifest.queries = [];
    const alreadyDeclared = manifest.queries.some((query) =>
      (query.package ?? []).some((item) => item.$?.['android:name'] === 'com.google.android.apps.healthdata')
    );
    if (!alreadyDeclared) {
      manifest.queries.push({ package: [{ $: { 'android:name': 'com.google.android.apps.healthdata' } }] });
    }
    return mod;
  });
};
