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
