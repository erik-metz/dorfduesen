# Android-Veröffentlichung – Arbeitsstand

Stand: 21. November 2026.

## Festgelegter Vertrieb (analog iOS)

- Kostenlos, ausschließlich Deutschland.
- Name: Dorfdüsen; Hauptsprache: Deutsch (de-DE).
- Paketname: `de.dorfduesen.app`; Kategorie-Vorschlag: Gesundheit & Fitness.
- Support-/Datenschutz-URLs: `https://dorfduesen.de/support`, `https://dorfduesen.de/datenschutz`.

## Play Console

- Privates Entwicklerkonto „MetzMade“; App-ID `4973801011669673435`.
- Ein früherer Entwurf mit dem Platzhalter-Paket `com.dorfduesen.myapp` wurde gelöscht und die
  App am 21. November 2026 neu mit `de.dorfduesen.app`, Deutsch, App, kostenlos angelegt.
- Interner Test: Release `1 (1.0)` hochgeladen und veröffentlicht (Play App Signing aktiv,
  Downloadgröße ca. 27 MB). Tester-Liste „intern users“ (1 Person) ist dem Track zugeordnet.

### App-Inhalte (alle am 21. November 2026 gespeichert)

- Datenschutz-URL: `https://dorfduesen.vercel.app/datenschutz` (`dorfduesen.de` hat noch keinen
  DNS-Eintrag; nach Einrichtung der Domain hier und in der Datensicherheit umstellen).
- Werbung: keine. Werbe-ID: nicht verwendet. Behörden-App: nein. Finanzfunktionen: keine.
- Anmeldedaten: Strava-Prüferkonto mit englischen Hinweisen (Zugangsdaten nur im Portal).
- Altersfreigabe (IARC): Kategorie „All Other App Types“, nur „Online-Inhalte“ (KI-Coach) mit
  Ja → USK 0, PEGI 3. Kontakt: metzmade@pm.me.
- Zielgruppe: 18 und älter.
- Health-Apps: Aktivität & Fitness, Ernährung & Gewicht, Zyklus, Schlaf, Stress/Achtsamkeit;
  alle 27 Health-Connect-Berechtigungen einzeln begründet (Lesen nur nach Zustimmung und
  manuellem Import, nur persönliches Dashboard, keine Weitergabe).
- Datensicherheit: erhoben (nicht geteilt) werden Name, Nutzer-IDs, ungefährer und genauer
  Standort (Strava-Strecken), Fotos (Strava-Profilbild), sonstige In-App-Nachrichten (Coach-
  Chat, optional), Gesundheitsdaten (optional) und Fitnessdaten; verschlüsselte Übertragung;
  Konto-/Datenlöschung über die App bzw. `https://dorfduesen.vercel.app/support`.
- Store-Einstellungen: Kategorie Health & Fitness, E-Mail metzmade@pm.me, Website
  `https://dorfduesen.vercel.app/support`.
- Store-Eintrag (de-DE): Texte aus `store-listing-de.md`, Icon 512 px, Feature-Grafik und fünf
  Screenshots (1080 × 2160); keine KI-Kennzeichnung.

### Offen

- Änderungen über „Publishing overview“ zur Prüfung senden.
- Geschlossener Test mit mindestens 12 Testern über 14 Tage, danach Produktionszugriff beantragen.
- Länderauswahl (nur Deutschland) beim geschlossenen Test/Produktion setzen.

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

## Upload per Play Developer API

- Service-Account `t3-code@dorfduesen.iam.gserviceaccount.com` (Google-Cloud-Projekt
  `dorfduesen`, Play Android Developer API aktiv) ist in der Play Console mit Rechten für
  Test-Tracks eingeladen. JSON-Schlüssel: `~/.dorfduesen-android-signing/play-service-account.json`
  (nicht im Repository; alternativ Pfad über `PLAY_SERVICE_ACCOUNT`).
- `npm run play:upload` lädt `app-release.aab` hoch und veröffentlicht es im internen Test;
  `npm run play:upload -- --check` prüft nur den Zugriff und listet die Tracks.
- 22. November 2026: versionCode 2 (1.0) so in den internen Test veröffentlicht.
- iOS und Android werden gemeinsam gebaut und hochgeladen (iOS-Ablauf siehe
  `ios-release-status.md`).

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
