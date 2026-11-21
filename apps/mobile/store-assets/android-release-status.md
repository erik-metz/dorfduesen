# Android-Veröffentlichung – Arbeitsstand

Stand: 21. November 2026.

## Festgelegter Vertrieb (analog iOS)

- Kostenlos, ausschließlich Deutschland.
- Name: Dorfdüsen; Hauptsprache: Deutsch (de-DE).
- Paketname: `de.dorfduesen.app`; Kategorie-Vorschlag: Gesundheit & Fitness.
- Support-/Datenschutz-URLs: `https://dorfduesen.de/support`, `https://dorfduesen.de/datenschutz`.

## Signierung (Play App Signing)

- Google verwaltet den App-Signaturschlüssel (Play App Signing). Lokal gibt es nur den
  **Upload-Schlüssel**.
- Upload-Keystore: `~/.dorfduesen-android-signing/dorfduesen-upload.jks`, Alias `upload`,
  RSA 4096, PKCS12. Nicht im Repository.
- Passwort: macOS-Schlüsselbund, Eintrag „Dorfduesen Android Upload Keystore“; Gradle liest
  die Werte aus `~/.gradle/gradle.properties` (`DORFDUESEN_UPLOAD_*`).
- Zertifikat-Fingerabdrücke des Upload-Schlüssels:
  - SHA-1: `FA:BD:7A:61:A7:F2:88:70:6E:55:A1:F6:6B:0C:E2:AD:BF:25:F6:8E`
  - SHA-256: `39:22:37:48:B9:05:E1:28:95:59:60:86:35:87:59:E8:9A:19:C2:80:1D:BF:86:17:90:FB:40:B8:C6:BC:D9:63`
- Keystore und Passwort sicher sichern (z. B. Passwortmanager). Bei Verlust kann der
  Upload-Schlüssel über den Play-Support zurückgesetzt werden.
- Das Config-Plugin `plugins/with-android-release-signing.js` übernimmt die Signierung nach
  jedem `expo prebuild`. Ohne die Gradle-Properties wird mit dem Debug-Schlüssel signiert
  (für Play ungültig).

## Release-Build

Aus `apps/mobile`:

```sh
npx expo prebuild --no-install --platform android
cd android && ANDROID_HOME=$HOME/Library/Android/sdk ./gradlew :app:bundleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a
```

Ergebnis: `android/app/build/outputs/bundle/release/app-release.aab`.
Nicht benötigte Berechtigungen (`SYSTEM_ALERT_WINDOW`, Biometrie) sind über
`android.blockedPermissions` entfernt; das Release-Manifest enthält neben Health Connect nur
`INTERNET`, `RECORD_AUDIO` (Diktat im Coach) und `VIBRATE`.

Vor jedem weiteren Upload `expo.android.versionCode` in `app.json` erhöhen.

## Nächste Schritte in der Play Console

1. App erstellen: Dorfdüsen, Deutsch, App, kostenlos; Erklärungen bestätigen.
2. Interner Test → neuen Release erstellen → Play App Signing akzeptieren → AAB hochladen.
3. App-Inhalte: Datenschutzerklärung, App-Zugriff (Prüferkonto), Werbung (keine),
   Einstufung, Zielgruppe (18+ empfohlen), Datensicherheit, Health-Apps-Erklärung und
   Health-Connect-Berechtigungen, Behördenapps/Finanzen/News (nein).
4. Store-Eintrag: Texte aus `store-listing-de.md`, Icon `icons/google-play-icon-512.png`, Feature-Grafik, Screenshots `screenshots/google-play/`.
5. Länder: nur Deutschland.
6. Bei neuem privatem Entwicklerkonto: geschlossener Test mit mind. 12 Testern über 14 Tage,
   bevor der Produktionszugriff beantragt werden kann.
