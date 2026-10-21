# Store-Vorbereitung – Dorfdüsen

Status: **Arbeitsentwurf**. Dieses Paket sammelt Store-Texte, Grafiken und echte Emulatoraufnahmen für iOS und Android.

## Dateien

- `icons/`: App-Icon für iOS, Android Adaptive Icon Vordergrund/Hintergrund und monochromes Symbol.
- `google-play-feature-graphic-1024x500.png`: Google-Play-Feature-Bild.
- `screenshots/google-play/`: fünf echte Aufnahmen der Android-App aus dem Emulator, 1080 × 2160.
- `screenshots/ios-6.9/`: sechs echte Aufnahmen der App aus dem iPhone-17-Pro-Max-Simulator, 1320 × 2868 (Dashboard, Aktivitäten, Physiologie, Trophäen, Arena und Login).
- `store-listing-de.md`: Texte für die deutsche Store-Seite.
- `privacy-policy-draft-de.md`: Datenschutztext als auszufüllender Entwurf.
- `reviewer-notes-de.md`: Hinweise und Zugangsdaten, die für die Store-Prüfung vorzubereiten sind.
- `release-checklist.md`: vor Einreichung zu erledigende Punkte.
- `generate-assets.mjs`: Skript zur Erzeugung von Icons und Feature-Grafik.

## Emulator-Screenshots und Anonymisierung

Die fünf Google-Play-Screenshots stammen aus der echten, angemeldeten Android-App. Die sechs iOS-Screenshots stammen aus der echten App im iPhone-17-Pro-Max-Simulator. Sichtbare Team- und Profilnamen, Profilfotos, die Strava-Athleten-ID sowie der sichtbare Arena-Champion-Name wurden lokal weichgezeichnet. Die übrigen angezeigten Lauf-, Physiologie-, Trophäen- und Arena-Daten sind unverändert. Die Android-Screenshots haben das Format 1080 × 2160, die iOS-Screenshots 1320 × 2868.

Die Anonymisierung erfolgte als lokale Weichzeichnung der Identitätsbereiche, damit die übrigen Originalpixel und Daten erhalten bleiben. Die frühere iOS-Mockup-Galerie wurde entfernt, damit sie nicht mit echten Geräteaufnahmen verwechselt wird.

Die Arena-Aufnahme zeigt aggregierte Clubwerte; der sichtbare Champion-Name wurde weichgezeichnet. Vor der Veröffentlichung der Arena-Ansicht müssen die für das Projekt geltenden Strava-Vorgaben und Freigaben zu Clubdaten bestätigt sein.

## Grafiken und Branding

Die Icons und das Feature-Bild sind eigens für Dorfdüsen gestaltet. Es werden keine Strava-Markenlogos oder Strava-App-Screens als eigene Markenbestandteile verwendet. Eine Strava-Integration ist sachlich zu benennen und darf nicht den Eindruck einer offiziellen Strava-App oder Empfehlung erwecken.

## Erneut generieren

Vom Repository-Root aus:

```sh
node apps/mobile/store-assets/generate-assets.mjs
```

Das Skript erzeugt Icons und das Feature-Bild. Es überschreibt keine echten Store-Screenshots. Nur wenn du ausdrücklich die alten Platzhalter-Screenshots zur Designprüfung brauchst, kannst du sie separat erzeugen:

```sh
node apps/mobile/store-assets/generate-assets.mjs --draft-screenshots
```

Diese Platzhalter werden unter `screenshots/drafts/` abgelegt und nicht als Store-Material verwenden.
