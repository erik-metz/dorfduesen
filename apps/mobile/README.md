# Dorfdüsen Mobile

Expo-App für iOS und Android. Sie verwendet Expo Router und gehört als eigenständiges Paket zum Repository; die Next.js-Anwendung bleibt im Repository-Wurzelverzeichnis.

## Voraussetzungen

- Node.js `22.13` oder neuer
- npm
- Xcode für iOS-Simulatoren/-Builds auf macOS
- Android Studio und Android SDK für Android-Simulatoren/-Builds

## Starten

```sh
npm install --prefix apps/mobile
npm run mobile
```

Für einen nativen Simulator:

```sh
npm run mobile:ios
npm run mobile:android
```

Die Tabs und der Login-Einstieg sind derzeit ein UI-Grundgerüst. Strava OAuth und die echte Sitzung folgen in Schritt 3 des Implementierungsplans. Das App-Scheme für den späteren Rücksprung lautet `dorfduesen`.
