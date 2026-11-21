const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Signs Android release builds with the Play upload key when it is configured
 * outside the repository (for example in ~/.gradle/gradle.properties):
 *
 *   DORFDUESEN_UPLOAD_STORE_FILE=/absolute/path/to/upload-keystore.jks
 *   DORFDUESEN_UPLOAD_STORE_PASSWORD=...
 *   DORFDUESEN_UPLOAD_KEY_ALIAS=upload
 *   DORFDUESEN_UPLOAD_KEY_PASSWORD=...
 *
 * Without these properties, release builds keep using the debug key so local
 * release builds still work; such builds are rejected by Google Play.
 */
const MARKER = '// @dorfduesen-release-signing';

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (gradle.includes(MARKER)) return mod;

    gradle = gradle.replace(
      /signingConfigs\s*\{/,
      `signingConfigs {
        ${MARKER}
        if (project.hasProperty('DORFDUESEN_UPLOAD_STORE_FILE')) {
            release {
                storeFile file(DORFDUESEN_UPLOAD_STORE_FILE)
                storePassword DORFDUESEN_UPLOAD_STORE_PASSWORD
                keyAlias DORFDUESEN_UPLOAD_KEY_ALIAS
                keyPassword DORFDUESEN_UPLOAD_KEY_PASSWORD
            }
        }`
    );

    gradle = gradle.replace(
      /(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/,
      `$1signingConfig project.hasProperty('DORFDUESEN_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`
    );

    mod.modResults.contents = gradle;
    return mod;
  });
};
