# Dorfdüsen Mobile

Expo-App für iOS und Android. Sie verwendet Expo Router und gehört als eigenständiges Paket zum Repository; die Next.js-Anwendung bleibt im Repository-Wurzelverzeichnis.

## Voraussetzungen

- Node.js `22.13` oder neuer
- npm
- Xcode für iOS-Simulatoren/-Builds auf macOS
- Android Studio und Android SDK für Android-Simulatoren/-Builds

## Starten

```sh
cp apps/mobile/.env.example apps/mobile/.env
npm install --prefix apps/mobile
npm run mobile
```

Setze `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` auf die Basis-URL des Next.js-Servers (ohne abschließenden Pfad):

- iOS-Simulator: `http://localhost:3000`
- Android-Emulator: `http://10.0.2.2:3000` (Host-Rechner aus Sicht des Android-Emulators)
- Physisches Gerät: `http://<LAN-IP-des-Rechners>:3000`, wenn Rechner und Gerät im selben Netzwerk sind; für externe Tests eine erreichbare HTTPS-URL verwenden.

Im Server-`.env.local` muss `MOBILE_APP_REDIRECT_URI` auf `dorfduesen://auth/callback` gesetzt sein. In der Strava-App-Konfiguration bleibt als Callback-Domain die Domain des Next.js-Servers eingetragen; der Server leitet danach in die App zurück. Die App-Konfiguration in `app.json` definiert das Scheme `dorfduesen` sowie die Paket-IDs `de.dorfduesen.app` für Android und iOS.

Vor dem ersten mobilen Login die Datenbankmigrationen mit `npx prisma migrate deploy` anwenden.

Für einen nativen Simulator:

```sh
npm run mobile:ios
npm run mobile:android
```

Die nativen Projektordner `apps/mobile/ios` und `apps/mobile/android` werden mit Expo Prebuild generiert und sind im Git ignoriert. Die App verwendet Expo SDK 57; passende native Abhängigkeiten lassen sich mit `npx expo install --check` prüfen. `npx expo prebuild --no-install --platform all` generiert die nativen Projekte erneut.

Die App verwendet OAuth Authorization Code mit PKCE: Strava-Tokens bleiben auf dem Server, die App erhält einen kurzlebigen Einmal-Code und tauscht ihn in eine widerrufbare Sitzung. Das App-Scheme für den Rücksprung lautet `dorfduesen`.

## HealthKit und Health Connect

Die mobile App kann nach gesonderter In-App-Einwilligung und Betriebssystemfreigabe unterstützte Trainings-, Bewegungs-, Herz-, Körper-, Schlaf-, Vital-, Ernährungs-, Achtsamkeits- und Zyklusdaten lesen und in der Dorfdüsen-Datenbank speichern. Die Auswahl und Synchronisierung befinden sich unter **Dashboard → Physiologie & Zonen → Health-Daten synchronisieren**. Es findet kein Hintergrundimport statt. In der App lassen sich die Synchronisierung trennen und gespeicherte Health-Imports löschen; die Betriebssystemfreigabe kann zusätzlich in den iOS-/Health-Connect-Einstellungen widerrufen werden.

Health-Daten landen in separaten, quellmarkierten Tabellen und werden nicht als Strava-Aktivitäten gewertet. Health-Connect-Daten sind ohne gesonderte Historienberechtigung auf den vom System bereitgestellten Rückblick begrenzt. Auf iOS legt der Nutzer den verfügbaren Zeitraum in HealthKit fest. Native Health-Module funktionieren nur mit einem neu gebauten Development-/Store-Build, nicht in Expo Go. Nach Änderungen an `app.json` die nativen Projekte neu erzeugen und neu bauen:

```sh
npx expo prebuild --no-install --platform all
```

Die Migration `20261022120000_mobile_health_data` legt die Datenbanktabellen an und wird wie andere Prisma-Migrationen mit `npx prisma migrate deploy` ausgerollt. Google Play verlangt vor Veröffentlichung eine Health-Apps-Deklaration, die zu den tatsächlich beantragten Health-Connect-Berechtigungen passt. Datenschutztext und Store-Datenangaben müssen vor Einreichung final abgestimmt werden.

