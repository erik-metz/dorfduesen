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

Setze `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` auf die erreichbare HTTPS-URL der Dorfdüsen-Website. Für einen physischen Entwicklungsgerät muss der lokale Server über die LAN-IP des Rechners erreichbar sein. Im Server-`.env.local` muss `MOBILE_APP_REDIRECT_URI` mit `dorfduesen://auth/callback` übereinstimmen; die Strava-App behält als Callback-Domain die Domain des Next.js-Servers.

Vor dem ersten mobilen Login die Datenbankmigrationen mit `npx prisma migrate deploy` anwenden.

Für einen nativen Simulator:

```sh
npm run mobile:ios
npm run mobile:android
```

Die App verwendet OAuth Authorization Code mit PKCE: Strava-Tokens bleiben auf dem Server, die App erhält einen kurzlebigen Einmal-Code und tauscht ihn in eine widerrufbare Sitzung. Das App-Scheme für den Rücksprung lautet `dorfduesen`.