## Smart Coach

Der Tab **Coach** bietet KI-Chat, gespeicherte Gespräche und Trainingspläne. Vor dem Rollout die Migration `20261120120000_mobile_coach` mit `npx prisma migrate deploy` anwenden und die nachfolgende Migration `20261120130000_coach_models_and_budget` mit `npx prisma migrate deploy` anwenden. Serverseitig `XAI_API_KEY` setzen. Der Coach übernimmt verfügbare, kompatible Modelle aus dem xAI-Katalog. Änderungen am Modellkatalog greifen in Web und App nach der nächsten Aktualisierung. Spracheingabe braucht einen nativen Build mit Mikrofon- und Spracherkennungsberechtigungen.

## Releases und Over-the-Air-Updates

Store-Builds enthalten `expo-updates` (Kanal `production`, Laufzeitversion per `fingerprint`). Ein Update ändert nur JavaScript und Assets. Die App sucht beim Start und beim Zurückkehren in den Vordergrund (höchstens alle 15 Minuten) nach Updates und lädt sie im Hintergrund. Ist eines geladen, erscheint oben ein Banner „Neue Version verfügbar“; „Aktualisieren“ lädt die App sofort neu, sonst greift das Update beim nächsten Start (`src/updates/AppUpdates.tsx`).

Oben rechts in jedem Tab steht die laufende Version: `Version (Build) · Datum Uhrzeit` des OTA-Updates, `· Store` ohne Update. Tippen zeigt zusätzlich die Update-ID (passt zum Anfang der Update-ID im EAS-Dashboard) und sucht nach einem neuen Update.

- **Nur JS/UI geändert** (Bildschirme, Texte, Logik in `app/` und `src/`):
  ```sh
  npm run update -- "Kurze Beschreibung"                 # beide Plattformen
  npm run update -- "Beschreibung" --rollout 20          # schrittweise an 20 %
  ```
  `--dry-run` baut und prüft nur, ohne zu veröffentlichen. Das Skript bricht ab, wenn der Fingerprint einer Plattform nicht zum installierten Store-Build passt (`TARGETS` in `scripts/ota-update.mjs`, nach jedem nativen Build anpassen). Es prüft außerdem, dass `EXPO_PUBLIC_API_URL` eine öffentliche HTTPS-Adresse ist. Updates sind nicht signiert (Code-Signing erfordert ein kostenpflichtiges EAS-Abo); geschützt werden sie über das Expo-Konto `metzmade`, daher dort Zwei-Faktor-Anmeldung aktiv halten.
- **Native Änderungen** (neue Pakete mit nativem Code, Berechtigungen, `app.json`, Expo-/React-Native-Upgrade, Patches): neuer Store-Build für beide Plattformen. iOS-Buildnummer und Android-`versionCode` erhöhen, dann wie in `store-assets/ios-release-status.md` und `store-assets/android-release-status.md` beschrieben bauen und hochladen (`npm run play:upload`). Der Fingerprint ändert sich dadurch automatisch; ältere Builds erhalten keine dazu inkompatiblen Updates.

**Bekannte Einschränkung bis zum nächsten nativen Build:** Der Fingerprint enthält noch die Buildnummern beider Plattformen. iOS Build 17 entspricht dem Stand mit Android-`versionCode` 4, Android 5 dem aktuellen `app.json`. `npm run update` setzt für iOS deshalb vorübergehend `versionCode` 4 und stellt `app.json` danach wieder her. Beim nächsten nativen Build `appJsonVersionCode` aus `TARGETS` entfernen, `fingerprint.config.js` mit `sourceSkips: ['ExpoConfigVersions', 'PackageJsonAndroidAndIosScriptsIfNotContainRun']` ergänzen und beide Plattformen aus demselben Commit bauen.
